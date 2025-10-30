import frappe
from frappe import _
import json
from datetime import datetime

def get_context(context):
    """
    Get context for Client Management page
    """
    # Disable caching for real-time updates
    frappe.response["Cache-Control"] = "no-cache, no-store, must-revalidate"
    frappe.response["Pragma"] = "no-cache"
    frappe.response["Expires"] = "0"
    
    # Check if user is logged in
    if frappe.session.user == 'Guest':
        frappe.throw("Please login to access this page", frappe.PermissionError)
    
    # Set page context
    context.title = 'Client Management'
    context.show_sidebar = False
    context.show_header = True
    context.full_width = True
    context.hide_footer_signup = True
    context.no_cache = True
    context.cache_key = f"client_mgmt_{frappe.utils.now()}"
    
    # Add user role information
    try:
        current_user = frappe.session.user
        user_roles = frappe.get_roles() if current_user != 'Guest' else []
        context.user_roles = user_roles
        context.is_administrator = current_user == 'Administrator'
        context.is_system_manager = 'System Manager' in user_roles
        context.can_access_management = context.is_administrator or context.is_system_manager
    except (AttributeError, frappe.AuthenticationError) as e:
        frappe.log_error(f"Error getting user roles in client management: {str(e)}")
        context.user_roles = []
        context.can_access_management = False

@frappe.whitelist()
def get_clients(search_term="", filters=None, limit=50, offset=0):
    """
    Get clients with search and filtering - Using ERPNext standard methods
    """
    try:
        # Convert string parameters to proper types
        limit = int(limit) if limit else 50
        offset = int(offset) if offset else 0
        
        # Build filters dict for ERPNext get_list method
        filter_dict = {}
        or_filters = []
        
        # Parse filters
        if filters:
            if isinstance(filters, str):
                filters = json.loads(filters)
            
            if filters.get('company'):
                filter_dict['custom_company'] = filters['company']
            
            if filters.get('referred_by'):
                filter_dict['custom_referred_by'] = filters['referred_by']
        
        # Add search functionality
        if search_term:
            or_filters = [
                ['customer_name', 'like', f'%{search_term}%'],
                ['name', 'like', f'%{search_term}%']
            ]
        
        # Use ERPNext's standard get_list method for better compatibility
        clients = frappe.get_list(
            'Customer',
            fields=[
                'name', 'customer_name', 'custom_company', 'custom_referred_by', 
                'custom_entity_type', 'creation', 'modified'
            ],
            filters=filter_dict,
            or_filters=or_filters if or_filters else None,
            order_by='customer_name asc',
            limit_start=offset,
            limit_page_length=limit
        )
        
        # Get total count using ERPNext's count method
        if or_filters:
            # For search queries, we need to use get_list to count properly
            all_clients = frappe.get_list(
                'Customer',
                fields=['name'],
                filters=filter_dict,
                or_filters=or_filters
            )
            total_count = len(all_clients)
        else:
            # For simple filters, use standard count method
            total_count = frappe.db.count('Customer', filters=filter_dict)
        
        # Enhance client data with counts and additional info
        for client in clients:
            # Get contact count and names using the same method as project management
            try:
                # Get all active contacts first
                all_contacts = frappe.get_all('Contact', 
                    filters={'status': 'Open'},
                    fields=['name', 'first_name', 'last_name', 'email_id']
                )
                
                # Filter contacts that are linked to this customer
                linked_contacts = []
                for contact in all_contacts:
                    # Check if this contact is linked to the customer
                    contact_links = frappe.get_all('Dynamic Link',
                        filters={
                            'parent': contact.name,
                            'parenttype': 'Contact',
                            'link_doctype': 'Customer',
                            'link_name': client['name']
                        }
                    )
                    
                    if contact_links:
                        full_name = f"{contact.first_name or ''} {contact.last_name or ''}".strip()
                        if full_name:
                            linked_contacts.append(full_name)
                
                client['contact_count'] = len(linked_contacts)
                
                # Show max 3 contact names
                if linked_contacts:
                    display_names = linked_contacts[:3]
                    if len(linked_contacts) > 3:
                        display_names.append(f"... +{len(linked_contacts) - 3} more")
                    client['contact_names'] = ', '.join(display_names)
                else:
                    client['contact_names'] = None
                    
            except Exception as e:
                frappe.log_error(f"Error getting contacts for client {client['name']}: {str(e)}")
                client['contact_count'] = 0
                client['contact_names'] = None
            
            # Get task count
            try:
                client['task_count'] = frappe.db.count('Task', {'custom_client': client['name']})
            except:
                client['task_count'] = 0
            
            # Format dates
            client['creation_formatted'] = frappe.utils.pretty_date(client['creation'])
            client['modified_formatted'] = frappe.utils.pretty_date(client['modified'])
            
            # Get company name if exists
            if client['custom_company']:
                try:
                    company_doc = frappe.get_doc('Company', client['custom_company'])
                    client['company_name'] = company_doc.company_name
                except:
                    client['company_name'] = client['custom_company']
            else:
                client['company_name'] = None
            
            # Get referral person name if exists
            if client['custom_referred_by']:
                try:
                    referral_doc = frappe.get_doc('Referral Person', client['custom_referred_by'])
                    client['referral_name'] = referral_doc.referral_person_name
                except:
                    client['referral_name'] = client['custom_referred_by']
            else:
                client['referral_name'] = None
        
        return {
            'success': True,
            'clients': clients,
            'total_count': total_count,
            'has_more': (offset + limit) < total_count
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting clients: {str(e)}")
        return {
            'success': False,
            'error': str(e),
            'clients': [],
            'total_count': 0
        }

@frappe.whitelist()
def get_business_contacts(search_term="", client_filter="", limit=50, offset=0):
    """
    Get business contacts (excluding system users) - Using ERPNext standard methods
    """
    try:
        # Convert string parameters to proper types
        limit = int(limit) if limit else 50
        offset = int(offset) if offset else 0
        
        # Get all contacts first, then filter programmatically for better reliability
        filter_dict = {}
        or_filters = []
        
        # Add search functionality
        if search_term:
            or_filters = [
                ['first_name', 'like', f'%{search_term}%'],
                ['last_name', 'like', f'%{search_term}%'],
                ['email_id', 'like', f'%{search_term}%']
            ]
        
        # Use the same method as project management to get contacts
        # Get all active contacts first
        all_contacts = frappe.get_all('Contact', 
            filters={'status': 'Open'},
            fields=['name', 'first_name', 'last_name', 'email_id', 'phone', 'custom_contact_role', 'creation', 'modified']
        )
        
        # Filter contacts that are linked to customers (same logic as project management)
        business_contacts = []
        for contact in all_contacts:
            try:
                # Check if this contact is linked to any customer
                contact_links = frappe.get_all('Dynamic Link',
                    filters={
                        'parent': contact.name,
                        'parenttype': 'Contact',
                        'link_doctype': 'Customer'
                    },
                    fields=['link_name']
                )
                
                # Only include contacts that are linked to customers
                if contact_links:
                    # Get the first customer link (contacts can be linked to multiple customers)
                    client_id = contact_links[0]['link_name']
                    
                    # Apply client filter if specified
                    if client_filter and client_id != client_filter:
                        continue
                    
                    # Apply search filter
                    if search_term:
                        full_name = f"{contact.first_name or ''} {contact.last_name or ''}".strip()
                        search_text = f"{full_name} {contact.email_id or ''}".lower()
                        if search_term.lower() not in search_text:
                            continue
                    
                    # Get client name safely
                    try:
                        client_doc = frappe.get_doc('Customer', client_id)
                        contact['client_name'] = client_doc.customer_name
                    except:
                        contact['client_name'] = client_id
                    
                    contact['client_id'] = client_id
                    
                    # Check if this contact is a system user
                    is_system_user = frappe.db.exists('User', {'email': contact.get('email_id')}) if contact.get('email_id') else False
                    contact['is_system_user'] = is_system_user
                    
                    business_contacts.append(contact)
                    
            except Exception as e:
                frappe.log_error(f"Error processing contact {contact.name}: {str(e)}")
                continue
        
        # Apply pagination
        total_count = len(business_contacts)
        paginated_contacts = business_contacts[offset:offset + limit]
        
        # Format data
        for contact in paginated_contacts:
            contact['full_name'] = f"{contact['first_name'] or ''} {contact['last_name'] or ''}".strip()
            contact['creation_formatted'] = frappe.utils.pretty_date(contact['creation'])
            contact['modified_formatted'] = frappe.utils.pretty_date(contact['modified'])
        
        return {
            'success': True,
            'contacts': paginated_contacts,
            'total_count': total_count,
            'has_more': (offset + limit) < total_count
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting business contacts: {str(e)}")
        return {
            'success': False,
            'error': str(e),
            'contacts': [],
            'total_count': 0
        }

@frappe.whitelist()
def get_companies(search_term="", limit=50, offset=0):
    """
    Get companies with client counts - Using ERPNext standard methods
    """
    try:
        # Convert string parameters to proper types
        limit = int(limit) if limit else 50
        offset = int(offset) if offset else 0
        
        # Build filters for ERPNext get_list method
        filter_dict = {}
        or_filters = []
        
        # Add search functionality
        if search_term:
            or_filters = [
                ['company_name', 'like', f'%{search_term}%'],
                ['domain', 'like', f'%{search_term}%']
            ]
        
        # Use ERPNext's standard get_list method
        companies = frappe.get_list(
            'Company',
            fields=['name', 'company_name', 'domain', 'creation', 'modified'],
            filters=filter_dict,
            or_filters=or_filters if or_filters else None,
            order_by='modified desc',
            limit_start=offset,
            limit_page_length=limit
        )
        
        # Get total count
        if or_filters:
            # For search queries, use get_list to count properly
            all_companies = frappe.get_list(
                'Company',
                fields=['name'],
                filters=filter_dict,
                or_filters=or_filters
            )
            total_count = len(all_companies)
        else:
            # For simple filters, use standard count method
            total_count = frappe.db.count('Company', filters=filter_dict)
        
        # Add client counts for each company
        for company in companies:
            try:
                company['client_count'] = frappe.db.count('Customer', {'custom_company': company['name']})
            except:
                company['client_count'] = 0
            
            # Format dates
            company['creation_formatted'] = frappe.utils.pretty_date(company['creation'])
            company['modified_formatted'] = frappe.utils.pretty_date(company['modified'])
        
        return {
            'success': True,
            'companies': companies,
            'total_count': total_count,
            'has_more': (offset + limit) < total_count
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting companies: {str(e)}")
        return {
            'success': False,
            'error': str(e),
            'companies': [],
            'total_count': 0
        }

@frappe.whitelist()
def get_client_details(client_id):
    """
    Get detailed information for a specific client
    """
    try:
        # Get client basic info
        client = frappe.get_doc('Customer', client_id)
        
        # Get associated contacts using ERPNext standard method
        contact_links = frappe.get_list(
            'Dynamic Link',
            filters={
                'link_doctype': 'Customer',
                'link_name': client_id,
                'parenttype': 'Contact'
            },
            fields=['parent']
        )
        
        contacts = []
        for link in contact_links:
            try:
                contact_doc = frappe.get_doc('Contact', link['parent'])
                contacts.append({
                    'name': contact_doc.name,
                    'first_name': contact_doc.first_name,
                    'last_name': contact_doc.last_name,
                    'email_id': contact_doc.email_id,
                    'phone': contact_doc.phone,
                    'custom_contact_role': contact_doc.get('custom_contact_role')
                })
            except:
                continue
        
        # Get associated tasks using ERPNext standard method (changed from projects to tasks)
        tasks = frappe.get_list(
            'Task',
            filters={'custom_client': client_id},
            fields=['name', 'subject', 'status', 'creation', 'modified'],
            order_by='modified desc'
        )
        
        # Format data
        for contact in contacts:
            contact['full_name'] = f"{contact['first_name'] or ''} {contact['last_name'] or ''}".strip()
        
        for task in tasks:
            task['creation_formatted'] = frappe.utils.pretty_date(task['creation'])
            task['modified_formatted'] = frappe.utils.pretty_date(task['modified'])
        
        return {
            'success': True,
            'client': client.as_dict(),
            'contacts': contacts,
            'projects': tasks  # Keep the key name for frontend compatibility
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting client details: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist()
def get_filter_options():
    """
    Get options for filters (companies, referral persons, etc.)
    """
    try:
        # Get companies
        companies = frappe.db.sql("""
            SELECT name, company_name
            FROM `tabCompany`
            ORDER BY company_name
        """, as_dict=True)
        
        # Get referral persons
        referrals = frappe.db.sql("""
            SELECT name, referral_person_name
            FROM `tabReferral Person`
            ORDER BY referral_person_name
        """, as_dict=True)
        
        return {
            'success': True,
            'companies': companies,
            'referrals': referrals
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting filter options: {str(e)}")
        return {
            'success': False,
            'error': str(e),
            'companies': [],
            'referrals': []
        }

@frappe.whitelist()
def update_client(client_id, data):
    """
    Update client information using ERPNext API
    """
    try:
        # Parse the data
        if isinstance(data, str):
            data = json.loads(data)
        
        # Get the client document
        client_doc = frappe.get_doc('Customer', client_id)
        
        # Update fields
        for field, value in data.items():
            if hasattr(client_doc, field):
                setattr(client_doc, field, value)
        
        # Save the document
        client_doc.save()
        
        return {
            'success': True,
            'message': 'Client updated successfully'
        }
        
    except Exception as e:
        frappe.log_error(f"Error updating client {client_id}: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }
