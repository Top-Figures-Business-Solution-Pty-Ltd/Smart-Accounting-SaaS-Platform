"""
Smart Accounting - Field Handlers for Batch Operations
Modular field update handlers for different field types
"""

import frappe
from frappe import _


def handle_status_field(task_doc, value):
    """Handle status field updates"""
    task_doc.status = value


def handle_person_field(task_doc, field, email):
    """Handle person/role field updates with proper role system integration"""
    try:
        # Map field to role type
        role_map = {
            'custom_action_person': 'action_person',
            'custom_preparer': 'preparer',
            'custom_reviewer': 'reviewer',
            'custom_partner': 'partner'
        }
        role_type = role_map.get(field, field.replace('custom_', ''))
        
        # Remove existing assignments for this role
        frappe.db.delete('Task Role Assignment', {
            'parent': task_doc.name,
            'role': role_type
        })
        
        # Add new assignment if email provided
        if email:
            role_assignment = frappe.get_doc({
                'doctype': 'Task Role Assignment',
                'parent': task_doc.name,
                'parenttype': 'Task',
                'parentfield': 'custom_role_assignments',
                'role': role_type,
                'user': email,
                'is_primary': 1
            })
            role_assignment.insert(ignore_permissions=True)
            
            # Update legacy field for backward compatibility
            setattr(task_doc, field, email)
        else:
            # Clear legacy field
            setattr(task_doc, field, None)
            
    except Exception as e:
        frappe.log_error(f"Error updating role {field} for task {task_doc.name}: {str(e)}")
        raise


def handle_software_field(task_doc, softwares_data):
    """Handle software field updates with proper software system integration"""
    try:
        # Clear existing software assignments
        frappe.db.delete('Task Software', {'parent': task_doc.name})
        
        # Add new software assignments
        if softwares_data and isinstance(softwares_data, list):
            for software_item in softwares_data:
                software_assignment = frappe.get_doc({
                    'doctype': 'Task Software',
                    'parent': task_doc.name,
                    'parenttype': 'Task',
                    'parentfield': 'custom_software_assignments',
                    'software': software_item.get('software'),
                    'is_primary': software_item.get('is_primary', 0)
                })
                software_assignment.insert(ignore_permissions=True)
                
    except Exception as e:
        frappe.log_error(f"Error updating software for task {task_doc.name}: {str(e)}")
        raise


def handle_date_field(task_doc, field, value):
    """Handle date field updates with proper validation"""
    try:
        # Validate date format if needed
        if value and isinstance(value, str):
            # Basic date validation - can be enhanced
            if len(value) == 10 and value.count('-') == 2:
                setattr(task_doc, field, value)
            else:
                raise ValueError(f"Invalid date format: {value}")
        else:
            setattr(task_doc, field, value)
            
    except Exception as e:
        frappe.log_error(f"Error updating date field {field} for task {task_doc.name}: {str(e)}")
        raise


def handle_currency_field(task_doc, field, value):
    """Handle currency field updates with proper validation"""
    try:
        # Convert to float if string
        if isinstance(value, str) and value.strip():
            try:
                value = float(value.replace(',', ''))
            except ValueError:
                raise ValueError(f"Invalid currency value: {value}")
        
        setattr(task_doc, field, value)
        
    except Exception as e:
        frappe.log_error(f"Error updating currency field {field} for task {task_doc.name}: {str(e)}")
        raise


def handle_standard_field(task_doc, field, value):
    """Handle standard field updates"""
    try:
        # Check if field exists on the document
        if hasattr(task_doc, field):
            setattr(task_doc, field, value)
        else:
            frappe.log_error(f"Field {field} does not exist on Task document")
            raise ValueError(f"Field {field} does not exist")
            
    except Exception as e:
        frappe.log_error(f"Error updating standard field {field} for task {task_doc.name}: {str(e)}")
        raise


# Field type mapping for extensibility
FIELD_HANDLERS = {
    'status': handle_status_field,
    'person': handle_person_field,
    'software': handle_software_field,
    'date': handle_date_field,
    'currency': handle_currency_field,
    'standard': handle_standard_field
}


def get_field_handler(field):
    """
    Get appropriate field handler based on field name
    Returns the handler function for the field type
    """
    # Person fields
    if field in ['custom_action_person', 'custom_preparer', 'custom_reviewer', 'custom_partner']:
        return FIELD_HANDLERS['person']
    
    # Software fields
    elif field == 'custom_softwares':
        return FIELD_HANDLERS['software']
    
    # Status field
    elif field == 'status':
        return FIELD_HANDLERS['status']
    
    # Date fields
    elif 'date' in field.lower() or field in ['custom_lodgement_due_date', 'custom_reset_date']:
        return FIELD_HANDLERS['date']
    
    # Currency fields
    elif 'budget' in field or 'billing' in field or 'amount' in field:
        return FIELD_HANDLERS['currency']
    
    # Default to standard field handler
    else:
        return FIELD_HANDLERS['standard']
