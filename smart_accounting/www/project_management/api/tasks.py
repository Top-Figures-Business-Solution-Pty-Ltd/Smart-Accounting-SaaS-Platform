# Smart Accounting - Tasks API
# Task核心操作API模块，提供Task的CRUD操作

import frappe
from frappe import _
from datetime import datetime


@frappe.whitelist()
def update_task_status(task_id, new_status):
    """
    Update task status from the project management interface
    """
    try:
        task = frappe.get_doc("Task", task_id)
        task.flags.ignore_version = True
        task.custom_task_status = new_status
        task.save()
        
        # Force commit and clear cache
        frappe.db.commit()
        frappe.clear_cache()
        
        return {'success': True, 'message': 'Task status updated successfully'}
    
    except Exception as e:
        frappe.log_error(f"Task status update error: {str(e)}")
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def update_task_field(task_id, field_name, new_value):
    """
    Update any task field from the project management interface
    """
    try:
        # Get fresh document and ignore version conflicts
        task = frappe.get_doc("Task", task_id)
        task.flags.ignore_version = True
        
        # Validate field name (security check)
        allowed_fields = [
            'custom_tftg', 'custom_tf_tg', 'custom_target_month',
            'custom_budget_planning', 'custom_actual_billing', 'custom_year_end', 'custom_task_status',
            'custom_service_line', 'custom_client', 'custom_process_date', 'custom_lodgement_due_date', 'subject',
            'custom_engagement', 'custom_roles', 'custom_due_date', 'description', 'custom_note',
            'custom_frequency', 'custom_reset_date', 'priority', 'status'
        ]
        
        if field_name not in allowed_fields:
            return {'success': False, 'error': 'Field not allowed for editing'}
        
        # Convert value based on field type
        new_value = _convert_field_value(field_name, new_value)
        if isinstance(new_value, dict) and not new_value.get('success', True):
            return new_value  # Return error dict
        
        # Update the field using set_value to avoid full document validation
        frappe.db.set_value("Task", task_id, field_name, new_value)
        
        # Force commit to database immediately
        frappe.db.commit()
        
        # Clear caches to ensure fresh data
        frappe.clear_cache()
        
        return {'success': True, 'message': 'Field updated successfully', 'new_value': new_value}
    
    except Exception as e:
        error_msg = f"Task field update error: {str(e)}"
        frappe.log_error(error_msg)
        return {'success': False, 'error': str(e)}


def _convert_field_value(field_name, new_value):
    """
    Convert field value based on field type
    """
    if field_name in ['custom_budget_planning', 'custom_actual_billing']:
        try:
            return float(new_value) if new_value else 0
        except ValueError:
            return {'success': False, 'error': 'Invalid number format'}
    
    elif field_name == 'custom_year_end':
        valid_months = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December']
        if new_value and new_value not in valid_months:
            return {'success': False, 'error': f'Year End must be a valid month. Invalid value: {new_value}'}
    
    elif field_name in ['custom_process_date', 'custom_lodgment_due_date', 'custom_lodgement_due_date', 'custom_due_date', 'custom_reset_date']:
        if new_value and new_value.strip():
            return _parse_date_value(new_value)
    
    elif field_name in ['custom_tftg', 'custom_tf_tg']:
        return _resolve_company_value(new_value)
    
    return new_value


def _parse_date_value(date_str):
    """
    Parse and validate date value, convert to YYYY-MM-DD format
    """
    try:
        if len(date_str) == 10 and date_str.count('-') == 2:
            parts = date_str.split('-')
            
            # Check if it's already YYYY-MM-DD format
            if len(parts[0]) == 4:
                datetime.strptime(date_str, '%Y-%m-%d')
                return date_str
            # Check if it's DD-MM-YYYY format
            elif len(parts[2]) == 4:
                datetime.strptime(date_str, '%d-%m-%Y')
                return f"{parts[2]}-{parts[1]}-{parts[0]}"
        
        return {'success': False, 'error': 'Date must be in DD-MM-YYYY or YYYY-MM-DD format.'}
    except ValueError:
        return {'success': False, 'error': 'Invalid date format. Please use DD-MM-YYYY or YYYY-MM-DD.'}


def _resolve_company_value(value):
    """
    Resolve company name to company ID
    """
    if value in ['Top Figures', 'Top Grants']:
        try:
            if frappe.db.exists("Company", value):
                return value
            
            company_list = frappe.get_all("Company", 
                filters={"company_name": ["like", f"%{value}%"]}, 
                fields=["name"],
                limit=1
            )
            if company_list:
                return company_list[0].name
        except:
            pass
    
    return value


@frappe.whitelist()
def update_task_client(task_id, customer_id):
    """
    Update task client/customer
    """
    try:
        frappe.db.set_value("Task", task_id, "custom_client", customer_id)
        frappe.db.commit()
        
        # Get customer name for response
        customer_name = ""
        if customer_id:
            customer_name = frappe.db.get_value("Customer", customer_id, "customer_name") or customer_id
        
        return {
            'success': True,
            'message': 'Client updated successfully',
            'customer_id': customer_id,
            'customer_name': customer_name
        }
    except Exception as e:
        frappe.log_error(f"Error updating task client: {str(e)}")
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def create_subtask(parent_task_id, subtask_name=None):
    """Create a new subtask under a parent task"""
    try:
        parent_task = frappe.get_doc("Task", parent_task_id)
        
        new_task = frappe.new_doc("Task")
        if subtask_name and subtask_name.strip():
            new_task.subject = subtask_name.strip()
        else:
            new_task.subject = f"Subtask of {parent_task.subject}"
        
        new_task.project = parent_task.project
        new_task.parent_task = parent_task_id
        new_task.custom_task_status = "Not Started"
        new_task.priority = parent_task.priority or "Medium"
        
        # Inherit custom fields from parent
        custom_fields = [
            'custom_client', 'custom_tftg', 'custom_target_month', 
            'custom_budget_planning', 'custom_actual_billing',
            'custom_action_person', 'custom_preparer', 'custom_reviewer', 'custom_partner',
            'custom_engagement', 'custom_partition'
        ]
        
        for field in custom_fields:
            if hasattr(parent_task, field):
                setattr(new_task, field, getattr(parent_task, field))
        
        new_task.insert()
        
        return {
            'success': True,
            'task_id': new_task.name,
            'task_subject': new_task.subject,
            'parent_task_id': parent_task_id
        }
        
    except Exception as e:
        frappe.log_error(f"Error creating subtask: {str(e)}")
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def get_subtasks(parent_task_id):
    """Get all subtasks for a parent task"""
    try:
        subtasks = frappe.get_all("Task",
            filters={
                "parent_task": parent_task_id, 
                "custom_is_archived": ["!=", 1]
            },
            fields=["name", "subject", "custom_task_status", "priority", "creation", "modified", 
                   "custom_due_date", "description", "custom_note"],
            order_by="creation asc"
        )
        
        # Enrich subtasks with role assignments
        for subtask in subtasks:
            subtask.status = subtask.custom_task_status or 'Not Started'
            subtask.note = subtask.custom_note or ''
            
            # Get role assignments
            role_assignments = frappe.get_all("Task Role Assignment",
                filters={"parent": subtask.name},
                fields=["role", "user", "is_primary"],
                order_by="is_primary desc"
            )
            
            subtask.action_person_info = _get_role_user_info(role_assignments, 'Action Person')
            subtask.preparer_info = _get_role_user_info(role_assignments, 'Preparer')
            subtask.reviewer_info = _get_role_user_info(role_assignments, 'Reviewer')
            subtask.partner_info = _get_role_user_info(role_assignments, 'Partner')
        
        return {
            'success': True,
            'subtasks': subtasks
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting subtasks: {str(e)}")
        return {'success': False, 'error': str(e), 'subtasks': []}


def _get_role_user_info(role_assignments, role_name):
    """Get user info for a specific role from role assignments"""
    from ..services.formatters import get_initials
    
    users = []
    for ra in role_assignments:
        if ra.role == role_name:
            user_info = {
                'email': ra.user,
                'full_name': ra.user,
                'initials': get_initials(ra.user),
                'is_primary': ra.is_primary
            }
            
            # Try to get full name from User
            try:
                full_name = frappe.db.get_value("User", ra.user, "full_name")
                if full_name:
                    user_info['full_name'] = full_name
                    user_info['initials'] = get_initials(full_name)
            except:
                pass
            
            users.append(user_info)
    
    return users if users else None


@frappe.whitelist()
def get_task_status_options():
    """
    Get available status options for Task doctype from custom_task_status field
    """
    try:
        # Get Task doctype meta to fetch custom_task_status field options
        task_meta = frappe.get_meta("Task")
        status_field = None
        
        for field in task_meta.fields:
            if field.fieldname == "custom_task_status":
                status_field = field
                break
        
        if status_field and hasattr(status_field, 'options') and status_field.options:
            # Split options by newline and clean them
            options = [opt.strip() for opt in status_field.options.split('\n') if opt.strip()]
            return {'success': True, 'status_options': options}
        else:
            # Fallback: Get existing values from database as options
            try:
                existing_statuses = frappe.db.sql("""
                    SELECT DISTINCT custom_task_status 
                    FROM `tabTask` 
                    WHERE custom_task_status IS NOT NULL 
                    AND custom_task_status != ''
                    ORDER BY custom_task_status
                """, as_list=True)
                
                if existing_statuses:
                    options = [status[0] for status in existing_statuses]
                    return {'success': True, 'status_options': options}
                else:
                    # Ultimate fallback if no data exists
                    return {'success': True, 'status_options': [
                        'Not Started', 'Done', 'Working on it', 'Stuck',
                        'Ready for Manager Review', 'Ready for Partner Review',
                        'Review Points to be Actioned', 'Ready To Lodge',
                        'Lodged', 'Ready For Manage'
                    ]}
            except Exception as fallback_error:
                frappe.log_error(f"Error getting existing status values: {str(fallback_error)}")
                return {'success': True, 'status_options': ['Not Started', 'Done', 'Working on it', 'Stuck']}
                
    except Exception as e:
        frappe.log_error(f"Error getting task status options: {str(e)}")
        return {'success': True, 'status_options': ['Not Started', 'Done', 'Working on it', 'Stuck']}


@frappe.whitelist()
def archive_task(task_id):
    """Archive a task"""
    try:
        frappe.db.set_value("Task", task_id, "custom_is_archived", 1)
        frappe.db.commit()
        return {'success': True, 'message': 'Task archived successfully'}
    except Exception as e:
        frappe.log_error(f"Error archiving task: {str(e)}")
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def unarchive_task(task_id):
    """Unarchive a task"""
    try:
        frappe.db.set_value("Task", task_id, "custom_is_archived", 0)
        frappe.db.commit()
        return {'success': True, 'message': 'Task unarchived successfully'}
    except Exception as e:
        frappe.log_error(f"Error unarchiving task: {str(e)}")
        return {'success': False, 'error': str(e)}

