# Smart Accounting - CSV Import API
# 处理CSV数据导入功能，与ERPNext内置功能集成

import frappe
from frappe import _
from frappe.utils import now, get_datetime, cstr, flt
from frappe.utils.csvutils import read_csv_content
import json
import csv
from io import StringIO

@frappe.whitelist()
def import_board_data_from_content(csv_content, filename, board_view='main', import_mode='insert', skip_errors=True, selected_projects=None):
    """
    从CSV内容导入board数据，避免文件上传的HTTP 417错误
    
    Args:
        csv_content (str): CSV文件内容
        filename (str): 文件名
        board_view (str): board视图
        import_mode (str): 导入模式
        skip_errors (bool): 是否跳过错误
        selected_projects (list): 选中的项目
    
    Returns:
        dict: 包含导入结果的字典
    """
    try:
        # 验证用户权限
        if not frappe.has_permission("Task", "create"):
            frappe.throw(_("You don't have permission to import data"), frappe.PermissionError)
        
        # 验证参数
        if not csv_content or not filename:
            return {
                'success': False,
                'error': 'CSV content and filename are required'
            }
        
        # 验证文件类型
        if not filename.lower().endswith('.csv'):
            frappe.log_error(f"CSV Import: Invalid file type: {filename}")
            return {
                'success': False,
                'error': 'Please upload a CSV file'
            }
        
        # 处理参数
        if isinstance(selected_projects, str):
            try:
                selected_projects = json.loads(selected_projects) if selected_projects else []
            except:
                selected_projects = []
        elif not selected_projects:
            selected_projects = []
        
        # 记录导入开始
        frappe.logger().info(f"CSV Import from content started: {filename}, board_view: {board_view}, mode: {import_mode}")
        
        # 处理CSV内容导入
        import_result = process_csv_content_import(
            csv_content, 
            filename,
            board_view, 
            import_mode, 
            skip_errors,
            selected_projects
        )
        
        # 记录导入日志 (简化版本，避免字符长度问题)
        try:
            log_import_activity(board_view, import_result)
        except:
            pass  # 忽略日志记录错误，不影响主要功能
        
        return {
            'success': True,
            'success_count': import_result['success_count'],
            'error_count': import_result['error_count'],
            'updated_count': import_result.get('updated_count', 0),
            'errors': import_result.get('errors', [])
        }
        
    except Exception as e:
        frappe.log_error(f"CSV Import from content Error: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist()
def import_board_data():
    """
    从CSV文件导入board数据，使用ERPNext内置的Data Import功能
    
    Returns:
        dict: 包含导入结果的字典
    """
    try:
        # 验证用户权限
        if not frappe.has_permission("Task", "create"):
            frappe.throw(_("You don't have permission to import data"), frappe.PermissionError)
        
        # 获取上传的文件
        files = frappe.request.files
        if 'file' not in files:
            frappe.log_error("CSV Import: No file uploaded in request")
            return {
                'success': False,
                'error': 'No file uploaded'
            }
        
        uploaded_file = files['file']
        
        # Get other parameters
        board_view = frappe.form_dict.get('board_view', 'main')
        import_mode = frappe.form_dict.get('import_mode', 'insert')
        skip_errors = frappe.form_dict.get('skip_errors', 'true').lower() == 'true'
        selected_projects = frappe.form_dict.get('selected_projects', '[]')
        
        # Parse selected projects
        try:
            selected_projects = json.loads(selected_projects) if selected_projects else []
        except:
            selected_projects = []
        
        # 验证文件类型
        if not uploaded_file.filename.lower().endswith('.csv'):
            frappe.log_error(f"CSV Import: Invalid file type uploaded: {uploaded_file.filename}")
            return {
                'success': False,
                'error': 'Please upload a CSV file'
            }
        
        # 记录导入开始
        frappe.logger().info(f"CSV Import started: {uploaded_file.filename}, board_view: {board_view}, mode: {import_mode}")
        
        # 使用ERPNext内置的Data Import功能
        import_result = process_csv_import_with_builtin_api(
            uploaded_file, 
            board_view, 
            import_mode, 
            skip_errors,
            selected_projects
        )
        
        # 记录导入日志 (简化版本，避免字符长度问题)
        try:
            log_import_activity(board_view, import_result)
        except:
            pass  # 忽略日志记录错误，不影响主要功能
        
        return {
            'success': True,
            'success_count': import_result['success_count'],
            'error_count': import_result['error_count'],
            'updated_count': import_result.get('updated_count', 0),
            'errors': import_result.get('errors', [])
        }
        
    except Exception as e:
        frappe.log_error(f"CSV Import Error: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

def process_csv_import_with_builtin_api(uploaded_file, board_view, import_mode, skip_errors, selected_projects):
    """
    使用ERPNext内置的Data Import API处理CSV导入
    
    Args:
        uploaded_file: 上传的文件对象
        board_view (str): board视图
        import_mode (str): 导入模式
        skip_errors (bool): 是否跳过错误
        selected_projects (list): 选中的项目
    
    Returns:
        dict: 导入结果
    """
    try:
        # 保存上传的文件到Frappe文件系统
        file_doc = save_uploaded_file_to_frappe(uploaded_file)
        
        # 创建Data Import文档
        data_import = frappe.get_doc({
            'doctype': 'Data Import',
            'reference_doctype': 'Task',
            'import_type': 'Insert New Records' if import_mode == 'insert' else 'Update Existing Records',
            'import_file': file_doc.file_url,
            'mute_emails': True,
            'submit_after_import': False
        })
        
        # 保存Data Import文档
        data_import.insert(ignore_permissions=True)
        
        # 获取导入预览和验证
        from frappe.core.doctype.data_import.importer import Importer
        importer = Importer('Task', data_import=data_import)
        
        # 执行导入
        import_log = importer.import_data()
        
        # 处理导入结果
        success_count = len([log for log in import_log if log.success])
        error_count = len([log for log in import_log if not log.success])
        errors = [log.exception for log in import_log if not log.success and log.exception]
        
        # 如果有选中的项目，更新导入的任务
        if selected_projects and success_count > 0:
            update_imported_tasks_with_projects(import_log, selected_projects, board_view)
        
        return {
            'success_count': success_count,
            'error_count': error_count,
            'updated_count': 0,  # ERPNext的导入API不区分更新和插入的计数
            'errors': errors[:10]  # 限制错误数量
        }
        
    except Exception as e:
        frappe.log_error(f"Error in builtin API import: {str(e)}")
        # 如果内置API失败，回退到自定义处理
        return fallback_to_custom_import(uploaded_file, board_view, import_mode, skip_errors, selected_projects)

def process_csv_content_import(csv_content, filename, board_view, import_mode, skip_errors, selected_projects):
    """
    处理CSV内容导入，不涉及文件上传
    
    Args:
        csv_content (str): CSV文件内容
        filename (str): 文件名
        board_view (str): board视图
        import_mode (str): 导入模式
        skip_errors (bool): 是否跳过错误
        selected_projects (list): 选中的项目
    
    Returns:
        dict: 导入结果
    """
    try:
        # 创建临时文件文档
        file_doc = frappe.get_doc({
            'doctype': 'File',
            'file_name': filename,
            'content': csv_content.encode('utf-8'),
            'is_private': 1,
            'folder': 'Home/Attachments'
        })
        file_doc.insert(ignore_permissions=True)
        
        frappe.logger().info(f"Temporary file created: {file_doc.name}, URL: {file_doc.file_url}")
        
        # 创建Data Import文档
        data_import = frappe.get_doc({
            'doctype': 'Data Import',
            'reference_doctype': 'Task',
            'import_type': 'Insert New Records' if import_mode == 'insert' else 'Update Existing Records',
            'import_file': file_doc.file_url,
            'mute_emails': True,
            'submit_after_import': False
        })
        
        # 保存Data Import文档
        data_import.insert(ignore_permissions=True)
        
        # 获取导入预览和验证
        from frappe.core.doctype.data_import.importer import Importer
        importer = Importer('Task', data_import=data_import)
        
        # 执行导入
        import_log = importer.import_data()
        
        # 处理导入结果
        success_count = len([log for log in import_log if log.success])
        error_count = len([log for log in import_log if not log.success])
        errors = [log.exception for log in import_log if not log.success and log.exception]
        
        # 如果有选中的项目，更新导入的任务
        if selected_projects and success_count > 0:
            update_imported_tasks_with_projects(import_log, selected_projects, board_view)
        
        # 清理临时文件
        try:
            file_doc.delete()
        except:
            pass  # 忽略删除错误
        
        return {
            'success_count': success_count,
            'error_count': error_count,
            'errors': errors[:10]  # 只返回前10个错误
        }
        
    except Exception as e:
        frappe.log_error(f"Error in CSV content import: {str(e)}")
        # 如果失败，尝试直接处理CSV内容
        return fallback_to_direct_csv_processing(csv_content, filename, board_view, import_mode, skip_errors, selected_projects)

def fallback_to_direct_csv_processing(csv_content, filename, board_view, import_mode, skip_errors, selected_projects):
    """
    直接处理CSV内容的备用方案
    
    Args:
        csv_content (str): CSV文件内容
        filename (str): 文件名
        board_view (str): board视图
        import_mode (str): 导入模式
        skip_errors (bool): 是否跳过错误
        selected_projects (list): 选中的项目
    
    Returns:
        dict: 导入结果
    """
    try:
        # 解析CSV内容
        csv_reader = csv.DictReader(StringIO(csv_content))
        rows = list(csv_reader)
        
        success_count = 0
        error_count = 0
        errors = []
        
        for row in rows:
            try:
                # 清理和验证数据
                subject = (row.get('subject') or row.get('Task Name') or 'Imported Task').strip()
                description = (row.get('description') or row.get('Description') or '').strip()
                status = (row.get('status') or row.get('Status') or 'Open').strip()
                priority = (row.get('priority') or row.get('Priority') or 'Medium').strip()
                
                # 确保subject不为空且长度合理
                if not subject:
                    subject = 'Imported Task'
                if len(subject) > 140:
                    subject = subject[:140]
                
                # 验证status值
                valid_statuses = ['Open', 'Working', 'Pending Review', 'Overdue', 'Template', 'Completed', 'Cancelled']
                if status not in valid_statuses:
                    status = 'Open'
                
                # 验证priority值
                valid_priorities = ['Low', 'Medium', 'High', 'Urgent']
                if priority not in valid_priorities:
                    priority = 'Medium'
                
                # 创建Task文档
                task_doc = frappe.get_doc({
                    'doctype': 'Task',
                    'subject': subject,
                    'description': description,
                    'status': status,
                    'priority': priority,
                })
                
                # 如果有选中的项目，设置项目
                if selected_projects:
                    # 验证项目是否存在
                    if frappe.db.exists('Project', selected_projects[0]):
                        task_doc.project = selected_projects[0]
                
                # 保存任务
                task_doc.insert(ignore_permissions=True)
                success_count += 1
                
            except Exception as e:
                error_count += 1
                error_msg = str(e)
                errors.append(error_msg)
                
                if not skip_errors:
                    break
        
        return {
            'success_count': success_count,
            'error_count': error_count,
            'errors': errors[:10]  # 只返回前10个错误
        }
        
    except Exception as e:
        frappe.log_error(f"Error in direct CSV processing: {str(e)}")
        return {
            'success_count': 0,
            'error_count': 1,
            'errors': [str(e)]
        }

def save_uploaded_file_to_frappe(uploaded_file):
    """
    将上传的文件保存到Frappe文件系统
    
    Args:
        uploaded_file: 上传的文件对象
    
    Returns:
        File: Frappe文件文档
    """
    try:
        # 读取文件内容
        file_content = uploaded_file.read()
        frappe.logger().info(f"Reading uploaded file: {uploaded_file.filename}, size: {len(file_content)} bytes")
        
        # 重置文件指针，以防后续需要再次读取
        uploaded_file.seek(0)
        
        # 创建文件文档
        file_doc = frappe.get_doc({
            'doctype': 'File',
            'file_name': uploaded_file.filename,
            'content': file_content,
            'is_private': 1,
            'folder': 'Home/Attachments'
        })
        
        file_doc.insert(ignore_permissions=True)
        frappe.logger().info(f"File saved successfully: {file_doc.name}, URL: {file_doc.file_url}")
        return file_doc
        
    except Exception as e:
        frappe.log_error(f"Error saving uploaded file: {str(e)}")
        raise

def update_imported_tasks_with_projects(import_log, selected_projects, board_view):
    """
    更新导入的任务，设置项目和board信息
    
    Args:
        import_log (list): 导入日志
        selected_projects (list): 选中的项目
        board_view (str): board视图
    """
    try:
        successful_imports = [log for log in import_log if log.success and log.doc_name]
        
        for log_entry in successful_imports:
            try:
                task_doc = frappe.get_doc('Task', log_entry.doc_name)
                
                # 如果任务没有项目且有选中的项目，分配第一个项目
                if not task_doc.project and selected_projects:
                    task_doc.project = selected_projects[0]
                
                # 设置board信息
                if board_view != 'main':
                    task_doc.custom_partition = board_view
                
                task_doc.save(ignore_permissions=True)
                
            except Exception as e:
                frappe.log_error(f"Error updating imported task {log_entry.doc_name}: {str(e)}")
                continue
                
    except Exception as e:
        frappe.log_error(f"Error updating imported tasks: {str(e)}")

def fallback_to_custom_import(uploaded_file, board_view, import_mode, skip_errors, selected_projects):
    """
    回退到自定义导入处理
    
    Args:
        uploaded_file: 上传的文件对象
        board_view (str): board视图
        import_mode (str): 导入模式
        skip_errors (bool): 是否跳过错误
        selected_projects (list): 选中的项目
    
    Returns:
        dict: 导入结果
    """
    try:
        # 重置文件指针
        uploaded_file.seek(0)
        file_content = uploaded_file.read().decode('utf-8')
        
        # 解析CSV数据
        csv_data = parse_csv_content(file_content)
        
        if not csv_data:
            return {
                'success_count': 0,
                'error_count': 1,
                'errors': ['No valid data found in CSV file']
            }
        
        # 验证数据格式
        validation_result = validate_csv_data(csv_data, board_view)
        if not validation_result['valid']:
            return {
                'success_count': 0,
                'error_count': 1,
                'errors': [validation_result['error']]
            }
        
        # 执行自定义导入
        return process_csv_import(csv_data, board_view, import_mode, skip_errors, selected_projects)
        
    except Exception as e:
        frappe.log_error(f"Error in fallback import: {str(e)}")
        return {
            'success_count': 0,
            'error_count': 1,
            'errors': [str(e)]
        }

def parse_csv_content(file_content):
    """
    解析CSV文件内容
    
    Args:
        file_content (str): CSV文件内容
    
    Returns:
        list: 解析后的数据列表
    """
    try:
        # 使用StringIO处理CSV内容
        csv_file = StringIO(file_content)
        reader = csv.DictReader(csv_file)
        
        data = []
        for row in reader:
            # 清理空值和空白字符
            cleaned_row = {}
            for key, value in row.items():
                if key and key.strip():  # 确保列名不为空
                    cleaned_key = key.strip()
                    cleaned_value = value.strip() if value else ''
                    cleaned_row[cleaned_key] = cleaned_value
            
            if any(cleaned_row.values()):  # 只添加非空行
                data.append(cleaned_row)
        
        return data
        
    except Exception as e:
        frappe.log_error(f"Error parsing CSV content: {str(e)}")
        return []

def validate_csv_data(csv_data, board_view):
    """
    验证CSV数据格式
    
    Args:
        csv_data (list): CSV数据
        board_view (str): board视图名称
    
    Returns:
        dict: 验证结果
    """
    try:
        if not csv_data:
            return {
                'valid': False,
                'error': 'CSV file is empty or contains no valid data'
            }
        
        # 获取字段映射
        field_mapping = get_import_field_mapping()
        reverse_mapping = {v: k for k, v in get_field_labels().items()}
        
        # 检查必需字段
        first_row = csv_data[0]
        csv_headers = list(first_row.keys())
        
        # 验证至少有一个可识别的字段
        recognized_fields = []
        for header in csv_headers:
            if header in reverse_mapping or header in field_mapping.values():
                recognized_fields.append(header)
        
        if not recognized_fields:
            return {
                'valid': False,
                'error': f'No recognized fields found. Available fields: {", ".join(get_field_labels().values())}'
            }
        
        # 验证数据行
        for i, row in enumerate(csv_data[:10]):  # 只验证前10行
            # 检查是否有基本的任务信息
            has_task_info = False
            for field in ['Task Name', 'Client Name', 'task-name', 'client']:
                if field in row and row[field]:
                    has_task_info = True
                    break
            
            if not has_task_info:
                return {
                    'valid': False,
                    'error': f'Row {i+2}: Missing required task information (Task Name or Client Name)'
                }
        
        return {
            'valid': True,
            'recognized_fields': recognized_fields
        }
        
    except Exception as e:
        frappe.log_error(f"Error validating CSV data: {str(e)}")
        return {
            'valid': False,
            'error': f'Validation error: {str(e)}'
        }

def process_csv_import(csv_data, board_view, import_mode, skip_errors, selected_projects=None):
    """
    处理CSV数据导入
    
    Args:
        csv_data (list): CSV数据
        board_view (str): board视图
        import_mode (str): 导入模式 ('insert' 或 'update')
        skip_errors (bool): 是否跳过错误行
    
    Returns:
        dict: 导入结果
    """
    success_count = 0
    error_count = 0
    updated_count = 0
    errors = []
    
    # 获取字段映射
    field_mapping = get_import_field_mapping()
    field_labels = get_field_labels()
    reverse_label_mapping = {v: k for k, v in field_labels.items()}
    
    for i, row in enumerate(csv_data):
        try:
            # 转换字段名
            task_data = convert_row_to_task_data(row, field_mapping, reverse_label_mapping)
            
            if not task_data:
                if not skip_errors:
                    errors.append(f"Row {i+2}: No valid data found")
                    error_count += 1
                continue
            
            # Process according to import mode
            if import_mode == 'update':
                result = update_existing_task(task_data, i+2)
            else:
                result = create_new_task(task_data, board_view, i+2, selected_projects)
            
            if result['success']:
                if result.get('updated'):
                    updated_count += 1
                else:
                    success_count += 1
            else:
                error_count += 1
                if not skip_errors:
                    errors.append(result['error'])
                elif len(errors) < 10:  # 限制错误信息数量
                    errors.append(result['error'])
                
        except Exception as e:
            error_count += 1
            error_msg = f"Row {i+2}: {str(e)}"
            if not skip_errors:
                errors.append(error_msg)
            elif len(errors) < 10:
                errors.append(error_msg)
            
            if not skip_errors:
                break
    
    return {
        'success_count': success_count,
        'error_count': error_count,
        'updated_count': updated_count,
        'errors': errors
    }

def convert_row_to_task_data(row, field_mapping, reverse_label_mapping):
    """
    将CSV行数据转换为Task数据格式
    
    Args:
        row (dict): CSV行数据
        field_mapping (dict): 字段映射
        reverse_label_mapping (dict): 反向标签映射
    
    Returns:
        dict: Task数据
    """
    task_data = {
        'doctype': 'Task'
    }
    
    for csv_field, value in row.items():
        if not value:
            continue
        
        # 尝试匹配字段
        target_field = None
        
        # 直接匹配
        if csv_field in field_mapping:
            target_field = field_mapping[csv_field]
        # 通过标签匹配
        elif csv_field in reverse_label_mapping:
            smart_field = reverse_label_mapping[csv_field]
            if smart_field in field_mapping:
                target_field = field_mapping[smart_field]
        
        if target_field:
            # 格式化值
            formatted_value = format_import_value(target_field, value)
            task_data[target_field] = formatted_value
    
    # 确保有基本的任务信息
    if not task_data.get('subject') and not task_data.get('custom_client_name'):
        return None
    
    # 设置默认值
    if not task_data.get('subject'):
        task_data['subject'] = task_data.get('custom_client_name', 'Imported Task')
    
    if not task_data.get('status'):
        task_data['status'] = 'Open'
    
    return task_data

def format_import_value(field_name, value):
    """
    格式化导入值
    
    Args:
        field_name (str): 字段名
        value (str): 原始值
    
    Returns:
        any: 格式化后的值
    """
    if not value:
        return None
    
    # 日期字段
    if field_name in ['custom_target_month', 'custom_process_date', 'custom_lodgement_due', 'custom_year_end']:
        return parse_date_value(value)
    
    # 数值字段
    elif field_name in ['custom_budget', 'custom_actual']:
        return parse_numeric_value(value)
    
    # 布尔字段
    elif field_name in ['is_milestone', 'custom_is_active']:
        return parse_boolean_value(value)
    
    # 文本字段
    else:
        return cstr(value).strip()

def parse_date_value(value):
    """解析日期值"""
    if not value:
        return None
    
    try:
        # 尝试多种日期格式
        date_formats = [
            '%d-%m-%Y',
            '%d/%m/%Y',
            '%Y-%m-%d',
            '%m/%d/%Y',
            '%d.%m.%Y'
        ]
        
        for fmt in date_formats:
            try:
                parsed_date = get_datetime(value, fmt)
                return parsed_date.strftime('%Y-%m-%d')
            except:
                continue
        
        # 如果都失败了，尝试frappe的日期解析
        parsed_date = get_datetime(value)
        return parsed_date.strftime('%Y-%m-%d')
        
    except:
        return None

def parse_numeric_value(value):
    """解析数值"""
    if not value:
        return 0.0
    
    try:
        # 移除货币符号和千位分隔符
        cleaned_value = str(value).replace('$', '').replace(',', '').replace(' ', '')
        return flt(cleaned_value)
    except:
        return 0.0

def parse_boolean_value(value):
    """解析布尔值"""
    if not value:
        return 0
    
    true_values = ['true', '1', 'yes', 'y', 'on', '是', '真']
    return 1 if str(value).lower().strip() in true_values else 0

def create_new_task(task_data, board_view, row_number, selected_projects=None):
    """
    创建新任务
    
    Args:
        task_data (dict): 任务数据
        board_view (str): board视图
        row_number (int): 行号
    
    Returns:
        dict: 创建结果
    """
    try:
        # Add board related information
        if board_view != 'main':
            task_data['custom_partition'] = board_view
        
        # Assign to first selected project if no project specified and projects are selected
        if not task_data.get('project') and selected_projects and len(selected_projects) > 0:
            task_data['project'] = selected_projects[0]
        
        # Create task
        task_doc = frappe.get_doc(task_data)
        task_doc.insert(ignore_permissions=True)
        
        return {
            'success': True,
            'task_name': task_doc.name,
            'updated': False
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': f"Row {row_number}: Failed to create task - {str(e)}"
        }

def update_existing_task(task_data, row_number):
    """
    更新现有任务
    
    Args:
        task_data (dict): 任务数据
        row_number (int): 行号
    
    Returns:
        dict: 更新结果
    """
    try:
        # 尝试通过任务名称或客户名称查找现有任务
        existing_task = None
        
        if task_data.get('subject'):
            existing_tasks = frappe.get_all(
                "Task",
                filters={'subject': task_data['subject']},
                limit=1
            )
            if existing_tasks:
                existing_task = frappe.get_doc("Task", existing_tasks[0].name)
        
        if not existing_task and task_data.get('custom_client_name'):
            existing_tasks = frappe.get_all(
                "Task",
                filters={'custom_client_name': task_data['custom_client_name']},
                limit=1
            )
            if existing_tasks:
                existing_task = frappe.get_doc("Task", existing_tasks[0].name)
        
        if existing_task:
            # 更新现有任务
            for field, value in task_data.items():
                if field != 'doctype' and value is not None:
                    existing_task.set(field, value)
            
            existing_task.save(ignore_permissions=True)
            
            return {
                'success': True,
                'task_name': existing_task.name,
                'updated': True
            }
        else:
            # If existing task not found, create new task
            return create_new_task(task_data, 'main', row_number)
        
    except Exception as e:
        return {
            'success': False,
            'error': f"Row {row_number}: Failed to update task - {str(e)}"
        }

def get_import_field_mapping():
    """
    获取导入字段映射（Smart Accounting字段到ERPNext Task字段）
    
    Returns:
        dict: 字段映射
    """
    return {
        'client': 'custom_client_name',
        'task-name': 'subject',
        'entity': 'custom_entity',
        'tf-tg': 'custom_tf_tg',
        'software': 'custom_software',
        'communication-methods': 'custom_communication_methods',
        'client-contact': 'custom_client_contact',
        'status': 'status',
        'note': 'description',
        'target-month': 'custom_target_month',
        'budget': 'custom_budget',
        'actual': 'custom_actual',
        'review-note': 'custom_review_note',
        'action-person': 'custom_action_person',
        'preparer': 'custom_preparer',
        'reviewer': 'custom_reviewer',
        'partner': 'custom_partner',
        'process-date': 'custom_process_date',
        'lodgment-due': 'custom_lodgement_due',
        'engagement': 'custom_engagement',
        'group': 'custom_group',
        'year-end': 'custom_year_end',
        'priority': 'priority',
        'frequency': 'custom_frequency',
        'reset-date': 'custom_reset_date'
    }

def get_field_labels():
    """
    获取字段标签（与导出API保持一致）
    
    Returns:
        dict: 字段标签映射
    """
    return {
        'client': 'Client Name',
        'task-name': 'Task Name',
        'entity': 'Entity',
        'tf-tg': 'TF/TG',
        'software': 'Software',
        'communication-methods': 'Communication Methods',
        'client-contact': 'Client Contact',
        'status': 'Status',
        'note': 'Note',
        'target-month': 'Target Month',
        'budget': 'Budget',
        'actual': 'Actual',
        'review-note': 'Review Note',
        'action-person': 'Action Person',
        'preparer': 'Preparer',
        'reviewer': 'Reviewer',
        'partner': 'Partner',
        'process-date': 'Process Date',
        'lodgment-due': 'Lodgement Due',
        'engagement': 'Engagement',
        'group': 'Group',
        'year-end': 'Year End',
        'last-updated': 'Last Updated',
        'priority': 'Priority',
        'frequency': 'Frequency',
        'reset-date': 'Reset Date'
    }

def log_import_activity(board_view, import_result):
    """
    记录导入活动日志
    
    Args:
        board_view (str): board视图
        import_result (dict): 导入结果
    """
    try:
        activity_log = {
            'user': frappe.session.user,
            'action': 'CSV Import',
            'board_view': board_view,
            'success_count': import_result['success_count'],
            'error_count': import_result['error_count'],
            'updated_count': import_result.get('updated_count', 0),
            'timestamp': now()
        }
        
        # 使用简短的标题，详细信息放在消息体中
        title = f"CSV Import: {import_result['success_count']} success, {import_result['error_count']} errors"
        message = json.dumps(activity_log, indent=2)
        frappe.log_error(message, title)
        
    except Exception as e:
        frappe.log_error(f"Error logging import activity: {str(e)}", "CSV Import Log Error")

@frappe.whitelist()
def get_import_template(board_view, selected_fields=None, include_examples=True, include_descriptions=False):
    """
    获取导入模板
    
    Args:
        board_view (str): board视图名称
        selected_fields (list): 用户选择的字段列表
        include_examples (bool): 是否包含示例数据
        include_descriptions (bool): 是否包含字段描述
    
    Returns:
        dict: 模板信息
    """
    try:
        # 解析参数
        if isinstance(selected_fields, str):
            import json
            selected_fields = json.loads(selected_fields) if selected_fields else None
        if isinstance(include_examples, str):
            include_examples = include_examples.lower() == 'true'
        if isinstance(include_descriptions, str):
            include_descriptions = include_descriptions.lower() == 'true'
        
        field_labels = get_field_labels()
        
        # 根据用户选择过滤字段
        if selected_fields:
            filtered_labels = {k: v for k, v in field_labels.items() if k in selected_fields}
        else:
            filtered_labels = field_labels
        
        # 生成模板CSV内容
        template_headers = list(filtered_labels.values())
        
        # 动态生成示例数据行，避免hard coding
        example_row = generate_example_row(filtered_labels) if include_examples else None
        
        # 生成CSV内容
        import csv
        from io import StringIO
        
        output = StringIO()
        writer = csv.writer(output)
        
        # 写入字段描述（如果启用）
        if include_descriptions:
            descriptions = []
            for header in template_headers:
                # 生成字段描述
                field_key = next((k for k, v in filtered_labels.items() if v == header), '')
                description = generate_field_description(field_key, header)
                descriptions.append(description)
            writer.writerow([f"# {desc}" for desc in descriptions])
        
        # 写入标题
        writer.writerow(template_headers)
        
        # 写入示例行（如果启用）
        if include_examples and example_row:
            example_values = []
            for header in template_headers:
                example_values.append(example_row.get(header, ''))
            writer.writerow(example_values)
        
        csv_content = output.getvalue()
        
        # 生成描述性文件名
        field_count = len(filtered_labels)
        timestamp = frappe.utils.now_datetime().strftime('%Y%m%d_%H%M%S')
        filename = f'SmartAccounting_ImportTemplate_{board_view}_{field_count}fields_{timestamp}.csv'
        
        return {
            'success': True,
            'csv_content': csv_content,
            'filename': filename,
            'field_count': field_count,
            'selected_fields': list(filtered_labels.keys())
        }
        
    except Exception as e:
        frappe.log_error(f"Error generating import template: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

def generate_example_row(field_labels):
    """
    动态生成示例数据行，避免hard coding
    
    Args:
        field_labels (dict): 字段标签映射
    
    Returns:
        dict: 示例数据行
    """
    # 定义字段类型和对应的示例值
    example_values = {
        # 文本字段
        'Client Name': 'Example Client Ltd',
        'Task Name': 'Annual Tax Return',
        'Entity': 'Company',
        'Note': 'Example task note',
        'Review Note': 'Review completed',
        'Software': 'Xero',
        'Communication Methods': 'Email, Phone',
        'Client Contact': 'John Smith',
        'Action Person': 'Jane Doe',
        'Preparer': 'Alice Johnson',
        'Reviewer': 'Bob Wilson',
        'Partner': 'Carol Brown',
        'Engagement': 'Tax Services',
        'Group': 'SME Clients',
        'Frequency': 'Annual',
        
        # 选择字段
        'TF/TG': 'TF',
        'Status': 'Open',
        'Priority': 'Medium',
        
        # 日期字段
        'Target Month': '31-12-2024',
        'Process Date': '15-11-2024',
        'Lodgement Due': '31-01-2025',
        'Year End': '30-06-2024',
        'Reset Date': '01-07-2024',
        'Last Updated': '20-10-2024',
        
        # 数值字段
        'Budget': '1500.00',
        'Actual': '0.00'
    }
    
    # 根据实际可用字段生成示例行
    example_row = {}
    for field_key, field_label in field_labels.items():
        if field_label in example_values:
            example_row[field_label] = example_values[field_label]
        else:
            # 根据字段名称推断示例值
            if 'date' in field_label.lower() or 'month' in field_label.lower():
                example_row[field_label] = '31-12-2024'
            elif 'budget' in field_label.lower() or 'actual' in field_label.lower() or 'amount' in field_label.lower():
                example_row[field_label] = '1000.00'
            elif 'status' in field_label.lower():
                example_row[field_label] = 'Open'
            elif 'priority' in field_label.lower():
                example_row[field_label] = 'Medium'
            elif 'name' in field_label.lower():
                example_row[field_label] = f'Example {field_label}'
            else:
                example_row[field_label] = f'Sample {field_label}'
    
    return example_row

def generate_field_description(field_key, field_label):
    """
    生成字段描述，用于模板文件
    
    Args:
        field_key (str): 字段键
        field_label (str): 字段标签
    
    Returns:
        str: 字段描述
    """
    # 字段描述映射
    field_descriptions = {
        'client': 'Client company name (required)',
        'task-name': 'Task or service description (required)',
        'entity': 'Entity type (Company, Trust, Individual, etc.)',
        'tf-tg': 'Top Figures or Third Generation (TF/TG)',
        'software': 'Accounting software used (Xero, MYOB, etc.)',
        'communication-methods': 'Preferred communication methods',
        'client-contact': 'Primary client contact person',
        'status': 'Task status (Open, In Progress, Completed, etc.)',
        'note': 'Additional notes or comments',
        'target-month': 'Target completion date (DD-MM-YYYY)',
        'budget': 'Budgeted amount (decimal format)',
        'actual': 'Actual amount spent (decimal format)',
        'review-note': 'Review comments',
        'action-person': 'Person responsible for action',
        'preparer': 'Task preparer',
        'reviewer': 'Task reviewer',
        'partner': 'Partner assigned',
        'process-date': 'Processing date (DD-MM-YYYY)',
        'lodgment-due': 'Lodgement due date (DD-MM-YYYY)',
        'engagement': 'Engagement type',
        'group': 'Client group or category',
        'year-end': 'Financial year end date (DD-MM-YYYY)',
        'priority': 'Task priority (High, Medium, Low)',
        'frequency': 'Task frequency (Annual, Quarterly, etc.)',
        'reset-date': 'Reset date (DD-MM-YYYY)'
    }
    
    return field_descriptions.get(field_key, f'{field_label} field')
