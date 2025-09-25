@frappe.whitelist()
def get_task_role_assignments(task_id, role_filter=None):
    """
    Get all role assignments for a specific task and optional role filter
    """
    try:
        # Build filters
        filters = {"parent": task_id}
        if role_filter:
            filters["role"] = role_filter
        
        # Get role assignments from Task Role Assignment child table
        assignments = frappe.get_all("Task Role Assignment",
            filters=filters,
            fields=["user", "role", "is_primary"],
            order_by="is_primary desc, creation asc"
        )
        
        # Get user info for each assignment
        role_assignments = []
        for assignment in assignments:
            try:
                user_info = frappe.get_value("User", assignment.user, 
                    ["full_name", "email"], as_dict=True)
                if user_info:
                    role_assignments.append({
                        "user": assignment.user,
                        "role": assignment.role,
                        "is_primary": assignment.is_primary,
                        "full_name": user_info.full_name,
                        "email": user_info.email
                    })
            except Exception as e:
                frappe.log_error(f"Error getting user info for {assignment.user}: {str(e)}")
                # Include assignment even if user info fails
                role_assignments.append({
                    "user": assignment.user,
                    "role": assignment.role,
                    "is_primary": assignment.is_primary,
                    "full_name": assignment.user,
                    "email": assignment.user
                })
        
        return {
            'success': True,
            'role_assignments': role_assignments
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting task role assignments: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }
