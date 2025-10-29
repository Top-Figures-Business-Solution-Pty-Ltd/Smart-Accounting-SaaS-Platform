import frappe
from frappe import _
import json
from datetime import datetime

def get_context(context):
    """
    Get context for Management Dashboard page
    """
    # Disable caching for real-time updates
    frappe.response["Cache-Control"] = "no-cache, no-store, must-revalidate"
    frappe.response["Pragma"] = "no-cache"
    frappe.response["Expires"] = "0"
    
    # Check if user is logged in
    if frappe.session.user == 'Guest':
        frappe.throw("Please login to access this page", frappe.PermissionError)
    
    # Set page context
    context.title = 'Management Dashboard'
    context.show_sidebar = False
    context.show_header = True
    context.full_width = True
    context.hide_footer_signup = True
    context.no_cache = True
    context.cache_key = f"mgmt_dashboard_{frappe.utils.now()}"
    
    # Get dashboard data
    context.dashboard_data = get_dashboard_data()
    
    # Add user role information
    try:
        current_user = frappe.session.user
        user_roles = frappe.get_roles() if current_user != 'Guest' else []
        context.user_roles = user_roles
        context.is_administrator = current_user == 'Administrator'
        context.is_system_manager = 'System Manager' in user_roles
        context.can_access_management = context.is_administrator or context.is_system_manager
    except (AttributeError, frappe.AuthenticationError) as e:
        frappe.log_error(f"Error getting user roles in management dashboard: {str(e)}")
        context.user_roles = []
        context.can_access_management = False

def get_dashboard_data():
    """
    Get aggregated data for dashboard overview
    """
    try:
        # Get client statistics
        client_stats = get_client_statistics()
        
        # Get contact statistics  
        contact_stats = get_contact_statistics()
        
        # Get engagement statistics
        engagement_stats = get_engagement_statistics()
        
        # Get recent activity
        recent_activity = get_recent_activity()
        
        return {
            'client_stats': client_stats,
            'contact_stats': contact_stats,
            'engagement_stats': engagement_stats,
            'recent_activity': recent_activity,
            'last_updated': frappe.utils.now()
        }
    except Exception as e:
        frappe.log_error(f"Error getting dashboard data: {str(e)}")
        return {
            'client_stats': {'total': 0, 'new_this_month': 0},
            'contact_stats': {'total': 0, 'by_role': {}},
            'engagement_stats': {'total': 0, 'active': 0},
            'recent_activity': [],
            'last_updated': frappe.utils.now()
        }

def get_client_statistics():
    """
    Get client-related statistics
    """
    try:
        # Total customers
        total_customers = frappe.db.count('Customer')
        
        # New customers this month
        current_month_start = frappe.utils.get_first_day(frappe.utils.nowdate())
        new_this_month = frappe.db.count('Customer', {
            'creation': ['>=', current_month_start]
        })
        
        # Total companies
        total_companies = frappe.db.count('Company')
        
        # Total referral persons
        total_referrals = frappe.db.count('Referral Person')
        
        return {
            'total_customers': total_customers,
            'new_this_month': new_this_month,
            'total_companies': total_companies,
            'total_referrals': total_referrals
        }
    except Exception as e:
        frappe.log_error(f"Error getting client statistics: {str(e)}")
        return {
            'total_customers': 0,
            'new_this_month': 0,
            'total_companies': 0,
            'total_referrals': 0
        }

def get_contact_statistics():
    """
    Get contact-related statistics
    """
    try:
        # Total contacts
        total_contacts = frappe.db.count('Contact')
        
        # Contacts by role (if custom field exists)
        contacts_by_role = {}
        try:
            role_data = frappe.db.sql("""
                SELECT custom_contact_role, COUNT(*) as count
                FROM `tabContact`
                WHERE custom_contact_role IS NOT NULL AND custom_contact_role != ''
                GROUP BY custom_contact_role
            """, as_dict=True)
            
            for row in role_data:
                contacts_by_role[row.custom_contact_role] = row.count
        except:
            # Field might not exist yet
            pass
        
        return {
            'total': total_contacts,
            'by_role': contacts_by_role
        }
    except Exception as e:
        frappe.log_error(f"Error getting contact statistics: {str(e)}")
        return {
            'total': 0,
            'by_role': {}
        }

def get_engagement_statistics():
    """
    Get engagement-related statistics
    """
    try:
        # Total engagements (if doctype exists)
        total_engagements = 0
        active_engagements = 0
        
        try:
            total_engagements = frappe.db.count('Engagement')
            # Count active engagements (you can define what "active" means)
            active_engagements = frappe.db.count('Engagement', {
                'docstatus': 1  # Submitted engagements
            })
        except:
            # Engagement doctype might not exist yet
            pass
        
        return {
            'total': total_engagements,
            'active': active_engagements
        }
    except Exception as e:
        frappe.log_error(f"Error getting engagement statistics: {str(e)}")
        return {
            'total': 0,
            'active': 0
        }

def get_recent_activity():
    """
    Get recent activity across all management areas
    """
    try:
        activities = []
        
        # Recent customers
        recent_customers = frappe.db.sql("""
            SELECT name, customer_name, creation
            FROM `tabCustomer`
            ORDER BY creation DESC
            LIMIT 5
        """, as_dict=True)
        
        for customer in recent_customers:
            activities.append({
                'type': 'customer',
                'title': f"New customer: {customer.customer_name}",
                'timestamp': customer.creation,
                'icon': 'fa-user-plus'
            })
        
        # Recent contacts
        recent_contacts = frappe.db.sql("""
            SELECT name, first_name, last_name, creation
            FROM `tabContact`
            ORDER BY creation DESC
            LIMIT 5
        """, as_dict=True)
        
        for contact in recent_contacts:
            full_name = f"{contact.first_name or ''} {contact.last_name or ''}".strip()
            activities.append({
                'type': 'contact',
                'title': f"New contact: {full_name}",
                'timestamp': contact.creation,
                'icon': 'fa-address-book'
            })
        
        # Sort by timestamp and return top 10
        activities.sort(key=lambda x: x['timestamp'], reverse=True)
        return activities[:10]
        
    except Exception as e:
        frappe.log_error(f"Error getting recent activity: {str(e)}")
        return []

@frappe.whitelist()
def get_dashboard_stats():
    """
    API endpoint to get dashboard statistics
    """
    return get_dashboard_data()
