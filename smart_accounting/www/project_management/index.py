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
def create_partition(partition_name, is_workspace=False, parent_partition=None, description="", icon=""):
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
                else:
                    # Use comprehensive default columns including new ones
                    default_columns = ["client", "task-name", "entity", "tf-tg", "software", "communication-methods", "client-contact", "status", "note", "target-month", "budget", "actual", "review-note", "action-person", "preparer", "reviewer", "partner", "lodgment-due", "engagement", "group", "year-end", "last-updated", "priority", "frequency", "reset-date"]
                    new_partition.visible_columns = json.dumps(default_columns)
                    new_partition.column_config = json.dumps({"column_order": default_columns})
            except:
                # Use comprehensive default columns including new ones
                default_columns = ["client", "task-name", "entity", "tf-tg", "software", "communication-methods", "client-contact", "status", "note", "target-month", "budget", "actual", "review-note", "action-person", "preparer", "reviewer", "partner", "lodgment-due", "engagement", "group", "year-end", "last-updated", "priority", "frequency", "reset-date"]
                new_partition.visible_columns = json.dumps(default_columns)
                new_partition.column_config = json.dumps({"column_order": default_columns})
        else:
            # Default columns for new top-level partition - use comprehensive list including new ones
            default_columns = ["client", "task-name", "entity", "tf-tg", "software", "communication-methods", "client-contact", "status", "note", "target-month", "budget", "actual", "review-note", "action-person", "preparer", "reviewer", "partner", "lodgment-due", "engagement", "group", "year-end", "last-updated", "priority", "frequency", "reset-date"]
            new_partition.visible_columns = json.dumps(default_columns)
            new_partition.column_config = json.dumps({"column_order": default_columns})
        
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
    增强版：支持大数据量的自适应加载，保持现有功能完整性
    """
    try:
        # 检查是否需要自适应加载
        if enable_adaptive_loading:
            total_count = get_data_count_internal(view)
            
            if total_count > 1000:
                # 大数据量：分批加载但保持在同一页面
                # Large dataset detected, using chunked loading
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

def get_project_management_data_optimized(view='main'):
    """
    OPTIMIZED VERSION: Get all projects and tasks organized by client with view filtering
    Based on user's data structure: Company → Client → Project → Task
    
    Performance improvements:
    - Batch queries instead of N+1 queries
    - Single SQL JOIN for related data
    - Reduced database calls from ~800 to ~5
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

        # 🚀 PERFORMANCE OPTIMIZATION: Single SQL query with JOINs
        # This replaces the N+1 query problem in the original function
        
        # Build the optimized query with all necessary JOINs
        conditions = ["t.custom_is_archived != 1", "t.parent_task IS NULL"]
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
        
        # 🔥 SINGLE OPTIMIZED QUERY - replaces 800+ individual queries
        tasks_data = frappe.db.sql(f"""
            SELECT 
                t.name as task_id,
                t.subject as task_name,
                t.custom_task_status as status,
                t.priority,
                t.exp_end_date,
                t.description,
                t.modified,
                t.custom_note as note,
                t.custom_frequency,
                t.custom_reset_date,
                t.custom_client,
                t.custom_tftg,
                t.custom_service_line,
                t.custom_year_end,
                t.custom_target_month,
                t.custom_process_date,
                
                -- Project information
                p.name as project_id,
                p.project_name,
                p.customer as project_customer,
                p.status as project_status,
                p.expected_end_date as project_end_date,
                p.priority as project_priority,
                
                -- Client information (from custom_client field)
                c1.customer_name as client_name,
                c1.custom_entity_type as entity_type,
                
                -- Project customer information (fallback)
                c2.customer_name as project_customer_name,
                c2.custom_entity_type as project_entity_type,
                
                -- Company information
                comp.company_name as company_name
                
            FROM `tabTask` t
            LEFT JOIN `tabProject` p ON t.project = p.name
            LEFT JOIN `tabCustomer` c1 ON t.custom_client = c1.name
            LEFT JOIN `tabCustomer` c2 ON p.customer = c2.name  
            LEFT JOIN `tabCompany` comp ON t.custom_tftg = comp.name
            WHERE {where_clause}
            ORDER BY COALESCE(c1.customer_name, c2.customer_name, 'No Client'), t.subject
        """, values, as_dict=True)
        
        # 🚀 BATCH QUERY: Get all role assignments in one go
        if tasks_data:
            task_ids = [t.task_id for t in tasks_data]
            roles_data = frappe.db.sql("""
                SELECT parent, role, user, is_primary
                FROM `tabTask Role Assignment`
                WHERE parent IN ({})
            """.format(','.join(['%s'] * len(task_ids))), task_ids, as_dict=True)
            
            # Group roles by task
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
            
            # 🚀 BATCH QUERY: Get all software assignments in one go
            software_data = frappe.db.sql("""
                SELECT parent, software_name, is_primary
                FROM `tabTask Software`
                WHERE parent IN ({})
            """.format(','.join(['%s'] * len(task_ids))), task_ids, as_dict=True)
            
            # Group software by task
            task_software = {}
            for software in software_data:
                if software.parent not in task_software:
                    task_software[software.parent] = []
                task_software[software.parent].append({
                    'software_name': software.software_name,
                    'is_primary': software.is_primary
                })
        
        # Process the optimized data
        organized_data = {}
        total_tasks = 0
        
        for task in tasks_data:
            # Determine client name with priority: custom_client > project_customer > "No Client"
            client_name = task.client_name or task.project_customer_name or "No Client"
            entity_type = task.entity_type or task.project_entity_type or "Company"
            
            # Convert TF/TG company
            tf_tg = 'TF'  # Default
            if task.company_name:
                if 'Top Figures' in task.company_name:
                    tf_tg = 'TF'
                elif 'Top Grants' in task.company_name:
                    tf_tg = 'TG'
                else:
                    tf_tg = task.company_name[:2].upper()
            
            # Get roles for this task
            roles = task_roles.get(task.task_id, {})
            partner = get_primary_user_from_roles(roles.get('partner', []))
            reviewer = get_primary_user_from_roles(roles.get('reviewer', []))
            preparer = get_primary_user_from_roles(roles.get('preparer', []))
            
            # Get primary software
            software_list = task_software.get(task.task_id, [])
            primary_software = ""
            for sw in software_list:
                if sw.get('is_primary'):
                    primary_software = sw.get('software_name', '')
                    break
            if not primary_software and software_list:
                primary_software = software_list[0].get('software_name', '')
            
            # Create task data structure (same as original)
            task_data = {
                'task_id': task.task_id,
                'task_name': task.task_name,
                'status': task.status or 'Not Started',
                'priority': task.priority,
                'exp_end_date': task.exp_end_date,
                'description': task.description,
                'modified': task.modified,
                'note': task.note or '',
                'frequency': task.custom_frequency or '',
                'reset_date': task.custom_reset_date,
                'client_name': client_name,
                'entity_type': entity_type,
                'tf_tg': tf_tg,
                'service_line': task.custom_service_line or '',
                'software': primary_software,
                'year_end': task.custom_year_end or '',
                'target_month': task.custom_target_month or '',
                'partner': partner,
                'reviewer': reviewer,
                'preparer': preparer,
                'process_date': format_date_for_display(task.custom_process_date) if task.custom_process_date else '',
                'project_name': task.project_name or 'No Project',
                'project_id': task.project_id
            }
            
            # Organize by client (same structure as original)
            if client_name not in organized_data:
                organized_data[client_name] = {
                    'client_name': client_name,
                    'entity_type': entity_type,
                    'projects': {},
                    'total_tasks': 0
                }
            
            project_name = task.project_name or 'No Project'
            if project_name not in organized_data[client_name]['projects']:
                organized_data[client_name]['projects'][project_name] = {
                    'project_name': project_name,
                    'project_id': task.project_id,
                    'tasks': []
                }
            
            organized_data[client_name]['projects'][project_name]['tasks'].append(task_data)
            organized_data[client_name]['total_tasks'] += 1
            total_tasks += 1
        
        return {
            'organized_data': organized_data,
            'total_projects': len(set(t.project_id for t in tasks_data if t.project_id)),
            'total_tasks': total_tasks,
            'debug_info': {
                'message': f'Optimized query loaded {total_tasks} tasks with {len(tasks_data)} database calls instead of ~{total_tasks * 4}',
                'performance_improvement': f'Reduced database calls by ~{((total_tasks * 4 - 5) / (total_tasks * 4) * 100):.1f}%'
            },
            'is_workspace_view': False
        }
        
    except Exception as e:
        frappe.log_error(f"Error in optimized project management data: {str(e)}")
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
    USE_OPTIMIZED_QUERIES = False
    
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
                        # TF/TG conversion error handled silently
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
            'custom_service_line', 'custom_client', 'custom_process_date', 'custom_lodgement_due_date', 'subject',
            'custom_engagement', 'custom_roles', 'custom_due_date', 'description', 'custom_note',
            'custom_frequency', 'custom_reset_date', 'priority', 'status'
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
            # Year End validation passed
        elif field_name in ['custom_process_date', 'custom_lodgment_due_date', 'custom_lodgement_due_date', 'custom_due_date', 'custom_reset_date']:
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
                            # Date validation passed
                        # Check if it's DD-MM-YYYY format
                        elif len(parts[2]) == 4:
                            datetime.strptime(new_value, '%d-%m-%Y')
                            # Convert DD-MM-YYYY to YYYY-MM-DD for storage
                            new_value = f"{parts[2]}-{parts[1]}-{parts[0]}"
                            # Date converted from DD-MM-YYYY to YYYY-MM-DD
                        else:
                            return {'success': False, 'error': f'Date must be in DD-MM-YYYY or YYYY-MM-DD format.'}
                    else:
                        return {'success': False, 'error': f'Date must be in DD-MM-YYYY or YYYY-MM-DD format.'}
                except ValueError:
                    return {'success': False, 'error': f'Invalid date format. Please use DD-MM-YYYY or YYYY-MM-DD.'}
        elif field_name in ['custom_tftg', 'custom_tf_tg']:
            # For TF/TG field, try to find the company
            # Saving TF/TG value
            
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
                            # Company found
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
def get_subtask_count(parent_task_id):
    """Get subtask count for a single parent task"""
    try:
        count = frappe.db.count("Task", {
            "parent_task": parent_task_id,
            "custom_is_archived": ["!=", 1]  # Exclude archived subtasks from count
        })
        
        return {
            'success': True,
            'count': count
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting subtask count for task {parent_task_id}: {str(e)}")
        return {
            'success': False,
            'error': str(e),
            'count': 0
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
        if not query or len(query.strip()) < 1:
            return {'success': True, 'customers': []}
        
        # Search customers by customer_name - include custom fields if they exist
        try:
            # Try to get custom_year_end field if it exists
            customers = frappe.get_all("Customer",
                filters={
                    "customer_name": ["like", f"%{query}%"],
                    "disabled": 0
                },
                fields=["name", "customer_name", "customer_type", "custom_year_end"],
                limit=10,
                order_by="customer_name"
            )
        except Exception:
            # Fallback if custom_year_end field doesn't exist
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
        
        # Handle removing client (customer_id is None or empty)
        if not customer_id:
            task.custom_client = None
            task.save()
            return {
                'success': True,
                'message': 'Client removed from task successfully',
                'customer_name': None,
                'customer_type': None
            }
        
        # Get customer info for linking
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

def get_communication_methods_info(task_doc):
    """
    Get all communication methods assignments for display
    """
    try:
        if not hasattr(task_doc, 'custom_communication_methods') or not task_doc.custom_communication_methods:
            return None
        
        # Get all communication methods assignments
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
        
        # Get all client contacts assignments
        contacts = []
        for contact_assignment in task_doc.custom_client_contacts:
            contacts.append({
                'contact': contact_assignment.contact,
                'contact_name': contact_assignment.contact_name
            })
        
        return contacts if contacts else None
        
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
def get_task_communication_methods(task_id):
    """
    Get communication methods for a task
    带缓存机制，减少重复查询
    """
    try:
        # 缓存键
        cache_key = f"smart_accounting:task_comm_methods:{task_id}"
        
        # 尝试从缓存获取
        cached_result = frappe.cache().get_value(cache_key)
        if cached_result:
            return cached_result
        
        task_doc = frappe.get_doc('Task', task_id)
        
        if not hasattr(task_doc, 'custom_communication_methods') or not task_doc.custom_communication_methods:
            result = {
                'success': True,
                'communication_methods': []
            }
        else:
            methods = []
            for method_assignment in task_doc.custom_communication_methods:
                methods.append({
                    'communication_method': method_assignment.communication_method,
                    'is_primary': method_assignment.is_primary
                })
            
            result = {
                'success': True,
                'communication_methods': methods
            }
        
        # 缓存结果5分钟
        frappe.cache().set_value(cache_key, result, expires_in_sec=300)
        return result
        
    except Exception as e:
        frappe.log_error(f"Error getting task communication methods: {str(e)}")
        return {
            'success': False,
            'error': str(e),
            'communication_methods': []
        }

@frappe.whitelist()
def update_task_communication_methods(task_id, communication_methods):
    """
    Update communication methods for a task
    """
    try:
        import json
        
        # Parse communication methods if it's a string
        if isinstance(communication_methods, str):
            communication_methods = json.loads(communication_methods)
        
        task_doc = frappe.get_doc('Task', task_id)
        
        # Clear existing communication methods
        task_doc.custom_communication_methods = []
        
        # Add new communication methods
        for method_data in communication_methods:
            task_doc.append('custom_communication_methods', {
                'communication_method': method_data.get('communication_method'),
                'is_primary': method_data.get('is_primary', 0)
            })
        
        # Save the task
        task_doc.save()
        frappe.db.commit()
        
        # 清除相关缓存
        cache_key = f"smart_accounting:task_comm_methods:{task_id}"
        frappe.cache().delete_value(cache_key)
        
        return {
            'success': True,
            'message': 'Communication methods updated successfully'
        }
        
    except Exception as e:
        frappe.log_error(f"Error updating task communication methods: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist()
def get_client_contacts(client_id):
    """
    Get all contacts for a specific client
    """
    try:
        if not client_id:
            return {
                'success': False,
                'error': 'Client ID is required',
                'contacts': []
            }
        
        # Get client name
        client_doc = frappe.get_doc('Customer', client_id)
        client_name = client_doc.customer_name or client_doc.name
        
        # Get contacts linked to this customer
        contacts = frappe.get_all('Contact', 
            filters={
                'status': 'Open'  # Only active contacts
            },
            fields=['name', 'first_name', 'last_name', 'email_id', 'phone', 'mobile_no']
        )
        
        # Filter contacts that are linked to this customer
        linked_contacts = []
        for contact in contacts:
            # Check if this contact is linked to the customer
            contact_links = frappe.get_all('Dynamic Link',
                filters={
                    'parent': contact.name,
                    'parenttype': 'Contact',
                    'link_doctype': 'Customer',
                    'link_name': client_id
                }
            )
            
            if contact_links:
                # Add phone number (prefer mobile over phone)
                contact['phone'] = contact.get('mobile_no') or contact.get('phone')
                linked_contacts.append(contact)
        
        return {
            'success': True,
            'client_name': client_name,
            'contacts': linked_contacts
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting client contacts: {str(e)}")
        return {
            'success': False,
            'error': str(e),
            'contacts': []
        }

@frappe.whitelist()
def get_task_client(task_id):
    """
    Get the client ID for a task
    """
    try:
        task_doc = frappe.get_doc('Task', task_id)
        client_id = getattr(task_doc, 'custom_client', None)
        
        return {
            'success': True,
            'client_id': client_id
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting task client: {str(e)}")
        return {
            'success': False,
            'error': str(e),
            'client_id': None
        }

@frappe.whitelist()
def get_task_contacts(task_id):
    """
    Get contacts for a task
    """
    try:
        task_doc = frappe.get_doc('Task', task_id)
        
        if not hasattr(task_doc, 'custom_client_contacts') or not task_doc.custom_client_contacts:
            return {
                'success': True,
                'contacts': []
            }
        
        contacts = []
        for contact_assignment in task_doc.custom_client_contacts:
            contacts.append({
                'contact': contact_assignment.contact,
                'contact_name': contact_assignment.contact_name
            })
        
        return {
            'success': True,
            'contacts': contacts
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting task contacts: {str(e)}")
        return {
            'success': False,
            'error': str(e),
            'contacts': []
        }

@frappe.whitelist()
def update_task_contacts(task_id, contacts):
    """
    Update contacts for a task
    """
    try:
        import json
        
        # Parse contacts if it's a string
        if isinstance(contacts, str):
            contacts = json.loads(contacts)
        
        task_doc = frappe.get_doc('Task', task_id)
        
        # Clear existing contacts
        task_doc.custom_client_contacts = []
        
        # Add new contacts
        for contact_data in contacts:
            task_doc.append('custom_client_contacts', {
                'contact': contact_data.get('contact'),
                'contact_name': contact_data.get('contact_name')
            })
        
        # Save the task
        task_doc.save()
        frappe.db.commit()
        
        return {
            'success': True,
            'message': 'Client contacts updated successfully'
        }
        
    except Exception as e:
        frappe.log_error(f"Error updating task contacts: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist()
def create_client_contact(client_id, contact_data):
    """
    Create a new contact for a client
    """
    try:
        import json
        
        # Parse contact data if it's a string
        if isinstance(contact_data, str):
            contact_data = json.loads(contact_data)
        
        # Validate required fields
        if not contact_data.get('first_name') or not contact_data.get('email_id'):
            return {
                'success': False,
                'error': 'First name and email are required'
            }
        
        # Check if contact with this email already exists
        existing_contact = frappe.db.exists('Contact', {'email_id': contact_data.get('email_id')})
        if existing_contact:
            return {
                'success': False,
                'error': 'A contact with this email already exists'
            }
        
        # Create new contact
        contact_doc = frappe.get_doc({
            'doctype': 'Contact',
            'first_name': contact_data.get('first_name'),
            'last_name': contact_data.get('last_name', ''),
            'email_id': contact_data.get('email_id'),
            'phone': contact_data.get('phone', ''),
            'mobile_no': contact_data.get('mobile_no', ''),
            'designation': contact_data.get('designation', ''),
            'status': 'Open'
        })
        
        # Insert the contact
        contact_doc.insert()
        
        # Link the contact to the customer
        contact_doc.append('links', {
            'link_doctype': 'Customer',
            'link_name': client_id
        })
        
        # Save the contact with the link
        contact_doc.save()
        frappe.db.commit()
        
        return {
            'success': True,
            'message': 'Contact created successfully',
            'contact_id': contact_doc.name,
            'contact_name': f"{contact_data.get('first_name', '')} {contact_data.get('last_name', '')}".strip()
        }
        
    except Exception as e:
        frappe.log_error(f"Error creating client contact: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist()
def auto_update_partition_column_configs():
    """
    Automatically update all partition column configs to include new columns
    """
    try:
        # Get the latest column definitions from ColumnConfigManager
        latest_columns = [
            'client', 'task-name', 'entity', 'tf-tg', 'software', 'communication-methods', 'client-contact', 'status', 
            'note', 'target-month', 'budget', 'actual', 'review-note', 
            'action-person', 'preparer', 'reviewer', 'partner', 'lodgment-due', 
            'engagement', 'group', 'year-end', 'last-updated', 'priority', 'frequency', 'reset-date'
        ]
        
        # Get all partitions
        partitions = frappe.get_all('Partition', fields=['name', 'visible_columns', 'column_config'])
        
        updated_count = 0
        
        for partition in partitions:
            try:
                import json
                
                # Parse current configuration
                current_visible = json.loads(partition.visible_columns) if partition.visible_columns else []
                current_config = json.loads(partition.column_config) if partition.column_config else {}
                
                # Check if we need to add new columns
                new_columns_to_add = []
                for col in ['communication-methods', 'client-contact']:
                    if col not in current_visible:
                        new_columns_to_add.append(col)
                
                if new_columns_to_add:
                    # Add new columns after 'software' column
                    updated_visible = current_visible.copy()
                    
                    # Find the position of 'software' column
                    software_index = -1
                    try:
                        software_index = updated_visible.index('software')
                    except ValueError:
                        # If 'software' not found, add at the end
                        software_index = len(updated_visible) - 1
                    
                    # Insert new columns after software
                    insert_position = software_index + 1
                    for i, col in enumerate(new_columns_to_add):
                        updated_visible.insert(insert_position + i, col)
                    
                    # Update column order in config
                    if 'column_order' not in current_config:
                        current_config['column_order'] = updated_visible.copy()
                    else:
                        # Update column order to match visible columns
                        config_order = current_config['column_order'].copy()
                        for col in new_columns_to_add:
                            if col not in config_order:
                                # Insert after software in column order too
                                try:
                                    software_order_index = config_order.index('software')
                                    config_order.insert(software_order_index + 1, col)
                                except ValueError:
                                    config_order.append(col)
                        current_config['column_order'] = config_order
                    
                    # Update the partition document
                    partition_doc = frappe.get_doc('Partition', partition.name)
                    partition_doc.visible_columns = json.dumps(updated_visible)
                    partition_doc.column_config = json.dumps(current_config)
                    partition_doc.save()
                    
                    updated_count += 1
                    
                    frappe.logger().info(f"Updated partition '{partition.name}' with new columns: {new_columns_to_add}")
                
            except Exception as e:
                frappe.log_error(f"Error updating partition {partition.name}: {str(e)}")
                continue
        
        if updated_count > 0:
            frappe.db.commit()
        
        return {
            'success': True,
            'message': f'Successfully updated {updated_count} partitions with new column configurations',
            'updated_count': updated_count,
            'total_partitions': len(partitions)
        }
        
    except Exception as e:
        frappe.log_error(f"Error in auto_update_partition_column_configs: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist()
def sync_all_partition_columns():
    """
    Sync all partition columns with the latest column definitions
    This is a more comprehensive update that ensures all partitions have the latest column structure
    """
    try:
        # Get the complete latest column definitions
        latest_columns = [
            'client', 'task-name', 'entity', 'tf-tg', 'software', 'communication-methods', 'client-contact', 'status', 
            'note', 'target-month', 'budget', 'actual', 'review-note', 
            'action-person', 'preparer', 'reviewer', 'partner', 'lodgment-due', 
            'engagement', 'group', 'year-end', 'last-updated', 'priority', 'frequency', 'reset-date'
        ]
        
        # Get all partitions
        partitions = frappe.get_all('Partition', fields=['name', 'partition_name'])
        
        updated_count = 0
        
        for partition in partitions:
            try:
                import json
                
                # Update the partition with latest column structure
                partition_doc = frappe.get_doc('Partition', partition.name)
                
                # Set the latest visible columns
                partition_doc.visible_columns = json.dumps(latest_columns)
                
                # Set the latest column config
                column_config = {
                    'column_order': latest_columns.copy()
                }
                partition_doc.column_config = json.dumps(column_config)
                
                partition_doc.save()
                updated_count += 1
                
                frappe.logger().info(f"Synced partition '{partition.partition_name}' ({partition.name}) with latest columns")
                
            except Exception as e:
                frappe.log_error(f"Error syncing partition {partition.name}: {str(e)}")
                continue
        
        if updated_count > 0:
            frappe.db.commit()
        
        return {
            'success': True,
            'message': f'Successfully synced {updated_count} partitions with latest column structure',
            'updated_count': updated_count,
            'total_partitions': len(partitions),
            'latest_columns': latest_columns
        }
        
    except Exception as e:
        frappe.log_error(f"Error in sync_all_partition_columns: {str(e)}")
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
def get_data_count(view='main', filters=None):
    """
    快速获取数据总数，用于虚拟滚动和性能优化
    """
    try:
        if filters and isinstance(filters, str):
            filters = frappe.parse_json(filters)
        
        # 构建查询条件
        conditions = []
        values = []
        
        if view != 'main':
            # 获取特定视图的项目
            partition_projects = frappe.get_all("Project", 
                filters={"custom_partition": view},
                fields=["name"]
            )
            if partition_projects:
                project_names = [p.name for p in partition_projects]
                conditions.append("project IN ({})".format(','.join(['%s'] * len(project_names))))
                values.extend(project_names)
        
        # 应用过滤器
        if filters:
            if filters.get('client'):
                conditions.append("custom_client = %s")
                values.append(filters['client'])
            if filters.get('status'):
                conditions.append("status = %s")
                values.append(filters['status'])
        
        # 构建SQL查询
        where_clause = " AND ".join(conditions) if conditions else "1=1"
        
        count = frappe.db.sql(f"""
            SELECT COUNT(*) as total
            FROM `tabTask`
            WHERE {where_clause}
        """, values)[0][0]
        
        return {
            'success': True,
            'total_count': count
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting data count: {str(e)}")
        return {'success': False, 'error': str(e)}

@frappe.whitelist()
def get_paginated_data(view='main', offset=0, limit=50, filters=None):
    """
    分页获取数据，支持大数据量的高性能加载
    """
    try:
        offset = int(offset)
        limit = min(int(limit), 200)  # 限制最大每页数量
        
        if filters and isinstance(filters, str):
            filters = frappe.parse_json(filters)
        
        # 使用优化的查询
        data = get_project_management_data_paginated(view, offset, limit, filters)
        
        return {
            'success': True,
            'data': data.get('tasks', []),
            'offset': offset,
            'limit': limit,
            'has_more': len(data.get('tasks', [])) == limit
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting paginated data: {str(e)}")
        return {'success': False, 'error': str(e)}

def get_project_management_data_paginated(view='main', offset=0, limit=50, filters=None):
    """
    优化的分页数据获取，支持大数据量
    """
    try:
        # Build base query with table aliases
        conditions = ["1=1"]
        values = []
        
        if view != 'main':
            # Get projects for specific view
            partition_projects = frappe.get_all("Project", 
                filters={"custom_partition": view},
                fields=["name"]
            )
            if partition_projects:
                project_names = [p.name for p in partition_projects]
                conditions.append("t.project IN ({})".format(','.join(['%s'] * len(project_names))))
                values.extend(project_names)
        
        # Apply filters with table aliases
        if filters:
            if filters.get('client'):
                conditions.append("t.custom_client = %s")
                values.append(filters['client'])
            if filters.get('status'):
                conditions.append("t.status = %s")
                values.append(filters['status'])
        
        where_clause = " AND ".join(conditions)
        
        # Optimized SQL query with JOIN for proper client name sorting
        tasks_data = frappe.db.sql(f"""
            SELECT 
                t.name as task_id,
                t.subject as task_name,
                t.custom_client,
                t.status,
                t.custom_entity_type,
                t.custom_action_person,
                t.custom_preparer,
                t.custom_reviewer,
                t.custom_partner,
                t.modified as last_modified,
                COALESCE(c.customer_name, 'No Client') as client_name
            FROM `tabTask` t
            LEFT JOIN `tabCustomer` c ON t.custom_client = c.name
            WHERE {where_clause}
            ORDER BY COALESCE(c.customer_name, 'No Client'), t.subject
            LIMIT %s OFFSET %s
        """, values + [limit, offset], as_dict=True)
        
        # Client info is already included in the SQL query via JOIN
        # No need for separate client lookup
        
        # 批量获取角色信息（只获取必要的）
        task_ids = [t.task_id for t in tasks_data]
        roles_info = get_bulk_roles_info(task_ids)
        
        # 组装数据
        enriched_tasks = []
        for task in tasks_data:
            enriched_task = {
                'task_id': task.task_id,
                'task_name': task.task_name,
                'client_name': task.client_name,  # Already from SQL JOIN
                'status': task.status,
                'entity_type': task.custom_entity_type or 'Company',
                'action_person_info': roles_info.get(task.task_id, {}).get('action_person', []),
                'last_modified': task.last_modified
            }
            enriched_tasks.append(enriched_task)
        
        return {
            'tasks': enriched_tasks,
            'total_loaded': len(enriched_tasks)
        }
        
    except Exception as e:
        frappe.log_error(f"Error in paginated data fetch: {str(e)}")
        return {'tasks': [], 'total_loaded': 0}

def get_bulk_roles_info(task_ids):
    """
    批量获取角色信息，优化性能
    """
    if not task_ids:
        return {}
    
    # 批量查询所有角色
    roles = frappe.get_all("Task Role Assignment",
        filters={"parent": ["in", task_ids]},
        fields=["parent", "role", "user", "is_primary"]
    )
    
    # 按任务分组
    task_roles = {}
    for role in roles:
        task_id = role.parent
        if task_id not in task_roles:
            task_roles[task_id] = {}
        
        role_type = role.role.lower().replace(' ', '_')
        if role_type not in task_roles[task_id]:
            task_roles[task_id][role_type] = []
        
        # 获取用户信息
        user_info = get_user_info(role.user)
        if user_info:
            task_roles[task_id][role_type].append(user_info)
    
    return task_roles

@frappe.whitelist()
def get_bulk_task_roles(task_ids):
    """
    批量获取多个任务的角色信息，优化性能
    """
    try:
        if isinstance(task_ids, str):
            task_ids = frappe.parse_json(task_ids)
        
        if not task_ids:
            return {'success': False, 'error': 'Task IDs are required'}
        
        # 批量获取所有角色信息
        all_roles = frappe.get_all("Task Role Assignment",
            filters={"parent": ["in", task_ids]},
            fields=["parent", "role", "user", "is_primary"],
            order_by="parent, is_primary desc, role, user"
        )
        
        # 按任务ID分组
        task_roles = {}
        for role in all_roles:
            task_id = role.parent
            if task_id not in task_roles:
                task_roles[task_id] = []
            task_roles[task_id].append({
                'role': role.role,
                'user': role.user,
                'is_primary': role.is_primary
            })
        
        # 确保所有请求的任务ID都有返回值（即使是空数组）
        for task_id in task_ids:
            if task_id not in task_roles:
                task_roles[task_id] = []
        
        return {
            'success': True,
            'task_roles': task_roles
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting bulk task roles: {str(e)}")
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
def update_task_person_role(task_id, role_type, user_email):
    """
    Update a single person role for a task - optimized for bulk updates
    
    Args:
        task_id: Task ID to update
        role_type: Role type (action_person, preparer, reviewer, partner)
        user_email: User email to assign (can be None to clear)
    
    Returns:
        dict: Success/error response
    """
    try:
        # Get task document
        task_doc = frappe.get_doc("Task", task_id)
        
        # Check if custom_roles field exists
        if not hasattr(task_doc, 'custom_roles'):
            return {
                'success': False, 
                'error': 'Task Role Assignment sub-table not available.'
            }
        
        # Map role types to display names
        role_mapping = {
            'action_person': 'Action Person',
            'preparer': 'Preparer',
            'reviewer': 'Reviewer',
            'partner': 'Partner'
        }
        
        mapped_role = role_mapping.get(role_type, role_type)
        
        # Remove existing assignments for this role type
        task_doc.custom_roles = [
            role for role in task_doc.custom_roles 
            if role.role != mapped_role
        ]
        
        # Add new assignment if user_email provided
        if user_email and user_email.strip():
            # Validate user exists and is enabled
            if not frappe.db.exists("User", user_email):
                return {
                    'success': False,
                    'error': f'User {user_email} does not exist'
                }
                
            user_enabled = frappe.db.get_value("User", user_email, "enabled")
            if not user_enabled:
                return {
                    'success': False,
                    'error': f'User {user_email} is disabled'
                }
            
            # Add new role assignment
            task_doc.append('custom_roles', {
                'role': mapped_role,
                'user': user_email,
                'is_primary': 1  # Always primary for single role assignments
            })
            
            # Also update the legacy field for backward compatibility
            legacy_field_map = {
                'action_person': 'custom_action_person',
                'preparer': 'custom_preparer',
                'reviewer': 'custom_reviewer',
                'partner': 'custom_partner'
            }
            
            legacy_field = legacy_field_map.get(role_type)
            if legacy_field and hasattr(task_doc, legacy_field):
                setattr(task_doc, legacy_field, user_email)
        else:
            # Clear legacy field if clearing role
            legacy_field_map = {
                'action_person': 'custom_action_person',
                'preparer': 'custom_preparer',
                'reviewer': 'custom_reviewer',
                'partner': 'custom_partner'
            }
            
            legacy_field = legacy_field_map.get(role_type)
            if legacy_field and hasattr(task_doc, legacy_field):
                setattr(task_doc, legacy_field, None)
        
        # Save the task
        task_doc.save(ignore_permissions=True)
        frappe.db.commit()
        
        return {
            'success': True,
            'message': f'Task {role_type} updated successfully',
            'task_id': task_id,
            'role_type': role_type,
            'user_email': user_email
        }
        
    except Exception as e:
        frappe.db.rollback()
        frappe.log_error(f"Error updating task person role for {task_id}: {str(e)}")
        return {
            'success': False,
            'error': f'Failed to update task role: {str(e)}'
        }


@frappe.whitelist()
def get_software_options():
    """
    Get available software options from Task Software DocType
    带缓存机制，避免重复的元数据查询
    """
    # 缓存键
    cache_key = "smart_accounting:software_options"
    
    # 尝试从缓存获取
    cached_result = frappe.cache().get_value(cache_key)
    if cached_result:
        return cached_result
    
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
            result = {'success': True, 'software_options': options}
        else:
            # Fallback to default options if not configured
            result = {
                'success': True, 
                'software_options': ['Xero', 'MYOB', 'QuickBooks', 'Excel', 'Payroller', 'Oracle', 'Logdit', 'Other']
            }
        
        # 缓存结果1小时
        frappe.cache().set_value(cache_key, result, expires_in_sec=3600)
        return result
            
    except Exception as e:
        frappe.log_error(f"Error getting software options: {str(e)}")
        # Return default options on error
        result = {
            'success': True,
            'software_options': ['Xero', 'MYOB', 'QuickBooks', 'Excel', 'Other']
        }
        # 缓存错误结果较短时间（5分钟）
        frappe.cache().set_value(cache_key, result, expires_in_sec=300)
        return result

@frappe.whitelist()
def get_task_softwares(task_id):
    """
    Get task software assignments from sub-table
    带短期缓存机制，减少重复查询
    """
    try:
        if not task_id:
            return {'success': False, 'error': 'Task ID is required'}
        
        # 缓存键
        cache_key = f"smart_accounting:task_softwares:{task_id}"
        
        # 尝试从缓存获取
        cached_result = frappe.cache().get_value(cache_key)
        if cached_result:
            return cached_result
        
        # Get softwares from sub-table
        softwares = frappe.get_all("Task Software",
            filters={"parent": task_id},
            fields=["software", "is_primary"],
            order_by="is_primary desc, software"
        )
        
        result = {
            'success': True,
            'softwares': softwares
        }
        
        # 缓存结果5分钟
        frappe.cache().set_value(cache_key, result, expires_in_sec=300)
        return result
        
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
        
        # 清除相关缓存
        cache_key = f"smart_accounting:task_softwares:{task_id}"
        frappe.cache().delete_value(cache_key)
        
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
    带缓存机制和批量查询优化
    """
    try:
        # 缓存键
        cache_key = f"smart_accounting:task_roles:{task_id}:{role_filter or 'all'}"
        
        # 尝试从缓存获取
        cached_result = frappe.cache().get_value(cache_key)
        if cached_result:
            return cached_result
        
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
        
        # 批量获取用户信息，避免N+1查询问题
        role_assignments = []
        if assignments:
            # 提取所有用户邮箱
            user_emails = list(set([assignment.user for assignment in assignments]))
            
            # 批量查询用户信息
            users_info = {}
            if user_emails:
                try:
                    users_data = frappe.get_all("User",
                        filters={"email": ["in", user_emails]},
                        fields=["email", "full_name"],
                        as_dict=True
                    )
                    users_info = {user.email: user for user in users_data}
                except Exception as e:
                    frappe.log_error(f"Error batch loading user info: {str(e)}")
            
            # 组装结果
            for assignment in assignments:
                user_info = users_info.get(assignment.user)
                if user_info:
                    role_assignments.append({
                        "user": assignment.user,
                        "role": assignment.role,
                        "is_primary": assignment.is_primary,
                        "full_name": user_info.full_name,
                        "email": user_info.email
                    })
                else:
                    # 降级处理：用户信息获取失败时的默认值
                    role_assignments.append({
                        "user": assignment.user,
                        "role": assignment.role,
                        "is_primary": assignment.is_primary,
                        "full_name": assignment.user,
                        "email": assignment.user
                    })
        
        result = {
            'success': True,
            'role_assignments': role_assignments
        }
        
        # 缓存结果5分钟
        frappe.cache().set_value(cache_key, result, expires_in_sec=300)
        return result
        
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

@frappe.whitelist()
def create_customer_and_link(task_id, customer_name, year_end="June", customer_type="Company"):
    """
    Create a new customer with detailed information and link to task
    """
    try:
        # Validate inputs
        if not task_id or not customer_name:
            return {
                'success': False,
                'error': 'Task ID and customer name are required'
            }
        
        customer_name = customer_name.strip()
        if len(customer_name) < 1:
            return {
                'success': False,
                'error': 'Customer name cannot be empty'
            }
        
        # Check if customer already exists
        existing = frappe.db.get_value("Customer", {"customer_name": customer_name})
        if existing:
            # Link existing customer to task
            link_response = update_task_client(task_id, existing)
            if link_response.get('success'):
                return {
                    'success': True,
                    'customer_id': existing,
                    'customer_name': customer_name,
                    'message': 'Existing customer linked to task',
                    'was_existing': True
                }
            else:
                return link_response
        
        # Create new customer with enhanced fields
        new_customer = frappe.new_doc("Customer")
        new_customer.customer_name = customer_name
        new_customer.customer_type = customer_type
        
        # Set year end if custom field exists
        if hasattr(new_customer, 'custom_year_end'):
            new_customer.custom_year_end = year_end
        
        # Set default required fields
        new_customer.customer_group = frappe.db.get_single_value("Selling Settings", "customer_group") or "All Customer Groups"
        new_customer.territory = frappe.db.get_single_value("Selling Settings", "territory") or "All Territories"
        
        # Save customer
        new_customer.save()
        
        # Link customer to task
        link_response = update_task_client(task_id, new_customer.name)
        if not link_response.get('success'):
            # If linking fails, still return success for customer creation
            frappe.log_error(f"Customer created but linking failed: {link_response.get('error')}")
            return {
                'success': True,
                'customer_id': new_customer.name,
                'customer_name': new_customer.customer_name,
                'message': 'Customer created but linking to task failed',
                'link_error': link_response.get('error')
            }
        
        return {
            'success': True,
            'customer_id': new_customer.name,
            'customer_name': new_customer.customer_name,
            'customer_type': new_customer.customer_type,
            'year_end': year_end,
            'message': 'Customer created and linked successfully'
        }
        
    except Exception as e:
        error_msg = f"Create customer and link error: {str(e)}"
        frappe.log_error(error_msg)
        return {
            'success': False,
            'error': str(e)
        }

# Client Management System API Methods
# Comprehensive CRUD operations for client management

@frappe.whitelist()
def get_all_clients():
    """
    Get all clients with statistics for client management system
    """
    try:
        # Get all customers with enhanced information
        customers = frappe.get_all("Customer",
            fields=[
                "name", "customer_name", "customer_type", "territory", 
                "customer_group", "disabled", "website", "creation", 
                "modified", "customer_primary_contact", "customer_primary_address"
            ],
            order_by="customer_name"
        )
        
        # Enhance each customer with statistics
        enhanced_customers = []
        for customer in customers:
            # Get project count
            project_count = frappe.db.count("Project", {
                "customer": customer.name,
                "status": ["!=", "Cancelled"]
            })
            
            # Get task count and active task count
            task_count = frappe.db.count("Task", {
                "custom_client": customer.name
            })
            
            active_task_count = frappe.db.count("Task", {
                "custom_client": customer.name,
                "status": ["not in", ["Completed", "Cancelled"]]
            })
            
            # Get client group (from custom field if exists)
            client_group = None
            try:
                if hasattr(frappe.get_doc("Customer", customer.name), 'client_group'):
                    client_group = frappe.db.get_value("Customer", customer.name, "client_group")
            except:
                pass
            
            enhanced_customer = customer.copy()
            enhanced_customer.update({
                'project_count': project_count,
                'task_count': task_count,
                'active_tasks': active_task_count,
                'client_group': client_group
            })
            
            enhanced_customers.append(enhanced_customer)
        
        return {
            'success': True,
            'clients': enhanced_customers,
            'total_count': len(enhanced_customers)
        }
        
    except Exception as e:
        frappe.log_error(f"Get all clients error: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist()
def get_client_details(client_id):
    """
    Get detailed information for a specific client
    """
    try:
        if not client_id:
            return {
                'success': False,
                'error': 'Client ID is required'
            }
        
        # Get customer document
        customer = frappe.get_doc("Customer", client_id)
        
        # Get enhanced statistics
        project_count = frappe.db.count("Project", {
            "customer": client_id,
            "status": ["!=", "Cancelled"]
        })
        
        task_count = frappe.db.count("Task", {
            "custom_client": client_id
        })
        
        active_task_count = frappe.db.count("Task", {
            "custom_client": client_id,
            "status": ["not in", ["Completed", "Cancelled"]]
        })
        
        # Get recent projects
        recent_projects = frappe.get_all("Project",
            filters={
                "customer": client_id,
                "status": ["!=", "Cancelled"]
            },
            fields=["name", "project_name", "status", "creation"],
            order_by="creation desc",
            limit=5
        )
        
        # Get recent tasks
        recent_tasks = frappe.get_all("Task",
            filters={
                "custom_client": client_id
            },
            fields=["name", "subject", "status", "creation", "project"],
            order_by="creation desc",
            limit=10
        )
        
        # Prepare client details
        client_details = {
            'name': customer.name,
            'customer_name': customer.customer_name,
            'customer_type': customer.customer_type,
            'territory': customer.territory,
            'customer_group': customer.customer_group,
            'disabled': customer.disabled,
            'website': customer.website,
            'creation': customer.creation,
            'modified': customer.modified,
            'customer_primary_contact': customer.customer_primary_contact,
            'customer_primary_address': customer.customer_primary_address,
            'project_count': project_count,
            'task_count': task_count,
            'active_tasks': active_task_count,
            'recent_projects': recent_projects,
            'recent_tasks': recent_tasks
        }
        
        # Add custom fields if they exist
        try:
            if hasattr(customer, 'client_group'):
                client_details['client_group'] = customer.client_group
            if hasattr(customer, 'custom_year_end'):
                client_details['custom_year_end'] = customer.custom_year_end
            if hasattr(customer, 'custom_company'):
                client_details['custom_company'] = customer.custom_company
            if hasattr(customer, 'custom_entity_type'):
                client_details['custom_entity_type'] = customer.custom_entity_type
        except:
            pass
        
        return {
            'success': True,
            'client': client_details
        }
        
    except Exception as e:
        frappe.log_error(f"Get client details error: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist()
def create_client(customer_name, customer_type="Company", territory=None, customer_group=None, 
                 client_group=None, website=None, disabled=0, custom_year_end="June"):
    """
    Create a new client with comprehensive fields
    """
    try:
        if not customer_name or not customer_name.strip():
            return {
                'success': False,
                'error': 'Customer name is required'
            }
        
        customer_name = customer_name.strip()
        
        # Check if customer already exists
        existing = frappe.db.get_value("Customer", {"customer_name": customer_name})
        if existing:
            return {
                'success': False,
                'error': f'Customer with name "{customer_name}" already exists'
            }
        
        # Create new customer
        new_customer = frappe.new_doc("Customer")
        new_customer.customer_name = customer_name
        new_customer.customer_type = customer_type or "Company"
        new_customer.disabled = int(disabled) if disabled else 0
        
        # Set territory
        if territory:
            new_customer.territory = territory
        else:
            new_customer.territory = frappe.db.get_single_value("Selling Settings", "territory") or "All Territories"
        
        # Set customer group
        if customer_group:
            new_customer.customer_group = customer_group
        else:
            new_customer.customer_group = frappe.db.get_single_value("Selling Settings", "customer_group") or "All Customer Groups"
        
        # Set website if provided
        if website:
            new_customer.website = website
        
        # Set custom fields if they exist
        try:
            if client_group and hasattr(new_customer, 'client_group'):
                new_customer.client_group = client_group
            if custom_year_end and hasattr(new_customer, 'custom_year_end'):
                new_customer.custom_year_end = custom_year_end
        except:
            pass
        
        # Save customer
        new_customer.save()
        
        return {
            'success': True,
            'customer_id': new_customer.name,
            'customer_name': new_customer.customer_name,
            'message': 'Client created successfully'
        }
        
    except Exception as e:
        frappe.log_error(f"Create client error: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist()
def update_client(client_id, customer_name=None, customer_type=None, territory=None, 
                 customer_group=None, client_group=None, website=None, disabled=None, custom_year_end=None):
    """
    Update an existing client
    """
    try:
        if not client_id:
            return {
                'success': False,
                'error': 'Client ID is required'
            }
        
        # Get existing customer
        customer = frappe.get_doc("Customer", client_id)
        
        # Update fields if provided
        if customer_name and customer_name.strip():
            # Check if new name conflicts with existing customers (excluding current)
            existing = frappe.db.get_value("Customer", {
                "customer_name": customer_name.strip(),
                "name": ["!=", client_id]
            })
            if existing:
                return {
                    'success': False,
                    'error': f'Another customer with name "{customer_name}" already exists'
                }
            customer.customer_name = customer_name.strip()
        
        if customer_type:
            customer.customer_type = customer_type
        
        if territory:
            customer.territory = territory
            
        if customer_group:
            customer.customer_group = customer_group
        
        if website is not None:  # Allow empty string to clear website
            customer.website = website
        
        if disabled is not None:
            customer.disabled = int(disabled)
        
        # Update custom fields if they exist
        try:
            if client_group is not None and hasattr(customer, 'client_group'):
                customer.client_group = client_group
            if custom_year_end is not None and hasattr(customer, 'custom_year_end'):
                customer.custom_year_end = custom_year_end
        except:
            pass
        
        # Save customer
        customer.save()
        
        return {
            'success': True,
            'customer_id': customer.name,
            'customer_name': customer.customer_name,
            'message': 'Client updated successfully'
        }
        
    except Exception as e:
        frappe.log_error(f"Update client error: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist()
def delete_client(client_id):
    """
    Delete a client (with safety checks)
    """
    try:
        if not client_id:
            return {
                'success': False,
                'error': 'Client ID is required'
            }
        
        # Check if client has associated projects
        project_count = frappe.db.count("Project", {
            "customer": client_id,
            "status": ["!=", "Cancelled"]
        })
        
        if project_count > 0:
            return {
                'success': False,
                'error': f'Cannot delete client. {project_count} active projects are associated with this client.'
            }
        
        # Check if client has associated tasks
        task_count = frappe.db.count("Task", {
            "custom_client": client_id,
            "status": ["not in", ["Completed", "Cancelled"]]
        })
        
        if task_count > 0:
            return {
                'success': False,
                'error': f'Cannot delete client. {task_count} active tasks are associated with this client.'
            }
        
        # Get customer name for confirmation message
        customer_name = frappe.db.get_value("Customer", client_id, "customer_name")
        
        # Delete customer
        frappe.delete_doc("Customer", client_id)
        
        return {
            'success': True,
            'message': f'Client "{customer_name}" deleted successfully'
        }
        
    except Exception as e:
        frappe.log_error(f"Delete client error: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist()
def get_client_groups():
    """
    Get all available client groups for dropdown
    """
    try:
        # Try to get from Client Group doctype if it exists
        client_groups = []
        
        try:
            # First try to get from Client Group doctype
            client_groups = frappe.get_all("Client Group",
                fields=["name", "group_name"],
                order_by="group_name"
            )
        except:
            # Fallback: get unique client groups from existing customers
            try:
                unique_groups = frappe.db.sql("""
                    SELECT DISTINCT client_group as name, client_group as group_name
                    FROM `tabCustomer` 
                    WHERE client_group IS NOT NULL AND client_group != ''
                    ORDER BY client_group
                """, as_dict=True)
                client_groups = unique_groups
            except:
                # Final fallback: create some default groups if none exist
                client_groups = [
                    {"name": "individual_clients", "group_name": "Individual Clients"},
                    {"name": "corporate_clients", "group_name": "Corporate Clients"},
                    {"name": "small_business", "group_name": "Small Business"}
                ]
        
        return {
            'success': True,
            'client_groups': client_groups
        }
        
    except Exception as e:
        frappe.log_error(f"Get client groups error: {str(e)}")
        return {
            'success': False,
            'error': str(e),
            'client_groups': []
        }

@frappe.whitelist()
def get_project_form_data():
    """
    Get data needed for project creation form
    """
    try:
        # Get available partitions
        partitions = frappe.get_all("Partition", 
            fields=["name", "partition_name"],
            filters={"is_archived": ["!=", 1]},
            order_by="partition_name"
        )
        
        # Get service lines (if Service Line DocType exists)
        service_lines = []
        try:
            if frappe.db.exists("DocType", "Service Line"):
                # First try to get all service lines to debug
                all_service_lines = frappe.get_all("Service Line", 
                    fields=["*"],
                    limit=10
                )
                print(f"DEBUG: Found {len(all_service_lines)} service lines")
                for sl in all_service_lines:
                    print(f"DEBUG: Service Line: {sl}")
                
                # Get service lines with correct field names
                service_lines = frappe.get_all("Service Line",
                    fields=["name", "service_name"],
                    order_by="service_name"
                )
                print(f"DEBUG: Final service_lines: {service_lines}")
        except Exception as e:
            print(f"DEBUG: Error getting service lines: {str(e)}")
            # If Service Line DocType doesn't exist, return empty list
            pass
        
        return {
            'success': True,
            'partitions': partitions,
            'service_lines': service_lines
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting project form data: {str(e)}")
        return {
            'success': False,
            'error': str(e),
            'partitions': [],
            'service_lines': []
        }

@frappe.whitelist()
def create_project(project_name, service_line=None, partition=None, is_archived=0):
    """
    Create a new project with the provided data
    """
    try:
        if not project_name or not project_name.strip():
            return {'success': False, 'error': 'Project name is required'}
        
        if not partition:
            return {'success': False, 'error': 'Partition is required'}
        
        # Validate partition exists
        if not frappe.db.exists("Partition", partition):
            return {'success': False, 'error': f'Partition "{partition}" not found'}
        
        # Create new project
        project_doc = frappe.new_doc("Project")
        project_doc.project_name = project_name.strip()
        
        # Set default naming series
        if hasattr(project_doc, 'naming_series'):
            # Get default series from Project DocType
            try:
                series_list = frappe.get_meta("Project").get_field("naming_series")
                if series_list and series_list.options:
                    default_series = series_list.options.split('\n')[0].strip()
                    project_doc.naming_series = default_series
                else:
                    project_doc.naming_series = "PROJ-.####"
            except:
                project_doc.naming_series = "PROJ-.####"
        
        # Set service line if provided and field exists
        if service_line and hasattr(project_doc, 'service_line'):
            project_doc.service_line = service_line
        
        # Set partition (custom field)
        if hasattr(project_doc, 'custom_partition'):
            project_doc.custom_partition = partition
        
        # Set archived status
        if hasattr(project_doc, 'is_archived'):
            project_doc.is_archived = 1 if frappe.utils.cint(is_archived) else 0
        
        # Set default values
        project_doc.status = "Open"
        
        # Save the project
        project_doc.save()
        frappe.db.commit()
        
        return {
            'success': True,
            'message': f'Project "{project_name}" created successfully',
            'project_name': project_doc.name,
            'project_title': project_doc.project_name
        }
        
    except Exception as e:
        frappe.log_error(f"Error creating project: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist()
def get_available_boards_for_combination():
    """
    Get all available boards for combination view
    """
    try:
        # Get only boards (not workspaces) that are not archived
        boards = frappe.db.get_all("Partition",
            fields=["name", "partition_name", "description", "parent_partition"],
            filters={
                "is_workspace": 0,  # Only boards, not workspaces
                "is_archived": ["!=", 1]
            },
            order_by="partition_name"
        )
        
        # Get project and task counts for each board
        boards_with_stats = []
        for board in boards:
            # Get project count
            project_count = frappe.db.count("Project", {
                "custom_partition": board.name,
                "status": ["!=", "Cancelled"]
            })
            
            # Get task count through projects
            # First get projects for this board
            board_projects = frappe.db.get_all("Project", {
                "custom_partition": board.name,
                "status": ["!=", "Cancelled"]
            }, pluck="name")
            
            # Then count tasks in those projects
            task_count = 0
            if board_projects:
                task_count = frappe.db.count("Task", {
                    "project": ["in", board_projects],
                    "custom_is_archived": ["!=", 1],
                    "parent_task": ["is", "not set"]  # Only top-level tasks
                })
            
            boards_with_stats.append({
                "name": board.name,
                "partition_name": board.partition_name,
                "description": board.description,
                "project_count": project_count,
                "task_count": task_count
            })
        
        return {
            'success': True,
            'boards': boards_with_stats
        }
        
    except Exception as e:
        frappe.log_error(f"Get available boards error: {str(e)}")
        return {
            'success': False,
            'error': str(e),
            'boards': []
        }

@frappe.whitelist()
def test_combination_search(board_name):
    """
    Test function to debug combination view search
    """
    try:
        frappe.log_error(f"TEST: Searching for board: '{board_name}'", "Test Combination")
        
        # Test all search methods
        results = {}
        
        # Method 1: partition_name exact match
        result1 = frappe.db.get_value("Partition", 
            {"partition_name": board_name, "is_workspace": 0, "is_archived": ["!=", 1]}, 
            ["name", "partition_name", "description"], as_dict=True)
        results["method1_partition_name"] = result1
        
        # Method 2: name exact match  
        result2 = frappe.db.get_value("Partition", 
            {"name": board_name, "is_workspace": 0, "is_archived": ["!=", 1]}, 
            ["name", "partition_name", "description"], as_dict=True)
        results["method2_name"] = result2
        
        # Method 3: Get all partitions for manual comparison
        all_partitions = frappe.db.get_all("Partition",
            fields=["name", "partition_name", "is_workspace", "is_archived"],
            filters={"is_workspace": 0, "is_archived": ["!=", 1]},
            order_by="partition_name"
        )
        results["all_partitions"] = all_partitions
        
        # Method 4: Case insensitive search
        matching_partitions = []
        for p in all_partitions:
            if (p.partition_name.lower() == board_name.lower() or 
                p.name.lower() == board_name.lower()):
                matching_partitions.append(p)
        results["case_insensitive_matches"] = matching_partitions
        
        return {
            'success': True,
            'search_term': board_name,
            'results': results
        }
        
    except Exception as e:
        frappe.log_error(f"TEST ERROR: {str(e)}", "Test Combination")
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist()
def debug_partitions():
    """
    Debug function to see all partitions in database
    """
    try:
        all_partitions = frappe.db.get_all("Partition",
            fields=["name", "partition_name", "is_workspace", "is_archived"],
            order_by="partition_name"
        )
        
        boards_only = frappe.db.get_all("Partition",
            fields=["name", "partition_name", "description"],
            filters={
                "is_workspace": 0,
                "is_archived": ["!=", 1]
            },
            order_by="partition_name"
        )
        
        return {
            'success': True,
            'all_partitions': all_partitions,
            'boards_only': boards_only
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist()
def test_partition_query(board_name="Debt Collection"):
    """Test partition query to debug the issue"""
    try:
        # Test 1: Simple query
        result1 = frappe.db.get_value("Partition", 
            {"partition_name": board_name}, 
            ["name", "partition_name", "is_workspace", "is_archived"], 
            as_dict=True)
        
        # Test 2: Query with is_workspace filter
        result2 = frappe.db.get_value("Partition", 
            {"partition_name": board_name, "is_workspace": 0}, 
            ["name", "partition_name", "is_workspace", "is_archived"], 
            as_dict=True)
        
        # Test 3: Query with both filters
        result3 = frappe.db.get_value("Partition", 
            {"partition_name": board_name, "is_workspace": 0, "is_archived": ["!=", 1]}, 
            ["name", "partition_name", "is_workspace", "is_archived"], 
            as_dict=True)
        
        # Test 4: Get all partitions with this name
        result4 = frappe.db.get_all("Partition",
            filters={"partition_name": board_name},
            fields=["name", "partition_name", "is_workspace", "is_archived"]
        )
        
        return {
            'success': True,
            'test_board': board_name,
            'simple_query': result1,
            'with_workspace_filter': result2,
            'with_both_filters': result3,
            'get_all_result': result4
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist()
def debug_partition_data():
    """Debug function to check partition data"""
    try:
        all_partitions = frappe.db.get_all("Partition",
            fields=["name", "partition_name", "description", "is_workspace", "is_archived"],
            order_by="partition_name"
        )
        
        boards_only = frappe.db.get_all("Partition",
            fields=["name", "partition_name", "description"],
            filters={"is_workspace": 0, "is_archived": ["!=", 1]},
            order_by="partition_name"
        )
        
        return {
            'success': True,
            'all_partitions': all_partitions,
            'boards_only': boards_only,
            'total_partitions': len(all_partitions),
            'total_boards': len(boards_only)
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist()
def test_combination_doctype():
    """
    Test function to verify Combination View DocType configuration
    """
    try:
        # Check if DocTypes exist
        if not frappe.db.exists("DocType", "Combination View"):
            return {
                'success': False,
                'error': 'Combination View DocType does not exist. Please create it first.'
            }
        
        if not frappe.db.exists("DocType", "Combination View Board"):
            return {
                'success': False,
                'error': 'Combination View Board DocType does not exist. Please create it first.'
            }
        
        # Get DocType meta
        combination_meta = frappe.get_meta("Combination View")
        board_meta = frappe.get_meta("Combination View Board")
        
        # Check required fields
        main_fields = [field.fieldname for field in combination_meta.fields]
        child_fields = [field.fieldname for field in board_meta.fields]
        
        return {
            'success': True,
            'main_doctype_fields': main_fields,
            'child_doctype_fields': child_fields,
            'message': 'DocTypes are properly configured'
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': f'DocType test error: {str(e)}'
        }

@frappe.whitelist()
def save_combination_view(view_name, description, board_ids, is_public=0):
    """
    Save a combination view for quick access later
    """
    try:
        # Handle board_ids parameter
        if isinstance(board_ids, str):
            try:
                board_ids = json.loads(board_ids)
            except:
                board_ids = [bid.strip() for bid in board_ids.split(',') if bid.strip()]
        
        # Create new Combination View document
        combination_view = frappe.new_doc("Combination View")
        combination_view.view_name = view_name
        combination_view.description = description or ""
        combination_view.is_public = int(is_public)
        combination_view.usage_count = 0
        
        # Add boards to child table
        for i, board_id in enumerate(board_ids):
            # Get board display name
            board_name = frappe.db.get_value("Partition", 
                {"name": board_id}, "partition_name") or board_id
            if not board_name:
                board_name = frappe.db.get_value("Partition", 
                    {"partition_name": board_id}, "partition_name") or board_id
            
            combination_view.append("boards", {
                "board_id": str(board_id),
                "board_name": str(board_name),
                "display_order": i + 1
            })
        
        combination_view.insert()
        
        return {
            'success': True,
            'message': f'Combination view "{view_name}" saved successfully',
            'combination_id': combination_view.name
        }
        
    except Exception as e:
        frappe.log_error(f"Save combination view error: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist()
def get_saved_combinations():
    """
    Get all saved combination views for current user
    """
    try:
        combinations = frappe.get_all("Combination View",
            filters={
                "owner": frappe.session.user
            },
            fields=["name", "view_name", "description", "usage_count", "last_used", "creation"],
            order_by="last_used desc, creation desc"
        )
        
        # Get boards for each combination
        for combination in combinations:
            boards = frappe.get_all("Combination View Board",
                filters={"parent": combination.name},
                fields=["board_id", "board_name", "display_order"],
                order_by="display_order"
            )
            combination.boards = boards
            combination.board_count = len(boards)
        
        return {
            'success': True,
            'combinations': combinations
        }
        
    except Exception as e:
        frappe.log_error(f"Get saved combinations error: {str(e)}")
        return {
            'success': False,
            'error': str(e),
            'combinations': []
        }

@frappe.whitelist()
def load_combination_view(combination_id):
    """
    Load a saved combination view and update usage stats
    """
    try:
        combination = frappe.get_doc("Combination View", combination_id)
        
        # Update usage statistics
        combination.usage_count = (combination.usage_count or 0) + 1
        combination.last_used = frappe.utils.now()
        combination.save(ignore_permissions=True)
        
        # Get board IDs in correct order
        boards = frappe.get_all("Combination View Board",
            filters={"parent": combination_id},
            fields=["board_id", "board_name"],
            order_by="display_order"
        )
        
        board_ids = [board.board_id for board in boards]
        
        return {
            'success': True,
            'combination_name': combination.view_name,
            'board_ids': board_ids,
            'boards': boards
        }
        
    except Exception as e:
        frappe.log_error(f"Load combination view error: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist()
def delete_combination_view(combination_id):
    """
    Delete a saved combination view
    """
    try:
        frappe.delete_doc("Combination View", combination_id)
        return {
            'success': True,
            'message': 'Combination view deleted successfully'
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist()
def get_combination_view_data(board_ids):
    """
    Get data for combination view with multiple boards
    """
    try:
        # Handle board_ids parameter - fix JSON serialization issue
        if isinstance(board_ids, str):
            try:
                # Try to parse as JSON array first (Frappe serializes JS arrays to JSON)
                parsed_board_ids = json.loads(board_ids)
                if isinstance(parsed_board_ids, list):
                    board_ids = [str(bid).strip() for bid in parsed_board_ids if str(bid).strip()]
                else:
                    # Fallback to comma-separated
                    board_ids = [bid.strip() for bid in board_ids.split(',') if bid.strip()]
            except (json.JSONDecodeError, TypeError):
                # If not valid JSON, treat as comma-separated
                board_ids = [bid.strip() for bid in board_ids.split(',') if bid.strip()]
        elif isinstance(board_ids, list):
            board_ids = [str(bid).strip() for bid in board_ids if str(bid).strip()]
        else:
            board_ids = []
        
        boards_data = []
        
        # Direct approach - for each requested board, try to find it
        for board_id in board_ids:
            # Try to find partition by partition_name first (non-workspace, non-archived)
            partition = frappe.db.get_value("Partition", 
                {
                    "partition_name": board_id, 
                    "is_workspace": 0,
                    "is_archived": ["!=", 1]
                }, 
                ["name", "partition_name", "description"], 
                as_dict=True)
            
            # If not found by partition_name, try by name
            if not partition:
                partition = frappe.db.get_value("Partition", 
                    {
                        "name": board_id, 
                        "is_workspace": 0,
                        "is_archived": ["!=", 1]
                    }, 
                    ["name", "partition_name", "description"], 
                    as_dict=True)
            
            # Skip if not found
            if not partition:
                continue
            
            # Get board's column configuration
            try:
                column_config = get_partition_column_config(partition.name)
            except:
                column_config = {
                    'visible_columns': ['client', 'task-name', 'status', 'target-month'],
                    'column_widths': {}
                }
            
            # Get board's tasks with full data
            try:
                board_data = get_project_management_data(partition.name)
                organized_data = board_data.get('organized_data', {})
                total_tasks = board_data.get('total_tasks', 0)
                total_projects = board_data.get('total_projects', 0)
            except:
                organized_data = {}
                total_tasks = 0
                total_projects = 0
            
            boards_data.append({
                "board_id": partition.name,
                "board_name": partition.partition_name,
                "description": partition.description or "",
                "column_config": column_config,
                "tasks": organized_data,
                "total_tasks": total_tasks,
                "total_projects": total_projects
            })
        
        return {
            'success': True,
            'boards_data': boards_data,
            'debug_info': {
                'requested_boards': board_ids,
                'found_boards': len(boards_data),
                'board_names': [b['board_name'] for b in boards_data]
            }
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'boards_data': []
        }

@frappe.whitelist()
def get_field_options(doctype, fieldname):
    """
    Get options for a specific field from DocType or Custom Field
    """
    try:
        # First check if it's a custom field
        custom_field = frappe.db.get_value("Custom Field", 
            {"dt": doctype, "fieldname": fieldname}, 
            ["options"], as_dict=True)
        
        if custom_field and custom_field.options:
            options = [opt.strip() for opt in custom_field.options.split('\n') if opt.strip()]
            return {
                'success': True,
                'options': options,
                'source': 'custom_field'
            }
        
        # If not custom field, check standard DocType field
        doctype_meta = frappe.get_meta(doctype)
        field = doctype_meta.get_field(fieldname)
        
        if field and field.options:
            options = [opt.strip() for opt in field.options.split('\n') if opt.strip()]
            return {
                'success': True,
                'options': options,
                'source': 'doctype_field'
            }
        
        return {
            'success': False,
            'error': f'Field {fieldname} not found or has no options'
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting field options: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist()
def get_current_user_info():
    """
    Get current user information including roles and permissions
    """
    try:
        current_user = frappe.session.user
        if current_user == 'Guest':
            return {
                'success': True,
                'user': 'Guest',
                'full_name': 'Guest User',
                'roles': ['Guest'],
                'permissions': 'Guest Access'
            }
        
        # Get user roles using the correct method found in existing code
        user_roles = frappe.get_roles()
        # Filter out system roles
        filtered_roles = [role for role in user_roles if role not in ['All', 'Guest']]
        
        # Get user full name
        full_name = frappe.get_cached_value('User', current_user, 'full_name') or current_user
        
        # Determine permission level
        permissions = 'Guest Access'
        if current_user == 'Administrator':
            permissions = 'Full System Access'
        elif 'System Manager' in user_roles:
            permissions = 'System Manager Access'
        else:
            permissions = 'Smart Accounting User'
        
        return {
            'success': True,
            'user': current_user,
            'full_name': full_name,
            'roles': filtered_roles,
            'permissions': permissions
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting current user info: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist()
def grant_dev_access(password):
    """
    验证开发者密码并授予系统访问权限
    """
    try:
        # 调试信息
        frappe.log_error(f"Dev access request - User: {frappe.session.user}, Password received: '{password}', Type: {type(password)}")
        
        # 只允许管理员角色申请开发者访问
        user_roles = frappe.get_roles()
        if 'System Manager' not in user_roles and 'Administrator' not in user_roles:
            return {
                'success': False,
                'message': 'Only administrators can request developer access'
            }
        
        # 验证密码（硬编码为devdev）
        # 确保密码是字符串并去除空格
        password_clean = str(password).strip() if password else ""
        
        if password_clean == 'devdev':
            frappe.session['dev_system_access'] = True
            frappe.log_error(f"Dev access granted to user: {frappe.session.user}")
            return {
                'success': True,
                'message': 'Developer access granted',
                'redirect_url': '/app'
            }
        else:
            frappe.log_error(f"Invalid password attempt - Expected: 'devdev', Received: '{password_clean}'")
            return {
                'success': False,
                'message': f'Invalid password. Received: "{password_clean}"'
            }
            
    except Exception as e:
        frappe.log_error(f"Error granting dev access: {str(e)}")
        return {
            'success': False,
            'message': 'Error processing request'
        }

@frappe.whitelist()
def revoke_dev_access():
    """
    撤销开发者系统访问权限
    """
    try:
        frappe.session.pop('dev_system_access', None)
        return {
            'success': True,
            'message': 'Developer access revoked'
        }
    except Exception as e:
        frappe.log_error(f"Error revoking dev access: {str(e)}")
        return {
            'success': False,
            'message': 'Error processing request'
        }

@frappe.whitelist(allow_guest=True)
def handle_login_redirect():
    """
    Handle post-login redirect to ensure users go to project management
    """
    try:
        if frappe.session.user != 'Guest':
            return {
                'success': True,
                'redirect_url': '/project_management',
                'user': frappe.session.user
            }
        else:
            return {
                'success': False,
                'redirect_url': '/login',
                'message': 'Not logged in'
            }
    except Exception as e:
        frappe.log_error(f"Error handling login redirect: {str(e)}")
        return {
            'success': False,
            'redirect_url': '/login',
            'message': 'Error processing request'
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
