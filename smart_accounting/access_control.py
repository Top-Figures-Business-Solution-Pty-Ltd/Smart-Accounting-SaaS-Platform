import frappe
from frappe import _

# Constants for access control
ADMINISTRATOR_ROLE = 'Administrator'
PROJECT_MANAGEMENT_PATH = '/project_management'
LOGIN_PATH = '/login'
APP_PATH = '/app'

def handle_access_error(error_msg, error_title="Access Control Error"):
    """
    Unified error handling for access control
    """
    frappe.log_error(error_msg, error_title)
    return {
        'success': False,
        'error': 'Access control error occurred'
    }

def redirect_user(location):
    """
    Redirect user to specified location
    """
    frappe.local.response['type'] = 'redirect'
    frappe.local.response['location'] = location

def is_administrator(user):
    """
    Check if user is Administrator
    """
    return user == ADMINISTRATOR_ROLE

def check_app_access(path, current_user):
    """
    Check access to /app path specifically
    """
    if path.startswith(APP_PATH):
        if not is_administrator(current_user):
            redirect_user(PROJECT_MANAGEMENT_PATH)
            return True  # Handled
        return True  # Handled (allowed)
    return False  # Not handled

def check_erpnext_system_access(path, current_user):
    """
    Check access to other ERPNext system paths
    """
    # ERPNext system paths that require administrator access
    restricted_erpnext_paths = [
        '/desk', '/printview', '/report', '/query-report',
        '/dashboard', '/list', '/form', '/tree', '/kanban', '/calendar',
        '/gantt', '/image', '/setup'
    ]
    
    # ERPNext API paths that require administrator access
    restricted_api_paths = [
        '/api/resource', 
        '/api/method/erpnext.',
        '/api/method/frappe.desk.',
        '/api/method/frappe.core.doctype.',
        '/api/method/frappe.email.',
        '/api/method/frappe.utils.print_format.'
    ]
    
    # Check restricted paths
    if any(path.startswith(erpnext_path) for erpnext_path in restricted_erpnext_paths):
        if not is_administrator(current_user):
            redirect_user(PROJECT_MANAGEMENT_PATH)
            frappe.log_error(
                f"Non-administrator access attempt by {current_user} to ERPNext system path {path}",
                "Security Alert - ERPNext Access Denied"
            )
            return True  # Handled
        return True  # Handled (allowed)
    
    # Check restricted API paths
    if any(path.startswith(api_path) for api_path in restricted_api_paths):
        if not is_administrator(current_user):
            redirect_user(PROJECT_MANAGEMENT_PATH)
            frappe.log_error(
                f"Non-administrator API access attempt by {current_user} to {path}",
                "Security Alert - ERPNext API Access Denied"
            )
            return True  # Handled
        return True  # Handled (allowed)
    
    return False  # Not handled

def before_request():
    """
    Smart Accounting Access Control System
    Simple strategy: Only restrict specific ERPNext UI pages, allow everything else
    """
    
    # Early return if frappe.local or request doesn't exist
    if not hasattr(frappe, 'local') or not frappe.local or \
       not hasattr(frappe.local, 'request') or not frappe.local.request:
        return
    
    # Get current request path and user
    path = frappe.local.request.path
    current_user = frappe.session.user
    
    # Early return for static assets, API calls, and private files
    if path.startswith(('/assets/', '/files/', '/private/', '/api/')):
        return
    
    # Allow public paths (login and project management)
    public_paths = (LOGIN_PATH, PROJECT_MANAGEMENT_PATH)
    if path.startswith(public_paths):
        return
    
    # Only restrict specific ERPNext UI pages for non-administrators
    restricted_ui_paths = [
        '/app',
        '/desk', 
        '/list', 
        '/form', 
        '/tree', 
        '/kanban', 
        '/calendar',
        '/gantt', 
        '/dashboard', 
        '/report', 
        '/query-report',
        '/printview', 
        '/setup'
    ]
    
    # Check if current path is restricted and user is not administrator
    if any(path.startswith(ui_path) for ui_path in restricted_ui_paths):
        if not is_administrator(current_user):
            redirect_user(PROJECT_MANAGEMENT_PATH)
            frappe.log_error(
                f"Non-administrator UI access attempt by {current_user} to {path}",
                "Security Alert - ERPNext UI Access Denied"
            )
            return
    
    # Allow all other paths (including all API calls)

@frappe.whitelist()
def check_erpnext_access():
    """
    Check if current user can access ERPNext system pages
    """
    try:
        current_user = frappe.session.user
        can_access = current_user == ADMINISTRATOR_ROLE
        
        return {
            'success': True,
            'user': current_user,
            'can_access_erpnext': can_access,
            'access_level': 'Administrator' if can_access else 'Standard User',
            'message': 'Access granted to ERPNext system' if can_access else 'Access restricted to Smart Accounting only'
        }
    except (AttributeError, frappe.AuthenticationError) as e:
        return handle_access_error(f"Error checking ERPNext access: {str(e)}", "ERPNext Access Check Error")
