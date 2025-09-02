import frappe
from frappe import _
from collections import defaultdict
import re

def get_context(context):
    """
    Get context for project management page
    """
    # Check if user is logged in
    if frappe.session.user == 'Guest':
        frappe.throw(_("Please login to access this page"), frappe.PermissionError)
    
    # Set page context
    context.title = _("Project Management")
    context.show_sidebar = False
    context.show_header = True
    
    # Get project management data
    context.project_data = get_project_management_data()
    
    return context

def get_project_management_data():
    """
    Get all projects and tasks organized by client
    Based on user's data structure: Company → Client → Project → Task
    """
    try:
        # First, let's get basic project data using frappe.get_all (simpler and safer)
        projects = frappe.get_all("Project", 
            fields=["name", "project_name", "customer", "status", "expected_end_date", "priority"],
            filters={"status": ["!=", "Cancelled"]},
            order_by="customer, expected_end_date"
        )
        
        # Get basic task data first, then try to get custom fields
        tasks = frappe.get_all("Task",
            fields=["name", "subject", "status", "priority", "exp_end_date", "project", "description", "modified", "company"],
            filters={"status": ["!=", "Cancelled"]},
            order_by="exp_end_date"
        )
        
        # Enrich tasks with project and client information
        for task in tasks:
            task.task_id = task.name
            task.task_name = task.subject
            
            # Get project information
            if task.project:
                try:
                    project_doc = frappe.get_doc("Project", task.project)
                    task.project_name = project_doc.project_name
                    task.client_name = project_doc.customer
                    
                    # Get client document for more details if needed
                    if project_doc.customer:
                        try:
                            client_doc = frappe.get_doc("Customer", project_doc.customer)
                            task.client_name = client_doc.customer_name
                        except:
                            task.client_name = project_doc.customer
                    else:
                        task.client_name = "No Client"
                        
                except Exception as e:
                    task.project_name = task.project
                    task.client_name = "Unknown Client"
            else:
                task.project_name = "No Project"
                task.client_name = "Unassigned"
            
            # Try to get custom fields from the task document
            try:
                task_doc = frappe.get_doc("Task", task.name)
                
                # Get client information - Priority: custom_client > project.customer > "No Client"
                task_custom_client = getattr(task_doc, 'custom_client', None)
                if task_custom_client:
                    try:
                        client_doc = frappe.get_doc("Customer", task_custom_client)
                        task.client_name = client_doc.customer_name
                        # Get entity type from customer
                        task.entity_type = getattr(client_doc, 'custom_entity_type', None) or "Company"
                    except:
                        task.client_name = task_custom_client
                        task.entity_type = "Company"
                elif task.project and hasattr(task, 'project'):
                    # Keep existing project customer logic as backup
                    # Also try to get entity from project customer
                    if hasattr(task, 'client_name') and task.client_name and task.client_name != "Unknown Client":
                        try:
                            # Get entity from project customer
                            project_doc = frappe.get_doc("Project", task.project)
                            if project_doc.customer:
                                client_doc = frappe.get_doc("Customer", project_doc.customer)
                                task.entity_type = getattr(client_doc, 'custom_entity_type', None) or "Company"
                            else:
                                task.entity_type = "Company"
                        except:
                            task.entity_type = "Company"
                    else:
                        task.entity_type = "Company"
                else:
                    task.client_name = "No Client"
                    task.entity_type = "Company"
                
                # Get other custom fields - using correct field names from fixtures
                task.tf_tg = getattr(task_doc, 'custom_tftg', None) or getattr(task_doc, 'custom_tf_tg', None) or "TF"
                task.service_line = getattr(task_doc, 'custom_service_line', None) or "BAS"
                task.software = getattr(task_doc, 'custom_software', None) or "Xero"
                task.year_end = getattr(task_doc, 'custom_year_end', None) or ""
                task.target_month = getattr(task_doc, 'custom_target_month', None) or ""
                task.partner = getattr(task_doc, 'custom_partner', None) or ""
                task.reviewer = getattr(task_doc, 'custom_reviewer', None) or ""
                task.preparer = getattr(task_doc, 'custom_praparer', None) or getattr(task_doc, 'custom_preparer', None) or ""
                task.lodgment_due_date = getattr(task_doc, 'custom_lodgement_due_date', None) or getattr(task_doc, 'custom_lodgment_due_date', None) or ""
                
                # Get action person (assigned_to field)
                task.action_person = getattr(task_doc, 'assigned_to', None) or ""
                
                # Get Budget and Actual Billing (newly added fields)
                task.budget_planning = getattr(task_doc, 'custom_budget_planning', None) or 0
                task.actual_billing = getattr(task_doc, 'custom_actual_billing', None) or 0
                
                # Try to get Review Notes (child table)
                try:
                    review_notes = frappe.get_all("Review Note", 
                        filters={"parent": task.name, "parenttype": "Task"},
                        fields=["note", "creation", "owner"],
                        order_by="creation desc"
                    )
                    task.review_notes = review_notes
                    task.latest_review_note = review_notes[0].note if review_notes else ""
                except:
                    task.review_notes = []
                    task.latest_review_note = ""
                
                # Convert email addresses to user info for avatar display
                task.preparer_info = get_user_info(task.preparer)
                task.reviewer_info = get_user_info(task.reviewer)
                task.partner_info = get_user_info(task.partner)
                task.action_person_info = get_user_info(task.action_person)
                
                # Format last updated date
                if hasattr(task, 'modified') and task.modified:
                    task.last_updated = task.modified.strftime("%Y-%m-%d") if hasattr(task.modified, 'strftime') else str(task.modified)
                else:
                    task.last_updated = ""
                    
            except:
                # If custom fields don't exist, use default values
                task.tf_tg = "TF"
                task.service_line = "BAS"
                task.software = "Xero"
                task.year_end = ""
                task.target_month = ""
                task.partner = ""
                task.reviewer = ""
                task.preparer = ""
                task.lodgment_due_date = ""
                task.action_person = ""
                task.last_updated = ""
                task.entity_type = "Company"  # Default entity type
                task.budget_planning = 0
                task.actual_billing = 0
                task.review_notes = []
                task.latest_review_note = ""
                # Set empty user info for avatars
                task.preparer_info = None
                task.reviewer_info = None
                task.partner_info = None
                task.action_person_info = None
            
            # Set assignees to None for now (we'll add this later if needed)
            task.assignees = None
        
        # Create a dictionary to store project-task relationships
        organized_data = {}
        
        # Build a map of project ID to project info
        project_map = {}
        for project in projects:
            project_map[project.name] = {
                'client': project.customer or "Unassigned",
                'project_name': project.project_name or project.name,
                'tasks': []
            }
        
        # Add tasks to their projects
        for task in tasks:
            project_id = task.project
            if project_id and project_id in project_map:
                project_map[project_id]['tasks'].append(task)
        
        # Now organize by client
        for project_id, project_info in project_map.items():
            client = project_info['client']
            project_name = project_info['project_name']
            
            if client not in organized_data:
                organized_data[client] = {}
            
            organized_data[client][project_name] = project_info['tasks']
        
        # Debug information
        debug_info = {
            'total_projects_found': len(projects),
            'total_tasks_found': len(tasks),
            'projects_list': [p.project_name for p in projects],
            'tasks_list': [t.subject for t in tasks]
        }
        
        return {
            'organized_data': dict(organized_data),
            'total_projects': len(projects),
            'total_tasks': len(tasks),
            'debug_info': debug_info
        }
    
    except Exception as e:
        frappe.log_error(f"Project management data error: {str(e)}")
        return {
            'organized_data': {},
            'total_projects': 0,
            'total_tasks': 0,
            'error': str(e),
            'debug_info': {'error_details': str(e)}
        }

@frappe.whitelist()
def update_task_status(task_id, new_status):
    """
    Update task status from the project management interface
    """
    try:
        task = frappe.get_doc("Task", task_id)
        task.status = new_status
        task.save()
        
        return {'success': True, 'message': _('Task status updated successfully')}
    
    except Exception as e:
        frappe.log_error(f"Task status update error: {str(e)}")
        return {'success': False, 'error': str(e)}

def get_user_info(email_or_user):
    """
    Convert email address or user to user info for avatar display
    """
    if not email_or_user:
        return None
    
    try:
        # Handle multiple emails separated by comma
        emails = [email.strip() for email in str(email_or_user).split(',')]
        user_infos = []
        
        for email in emails:
            if not email:
                continue
                
            # Try to get user by email
            user_info = {'email': email, 'initials': '', 'full_name': ''}
            
            try:
                # Check if it's already a user ID or email
                if '@' in email:
                    user_doc = frappe.get_doc("User", email)
                else:
                    # Try to find user by email
                    user_list = frappe.get_all("User", filters={"email": email}, fields=["name", "full_name", "user_image"])
                    if user_list:
                        user_doc = frappe.get_doc("User", user_list[0].name)
                    else:
                        # If not found, treat as name
                        user_info['full_name'] = email
                        user_info['initials'] = get_initials(email)
                        user_infos.append(user_info)
                        continue
                
                user_info['full_name'] = user_doc.full_name or user_doc.name
                user_info['initials'] = get_initials(user_info['full_name'])
                user_info['image'] = getattr(user_doc, 'user_image', None)
                
            except:
                # If user not found, generate initials from email/name
                user_info['full_name'] = email
                user_info['initials'] = get_initials(email)
            
            user_infos.append(user_info)
        
        return user_infos
    
    except Exception as e:
        # If anything fails, return basic info
        return [{'email': str(email_or_user), 'initials': get_initials(str(email_or_user)), 'full_name': str(email_or_user)}]

def get_initials(name):
    """
    Generate initials from name or email
    """
    if not name:
        return "?"
    
    # Remove email domain if it's an email
    if '@' in name:
        name = name.split('@')[0]
    
    # Split by common separators and take first letter of each part
    parts = re.split(r'[.\s_-]+', name)
    initials = ''.join([part[0].upper() for part in parts if part])
    
    # Limit to 2 characters
    return initials[:2] if initials else "?"
