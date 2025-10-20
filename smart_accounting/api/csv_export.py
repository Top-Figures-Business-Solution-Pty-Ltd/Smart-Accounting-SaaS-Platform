# Smart Accounting - CSV Export API
# Handle CSV data export functionality, integrated with ERPNext built-in features

import frappe
from frappe import _
from frappe.utils import now, get_datetime
from frappe.utils.csvutils import build_csv_response
import json
import os
from datetime import datetime

@frappe.whitelist()
def export_board_data(board_view, selected_fields, include_headers=True, export_all_data=True, selected_projects=None):
    """
    Export board data to CSV file using ERPNext built-in functionality
    
    Args:
        board_view (str): Current board view (main, or partition name)
        selected_fields (list): Selected fields list
        include_headers (bool): Whether to include column headers
        export_all_data (bool): Whether to export all data
        selected_projects (list): Selected project IDs
    
    Returns:
        dict: Export result dictionary
    """
    try:
        # Verify user permissions
        if not frappe.has_permission("Task", "read"):
            frappe.throw(_("You don't have permission to export data"), frappe.PermissionError)
        
        # Parse parameters
        if isinstance(selected_fields, str):
            selected_fields = json.loads(selected_fields)
        if isinstance(selected_projects, str):
            selected_projects = json.loads(selected_projects)
        
        # Build task filters
        task_filters = build_task_filters(board_view, selected_projects)
        
        # Get field mapping for database fields
        field_mapping = get_field_mapping()
        
        # Only include non-table fields in the initial query
        # Table fields will be processed later from the full document
        basic_fields = ['name', 'subject', 'project', 'modified', 'priority']  # Essential fields
        
        # Add only non-table fields to the query
        for field in selected_fields:
            if field in field_mapping:
                db_field = field_mapping[field]
                if db_field not in basic_fields and not is_table_field(db_field):
                    basic_fields.append(db_field)
        
        # Get the CSV data
        csv_data = []
        
        # Add headers if requested
        if include_headers:
            headers = []
            field_labels = get_field_labels()
            for field in selected_fields:
                headers.append(field_labels.get(field, field))
            csv_data.append(headers)
        
        # Get tasks data (only basic fields, no table fields)
        tasks = frappe.get_all("Task", fields=basic_fields, filters=task_filters, limit_page_length=None)
        
        if not tasks:
            return {
                'success': False,
                'error': f'No tasks found for board "{board_view}"'
            }
        
        # Process each task
        for task in tasks:
            row = []
            
            # Get full task document for complex field processing
            try:
                task_doc = frappe.get_doc("Task", task.name)
            except:
                task_doc = None
            
            for field in selected_fields:
                value = process_field_value(field, task, task_doc)
                row.append(value)
            
            csv_data.append(row)
        
        # Generate filename
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        board_name = board_view if board_view != 'main' else 'MainDashboard'
        filename = f"SmartAccounting_{board_name}_{timestamp}.csv"
        
        # Create CSV content
        import csv
        from io import StringIO
        
        output = StringIO()
        writer = csv.writer(output)
        for row in csv_data:
            writer.writerow(row)
        
        csv_content = output.getvalue()
        
        # Save file using ERPNext's file system
        file_doc = frappe.get_doc({
            'doctype': 'File',
            'file_name': filename,
            'content': csv_content.encode('utf-8'),
            'is_private': 0,
            'folder': 'Home/Attachments'
        })
        file_doc.save(ignore_permissions=True)
        
        return {
            'success': True,
            'file_url': file_doc.file_url,
            'filename': filename,
            'record_count': len(tasks)
        }
        
    except Exception as e:
        frappe.log_error(f"CSV Export Error: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

def build_task_filters(board_view, selected_projects=None):
    """
    Build task filters for export
    
    Args:
        board_view (str): Board view name
        selected_projects (list): Selected project IDs
    
    Returns:
        dict: Task filters
    """
    task_filters = {
        "custom_is_archived": ["!=", 1],
        "parent_task": ["is", "not set"]
    }
    
    # Get projects for this board
    if board_view != 'main':
        project_filters = {"status": ["!=", "Cancelled"]}
        if frappe.db.exists("Partition", board_view):
            project_filters["custom_partition"] = board_view
        
        projects = frappe.get_all("Project", fields=["name"], filters=project_filters)
        project_ids = [p.name for p in projects]
        
        if project_ids:
            task_filters["project"] = ["in", project_ids]
        else:
            # No projects found, return filter that matches nothing
            task_filters["project"] = ["in", []]
    
    # Filter by selected projects if provided
    if selected_projects and len(selected_projects) > 0:
        if task_filters.get("project"):
            # Intersect with existing project filter
            existing_projects = task_filters["project"][1] if isinstance(task_filters["project"], list) else []
            filtered_projects = [p for p in selected_projects if p in existing_projects]
            task_filters["project"] = ["in", filtered_projects]
        else:
            task_filters["project"] = ["in", selected_projects]
    
    return task_filters

def process_field_value(field, task, task_doc):
    """
    Process field value for export
    
    Args:
        field (str): Field name
        task (dict): Task data from frappe.get_all
        task_doc (Document): Full task document
    
    Returns:
        str: Processed field value
    """
    value = ''
    
    if field == 'client':
        # Handle client field specially
        if task_doc and hasattr(task_doc, 'custom_client') and task_doc.custom_client:
            try:
                client_doc = frappe.get_doc("Customer", task_doc.custom_client)
                value = client_doc.customer_name
            except:
                value = task_doc.custom_client
        elif task.get('project'):
            try:
                project_doc = frappe.get_doc("Project", task.project)
                if project_doc.customer:
                    client_doc = frappe.get_doc("Customer", project_doc.customer)
                    value = client_doc.customer_name
            except:
                pass
    elif field == 'project':
        # Get project name
        if task.get('project'):
            try:
                project_doc = frappe.get_doc("Project", task.project)
                value = project_doc.project_name or project_doc.name
            except:
                value = task.project
    else:
        # Handle other fields dynamically
        field_mapping = get_field_mapping()
        if field in field_mapping:
            db_field = field_mapping[field]
            
            # Check if it's a table field
            if task_doc and is_table_field(db_field):
                value = handle_table_field(task_doc, field, db_field)
            else:
                # Handle regular fields
                if task_doc:
                    value = getattr(task_doc, db_field, '') or task.get(db_field, '')
                else:
                    value = task.get(db_field, '')
            
            # Format special fields
            if field in ['target-month', 'process-date', 'lodgment-due', 'year-end']:
                value = format_date_field(value)
            elif field in ['budget', 'actual']:
                value = format_currency_field(value)
            elif field in ['status']:
                value = format_status_field(value)
    
    return str(value) if value else ''

def is_table_field(db_field):
    """
    Check if a database field is a Table field type
    
    Args:
        db_field (str): Database field name
    
    Returns:
        bool: True if it's a table field
    """
    try:
        task_meta = frappe.get_meta("Task")
        for field_meta in task_meta.fields:
            if field_meta.fieldname == db_field:
                return field_meta.fieldtype == 'Table'
        return False
    except:
        return False

def handle_table_field(task_doc, field, db_field):
    """
    Dynamically handle Table field values for export
    
    Args:
        task_doc: Task document
        field: Frontend field name
        db_field: Database field name
    
    Returns:
        str: Formatted table field value
    """
    try:
        table_data = getattr(task_doc, db_field, [])
        if not table_data:
            return ''
        
        # Get the child doctype meta to understand the table structure
        task_meta = frappe.get_meta("Task")
        table_field_meta = None
        
        for field_meta in task_meta.fields:
            if field_meta.fieldname == db_field and field_meta.fieldtype == 'Table':
                table_field_meta = field_meta
                break
        
        if not table_field_meta or not table_field_meta.options:
            return f'{len(table_data)} items'
        
        # Get child doctype meta
        child_meta = frappe.get_meta(table_field_meta.options)
        child_fields = {f.fieldname: f for f in child_meta.fields}
        
        # Dynamic table field processing based on available fields
        values = []
        
        # Try common field patterns
        common_patterns = ['name', 'title', 'software', 'communication_method', 'company', 'note', 'user', 'role']
        
        for row in table_data:
            row_values = []
            for pattern in common_patterns:
                if pattern in child_fields and hasattr(row, pattern):
                    field_value = getattr(row, pattern, '')
                    if field_value:
                        row_values.append(str(field_value))
            
            if row_values:
                values.append(' | '.join(row_values))
        
        return '; '.join(values) if values else f'{len(table_data)} items'
        
    except Exception as e:
        frappe.log_error(f"Error handling table field {field}: {str(e)}")
        return ''

def get_field_mapping():
    """
    Dynamically get mapping from frontend fields to database fields
    This function discovers fields automatically to avoid hardcoding
    
    Returns:
        dict: Field mapping dictionary
    """
    try:
        # Get Task doctype meta
        task_meta = frappe.get_meta("Task")
        
        # Build dynamic field mapping
        field_mapping = {}
        
        # Standard ERPNext fields
        standard_fields = {
            'task-name': 'subject',
            'last-updated': 'modified',
            'priority': 'priority',
            'project': 'project'
        }
        field_mapping.update(standard_fields)
        
        # Discover custom fields dynamically
        custom_field_patterns = {
            'client': ['custom_client'],
            'entity': ['custom_service_line', 'custom_entity', 'custom_entity_type'],
            'tf-tg': ['custom_tftg', 'custom_tf_tg'],
            'software': ['custom_softwares', 'custom_software'],
            'communication-methods': ['custom_communication_methods'],
            'client-contact': ['custom_companies', 'custom_client_contacts', 'custom_contacts'],
            'status': ['custom_task_status', 'custom_status'],
            'note': ['custom_note', 'custom_notes'],
            'target-month': ['custom_target_month'],
            'budget': ['custom_budget_planning', 'custom_budget'],
            'actual': ['custom_actual_billing', 'custom_actual'],
            'review-note': ['custom_review_notes'],
            'action-person': ['custom_roles', 'custom_action_person'],
            'preparer': ['custom_roles', 'custom_preparer'],
            'reviewer': ['custom_roles', 'custom_reviewer'],
            'partner': ['custom_roles', 'custom_partner'],
            'process-date': ['custom_process_date'],
            'lodgment-due': ['custom_lodgement_due_date', 'custom_lodgement_due', 'custom_due_date'],
            'engagement': ['custom_engagement'],
            'group': ['custom_companies', 'custom_client_group', 'custom_group'],
            'year-end': ['custom_year_end'],
            'frequency': ['custom_frequency'],
            'reset-date': ['custom_reset_date']
        }
        
        # Get all available fields in Task doctype
        available_fields = {field.fieldname: field for field in task_meta.fields}
        
        # Map frontend fields to actual database fields
        for frontend_field, possible_db_fields in custom_field_patterns.items():
            for db_field in possible_db_fields:
                if db_field in available_fields:
                    field_mapping[frontend_field] = db_field
                    break
        
        return field_mapping
        
    except Exception as e:
        frappe.log_error(f"Error building dynamic field mapping: {str(e)}")
        # Fallback to basic mapping if dynamic discovery fails
        return {
            'task-name': 'subject',
            'project': 'project',
            'last-updated': 'modified',
            'priority': 'priority'
        }

def get_field_labels():
    """
    Dynamically get field display labels from Task doctype
    
    Returns:
        dict: Field label mapping
    """
    try:
        # Get field mapping first
        field_mapping = get_field_mapping()
        
        # Get Task doctype meta
        task_meta = frappe.get_meta("Task")
        available_fields = {field.fieldname: field for field in task_meta.fields}
        
        # Build dynamic labels
        field_labels = {}
        
        # Default labels for standard fields
        default_labels = {
            'client': 'Client Name',
            'task-name': 'Task Name',
            'project': 'Project Name',
            'entity': 'Entity',
            'tf-tg': 'TF/TG',
            'software': 'Software',
            'communication-methods': 'Communication Methods',
            'client-contact': 'Client Contact',
            'status': 'Status',
            'note': 'Note',
            'target-month': 'Target Month',
            'budget': 'Budget',
            'actual': 'Actual',
            'review-note': 'Review Note',
            'action-person': 'Action Person',
            'preparer': 'Preparer',
            'reviewer': 'Reviewer',
            'partner': 'Partner',
            'process-date': 'Process Date',
            'lodgment-due': 'Lodgement Due',
            'engagement': 'Engagement',
            'group': 'Group',
            'year-end': 'Year End',
            'last-updated': 'Last Updated',
            'priority': 'Priority',
            'frequency': 'Frequency',
            'reset-date': 'Reset Date'
        }
        
        # For each mapped field, try to get the actual label from doctype
        for frontend_field, db_field in field_mapping.items():
            if db_field in available_fields:
                # Use the actual field label from doctype
                field_obj = available_fields[db_field]
                if field_obj.label:
                    field_labels[frontend_field] = field_obj.label
                else:
                    # Fallback to default label
                    field_labels[frontend_field] = default_labels.get(frontend_field, frontend_field.replace('-', ' ').title())
            else:
                # Use default label
                field_labels[frontend_field] = default_labels.get(frontend_field, frontend_field.replace('-', ' ').title())
        
        # Add any missing default labels
        for field, label in default_labels.items():
            if field not in field_labels:
                field_labels[field] = label
        
        return field_labels
        
    except Exception as e:
        frappe.log_error(f"Error building dynamic field labels: {str(e)}")
        # Fallback to basic labels
        return {
            'task-name': 'Task Name',
            'project': 'Project Name',
            'client': 'Client Name',
            'status': 'Status'
        }

def format_date_field(value):
    """Format date field"""
    if not value:
        return ''
    
    try:
        if isinstance(value, str):
            # Try to parse date string
            date_obj = get_datetime(value)
            return date_obj.strftime('%d-%m-%Y')
        elif hasattr(value, 'strftime'):
            return value.strftime('%d-%m-%Y')
        else:
            return str(value)
    except:
        return str(value) if value else ''

def format_currency_field(value):
    """Format currency field"""
    if not value:
        return '0.00'
    
    try:
        return f"{float(value):.2f}"
    except:
        return str(value) if value else '0.00'

def format_status_field(value):
    """Format status field"""
    if not value:
        return ''
    
    # Status mapping (if needed)
    status_mapping = {
        'Open': 'Open',
        'Working': 'In Progress',
        'Pending Review': 'Pending Review',
        'Overdue': 'Overdue',
        'Completed': 'Completed',
        'Cancelled': 'Cancelled'
    }
    
    return status_mapping.get(value, value)

@frappe.whitelist()
def get_board_projects(board_view):
    """
    Get projects for a specific board
    
    Args:
        board_view (str): Board view name
    
    Returns:
        dict: Projects data
    """
    try:
        # Verify user permissions
        if not frappe.has_permission("Project", "read"):
            frappe.throw(_("You don't have permission to read projects"), frappe.PermissionError)
        
        # Build project filters
        project_filters = {"status": ["!=", "Cancelled"]}
        
        # Add partition filter if not main view
        if board_view != 'main':
            if frappe.db.exists("Partition", board_view):
                project_filters["custom_partition"] = board_view
            else:
                return {
                    'success': True,
                    'projects': []
                }
        
        # Get projects
        projects = frappe.get_all(
            "Project",
            fields=["name", "project_name", "customer"],
            filters=project_filters,
            order_by="project_name"
        )
        
        # Process project data
        processed_projects = []
        for project in projects:
            # Get task count for this project
            task_count = frappe.db.count("Task", {
                "project": project.name,
                "custom_is_archived": ["!=", 1],
                "parent_task": ["is", "not set"]
            })
            
            # Get client name
            client_name = "No Client"
            if project.customer:
                try:
                    client_doc = frappe.get_doc("Customer", project.customer)
                    client_name = client_doc.customer_name
                except:
                    client_name = project.customer
            
            processed_projects.append({
                'id': project.name,
                'name': project.project_name or project.name,
                'client': client_name,
                'task_count': task_count
            })
        
        return {
            'success': True,
            'projects': processed_projects
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting board projects: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist()
def get_export_field_options(board_view):
    """
    Get available field options for export
    
    Args:
        board_view (str): Board view name
    
    Returns:
        dict: Available fields dictionary
    """
    try:
        # Get dynamic field mapping and labels
        field_mapping = get_field_mapping()
        field_labels = get_field_labels()
        
        # Filter fields based on board view if needed
        if board_view != 'main':
            # Can add board-specific field filtering here
            pass
        
        return {
            'success': True,
            'fields': field_labels
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting export field options: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }