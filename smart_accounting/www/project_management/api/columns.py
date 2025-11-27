# Smart Accounting - Columns API
# 列配置相关API模块

import frappe
from frappe import _
import json


DEFAULT_COLUMNS = [
    "client", "task-name", "entity", "tf-tg", "software", "communication-methods", 
    "client-contact", "status", "note", "target-month", "budget", "actual", 
    "review-note", "action-person", "preparer", "reviewer", "partner", 
    "lodgment-due", "engagement", "group", "year-end", "last-updated", 
    "priority", "frequency", "reset-date"
]


@frappe.whitelist(allow_guest=False)
def get_partition_column_config(partition_name):
    """Get column configuration for a partition"""
    try:
        if not partition_name or partition_name == 'main':
            return {
                'success': True,
                'visible_columns': json.dumps(DEFAULT_COLUMNS),
                'column_config': json.dumps({"column_order": DEFAULT_COLUMNS})
            }
        
        partition = frappe.get_doc("Partition", partition_name)
        
        return {
            'success': True,
            'visible_columns': partition.visible_columns or json.dumps(DEFAULT_COLUMNS),
            'column_config': partition.column_config or json.dumps({"column_order": DEFAULT_COLUMNS})
        }
    except Exception as e:
        frappe.log_error(f"Error getting partition column config: {str(e)}")
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def save_partition_column_config(partition_name, visible_columns, column_config=None):
    """Save column configuration for a partition"""
    try:
        if not partition_name or partition_name == 'main':
            return {'success': False, 'error': 'Cannot save config for main view'}
        
        if not frappe.db.exists("Partition", partition_name):
            return {'success': False, 'error': 'Partition not found'}
        
        update_data = {"visible_columns": visible_columns}
        if column_config:
            update_data["column_config"] = column_config
        
        frappe.db.set_value("Partition", partition_name, update_data)
        frappe.db.commit()
        
        return {'success': True, 'message': 'Column configuration saved'}
    except Exception as e:
        frappe.log_error(f"Error saving partition column config: {str(e)}")
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def save_partition_column_width(partition_id, column_name, width):
    """Save column width for a partition"""
    try:
        if not partition_id or partition_id == 'main':
            return {'success': False, 'error': 'Cannot save width for main view'}
        
        partition = frappe.get_doc("Partition", partition_id)
        
        column_config = {}
        if partition.column_config:
            column_config = json.loads(partition.column_config)
        
        if 'column_widths' not in column_config:
            column_config['column_widths'] = {}
        
        column_config['column_widths'][column_name] = width
        
        partition.column_config = json.dumps(column_config)
        partition.save()
        frappe.db.commit()
        
        return {'success': True, 'message': 'Column width saved'}
    except Exception as e:
        frappe.log_error(f"Error saving column width: {str(e)}")
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def save_user_column_widths(column_widths, column_type="main_tasks"):
    """Save user-specific column widths"""
    try:
        if isinstance(column_widths, str):
            column_widths = json.loads(column_widths)
        
        user = frappe.session.user
        pref_name = f"column_widths_{column_type}"
        
        existing = frappe.db.get_value("User Preferences", 
            {"user": user, "preference_name": pref_name}, "name")
        
        if existing:
            frappe.db.set_value("User Preferences", existing, 
                "preference_value", json.dumps(column_widths))
        else:
            frappe.get_doc({
                "doctype": "User Preferences",
                "user": user,
                "preference_name": pref_name,
                "preference_value": json.dumps(column_widths)
            }).insert()
        
        frappe.db.commit()
        return {'success': True, 'message': 'Column widths saved'}
    except Exception as e:
        frappe.log_error(f"Error saving user column widths: {str(e)}")
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def load_user_column_widths(column_type="main_tasks"):
    """Load user-specific column widths"""
    try:
        user = frappe.session.user
        pref_name = f"column_widths_{column_type}"
        
        pref = frappe.db.get_value("User Preferences",
            {"user": user, "preference_name": pref_name},
            "preference_value"
        )
        
        if pref:
            return {'success': True, 'column_widths': json.loads(pref)}
        return {'success': True, 'column_widths': {}}
    except Exception as e:
        frappe.log_error(f"Error loading user column widths: {str(e)}")
        return {'success': False, 'error': str(e), 'column_widths': {}}


@frappe.whitelist()
def get_all_task_columns():
    """Get all available task columns"""
    return {
        'success': True,
        'columns': DEFAULT_COLUMNS
    }


@frappe.whitelist()
def get_subtask_column_config(partition_name):
    """Get subtask column configuration for a partition"""
    try:
        from .partitions import get_default_subtask_column_config
        
        default_config = get_default_subtask_column_config()
        
        if not partition_name or partition_name == 'main':
            return {
                'success': True,
                'visible_columns': json.dumps(default_config['default_visible_columns']),
                'column_config': json.dumps({
                    "column_order": default_config['default_column_order'],
                    "primary_column": default_config['primary_column']
                })
            }
        
        partition = frappe.get_doc("Partition", partition_name)
        
        return {
            'success': True,
            'visible_columns': getattr(partition, 'subtask_visible_columns', None) or json.dumps(default_config['default_visible_columns']),
            'column_config': getattr(partition, 'subtask_column_config', None) or json.dumps({
                "column_order": default_config['default_column_order'],
                "primary_column": default_config['primary_column']
            })
        }
    except Exception as e:
        frappe.log_error(f"Error getting subtask column config: {str(e)}")
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def save_subtask_column_config(partition_name, visible_columns, column_config=None):
    """Save subtask column configuration for a partition"""
    try:
        if not partition_name or partition_name == 'main':
            return {'success': False, 'error': 'Cannot save subtask config for main view'}
        
        if not frappe.db.exists("Partition", partition_name):
            return {'success': False, 'error': 'Partition not found'}
        
        update_data = {"subtask_visible_columns": visible_columns}
        if column_config:
            update_data["subtask_column_config"] = column_config
        
        frappe.db.set_value("Partition", partition_name, update_data)
        frappe.db.commit()
        
        return {'success': True, 'message': 'Subtask column configuration saved'}
    except Exception as e:
        frappe.log_error(f"Error saving subtask column config: {str(e)}")
        return {'success': False, 'error': str(e)}

