import frappe
from frappe import _

def get_context(context):
    """
    Get context for Smart Accounting login page
    """
    # If user is already logged in, redirect to project management
    if frappe.session.user != 'Guest':
        frappe.local.response['type'] = 'redirect'
        frappe.local.response['location'] = '/project_management'
        return
    
    # Set page context
    context.title = 'Smart Accounting - Login'
    context.show_sidebar = False
    context.show_header = False
    context.full_width = True
    context.hide_footer_signup = True
    context.no_cache = True
    
    # Add any additional context data
    context.app_name = 'Smart Accounting'
    context.app_description = 'Professional Accounting Management System'
    
    return context
