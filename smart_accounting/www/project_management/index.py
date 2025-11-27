import frappe
from frappe import _
from collections import defaultdict
import re
import json
from datetime import datetime

# =============================================================================
# 🏗️ MODULAR ARCHITECTURE - Import from submodules
# =============================================================================

# Services (Cache, Formatters)
from .services.cache import (
    get_company_cache, 
    get_company_abbreviation,
    get_user_cache,
    get_cached_user_info
)
from .services.formatters import (
    format_date_for_display,
    get_initials,
    format_currency,
    truncate_text
)

# API modules - All imports
from .api.dashboard import (
    get_main_dashboard_data,
    get_workspace_overview_data,
    get_workspace_title
)
from .api.tasks import (
    update_task_status,
    update_task_field,
    update_task_client,
    create_subtask,
    get_subtasks,
    get_task_status_options,
    archive_task,
    unarchive_task
)
from .api.partitions import (
    create_partition,
    archive_partition,
    get_child_partitions,
    get_available_workspaces,
    get_all_partitions,
    update_partition_columns,
    get_partition_config,
    get_default_subtask_column_config
)
from .api.roles import (
    get_task_roles,
    update_task_roles,
    add_role_assignment,
    remove_role_assignment,
    set_primary_role,
    get_user_display_info,
    get_bulk_roles_info,
    get_primary_role_user,
    get_role_users_info
)
from .api.comments import (
    get_task_comments,
    add_task_comment,
    delete_task_comment,
    update_task_comment,
    sync_comment_counts
)
from .api.software import (
    get_software_options,
    get_task_softwares,
    set_task_softwares,
    get_primary_software,
    get_software_info
)
from .api.clients import (
    get_all_clients,
    get_client_details,
    create_client,
    update_client,
    delete_client,
    search_customers,
    quick_create_customer,
    get_client_groups,
    get_client_contacts
)
from .api.projects import (
    get_project_form_data,
    create_project,
    get_project_details,
    update_project,
    delete_project,
    get_projects_by_partition
)
from .api.engagement import (
    get_engagement_info,
    upload_engagement_file,
    delete_engagement_file,
    get_review_notes,
    add_review_note,
    get_bulk_review_counts
)
from .api.columns import (
    get_partition_column_config,
    save_partition_column_config,
    save_partition_column_width,
    save_user_column_widths,
    load_user_column_widths,
    get_all_task_columns,
    get_subtask_column_config,
    save_subtask_column_config
)
from .api.combination import (
    get_available_boards_for_combination,
    save_combination_view,
    get_saved_combinations,
    load_combination_view,
    delete_combination_view,
    get_combination_view_data
)
from .api.data import (
    load_partition_data,
    get_data_count,
    get_paginated_data,
    get_companies_for_tftg,
    get_field_options
)

# =============================================================================
# 🔄 LEGACY CODE BELOW - Core data loading functions remain here
# =============================================================================

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
    
    # Add user role information for template use
    try:
        current_user = frappe.session.user
        user_roles = frappe.get_roles() if current_user != 'Guest' else []
        context.user_roles = user_roles
        context.is_administrator = current_user == 'Administrator'
        context.is_system_manager = 'System Manager' in user_roles
        context.can_access_dev_system = context.is_administrator or context.is_system_manager
    except (AttributeError, frappe.AuthenticationError) as e:
        # Handle specific expected exceptions only
        frappe.log_error(f"Error getting user roles in context: {str(e)}")
        context.user_roles = []
        context.is_administrator = False
        context.is_system_manager = False
        context.can_access_dev_system = False
    
    return context

def get_workspace_title(view):
    """Get title based on partition view"""
    if view == 'main':
        return 'Main Dashboard'
    
    try:
        # Get partition name
        partition_name = frappe.db.get_value("Partition", view, "partition_name")
        # Debug info removed for performance
        return partition_name if partition_name else view.replace('_', ' ').title()
    except Exception as e:
        # Silently handle main view without logging error
        if view != 'main':
            frappe.log_error(f"Error getting workspace title: {str(e)}")
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
            
        # Debug info removed for performance
        return views
        
    except Exception as e:
        frappe.log_error(f"Error getting partitions: {str(e)}")
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
def create_partition(partition_name, is_workspace=False, parent_partition=None, description="", icon="", board_display_type="Task-Centric"):
    """
    Create a new partition (workspace or board)
    """
    try:
        import json
        # Ensure is_workspace is properly converted to boolean
        is_workspace = frappe.utils.cint(is_workspace) if is_workspace is not None else False
        # Debug info removed for performance
        
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
        
        # Board display type removed - simplified to task-centric only
        if not is_workspace and board_display_type:
            # Validate display type
            valid_types = ["Task-Centric", "Contact-Centric", "Client-Centric"]
            if board_display_type in valid_types:
                new_partition.board_display_type = board_display_type
            else:
                new_partition.board_display_type = "Task-Centric"  # Default fallback
        elif not is_workspace:
            new_partition.board_display_type = "Task-Centric"  # Default for boards
        
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
                    # 继承subtask配置
                    default_config = get_default_subtask_column_config()
                    new_partition.subtask_visible_columns = getattr(parent_doc, 'subtask_visible_columns', None) or json.dumps(default_config['default_visible_columns'])
                    new_partition.subtask_column_config = getattr(parent_doc, 'subtask_column_config', None) or json.dumps({"column_order": default_config['default_column_order'], "primary_column": default_config['primary_column']})
                else:
                    # Use comprehensive default columns including new ones
                    default_columns = ["client", "task-name", "entity", "tf-tg", "software", "communication-methods", "client-contact", "status", "note", "target-month", "budget", "actual", "review-note", "action-person", "preparer", "reviewer", "partner", "lodgment-due", "engagement", "group", "year-end", "last-updated", "priority", "frequency", "reset-date"]
                    new_partition.visible_columns = json.dumps(default_columns)
                    new_partition.column_config = json.dumps({"column_order": default_columns})
                    # 设置默认subtask配置
                    default_config = get_default_subtask_column_config()
                    new_partition.subtask_visible_columns = json.dumps(default_config['default_visible_columns'])
                    new_partition.subtask_column_config = json.dumps({"column_order": default_config['default_column_order'], "primary_column": default_config['primary_column']})
            except:
                # Use comprehensive default columns including new ones
                default_columns = ["client", "task-name", "entity", "tf-tg", "software", "communication-methods", "client-contact", "status", "note", "target-month", "budget", "actual", "review-note", "action-person", "preparer", "reviewer", "partner", "lodgment-due", "engagement", "group", "year-end", "last-updated", "priority", "frequency", "reset-date"]
                new_partition.visible_columns = json.dumps(default_columns)
                new_partition.column_config = json.dumps({"column_order": default_columns})
                # 设置默认subtask配置
                default_config = get_default_subtask_column_config()
                new_partition.subtask_visible_columns = json.dumps(default_config['default_visible_columns'])
                new_partition.subtask_column_config = json.dumps({"column_order": default_config['default_column_order'], "primary_column": default_config['primary_column']})
        else:
            # Default columns for new top-level partition - use comprehensive list including new ones
            default_columns = ["client", "task-name", "entity", "tf-tg", "software", "communication-methods", "client-contact", "status", "note", "target-month", "budget", "actual", "review-note", "action-person", "preparer", "reviewer", "partner", "lodgment-due", "engagement", "group", "year-end", "last-updated", "priority", "frequency", "reset-date"]
            new_partition.visible_columns = json.dumps(default_columns)
            new_partition.column_config = json.dumps({"column_order": default_columns})
            # 设置默认subtask配置
            default_config = get_default_subtask_column_config()
            new_partition.subtask_visible_columns = json.dumps(default_config['default_visible_columns'])
            new_partition.subtask_column_config = json.dumps({"column_order": default_config['default_column_order'], "primary_column": default_config['primary_column']})
        
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
def update_all_partitions_with_new_column():
    """
    自动为所有Partition添加新列配置（如Process Date）
    """
    try:
        import json
        
        # 获取所有partition
        partitions = frappe.get_all("Partition", 
                                  fields=["name", "partition_name", "visible_columns", "column_config"])
        
        if not partitions:
            return {
                'success': True,
                'message': 'No partitions found',
                'updated_count': 0
            }
        
        updated_count = 0
        
        for partition_data in partitions:
            try:
                # 获取partition文档
                partition_doc = frappe.get_doc("Partition", partition_data['name'])
                
                # 解析现有配置
                visible_columns_raw = getattr(partition_doc, 'visible_columns', None)
                column_config_raw = getattr(partition_doc, 'column_config', None)
                
                try:
                    visible_columns = json.loads(visible_columns_raw) if visible_columns_raw else []
                    column_config = json.loads(column_config_raw) if column_config_raw else {}
                except json.JSONDecodeError:
                    visible_columns = []
                    column_config = {}
                
                # 获取当前列顺序
                column_order = column_config.get('column_order', [])
                
                # 如果没有列顺序，使用默认顺序
                if not column_order:
                    column_order = [
                        'client', 'task-name', 'entity', 'tf-tg', 'software', 'communication-methods', 
                        'client-contact', 'status', 'note', 'target-month', 'budget', 'actual', 
                        'review-note', 'action-person', 'preparer', 'reviewer', 'partner', 
                        'lodgment-due', 'engagement', 'group', 'year-end', 'last-updated', 
                        'priority', 'frequency', 'reset-date'
                    ]
                
                # 检查是否需要添加process-date
                needs_update = False
                if 'process-date' not in column_order:
                    # 在lodgment-due前面插入process-date
                    new_order = []
                    process_date_inserted = False
                    
                    for column in column_order:
                        if column == 'lodgment-due' and not process_date_inserted:
                            new_order.append('process-date')
                            process_date_inserted = True
                        
                        if column != 'process-date':  # 避免重复
                            new_order.append(column)
                    
                    # 如果没有找到lodgment-due，在partner后面添加
                    if not process_date_inserted:
                        if 'partner' in new_order:
                            partner_index = new_order.index('partner')
                            new_order.insert(partner_index + 1, 'process-date')
                        else:
                            new_order.append('process-date')
                    
                    column_order = new_order
                    needs_update = True
                
                # 如果需要更新，保存配置
                if needs_update:
                    column_config['column_order'] = column_order
                    partition_doc.column_config = json.dumps(column_config, ensure_ascii=False)
                    partition_doc.save()
                    updated_count += 1
                    
            except Exception as e:
                frappe.log_error(f"Error updating partition {partition_data['name']}: {str(e)}")
                continue
        
        # 提交更改
        frappe.db.commit()
        
        return {
            'success': True,
            'message': f'Successfully updated {updated_count} partitions with Process Date column',
            'updated_count': updated_count,
            'total_partitions': len(partitions)
        }
        
    except Exception as e:
        frappe.db.rollback()
        frappe.log_error(f"Error in update_all_partitions_with_new_column: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist()
def update_single_partition_columns(partition_name):
    """
    Update column configuration for a single partition by adding missing columns
    """
    try:
        import json
        
        # Main view doesn't require updates
        if partition_name == 'main':
            return {
                'success': True,
                'updated': False,
                'message': 'Main view does not require column updates'
            }
        
        # Check if partition exists
        if not frappe.db.exists("Partition", partition_name):
            return {
                'success': False,
                'error': f'Partition "{partition_name}" not found'
            }
        
        # 获取partition文档
        partition_doc = frappe.get_doc("Partition", partition_name)
        
        # 解析现有配置
        visible_columns_raw = getattr(partition_doc, 'visible_columns', None)
        column_config_raw = getattr(partition_doc, 'column_config', None)
        
        try:
            visible_columns = json.loads(visible_columns_raw) if visible_columns_raw else []
            column_config = json.loads(column_config_raw) if column_config_raw else {}
        except json.JSONDecodeError:
            visible_columns = []
            column_config = {}
        
        # 获取当前列顺序
        column_order = column_config.get('column_order', [])
        
        # 定义最新的完整列列表（包含所有新增的列）
        latest_columns = [
            'client', 'task-name', 'entity', 'tf-tg', 'software', 'communication-methods', 
            'client-contact', 'status', 'note', 'target-month', 'budget', 'actual', 
            'review-note', 'action-person', 'preparer', 'reviewer', 'partner', 
            'process-date', 'lodgment-due', 'engagement', 'group', 'year-end', 
            'last-updated', 'priority', 'frequency', 'reset-date'
        ]
        
        # 如果没有列顺序，使用最新的完整列表
        if not column_order:
            column_order = latest_columns.copy()
            needs_update = True
            added_columns = latest_columns.copy()
        else:
            # 找出缺失的列
            missing_columns = [col for col in latest_columns if col not in column_order]
            added_columns = []
            
            if missing_columns:
                # 智能插入缺失的列到合适的位置
                new_order = column_order.copy()
                
                for missing_col in missing_columns:
                    # 根据列的类型插入到合适的位置
                    if missing_col == 'process-date':
                        # process-date插入到lodgment-due前面
                        if 'lodgment-due' in new_order:
                            lodgment_index = new_order.index('lodgment-due')
                            new_order.insert(lodgment_index, missing_col)
                        elif 'partner' in new_order:
                            partner_index = new_order.index('partner')
                            new_order.insert(partner_index + 1, missing_col)
                        else:
                            new_order.append(missing_col)
                    else:
                        # 其他新列按照最新列表的顺序插入
                        latest_index = latest_columns.index(missing_col)
                        
                        # 找到在new_order中最接近的位置
                        insert_position = len(new_order)
                        for i, existing_col in enumerate(new_order):
                            if existing_col in latest_columns:
                                existing_index = latest_columns.index(existing_col)
                                if existing_index > latest_index:
                                    insert_position = i
                                    break
                        
                        new_order.insert(insert_position, missing_col)
                    
                    added_columns.append(missing_col)
                
                column_order = new_order
                needs_update = True
            else:
                needs_update = False
        
        # 如果需要更新，保存配置
        if needs_update:
            column_config['column_order'] = column_order
            partition_doc.column_config = json.dumps(column_config, ensure_ascii=False)
            partition_doc.save()
            frappe.db.commit()
            
            return {
                'success': True,
                'updated': True,
                'added_columns': added_columns,
                'message': f'Successfully added {len(added_columns)} new columns to partition {partition_name}'
            }
        else:
            return {
                'success': True,
                'updated': False,
                'message': 'Partition configuration is already up to date'
            }
            
    except Exception as e:
        frappe.db.rollback()
        frappe.log_error(f"Error in update_single_partition_columns: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist(allow_guest=False)
def get_partition_column_config(partition_name):
    """Get column configuration for a specific partition"""
    try:
        # Log the request for debugging
        frappe.logger().info(f"Getting column config for partition: {partition_name}, User: {frappe.session.user}")
        
        if partition_name == 'main':
            # Default configuration for main view - show all current columns
            # 使用动态的默认列配置而不是硬编码
            default_visible_columns = [
                'client', 'task-name', 'entity', 'tf-tg', 'software', 'communication-methods', 'client-contact', 'status', 'note', 
                'target-month', 'budget', 'actual', 'review-note', 'action-person', 
                'preparer', 'reviewer', 'partner', 'lodgment-due', 'engagement', 'group', 
                'year-end', 'last-updated', 'priority', 'frequency', 'reset-date'
            ]
            result = {
                'success': True,
                'visible_columns': default_visible_columns,
                'column_config': {
                    'column_order': default_visible_columns,  # 提供默认排序
                    'primary_column': 'client'  # 默认主列
                }
            }
            frappe.logger().info(f"Returning main config: {result}")
            return result
        
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
                'client', 'task-name', 'entity', 'tf-tg', 'software', 'communication-methods', 'client-contact', 'status', 'note', 
                'target-month', 'budget', 'actual', 'review-note', 'action-person', 'preparer', 
                'reviewer', 'partner', 'lodgment-due', 'engagement', 'group', 'year-end', 
                'last-updated', 'priority', 'frequency', 'reset-date'
            ]
            
        # 确保column_config包含默认的列顺序和主列
        if not column_config.get('column_order'):
            column_config['column_order'] = visible_columns.copy()
        if not column_config.get('primary_column'):
            column_config['primary_column'] = 'client'  # 默认主列
        
        return {
            'success': True,
            'visible_columns': visible_columns,
            'column_config': column_config
        }
        
    except Exception as e:
        error_msg = f"Error getting partition column config for '{partition_name}': {str(e)}"
        frappe.logger().error(error_msg)
        frappe.log_error(error_msg, "Column Config Error")
        return {
            'success': False,
            'error': str(e),
            'partition_name': partition_name,
            'visible_columns': ['client', 'task-name', 'entity', 'tf-tg', 'software', 'communication-methods', 'client-contact', 'status', 'note', 'target-month', 'budget', 'actual', 'review-note', 'action-person', 'preparer', 'reviewer', 'partner', 'lodgment-due', 'engagement', 'group', 'year-end', 'last-updated', 'priority', 'frequency', 'reset-date'],
            'column_config': {}
        }

@frappe.whitelist()
def save_partition_column_width(partition_id, column_name, width):
    """
    Save column width for a specific partition
    """
    try:
        # Get existing column config
        config = get_partition_column_config(partition_id)
        
        # Update column width
        if 'column_widths' not in config:
            config['column_widths'] = {}
        
        config['column_widths'][column_name] = int(width)
        
        # Save back to database
        save_partition_column_config(partition_id, config.get('visible_columns', []), config)
        
        return {
            'success': True,
            'message': 'Column width saved successfully'
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
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
                'client', 'task-name', 'entity', 'tf-tg', 'software', 'communication-methods', 'client-contact', 'status', 'note', 
                'target-month', 'budget', 'actual', 'review-note', 'action-person', 'preparer', 
                'reviewer', 'partner', 'lodgment-due', 'engagement', 'group', 'year-end', 
                'last-updated', 'priority', 'frequency', 'reset-date'
            ]
            return {
                'success': True,
                'message': 'Main view uses default configuration (not saved)',
                'visible_columns': default_columns,
                'column_config': {
                    'column_order': default_columns,
                    'primary_column': 'client'
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
def load_partition_data(view='main', enable_adaptive_loading=True):
    """
    Load project data for specific partition (called by JavaScript)
    """
    try:
        # 检查是否需要自适应加载
        if enable_adaptive_loading:
            total_count = get_data_count_internal(view)
            
            if total_count > 1000:
                # 大数据量：分批加载但保持在同一页面
                data = get_project_management_data_chunked(view, chunk_size=200)
            else:
                # 正常数据量：使用原有逻辑
                data = get_project_management_data(view)
        else:
            # 保持原有行为
            data = get_project_management_data(view)
        
        return {
            'success': True,
            'data': data,
            'view': view,
            'title': get_workspace_title(view),
            'total_count': len(data) if isinstance(data, list) else 0,
            'adaptive_loading_used': enable_adaptive_loading and total_count > 1000 if 'total_count' in locals() else False
        }
    except Exception as e:
        frappe.log_error(f"Error loading partition data: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

def get_data_count_internal(view='main'):
    """
    内部数据计数方法 - 快速获取总数
    """
    try:
        conditions = []
        values = []
        
        if view != 'main':
            partition_projects = frappe.get_all("Project", 
                filters={"custom_partition": view},
                fields=["name"]
            )
            if partition_projects:
                project_names = [p.name for p in partition_projects]
                conditions.append("project IN ({})".format(','.join(['%s'] * len(project_names))))
                values.extend(project_names)
        
        where_clause = " AND ".join(conditions) if conditions else "1=1"
        
        count = frappe.db.sql(f"""
            SELECT COUNT(*) as total
            FROM `tabTask`
            WHERE {where_clause}
        """, values)[0][0]
        
        return count
        
    except Exception as e:
        frappe.log_error(f"Error getting data count: {str(e)}")
        return 0

def get_project_management_data_chunked(view='main', chunk_size=200):
    """
    分块获取数据，但仍然返回完整数据集（保持现有功能）
    """
    try:
        # 获取第一批数据（立即显示）
        first_chunk = get_project_management_data_paginated(view, 0, chunk_size)
        
        # 在后台获取剩余数据（如果需要）
        total_count = get_data_count_internal(view)
        
        if total_count > chunk_size:
            # 标记需要后续加载
            first_chunk['needs_more_loading'] = True
            first_chunk['total_count'] = total_count
            first_chunk['loaded_count'] = len(first_chunk.get('tasks', []))
        
        return first_chunk
        
    except Exception as e:
        frappe.log_error(f"Error in chunked data loading: {str(e)}")
        return get_project_management_data(view)  # 回退到原有方法

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


def get_project_management_data_optimized(view='main'):
    """
    OPTIMIZED VERSION: Get all projects and tasks organized by client with view filtering
    Based on user's data structure: Company → Client → Project → Task
    
    Performance improvements:
    - Batch queries instead of N+1 queries
    - Single SQL JOIN for related data
    - Reduced database calls from ~800+ to ~15
    - Full feature parity with original version
    """
    try:
        # Main view now shows workspace overview instead of all tasks
        if view == 'main':
            return get_main_dashboard_data()
        
        # Check if this is a workspace (should not show tasks, only overview)
        if view != 'main':
            try:
                if frappe.db.exists("Partition", view):
                    partition_doc = frappe.get_doc("Partition", view)
                    if partition_doc.is_workspace:
                        return get_workspace_overview_data(view)
                    else:
                        board_display_type = getattr(partition_doc, 'board_display_type', 'Task-Centric')
                        if board_display_type == 'Contact-Centric':
                            return get_contact_centric_data(view)
                        elif board_display_type == 'Client-Centric':
                            return get_client_centric_data(view)
            except Exception as e:
                frappe.log_error(f"Error checking workspace status for view {view}: {str(e)}")
                pass

        # Build the optimized query with all necessary JOINs
        conditions = ["t.custom_is_archived != 1", "(t.parent_task IS NULL OR t.parent_task = '')"]
        values = []
        
        # Add partition filter if not main view
        if view != 'main':
            if frappe.db.exists("Partition", view):
                conditions.append("p.custom_partition = %s")
                values.append(view)
            else:
                return {
                    'organized_data': {},
                    'total_projects': 0,
                    'total_tasks': 0,
                    'debug_info': {'message': f'Partition {view} not found'},
                    'is_workspace_view': False
                }
        
        where_clause = " AND ".join(conditions)
        
        # 🔥 SINGLE OPTIMIZED QUERY - Get all task data with JOINs
        tasks_data = frappe.db.sql(f"""
            SELECT 
                t.name as task_id,
                t.subject as task_name,
                t.custom_task_status as status,
                t.priority,
                t.exp_end_date,
                t.description,
                t.modified,
                t.creation,
                t.owner,
                t.custom_note,
                t.custom_frequency,
                t.custom_reset_date,
                t.custom_client,
                t.custom_tftg,
                t.custom_service_line,
                t.custom_year_end,
                t.custom_target_month,
                t.custom_process_date,
                t.custom_lodgement_due_date,
                t.custom_budget_planning,
                t.custom_actual_billing,
                t.custom_engagement,
                t.project,
                
                -- Project information
                p.name as project_id,
                p.project_name,
                p.customer as project_customer,
                
                -- Client information (from custom_client field)
                c1.customer_name as client_name,
                c1.custom_entity_type as entity_type,
                c1.customer_type as customer_type,
                c1.custom_client_group as client_group_id,
                
                -- Project customer information (fallback)
                c2.customer_name as project_customer_name,
                c2.custom_entity_type as project_entity_type,
                
                -- Company information for TF/TG
                comp.company_name as company_name
                
            FROM `tabTask` t
            LEFT JOIN `tabProject` p ON t.project = p.name
            LEFT JOIN `tabCustomer` c1 ON t.custom_client = c1.name
            LEFT JOIN `tabCustomer` c2 ON p.customer = c2.name  
            LEFT JOIN `tabCompany` comp ON t.custom_tftg = comp.name
            WHERE {where_clause}
            ORDER BY COALESCE(c1.customer_name, c2.customer_name, 'No Client'), t.subject
        """, values, as_dict=True)
        
        if not tasks_data:
            return {
                'organized_data': {},
                'total_projects': 0,
                'total_tasks': 0,
                'debug_info': {'message': 'No tasks found'},
                'is_workspace_view': False
            }
        
        task_ids = [t.task_id for t in tasks_data]
        task_ids_placeholder = ','.join(['%s'] * len(task_ids))
        
        # 🚀 BATCH QUERY 1: Get all role assignments
        roles_data = frappe.db.sql(f"""
            SELECT parent, role, user, is_primary
            FROM `tabTask Role Assignment`
            WHERE parent IN ({task_ids_placeholder})
        """, task_ids, as_dict=True)
        
        # Group roles by task and role type
        task_roles = {}
        for role in roles_data:
            if role.parent not in task_roles:
                task_roles[role.parent] = {}
            if role.role not in task_roles[role.parent]:
                task_roles[role.parent][role.role] = []
            task_roles[role.parent][role.role].append({
                'user': role.user,
                'is_primary': role.is_primary
            })
        
        # 🚀 BATCH QUERY 2: Get all software assignments
        software_data = frappe.db.sql(f"""
            SELECT parent, software as software_name, is_primary
            FROM `tabTask Software`
            WHERE parent IN ({task_ids_placeholder})
        """, task_ids, as_dict=True)
        
        # Group software by task
        task_software = {}
        for sw in software_data:
            if sw.parent not in task_software:
                task_software[sw.parent] = []
            task_software[sw.parent].append({
                'software': sw.software_name,
                'is_primary': sw.is_primary
            })
        
        # 🚀 BATCH QUERY 3: Get all communication methods
        comm_methods_data = frappe.db.sql(f"""
            SELECT parent, communication_method, is_primary
            FROM `tabTask Communication Method`
            WHERE parent IN ({task_ids_placeholder})
        """, task_ids, as_dict=True)
        
        # Group communication methods by task
        task_comm_methods = {}
        for cm in comm_methods_data:
            if cm.parent not in task_comm_methods:
                task_comm_methods[cm.parent] = []
            task_comm_methods[cm.parent].append({
                'communication_method': cm.communication_method,
                'is_primary': cm.is_primary
            })
        
        # 🚀 BATCH QUERY 4: Get all client contacts
        # Note: custom_client_contacts table may not exist yet, so we handle gracefully
        task_client_contacts = {}
        try:
            # Check if the table exists before querying
            if frappe.db.table_exists('tabTask Client Contact'):
                client_contacts_data = frappe.db.sql(f"""
                    SELECT parent, contact, contact_name
                    FROM `tabTask Client Contact`
                    WHERE parent IN ({task_ids_placeholder})
                """, task_ids, as_dict=True)
                
                # Group client contacts by task
                for cc in client_contacts_data:
                    if cc.parent not in task_client_contacts:
                        task_client_contacts[cc.parent] = []
                    task_client_contacts[cc.parent].append({
                        'contact': cc.contact,
                        'contact_name': cc.contact_name
                    })
        except Exception as e:
            # Table doesn't exist or other error, continue without client contacts
            frappe.log_error(f"Client contacts batch query error: {str(e)}")
        
        # 🚀 BATCH QUERY 5: Get all review notes
        review_notes_data = frappe.db.sql(f"""
            SELECT parent, note, name
            FROM `tabReview Note`
            WHERE parent IN ({task_ids_placeholder})
            ORDER BY parent, idx
        """, task_ids, as_dict=True)
        
        # Group review notes by task
        task_review_notes = {}
        for rn in review_notes_data:
            if rn.parent not in task_review_notes:
                task_review_notes[rn.parent] = []
            if rn.note:  # Only add non-empty notes
                task_review_notes[rn.parent].append({
                    'name': rn.name,
                    'note': rn.note
                })
        
        # 🚀 BATCH QUERY 6: Get all comment counts
        comment_counts = frappe.db.sql(f"""
            SELECT reference_name, COUNT(*) as count
            FROM `tabComment`
            WHERE reference_doctype = 'Task' 
            AND reference_name IN ({task_ids_placeholder})
            AND comment_type = 'Comment'
            GROUP BY reference_name
        """, task_ids, as_dict=True)
        
        # Create comment count map
        task_comment_counts = {c.reference_name: c['count'] for c in comment_counts}
        
        # 🚀 BATCH QUERY 7: Get all engagement file counts
        engagement_ids = list(set(t.custom_engagement for t in tasks_data if t.custom_engagement))
        engagement_file_counts = {}
        if engagement_ids:
            engagement_ids_placeholder = ','.join(['%s'] * len(engagement_ids))
            file_counts = frappe.db.sql(f"""
                SELECT attached_to_name, COUNT(*) as count
                FROM `tabFile`
                WHERE attached_to_doctype = 'Engagement'
                AND attached_to_name IN ({engagement_ids_placeholder})
                GROUP BY attached_to_name
            """, engagement_ids, as_dict=True)
            engagement_file_counts = {f.attached_to_name: f['count'] for f in file_counts}
        
        # 🚀 BATCH QUERY 8: Get all client group names
        client_group_ids = list(set(t.client_group_id for t in tasks_data if t.client_group_id))
        client_group_names = {}
        if client_group_ids:
            client_group_ids_placeholder = ','.join(['%s'] * len(client_group_ids))
            groups = frappe.db.sql(f"""
                SELECT name, group_name
                FROM `tabClient Group`
                WHERE name IN ({client_group_ids_placeholder})
            """, client_group_ids, as_dict=True)
            client_group_names = {g.name: g.group_name for g in groups}
        
        # 🚀 BATCH QUERY 9: Get all unique users for avatar info
        all_users = set()
        for task_id, roles in task_roles.items():
            for role_name, users in roles.items():
                for u in users:
                    if u.get('user'):
                        all_users.add(u['user'])
        
        user_info_cache = {}
        if all_users:
            users_placeholder = ','.join(['%s'] * len(all_users))
            users_data = frappe.db.sql(f"""
                SELECT name, full_name, email, user_image
                FROM `tabUser`
                WHERE name IN ({users_placeholder})
            """, list(all_users), as_dict=True)
            for u in users_data:
                initials = get_initials(u.full_name or u.name)
                user_info_cache[u.name] = {
                    'email': u.name,
                    'full_name': u.full_name or u.name,
                    'initials': initials,
                    'image': u.user_image
                }
        
        # Helper function to get user info from cache
        def get_cached_user_info(user_list):
            if not user_list:
                return None
            result = []
            for u in user_list:
                user_email = u.get('user')
                if user_email and user_email in user_info_cache:
                    info = user_info_cache[user_email].copy()
                    info['is_primary'] = u.get('is_primary', False)
                    result.append(info)
                elif user_email:
                    result.append({
                        'email': user_email,
                        'full_name': user_email,
                        'initials': get_initials(user_email),
                        'is_primary': u.get('is_primary', False)
                    })
            return result if result else None
        
        # Helper function to get primary user email
        def get_primary_user(user_list):
            if not user_list:
                return ""
            for u in user_list:
                if u.get('is_primary'):
                    return u.get('user', '')
            return user_list[0].get('user', '') if user_list else ""
        
        # Process all tasks
        organized_data = {}
        total_tasks = 0
        project_set = set()
        
        for task in tasks_data:
            task_id = task.task_id
            
            # Determine client name and entity type
            client_name = task.client_name or task.project_customer_name or "No Client"
            entity_type = task.entity_type or task.project_entity_type or task.customer_type or "Company"
            
            # Convert TF/TG company name to abbreviation
            tf_tg = 'TF'
            if task.company_name:
                if 'Top Figures' in task.company_name:
                    tf_tg = 'TF'
                elif 'Top Grants' in task.company_name:
                    tf_tg = 'TG'
                else:
                    tf_tg = task.company_name[:2].upper() if task.company_name else 'TF'
            
            # Get role assignments for this task
            task_role_data = task_roles.get(task_id, {})
            
            # Get software info for this task
            software_info = task_software.get(task_id)
            primary_software = ""
            if software_info:
                for sw in software_info:
                    if sw.get('is_primary'):
                        primary_software = sw.get('software', '')
                        break
                if not primary_software and software_info:
                    primary_software = software_info[0].get('software', '')
            
            # Get communication methods info
            comm_info = task_comm_methods.get(task_id)
            
            # Get review notes
            review_notes = task_review_notes.get(task_id, [])
            
            # Get client group name
            client_group = ''
            if task.client_group_id:
                client_group = client_group_names.get(task.client_group_id, '')
            
            # Format dates
            process_date = format_date_for_display(task.custom_process_date) if task.custom_process_date else ''
            lodgment_due_date = format_date_for_display(task.custom_lodgement_due_date) if task.custom_lodgement_due_date else ''
            reset_date = format_date_for_display(task.custom_reset_date) if task.custom_reset_date else ''
            last_updated = task.modified.strftime("%d-%m-%Y") if hasattr(task.modified, 'strftime') else str(task.modified) if task.modified else ''
            
            # Build task data structure (matching original exactly)
            task_data = {
                'task_id': task_id,
                'task_name': task.task_name,
                'subject': task.task_name,
                'status': task.status or 'Not Started',
                'priority': task.priority,
                'exp_end_date': task.exp_end_date,
                'description': task.description,
                'modified': task.modified,
                'custom_note': task.custom_note or '',
                'note': task.custom_note or '',
                'custom_frequency': task.custom_frequency or '',
                'custom_reset_date': reset_date,
                'client_name': client_name,
                'custom_client': task.custom_client,
                'entity_type': entity_type,
                'tf_tg': tf_tg,
                'service_line': task.custom_service_line or '',
                'software': primary_software,
                'year_end': task.custom_year_end or '',
                'target_month': task.custom_target_month or '',
                'process_date': process_date,
                'lodgment_due_date': lodgment_due_date,
                'project_name': task.project_name or 'No Project',
                'project_id': task.project_id,
                'project': task.project,
                'budget_planning': task.custom_budget_planning or 0,
                'actual_billing': task.custom_actual_billing or 0,
                'last_updated': last_updated,
                'client_group': client_group,
                'custom_engagement': task.custom_engagement,
                'engagement_el_count': engagement_file_counts.get(task.custom_engagement, 0) if task.custom_engagement else 0,
                'comment_count': task_comment_counts.get(task_id, 0),
                'review_notes': review_notes,
                'latest_review_note': review_notes[0]['note'] if review_notes else '',
                
                # Role user info for avatar display
                'action_person_info': get_cached_user_info(task_role_data.get('Action Person', [])),
                'preparer_info': get_cached_user_info(task_role_data.get('Preparer', [])),
                'reviewer_info': get_cached_user_info(task_role_data.get('Reviewer', [])),
                'partner_info': get_cached_user_info(task_role_data.get('Partner', [])),
                
                # Primary user emails
                'action_person': get_primary_user(task_role_data.get('Action Person', [])),
                'preparer': get_primary_user(task_role_data.get('Preparer', [])),
                'reviewer': get_primary_user(task_role_data.get('Reviewer', [])),
                'partner': get_primary_user(task_role_data.get('Partner', [])),
                
                # Software, communication, and client contacts info
                'software_info': software_info,
                'communication_methods_info': comm_info,
                'client_contacts_info': task_client_contacts.get(task_id),
                
                'assignees': None
            }
            
            # Organize by client -> project -> tasks (matching original structure exactly)
            # Original structure: organized_data[client][project_name] = [task1, task2, ...]
            project_name = task.project_name or 'No Project'
            project_customer = task.project_customer or "Unassigned"
            
            if project_customer not in organized_data:
                organized_data[project_customer] = {}
            
            if project_name not in organized_data[project_customer]:
                organized_data[project_customer][project_name] = []
            
            organized_data[project_customer][project_name].append(task_data)
            total_tasks += 1
            
            if task.project_id:
                project_set.add(task.project_id)
        
        return {
            'organized_data': dict(organized_data),
            'total_projects': len(project_set),
            'total_tasks': total_tasks,
            'debug_info': {
                'message': f'Optimized: {total_tasks} tasks loaded with ~15 queries instead of ~{total_tasks * 10}',
                'performance_improvement': f'~{((total_tasks * 10 - 15) / max(total_tasks * 10, 1) * 100):.1f}% fewer DB calls'
            },
            'is_workspace_view': False
        }
        
    except Exception as e:
        frappe.log_error(f"Error in optimized project management data: {str(e)}\n{frappe.get_traceback()}")
        # Fallback to original function if optimization fails
        return get_project_management_data_original(view)

def get_primary_user_from_roles(role_list):
    """Helper function to get primary user from role assignments"""
    if not role_list:
        return ""
    
    # Look for primary user first
    for role in role_list:
        if role.get('is_primary'):
            return role.get('user', '')
    
    # If no primary, return first user
    return role_list[0].get('user', '') if role_list else ""

def get_project_management_data(view='main'):
    """
    PERFORMANCE SWITCH: Choose between optimized and original version
    Set USE_OPTIMIZED_QUERIES = True to test the optimized version
    """
    # 🚀 PERFORMANCE TEST SWITCH - Change this to True to test optimization
    USE_OPTIMIZED_QUERIES = True
    
    if USE_OPTIMIZED_QUERIES:
        return get_project_management_data_optimized(view)
    else:
        return get_project_management_data_original(view)

def get_project_management_data_original(view='main'):
    """
    ORIGINAL VERSION: Get all projects and tasks organized by client with view filtering
    Based on user's data structure: Company → Client → Project → Task
    """
    try:
        # Main view now shows workspace overview instead of all tasks
        if view == 'main':
            return get_main_dashboard_data()
        
        # Check if this is a workspace (should not show tasks, only overview)
        # Also check board display type for different data loading
        if view != 'main':
            try:
                # First check if partition exists before trying to get it
                if frappe.db.exists("Partition", view):
                    partition_doc = frappe.get_doc("Partition", view)
                    if partition_doc.is_workspace:
                        # For workspaces, return child boards overview instead of tasks
                        return get_workspace_overview_data(view)
                    else:
                        # For boards, check display type
                        board_display_type = getattr(partition_doc, 'board_display_type', 'Task-Centric')
                        if board_display_type == 'Contact-Centric':
                            return get_contact_centric_data(view)
                        elif board_display_type == 'Client-Centric':
                            return get_client_centric_data(view)
                        # Continue with Task-Centric (default) below
            except Exception as e:
                frappe.log_error(f"Error checking workspace status for view {view}: {str(e)}")
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
                        'debug_info': {'message': f'Partition {view} not found'},
                        'is_workspace_view': False  # This is a board view, not a workspace view
                    }
            except Exception as e:
                # Partition filtering error handled silently
                # If Partition DocType doesn't exist, use all projects
                pass
        
        # 🚀 SIMPLE OPTIMIZATION: Add limit to reduce initial load
        # Get projects with partition filtering (limited for faster initial load)
        projects = frappe.db.get_all("Project", 
            fields=["name", "project_name", "customer", "status", "expected_end_date", "priority", "custom_partition"],
            filters=project_filters,
            order_by="customer, expected_end_date",
            limit_page_length=100  # Limit to first 100 projects for faster loading
        )
        
        # Project count info removed for performance
        # Project filters info removed for performance
        # Project partition info removed for performance
        
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
        
        # 🚀 SIMPLE OPTIMIZATION: Limit task query and reduce fields
        tasks = frappe.db.get_all("Task",
            fields=["name", "subject", "custom_task_status", "priority", "exp_end_date", "project", "modified", "custom_note", "custom_client"],
            filters=task_filters,
            order_by="modified desc",
            limit_page_length=500  # Limit to 500 tasks for faster loading
        )
        
        
        # 🚀 BATCH OPTIMIZATION: Get all project and client data at once
        project_ids = list(set([t.project for t in tasks if t.project]))
        client_ids = list(set([t.custom_client for t in tasks if t.custom_client]))
        
        # Batch get project information
        project_data = {}
        if project_ids:
            projects_info = frappe.db.get_all("Project", 
                fields=["name", "project_name", "customer"],
                filters={"name": ["in", project_ids]}
            )
            for proj in projects_info:
                project_data[proj.name] = proj
        
        # Batch get client information  
        client_data = {}
        if client_ids:
            clients_info = frappe.db.get_all("Customer",
                fields=["name", "customer_name", "custom_entity_type", "customer_type"],
                filters={"name": ["in", client_ids]}
            )
            for client in clients_info:
                client_data[client.name] = client
        
        # Enrich tasks with project and client information (now using cached data)
        for task in tasks:
            task.task_id = task.name
            task.task_name = task.subject
            
            # Map custom_task_status to status for frontend compatibility
            task.status = task.custom_task_status or 'Not Started'
            
            # Map custom_note to note for frontend compatibility
            task.note = task.custom_note or ''
            
            # 🚀 OPTIMIZED: Use cached project information
            if task.project and task.project in project_data:
                proj_info = project_data[task.project]
                task.project_name = proj_info.project_name
                
                # Get client name from project customer
                if proj_info.customer and proj_info.customer in client_data:
                    client_info = client_data[proj_info.customer]
                    task.client_name = client_info.customer_name
                else:
                    task.client_name = proj_info.customer or "No Client"
            else:
                task.project_name = task.project or "No Project"
                task.client_name = "Unassigned"
            
            # Try to get custom fields from the task document
            try:
                task_doc = frappe.get_doc("Task", task.name)
                
                # Get client information - Priority: custom_client > project.customer > "No Client"
                task_custom_client = getattr(task_doc, 'custom_client', None)
                # Task client info removed for performance
                
                if task_custom_client:
                    # 🚀 OPTIMIZED: Use cached client data instead of individual queries
                    if task_custom_client in client_data:
                        client_info = client_data[task_custom_client]
                        task.client_name = client_info.customer_name
                        task.custom_client = task_custom_client
                        task.entity_type = client_info.custom_entity_type or client_info.customer_type or "Company"
                        # Client loaded successfully
                    else:
                        # Fallback for clients not in batch
                        task.client_name = task_custom_client
                        task.entity_type = "Company"
                elif task.project and task.project in project_data:
                    # 🚀 OPTIMIZED: Use cached project data
                    proj_info = project_data[task.project]
                    if proj_info.customer and proj_info.customer in client_data:
                        client_info = client_data[proj_info.customer]
                        task.client_name = client_info.customer_name
                        task.entity_type = client_info.custom_entity_type or client_info.customer_type or "Company"
                    else:
                        task.client_name = proj_info.customer or "No Client"
                        task.entity_type = "Company"
                else:
                    task.client_name = "No Client"
                    task.entity_type = "Company"
                
                # Get other custom fields - using correct field names from fixtures
                # 🚀 OPTIMIZED: Use cached company data instead of individual queries
                tftg_company = getattr(task_doc, 'custom_tftg', None) or getattr(task_doc, 'custom_tf_tg', None)
                task.tf_tg = get_company_abbreviation(tftg_company)
                task.service_line = getattr(task_doc, 'custom_service_line', None) or ""
                # Get software from sub-table (new clean approach)
                task.software = get_primary_software(task_doc) or ""
                task.year_end = getattr(task_doc, 'custom_year_end', None) or ""
                task.target_month = getattr(task_doc, 'custom_target_month', None) or ""
                # Get people - only from sub-table (new clean approach)
                task.partner = get_primary_role_user(task_doc, 'partner') or ""
                task.reviewer = get_primary_role_user(task_doc, 'reviewer') or ""
                task.preparer = get_primary_role_user(task_doc, 'preparer') or ""
                # Format process date for display (convert YYYY-MM-DD to DD-MM-YYYY)
                process_date_raw = getattr(task_doc, 'custom_process_date', None)
                task.process_date = format_date_for_display(process_date_raw) if process_date_raw else ""
                
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
                
                # Get communication methods info for display (from sub-table)
                task.communication_methods_info = get_communication_methods_info(task_doc)
                
                # Get client contacts info for display (from sub-table)
                task.client_contacts_info = get_client_contacts_info(task_doc)
                
                # Format last updated date (DD-MM-YYYY format to match other date fields)
                if hasattr(task, 'modified') and task.modified:
                    task.last_updated = task.modified.strftime("%d-%m-%Y") if hasattr(task.modified, 'strftime') else str(task.modified)
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
                task.communication_methods_info = None
                task.client_contacts_info = None
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
        
        # Sort tasks by client name (alphabetical) and then by task name
        tasks.sort(key=lambda task: (
            (task.client_name or "").lower(),  # Primary sort: client name alphabetical
            (task.task_name or task.subject or "").lower()  # Secondary sort: task name alphabetical
        ))
        
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
            'debug_info': debug_info,
            'is_workspace_view': False  # This is a board view, not a workspace view
        }
    
    except Exception as e:
        frappe.log_error(f"Project management data error: {str(e)}")
        return {
            'organized_data': {},
            'total_projects': 0,
            'total_tasks': 0,
            'error': str(e),
            'debug_info': {'error_details': str(e)},
            'is_workspace_view': False  # This is a board view, not a workspace view
        }

def get_contact_centric_data(view='main'):
    """
    Get contact-centric data for Contact-Centric board display type
    """
    try:
        # Get contacts with custom fields
        contacts = frappe.db.get_all("Contact", 
            fields=[
                'name', 'first_name', 'last_name', 'email_id', 'phone', 'mobile_no',
                'company_name', 'designation', 'department', 'status', 'address',
                'custom_last_contact_date', 'custom_contact_notes', 'creation', 'modified'
            ],
            filters=[['status', '!=', 'Disabled']],
            order_by='first_name asc'
        )
        
        # Organize contacts data
        organized_data = {}
        total_contacts = len(contacts)
        
        for contact in contacts:
            # Group by company or use 'Individual' for contacts without company
            company_key = contact.get('company_name') or 'Individual Contacts'
            
            if company_key not in organized_data:
                organized_data[company_key] = {
                    'company_name': company_key,
                    'contacts': [],
                    'contact_count': 0
                }
            
            # Format contact data
            contact_data = {
                'name': contact.get('name'),
                'contact_name': f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip(),
                'first_name': contact.get('first_name'),
                'last_name': contact.get('last_name'),
                'email_id': contact.get('email_id'),
                'phone': contact.get('phone') or contact.get('mobile_no'),
                'company_name': contact.get('company_name'),
                'designation': contact.get('designation'),
                'department': contact.get('department'),
                'status': contact.get('status'),
                'custom_last_contact_date': format_date_for_display(contact.get('custom_last_contact_date')),
                'custom_contact_notes': contact.get('custom_contact_notes'),
                'creation': format_date_for_display(contact.get('creation')),
                'modified': format_date_for_display(contact.get('modified'))
            }
            
            organized_data[company_key]['contacts'].append(contact_data)
            organized_data[company_key]['contact_count'] += 1
        
        return {
            'organized_data': organized_data,
            'total_companies': len(organized_data),
            'total_contacts': total_contacts,
            'display_type': 'Contact-Centric',
            'debug_info': {'message': f'Loaded {total_contacts} contacts from {len(organized_data)} companies'}
        }
        
    except Exception as e:
        frappe.log_error(f"Error loading contact-centric data: {str(e)}")
        return {
            'organized_data': {},
            'total_companies': 0,
            'total_contacts': 0,
            'display_type': 'Contact-Centric',
            'error': str(e)
        }

def get_client_centric_data(view='main'):
    """
    Get client-centric data for Client-Centric board display type
    """
    try:
        # Get customers (clients)
        customers = frappe.db.get_all("Customer", 
            fields=[
                'name', 'customer_name', 'customer_group', 'territory', 'customer_type',
                'creation', 'modified', 'disabled'
            ],
            filters=[['disabled', '!=', 1]],
            order_by='customer_name asc'
        )
        
        # Get related Client Project Info data
        client_project_info = {}
        if customers:
            customer_names = [c['name'] for c in customers]
            project_infos = frappe.db.get_all("Client Project Info",
                fields=[
                    'client', 'priority_level', 'accountant', 'darren_progress', 
                    'darren_risks', 'industry', 'darren_scope'
                ],
                filters=[['client', 'in', customer_names]]
            )
            
            for info in project_infos:
                client_project_info[info['client']] = info
        
        # Get related Client Referral data
        client_referrals = {}
        if customers:
            customer_names = [c['name'] for c in customers]
            referrals = frappe.db.get_all("Client Referral",
                fields=[
                    'client', 'referral_person', 'relationship_type', 'referral_status',
                    'referral_method', 'referral_notes'
                ],
                filters=[['client', 'in', customer_names]]
            )
            
            for referral in referrals:
                if referral['client'] not in client_referrals:
                    client_referrals[referral['client']] = []
                client_referrals[referral['client']].append(referral)
        
        # Organize client data
        organized_data = {}
        total_clients = len(customers)
        
        for customer in customers:
            # Group by customer group or use 'General' for customers without group
            group_key = customer.get('customer_group') or 'General Clients'
            
            if group_key not in organized_data:
                organized_data[group_key] = {
                    'group_name': group_key,
                    'clients': [],
                    'client_count': 0
                }
            
            # Get related project info and referrals
            project_info = client_project_info.get(customer['name'], {})
            referrals = client_referrals.get(customer['name'], [])
            
            # Format client data
            client_data = {
                'name': customer.get('name'),
                'customer_name': customer.get('customer_name'),
                'customer_group': customer.get('customer_group'),
                'territory': customer.get('territory'),
                'customer_type': customer.get('customer_type'),
                'creation': format_date_for_display(customer.get('creation')),
                'modified': format_date_for_display(customer.get('modified')),
                
                # Project info fields
                'priority_level': project_info.get('priority_level'),
                'accountant': project_info.get('accountant'),
                'darren_progress': project_info.get('darren_progress'),
                'darren_risks': project_info.get('darren_risks'),
                'industry': project_info.get('industry'),
                'darren_scope': project_info.get('darren_scope'),
                
                # Referral info (use first referral if multiple)
                'referral_person': referrals[0].get('referral_person') if referrals else None,
                'relationship_type': referrals[0].get('relationship_type') if referrals else None,
                'referral_status': referrals[0].get('referral_status') if referrals else None,
                'referral_count': len(referrals)
            }
            
            organized_data[group_key]['clients'].append(client_data)
            organized_data[group_key]['client_count'] += 1
        
        return {
            'organized_data': organized_data,
            'total_groups': len(organized_data),
            'total_clients': total_clients,
            'display_type': 'Client-Centric',
            'debug_info': {'message': f'Loaded {total_clients} clients from {len(organized_data)} groups'}
        }
        
    except Exception as e:
        frappe.log_error(f"Error loading client-centric data: {str(e)}")
        return {
            'organized_data': {},
            'total_groups': 0,
            'total_clients': 0,
            'display_type': 'Client-Centric',
            'error': str(e)
        }


# =============================================================================
# 🔧 HELPER FUNCTIONS - Used by core data loading functions
# =============================================================================

def get_project_management_data_paginated(view='main', offset=0, limit=50, filters=None):
    """
    Paginated data loading for large datasets
    """
    try:
        conditions = ["1=1"]
        values = []
        
        if view != 'main':
            partition_projects = frappe.get_all("Project", 
                filters={"custom_partition": view},
                fields=["name"]
            )
            if partition_projects:
                project_names = [p.name for p in partition_projects]
                conditions.append("t.project IN ({})".format(','.join(['%s'] * len(project_names))))
                values.extend(project_names)
        
        if filters:
            if filters.get('client'):
                conditions.append("t.custom_client = %s")
                values.append(filters['client'])
            if filters.get('status'):
                conditions.append("t.status = %s")
                values.append(filters['status'])
        
        where_clause = " AND ".join(conditions)
        
        tasks_data = frappe.db.sql(f"""
            SELECT 
                t.name as task_id,
                t.subject as task_name,
                t.custom_client,
                t.status,
                t.custom_entity_type,
                t.modified as last_modified,
                COALESCE(c.customer_name, 'No Client') as client_name
            FROM `tabTask` t
            LEFT JOIN `tabCustomer` c ON t.custom_client = c.name
            WHERE {where_clause}
            ORDER BY COALESCE(c.customer_name, 'No Client'), t.subject
            LIMIT %s OFFSET %s
        """, values + [limit, offset], as_dict=True)
        
        enriched_tasks = []
        for task in tasks_data:
            enriched_tasks.append({
                'task_id': task.task_id,
                'task_name': task.task_name,
                'client_name': task.client_name,
                'status': task.status,
                'entity_type': task.custom_entity_type or 'Company',
                'last_modified': task.last_modified
            })
        
        return {
            'tasks': enriched_tasks,
            'total_loaded': len(enriched_tasks)
        }
        
    except Exception as e:
        frappe.log_error(f"Error in paginated data fetch: {str(e)}")
        return {'tasks': [], 'total_loaded': 0}


def get_communication_methods_info(task_doc):
    """
    Get all communication methods assignments for display
    """
    try:
        if not hasattr(task_doc, 'custom_communication_methods') or not task_doc.custom_communication_methods:
            return None
        
        methods = []
        for method_assignment in task_doc.custom_communication_methods:
            methods.append({
                'communication_method': method_assignment.communication_method,
                'is_primary': method_assignment.is_primary
            })
        
        return methods if methods else None
        
    except:
        return None


def get_client_contacts_info(task_doc):
    """
    Get all client contacts assignments for display
    """
    try:
        if not hasattr(task_doc, 'custom_client_contacts') or not task_doc.custom_client_contacts:
            return None
        
        contacts = []
        for contact_assignment in task_doc.custom_client_contacts:
            contacts.append({
                'contact': contact_assignment.contact,
                'contact_name': contact_assignment.contact_name
            })
        
        return contacts if contacts else None
        
    except:
        return None


# =============================================================================
# 🔌 API FUNCTIONS - Called by frontend JavaScript
# =============================================================================

@frappe.whitelist()
def get_bulk_subtask_counts(task_ids):
    """
    Get subtask counts for multiple tasks at once (batch operation for performance)
    """
    try:
        if isinstance(task_ids, str):
            task_ids = json.loads(task_ids)
        
        if not task_ids:
            return {'success': True, 'counts': {}}
        
        # Batch query to get all subtask counts
        task_ids_placeholder = ','.join(['%s'] * len(task_ids))
        
        subtask_counts = frappe.db.sql(f"""
            SELECT parent_task, COUNT(*) as count
            FROM `tabTask`
            WHERE parent_task IN ({task_ids_placeholder})
            AND custom_is_archived != 1
            GROUP BY parent_task
        """, task_ids, as_dict=True)
        
        # Create counts map
        counts = {task_id: 0 for task_id in task_ids}
        for sc in subtask_counts:
            if sc.parent_task:
                counts[sc.parent_task] = sc['count']
        
        return {'success': True, 'counts': counts}
        
    except Exception as e:
        frappe.log_error(f"Error getting bulk subtask counts: {str(e)}")
        return {'success': False, 'error': str(e), 'counts': {}}


@frappe.whitelist()
def get_automation_count():
    """
    Get count of automation rules for the Automate button badge
    """
    try:
        count = 0
        try:
            if frappe.db.exists("DocType", "Automation Rule"):
                count = frappe.db.count("Automation Rule", {"enabled": 1})
        except:
            pass
        
        return {'success': True, 'count': count}
        
    except Exception as e:
        frappe.log_error(f"Error getting automation count: {str(e)}")
        return {'success': False, 'count': 0}


@frappe.whitelist()
def batch_delete_tasks(task_ids):
    """Batch delete multiple tasks"""
    try:
        if isinstance(task_ids, str):
            task_ids = json.loads(task_ids)
        
        if not task_ids:
            return {'success': False, 'error': 'No tasks provided'}
        
        success_count = 0
        errors = []
        
        for task_id in task_ids:
            try:
                frappe.delete_doc("Task", task_id, force=1)
                success_count += 1
            except Exception as e:
                errors.append(f"{task_id}: {str(e)}")
        
        frappe.db.commit()
        
        return {
            'success': True,
            'deleted_count': success_count,
            'errors': errors,
            'message': f'Successfully deleted {success_count} tasks'
        }
        
    except Exception as e:
        frappe.log_error(f"Error in batch delete tasks: {str(e)}")
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def batch_archive_tasks(task_ids):
    """Batch archive multiple tasks"""
    try:
        if isinstance(task_ids, str):
            task_ids = json.loads(task_ids)
        
        if not task_ids:
            return {'success': False, 'error': 'No tasks provided'}
        
        success_count = 0
        errors = []
        
        for task_id in task_ids:
            try:
                frappe.db.set_value("Task", task_id, "custom_is_archived", 1)
                success_count += 1
            except Exception as e:
                errors.append(f"{task_id}: {str(e)}")
        
        frappe.db.commit()
        
        return {
            'success': True,
            'archived_count': success_count,
            'errors': errors,
            'message': f'Successfully archived {success_count} tasks'
        }
        
    except Exception as e:
        frappe.log_error(f"Error in batch archive tasks: {str(e)}")
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def get_task_activity_log(task_id):
    """Get activity log for a task"""
    try:
        if not task_id:
            return {'success': False, 'error': 'Task ID is required'}
        
        # Get versions (change history)
        versions = frappe.get_all("Version",
            filters={
                "ref_doctype": "Task",
                "docname": task_id
            },
            fields=["name", "owner", "creation", "data"],
            order_by="creation desc",
            limit=50
        )
        
        activities = []
        for version in versions:
            try:
                data = json.loads(version.data) if version.data else {}
                changed_fields = data.get('changed', [])
                
                for change in changed_fields:
                    activities.append({
                        'field': change[0] if len(change) > 0 else '',
                        'old_value': change[1] if len(change) > 1 else '',
                        'new_value': change[2] if len(change) > 2 else '',
                        'user': version.owner,
                        'timestamp': version.creation
                    })
            except:
                pass
        
        return {'success': True, 'activities': activities}
        
    except Exception as e:
        frappe.log_error(f"Error getting task activity log: {str(e)}")
        return {'success': False, 'error': str(e), 'activities': []}


@frappe.whitelist()
def check_review_permissions(task_id):
    """Check if current user can add review notes"""
    try:
        user = frappe.session.user
        user_roles = frappe.get_roles(user)
        
        can_review = any(role in user_roles for role in ['System Manager', 'Reviewer', 'Partner', 'Administrator'])
        
        return {
            'success': True,
            'can_review': can_review,
            'user': user
        }
    except Exception as e:
        return {'success': False, 'can_review': False, 'error': str(e)}


@frappe.whitelist()
def get_bulk_task_roles(task_ids):
    """Get role assignments for multiple tasks"""
    try:
        if isinstance(task_ids, str):
            task_ids = json.loads(task_ids)
        
        if not task_ids:
            return {'success': True, 'roles': {}}
        
        task_ids_placeholder = ','.join(['%s'] * len(task_ids))
        
        roles_data = frappe.db.sql(f"""
            SELECT parent, role, user, is_primary
            FROM `tabTask Role Assignment`
            WHERE parent IN ({task_ids_placeholder})
        """, task_ids, as_dict=True)
        
        # Group by task
        task_roles = {}
        for role in roles_data:
            if role.parent not in task_roles:
                task_roles[role.parent] = []
            
            user_info = None
            try:
                user_data = frappe.db.get_value("User", role.user, ["full_name", "user_image"], as_dict=True)
                if user_data:
                    user_info = {
                        'email': role.user,
                        'full_name': user_data.full_name or role.user,
                        'initials': get_initials(user_data.full_name or role.user),
                        'image': user_data.user_image
                    }
            except:
                user_info = {'email': role.user, 'full_name': role.user, 'initials': get_initials(role.user)}
            
            task_roles[role.parent].append({
                'role': role.role,
                'user': role.user,
                'is_primary': role.is_primary,
                'user_info': user_info
            })
        
        return {'success': True, 'roles': task_roles}
        
    except Exception as e:
        frappe.log_error(f"Error getting bulk task roles: {str(e)}")
        return {'success': False, 'error': str(e), 'roles': {}}


@frappe.whitelist()
def set_task_roles(task_id, roles_data):
    """Set role assignments for a task"""
    try:
        if isinstance(roles_data, str):
            roles_data = json.loads(roles_data)
        
        task_doc = frappe.get_doc("Task", task_id)
        
        # Clear existing roles
        task_doc.custom_roles = []
        
        # Add new roles
        for role_data in roles_data:
            task_doc.append('custom_roles', {
                'role': role_data.get('role'),
                'user': role_data.get('user'),
                'is_primary': role_data.get('is_primary', False)
            })
        
        task_doc.save()
        frappe.db.commit()
        
        return {'success': True, 'message': 'Roles updated successfully'}
        
    except Exception as e:
        frappe.log_error(f"Error setting task roles: {str(e)}")
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def get_task_role_assignments(task_id, role_filter=None):
    """Get role assignments for a specific task"""
    try:
        filters = {"parent": task_id}
        if role_filter:
            filters["role"] = role_filter
        
        roles = frappe.get_all("Task Role Assignment",
            filters=filters,
            fields=["name", "role", "user", "is_primary"],
            order_by="role, is_primary desc"
        )
        
        # Enrich with user info
        for role in roles:
            try:
                user_data = frappe.db.get_value("User", role.user, ["full_name", "user_image"], as_dict=True)
                if user_data:
                    role['full_name'] = user_data.full_name or role.user
                    role['initials'] = get_initials(user_data.full_name or role.user)
                    role['image'] = user_data.user_image
                else:
                    role['full_name'] = role.user
                    role['initials'] = get_initials(role.user)
            except:
                role['full_name'] = role.user
                role['initials'] = get_initials(role.user)
        
        return {'success': True, 'roles': roles}
        
    except Exception as e:
        frappe.log_error(f"Error getting task role assignments: {str(e)}")
        return {'success': False, 'error': str(e), 'roles': []}


@frappe.whitelist()
def create_new_task(project_name, client_name=None):
    """Create a new task in a project"""
    try:
        if not project_name:
            return {'success': False, 'error': 'Project name is required'}
        
        # Get project info
        project = frappe.get_doc("Project", project_name)
        
        # Create new task
        new_task = frappe.new_doc("Task")
        new_task.subject = "New Task"
        new_task.project = project_name
        new_task.custom_task_status = "Not Started"
        new_task.priority = "Medium"
        
        # Set client if provided
        if client_name:
            new_task.custom_client = client_name
        elif project.customer:
            new_task.custom_client = project.customer
        
        new_task.insert()
        frappe.db.commit()
        
        return {
            'success': True,
            'task_id': new_task.name,
            'task_subject': new_task.subject,
            'message': 'Task created successfully'
        }
        
    except Exception as e:
        frappe.log_error(f"Error creating new task: {str(e)}")
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def get_subtask_count(parent_task_id):
    """Get subtask count for a single task"""
    try:
        count = frappe.db.count("Task", {
            "parent_task": parent_task_id,
            "custom_is_archived": ["!=", 1]
        })
        
        return {'success': True, 'count': count}
        
    except Exception as e:
        frappe.log_error(f"Error getting subtask count: {str(e)}")
        return {'success': False, 'count': 0}


@frappe.whitelist()
def create_customer_and_link(task_id, customer_name, year_end="June", customer_type="Company"):
    """Create a new customer and link it to a task"""
    try:
        if not task_id or not customer_name:
            return {'success': False, 'error': 'Task ID and customer name are required'}
        
        # Check if customer already exists
        existing = frappe.db.get_value("Customer", {"customer_name": customer_name})
        if existing:
            # Link existing customer to task
            frappe.db.set_value("Task", task_id, "custom_client", existing)
            frappe.db.commit()
            return {
                'success': True,
                'customer_id': existing,
                'customer_name': customer_name,
                'message': 'Existing customer linked to task'
            }
        
        # Create new customer
        new_customer = frappe.new_doc("Customer")
        new_customer.customer_name = customer_name
        new_customer.customer_type = customer_type
        new_customer.territory = frappe.db.get_single_value("Selling Settings", "territory") or "All Territories"
        new_customer.customer_group = frappe.db.get_single_value("Selling Settings", "customer_group") or "All Customer Groups"
        
        if hasattr(new_customer, 'custom_year_end'):
            new_customer.custom_year_end = year_end
        
        new_customer.insert()
        
        # Link to task
        frappe.db.set_value("Task", task_id, "custom_client", new_customer.name)
        frappe.db.commit()
        
        return {
            'success': True,
            'customer_id': new_customer.name,
            'customer_name': new_customer.customer_name,
            'message': 'Customer created and linked to task'
        }
        
    except Exception as e:
        frappe.log_error(f"Error creating customer and linking: {str(e)}")
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def get_current_user_info():
    """Get current user information"""
    try:
        user = frappe.session.user
        
        if user == 'Guest':
            return {'success': False, 'error': 'Not logged in'}
        
        user_doc = frappe.get_doc("User", user)
        user_roles = frappe.get_roles(user)
        
        return {
            'success': True,
            'user': {
                'email': user,
                'full_name': user_doc.full_name or user,
                'first_name': user_doc.first_name,
                'last_name': user_doc.last_name,
                'user_image': user_doc.user_image,
                'roles': user_roles,
                'is_administrator': user == 'Administrator',
                'is_system_manager': 'System Manager' in user_roles
            }
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting current user info: {str(e)}")
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def grant_dev_access(password):
    """Grant developer system access"""
    try:
        # Simple password check (you should use a more secure method)
        dev_password = frappe.conf.get('dev_system_password', 'dev123')
        
        if password == dev_password:
            frappe.session['dev_system_access'] = True
            return {'success': True, 'message': 'Developer access granted'}
        else:
            return {'success': False, 'message': 'Invalid password'}
            
    except Exception as e:
        frappe.log_error(f"Error granting dev access: {str(e)}")
        return {'success': False, 'message': 'Error processing request'}


@frappe.whitelist()
def test_combination_doctype():
    """Test if Combination View doctype exists and is working"""
    try:
        exists = frappe.db.exists("DocType", "Combination View")
        
        if exists:
            count = frappe.db.count("Combination View")
            return {
                'success': True,
                'doctype_exists': True,
                'record_count': count
            }
        else:
            return {
                'success': True,
                'doctype_exists': False,
                'message': 'Combination View DocType does not exist'
            }
            
    except Exception as e:
        frappe.log_error(f"Error testing combination doctype: {str(e)}")
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def initialize_single_partition_subtask_config(partition_name):
    """Initialize subtask column configuration for a single partition"""
    try:
        if not partition_name or partition_name == 'main':
            return {'success': False, 'error': 'Valid partition name required'}
        
        if not frappe.db.exists("Partition", partition_name):
            return {'success': False, 'error': 'Partition not found'}
        
        partition_doc = frappe.get_doc("Partition", partition_name)
        
        # Check if already initialized
        if getattr(partition_doc, 'subtask_visible_columns', None):
            return {
                'success': True,
                'message': 'Subtask config already initialized',
                'already_initialized': True
            }
        
        # Get default subtask config
        default_config = get_default_subtask_column_config()
        
        partition_doc.subtask_visible_columns = json.dumps(default_config['default_visible_columns'])
        partition_doc.subtask_column_config = json.dumps({
            "column_order": default_config['default_column_order'],
            "primary_column": default_config['primary_column']
        })
        
        partition_doc.save()
        frappe.db.commit()
        
        return {
            'success': True,
            'message': 'Subtask config initialized successfully'
        }
        
    except Exception as e:
        frappe.log_error(f"Error initializing subtask config: {str(e)}")
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def get_all_partition_column_status():
    """Get column configuration status for all partitions"""
    try:
        partitions = frappe.get_all("Partition",
            fields=["name", "partition_name", "visible_columns", "column_config"],
            filters={"is_archived": ["!=", 1]}
        )
        
        status_list = []
        for partition in partitions:
            has_config = bool(partition.visible_columns or partition.column_config)
            status_list.append({
                'name': partition.name,
                'partition_name': partition.partition_name,
                'has_config': has_config
            })
        
        return {
            'success': True,
            'partitions': status_list,
            'total_count': len(status_list)
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting partition column status: {str(e)}")
        return {'success': False, 'error': str(e), 'partitions': []}


@frappe.whitelist()
def get_subtask_column_config(partition_name):
    """Get subtask column configuration for a partition"""
    try:
        default_config = get_default_subtask_column_config()
        
        if not partition_name or partition_name == 'main':
            return {
                'success': True,
                'visible_columns': json.dumps(default_config['default_visible_columns']),
                'column_config': json.dumps({
                    "column_order": default_config['default_column_order'],
                    "primary_column": default_config['primary_column']
                })
            }
        
        if not frappe.db.exists("Partition", partition_name):
            return {
                'success': True,
                'visible_columns': json.dumps(default_config['default_visible_columns']),
                'column_config': json.dumps({
                    "column_order": default_config['default_column_order'],
                    "primary_column": default_config['primary_column']
                })
            }
        
        partition = frappe.get_doc("Partition", partition_name)
        
        visible_columns = getattr(partition, 'subtask_visible_columns', None) or json.dumps(default_config['default_visible_columns'])
        column_config = getattr(partition, 'subtask_column_config', None) or json.dumps({
            "column_order": default_config['default_column_order'],
            "primary_column": default_config['primary_column']
        })
        
        return {
            'success': True,
            'visible_columns': visible_columns,
            'column_config': column_config
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting subtask column config: {str(e)}")
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def get_task_status_options():
    """
    Get available status options for Task doctype from custom_task_status field
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
                    return {'success': True, 'status_options': [
                        'Not Started', 'Done', 'Working on it', 'Stuck',
                        'Ready for Manager Review', 'Ready for Partner Review',
                        'Review Points to be Actioned', 'Ready To Lodge',
                        'Lodged', 'Ready For Manage'
                    ]}
            except Exception as fallback_error:
                frappe.log_error(f"Error getting existing status values: {str(fallback_error)}")
                return {'success': True, 'status_options': ['Not Started', 'Done', 'Working on it', 'Stuck']}
                
    except Exception as e:
        frappe.log_error(f"Error getting task status options: {str(e)}")
        return {'success': True, 'status_options': ['Not Started', 'Done', 'Working on it', 'Stuck']}
