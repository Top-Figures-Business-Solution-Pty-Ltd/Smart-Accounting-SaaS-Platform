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
    other_erpnext_paths = [
        '/desk', '/api/resource', '/printview', '/report', '/query-report',
        '/dashboard', '/list', '/form', '/tree', '/kanban', '/calendar',
        '/gantt', '/image', '/setup'
    ]
    
    if any(path.startswith(erpnext_path) for erpnext_path in other_erpnext_paths):
        if not is_administrator(current_user):
            redirect_user(PROJECT_MANAGEMENT_PATH)
            frappe.log_error(
                f"Non-administrator access attempt by {current_user} to ERPNext system path {path}",
                "Security Alert - ERPNext Access Denied"
            )
            return True  # Handled
        return True  # Handled (allowed)
    return False  # Not handled

def before_request():
    """
    Smart Accounting Access Control System
    Multi-layer security strategy: Complete isolation of ERPNext system access, only Administrator allowed
    """
    # Early return if frappe.local or request doesn't exist
    if not hasattr(frappe, 'local') or not frappe.local or \
       not hasattr(frappe.local, 'request') or not frappe.local.request:
        return
    
    # Get current request path and user
    path = frappe.local.request.path
    current_user = frappe.session.user
    
    # Early return for static assets and API calls (performance optimization)
    if path.startswith(('/assets/', '/files/', '/private/', '/api/')):
        return
    
    # Check /app access first (most specific)
    if check_app_access(path, current_user):
        return
    
    # Check other ERPNext system paths
    if check_erpnext_system_access(path, current_user):
        return
    
    # Check public paths
    public_paths = (LOGIN_PATH, PROJECT_MANAGEMENT_PATH)
    if path.startswith(public_paths):
        return
    
    # Handle all other disallowed paths
    if frappe.session.user != 'Guest':
        redirect_user(PROJECT_MANAGEMENT_PATH)
    else:
        redirect_user(LOGIN_PATH)

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
