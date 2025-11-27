# Smart Accounting - Combination View API
# 组合视图相关API模块

import frappe
from frappe import _
import json


@frappe.whitelist()
def get_available_boards_for_combination():
    """Get all available boards for combination view"""
    try:
        boards = frappe.db.get_all("Partition",
            fields=["name", "partition_name", "description", "parent_partition"],
            filters={
                "is_workspace": 0,
                "is_archived": ["!=", 1]
            },
            order_by="partition_name"
        )
        
        # Get task counts for each board
        for board in boards:
            projects = frappe.get_all("Project",
                filters={"custom_partition": board.name, "status": ["!=", "Cancelled"]},
                fields=["name"]
            )
            
            task_count = 0
            if projects:
                project_names = [p.name for p in projects]
                task_count = frappe.db.count("Task", {
                    "project": ["in", project_names],
                    "custom_is_archived": ["!=", 1]
                })
            
            board['task_count'] = task_count
            board['project_count'] = len(projects)
        
        return {'success': True, 'boards': boards}
    except Exception as e:
        frappe.log_error(f"Error getting boards for combination: {str(e)}")
        return {'success': False, 'error': str(e), 'boards': []}


@frappe.whitelist()
def save_combination_view(view_name, description, board_ids, is_public=0):
    """Save a combination view"""
    try:
        if not view_name:
            return {'success': False, 'error': 'View name is required'}
        
        if isinstance(board_ids, str):
            board_ids = json.loads(board_ids)
        
        if not board_ids or len(board_ids) < 2:
            return {'success': False, 'error': 'At least 2 boards are required'}
        
        # Check if view name already exists
        existing = frappe.db.get_value("Combination View", {"view_name": view_name})
        if existing:
            return {'success': False, 'error': f'View "{view_name}" already exists'}
        
        # Create combination view
        combo_view = frappe.new_doc("Combination View")
        combo_view.view_name = view_name
        combo_view.description = description
        combo_view.is_public = is_public
        combo_view.owner = frappe.session.user
        
        for board_id in board_ids:
            combo_view.append('boards', {'board': board_id})
        
        combo_view.save()
        frappe.db.commit()
        
        return {
            'success': True,
            'combination_id': combo_view.name,
            'message': f'Combination view "{view_name}" saved'
        }
    except Exception as e:
        frappe.log_error(f"Error saving combination view: {str(e)}")
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def get_saved_combinations():
    """Get all saved combination views"""
    try:
        user = frappe.session.user
        
        combinations = frappe.get_all("Combination View",
            filters=[
                ["owner", "=", user],
                ["is_public", "=", 1]
            ],
            or_filters=[
                ["owner", "=", user],
                ["is_public", "=", 1]
            ],
            fields=["name", "view_name", "description", "is_public", "owner", "creation"]
        )
        
        return {'success': True, 'combinations': combinations}
    except Exception as e:
        frappe.log_error(f"Error getting saved combinations: {str(e)}")
        return {'success': False, 'error': str(e), 'combinations': []}


@frappe.whitelist()
def load_combination_view(combination_id):
    """Load a specific combination view"""
    try:
        if not combination_id:
            return {'success': False, 'error': 'Combination ID is required'}
        
        combo = frappe.get_doc("Combination View", combination_id)
        
        board_ids = [b.board for b in combo.boards]
        
        return {
            'success': True,
            'view_name': combo.view_name,
            'description': combo.description,
            'board_ids': board_ids
        }
    except Exception as e:
        frappe.log_error(f"Error loading combination view: {str(e)}")
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def delete_combination_view(combination_id):
    """Delete a combination view"""
    try:
        if not combination_id:
            return {'success': False, 'error': 'Combination ID is required'}
        
        frappe.delete_doc("Combination View", combination_id)
        frappe.db.commit()
        
        return {'success': True, 'message': 'Combination view deleted'}
    except Exception as e:
        frappe.log_error(f"Error deleting combination view: {str(e)}")
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def get_combination_view_data(board_ids):
    """Get data for multiple boards in combination view"""
    try:
        if isinstance(board_ids, str):
            board_ids = json.loads(board_ids)
        
        if not board_ids:
            return {'success': False, 'error': 'Board IDs are required'}
        
        boards_data = []
        
        for partition_name in board_ids:
            if not frappe.db.exists("Partition", partition_name):
                continue
            
            partition = frappe.get_doc("Partition", partition_name)
            
            # Get column config
            column_config = {}
            if partition.column_config:
                column_config = json.loads(partition.column_config)
            
            # Get board data (simplified)
            projects = frappe.get_all("Project",
                filters={"custom_partition": partition_name, "status": ["!=", "Cancelled"]},
                fields=["name", "project_name"]
            )
            
            total_tasks = 0
            if projects:
                project_names = [p.name for p in projects]
                total_tasks = frappe.db.count("Task", {
                    "project": ["in", project_names],
                    "custom_is_archived": ["!=", 1]
                })
            
            boards_data.append({
                "board_id": partition.name,
                "board_name": partition.partition_name,
                "description": partition.description or "",
                "column_config": column_config,
                "total_tasks": total_tasks,
                "total_projects": len(projects)
            })
        
        return {
            'success': True,
            'boards': boards_data,
            'total_boards': len(boards_data)
        }
    except Exception as e:
        frappe.log_error(f"Error getting combination view data: {str(e)}")
        return {'success': False, 'error': str(e)}

