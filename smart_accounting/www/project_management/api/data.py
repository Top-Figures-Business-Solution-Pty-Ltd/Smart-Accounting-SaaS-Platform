# Smart Accounting - Data Loading API
# 数据加载相关API模块

import frappe
from frappe import _


@frappe.whitelist()
def load_partition_data(view='main', enable_adaptive_loading=True):
    """
    Load project data for specific partition (called by JavaScript)
    """
    from .dashboard import get_workspace_title
    
    try:
        if enable_adaptive_loading:
            total_count = get_data_count_internal(view)
            
            if total_count > 1000:
                data = get_project_management_data_chunked(view, chunk_size=200)
            else:
                # Import from parent module to avoid circular imports
                from .. import get_project_management_data
                data = get_project_management_data(view)
        else:
            from .. import get_project_management_data
            data = get_project_management_data(view)
        
        return {
            'success': True,
            'data': data,
            'view': view,
            'title': get_workspace_title(view),
            'total_count': len(data) if isinstance(data, list) else 0,
            'adaptive_loading_used': enable_adaptive_loading and total_count > 1000 if 'total_count' in locals() else False
        }
    except Exception as e:
        frappe.log_error(f"Error loading partition data: {str(e)}")
        return {'success': False, 'error': str(e)}


def get_data_count_internal(view='main'):
    """内部数据计数方法"""
    try:
        conditions = []
        values = []
        
        if view != 'main':
            partition_projects = frappe.get_all("Project", 
                filters={"custom_partition": view},
                fields=["name"]
            )
            if partition_projects:
                project_names = [p.name for p in partition_projects]
                conditions.append("project IN ({})".format(','.join(['%s'] * len(project_names))))
                values.extend(project_names)
        
        where_clause = " AND ".join(conditions) if conditions else "1=1"
        
        count = frappe.db.sql(f"""
            SELECT COUNT(*) as total
            FROM `tabTask`
            WHERE {where_clause}
        """, values)[0][0]
        
        return count
        
    except Exception as e:
        frappe.log_error(f"Error getting data count: {str(e)}")
        return 0


def get_project_management_data_chunked(view='main', chunk_size=200):
    """分块获取数据"""
    try:
        first_chunk = get_project_management_data_paginated(view, 0, chunk_size)
        total_count = get_data_count_internal(view)
        
        if total_count > chunk_size:
            first_chunk['needs_more_loading'] = True
            first_chunk['total_count'] = total_count
            first_chunk['loaded_count'] = len(first_chunk.get('tasks', []))
        
        return first_chunk
        
    except Exception as e:
        frappe.log_error(f"Error in chunked data loading: {str(e)}")
        from .. import get_project_management_data
        return get_project_management_data(view)


@frappe.whitelist()
def get_data_count(view='main', filters=None):
    """Get task count for a view"""
    try:
        import json
        if isinstance(filters, str):
            filters = json.loads(filters)
        
        conditions = ["1=1"]
        values = []
        
        if view != 'main':
            partition_projects = frappe.get_all("Project",
                filters={"custom_partition": view},
                fields=["name"]
            )
            if partition_projects:
                project_names = [p.name for p in partition_projects]
                conditions.append("project IN ({})".format(','.join(['%s'] * len(project_names))))
                values.extend(project_names)
        
        if filters:
            if filters.get('client'):
                conditions.append("custom_client = %s")
                values.append(filters['client'])
            if filters.get('status'):
                conditions.append("status = %s")
                values.append(filters['status'])
        
        where_clause = " AND ".join(conditions)
        
        count = frappe.db.sql(f"""
            SELECT COUNT(*) as total
            FROM `tabTask`
            WHERE {where_clause}
        """, values)[0][0]
        
        return {'success': True, 'count': count}
        
    except Exception as e:
        frappe.log_error(f"Error getting data count: {str(e)}")
        return {'success': False, 'error': str(e), 'count': 0}


@frappe.whitelist()
def get_paginated_data(view='main', offset=0, limit=50, filters=None):
    """Get paginated task data"""
    try:
        import json
        if isinstance(filters, str):
            filters = json.loads(filters)
        
        data = get_project_management_data_paginated(view, int(offset), int(limit), filters)
        
        return {
            'success': True,
            'data': data,
            'offset': offset,
            'limit': limit
        }
    except Exception as e:
        frappe.log_error(f"Error getting paginated data: {str(e)}")
        return {'success': False, 'error': str(e)}


def get_project_management_data_paginated(view='main', offset=0, limit=50, filters=None):
    """优化的分页数据获取"""
    try:
        conditions = ["1=1"]
        values = []
        
        if view != 'main':
            partition_projects = frappe.get_all("Project", 
                filters={"custom_partition": view},
                fields=["name"]
            )
            if partition_projects:
                project_names = [p.name for p in partition_projects]
                conditions.append("t.project IN ({})".format(','.join(['%s'] * len(project_names))))
                values.extend(project_names)
        
        if filters:
            if filters.get('client'):
                conditions.append("t.custom_client = %s")
                values.append(filters['client'])
            if filters.get('status'):
                conditions.append("t.status = %s")
                values.append(filters['status'])
        
        where_clause = " AND ".join(conditions)
        
        tasks_data = frappe.db.sql(f"""
            SELECT 
                t.name as task_id,
                t.subject as task_name,
                t.custom_client,
                t.status,
                t.custom_entity_type,
                t.modified as last_modified,
                COALESCE(c.customer_name, 'No Client') as client_name
            FROM `tabTask` t
            LEFT JOIN `tabCustomer` c ON t.custom_client = c.name
            WHERE {where_clause}
            ORDER BY COALESCE(c.customer_name, 'No Client'), t.subject
            LIMIT %s OFFSET %s
        """, values + [limit, offset], as_dict=True)
        
        enriched_tasks = []
        for task in tasks_data:
            enriched_tasks.append({
                'task_id': task.task_id,
                'task_name': task.task_name,
                'client_name': task.client_name,
                'status': task.status,
                'entity_type': task.custom_entity_type or 'Company',
                'last_modified': task.last_modified
            })
        
        return {
            'tasks': enriched_tasks,
            'total_loaded': len(enriched_tasks)
        }
        
    except Exception as e:
        frappe.log_error(f"Error in paginated data fetch: {str(e)}")
        return {'tasks': [], 'total_loaded': 0}


@frappe.whitelist()
def get_companies_for_tftg():
    """Get companies for TF/TG dropdown"""
    try:
        companies = frappe.get_all("Company",
            fields=["name", "company_name", "abbr"],
            order_by="company_name"
        )
        return {'success': True, 'companies': companies}
    except Exception as e:
        frappe.log_error(f"Error getting companies: {str(e)}")
        return {'success': False, 'error': str(e), 'companies': []}


@frappe.whitelist()
def get_field_options(doctype, fieldname):
    """Get field options for a doctype field"""
    try:
        meta = frappe.get_meta(doctype)
        field = meta.get_field(fieldname)
        
        if not field:
            return {'success': False, 'error': 'Field not found'}
        
        options = []
        if field.options:
            options = [opt.strip() for opt in field.options.split('\n') if opt.strip()]
        
        return {'success': True, 'options': options}
    except Exception as e:
        frappe.log_error(f"Error getting field options: {str(e)}")
        return {'success': False, 'error': str(e), 'options': []}

