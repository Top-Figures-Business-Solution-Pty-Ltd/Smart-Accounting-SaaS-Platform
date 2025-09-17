import os
import json
import traceback
import frappe


def _safe_get_all(doctype: str, fields=None, filters=None, limit=None):
    try:
        return frappe.get_all(doctype, fields=fields or ['name'], filters=filters or {}, limit_page_length=limit or 0)
    except Exception:
        return []


def _read_fixture_list(filename: str):
    try:
        fixture_path = frappe.get_app_path('smart_accounting', 'fixtures', filename)
        if os.path.exists(fixture_path):
            with open(fixture_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if isinstance(data, list):
                    return data
        return []
    except Exception:
        return []


def _scrub(name: str) -> str:
    try:
        return frappe.scrub(name)
    except Exception:
        import re
        return re.sub(r'[^a-z0-9_]', '_', (name or '').strip().lower())


def _find_owner_app_for_doctype(doctype_name: str) -> str:
    """Best-effort resolve which installed app owns a DocType by checking the doctype folder.
    Returns app name or 'unknown'.
    """
    scrubbed = _scrub(doctype_name)
    for app in frappe.get_installed_apps():
        try:
            path = frappe.get_app_path(app, 'doctype', scrubbed)
            if os.path.exists(path):
                return app
        except Exception:
            continue
    return 'unknown'


def _list_smart_accounting_doctypes_from_fs():
    try:
        base = frappe.get_app_path('smart_accounting', 'doctype')
        if not os.path.isdir(base):
            return set()
        return {d for d in os.listdir(base) if os.path.isdir(os.path.join(base, d))}
    except Exception:
        return set()


def _collect_customizations():
    """Collect Custom Field and Property Setter by DocType from DB with fixtures fallback."""
    cf_by_dt = {}
    ps_by_dt = {}

    # DB first
    try:
        custom_fields = _safe_get_all('Custom Field', fields=['name', 'dt', 'fieldname', 'label', 'fieldtype'])
        for cf in custom_fields:
            dt = cf.get('dt')
            if not dt:
                continue
            cf_by_dt.setdefault(dt, []).append({
                'name': cf.get('name'),
                'fieldname': cf.get('fieldname'),
                'label': cf.get('label'),
                'fieldtype': cf.get('fieldtype')
            })
    except Exception:
        pass

    try:
        props = _safe_get_all('Property Setter', fields=['name', 'doc_type', 'field_name', 'property', 'value'])
        for ps in props:
            dt = ps.get('doc_type')
            if not dt:
                continue
            ps_by_dt.setdefault(dt, []).append({
                'name': ps.get('name'),
                'field_name': ps.get('field_name'),
                'property': ps.get('property'),
                'value': ps.get('value')
            })
    except Exception:
        pass

    # Fallback to fixtures if DB empty
    if not cf_by_dt:
        try:
            cf_fixtures = _read_fixture_list('custom_field.json')
            for item in cf_fixtures:
                dt = (item.get('dt') or item.get('doc_type'))
                if not dt:
                    continue
                cf_by_dt.setdefault(dt, []).append({
                    'name': item.get('name'),
                    'fieldname': item.get('fieldname'),
                    'label': item.get('label'),
                    'fieldtype': item.get('fieldtype')
                })
        except Exception:
            pass

    if not ps_by_dt:
        try:
            ps_fixtures = _read_fixture_list('property_setter.json')
            for item in ps_fixtures:
                dt = item.get('doc_type')
                if not dt:
                    continue
                ps_by_dt.setdefault(dt, []).append({
                    'name': item.get('name'),
                    'field_name': item.get('field_name'),
                    'property': item.get('property'),
                    'value': item.get('value')
                })
        except Exception:
            pass

    return cf_by_dt, ps_by_dt


def _build_structure():
    doctypes = [d['name'] for d in _safe_get_all('DocType', fields=['name'])]

    smart_doctypes_fs = _list_smart_accounting_doctypes_from_fs()
    custom_fields_map, prop_setter_map = _collect_customizations()

    nodes = []
    edges = set()  # (from, to, kind, fieldname)

    for dt in doctypes:
        try:
            meta = frappe.get_meta(dt)
        except Exception:
            # Skip doctypes that fail to load
            continue

        owner_app = _find_owner_app_for_doctype(dt)
        belongs_to_smart = (owner_app == 'smart_accounting') or (_scrub(dt) in smart_doctypes_fs)
        is_custom_doctype = bool(getattr(meta, 'custom', False))

        # customizations applied to this doctype (even if not owned by smart_accounting)
        cf_list = custom_fields_map.get(dt, [])
        ps_list = prop_setter_map.get(dt, [])
        is_modified = bool(cf_list or ps_list)

        fields = []
        link_count = 0
        child_count = 0

        for df in getattr(meta, 'fields', []) or []:
            fi = {
                'fieldname': df.fieldname,
                'label': df.label,
                'fieldtype': df.fieldtype,
                'options': df.options,
                'reqd': int(getattr(df, 'reqd', 0) or 0),
                'unique': int(getattr(df, 'unique', 0) or 0),
                'in_list_view': int(getattr(df, 'in_list_view', 0) or 0),
                'in_standard_filter': int(getattr(df, 'in_standard_filter', 0) or 0),
            }
            fields.append(fi)

            # relationships
            ftype = (df.fieldtype or '').strip()
            if ftype == 'Link' and df.options:
                link_count += 1
                edges.add((dt, df.options, 'Link', df.fieldname))
            elif ftype == 'Dynamic Link':
                # dynamic link - target varies
                edges.add((dt, '(Dynamic Link)', 'Dynamic Link', df.fieldname))
            elif ftype in ('Table', 'Table MultiSelect') and df.options:
                child_count += 1
                edges.add((dt, df.options, 'Child Table', df.fieldname))

        node = {
            'doctype': dt,
            'module': getattr(meta, 'module', None),
            'owner_app': owner_app,
            'belongs_to': 'Smart Accounting' if belongs_to_smart else owner_app,
            'is_custom_doctype': is_custom_doctype,
            'is_modified': is_modified,
            'custom_fields': cf_list,
            'property_setters': ps_list,
            'field_count': len(fields),
            'link_field_count': link_count,
            'child_table_field_count': child_count,
            'fields': fields,
        }
        nodes.append(node)

    # build mermaid graph (limited to Smart + Modified subset by default)
    def _is_focus(n):
        return (n['belongs_to'] == 'Smart Accounting') or n['is_modified']

    focus_doctypes = {n['doctype'] for n in nodes if _is_focus(n)}
    mermaid_edges = []
    edge_seen = set()
    for f, t, kind, fieldname in edges:
        # include edges if either endpoint is in focus set to avoid exploding size
        if f in focus_doctypes or t in focus_doctypes:
            key = (f, t, kind)
            if key in edge_seen:
                continue
            edge_seen.add(key)
            label = 'Link' if kind == 'Link' else ('Child' if kind.startswith('Child') else kind)
            # sanitize node ids for mermaid
            def _mm(txt):
                return _scrub(txt).replace('-', '_')[:60] or 'x'
            mermaid_edges.append(f"{_mm(f)}--> |{label}| {_mm(t)}")

    mermaid_graph = "graph LR\n" + "\n".join(mermaid_edges) if mermaid_edges else "graph LR\nA[No Data]\n"

    return {
        'nodes': nodes,
        'edges': [{'from': f, 'to': t, 'kind': k, 'fieldname': fn} for (f, t, k, fn) in edges],
        'summary': {
            'total_doctypes': len(nodes),
            'smart_or_modified_count': len({n['doctype'] for n in nodes if (n['belongs_to'] == 'Smart Accounting' or n['is_modified'])}),
            'smart_count': len({n['doctype'] for n in nodes if (n['belongs_to'] == 'Smart Accounting')}),
            'modified_count': len({n['doctype'] for n in nodes if n['is_modified']}),
        },
        'mermaid': mermaid_graph
    }


def get_context(context):
    context.no_cache = True
    context.requires_login = True
    context.title = 'Data Structure Explorer'
    try:
        data = _build_structure()
    except Exception as e:
        frappe.log_error(message=traceback.format_exc(), title='Data Structure Build Failed')
        data = {
            'nodes': [],
            'edges': [],
            'summary': {'total_doctypes': 0, 'smart_or_modified_count': 0, 'smart_count': 0, 'modified_count': 0},
            'mermaid': 'graph LR\nERR[Error building data]\n'
        }
    context.data_json = frappe.as_json(data)
    return context


