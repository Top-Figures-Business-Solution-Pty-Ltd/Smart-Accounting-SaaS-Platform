# Smart Accounting - Roles API
# 角色相关API模块，提供Task角色分配管理

import frappe
from frappe import _


@frappe.whitelist()
def get_task_roles(task_id):
    """Get all role assignments for a task"""
    try:
        roles = frappe.get_all("Task Role Assignment",
            filters={"parent": task_id},
            fields=["name", "role", "user", "is_primary"],
            order_by="role, is_primary desc"
        )
        
        # Enrich with user info
        for role in roles:
            role['user_info'] = get_user_display_info(role.user)
        
        return {'success': True, 'roles': roles}
    except Exception as e:
        frappe.log_error(f"Error getting task roles: {str(e)}")
        return {'success': False, 'error': str(e), 'roles': []}


@frappe.whitelist()
def update_task_roles(task_id, role, users):
    """
    Update role assignments for a task
    users: list of user emails with is_primary flag
    """
    try:
        import json
        if isinstance(users, str):
            users = json.loads(users)
        
        task_doc = frappe.get_doc("Task", task_id)
        
        # Remove existing assignments for this role
        if hasattr(task_doc, 'custom_roles'):
            task_doc.custom_roles = [r for r in task_doc.custom_roles if r.role != role]
        
        # Add new assignments
        for user_data in users:
            task_doc.append('custom_roles', {
                'role': role,
                'user': user_data.get('user'),
                'is_primary': user_data.get('is_primary', False)
            })
        
        task_doc.save()
        frappe.db.commit()
        
        return {'success': True, 'message': f'{role} assignments updated'}
    except Exception as e:
        frappe.log_error(f"Error updating task roles: {str(e)}")
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def add_role_assignment(task_id, role, user, is_primary=False):
    """Add a single role assignment to a task"""
    try:
        task_doc = frappe.get_doc("Task", task_id)
        
        # Check if assignment already exists
        existing = [r for r in (task_doc.custom_roles or []) if r.role == role and r.user == user]
        if existing:
            return {'success': False, 'error': 'User already assigned to this role'}
        
        # If setting as primary, unset other primaries for this role
        if is_primary:
            for r in (task_doc.custom_roles or []):
                if r.role == role:
                    r.is_primary = False
        
        task_doc.append('custom_roles', {
            'role': role,
            'user': user,
            'is_primary': is_primary
        })
        
        task_doc.save()
        frappe.db.commit()
        
        return {'success': True, 'message': f'{user} added to {role}'}
    except Exception as e:
        frappe.log_error(f"Error adding role assignment: {str(e)}")
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def remove_role_assignment(task_id, role, user):
    """Remove a role assignment from a task"""
    try:
        task_doc = frappe.get_doc("Task", task_id)
        
        task_doc.custom_roles = [r for r in (task_doc.custom_roles or []) if not (r.role == role and r.user == user)]
        
        task_doc.save()
        frappe.db.commit()
        
        return {'success': True, 'message': f'{user} removed from {role}'}
    except Exception as e:
        frappe.log_error(f"Error removing role assignment: {str(e)}")
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def set_primary_role(task_id, role, user):
    """Set a user as primary for a role"""
    try:
        task_doc = frappe.get_doc("Task", task_id)
        
        for r in (task_doc.custom_roles or []):
            if r.role == role:
                r.is_primary = (r.user == user)
        
        task_doc.save()
        frappe.db.commit()
        
        return {'success': True, 'message': f'{user} set as primary {role}'}
    except Exception as e:
        frappe.log_error(f"Error setting primary role: {str(e)}")
        return {'success': False, 'error': str(e)}


def get_user_display_info(user_email):
    """Get user display info for avatar"""
    from ..services.formatters import get_initials
    
    if not user_email:
        return None
    
    try:
        user = frappe.db.get_value("User", user_email, ["full_name", "user_image"], as_dict=True)
        if user:
            return {
                'email': user_email,
                'full_name': user.full_name or user_email,
                'initials': get_initials(user.full_name or user_email),
                'image': user.user_image
            }
    except:
        pass
    
    return {
        'email': user_email,
        'full_name': user_email,
        'initials': get_initials(user_email),
        'image': None
    }


def get_bulk_roles_info(task_ids):
    """
    批量获取角色信息，优化性能
    """
    if not task_ids:
        return {}
    
    roles = frappe.get_all("Task Role Assignment",
        filters={"parent": ["in", task_ids]},
        fields=["parent", "role", "user", "is_primary"]
    )
    
    task_roles = {}
    for role in roles:
        task_id = role.parent
        if task_id not in task_roles:
            task_roles[task_id] = {}
        
        role_name = role.role
        if role_name not in task_roles[task_id]:
            task_roles[task_id][role_name] = []
        
        task_roles[task_id][role_name].append({
            'user': role.user,
            'is_primary': role.is_primary,
            'user_info': get_user_display_info(role.user)
        })
    
    return task_roles


def get_primary_role_user(task_doc, role):
    """
    Get primary user for a specific role from sub-table
    """
    try:
        if not hasattr(task_doc, 'custom_roles') or not task_doc.custom_roles:
            return None
        
        role_mapping = {
            'action_person': 'Action Person',
            'preparer': 'Preparer',
            'reviewer': 'Reviewer',
            'partner': 'Partner'
        }
        mapped_role = role_mapping.get(role, role)
        
        # Look for primary user in this role
        for role_assignment in task_doc.custom_roles:
            if role_assignment.role == mapped_role and role_assignment.is_primary:
                return role_assignment.user
        
        # If no primary found, return first user in this role
        for role_assignment in task_doc.custom_roles:
            if role_assignment.role == mapped_role:
                return role_assignment.user
        
        return None
    except:
        return None


def get_role_users_info(task_doc, role):
    """
    Get all users for a specific role from sub-table and return user info
    """
    from ..services.formatters import get_initials
    
    try:
        if not hasattr(task_doc, 'custom_roles') or not task_doc.custom_roles:
            return None
        
        role_mapping = {
            'action_person': 'Action Person',
            'preparer': 'Preparer',
            'reviewer': 'Reviewer',
            'partner': 'Partner'
        }
        mapped_role = role_mapping.get(role, role)
        
        role_users = []
        for role_assignment in task_doc.custom_roles:
            if role_assignment.role == mapped_role:
                role_users.append(role_assignment.user)
        
        if not role_users:
            return None
        
        # Convert to user info format
        user_infos = []
        for user_email in role_users:
            user_info = get_user_display_info(user_email)
            if user_info:
                user_infos.append(user_info)
        
        return user_infos if user_infos else None
        
    except:
        return None

