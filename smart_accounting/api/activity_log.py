"""
Activity Log APIs (website-safe)
- Projects + Clients create/update/delete
- Supports masked output unless correct password provided
"""

from __future__ import annotations

from typing import Any

import frappe


def _ensure_logged_in() -> None:
	if frappe.session.user in (None, "", "Guest"):
		frappe.throw("Not permitted", frappe.PermissionError)


def _normalize_int(v: Any, default: int) -> int:
	try:
		return int(v)
	except Exception:
		return int(default)


def _clean_str(v: Any) -> str:
	return str(v or "").strip()


def _target_doctypes(target: str | None = None) -> list[str]:
	t = _clean_str(target).lower()
	if t == "project":
		return ["Project"]
	if t == "client":
		return ["Customer"]
	return ["Project", "Customer"]


def _activity_filter(activity: str | None = None) -> set[str]:
	a = _clean_str(activity).lower()
	if a in ("create", "update", "delete"):
		return {a}
	return {"create", "update", "delete"}


def _get_user_fullname(user: str, cache: dict[str, str]) -> str:
	u = _clean_str(user)
	if not u:
		return ""
	if u in cache:
		return cache[u]
	try:
		name = frappe.get_cached_value("User", u, "full_name") or u
		cache[u] = name
		return name
	except Exception:
		cache[u] = u
		return u


def _is_password_valid(password: str | None) -> bool:
	pwd = _clean_str(password)
	if not pwd:
		return False
	cfg = frappe.get_site_config() or {}
	secret = _clean_str(cfg.get("smart_activity_log_password"))
	if not secret:
		return False
	return pwd == secret


def _safe_json(v: Any) -> dict:
	try:
		if isinstance(v, dict):
			return v
		if isinstance(v, str):
			return frappe.parse_json(v) or {}
	except Exception:
		pass
	return {}


def _field_label_map(doctype: str) -> dict[str, str]:
	try:
		meta = frappe.get_meta(doctype)
	except Exception:
		return {}
	out: dict[str, str] = {}
	for f in (meta.fields or []):
		fn = _clean_str(getattr(f, "fieldname", ""))
		lb = _clean_str(getattr(f, "label", "")) or fn
		if fn:
			out[fn] = lb
	return out


def _short(v: Any) -> str:
	s = _clean_str(v)
	if len(s) <= 120:
		return s
	return f"{s[:117]}..."


def _parse_sb_activity_comment(content: Any) -> dict | None:
	raw = _clean_str(content)
	prefix = "SB_ACTIVITY::"
	if not raw.startswith(prefix):
		return None
	try:
		obj = frappe.parse_json(raw[len(prefix) :]) or {}
		if isinstance(obj, dict):
			return obj
	except Exception:
		return None
	return None


@frappe.whitelist()
def get_activity_users() -> dict:
	_ensure_logged_in()
	rows = frappe.get_all(
		"User",
		filters={"enabled": 1},
		fields=["name", "full_name"],
		limit_page_length=2000,
		order_by="full_name asc",
	)
	items = [
		{"user": r.get("name"), "label": r.get("full_name") or r.get("name")}
		for r in (rows or [])
		if r.get("name")
	]
	return {"items": items}


@frappe.whitelist()
def get_activity_log(
	limit_start: int = 0,
	limit_page_length: int = 50,
	user: str | None = None,
	target: str | None = None,
	activity: str | None = None,
	password: str | None = None,
) -> dict:
	_ensure_logged_in()

	limit_start = max(0, _normalize_int(limit_start, 0))
	limit_page_length = max(1, min(200, _normalize_int(limit_page_length, 50)))
	fetch_limit = max(200, limit_start + limit_page_length)

	target_doctypes = _target_doctypes(target)
	activity_set = _activity_filter(activity)
	user_filter = _clean_str(user)
	unlocked = _is_password_valid(password)

	events: list[dict] = []

	# Create events (doc creation)
	if "create" in activity_set:
		for dt in target_doctypes:
			filters = {}
			if user_filter:
				filters["owner"] = user_filter
			rows = frappe.get_all(
				dt,
				filters=filters,
				fields=["name", "owner", "creation"],
				order_by="creation desc",
				limit_page_length=fetch_limit,
			)
			for r in rows or []:
				events.append(
					{
						"action": "Create",
						"doctype": dt,
						"docname": r.get("name"),
						"user": r.get("owner"),
						"timestamp": r.get("creation"),
					}
				)

	# Update events (Version)
	if "update" in activity_set:
		v_filters: dict[str, Any] = {"ref_doctype": ["in", target_doctypes]}
		if user_filter:
			v_filters["owner"] = user_filter
		rows = frappe.get_all(
			"Version",
			filters=v_filters,
			fields=["ref_doctype", "docname", "owner", "creation"],
			order_by="creation desc",
			limit_page_length=fetch_limit,
		)
		for r in rows or []:
			events.append(
				{
					"action": "Update",
					"doctype": r.get("ref_doctype"),
					"docname": r.get("docname"),
					"user": r.get("owner"),
					"timestamp": r.get("creation"),
				}
			)

	# Delete events (Deleted Document)
	if "delete" in activity_set:
		d_filters: dict[str, Any] = {"deleted_doctype": ["in", target_doctypes]}
		if user_filter:
			d_filters["owner"] = user_filter
		rows = frappe.get_all(
			"Deleted Document",
			filters=d_filters,
			fields=["deleted_doctype", "deleted_name", "owner", "creation"],
			order_by="creation desc",
			limit_page_length=fetch_limit,
		)
		for r in rows or []:
			events.append(
				{
					"action": "Delete",
					"doctype": r.get("deleted_doctype"),
					"docname": r.get("deleted_name"),
					"user": r.get("owner"),
					"timestamp": r.get("creation"),
				}
			)

	# Sort & paginate
	events.sort(key=lambda x: str(x.get("timestamp") or ""), reverse=True)
	page = events[limit_start : limit_start + limit_page_length]

	user_cache: dict[str, str] = {}
	out_items = []
	for ev in page:
		doctype = _clean_str(ev.get("doctype"))
		is_project = doctype == "Project"
		target_label = "Project" if is_project else "Client"
		user_name = _clean_str(ev.get("user"))
		docname = _clean_str(ev.get("docname"))
		if unlocked:
			user_label = _get_user_fullname(user_name, user_cache) or user_name or "Unknown"
			doc_label = docname or "—"
		else:
			user_label = "Someone"
			doc_label = "a project" if is_project else "a client"

		out_items.append(
			{
				"action": ev.get("action"),
				"target": "project" if is_project else "client",
				"target_label": target_label,
				"user": user_name,
				"user_label": user_label,
				"docname": docname,
				"doc_label": doc_label,
				"timestamp": ev.get("timestamp"),
			}
		)

	return {
		"items": out_items,
		"meta": {
			"limit_start": limit_start,
			"limit_page_length": limit_page_length,
			"unlocked": unlocked,
		},
	}


@frappe.whitelist()
def get_project_activity(project: str, limit_start: int = 0, limit_page_length: int = 100) -> dict:
	"""
	Project-centric activity feed for Smart Board popup.
	Returns update rows (who/when/field/from/to) parsed from Version.data.
	"""
	_ensure_logged_in()
	name = _clean_str(project)
	if not name:
		frappe.throw("project is required")
	if not frappe.has_permission("Project", "read", name):
		frappe.throw("Not permitted", frappe.PermissionError)

	limit_start = max(0, _normalize_int(limit_start, 0))
	limit_page_length = max(1, min(300, _normalize_int(limit_page_length, 100)))

	labels = _field_label_map("Project")
	user_cache: dict[str, str] = {}
	items: list[dict] = []

	# Creation event (single)
	try:
		created = frappe.db.get_value("Project", name, ["owner", "creation"], as_dict=True) or {}
		if created.get("creation"):
			user_name = _clean_str(created.get("owner"))
			items.append(
				{
					"action": "create",
					"field": "Project",
					"field_label": "Project",
					"from_value": "",
					"to_value": "Created",
					"user": user_name,
					"user_label": _get_user_fullname(user_name, user_cache) or user_name or "Unknown",
					"timestamp": created.get("creation"),
				}
			)
	except Exception:
		pass

	# Update events
	comment_rows = frappe.get_all(
		"Comment",
		filters={
			"reference_doctype": "Project",
			"reference_name": name,
			"comment_type": "Info",
		},
		fields=["owner", "creation", "content"],
		order_by="creation desc",
		limit_page_length=5000,
	)
	for r in (comment_rows or []):
		payload = _parse_sb_activity_comment(r.get("content"))
		if not payload:
			continue
		field = _clean_str(payload.get("field"))
		if field and field not in _PROJECT_ACTIVITY_FIELDS:
			continue
		user_name = _clean_str(r.get("owner"))
		items.append(
			{
				"action": "update",
				"field": field,
				"field_label": _clean_str(payload.get("field_label")) or labels.get(field) or field,
				"from_value": _short(payload.get("from_value")),
				"to_value": _short(payload.get("to_value")),
				"user": user_name,
				"user_label": _get_user_fullname(user_name, user_cache) or user_name or "Unknown",
				"timestamp": r.get("creation"),
			}
		)

	# Backward-compat fallback: old Version rows (only when no new structured comments yet)
	if not any((x.get("action") == "update") for x in items):
		rows = frappe.get_all(
			"Version",
			filters={"ref_doctype": "Project", "docname": name},
			fields=["name", "owner", "creation", "data"],
			order_by="creation desc",
			limit_page_length=2000,
		)

		for r in (rows or []):
			payload = _safe_json(r.get("data"))
			changed = payload.get("changed") if isinstance(payload, dict) else None
			if not isinstance(changed, list):
				continue
			user_name = _clean_str(r.get("owner"))
			user_label = _get_user_fullname(user_name, user_cache) or user_name or "Unknown"
			ts = r.get("creation")
			for c in changed:
				if not isinstance(c, (list, tuple)) or len(c) < 3:
					continue
				field = _clean_str(c[0])
				if not field:
					continue
				if field not in _PROJECT_ACTIVITY_FIELDS:
					continue
				items.append(
					{
						"action": "update",
						"field": field,
						"field_label": labels.get(field) or field,
						"from_value": _short(c[1]),
						"to_value": _short(c[2]),
						"user": user_name,
						"user_label": user_label,
						"timestamp": ts,
					}
				)

	# Newest first
	items.sort(key=lambda x: str(x.get("timestamp") or ""), reverse=True)
	page = items[limit_start : limit_start + limit_page_length]
	return {
		"items": page,
		"meta": {
			"limit_start": limit_start,
			"limit_page_length": limit_page_length,
			"total_count": len(items),
		},
	}


_PROJECT_ACTIVITY_FIELDS = {
	"customer",
	"project_name",
	"status",
	"expected_end_date",
	"expected_start_date",
	"notes",
	"company",
	"custom_lodgement_due_date",
	"custom_target_month",
	"priority",
	"estimated_costing",
	"custom_entity_type",
	"custom_customer_entity",
	"project_type",
	"custom_project_frequency",
	"custom_fiscal_year",
	"is_active",
	"custom_team_members",
	"custom_softwares",
	"custom_engagement_letter",
}


