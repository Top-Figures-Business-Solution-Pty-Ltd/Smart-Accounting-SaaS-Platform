# Smart Accounting - Partitions API
# Partition/Workspace API模块，提供分区和工作区管理

import frappe
from frappe import _
import json


def get_default_subtask_column_config():
    """Get default column configuration for subtasks"""
    return {
        'default_visible_columns': ['task-name', 'status', 'note', 'action-person', 'priority', 'process-date', 'lodgment-due'],
        'default_column_order': ['task-name', 'status', 'note', 'action-person', 'preparer', 'reviewer', 'partner', 'priority', 'process-date', 'lodgment-due', 'target-month', 'budget', 'actual'],
        'primary_column': 'task-name'
    }


@frappe.whitelist()
def create_partition(partition_name, is_workspace=False, parent_partition=None, description="", icon="", board_display_type="Task-Centric"):
    """
    Create a new partition (workspace or board)
    """
    try:
        # Ensure is_workspace is properly converted to boolean
        is_workspace = frappe.utils.cint(is_workspace) if is_workspace is not None else False
        
        if not partition_name or not partition_name.strip():
            return {'success': False, 'error': 'Partition name is required'}
        
        partition_name = partition_name.strip()
        
        # Safely truncate description to prevent "Value too big" error
        if description and len(description) > 140:
            description = description[:140]
        
        # Check if partition already exists with same name under same parent
        existing_filters = {"partition_name": partition_name}
        if parent_partition:
            existing_filters["parent_partition"] = parent_partition
        else:
            existing_filters["parent_partition"] = ["is", "not set"]
        
        existing = frappe.db.exists("Partition", existing_filters)
        if existing:
            return {'success': False, 'error': f'A partition with name "{partition_name}" already exists'}
        
        # Create new partition
        new_partition = frappe.new_doc("Partition")
        new_partition.partition_name = partition_name
        new_partition.is_workspace = 1 if is_workspace else 0
        new_partition.description = description
        new_partition.icon = icon
        
        # Board display type
        if not is_workspace and board_display_type:
            valid_types = ["Task-Centric", "Contact-Centric", "Client-Centric"]
            if board_display_type in valid_types:
                new_partition.board_display_type = board_display_type
            else:
                new_partition.board_display_type = "Task-Centric"
        elif not is_workspace:
            new_partition.board_display_type = "Task-Centric"
        
        if parent_partition:
            if not frappe.db.exists("Partition", parent_partition):
                return {'success': False, 'error': f'Parent partition "{parent_partition}" not found'}
            new_partition.parent_partition = parent_partition
        
        # Set default visible columns
        _set_default_columns(new_partition, parent_partition)
        
        new_partition.save()
        frappe.db.commit()
        
        return {
            'success': True,
            'message': f'{"Workspace" if is_workspace else "Board"} "{partition_name}" created successfully',
            'name': new_partition.name,
            'partition_name': partition_name
        }
        
    except Exception as e:
        frappe.log_error(f"Error creating partition: {str(e)}")
        return {'success': False, 'error': str(e)}


def _set_default_columns(partition_doc, parent_partition):
    """Set default column configuration for a partition"""
    default_columns = [
        "client", "task-name", "entity", "tf-tg", "software", "communication-methods", 
        "client-contact", "status", "note", "target-month", "budget", "actual", 
        "review-note", "action-person", "preparer", "reviewer", "partner", 
        "lodgment-due", "engagement", "group", "year-end", "last-updated", 
        "priority", "frequency", "reset-date"
    ]
    
    if parent_partition:
        try:
            parent_doc = frappe.get_doc("Partition", parent_partition)
            if parent_doc.visible_columns:
                partition_doc.visible_columns = parent_doc.visible_columns
                partition_doc.column_config = parent_doc.column_config or "{}"
                
                default_config = get_default_subtask_column_config()
                partition_doc.subtask_visible_columns = getattr(parent_doc, 'subtask_visible_columns', None) or json.dumps(default_config['default_visible_columns'])
                partition_doc.subtask_column_config = getattr(parent_doc, 'subtask_column_config', None) or json.dumps({"column_order": default_config['default_column_order'], "primary_column": default_config['primary_column']})
                return
        except:
            pass
    
    # Use default columns
    partition_doc.visible_columns = json.dumps(default_columns)
    partition_doc.column_config = json.dumps({"column_order": default_columns})
    
    default_config = get_default_subtask_column_config()
    partition_doc.subtask_visible_columns = json.dumps(default_config['default_visible_columns'])
    partition_doc.subtask_column_config = json.dumps({"column_order": default_config['default_column_order'], "primary_column": default_config['primary_column']})


@frappe.whitelist()
def archive_partition(partition_name, archived=True):
    """Archive/unarchive a partition"""
    try:
        if not frappe.db.exists("Partition", partition_name):
            return {'success': False, 'error': 'Partition not found'}
        
        child_count = frappe.db.count("Partition", {"parent_partition": partition_name})
        if child_count > 0 and archived:
            return {'success': False, 'error': 'Cannot archive partition with child partitions'}
        
        project_count = frappe.db.count("Project", {"custom_partition": partition_name})
        if project_count > 0 and archived:
            return {'success': False, 'error': f'Cannot archive partition with {project_count} assigned projects'}
        
        frappe.db.set_value("Partition", partition_name, "is_archived", 1 if archived else 0)
        frappe.db.commit()
        
        action = "archived" if archived else "unarchived"
        return {'success': True, 'message': f'Partition {action} successfully'}
        
    except Exception as e:
        frappe.log_error(f"Error archiving partition: {str(e)}")
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def get_child_partitions(parent_partition):
    """Get child partitions for workspace navigation"""
    try:
        children = frappe.get_all("Partition",
            fields=["name", "partition_name", "is_workspace"],
            filters={"parent_partition": parent_partition, "is_archived": ["!=", 1]},
            order_by="partition_name"
        )
        
        for child in children:
            child_count = frappe.db.count("Partition", {
                "parent_partition": child.name,
                "is_archived": ["!=", 1]
            })
            child['has_children'] = child_count > 0
        
        return children
    except Exception as e:
        frappe.log_error(f"Error getting child partitions: {str(e)}")
        return []


@frappe.whitelist()
def get_available_workspaces():
    """Get all available workspaces for selection"""
    try:
        return frappe.get_all("Partition",
            fields=["name", "partition_name"],
            filters={"is_workspace": 1, "is_archived": ["!=", 1]},
            order_by="partition_name"
        )
    except Exception as e:
        frappe.log_error(f"Error getting available workspaces: {str(e)}")
        return []


@frappe.whitelist()
def get_all_partitions():
    """Get all partitions (workspaces and boards)"""
    try:
        return frappe.get_all("Partition",
            fields=["name", "partition_name", "is_workspace", "parent_partition", "description", "icon"],
            filters={"is_archived": ["!=", 1]},
            order_by="partition_name"
        )
    except Exception as e:
        frappe.log_error(f"Error getting all partitions: {str(e)}")
        return []


@frappe.whitelist()
def update_partition_columns(partition_name, visible_columns, column_config=None):
    """Update visible columns configuration for a partition"""
    try:
        if not frappe.db.exists("Partition", partition_name):
            return {'success': False, 'error': 'Partition not found'}
        
        update_data = {"visible_columns": visible_columns}
        if column_config:
            update_data["column_config"] = column_config
        
        frappe.db.set_value("Partition", partition_name, update_data)
        frappe.db.commit()
        
        return {'success': True, 'message': 'Column configuration updated'}
    except Exception as e:
        frappe.log_error(f"Error updating partition columns: {str(e)}")
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def get_partition_config(partition_name):
    """Get partition configuration including columns"""
    try:
        if not frappe.db.exists("Partition", partition_name):
            return {'success': False, 'error': 'Partition not found'}
        
        partition = frappe.get_doc("Partition", partition_name)
        
        return {
            'success': True,
            'name': partition.name,
            'partition_name': partition.partition_name,
            'is_workspace': partition.is_workspace,
            'description': partition.description,
            'icon': partition.icon,
            'visible_columns': partition.visible_columns,
            'column_config': partition.column_config,
            'subtask_visible_columns': getattr(partition, 'subtask_visible_columns', None),
            'subtask_column_config': getattr(partition, 'subtask_column_config', None),
            'board_display_type': getattr(partition, 'board_display_type', 'Task-Centric')
        }
    except Exception as e:
        frappe.log_error(f"Error getting partition config: {str(e)}")
        return {'success': False, 'error': str(e)}

