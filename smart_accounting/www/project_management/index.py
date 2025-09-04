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
        frappe.throw("Please login to access this page", frappe.PermissionError)
    
    # Set page context
    context.title = "Project Management"
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
        # Clear any existing caches to ensure fresh data
        frappe.clear_cache()
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
                print(f"DEBUG: Task {task.name} - custom_client field value: {task_custom_client}")
                
                if task_custom_client:
                    try:
                        client_doc = frappe.get_doc("Customer", task_custom_client)
                        task.client_name = client_doc.customer_name
                        task.custom_client = task_custom_client  # Store the ID for frontend
                        # Get entity type from customer
                        task.entity_type = getattr(client_doc, 'custom_entity_type', None) or getattr(client_doc, 'customer_type', None) or "Company"
                        print(f"DEBUG: Successfully loaded client: {task.client_name} (ID: {task_custom_client})")
                    except Exception as e:
                        print(f"DEBUG: Error loading custom_client {task_custom_client}: {str(e)}")
                        task.client_name = task_custom_client
                        task.entity_type = "Company"
                elif task.project:
                    # Try to get customer from project
                    try:
                        project_doc = frappe.get_doc("Project", task.project)
                        if project_doc.customer:
                            client_doc = frappe.get_doc("Customer", project_doc.customer)
                            task.client_name = client_doc.customer_name
                            task.entity_type = getattr(client_doc, 'custom_entity_type', None) or getattr(client_doc, 'customer_type', None) or "Company"
                        else:
                            task.client_name = "No Client"
                            task.entity_type = "Company"
                    except Exception as e:
                        print(f"DEBUG: Error loading project customer: {str(e)}")
                        task.client_name = "No Client"
                        task.entity_type = "Company"
                else:
                    task.client_name = "No Client"
                    task.entity_type = "Company"
                
                # Get other custom fields - using correct field names from fixtures
                tftg_company = getattr(task_doc, 'custom_tftg', None) or getattr(task_doc, 'custom_tf_tg', None)
                # Convert company ID/name to display abbreviation
                if tftg_company:
                    try:
                        # If it's a company ID, get the company name
                        if frappe.db.exists("Company", tftg_company):
                            company_doc = frappe.get_doc("Company", tftg_company)
                            company_name = company_doc.company_name
                        else:
                            company_name = tftg_company
                        
                        # Convert to display abbreviation
                        if 'Top Figures' in company_name:
                            task.tf_tg = 'TF'
                        elif 'Top Grants' in company_name:
                            task.tf_tg = 'TG'
                        else:
                            task.tf_tg = company_name[:2].upper() if company_name else 'TF'  # Fallback: first 2 letters
                    except Exception as e:
                        print(f"DEBUG: TF/TG conversion error: {str(e)}, tftg_company: {tftg_company}")
                        task.tf_tg = 'TF'
                else:
                    task.tf_tg = 'TF'
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
        task = frappe.get_doc("Task", task_id)
        
        # Validate field name (security check)
        allowed_fields = [
            'custom_tftg', 'custom_tf_tg', 'custom_software', 'custom_target_month',
            'custom_budget_planning', 'custom_actual_billing', 'custom_preparer',
            'custom_reviewer', 'custom_partner', 'custom_year_end', 'status'
        ]
        
        if field_name not in allowed_fields:
            return {'success': False, 'error': 'Field not allowed for editing'}
        
        # Convert value based on field type
        if field_name in ['custom_budget_planning', 'custom_actual_billing']:
            try:
                new_value = float(new_value) if new_value else 0
            except ValueError:
                return {'success': False, 'error': 'Invalid number format'}
        elif field_name in ['custom_tftg', 'custom_tf_tg']:
            # For TF/TG field, try to find the company
            print(f"DEBUG: Trying to save TF/TG value: {new_value}")
            
            if new_value in ['Top Figures', 'Top Grants']:
                try:
                    # First try exact match
                    if frappe.db.exists("Company", new_value):
                        new_value = new_value  # Use as is
                    else:
                        # Try to find by company_name
                        company_list = frappe.get_all("Company", 
                            filters={"company_name": ["like", f"%{new_value}%"]}, 
                            fields=["name", "company_name"],
                            limit=1
                        )
                        if company_list:
                            new_value = company_list[0].name
                            print(f"DEBUG: Found company: {new_value}")
                        else:
                            print(f"DEBUG: Company not found, will use value as-is: {new_value}")
                except Exception as e:
                    print(f"DEBUG: Company lookup error: {str(e)}")
                    # If lookup fails, just use the value as-is
                    pass
        
        # Update the field
        setattr(task, field_name, new_value)
        task.save()
        
        # Force commit to database immediately
        frappe.db.commit()
        
        # Clear caches to ensure fresh data
        frappe.clear_cache()
        
        return {'success': True, 'message': 'Field updated successfully', 'new_value': new_value}
    
    except Exception as e:
        error_msg = f"Task field update error: {str(e)}"
        frappe.log_error(error_msg)
        print(f"DEBUG: {error_msg}")  # Console debugging
        print(f"DEBUG: task_id={task_id}, field_name={field_name}, new_value={new_value}")
        return {'success': False, 'error': str(e)}

@frappe.whitelist()
def create_new_task(project_name, client_name=None):
    """
    Create a new task in the specified project
    """
    try:
        # Find the project with all necessary fields
        project_list = frappe.get_all("Project", 
            filters={"project_name": project_name}, 
            fields=["name", "customer", "custom_service_line"],
            limit=1
        )
        
        if not project_list:
            return {'success': False, 'error': f'Project {project_name} not found'}
        
        project_id = project_list[0].name
        project_customer = project_list[0].customer
        project_service_line = project_list[0].custom_service_line
        
        # Generate auto task subject
        existing_tasks = frappe.get_all("Task", 
            filters={"project": project_id},
            fields=["name"],
            order_by="creation desc"
        )
        
        task_sequence = len(existing_tasks) + 1
        auto_subject = f"Task {task_sequence:03d} - {project_name}"
        
        # Create new task with minimal required fields
        new_task = frappe.new_doc("Task")
        new_task.subject = auto_subject
        new_task.project = project_id
        new_task.status = "Open"
        new_task.priority = "Medium"
        
        # Set default custom fields based on project/client
        if project_customer:
            new_task.custom_client = project_customer
        
        # Inherit Service Line from Project (safe inheritance)
        if project_service_line:
            new_task.custom_service_line = project_service_line
        
        # Set default TF/TG based on client or project
        if client_name and 'Top Figures' in client_name:
            # Find Top Figures company
            tf_companies = frappe.get_all("Company", 
                filters={"company_name": ["like", "%Top Figures%"]}, 
                fields=["name"],
                limit=1
            )
            if tf_companies:
                new_task.custom_tftg = tf_companies[0].name
        elif client_name and 'Top Grants' in client_name:
            # Find Top Grants company  
            tg_companies = frappe.get_all("Company",
                filters={"company_name": ["like", "%Top Grants%"]},
                fields=["name"],
                limit=1
            )
            if tg_companies:
                new_task.custom_tftg = tg_companies[0].name
        
        # Set other defaults
        new_task.custom_software = "Xero"
        new_task.custom_target_month = ""
        new_task.custom_budget_planning = 0
        new_task.custom_actual_billing = 0
        
        # Save the task
        new_task.save()
        
        return {
            'success': True, 
            'message': 'New task created successfully',
            'task_id': new_task.name,
            'task_subject': new_task.subject
        }
    
    except Exception as e:
        error_msg = f"Create task error: {str(e)}"
        frappe.log_error(error_msg)
        print(f"DEBUG: {error_msg}")
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

@frappe.whitelist()
def get_companies_for_tftg():
    """
    Get all companies that contain 'Top' in name for TF/TG selection
    """
    try:
        companies = frappe.get_all("Company",
            filters={"company_name": ["like", "%Top%"]},
            fields=["name", "company_name", "abbr"],
            order_by="company_name"
        )
        
        # Create display mapping
        company_options = []
        for company in companies:
            if 'Figures' in company.company_name:
                display_name = 'TF'
            elif 'Grants' in company.company_name:
                display_name = 'TG'
            else:
                display_name = company.abbr or company.company_name[:2]
            
            company_options.append({
                'id': company.name,
                'name': company.company_name,
                'display': display_name
            })
        
        return {'success': True, 'companies': company_options}
    
    except Exception as e:
        frappe.log_error(f"Company lookup error: {str(e)}")
        return {'success': False, 'error': str(e)}

@frappe.whitelist()
def search_customers(query):
    """
    Search existing customers by name
    """
    try:
        if not query or len(query.strip()) < 2:
            return {'success': True, 'customers': []}
        
        # Search customers by customer_name
        customers = frappe.get_all("Customer",
            filters={
                "customer_name": ["like", f"%{query}%"],
                "disabled": 0
            },
            fields=["name", "customer_name", "customer_type"],
            limit=10,
            order_by="customer_name"
        )
        
        return {
            'success': True, 
            'customers': customers,
            'query': query
        }
    
    except Exception as e:
        frappe.log_error(f"Customer search error: {str(e)}")
        return {'success': False, 'error': str(e)}

@frappe.whitelist()
def quick_create_customer(customer_name, customer_type="Company"):
    """
    Quickly create a new customer
    """
    try:
        # Check if customer already exists
        existing = frappe.db.get_value("Customer", {"customer_name": customer_name})
        if existing:
            return {
                'success': True, 
                'customer_id': existing,
                'customer_name': customer_name,
                'message': 'Customer already exists'
            }
        
        # Create new customer
        new_customer = frappe.new_doc("Customer")
        new_customer.customer_name = customer_name
        new_customer.customer_type = customer_type
        
        # Set minimal required fields
        new_customer.customer_group = frappe.db.get_single_value("Selling Settings", "customer_group") or "All Customer Groups"
        new_customer.territory = frappe.db.get_single_value("Selling Settings", "territory") or "All Territories"
        
        new_customer.save()
        
        return {
            'success': True, 
            'customer_id': new_customer.name,
            'customer_name': new_customer.customer_name,
            'customer_type': new_customer.customer_type,
            'message': 'New customer created successfully'
        }
    
    except Exception as e:
        error_msg = f"Customer creation error: {str(e)}"
        frappe.log_error(error_msg)
        return {'success': False, 'error': str(e)}

@frappe.whitelist()
def update_task_software(task_id, software_value):
    """
    Update task software and optionally sync to customer
    """
    try:
        task = frappe.get_doc("Task", task_id)
        
        # Update task software directly
        task.custom_software = software_value
        task.save()
        
        # Force commit and clear cache
        frappe.db.commit()
        frappe.clear_cache()
        
        # Sync to customer's accounting platform if task has a client
        customer_updated = False
        if hasattr(task, 'custom_client') and task.custom_client:
            try:
                customer = frappe.get_doc("Customer", task.custom_client)
                old_platform = customer.custom_accounting_platform
                
                # Update customer's platform
                customer.custom_accounting_platform = software_value
                customer.save()
                customer_updated = True
                
                print(f"DEBUG: Updated customer {customer.customer_name} accounting platform: {old_platform} → {software_value}")
            except Exception as e:
                # Don't fail the task update if customer update fails
                print(f"DEBUG: Could not update customer software: {str(e)}")
        
        # Prepare success message
        message = 'Software updated successfully'
        if customer_updated:
            message += ' (Customer accounting platform also updated)'
        
        return {
            'success': True, 
            'message': message,
            'software_value': software_value,
            'customer_synced': customer_updated
        }
    
    except Exception as e:
        error_msg = f"Software update error: {str(e)}"
        frappe.log_error(error_msg)
        return {'success': False, 'error': str(e)}

@frappe.whitelist()
def update_task_client(task_id, customer_id):
    """
    Update task's client association
    """
    try:
        task = frappe.get_doc("Task", task_id)
        
        # Get customer info
        customer = frappe.get_doc("Customer", customer_id)
        
        # Update task
        task.custom_client = customer_id
        task.save()
        
        return {
            'success': True, 
            'message': 'Task client updated successfully',
            'customer_name': customer.customer_name,
            'customer_type': customer.customer_type
        }
    
    except Exception as e:
        error_msg = f"Task client update error: {str(e)}"
        frappe.log_error(error_msg)
        return {'success': False, 'error': str(e)}

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
