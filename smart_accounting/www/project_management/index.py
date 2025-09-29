import frappe
from frappe import _
from collections import defaultdict
import re
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
    
    # Set page context based on view
    context.title = get_workspace_title(view)
    context.show_sidebar = False
    context.show_header = True
    context.full_width = True  # Enable full width layout for better laptop/desktop experience
    context.current_view = view
    context.available_views = get_available_views()
    
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
        print(f"DEBUG: Workspace title for {view}: {partition_name}")
        return partition_name if partition_name else view.replace('_', ' ').title()
    except Exception as e:
        # Silently handle main view without logging error
        if view != 'main':
            print(f"DEBUG: Error getting workspace title: {str(e)}")
        return view.replace('_', ' ').title()

def get_available_views():
    """Get top-level partitions only (Monday.com style hierarchical)"""
    try:
        # Get only top-level partitions (no parent) that are not archived
        top_partitions = frappe.db.get_all("Partition",
            fields=["name", "partition_name", "parent_partition", "is_workspace"],
            filters={
                "parent_partition": ["is", "not set"],
                "is_archived": ["!=", 1]
            },
            order_by="is_workspace desc, partition_name"  # Workspaces first, then boards
        )
        
        views = []
        
        # Add top-level partitions with proper icons
        for partition in top_partitions:
            # Different icons for workspace vs board
            icon = 'fa-th-large' if partition.is_workspace else 'fa-table'
            type_name = 'workspace' if partition.is_workspace else 'board'
            
            views.append({
                'key': partition.name,
                'label': partition.partition_name,
                'icon': icon,
                'type': type_name,
                'is_workspace': partition.is_workspace,
                'has_children': has_child_partitions(partition.name)
            })
            
        print(f"DEBUG: Top-level views: {[v['label'] for v in views]}")
        return views
        
    except Exception as e:
        print(f"DEBUG: Error getting partitions: {str(e)}")
        # Fallback
        return []

def has_child_partitions(partition_name):
    """Check if partition has child partitions"""
    try:
        count = frappe.db.count("Partition", {"parent_partition": partition_name})
        return count > 0
    except:
        return False

def get_child_partitions(parent_partition):
    """Get child partitions for a parent"""
    try:
        return frappe.get_all("Partition",
            fields=["name", "partition_name"],
            filters={"parent_partition": parent_partition},
            order_by="partition_name"
        )
    except:
        return []

@frappe.whitelist()
def create_partition(partition_name, is_workspace=False, parent_partition=None, description="", icon=""):
    """
    Create a new partition (workspace or board)
    """
    try:
        # Ensure is_workspace is properly converted to boolean
        is_workspace = frappe.utils.cint(is_workspace) if is_workspace is not None else False
        
        if not partition_name or not partition_name.strip():
            return {'success': False, 'error': 'Partition name is required'}
        
        partition_name = partition_name.strip()
        
        # Safely truncate description to prevent "Value too big" error
        if description and len(description) > 140:
            description = description[:140]
        
        # Check if partition already exists with same name under same parent
        existing_filters = {"partition_name": partition_name}
        if parent_partition:
            existing_filters["parent_partition"] = parent_partition
        else:
            existing_filters["parent_partition"] = ["is", "not set"]
        
        existing = frappe.db.exists("Partition", existing_filters)
        if existing:
            return {'success': False, 'error': f'A partition with name "{partition_name}" already exists'}
        
        # Create new partition
        new_partition = frappe.new_doc("Partition")
        new_partition.partition_name = partition_name
        new_partition.is_workspace = 1 if is_workspace else 0
        new_partition.description = description
        new_partition.icon = icon
        
        if parent_partition:
            # Validate parent exists
            if not frappe.db.exists("Partition", parent_partition):
                return {'success': False, 'error': f'Parent partition "{parent_partition}" not found'}
            new_partition.parent_partition = parent_partition
        
        # Set default visible columns (inherit from parent or use default)
        if parent_partition:
            try:
                parent_doc = frappe.get_doc("Partition", parent_partition)
                if parent_doc.visible_columns:
                    new_partition.visible_columns = parent_doc.visible_columns
                    new_partition.column_config = parent_doc.column_config or "{}"
                else:
                    new_partition.visible_columns = '["client", "task-name", "entity", "tf-tg", "software", "status", "target-month", "budget", "actual"]'
                    new_partition.column_config = "{}"
            except:
                new_partition.visible_columns = '["client", "task-name", "entity", "tf-tg", "software", "status", "target-month", "budget", "actual"]'
                new_partition.column_config = "{}"
        else:
            # Default columns for new top-level partition
            new_partition.visible_columns = '["client", "task-name", "entity", "tf-tg", "software", "status", "target-month", "budget", "actual"]'
            new_partition.column_config = "{}"
        
        new_partition.save()
        frappe.db.commit()
        
        return {
            'success': True,
            'message': f'{"Workspace" if is_workspace else "Board"} "{partition_name}" created successfully',
            'name': new_partition.name,
            'partition_name': partition_name
        }
        
    except Exception as e:
        frappe.log_error(f"Error creating partition: {str(e)}")
        return {'success': False, 'error': str(e)}

@frappe.whitelist()
def archive_partition(partition_name, archived=True):
    """
    Archive/unarchive a partition
    """
    try:
        if not frappe.db.exists("Partition", partition_name):
            return {'success': False, 'error': 'Partition not found'}
        
        # Check if partition has child partitions
        child_count = frappe.db.count("Partition", {"parent_partition": partition_name})
        if child_count > 0 and archived:
            return {'success': False, 'error': 'Cannot archive partition with child partitions'}
        
        # Check if partition has projects assigned
        project_count = frappe.db.count("Project", {"custom_partition": partition_name})
        if project_count > 0 and archived:
            return {'success': False, 'error': f'Cannot archive partition with {project_count} assigned projects'}
        
        # Archive the partition
        frappe.db.set_value("Partition", partition_name, "is_archived", 1 if archived else 0)
        frappe.db.commit()
        
        action = "archived" if archived else "unarchived"
        return {
            'success': True,
            'message': f'Partition {action} successfully'
        }
        
    except Exception as e:
        frappe.log_error(f"Error archiving partition: {str(e)}")
        return {'success': False, 'error': str(e)}

@frappe.whitelist()
def get_child_partitions(parent_partition):
    """Get child partitions for workspace navigation"""
    try:
        children = frappe.get_all("Partition",
            fields=["name", "partition_name", "is_workspace"],
            filters={"parent_partition": parent_partition, "is_archived": ["!=", 1]},
            order_by="partition_name"
        )
        
        # Check if each child has its own children
        for child in children:
            child_count = frappe.db.count("Partition", {
                "parent_partition": child.name,
                "is_archived": ["!=", 1]
            })
            child['has_children'] = child_count > 0
        
        return children
    except Exception as e:
        frappe.log_error(f"Error getting child partitions: {str(e)}")
        return []

@frappe.whitelist()
def get_available_workspaces():
    """Get all available workspaces for selection"""
    try:
        workspaces = frappe.get_all("Partition",
            fields=["name", "partition_name"],
            filters={
                "is_workspace": 1,
                "is_archived": ["!=", 1]
            },
            order_by="partition_name"
        )
        
        return workspaces
    except Exception as e:
        frappe.log_error(f"Error getting available workspaces: {str(e)}")
        return []

@frappe.whitelist()
def get_partition_info(partition_name):
    """Get partition information to determine if it's a workspace or board"""
    try:
        partition = frappe.get_doc("Partition", partition_name)
        return {
            'name': partition.name,
            'partition_name': partition.partition_name,
            'is_workspace': partition.is_workspace,
            'description': partition.description or '',
            'parent_partition': partition.parent_partition
        }
    except Exception as e:
        frappe.log_error(f"Error getting partition info: {str(e)}")
        return None

def get_breadcrumb_path(view):
    """Generate breadcrumb navigation path"""
    if view == 'main':
        return None
    
    try:
        # First check if partition exists to avoid errors
        if not frappe.db.exists("Partition", view):
            # If partition doesn't exist, return None (no breadcrumb)
            return None
            
        breadcrumb = []
        current_partition = frappe.get_doc("Partition", view)
        
        # Build path from current to root
        path = []
        current = current_partition
        while current:
            icon = 'fa-th-large' if current.is_workspace else 'fa-table'
            path.append({
                'key': current.name,
                'label': current.partition_name,
                'icon': icon,
                'type': 'workspace' if current.is_workspace else 'board'
            })
            
            # Get parent if exists
            if current.parent_partition:
                current = frappe.get_doc("Partition", current.parent_partition)
            else:
                current = None
        
        # Reverse to get root-to-current order
        path.reverse()
        
        # Add main dashboard at the beginning if not already there
        if path and path[0]['key'] != 'main':
            path.insert(0, {
                'key': 'main',
                'label': 'Main Dashboard',
                'icon': 'fa-home',
                'type': 'main'
            })
        
        return path
        
    except Exception as e:
        # Silently handle main view without logging error
        if view != 'main':
            frappe.log_error(f"Error generating breadcrumb path: {str(e)}")
        return None

@frappe.whitelist()
def get_partition_column_config(partition_name):
    """Get column configuration for a specific partition"""
    try:
        if partition_name == 'main':
            # Default configuration for main view - show all current columns
            # 使用动态的默认列配置而不是硬编码
            default_visible_columns = [
                'client', 'task-name', 'entity', 'tf-tg', 'software', 'status', 'note', 
                'target-month', 'budget', 'actual', 'review-note', 'action-person', 
                'preparer', 'reviewer', 'partner', 'lodgment-due', 'engagement', 'group', 
                'year-end', 'last-updated', 'priority', 'frequency', 'reset-date'
            ]
            return {
                'success': True,
                'visible_columns': default_visible_columns,
                'column_config': {
                    'column_order': default_visible_columns  # 提供默认排序
                }
            }
        
        # Get partition configuration
        if not frappe.db.exists("Partition", partition_name):
            return {
                'success': False,
                'error': f'Partition "{partition_name}" not found'
            }
        
        partition_doc = frappe.get_doc("Partition", partition_name)
        
        # Parse JSON configuration
        import json
        visible_columns_raw = getattr(partition_doc, 'visible_columns', None)
        column_config_raw = getattr(partition_doc, 'column_config', None)
        
        visible_columns = json.loads(visible_columns_raw) if visible_columns_raw else []
        column_config = json.loads(column_config_raw) if column_config_raw else {}
        
        # If no configuration, use default
        if not visible_columns:
            visible_columns = [
                'client', 'task-name', 'entity', 'tf-tg', 'software', 'status', 'target-month', 
                'budget', 'actual', 'review-note', 'action-person', 'preparer', 'reviewer', 
                'partner', 'lodgment-due', 'engagement', 'group', 'year-end', 'last-updated', 'priority'
            ]
            
        # 确保column_config包含默认的列顺序
        if not column_config.get('column_order'):
            column_config['column_order'] = visible_columns.copy()
        
        return {
            'success': True,
            'visible_columns': visible_columns,
            'column_config': column_config
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting partition column config: {str(e)}")
        return {
            'success': False,
            'error': str(e),
            'visible_columns': ['client', 'task-name', 'status'],
            'column_config': {}
        }

@frappe.whitelist()
def save_partition_column_config(partition_name, visible_columns, column_config=None):
    """Save column configuration for a specific partition"""
    try:
        if not partition_name:
            return {'success': False, 'error': 'Partition name is required'}
        
        # Handle main view - don't save, always use default
        if partition_name == 'main':
            default_columns = [
                'client', 'task-name', 'entity', 'tf-tg', 'software', 'status', 'target-month', 
                'budget', 'actual', 'review-note', 'action-person', 'preparer', 'reviewer', 
                'partner', 'lodgment-due', 'engagement', 'group', 'year-end', 'last-updated', 'priority'
            ]
            return {
                'success': True,
                'message': 'Main view uses default configuration (not saved)',
                'visible_columns': default_columns,
                'column_config': {
                    'column_order': default_columns
                }
            }
        
        # For non-main partitions, save to Partition record
        # Validate partition exists
        if not frappe.db.exists("Partition", partition_name):
            return {'success': False, 'error': f'Partition "{partition_name}" not found'}
        
        # Parse and validate visible_columns
        import json
        if isinstance(visible_columns, str):
            try:
                visible_columns_list = json.loads(visible_columns)
            except json.JSONDecodeError:
                return {'success': False, 'error': 'Invalid visible_columns JSON format'}
        else:
            visible_columns_list = visible_columns
        
        if not isinstance(visible_columns_list, list):
            return {'success': False, 'error': 'visible_columns must be an array'}
        
        # Parse column_config
        if column_config:
            if isinstance(column_config, str):
                try:
                    column_config_dict = json.loads(column_config)
                except json.JSONDecodeError:
                    return {'success': False, 'error': 'Invalid column_config JSON format'}
            else:
                column_config_dict = column_config
        else:
            column_config_dict = {}
        
        # Update partition document
        partition_doc = frappe.get_doc("Partition", partition_name)
        partition_doc.visible_columns = json.dumps(visible_columns_list)
        partition_doc.column_config = json.dumps(column_config_dict)
        partition_doc.save()
        
        frappe.db.commit()
        
        return {
            'success': True,
            'message': 'Column configuration saved successfully',
            'visible_columns': visible_columns_list,
            'column_config': column_config_dict
        }
        
    except Exception as e:
        frappe.log_error(f"Error saving partition column config: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }



@frappe.whitelist()
def load_partition_data(view='main'):
    """Load project data for specific partition (called by JavaScript)"""
    try:
        data = get_project_management_data(view)
        return {
            'success': True,
            'data': data,
            'view': view,
            'title': get_workspace_title(view)
        }
    except Exception as e:
        frappe.log_error(f"Error loading partition data: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

def get_workspace_overview_data(workspace_name):
    """
    Get overview data for a workspace (shows child boards, not individual tasks)
    """
    try:
        # Get child boards of this workspace
        child_boards = frappe.get_all("Partition",
            fields=["name", "partition_name", "description", "icon"],
            filters={
                "parent_partition": workspace_name,
                "is_archived": ["!=", 1]
            },
            order_by="partition_name"
        )
        
        # Get summary statistics for each child board
        board_summaries = {}
        total_projects = 0
        total_tasks = 0
        
        for board in child_boards:
            # Count projects in this board
            project_count = frappe.db.count("Project", {
                "custom_partition": board.name,
                "status": ["!=", "Cancelled"]
            })
            
            # Count tasks in this board (simplified count)
            task_count = 0
            if project_count > 0:
                projects = frappe.get_all("Project", 
                    filters={"custom_partition": board.name, "status": ["!=", "Cancelled"]},
                    fields=["name"]
                )
                if projects:
                    task_count = frappe.db.count("Task", {
                        "project": ["in", [p.name for p in projects]],
                        "status": ["!=", "Cancelled"]
                    })
            
            board_summaries[board.partition_name] = {
                'board_name': board.name,
                'description': board.description or '',
                'project_count': project_count,
                'task_count': task_count,
                'icon': board.icon or 'fa-table',
                'projects': []  # Empty for workspace view
            }
            
            total_projects += project_count
            total_tasks += task_count
        
        # Convert board_summaries to the format expected by main dashboard template
        boards_list = []
        for board_name, board_data in board_summaries.items():
            boards_list.append({
                'name': board_data['board_name'],
                'partition_name': board_name,
                'description': board_data['description'],
                'project_count': board_data['project_count'],
                'task_count': board_data['task_count'],
                'icon': board_data.get('icon', 'fa-table'),  # Default board icon
                'is_workspace': False  # These are boards under a workspace
            })
        
        return {
            'organized_data': {
                'workspaces': [],  # No sub-workspaces in a workspace view
                'boards': boards_list
            },
            'total_projects': total_projects,
            'total_tasks': total_tasks,
            'is_workspace_view': True,
            'is_main_dashboard': True,  # Use main dashboard template
            'workspace_name': workspace_name
        }
        
    except Exception as e:
        frappe.log_error(f"Workspace overview data error: {str(e)}")
        return {
            'organized_data': {
                'workspaces': [],
                'boards': []
            },
            'total_projects': 0,
            'total_tasks': 0,
            'is_workspace_view': True,
            'is_main_dashboard': True,  # Use main dashboard template even for errors
            'error': str(e)
        }

def get_main_dashboard_data():
    """
    Get overview data for main dashboard - show all workspaces and top-level boards
    """
    try:
        # Get all top-level partitions (workspaces and boards)
        top_partitions = frappe.get_all("Partition",
            fields=["name", "partition_name", "description", "is_workspace", "icon"],
            filters={
                "parent_partition": ["is", "not set"],
                "is_archived": ["!=", 1]
            },
            order_by="is_workspace desc, partition_name"
        )
        
        
        # Organize into workspaces and boards
        workspaces = []
        boards = []
        
        for partition in top_partitions:
            # Count projects and tasks for each partition
            project_count = frappe.db.count("Project", {
                "custom_partition": partition.name,
                "status": ["!=", "Cancelled"]
            })
            
            task_count = 0
            if project_count > 0:
                projects = frappe.get_all("Project", 
                    filters={"custom_partition": partition.name, "status": ["!=", "Cancelled"]},
                    fields=["name"]
                )
                if projects:
                    task_count = frappe.db.count("Task", {
                        "project": ["in", [p.name for p in projects]],
                        "status": ["!=", "Cancelled"]
                    })
            
            partition_data = {
                'name': partition.name,
                'partition_name': partition.partition_name,
                'description': partition.description or '',
                'icon': partition.icon or ('fa-th-large' if partition.is_workspace else 'fa-table'),
                'project_count': project_count,
                'task_count': task_count,
                'is_workspace': partition.is_workspace
            }
            
            if partition.is_workspace:
                workspaces.append(partition_data)
            else:
                boards.append(partition_data)
        
        return {
            'organized_data': {
                'workspaces': workspaces,
                'boards': boards
            },
            'total_projects': sum(p['project_count'] for p in workspaces + boards),
            'total_tasks': sum(p['task_count'] for p in workspaces + boards),
            'is_main_dashboard': True
        }
        
    except Exception as e:
        frappe.log_error(f"Main dashboard data error: {str(e)}")
        return {
            'organized_data': {'workspaces': [], 'boards': []},
            'total_projects': 0,
            'total_tasks': 0,
            'is_main_dashboard': True,
            'error': str(e)
        }

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
        # Minimal cache clearing for better performance
        frappe.db.commit()  # 确保所有数据库操作都已提交
        
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
                        'debug_info': {'message': f'Partition {view} not found'}
                    }
            except Exception as e:
                print(f"DEBUG: Partition filtering error: {str(e)}")
                # If Partition DocType doesn't exist, use all projects
                pass
        
        # Get projects with partition filtering (no cache for real-time)
        projects = frappe.db.get_all("Project", 
            fields=["name", "project_name", "customer", "status", "expected_end_date", "priority", "custom_partition"],
            filters=project_filters,
            order_by="customer, expected_end_date"
        )
        
        print(f"DEBUG: Found {len(projects)} projects for view '{view}'")
        print(f"DEBUG: Project filters used: {project_filters}")
        for p in projects[:3]:  # Show first 3 projects
            print(f"DEBUG: Project {p.name}: partition={getattr(p, 'custom_partition', 'None')}")
        
        # Get project IDs for task filtering
        project_ids = [p.name for p in projects]
        
        # Get tasks only for the filtered projects (excluding archived tasks and subtasks)
        task_filters = {
            "custom_is_archived": ["!=", 1],  # Exclude archived tasks
            "parent_task": ["is", "not set"]  # Only show top-level tasks, not subtasks
        }
        if project_ids:
            task_filters["project"] = ["in", project_ids]
        else:
            # If no projects found, no tasks either
            task_filters["project"] = ["in", []]
        
        tasks = frappe.db.get_all("Task",
            fields=["name", "subject", "custom_task_status", "priority", "exp_end_date", "project", "description", "modified", "company", "custom_note", "custom_frequency", "custom_reset_date"],
            filters=task_filters,
            order_by="exp_end_date"
        )
        
        
        # Enrich tasks with project and client information
        for task in tasks:
            task.task_id = task.name
            task.task_name = task.subject
            
            # Map custom_task_status to status for frontend compatibility
            task.status = task.custom_task_status or 'Not Started'
            
            # Map custom_note to note for frontend compatibility
            task.note = task.custom_note or ''
            
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
                task.service_line = getattr(task_doc, 'custom_service_line', None) or ""
                # Get software from sub-table (new clean approach)
                task.software = get_primary_software(task_doc) or ""
                task.year_end = getattr(task_doc, 'custom_year_end', None) or ""
                task.target_month = getattr(task_doc, 'custom_target_month', None) or ""
                # Get people - only from sub-table (new clean approach)
                task.partner = get_primary_role_user(task_doc, 'partner') or ""
                task.reviewer = get_primary_role_user(task_doc, 'reviewer') or ""
                task.preparer = get_primary_role_user(task_doc, 'preparer') or ""
                # Format lodgement due date for display (convert YYYY-MM-DD to DD-MM-YYYY)
                lodgement_due_raw = getattr(task_doc, 'custom_lodgement_due_date', None)
                task.lodgment_due_date = format_date_for_display(lodgement_due_raw) if lodgement_due_raw else ""
                
                # Get action person - only from sub-table
                task.action_person = get_primary_role_user(task_doc, 'action_person') or ""
                
                # Get Budget and Actual Billing (newly added fields)
                task.budget_planning = getattr(task_doc, 'custom_budget_planning', None) or 0
                task.actual_billing = getattr(task_doc, 'custom_actual_billing', None) or 0
                
                # Get Frequency and Reset Date (newly added fields)
                task.custom_frequency = getattr(task_doc, 'custom_frequency', None) or ""
                # Format reset date for display (convert YYYY-MM-DD to DD-MM-YYYY)
                reset_date_raw = getattr(task_doc, 'custom_reset_date', None)
                task.custom_reset_date = format_date_for_display(reset_date_raw) if reset_date_raw else ""
                
                # Try to get Review Notes (child table)
                try:
                    # Get review notes from the custom_review_notes child table
                    task_doc = frappe.get_doc("Task", task.name)
                    review_notes = []
                    
                    if hasattr(task_doc, 'custom_review_notes') and task_doc.custom_review_notes:
                        for i, review_note in enumerate(task_doc.custom_review_notes):
                            # Only get the note field, which definitely exists
                            note_text = ''
                            if hasattr(review_note, 'note'):
                                note_text = review_note.note
                            elif isinstance(review_note, dict):
                                note_text = review_note.get('note', '')
                            
                            if note_text:  # Only add non-empty notes
                                review_notes.append({
                                    'name': f"{task.name}-review-{i}",
                                    'note': note_text,
                                    'creation': task_doc.creation,
                                    'owner': task_doc.owner
                                })
                    
                    task.review_notes = review_notes
                    task.latest_review_note = review_notes[0].note if review_notes else ""
                except:
                    task.review_notes = []
                    task.latest_review_note = ""
                
                # Convert email addresses to user info for avatar display (from sub-table)
                task.preparer_info = get_role_users_info(task_doc, 'preparer')
                task.reviewer_info = get_role_users_info(task_doc, 'reviewer')
                task.partner_info = get_role_users_info(task_doc, 'partner')
                task.action_person_info = get_role_users_info(task_doc, 'action_person')
                
                # Get software info for display (from sub-table)
                task.software_info = get_software_info(task_doc)
                
                # Format last updated date
                if hasattr(task, 'modified') and task.modified:
                    task.last_updated = task.modified.strftime("%Y-%m-%d") if hasattr(task.modified, 'strftime') else str(task.modified)
                else:
                    task.last_updated = ""
                
                # 总是实时计算评论数量 - 最准确的方式
                task.comment_count = frappe.db.count('Comment', {
                    'reference_doctype': 'Task',
                    'reference_name': task.name,
                    'comment_type': 'Comment'
                })
                
                # Get engagement information safely
                try:
                    custom_engagement = getattr(task_doc, 'custom_engagement', None)
                    if custom_engagement:
                        task.custom_engagement = custom_engagement
                        # Count engagement letters safely
                        try:
                            el_count = frappe.db.count('File', {
                                'attached_to_doctype': 'Engagement',
                                'attached_to_name': custom_engagement
                            })
                            task.engagement_el_count = el_count
                        except:
                            task.engagement_el_count = 0
                    else:
                        task.custom_engagement = None
                        task.engagement_el_count = 0
                except:
                    task.custom_engagement = None
                    task.engagement_el_count = 0
                
                # Get client group information from customer
                try:
                    if hasattr(task_doc, 'custom_client') and task_doc.custom_client:
                        # Get the client group ID from customer
                        client_group_id = frappe.db.get_value('Customer', task_doc.custom_client, 'custom_client_group')
                        if client_group_id:
                            # Get the group name from Client Group DocType
                            client_group_name = frappe.db.get_value('Client Group', client_group_id, 'group_name')
                            task.client_group = client_group_name or ''
                        else:
                            task.client_group = ''
                    else:
                        task.client_group = ''
                except:
                    task.client_group = ''
                    
            except:
                # If custom fields don't exist, use empty values
                task.tf_tg = ""
                task.service_line = ""
                task.software = ""
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
                task.custom_frequency = ""
                task.custom_reset_date = ""
                task.review_notes = []
                task.latest_review_note = ""
                # Set empty user info for avatars (no sub-table data)
                task.preparer_info = None
                task.reviewer_info = None
                task.partner_info = None
                task.action_person_info = None
                task.software_info = None
                # Set default comment count - 实时计算
                task.comment_count = frappe.db.count('Comment', {
                    'reference_doctype': 'Task',
                    'reference_name': task.name,
                    'comment_type': 'Comment'
                })
            
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
        task.flags.ignore_version = True
        task.custom_task_status = new_status
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
        # Get fresh document and ignore version conflicts
        task = frappe.get_doc("Task", task_id)
        task.flags.ignore_version = True
        
        # Validate field name (security check) - removed person and software fields as they're now handled by sub-tables
        allowed_fields = [
            'custom_tftg', 'custom_tf_tg', 'custom_target_month',
            'custom_budget_planning', 'custom_actual_billing', 'custom_year_end', 'custom_task_status',
            'custom_service_line', 'custom_client', 'custom_lodgement_due_date', 'subject',
            'custom_engagement', 'custom_roles', 'custom_due_date', 'description', 'custom_note',
            'custom_frequency', 'custom_reset_date'
        ]
        
        if field_name not in allowed_fields:
            return {'success': False, 'error': 'Field not allowed for editing'}
        
        # Convert value based on field type
        if field_name in ['custom_budget_planning', 'custom_actual_billing']:
            try:
                new_value = float(new_value) if new_value else 0
            except ValueError:
                return {'success': False, 'error': 'Invalid number format'}
        elif field_name == 'custom_year_end':
            # Validate Year End is a valid month
            valid_months = ['January', 'February', 'March', 'April', 'May', 'June',
                           'July', 'August', 'September', 'October', 'November', 'December']
            if new_value and new_value not in valid_months:
                return {'success': False, 'error': f'Year End must be a valid month. Invalid value: {new_value}'}
            print(f"DEBUG: Year End validation passed for value: {new_value}")
        elif field_name in ['custom_lodgment_due_date', 'custom_lodgement_due_date', 'custom_due_date', 'custom_reset_date']:
            # Enhanced date validation for date fields - support multiple formats
            if new_value and new_value.strip():
                try:
                    from datetime import datetime
                    original_value = new_value
                    
                    # Try to parse and convert various date formats to YYYY-MM-DD
                    if len(new_value) == 10 and new_value.count('-') == 2:
                        parts = new_value.split('-')
                        
                        # Check if it's already YYYY-MM-DD format
                        if len(parts[0]) == 4:
                            datetime.strptime(new_value, '%Y-%m-%d')
                            print(f"DEBUG: Date validation passed (YYYY-MM-DD) for {field_name}: {new_value}")
                        # Check if it's DD-MM-YYYY format
                        elif len(parts[2]) == 4:
                            datetime.strptime(new_value, '%d-%m-%Y')
                            # Convert DD-MM-YYYY to YYYY-MM-DD for storage
                            new_value = f"{parts[2]}-{parts[1]}-{parts[0]}"
                            print(f"DEBUG: Date converted from DD-MM-YYYY to YYYY-MM-DD for {field_name}: {original_value} -> {new_value}")
                        else:
                            return {'success': False, 'error': f'Date must be in DD-MM-YYYY or YYYY-MM-DD format.'}
                    else:
                        return {'success': False, 'error': f'Date must be in DD-MM-YYYY or YYYY-MM-DD format.'}
                except ValueError:
                    return {'success': False, 'error': f'Invalid date format. Please use DD-MM-YYYY or YYYY-MM-DD.'}
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
        
        # Update the field using set_value to avoid full document validation
        frappe.db.set_value("Task", task_id, field_name, new_value)
        
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
def create_subtask(parent_task_id, subtask_name=None):
    """Create a new subtask under a parent task"""
    try:
        # Get parent task info
        parent_task = frappe.get_doc("Task", parent_task_id)
        
        # Create new subtask with inherited properties
        new_task = frappe.new_doc("Task")
        # Use provided name or generate default
        if subtask_name and subtask_name.strip():
            new_task.subject = subtask_name.strip()
        else:
            new_task.subject = f"Subtask of {parent_task.subject}"
        new_task.project = parent_task.project
        new_task.parent_task = parent_task_id
        new_task.custom_task_status = "Not Started"
        new_task.priority = parent_task.priority or "Medium"
        
        # Inherit custom fields from parent
        custom_fields = [
            'custom_client', 'custom_tftg', 'custom_target_month', 
            'custom_budget_planning', 'custom_actual_billing',
            'custom_action_person', 'custom_preparer', 'custom_reviewer', 'custom_partner',
            'custom_engagement', 'custom_partition'
        ]
        
        for field in custom_fields:
            if hasattr(parent_task, field):
                setattr(new_task, field, getattr(parent_task, field))
        
        new_task.insert()
        
        return {
            'success': True,
            'task_id': new_task.name,
            'task_subject': new_task.subject,
            'parent_task_id': parent_task_id
        }
        
    except Exception as e:
        frappe.log_error(f"Error creating subtask: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist()
def get_subtasks(parent_task_id):
    """Get all subtasks for a parent task with role assignments"""
    try:
        subtasks = frappe.get_all("Task",
            filters={
                "parent_task": parent_task_id, 
                "custom_is_archived": ["!=", 1]  # Exclude archived subtasks
            },
            fields=["name", "subject", "custom_task_status", "priority", "creation", "modified", 
                   "custom_due_date", "description", "custom_note"],
            order_by="creation asc"  # New subtasks appear at bottom
        )
        
        # Enrich subtasks with role assignments
        for subtask in subtasks:
            # Map custom_task_status to status for frontend compatibility
            subtask.status = subtask.custom_task_status or 'Not Started'
            
            # Map custom_note to note for frontend compatibility
            subtask.note = subtask.custom_note or ''
            
            # Get role assignments for this subtask
            role_assignments = frappe.get_all("Task Role Assignment",
                filters={"parent": subtask.name},
                fields=["role", "user", "is_primary"],
                order_by="is_primary desc, role, user"
            )
            
            # Add user details to role assignments
            enriched_assignments = []
            for assignment in role_assignments:
                try:
                    user_info = frappe.get_cached_value("User", assignment.user, 
                                                       ["full_name", "email", "user_image"], as_dict=True)
                    if user_info:
                        # Generate initials
                        full_name = user_info.get('full_name') or assignment.user
                        name_parts = full_name.split()
                        initials = ''.join([part[0].upper() for part in name_parts[:2]]) if name_parts else assignment.user[:2].upper()
                        
                        enriched_assignments.append({
                            'role': assignment.role,
                            'user': assignment.user,
                            'is_primary': assignment.is_primary,
                            'full_name': full_name,
                            'email': user_info.get('email', assignment.user),
                            'initials': initials,
                            'user_image': user_info.get('user_image')
                        })
                except Exception as e:
                    # If user info fails, still include basic assignment
                    enriched_assignments.append({
                        'role': assignment.role,
                        'user': assignment.user,
                        'is_primary': assignment.is_primary,
                        'full_name': assignment.user,
                        'email': assignment.user,
                        'initials': assignment.user[:2].upper()
                    })
            
            subtask['role_assignments'] = enriched_assignments
        
        return {
            'success': True,
            'subtasks': subtasks,
            'count': len(subtasks)
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting subtasks: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist()
def get_bulk_subtask_counts(task_ids):
    """Get subtask counts for multiple tasks"""
    try:
        if isinstance(task_ids, str):
            task_ids = frappe.parse_json(task_ids)
        
        subtask_counts = {}
        
        for task_id in task_ids:
            try:
                count = frappe.db.count("Task", {
                    "parent_task": task_id,
                    "custom_is_archived": ["!=", 1]  # Exclude archived subtasks from count
                })
                subtask_counts[task_id] = count
            except:
                subtask_counts[task_id] = 0
        
        return {
            'success': True,
            'subtask_counts': subtask_counts
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting bulk subtask counts: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

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
        new_task.custom_task_status = "Not Started"
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
        
        # Set other defaults (empty, let user choose)
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
def get_task_status_options():
    """
    Get available status options for Task doctype
    """
    try:
        # Get Task doctype meta to fetch custom_task_status field options
        task_meta = frappe.get_meta("Task")
        status_field = None
        
        for field in task_meta.fields:
            if field.fieldname == "custom_task_status":
                status_field = field
                break
        
        if status_field and hasattr(status_field, 'options') and status_field.options:
            # Split options by newline and clean them
            options = [opt.strip() for opt in status_field.options.split('\n') if opt.strip()]
            return {'success': True, 'status_options': options}
        else:
            # Fallback: Get existing values from database as options
            try:
                existing_statuses = frappe.db.sql("""
                    SELECT DISTINCT custom_task_status 
                    FROM `tabTask` 
                    WHERE custom_task_status IS NOT NULL 
                    AND custom_task_status != ''
                    ORDER BY custom_task_status
                """, as_list=True)
                
                if existing_statuses:
                    options = [status[0] for status in existing_statuses]
                    return {'success': True, 'status_options': options}
                else:
                    # Ultimate fallback if no data exists
                    return {'success': True, 'status_options': ['Not Started']}
            except Exception as fallback_error:
                frappe.log_error(f"Error getting existing status values: {str(fallback_error)}")
                return {'success': True, 'status_options': ['Not Started']}
            
    except Exception as e:
        frappe.log_error(f"Error getting task status options: {str(e)}")
        return {'success': False, 'error': str(e)}

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
def update_task_client(task_id, customer_id):
    """
    Update task's client association
    """
    try:
        task = frappe.get_doc("Task", task_id)
        task.flags.ignore_version = True
        
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

def get_primary_role_user(task_doc, role):
    """
    Get primary user for a specific role from sub-table
    """
    try:
        if not hasattr(task_doc, 'custom_roles') or not task_doc.custom_roles:
            return None
        
        # Map role names to sub-table format
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
    try:
        if not hasattr(task_doc, 'custom_roles') or not task_doc.custom_roles:
            return None
        
        # Map role names to sub-table format
        role_mapping = {
            'action_person': 'Action Person',
            'preparer': 'Preparer',
            'reviewer': 'Reviewer',
            'partner': 'Partner'
        }
        mapped_role = role_mapping.get(role, role)
        
        # Get all users in this role
        role_users = []
        for role_assignment in task_doc.custom_roles:
            if role_assignment.role == mapped_role:
                role_users.append(role_assignment.user)
        
        if not role_users:
            return None
        
        # Convert to user info format
        return get_user_info(','.join(role_users))
        
    except:
        return None

def get_primary_software(task_doc):
    """
    Get primary software from sub-table
    """
    try:
        if not hasattr(task_doc, 'custom_softwares') or not task_doc.custom_softwares:
            return None
        
        # Look for primary software
        for software_assignment in task_doc.custom_softwares:
            if software_assignment.is_primary:
                return software_assignment.software
        
        # If no primary found, return first software
        if task_doc.custom_softwares:
            return task_doc.custom_softwares[0].software
        
        return None
    except:
        return None

def get_software_info(task_doc):
    """
    Get all software assignments for display
    """
    try:
        if not hasattr(task_doc, 'custom_softwares') or not task_doc.custom_softwares:
            return None
        
        # Get all software assignments
        softwares = []
        for software_assignment in task_doc.custom_softwares:
            softwares.append({
                'software': software_assignment.software,
                'is_primary': software_assignment.is_primary
            })
        
        return softwares if softwares else None
        
    except:
        return None

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


@frappe.whitelist()
def get_task_comments(task_id):
    """
    Get all comments for a specific task using ERPNext's built-in Comment system
    """
    try:
        if not task_id:
            return {
                'success': False,
                'error': 'Task ID is required'
            }

        # Get comments from ERPNext's Comment doctype
        comments = frappe.get_all(
            'Comment',
            filters={
                'reference_doctype': 'Task',
                'reference_name': task_id,
                'comment_type': 'Comment'
            },
            fields=[
                'name', 'content', 'comment_by', 'comment_email', 
                'creation', 'modified', 'owner'
            ],
            order_by='creation asc'
        )
        
        # Process comments to add permission info
        processed_comments = []
        current_user = frappe.session.user
        
        for comment in comments:
            # Check if current user can edit/delete this comment
            can_edit = (comment.owner == current_user or 
                       frappe.has_permission('Comment', 'write', comment.name))
            can_delete = (comment.owner == current_user or 
                         frappe.has_permission('Comment', 'delete', comment.name))
            
            processed_comments.append({
                'name': comment.name,
                'content': comment.content,
                'comment_by': comment.comment_by or comment.owner,
                'comment_email': comment.comment_email,
                'creation': comment.creation,
                'modified': comment.modified,
                'can_edit': can_edit,
                'can_delete': can_delete
            })
        
        return {
            'success': True,
            'comments': processed_comments,
            'count': len(processed_comments)
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting task comments: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }


@frappe.whitelist()
def add_task_comment(task_id, comment_content):
    """
    Add a new comment to a task using ERPNext's Comment system
    """
    try:
        if not task_id or not comment_content:
            return {
                'success': False,
                'error': 'Task ID and comment content are required'
            }

        # Verify task exists
        if not frappe.db.exists('Task', task_id):
            return {
                'success': False,
                'error': 'Task not found'
            }

        # Create new comment using ERPNext's Comment doctype
        comment_doc = frappe.get_doc({
            'doctype': 'Comment',
            'comment_type': 'Comment',
            'reference_doctype': 'Task',
            'reference_name': task_id,
            'content': comment_content,
            'comment_email': frappe.session.user,
            'comment_by': frappe.get_cached_value('User', frappe.session.user, 'full_name') or frappe.session.user
        })
        
        comment_doc.insert(ignore_permissions=False)
        
        # Handle @mentions and send notifications
        handle_comment_mentions(comment_content, task_id, comment_doc.name)
        
        # 立即提交并清除缓存
        frappe.db.commit()
        frappe.clear_cache()
        
        # Get updated comment count by counting
        comment_count = frappe.db.count('Comment', {
            'reference_doctype': 'Task',
            'reference_name': task_id,
            'comment_type': 'Comment'
        })
        
        return {
            'success': True,
            'comment_id': comment_doc.name,
            'comment_count': comment_count,
            'message': 'Comment added successfully'
        }
        
    except Exception as e:
        frappe.log_error(f"Error adding task comment: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }


@frappe.whitelist()
def delete_task_comment(comment_id):
    """
    Delete a comment
    """
    try:
        if not comment_id:
            return {
                'success': False,
                'error': 'Comment ID is required'
            }

        # Get comment to verify permissions and get task info
        comment_doc = frappe.get_doc('Comment', comment_id)
        
        if not comment_doc:
            return {
                'success': False,
                'error': 'Comment not found'
            }
        
        # Check permissions - user can delete their own comments or if they have delete permission
        current_user = frappe.session.user
        if (comment_doc.owner != current_user and 
            not frappe.has_permission('Comment', 'delete', comment_id)):
            return {
                'success': False,
                'error': 'You do not have permission to delete this comment'
            }
        
        # Store task info before deletion
        task_id = comment_doc.reference_name
        
        # Delete the comment
        frappe.delete_doc('Comment', comment_id)
        
        # 立即提交并清除缓存
        frappe.db.commit()
        frappe.clear_cache()
        
        # Get updated comment count by counting
        comment_count = frappe.db.count('Comment', {
            'reference_doctype': 'Task',
            'reference_name': task_id,
            'comment_type': 'Comment'
        })
        
        return {
            'success': True,
            'comment_count': comment_count,
            'message': 'Comment deleted successfully'
        }
        
    except Exception as e:
        frappe.log_error(f"Error deleting task comment: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }


@frappe.whitelist()
def update_task_comment(comment_id, new_content):
    """
    Update/edit a comment
    """
    try:
        if not comment_id or not new_content:
            return {
                'success': False,
                'error': 'Comment ID and new content are required'
            }

        # Get comment to verify permissions
        comment_doc = frappe.get_doc('Comment', comment_id)
        
        if not comment_doc:
            return {
                'success': False,
                'error': 'Comment not found'
            }
        
        # Check permissions - user can edit their own comments or if they have write permission
        current_user = frappe.session.user
        if (comment_doc.owner != current_user and 
            not frappe.has_permission('Comment', 'write', comment_id)):
            return {
                'success': False,
                'error': 'You do not have permission to edit this comment'
            }
        
        # Update the comment
        comment_doc.content = new_content
        comment_doc.save()
        frappe.db.commit()
        
        return {
            'success': True,
            'message': 'Comment updated successfully'
        }
        
    except Exception as e:
        frappe.log_error(f"Error updating task comment: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }


def handle_comment_mentions(comment_content, task_id, comment_id):
    """
    Handle @mentions in comments and send notifications
    """
    import re
    
    # Extract @mentions from comment content
    mentions = re.findall(r'@(\w+(?:\.\w+)*)', comment_content)
    
    if not mentions:
        return
    
    # Get task info for context
    task = frappe.get_doc('Task', task_id)
    current_user = frappe.get_cached_value('User', frappe.session.user, 'full_name') or frappe.session.user
    
    for mention in mentions:
        try:
            # Find user by email or full name
            user_email = None
            
            # First try to find by email
            if frappe.db.exists('User', mention):
                user_email = mention
            else:
                # Try to find by full name or username
                users = frappe.get_all('User', 
                    filters={'full_name': ['like', f'%{mention}%']}, 
                    fields=['name', 'full_name']
                )
                if users:
                    user_email = users[0].name
            
            if user_email and user_email != frappe.session.user:
                # Create notification
                frappe.get_doc({
                    'doctype': 'Notification Log',
                    'for_user': user_email,
                    'type': 'Mention',
                    'document_type': 'Task',
                    'document_name': task_id,
                    'subject': f'{current_user} mentioned you in a comment on task: {task.subject}',
                    'email_content': f'''
                    <p>{current_user} mentioned you in a comment:</p>
                    <blockquote>{comment_content}</blockquote>
                    <p>Task: <a href="/app/task/{task_id}">{task.subject}</a></p>
                    ''',
                    'read': 0
                }).insert(ignore_permissions=True)
                
                # Also send email notification
                frappe.sendmail(
                    recipients=[user_email],
                    subject=f'You were mentioned in a comment on task: {task.subject}',
                    message=f'''
                    <p>Hi,</p>
                    <p>{current_user} mentioned you in a comment on task "{task.subject}":</p>
                    <blockquote style="border-left: 3px solid #0073ea; padding-left: 15px; margin: 15px 0; font-style: italic;">
                        {comment_content}
                    </blockquote>
                    <p><a href="{frappe.utils.get_url()}/app/task/{task_id}" style="background: #0073ea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Task</a></p>
                    <p>Best regards,<br>Smart Accounting Team</p>
                    ''',
                    now=True
                )
                
        except Exception as e:
            frappe.log_error(f"Error sending mention notification: {str(e)}")
            continue

@frappe.whitelist()
def sync_comment_counts():
    """
    Synchronize comment counts for all tasks - useful for data migration
    This method updates the custom_comment_count field based on actual comment counts
    """
    try:
        # Get all tasks
        tasks = frappe.get_all('Task', fields=['name'])
        updated_count = 0
        
        for task in tasks:
            task_id = task.name
            
            # Count actual comments
            actual_count = frappe.db.count('Comment', {
                'reference_doctype': 'Task',
                'reference_name': task_id,
                'comment_type': 'Comment'
            })
            
            # Update task's comment count field
            frappe.db.set_value('Task', task_id, 'custom_comment_count', actual_count)
            updated_count += 1
        
        frappe.db.commit()
        
        return {
            'success': True,
            'message': f'Successfully synchronized comment counts for {updated_count} tasks',
            'updated_count': updated_count
        }
        
    except Exception as e:
        frappe.log_error(f"Error synchronizing comment counts: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }


@frappe.whitelist()
def save_user_column_widths(column_widths, column_type="main_tasks"):
    """
    Save user's column width preferences to UserPreferences document
    High performance: uses dedicated DocType for user preferences
    Supports both main_tasks and subtasks column types
    """
    try:
        import json
        
        if not column_widths:
            return {'success': False, 'error': 'Column widths data required'}
        
        # Convert to JSON string if it's not already
        if isinstance(column_widths, dict):
            column_widths_json = json.dumps(column_widths)
        else:
            column_widths_json = column_widths
        
        # Check if UserPreferences record exists for current user
        existing = frappe.db.get_value("User Preferences", {"user": frappe.session.user})
        
        # Determine which field to update based on column_type
        field_name = 'subtask_column_widths' if column_type == 'subtasks' else 'column_widths'
        
        if existing:
            # Update existing record
            frappe.db.set_value('User Preferences', existing, field_name, column_widths_json)
        else:
            # Create new UserPreferences record
            user_prefs = frappe.new_doc("User Preferences")
            user_prefs.user = frappe.session.user
            if column_type == 'subtasks':
                user_prefs.subtask_column_widths = column_widths_json
            else:
                user_prefs.column_widths = column_widths_json
            user_prefs.insert(ignore_permissions=True)
        
        frappe.db.commit()
        
        return {
            'success': True,
            'message': f'{column_type.title()} column widths saved successfully'
        }
        
    except Exception as e:
        frappe.log_error(f"Error saving user {column_type} column widths: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist()
def load_user_column_widths(column_type="main_tasks"):
    """
    Load user's column width preferences from UserPreferences document
    High performance: dedicated DocType for user preferences
    Supports both main_tasks and subtasks column types
    """
    try:
        import json
        
        # Determine which field to load based on column_type
        field_name = 'subtask_column_widths' if column_type == 'subtasks' else 'column_widths'
        
        # Get column widths from UserPreferences document
        column_widths_json = frappe.db.get_value('User Preferences', 
                                                {'user': frappe.session.user}, 
                                                field_name)
        
        if column_widths_json:
            try:
                column_widths = json.loads(column_widths_json)
                return {
                    'success': True,
                    'column_widths': column_widths
                }
            except json.JSONDecodeError:
                # If JSON is corrupted, return default
                pass
        
        # Return default widths based on column type
        if column_type == 'subtasks':
            default_widths = {
                'name': 250,      # Task Name column
                'owner': 120,     # Owner column
                'status': 100,    # Status column  
                'due': 120,       # Due Date column
                'note': 180       # Note column
            }
        else:
            default_widths = {
                'client': 150,
                'entity': 100,
                'tf-tg': 80,
                'software': 120,
                'status': 100,
                'target-month': 120,
                'budget': 120,
                'actual': 120,
                'review-note': 120,
                'action-person': 130,
                'preparer': 120,
                'reviewer': 120,
                'partner': 120,
                'lodgment-due': 130,
                'year-end': 100,
                'last-updated': 130,
                'priority': 100
            }
        
        return {
            'success': True,
            'column_widths': default_widths
        }
        
    except Exception as e:
        frappe.log_error(f"Error loading user column widths: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }


@frappe.whitelist()
def check_task_fields(task_id):
    """
    Check what fields actually exist in Task
    """
    try:
        # Get Task meta to see actual fields
        task_meta = frappe.get_meta("Task")
        custom_fields = []
        table_fields = []
        
        for field in task_meta.fields:
            if field.fieldname.startswith('custom_'):
                if field.fieldtype == 'Table':
                    table_fields.append({
                        'fieldname': field.fieldname,
                        'options': field.options,
                        'label': field.label
                    })
                else:
                    custom_fields.append({
                        'fieldname': field.fieldname,
                        'fieldtype': field.fieldtype,
                        'label': field.label
                    })
        
        return {
            'success': True,
            'custom_fields': custom_fields,
            'table_fields': table_fields
        }
        
    except Exception as e:
        return {'success': False, 'error': str(e)}

@frappe.whitelist()
def test_task_subtables(task_id):
    """
    Test if Task sub-tables are properly configured
    """
    try:
        if not task_id:
            return {'success': False, 'error': 'Task ID is required'}
        
        # Get task document
        task_doc = frappe.get_doc("Task", task_id)
        
        # Check sub-table fields
        results = {}
        
        # Check custom_roles
        if hasattr(task_doc, 'custom_roles'):
            results['custom_roles'] = f"存在，当前有 {len(task_doc.custom_roles)} 条记录"
        else:
            results['custom_roles'] = "不存在"
            
        # Check custom_softwares  
        if hasattr(task_doc, 'custom_softwares'):
            results['custom_softwares'] = f"存在，当前有 {len(task_doc.custom_softwares)} 条记录"
        else:
            results['custom_softwares'] = "不存在"
            
        # Check custom_companies
        if hasattr(task_doc, 'custom_companies'):
            results['custom_companies'] = f"存在，当前有 {len(task_doc.custom_companies)} 条记录"
        else:
            results['custom_companies'] = "不存在"
        
        # Check if sub-table DocTypes exist
        subtable_doctypes = {}
        for doctype in ['Task Role Assignment', 'Task Software', 'Task Company Tag']:
            exists = frappe.db.exists('DocType', doctype)
            subtable_doctypes[doctype] = "存在" if exists else "不存在"
        
        return {
            'success': True,
            'task_id': task_id,
            'subtable_fields': results,
            'subtable_doctypes': subtable_doctypes
        }
        
    except Exception as e:
        frappe.log_error(f"Error testing task subtables: {str(e)}")
        return {'success': False, 'error': str(e)}

@frappe.whitelist()
def get_task_roles(task_id):
    """
    Get task role assignments from sub-table
    """
    try:
        if not task_id:
            return {'success': False, 'error': 'Task ID is required'}
        
        # Get roles from sub-table
        roles = frappe.get_all("Task Role Assignment",
            filters={"parent": task_id},
            fields=["role", "user", "is_primary"],
            order_by="is_primary desc, role, user"
        )
        
        return {
            'success': True,
            'roles': roles
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting task roles: {str(e)}")
        return {'success': False, 'error': str(e)}

@frappe.whitelist()
def set_task_roles(task_id, roles_data):
    """
    Set task role assignments and sync with legacy fields
    roles_data: [{"role": "preparer", "user": "john@example.com", "is_primary": True}, ...]
    """
    try:
        if not task_id:
            return {'success': False, 'error': 'Task ID is required'}
        
        import json
        if isinstance(roles_data, str):
            roles_data = json.loads(roles_data)
        
        # Get task document
        task_doc = frappe.get_doc("Task", task_id)
        
        # Check if custom_roles field exists
        if not hasattr(task_doc, 'custom_roles'):
            return {
                'success': False, 
                'error': 'Task Role Assignment sub-table not available. Please ensure custom_roles field is added to Task DocType.'
            }
        
        # Clear existing roles
        task_doc.custom_roles = []
        
        # Add new roles (clean sub-table only approach)
        for role_data in roles_data:
            role = role_data.get('role')
            user = role_data.get('user')
            is_primary = role_data.get('is_primary', False)
            
            if not role or not user:
                continue
            
            # Validate user exists and is enabled
            if not frappe.db.exists("User", user):
                print(f"DEBUG: User {user} does not exist, skipping")
                continue
                
            user_enabled = frappe.db.get_value("User", user, "enabled")
            if not user_enabled:
                print(f"DEBUG: User {user} is disabled, skipping")
                continue
                
            # Add to sub-table
            task_doc.append('custom_roles', {
                'role': role,
                'user': user,
                'is_primary': is_primary
            })
        
        task_doc.save()
        frappe.db.commit()
        
        # Count actually added roles
        actual_roles_added = len(task_doc.custom_roles)
        
        return {
            'success': True,
            'message': f'Task roles updated successfully. {actual_roles_added} roles assigned.',
            'roles_count': actual_roles_added,
            'requested_count': len(roles_data)
        }
        
    except Exception as e:
        frappe.log_error(f"Error setting task roles: {str(e)}")
        return {'success': False, 'error': str(e)}

@frappe.whitelist()
def get_software_options():
    """
    Get available software options from Task Software DocType
    """
    try:
        # Get software field options from Task Software DocType
        task_software_meta = frappe.get_meta("Task Software")
        software_field = None
        
        for field in task_software_meta.fields:
            if field.fieldname == "software":
                software_field = field
                break
        
        if software_field and hasattr(software_field, 'options') and software_field.options:
            # Split options by newline and clean them
            options = [opt.strip() for opt in software_field.options.split('\n') if opt.strip()]
            return {'success': True, 'software_options': options}
        else:
            # Fallback to default options if not configured
            return {
                'success': True, 
                'software_options': ['Xero', 'MYOB', 'QuickBooks', 'Excel', 'Payroller', 'Oracle', 'Logdit', 'Other']
            }
            
    except Exception as e:
        frappe.log_error(f"Error getting software options: {str(e)}")
        # Return default options on error
        return {
            'success': True,
            'software_options': ['Xero', 'MYOB', 'QuickBooks', 'Excel', 'Other']
        }

@frappe.whitelist()
def get_task_softwares(task_id):
    """
    Get task software assignments from sub-table
    """
    try:
        if not task_id:
            return {'success': False, 'error': 'Task ID is required'}
        
        # Get softwares from sub-table
        softwares = frappe.get_all("Task Software",
            filters={"parent": task_id},
            fields=["software", "is_primary"],
            order_by="is_primary desc, software"
        )
        
        return {
            'success': True,
            'softwares': softwares
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting task softwares: {str(e)}")
        return {'success': False, 'error': str(e)}

@frappe.whitelist()
def set_task_softwares(task_id, softwares_data):
    """
    Set task software assignments and sync with legacy field
    softwares_data: [{"software": "Xero", "is_primary": True}, ...]
    """
    try:
        if not task_id:
            return {'success': False, 'error': 'Task ID is required'}
        
        import json
        if isinstance(softwares_data, str):
            softwares_data = json.loads(softwares_data)
        
        # Get task document
        task_doc = frappe.get_doc("Task", task_id)
        
        # Clear existing softwares
        task_doc.custom_softwares = []
        
        # Add new softwares (clean sub-table only approach)
        for software_data in softwares_data:
            software = software_data.get('software')
            is_primary = software_data.get('is_primary', False)
            
            if not software:
                continue
                
            # Add to sub-table
            task_doc.append('custom_softwares', {
                'software': software,
                'is_primary': is_primary
            })
        
        task_doc.save()
        frappe.db.commit()
        
        return {
            'success': True,
            'message': 'Task softwares updated successfully',
            'softwares_count': len(softwares_data)
        }
        
    except Exception as e:
        frappe.log_error(f"Error setting task softwares: {str(e)}")
        return {'success': False, 'error': str(e)}

@frappe.whitelist()
def get_task_activity_log(task_id):
    """
    Get activity log for a specific task using ERPNext's Version system
    """
    try:
        if not task_id:
            return {
                'success': False,
                'error': 'Task ID is required'
            }

        # Get version history from ERPNext's Version doctype
        versions = frappe.get_all(
            'Version',
            filters={
                'ref_doctype': 'Task',
                'docname': task_id
            },
            fields=[
                'name', 'owner', 'creation', 'data'
            ],
            order_by='creation desc',
            limit=50
        )
        
        # Also get comments as activities
        comments = frappe.get_all(
            'Comment',
            filters={
                'reference_doctype': 'Task',
                'reference_name': task_id,
                'comment_type': 'Comment'
            },
            fields=[
                'name', 'content', 'comment_by', 'creation', 'owner'
            ],
            order_by='creation desc'
        )
        
        # Combine and sort activities
        activities = []
        
        # Add version changes
        for version in versions:
            activities.append({
                'type': 'change',
                'name': version.name,
                'owner': version.owner,
                'creation': version.creation,
                'data': version.data,
                'description': 'Task updated'
            })
        
        # Add comments
        for comment in comments:
            activities.append({
                'type': 'comment',
                'name': comment.name,
                'owner': comment.comment_by or comment.owner,
                'creation': comment.creation,
                'data': None,
                'description': f'Added comment: {comment.content[:50]}...' if len(comment.content) > 50 else f'Added comment: {comment.content}'
            })
        
        # Sort by creation time (newest first)
        activities.sort(key=lambda x: x['creation'], reverse=True)
        
        return {
            'success': True,
            'activities': activities,
            'count': len(activities)
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting task activity log: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist()
def get_review_notes(task_id):
    """Get all review notes for a task"""
    try:
        if not task_id:
            return {'success': False, 'error': 'Task ID is required'}
        
        # Get review notes from the custom_review_notes child table
        task_doc = frappe.get_doc('Task', task_id)
        review_notes = []
        
        if hasattr(task_doc, 'custom_review_notes') and task_doc.custom_review_notes:
            for i, review_note in enumerate(task_doc.custom_review_notes):
                # Handle both dict and object formats safely
                note_text = ''
                if hasattr(review_note, 'note'):
                    note_text = review_note.note
                elif isinstance(review_note, dict):
                    note_text = review_note.get('note', '')
                else:
                    note_text = str(review_note)
                
                review_notes.append({
                    'name': f"{task_id}-review-{i}",
                    'note': note_text,
                    'creation': frappe.utils.now(),
                    'owner': frappe.session.user,
                    'modified': frappe.utils.now(),
                    'created_by': frappe.get_cached_value('User', frappe.session.user, 'full_name') or frappe.session.user
                })
        
        return {
            'success': True,
            'review_notes': review_notes
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting review notes: {str(e)}")
        return {'success': False, 'error': str(e)}

@frappe.whitelist()
def add_review_note(task_id, note):
    """Add a new review note to a task"""
    try:
        if not task_id or not note:
            return {'success': False, 'error': 'Task ID and note are required'}
        
        # Check permissions
        if not can_add_review_note(task_id):
            return {'success': False, 'error': 'You do not have permission to add review notes'}
        
        # Get task document
        task_doc = frappe.get_doc('Task', task_id)
        
        # Add review note to child table - only use fields that exist in the child table
        task_doc.append('custom_review_notes', {
            'note': note
        })
        
        # Save task
        task_doc.save()
        frappe.db.commit()
        
        # Get updated count
        review_count = len(task_doc.custom_review_notes)
        
        return {
            'success': True,
            'message': 'Review note added successfully',
            'review_count': review_count
        }
        
    except Exception as e:
        frappe.log_error(f"Error adding review note: {str(e)}")
        return {'success': False, 'error': str(e)}

@frappe.whitelist()
def check_review_permissions(task_id):
    """Check if current user can add review notes"""
    try:
        can_add = can_add_review_note(task_id)
        return {'can_add_review': can_add}
    except Exception as e:
        frappe.log_error(f"Error checking review permissions: {str(e)}")
        return {'can_add_review': False}

def can_add_review_note(task_id):
    """Check if user has permission to add review notes"""
    try:
        # Check if user is Administrator
        if 'Administrator' in frappe.get_roles():
            return True
        
        # Check if user has System Manager role
        if 'System Manager' in frappe.get_roles():
            return True
            
        # Check if user has a reviewer role (you can customize this)
        user_roles = frappe.get_roles()
        reviewer_roles = ['Reviewer', 'Project Manager', 'Partner']  # Add your reviewer roles here
        
        if any(role in user_roles for role in reviewer_roles):
            return True
            
        # Check if user is assigned to the task in reviewer capacity
        task_doc = frappe.get_doc('Task', task_id)
        if hasattr(task_doc, 'custom_roles'):
            for role_assignment in task_doc.custom_roles:
                if role_assignment.user == frappe.session.user and role_assignment.role in ['Reviewer', 'Partner']:
                    return True
        
        return False
        
    except Exception as e:
        frappe.log_error(f"Error checking review permissions: {str(e)}")
        return False

@frappe.whitelist()
def get_bulk_review_counts(task_ids):
    """Get review note counts for multiple tasks at once"""
    try:
        if not task_ids:
            return {'success': False, 'error': 'Task IDs are required'}
        
        # Parse task_ids if it's a string
        if isinstance(task_ids, str):
            import json
            task_ids = json.loads(task_ids)
        
        review_counts = {}
        
        for task_id in task_ids:
            try:
                task_doc = frappe.get_doc('Task', task_id)
                count = 0
                
                if hasattr(task_doc, 'custom_review_notes') and task_doc.custom_review_notes:
                    # Count non-empty review notes
                    for review_note in task_doc.custom_review_notes:
                        note_text = ''
                        if hasattr(review_note, 'note'):
                            note_text = review_note.note
                        elif isinstance(review_note, dict):
                            note_text = review_note.get('note', '')
                        
                        if note_text and note_text.strip():
                            count += 1
                
                review_counts[task_id] = count
            except:
                review_counts[task_id] = 0
        
        return {
            'success': True,
            'review_counts': review_counts
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting bulk review counts: {str(e)}")
        return {'success': False, 'error': str(e)}

@frappe.whitelist()
def get_engagement_info(task_id, engagement_id=None):
    """
    Get engagement information for a task
    """
    try:
        # Get task document
        task = frappe.get_doc("Task", task_id)
        
        # If engagement_id provided, use it; otherwise get from task
        engagement_id = engagement_id or getattr(task, 'custom_engagement', None)
        
        if not engagement_id:
            return {
                'success': False,
                'message': 'No engagement linked to this task'
            }
        
        # Get engagement document with minimal field access
        try:
            engagement = frappe.get_doc("Engagement", engagement_id)
        except:
            return {
                'success': False,
                'error': 'Engagement not found or no access permission'
            }
        
        # Count engagement letters (assuming they are stored as attachments)
        engagement_letters = []
        el_count = 0
        
        try:
            # Get file attachments for this engagement
            files = frappe.get_all("File", 
                filters={
                    "attached_to_doctype": "Engagement",
                    "attached_to_name": engagement_id
                },
                fields=["file_name", "file_url"]
            )
            
            for file in files:
                engagement_letters.append({
                    'file_name': file.file_name,
                    'file_url': file.file_url
                })
            
            el_count = len(engagement_letters)
        except:
            # If file access fails, just set count to 0
            el_count = 0
        
        # Prepare engagement info - dynamically get all fields for extensibility
        engagement_info = {
            'name': engagement.name,
            'customer': getattr(engagement, 'customer', None),
            'customer_name': '',
            'company': getattr(engagement, 'company', None),
            'company_name': '',
            'service_line': getattr(engagement, 'service_line', None),
            'service_line_name': '',
            'frequency': getattr(engagement, 'frequency', None),
            'fiscal_year': getattr(engagement, 'fiscal_year', None),
            'fiscal_year_name': '',
            'engagement_letter': getattr(engagement, 'engagement_letter', None),
            'owner_partner': getattr(engagement, 'owner_partner', None),
            'owner_partner_name': '',
            'primary_contact': getattr(engagement, 'primary_contact', None),
            'accounting_contact': getattr(engagement, 'accounting_contact', None),
            'tax_contact': getattr(engagement, 'tax_contact', None),
            'grants_contact': getattr(engagement, 'grants_contact', None)
        }
        
        # Get display names for linked fields
        try:
            if engagement_info['customer']:
                customer_doc = frappe.get_doc("Customer", engagement_info['customer'])
                engagement_info['customer_name'] = customer_doc.customer_name
        except:
            engagement_info['customer_name'] = engagement_info['customer'] or 'Unknown Customer'
        
        try:
            if engagement_info['company']:
                company_doc = frappe.get_doc("Company", engagement_info['company'])
                engagement_info['company_name'] = company_doc.company_name
        except:
            engagement_info['company_name'] = engagement_info['company'] or 'Unknown Company'
        
        try:
            if engagement_info['service_line']:
                service_line_doc = frappe.get_doc("Service Line", engagement_info['service_line'])
                engagement_info['service_line_name'] = service_line_doc.service_line_name if hasattr(service_line_doc, 'service_line_name') else engagement_info['service_line']
        except:
            engagement_info['service_line_name'] = engagement_info['service_line'] or 'Not specified'
        
        try:
            if engagement_info['fiscal_year']:
                fiscal_year_doc = frappe.get_doc("Fiscal Year", engagement_info['fiscal_year'])
                engagement_info['fiscal_year_name'] = fiscal_year_doc.year if hasattr(fiscal_year_doc, 'year') else engagement_info['fiscal_year']
        except:
            engagement_info['fiscal_year_name'] = engagement_info['fiscal_year'] or 'Not specified'
        
        try:
            if engagement_info['owner_partner']:
                user_doc = frappe.get_doc("User", engagement_info['owner_partner'])
                engagement_info['owner_partner_name'] = user_doc.full_name or user_doc.name
        except:
            engagement_info['owner_partner_name'] = engagement_info['owner_partner'] or 'Not assigned'
        
        return {
            'success': True,
            'engagement_info': engagement_info,
            'engagement_letters': engagement_letters,
            'el_count': el_count
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting engagement info: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist()
def upload_engagement_file(engagement_id, file_content, file_name):
    """
    Upload a file to an engagement and attach it
    """
    try:
        if not engagement_id or not file_content or not file_name:
            return {
                'success': False,
                'error': 'Engagement ID, file content and file name are required'
            }
        
        # Verify engagement exists
        if not frappe.db.exists('Engagement', engagement_id):
            return {
                'success': False,
                'error': 'Engagement not found'
            }
        
        # Create file record
        file_doc = frappe.get_doc({
            'doctype': 'File',
            'file_name': file_name,
            'attached_to_doctype': 'Engagement',
            'attached_to_name': engagement_id,
            'content': file_content,
            'is_private': 0
        })
        
        file_doc.insert(ignore_permissions=False)
        frappe.db.commit()
        
        return {
            'success': True,
            'file_url': file_doc.file_url,
            'file_name': file_doc.file_name,
            'message': 'File uploaded successfully'
        }
        
    except Exception as e:
        frappe.log_error(f"Error uploading engagement file: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist()
def delete_engagement_file(file_name, engagement_id):
    """
    Delete a file attached to an engagement
    """
    try:
        if not file_name or not engagement_id:
            return {
                'success': False,
                'error': 'File name and engagement ID are required'
            }
        
        # Find the file by name and attachment info
        files = frappe.get_all("File", 
            filters={
                'file_name': file_name,
                'attached_to_doctype': 'Engagement',
                'attached_to_name': engagement_id
            },
            fields=['name']
        )
        
        if files:
            file_name_to_delete = files[0].name
            frappe.delete_doc("File", file_name_to_delete)
            frappe.db.commit()
            
            return {
                'success': True,
                'message': 'File deleted successfully'
            }
        else:
            return {
                'success': False,
                'error': 'File not found'
            }
        
    except Exception as e:
        frappe.log_error(f"Error deleting engagement file: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist()
def batch_delete_tasks(task_ids):
    """
    Batch delete multiple tasks
    """
    if not task_ids:
        return {'success': False, 'error': 'No task IDs provided'}
    
    if isinstance(task_ids, str):
        import json
        try:
            task_ids = json.loads(task_ids)
        except:
            task_ids = [task_ids]
    
    if not isinstance(task_ids, list):
        task_ids = [task_ids]
    
    success_count = 0
    errors = []
    
    for task_id in task_ids:
        try:
            # Check if task exists and user has permission
            if not frappe.db.exists("Task", task_id):
                errors.append(f"Task {task_id} not found")
                continue
                
            # Check permissions
            if not frappe.has_permission("Task", "delete", task_id):
                errors.append(f"No permission to delete task {task_id}")
                continue
            
            # Delete the task
            frappe.delete_doc("Task", task_id, ignore_permissions=False)
            success_count += 1
            
        except Exception as e:
            errors.append(f"Error deleting task {task_id}: {str(e)}")
    
    frappe.db.commit()
    
    return {
        'success': True,
        'success_count': success_count,
        'errors': errors,
        'total_processed': len(task_ids)
    }

# Removed get_excluded_task_statuses() function - now showing all customer tasks
# This allows management of all tasks including "Hold" and "Not Trading" statuses

@frappe.whitelist()
def batch_archive_tasks(task_ids):
    """
    Batch archive multiple tasks by setting custom_is_archived = 1
    """
    if not task_ids:
        return {'success': False, 'error': 'No task IDs provided'}
    
    if isinstance(task_ids, str):
        import json
        try:
            task_ids = json.loads(task_ids)
        except:
            task_ids = [task_ids]
    
    if not isinstance(task_ids, list):
        task_ids = [task_ids]
    
    success_count = 0
    errors = []
    
    for task_id in task_ids:
        try:
            # Check if task exists and user has permission
            if not frappe.db.exists("Task", task_id):
                errors.append(f"Task {task_id} not found")
                continue
                
            # Check permissions
            if not frappe.has_permission("Task", "write", task_id):
                errors.append(f"No permission to modify task {task_id}")
                continue
            
            # Archive the task by setting custom_is_archived = 1
            frappe.db.set_value("Task", task_id, "custom_is_archived", 1)
            success_count += 1
            
        except Exception as e:
            errors.append(f"Error archiving task {task_id}: {str(e)}")
    
    frappe.db.commit()
    
    return {
        'success': True,
        'success_count': success_count,
        'errors': errors,
        'total_processed': len(task_ids)
    }

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

@frappe.whitelist()
def get_automation_count():
    """
    Get count of automations (placeholder for future automation system)
    """
    try:
        # For now, return a placeholder count
        # In the future, this would count actual automation records
        # Example: automation_count = frappe.db.count('Automation', {'is_active': 1})
        automation_count = 0  # Placeholder count
        
        return {
            'success': True,
            'count': automation_count
        }
    except Exception as e:
        frappe.log_error(f"Error getting automation count: {str(e)}")
        return {
            'success': False,
            'error': str(e),
            'count': 0
        }
