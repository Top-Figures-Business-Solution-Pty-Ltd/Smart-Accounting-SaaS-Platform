"""
Smart Accounting - Batch Operations API
Handles bulk updates and batch operations for project management tasks
"""

import frappe
from frappe import _
import json


@frappe.whitelist()
def batch_update_tasks(updates_data):
    """
    Batch update multiple tasks with different fields in a single transaction
    
    Args:
        updates_data: JSON string or list of updates
                     [{"task_id": "TASK-001", "field": "status", "value": "Completed"}, ...]
    
    Returns:
        dict: {
            'success': bool,
            'success_count': int,
            'error_count': int,
            'errors': list,
            'total_tasks': int
        }
    
    This API handles bulk updates in a single database transaction to avoid 
    document modification conflicts and improve performance for SaaS operations.
    """
    if not updates_data:
        return {'success': False, 'error': 'No updates provided'}
    
    # Parse JSON if string
    if isinstance(updates_data, str):
        try:
            updates_data = json.loads(updates_data)
        except json.JSONDecodeError:
            return {'success': False, 'error': 'Invalid JSON format'}
    
    if not isinstance(updates_data, list):
        return {'success': False, 'error': 'Updates data must be a list'}
    
    success_count = 0
    errors = []
    
    try:
        # Use database transaction to ensure atomicity
        frappe.db.begin()
        
        # Group updates by task_id for efficiency
        updates_by_task = {}
        for update in updates_data:
            task_id = update.get('task_id')
            if not task_id:
                continue
                
            if task_id not in updates_by_task:
                updates_by_task[task_id] = []
            updates_by_task[task_id].append(update)
        
        # Process each task's updates
        for task_id, task_updates in updates_by_task.items():
            try:
                # Get task document once per task
                task_doc = frappe.get_doc('Task', task_id)
                
                # Apply all updates to this task
                for update in task_updates:
                    field = update.get('field')
                    value = update.get('value')
                    
                    if not field:
                        continue
                    
                    # Handle different field types using modular approach
                    _apply_field_update(task_doc, field, value)
                
                # Save the task document once with all updates
                task_doc.save(ignore_permissions=True)
                success_count += 1
                
            except Exception as e:
                error_msg = f"Task {task_id}: {str(e)}"
                errors.append(error_msg)
                frappe.log_error(f"Batch update error for task {task_id}: {str(e)}")
        
        # Commit the transaction
        frappe.db.commit()
        
        return {
            'success': True,
            'success_count': success_count,
            'error_count': len(errors),
            'errors': errors,
            'total_tasks': len(updates_by_task)
        }
        
    except Exception as e:
        # Rollback on any error
        frappe.db.rollback()
        frappe.log_error(f"Batch update transaction error: {str(e)}")
        return {
            'success': False,
            'error': f'Transaction failed: {str(e)}',
            'success_count': success_count,
            'errors': errors
        }


def _apply_field_update(task_doc, field, value):
    """
    Apply a single field update to a task document
    Uses modular field handlers for clean architecture
    """
    try:
        from smart_accounting.api.field_handlers import get_field_handler
        
        # Get appropriate handler for this field type
        handler = get_field_handler(field)
        
        # Apply the update using the specific handler
        if field in ['custom_action_person', 'custom_preparer', 'custom_reviewer', 'custom_partner']:
            handler(task_doc, field, value)
        else:
            handler(task_doc, value)
            
    except ImportError:
        # Fallback to simple field update if handlers not available
        if hasattr(task_doc, field):
            setattr(task_doc, field, value)
    except Exception as e:
        frappe.log_error(f"Error applying field update {field}={value} to task {task_doc.name}: {str(e)}")
        raise


@frappe.whitelist()
def batch_update_single_field(task_ids, field, value):
    """
    Simplified batch update for updating a single field across multiple tasks
    Optimized for the most common bulk update use case
    
    Args:
        task_ids: JSON string or list of task IDs
        field: Field name to update
        value: New value for the field
    """
    if not task_ids:
        return {'success': False, 'error': 'No task IDs provided'}
    
    # Parse task_ids if string
    if isinstance(task_ids, str):
        try:
            task_ids = json.loads(task_ids)
        except json.JSONDecodeError:
            return {'success': False, 'error': 'Invalid task IDs format'}
    
    # Convert to updates_data format and use main batch function
    updates_data = [{'task_id': task_id, 'field': field, 'value': value} for task_id in task_ids]
    
    return batch_update_tasks(updates_data)
