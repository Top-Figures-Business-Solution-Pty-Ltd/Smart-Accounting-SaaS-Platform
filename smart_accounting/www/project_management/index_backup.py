import frappe
from frappe import _
from collections import defaultdict
import re
import json
from datetime import datetime

def format_date_for_display(date_value):
    """
    Convert YYYY-MM-DD date format to DD-MM-YYYY for display
    """
    if not date_value:
        return ""
    
    try:
        # Handle both string and date objects
        if isinstance(date_value, str):
            if len(date_value) == 10 and date_value.count('-') == 2:
                parts = date_value.split('-')
                if len(parts[0]) == 4:  # YYYY-MM-DD format
                    return f"{parts[2]}-{parts[1]}-{parts[0]}"
            return date_value
        else:
            # Handle date objects
            return date_value.strftime('%d-%m-%Y')
    except:
        return str(date_value) if date_value else ""

def get_initials_from_email(email):
    """从邮箱获取首字母"""
    if not email:
        return '?'
    
    name_part = email.split('@')[0].replace('.', ' ').replace('_', ' ')
    parts = name_part.split()
    
    if len(parts) >= 2:
        return (parts[0][0] + parts[1][0]).upper()
    return name_part[:2].upper()

def get_context(context):
    """
    Get context for project management page with multi-workspace support
    """
    # Disable caching for real-time updates
    frappe.response["Cache-Control"] = "no-cache, no-store, must-revalidate"
    frappe.response["Pragma"] = "no-cache"
    frappe.response["Expires"] = "0"
    
    # Check if user is logged in
    if frappe.session.user == 'Guest':
        frappe.throw("Please login to access this page", frappe.PermissionError)
    
    # Get view parameter for different workspaces
    view = frappe.form_dict.get('view', 'main')
    boards = frappe.form_dict.get('boards', '')
    
    # Handle combination view
    if view == 'combination' and boards:
        context.title = 'Combination View'
        context.show_sidebar = False
        context.show_header = True
        context.full_width = True
        context.current_view = view
        context.available_views = get_available_views()
        context.hide_footer_signup = True
        context.breadcrumb_path = [
            {'label': 'Main Dashboard', 'icon': 'fa-th-large', 'key': 'main'},
            {'label': 'Combination View', 'icon': 'fa-layer-group', 'key': 'combination'}
        ]
        context.no_cache = True
        context.cache_key = f"pm_combination_{boards}_{frappe.utils.now()}"
        
        # Set combination view flag
        context.project_data = {
            'is_combination_view': True,
            'board_ids': boards.split(','),
            'total_projects': 0,
            'total_tasks': 0
        }
    else:
        # Set page context based on view
        context.title = get_workspace_title(view)
        context.show_sidebar = False
        context.show_header = True
        context.full_width = True  # Enable full width layout for better laptop/desktop experience
        context.current_view = view
        context.available_views = get_available_views()
        context.hide_footer_signup = True  # Hide email subscription footer
        
        # Generate breadcrumb path for navigation
        context.breadcrumb_path = get_breadcrumb_path(view)
        
        # Disable page caching for real-time updates
        context.no_cache = True
        context.cache_key = f"pm_view_{view}_{frappe.utils.now()}"
        
        # Get data based on view
        context.project_data = get_project_management_data(view)
    
    return context

def get_workspace_title(view):
    """Get title based on partition view"""
    if view == 'main':
        return 'Main Dashboard'
    
    try:
        # Get partition name
        partition_name = frappe.db.get_value("Partition", view, "partition_name")
        return partition_name if partition_name else view.replace('_', ' ').title()
    except Exception as e:
        # Silently handle main view without logging error
        if view != 'main':
            print(f"DEBUG: Error getting workspace title: {str(e)}")
        return view.replace('_', ' ').title()

def get_project_management_data(view='main'):
    """
    Get all projects and tasks organized by client with view filtering
    Based on user's data structure: Company → Client → Project → Task
    """
    try:
        # Main view now shows workspace overview instead of all tasks
        if view == 'main':
            return get_main_dashboard_data()
        
        # Check if this is a workspace (should not show tasks, only overview)
        if view != 'main':
            try:
                # First check if partition exists before trying to get it
                if frappe.db.exists("Partition", view):
                    partition_doc = frappe.get_doc("Partition", view)
                    if partition_doc.is_workspace:
                        # For workspaces, return child boards overview instead of tasks
                        return get_workspace_overview_data(view)
            except Exception as e:
                print(f"DEBUG: Error checking workspace status for view {view}: {str(e)}")
                pass
        
        # Get projects filtered by partition
        project_filters = {"status": ["!=", "Cancelled"]}
        
        # Add partition filter if not main view
        if view != 'main':
            try:
                # Check if partition exists
                if frappe.db.exists("Partition", view):
                    project_filters["custom_partition"] = view
                else:
                    # If partition doesn't exist, return empty data
                    return {
                        'organized_data': {},
                        'total_projects': 0,
                        'total_tasks': 0,
                        'debug_info': {'message': f'Partition {view} not found'},
                        'is_workspace_view': False  # This is a board view, not a workspace view
                    }
            except Exception as e:
                print(f"DEBUG: Partition filtering error: {str(e)}")
                # If Partition DocType doesn't exist, use all projects
                pass
        
        # Get projects with partition filtering
        projects = frappe.db.get_all("Project", 
            fields=["name", "project_name", "customer", "status"],
            filters=project_filters,
            order_by="project_name"
        )
        
        # Get tasks for these projects
        task_filters = {"status": ["!=", "Cancelled"]}
        
        if projects:
            project_ids = [p.name for p in projects]
            task_filters["project"] = ["in", project_ids]
        else:
            # If no projects found, no tasks either
            task_filters["project"] = ["in", []]
        
        # 简化的任务查询 - 直接获取所有需要的字段
        tasks = frappe.db.get_all("Task",
            fields=[
                "name", "subject", "custom_task_status", "priority", "exp_end_date", "project", 
                "description", "modified", "company", "custom_note", "custom_frequency", "custom_reset_date",
                "custom_client", "custom_tftg", "custom_tf_tg", "custom_service_line", 
                "custom_year_end", "custom_target_month", "custom_budget_planning", 
                "custom_actual_billing", "custom_lodgement_due_date", "custom_engagement"
            ],
            filters=task_filters,
            order_by="exp_end_date"
        )
        
        # 简化的任务数据处理
        for task in tasks:
            task.task_id = task.name
            task.task_name = task.subject
            task.status = task.custom_task_status or 'Not Started'
            task.note = task.custom_note or ''
            
            # 基本字段设置
            task.tf_tg = 'TF'  # 简化，避免复杂查询
            task.entity_type = 'Company'  # 默认值
            task.client_name = 'No Client'  # 默认值
            task.software_info = []
            task.review_notes = []
            task.comment_count = 0
            task.assignees = None
            
            # 基本日期格式化
            task.last_updated = format_date_for_display(task.modified) if hasattr(task, 'modified') else ""
        
        # 组织数据结构
        organized_data = {}
        
        # 简化的数据组织
        for task in tasks:
            client_name = task.client_name or "Unassigned"
            project_name = task.project or "No Project"
            
            if client_name not in organized_data:
                organized_data[client_name] = {}
            
            if project_name not in organized_data[client_name]:
                organized_data[client_name][project_name] = []
            
            organized_data[client_name][project_name].append(task)
        
        return {
            'organized_data': organized_data,
            'total_projects': len(projects),
            'total_tasks': len(tasks),
            'debug_info': {'view': view, 'projects_found': len(projects), 'tasks_found': len(tasks)},
            'is_workspace_view': False
        }
        
    except Exception as e:
        frappe.log_error(f"Error in get_project_management_data: {str(e)}")
        return {
            'organized_data': {},
            'total_projects': 0,
            'total_tasks': 0,
            'error': str(e),
            'is_workspace_view': False
        }

def get_main_dashboard_data():
    """简化的主仪表板数据"""
    return {
        'organized_data': {'workspaces': [], 'boards': []},
        'total_projects': 0,
        'total_tasks': 0,
        'is_main_dashboard': True
    }

def get_workspace_overview_data(workspace_name):
    """简化的工作区概览数据"""
    return {
        'organized_data': {'workspaces': [], 'boards': []},
        'total_projects': 0,
        'total_tasks': 0,
        'is_workspace_view': True,
        'workspace_name': workspace_name
    }

def get_available_views():
    """获取可用视图"""
    try:
        partitions = frappe.get_all("Partition",
            fields=["name", "partition_name", "is_workspace"],
            filters={"disabled": ["!=", 1]},
            order_by="partition_name"
        )
        
        views = []
        for partition in partitions:
            views.append({
                'key': partition.name,
                'label': partition.partition_name,
                'icon': 'fa-sitemap' if partition.is_workspace else 'fa-folder',
                'type': 'workspace' if partition.is_workspace else 'board'
            })
            
        return views
        
    except Exception as e:
        return []

def get_breadcrumb_path(view):
    """Generate breadcrumb navigation path"""
    try:
        if view == 'main':
            return [{'label': 'Main Dashboard', 'icon': 'fa-th-large', 'key': 'main'}]
        
        path = [{'label': 'Main Dashboard', 'icon': 'fa-th-large', 'key': 'main'}]
        
        # Get current partition info
        partition = frappe.db.get_value("Partition", view, 
            ["partition_name", "is_workspace", "parent_partition"], as_dict=True)
        
        if partition:
            path.append({
                'label': partition.partition_name,
                'icon': 'fa-sitemap' if partition.is_workspace else 'fa-folder',
                'key': view,
                'type': 'workspace' if partition.is_workspace else 'board'
            })
        
        return path
        
    except Exception as e:
        return [{'label': 'Main Dashboard', 'icon': 'fa-th-large', 'key': 'main'}]
