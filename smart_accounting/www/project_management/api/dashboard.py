# Smart Accounting - Dashboard API
# Dashboard数据API模块，提供主页和工作区概览数据

import frappe
from frappe import _


def get_main_dashboard_data():
    """
    Get overview data for main dashboard - show all workspaces and top-level boards
    
    OPTIMIZED: Uses batch queries instead of N+1 queries
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
        
        if not top_partitions:
            return {
                'organized_data': {'workspaces': [], 'boards': []},
                'total_projects': 0,
                'total_tasks': 0,
                'is_main_dashboard': True
            }
        
        # 🚀 BATCH QUERY 1: Get project counts for all partitions in one query
        partition_names = [p.name for p in top_partitions]
        partition_placeholder = ','.join(['%s'] * len(partition_names))
        
        project_counts = frappe.db.sql(f"""
            SELECT custom_partition, COUNT(*) as count
            FROM `tabProject`
            WHERE custom_partition IN ({partition_placeholder})
            AND status != 'Cancelled'
            GROUP BY custom_partition
        """, partition_names, as_dict=True)
        
        # Create project count map
        project_count_map = {pc.custom_partition: pc['count'] for pc in project_counts}
        
        # 🚀 BATCH QUERY 2: Get task counts for all partitions in one query
        task_counts = frappe.db.sql(f"""
            SELECT p.custom_partition, COUNT(t.name) as count
            FROM `tabTask` t
            INNER JOIN `tabProject` p ON t.project = p.name
            WHERE p.custom_partition IN ({partition_placeholder})
            AND p.status != 'Cancelled'
            AND t.status != 'Cancelled'
            GROUP BY p.custom_partition
        """, partition_names, as_dict=True)
        
        # Create task count map
        task_count_map = {tc.custom_partition: tc['count'] for tc in task_counts}
        
        # Organize into workspaces and boards using cached counts
        workspaces = []
        boards = []
        
        for partition in top_partitions:
            partition_data = {
                'name': partition.name,
                'partition_name': partition.partition_name,
                'description': partition.description or '',
                'icon': partition.icon or ('fa-th-large' if partition.is_workspace else 'fa-table'),
                'project_count': project_count_map.get(partition.name, 0),
                'task_count': task_count_map.get(partition.name, 0),
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


def get_workspace_overview_data(workspace_name):
    """
    Get overview data for a workspace (shows child boards, not individual tasks)
    
    OPTIMIZED: Uses batch queries instead of N+1 queries
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
        
        if not child_boards:
            return {
                'organized_data': {
                    'workspaces': [],
                    'boards': []
                },
                'total_projects': 0,
                'total_tasks': 0,
                'is_workspace_view': True,
                'is_main_dashboard': True,
                'workspace_name': workspace_name
            }
        
        # 🚀 BATCH QUERY 1: Get project counts for all boards in one query
        board_names = [b.name for b in child_boards]
        board_placeholder = ','.join(['%s'] * len(board_names))
        
        project_counts = frappe.db.sql(f"""
            SELECT custom_partition, COUNT(*) as count
            FROM `tabProject`
            WHERE custom_partition IN ({board_placeholder})
            AND status != 'Cancelled'
            GROUP BY custom_partition
        """, board_names, as_dict=True)
        
        # Create project count map
        project_count_map = {pc.custom_partition: pc['count'] for pc in project_counts}
        
        # 🚀 BATCH QUERY 2: Get task counts for all boards in one query
        task_counts = frappe.db.sql(f"""
            SELECT p.custom_partition, COUNT(t.name) as count
            FROM `tabTask` t
            INNER JOIN `tabProject` p ON t.project = p.name
            WHERE p.custom_partition IN ({board_placeholder})
            AND p.status != 'Cancelled'
            AND t.status != 'Cancelled'
            GROUP BY p.custom_partition
        """, board_names, as_dict=True)
        
        # Create task count map
        task_count_map = {tc.custom_partition: tc['count'] for tc in task_counts}
        
        # Build boards list using cached counts
        boards_list = []
        total_projects = 0
        total_tasks = 0
        
        for board in child_boards:
            project_count = project_count_map.get(board.name, 0)
            task_count = task_count_map.get(board.name, 0)
            
            boards_list.append({
                'name': board.name,
                'partition_name': board.partition_name,
                'description': board.description or '',
                'project_count': project_count,
                'task_count': task_count,
                'icon': board.icon or 'fa-table',
                'is_workspace': False
            })
            
            total_projects += project_count
            total_tasks += task_count
        
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


def get_workspace_title(view):
    """
    Get the title for a workspace/partition view
    """
    if view == 'main':
        return 'Project Management'
    
    try:
        partition = frappe.get_doc("Partition", view)
        return partition.partition_name or view
    except:
        return view

