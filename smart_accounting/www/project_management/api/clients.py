# Smart Accounting - Clients API
# 客户相关API模块

import frappe
from frappe import _


@frappe.whitelist()
def get_all_clients():
    """
    Get all clients with statistics for client management system
    """
    try:
        customers = frappe.get_all("Customer",
            fields=[
                "name", "customer_name", "customer_type", "territory", 
                "customer_group", "disabled", "website", "creation", 
                "modified", "customer_primary_contact", "customer_primary_address"
            ],
            order_by="customer_name"
        )
        
        enhanced_customers = []
        for customer in customers:
            project_count = frappe.db.count("Project", {
                "customer": customer.name,
                "status": ["!=", "Cancelled"]
            })
            
            task_count = frappe.db.count("Task", {
                "custom_client": customer.name
            })
            
            active_task_count = frappe.db.count("Task", {
                "custom_client": customer.name,
                "status": ["not in", ["Completed", "Cancelled"]]
            })
            
            client_group = None
            try:
                client_group = frappe.db.get_value("Customer", customer.name, "custom_client_group")
            except:
                pass
            
            enhanced_customer = customer.copy()
            enhanced_customer.update({
                'project_count': project_count,
                'task_count': task_count,
                'active_tasks': active_task_count,
                'client_group': client_group
            })
            
            enhanced_customers.append(enhanced_customer)
        
        return {
            'success': True,
            'clients': enhanced_customers,
            'total_count': len(enhanced_customers)
        }
        
    except Exception as e:
        frappe.log_error(f"Get all clients error: {str(e)}")
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def get_client_details(client_id):
    """
    Get detailed information for a specific client
    """
    try:
        if not client_id:
            return {'success': False, 'error': 'Client ID is required'}
        
        customer = frappe.get_doc("Customer", client_id)
        
        project_count = frappe.db.count("Project", {
            "customer": client_id,
            "status": ["!=", "Cancelled"]
        })
        
        task_count = frappe.db.count("Task", {
            "custom_client": client_id
        })
        
        active_task_count = frappe.db.count("Task", {
            "custom_client": client_id,
            "status": ["not in", ["Completed", "Cancelled"]]
        })
        
        recent_projects = frappe.get_all("Project",
            filters={"customer": client_id, "status": ["!=", "Cancelled"]},
            fields=["name", "project_name", "status", "creation"],
            order_by="creation desc",
            limit=5
        )
        
        recent_tasks = frappe.get_all("Task",
            filters={"custom_client": client_id},
            fields=["name", "subject", "status", "creation", "project"],
            order_by="creation desc",
            limit=10
        )
        
        client_details = {
            'name': customer.name,
            'customer_name': customer.customer_name,
            'customer_type': customer.customer_type,
            'territory': customer.territory,
            'customer_group': customer.customer_group,
            'disabled': customer.disabled,
            'website': customer.website,
            'creation': customer.creation,
            'modified': customer.modified,
            'customer_primary_contact': customer.customer_primary_contact,
            'customer_primary_address': customer.customer_primary_address,
            'project_count': project_count,
            'task_count': task_count,
            'active_tasks': active_task_count,
            'recent_projects': recent_projects,
            'recent_tasks': recent_tasks
        }
        
        # Add custom fields
        for field in ['custom_client_group', 'custom_year_end', 'custom_company', 'custom_entity_type']:
            if hasattr(customer, field):
                client_details[field] = getattr(customer, field)
        
        return {'success': True, 'client': client_details}
        
    except Exception as e:
        frappe.log_error(f"Get client details error: {str(e)}")
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def create_client(customer_name, customer_type="Company", territory=None, customer_group=None, 
                 client_group=None, website=None, disabled=0, custom_year_end="June"):
    """
    Create a new client
    """
    try:
        if not customer_name or not customer_name.strip():
            return {'success': False, 'error': 'Customer name is required'}
        
        customer_name = customer_name.strip()
        
        existing = frappe.db.get_value("Customer", {"customer_name": customer_name})
        if existing:
            return {'success': False, 'error': f'Customer with name "{customer_name}" already exists'}
        
        new_customer = frappe.new_doc("Customer")
        new_customer.customer_name = customer_name
        new_customer.customer_type = customer_type or "Company"
        new_customer.disabled = int(disabled) if disabled else 0
        
        if territory:
            new_customer.territory = territory
        else:
            new_customer.territory = frappe.db.get_single_value("Selling Settings", "territory") or "All Territories"
        
        if customer_group:
            new_customer.customer_group = customer_group
        else:
            new_customer.customer_group = frappe.db.get_single_value("Selling Settings", "customer_group") or "All Customer Groups"
        
        if website:
            new_customer.website = website
        
        # Set custom fields
        if client_group and hasattr(new_customer, 'custom_client_group'):
            new_customer.custom_client_group = client_group
        if custom_year_end and hasattr(new_customer, 'custom_year_end'):
            new_customer.custom_year_end = custom_year_end
        
        new_customer.save()
        
        return {
            'success': True,
            'customer_id': new_customer.name,
            'customer_name': new_customer.customer_name,
            'message': 'Client created successfully'
        }
        
    except Exception as e:
        frappe.log_error(f"Create client error: {str(e)}")
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def update_client(client_id, customer_name=None, customer_type=None, territory=None, 
                 customer_group=None, client_group=None, website=None, disabled=None, custom_year_end=None):
    """
    Update an existing client
    """
    try:
        if not client_id:
            return {'success': False, 'error': 'Client ID is required'}
        
        customer = frappe.get_doc("Customer", client_id)
        
        if customer_name and customer_name.strip():
            existing = frappe.db.get_value("Customer", {
                "customer_name": customer_name.strip(),
                "name": ["!=", client_id]
            })
            if existing:
                return {'success': False, 'error': f'Another customer with name "{customer_name}" already exists'}
            customer.customer_name = customer_name.strip()
        
        if customer_type:
            customer.customer_type = customer_type
        if territory:
            customer.territory = territory
        if customer_group:
            customer.customer_group = customer_group
        if website is not None:
            customer.website = website
        if disabled is not None:
            customer.disabled = int(disabled)
        
        # Update custom fields
        if client_group is not None and hasattr(customer, 'custom_client_group'):
            customer.custom_client_group = client_group
        if custom_year_end is not None and hasattr(customer, 'custom_year_end'):
            customer.custom_year_end = custom_year_end
        
        customer.save()
        
        return {
            'success': True,
            'customer_id': customer.name,
            'customer_name': customer.customer_name,
            'message': 'Client updated successfully'
        }
        
    except Exception as e:
        frappe.log_error(f"Update client error: {str(e)}")
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def delete_client(client_id):
    """
    Delete a client (with safety checks)
    """
    try:
        if not client_id:
            return {'success': False, 'error': 'Client ID is required'}
        
        project_count = frappe.db.count("Project", {
            "customer": client_id,
            "status": ["!=", "Cancelled"]
        })
        
        if project_count > 0:
            return {'success': False, 'error': f'Cannot delete client. {project_count} active projects are associated.'}
        
        task_count = frappe.db.count("Task", {
            "custom_client": client_id,
            "status": ["not in", ["Completed", "Cancelled"]]
        })
        
        if task_count > 0:
            return {'success': False, 'error': f'Cannot delete client. {task_count} active tasks are associated.'}
        
        customer_name = frappe.db.get_value("Customer", client_id, "customer_name")
        frappe.delete_doc("Customer", client_id)
        
        return {'success': True, 'message': f'Client "{customer_name}" deleted successfully'}
        
    except Exception as e:
        frappe.log_error(f"Delete client error: {str(e)}")
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def search_customers(query):
    """Search customers by name"""
    try:
        if not query or len(query) < 2:
            return {'success': True, 'customers': []}
        
        customers = frappe.get_all("Customer",
            filters={"customer_name": ["like", f"%{query}%"]},
            fields=["name", "customer_name", "customer_type"],
            order_by="customer_name",
            limit=20
        )
        
        return {'success': True, 'customers': customers}
    except Exception as e:
        frappe.log_error(f"Search customers error: {str(e)}")
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def quick_create_customer(customer_name, customer_type="Company"):
    """Quick create a customer with minimal info"""
    try:
        if not customer_name:
            return {'success': False, 'error': 'Customer name is required'}
        
        existing = frappe.db.get_value("Customer", {"customer_name": customer_name})
        if existing:
            return {'success': False, 'error': 'Customer already exists', 'customer_id': existing}
        
        new_customer = frappe.new_doc("Customer")
        new_customer.customer_name = customer_name
        new_customer.customer_type = customer_type
        new_customer.territory = frappe.db.get_single_value("Selling Settings", "territory") or "All Territories"
        new_customer.customer_group = frappe.db.get_single_value("Selling Settings", "customer_group") or "All Customer Groups"
        new_customer.save()
        
        return {
            'success': True,
            'customer_id': new_customer.name,
            'customer_name': new_customer.customer_name
        }
    except Exception as e:
        frappe.log_error(f"Quick create customer error: {str(e)}")
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def get_client_groups():
    """Get all client groups"""
    try:
        groups = frappe.get_all("Client Group",
            fields=["name", "group_name", "description"],
            order_by="group_name"
        )
        return {'success': True, 'groups': groups}
    except Exception as e:
        frappe.log_error(f"Get client groups error: {str(e)}")
        return {'success': False, 'error': str(e), 'groups': []}


@frappe.whitelist()
def get_client_contacts(client_id):
    """Get contacts linked to a customer via Dynamic Link"""
    try:
        if not client_id:
            return {'success': False, 'error': 'Client ID is required', 'contacts': []}
        
        customer_name = frappe.db.get_value('Customer', client_id, 'customer_name') or client_id
        
        contacts = frappe.get_all('Contact', 
            filters={'status': 'Open'},
            fields=['name', 'first_name', 'last_name', 'email_id', 'phone', 'mobile_no']
        )
        
        linked_contacts = []
        for contact in contacts:
            contact_links = frappe.get_all('Dynamic Link',
                filters={
                    'parent': contact.name,
                    'parenttype': 'Contact',
                    'link_doctype': 'Customer',
                    'link_name': client_id
                }
            )
            
            if contact_links:
                contact['phone'] = contact.get('mobile_no') or contact.get('phone')
                linked_contacts.append(contact)
        
        return {
            'success': True,
            'client_name': customer_name,
            'contacts': linked_contacts
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting client contacts: {str(e)}")
        return {'success': False, 'error': str(e), 'contacts': []}

