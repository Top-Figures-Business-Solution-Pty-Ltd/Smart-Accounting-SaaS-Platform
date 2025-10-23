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
    处理CSV内容导入，不涉及文件上传 - 直接使用我们的自定义逻辑
    
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
        frappe.logger().info(f"Starting CSV content import: {filename}")
        frappe.logger().info(f"CSV content preview: {csv_content[:500]}...")
        
        # 直接解析CSV内容，不使用ERPNext的Data Import
        csv_data = parse_csv_content(csv_content)
        
        if not csv_data:
            return {
                'success_count': 0,
                'error_count': 1,
                'errors': ['No valid data found in CSV file']
            }
        
        frappe.logger().info(f"Parsed {len(csv_data)} rows from CSV")
        
        # 验证数据格式
        validation_result = validate_csv_data(csv_data, board_view)
        if not validation_result['valid']:
            return {
                'success_count': 0,
                'error_count': 1,
                'errors': [validation_result['error']]
            }
        
        # 执行我们的自定义导入逻辑
        return process_csv_import(csv_data, board_view, import_mode, skip_errors, selected_projects)
        
    except Exception as e:
        frappe.log_error(f"Error in CSV content import: {str(e)}")
        return {
            'success_count': 0,
            'error_count': 1,
            'errors': [str(e)]
        }

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
    处理CSV数据导入 - 增强版本
    
    Args:
        csv_data (list): CSV数据
        board_view (str): board视图
        import_mode (str): 导入模式 ('insert' 或 'update')
        skip_errors (bool): 是否跳过错误行
        selected_projects (list): 选中的项目
    
    Returns:
        dict: 导入结果
    """
    success_count = 0
    error_count = 0
    updated_count = 0
    errors = []
    
    frappe.logger().info(f"Starting CSV import: {len(csv_data)} rows")
    
    # 获取字段映射
    field_mapping = get_import_field_mapping()
    field_labels = get_field_labels()
    reverse_label_mapping = {v: k for k, v in field_labels.items()}
    
    frappe.logger().info(f"Available field mappings: {list(field_mapping.keys())}")
    frappe.logger().info(f"Available reverse mappings: {list(reverse_label_mapping.keys())}")
    
    for i, row in enumerate(csv_data):
        try:
            frappe.logger().info(f"\n=== Processing row {i+2} ===")
            frappe.logger().info(f"Raw row data: {row}")
            frappe.logger().info(f"Row keys: {list(row.keys())}")
            
            # 预处理行数据，合并角色字段
            processed_row = preprocess_csv_row(row)
            frappe.logger().info(f"Preprocessed row: {processed_row}")
            
            # 转换字段名
            frappe.logger().info(f"Starting field conversion...")
            task_data = convert_row_to_task_data(processed_row, field_mapping, reverse_label_mapping)
            frappe.logger().info(f"Converted task data: {task_data}")
            
            if not task_data:
                error_msg = f"Row {i+2}: No valid data found"
                frappe.logger().warning(error_msg)
                if not skip_errors:
                    errors.append(error_msg)
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
                    frappe.logger().info(f"Row {i+2}: Task updated successfully")
                else:
                    success_count += 1
                    frappe.logger().info(f"Row {i+2}: Task created successfully")
            else:
                error_count += 1
                frappe.logger().error(f"Row {i+2}: {result['error']}")
                if not skip_errors:
                    errors.append(result['error'])
                elif len(errors) < 10:  # 限制错误信息数量
                    errors.append(result['error'])
                
        except Exception as e:
            error_count += 1
            error_msg = f"Row {i+2}: {str(e)}"
            frappe.logger().error(f"Exception in row {i+2}: {str(e)}")
            if not skip_errors:
                errors.append(error_msg)
            elif len(errors) < 10:
                errors.append(error_msg)
            
            if not skip_errors:
                break
    
    frappe.logger().info(f"Import completed: {success_count} success, {error_count} errors, {updated_count} updated")
    
    return {
        'success_count': success_count,
        'error_count': error_count,
        'updated_count': updated_count,
        'errors': errors
    }

def preprocess_csv_row(row):
    """
    预处理CSV行数据，合并角色字段
    
    Args:
        row (dict): 原始CSV行数据
    
    Returns:
        dict: 处理后的行数据
    """
    processed_row = row.copy()
    
    # 收集所有角色字段
    role_fields = {
        'Action Person': [],
        'Preparer': [],
        'Reviewer': [],
        'Partner': []
    }
    
    # 检查每个角色字段
    for field_name, field_value in row.items():
        if not field_value or str(field_value).strip() == '':
            continue
            
        field_name_clean = field_name.strip()
        field_value_clean = str(field_value).strip()
        
        # 检查是否为角色字段
        if field_name_clean in ['Action Person', 'ACTION PERSON', 'action-person']:
            # 解析邮箱列表
            emails = parse_email_list(field_value_clean)
            for email in emails:
                role_fields['Action Person'].append(f"{email} | Action Person")
        elif field_name_clean in ['Preparer', 'PREPARER', 'preparer']:
            emails = parse_email_list(field_value_clean)
            for email in emails:
                role_fields['Preparer'].append(f"{email} | Preparer")
        elif field_name_clean in ['Reviewer', 'REVIEWER', 'reviewer']:
            emails = parse_email_list(field_value_clean)
            for email in emails:
                role_fields['Reviewer'].append(f"{email} | Reviewer")
        elif field_name_clean in ['Partner', 'PARTNER', 'partner']:
            emails = parse_email_list(field_value_clean)
            for email in emails:
                role_fields['Partner'].append(f"{email} | Partner")
    
    # 合并所有角色信息为一个字段
    all_roles = []
    for role_type, role_entries in role_fields.items():
        all_roles.extend(role_entries)
    
    if all_roles:
        processed_row['_combined_roles'] = '; '.join(all_roles)
        frappe.logger().info(f"Combined roles: {processed_row['_combined_roles']}")
    
    return processed_row

def parse_email_list(email_string):
    """
    解析邮箱列表字符串
    
    Args:
        email_string (str): 邮箱字符串
    
    Returns:
        list: 邮箱列表
    """
    if not email_string:
        return []
    
    # 尝试不同的分隔符
    separators = [';', ',', '\n', '|']
    
    emails = [email_string]
    for sep in separators:
        if sep in email_string:
            emails = [e.strip() for e in email_string.split(sep) if e.strip()]
            break
    
    # 过滤有效邮箱
    valid_emails = []
    for email in emails:
        email = email.strip()
        if email and '@' in email:
            valid_emails.append(email)
    
    return valid_emails

def convert_row_to_task_data(row, field_mapping, reverse_label_mapping):
    """
    将CSV行数据转换为Task数据格式 - 完全重构版本
    
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
    
    # 存储Table字段数据，稍后处理
    table_fields_data = {}
    
    # 打印调试信息
    frappe.logger().info(f"\n--- Converting CSV row ---")
    frappe.logger().info(f"Row keys: {list(row.keys())}")
    frappe.logger().info(f"Row values preview: {dict(list(row.items())[:5])}")
    
    for csv_field, value in row.items():
        if not value or str(value).strip() == '':
            continue
        
        # 清理字段名和值
        clean_field = csv_field.strip()
        clean_value = str(value).strip()
        
        frappe.logger().info(f"\nProcessing field: '{clean_field}' = '{clean_value}'")
        
        # 尝试匹配字段 - 增强版本
        target_field = None
        
        # 1. 直接匹配字段映射
        if clean_field in field_mapping:
            target_field = field_mapping[clean_field]
            frappe.logger().info(f"Direct mapping: {clean_field} -> {target_field}")
        # 2. 通过标签映射匹配
        elif clean_field in reverse_label_mapping:
            smart_field = reverse_label_mapping[clean_field]
            if smart_field in field_mapping:
                target_field = field_mapping[smart_field]
                frappe.logger().info(f"Label mapping: {clean_field} -> {smart_field} -> {target_field}")
        # 3. 尝试模糊匹配常见字段
        else:
            target_field = fuzzy_match_field(clean_field, field_mapping)
            if target_field:
                frappe.logger().info(f"Fuzzy mapping: {clean_field} -> {target_field}")
        
        if target_field:
            frappe.logger().info(f"Mapped {clean_field} -> {target_field}")
            
            # 检查是否是Table字段
            if is_table_field_for_import(target_field):
                table_fields_data[target_field] = clean_value
                frappe.logger().info(f"📋 Stored table field data: {target_field} = {clean_value}")
            else:
                # 格式化普通字段值
                formatted_value = format_import_value(target_field, clean_value)
                task_data[target_field] = formatted_value
                frappe.logger().info(f"✅ Set field: {target_field} = {formatted_value}")
        else:
            frappe.logger().warning(f"❌ No mapping found for field: '{clean_field}'")
            # 显示所有可用的映射供参考
            available_mappings = [k for k in field_mapping.keys() if clean_field.lower() in k.lower() or k.lower() in clean_field.lower()]
            if available_mappings:
                frappe.logger().info(f"Similar mappings available: {available_mappings}")
    
    # 确保有基本的任务信息 - 增强版本
    if not task_data.get('subject'):
        # 尝试从不同来源获取任务名称
        subject_sources = ['Task Name', 'TASK NAME', 'task-name', 'subject', 'Task', 'Name', 'task_name']
        for source in subject_sources:
            if source in row and row[source] and str(row[source]).strip():
                task_data['subject'] = str(row[source]).strip()
                frappe.logger().info(f"Found subject from {source}: {task_data['subject']}")
                break
        
        # 如果还是没有，尝试从其他可能的字段获取
        if not task_data.get('subject'):
            # 检查所有包含"task"或"name"的字段
            for field_name, field_value in row.items():
                if field_value and str(field_value).strip():
                    field_lower = field_name.lower()
                    if ('task' in field_lower and 'name' in field_lower) or field_lower == 'task':
                        task_data['subject'] = str(field_value).strip()
                        frappe.logger().info(f"Found subject from fallback {field_name}: {task_data['subject']}")
                        break
        
        # 最后的默认值
        if not task_data.get('subject'):
            if task_data.get('custom_client'):
                task_data['subject'] = f"Task for {task_data['custom_client']}"
            else:
                task_data['subject'] = 'Imported Task'
                frappe.logger().warning("Using default subject: Imported Task")
    
    # 设置默认状态 - 修复：使用Smart Accounting的status字段和值
    if not task_data.get('custom_task_status'):
        task_data['custom_task_status'] = 'Not Started'  # Smart Accounting的默认状态
    
    # 存储Table字段数据供后续处理
    task_data['_table_fields_data'] = table_fields_data
    
    frappe.logger().info(f"\n--- Final Results ---")
    frappe.logger().info(f"Task data fields: {list(task_data.keys())}")
    frappe.logger().info(f"Subject: {task_data.get('subject', 'NOT SET!')}")
    frappe.logger().info(f"Table fields count: {len(table_fields_data)}")
    frappe.logger().info(f"Full task_data: {task_data}")
    return task_data

def format_import_value(field_name, value):
    """
    格式化导入值 - 修复版本
    
    Args:
        field_name (str): 字段名
        value (str): 原始值
    
    Returns:
        any: 格式化后的值
    """
    if not value:
        return None
    
    # Select字段 - Target Month和Year End是Select类型，不是日期
    if field_name in ['custom_target_month', 'custom_year_end']:
        return parse_select_value(value)
    
    # 真正的日期字段
    elif field_name in ['custom_process_date', 'custom_lodgement_due_date', 'custom_reset_date']:
        return parse_date_value(value)
    
    # Status字段 - 使用Smart Accounting的状态值
    elif field_name == 'custom_task_status':
        return parse_status_value(value)
    
    # 数值字段
    elif field_name in ['custom_budget_planning', 'custom_actual_billing']:
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

def parse_select_value(value):
    """
    解析Select字段值（如Target Month, Year End）
    
    Args:
        value (str): 原始值
    
    Returns:
        str: 解析后的值
    """
    if not value:
        return None
    
    value_str = str(value).strip()
    
    # 如果是日期格式，提取月份
    if '-' in value_str and len(value_str) >= 8:  # 可能是日期格式
        try:
            from datetime import datetime
            # 尝试解析日期并提取月份
            if value_str.count('-') == 2:  # DD-MM-YYYY 或 YYYY-MM-DD
                parts = value_str.split('-')
                if len(parts) == 3:
                    # 判断是 DD-MM-YYYY 还是 YYYY-MM-DD
                    if len(parts[2]) == 4:  # DD-MM-YYYY
                        month_num = int(parts[1])
                    elif len(parts[0]) == 4:  # YYYY-MM-DD
                        month_num = int(parts[1])
                    else:
                        return value_str
                    
                    # 转换为月份名称
                    month_names = [
                        '', 'January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'
                    ]
                    if 1 <= month_num <= 12:
                        return month_names[month_num]
        except:
            pass
    
    # 如果已经是月份名称，直接返回
    valid_months = ['January', 'February', 'March', 'April', 'May', 'June',
                   'July', 'August', 'September', 'October', 'November', 'December', '-']
    
    if value_str in valid_months:
        return value_str
    
    # 尝试模糊匹配月份名称
    value_lower = value_str.lower()
    for month in valid_months:
        if month != '-' and month.lower().startswith(value_lower[:3]):
            return month
    
    # 默认返回原值
    return value_str

def parse_status_value(value):
    """
    解析Smart Accounting的Status值
    
    Args:
        value (str): 原始状态值
    
    Returns:
        str: 有效的状态值
    """
    if not value:
        return 'Not Started'
    
    value_str = str(value).strip()
    
    # Smart Accounting的有效状态值
    valid_statuses = [
        'Not Started', 'Done', 'Working on it', 'Stuck', 
        'Ready for Manager Review', 'Ready for Partner Review',
        'Review Points to be Actioned', 'Ready to Send to Client',
        'Sent to Client for Signature', 'Ready to Lodge', 'Lodged',
        'Question Book Sent', 'Annual GST', 'Wait for Payment',
        'Waiting on Payroll', 'Waiting on Client', 'Hold',
        'Not Trading', 'R&D', 'For Invoicing'
    ]
    
    # 直接匹配
    if value_str in valid_statuses:
        return value_str
    
    # 尝试模糊匹配常见状态
    status_mapping = {
        'open': 'Not Started',
        'working': 'Working on it',
        'in progress': 'Working on it',
        'pending review': 'Ready for Manager Review',
        'completed': 'Done',
        'cancelled': 'Hold'
    }
    
    value_lower = value_str.lower()
    if value_lower in status_mapping:
        return status_mapping[value_lower]
    
    # 默认返回 'Not Started'
    frappe.logger().warning(f"Unknown status value: {value_str}, using 'Not Started'")
    return 'Not Started'

def fuzzy_match_field(csv_field, field_mapping):
    """
    模糊匹配字段名 - 增强版本
    
    Args:
        csv_field (str): CSV字段名
        field_mapping (dict): 字段映射
    
    Returns:
        str: 匹配的目标字段名
    """
    csv_lower = csv_field.lower().replace(' ', '').replace('-', '').replace('_', '')
    
    # 扩展的模糊匹配规则，包括导出的实际字段名
    fuzzy_rules = {
        # Task Name 相关
        'taskname': 'subject',
        'task': 'subject',
        'name': 'subject',
        
        # Client 相关
        'client': 'custom_client',
        'clientname': 'custom_client',
        'customer': 'custom_client',
        
        # Software 相关
        'software': 'custom_softwares',
        'softwares': 'custom_softwares',
        
        # Communication 相关
        'communicationmethod': 'custom_communication_methods',
        'communicationmethods': 'custom_communication_methods',
        'communication': 'custom_communication_methods',
        
        # 角色相关
        'actionperson': 'custom_roles',
        'preparer': 'custom_roles',
        'reviewer': 'custom_roles',
        'partner': 'custom_roles',
        
        # 日期和数值
        'targetmonth': 'custom_target_month',
        'target': 'custom_target_month',
        'month': 'custom_target_month',
        'yearend': 'custom_year_end',
        'budget': 'custom_budget_planning',
        'actual': 'custom_actual_billing',
        
        # 备注相关
        'reviewnote': 'custom_review_notes',
        'review': 'custom_review_notes',
        'note': 'custom_note',
        'notes': 'custom_note',
        
        # 基础字段
        'status': 'custom_task_status',  # 修复：使用自定义status字段
        'priority': 'priority',
        'entity': 'custom_service_line',
        'tftg': 'custom_tftg',
        'tf': 'custom_tftg',
        'tg': 'custom_tftg'
    }
    
    matched_field = fuzzy_rules.get(csv_lower)
    if matched_field:
        frappe.logger().info(f"Fuzzy match found: {csv_field} ({csv_lower}) -> {matched_field}")
    else:
        frappe.logger().warning(f"No fuzzy match for: {csv_field} ({csv_lower})")
    
    return matched_field

def is_table_field_for_import(field_name):
    """
    检查字段是否为Table类型字段
    
    Args:
        field_name (str): 字段名
    
    Returns:
        bool: 是否为Table字段
    """
    table_fields = [
        'custom_roles',
        'custom_softwares', 
        'custom_companies',
        'custom_communication_methods',
        'custom_review_notes'
    ]
    return field_name in table_fields

def create_new_task(task_data, board_view, row_number, selected_projects=None):
    """
    创建新任务 - 增强版本，支持Table字段处理
    
    Args:
        task_data (dict): 任务数据
        board_view (str): board视图
        row_number (int): 行号
        selected_projects (list): 选中的项目
    
    Returns:
        dict: 创建结果
    """
    try:
        # 提取Table字段数据
        table_fields_data = task_data.pop('_table_fields_data', {})
        
        frappe.logger().info(f"Creating task with data: {task_data}")
        frappe.logger().info(f"Table fields data: {table_fields_data}")
        
        # Add board related information
        if board_view != 'main':
            task_data['custom_partition'] = board_view
        
        # Assign to first selected project if no project specified and projects are selected
        if not task_data.get('project') and selected_projects and len(selected_projects) > 0:
            task_data['project'] = selected_projects[0]
        
        # Create task document
        task_doc = frappe.get_doc(task_data)
        task_doc.insert(ignore_permissions=True)
        
        frappe.logger().info(f"Task created: {task_doc.name}")
        
        # 处理Table字段数据
        if table_fields_data:
            process_table_fields_for_task(task_doc, table_fields_data)
            task_doc.save(ignore_permissions=True)
            frappe.logger().info(f"Table fields processed for task: {task_doc.name}")
        
        return {
            'success': True,
            'task_name': task_doc.name,
            'updated': False
        }
        
    except Exception as e:
        frappe.logger().error(f"Error creating task: {str(e)}")
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
    获取导入字段映射（Smart Accounting字段到ERPNext Task字段）- 更新版本
    
    Returns:
        dict: 字段映射
    """
    return {
        # 基础字段 - 扩展映射
        'Client Name': 'custom_client',
        'CLIENT NAME': 'custom_client',
        'client': 'custom_client',
        'Client': 'custom_client',
        'Task Name': 'subject',
        'TASK NAME': 'subject',
        'task-name': 'subject',
        'task_name': 'subject',
        'subject': 'subject',
        'Subject': 'subject',
        
        # 业务字段
        'Entity': 'custom_service_line',
        'entity': 'custom_service_line',
        'TF/TG': 'custom_tftg',
        'tf-tg': 'custom_tftg',
        'tftg': 'custom_tftg',
        
        # Table字段 - 这些会被特殊处理
        'Software': 'custom_softwares',
        'software': 'custom_softwares',
        'Communication Methods': 'custom_communication_methods',
        'communication-methods': 'custom_communication_methods',
        'Client Contact': 'custom_companies',
        'client-contact': 'custom_companies',
        
        # 角色字段 - 这些会被转换为custom_roles表
        'Action Person': 'custom_roles',
        'action-person': 'custom_roles', 
        'Preparer': 'custom_roles',
        'preparer': 'custom_roles',
        'Reviewer': 'custom_roles',
        'reviewer': 'custom_roles',
        'Partner': 'custom_roles',
        'partner': 'custom_roles',
        '_combined_roles': 'custom_roles',  # 合并后的角色字段
        
        # 状态和其他字段 - 修复：使用Smart Accounting自定义字段
        'Status': 'custom_task_status',
        'status': 'custom_task_status', 
        'STATUS': 'custom_task_status',
        'Priority': 'priority',
        'priority': 'priority',
        
        # 日期和数值字段
        'Target Month': 'custom_target_month',
        'target-month': 'custom_target_month',
        'Target Month': 'custom_target_month',
        'TARGET MONTH': 'custom_target_month',
        'Budget': 'custom_budget_planning',
        'budget': 'custom_budget_planning',
        'Actual': 'custom_actual_billing',
        'actual': 'custom_actual_billing',
        
        # 备注字段
        'Note': 'custom_note',
        'note': 'custom_note',
        'Review Note': 'custom_review_notes',
        'review-note': 'custom_review_notes',
        'review_note': 'custom_review_notes',
        'reviewnote': 'custom_review_notes',
        
        # 其他字段
        'Lodgement Due': 'custom_lodgement_due_date',
        'lodgment-due': 'custom_lodgement_due_date',
        'Engagement': 'custom_engagement',
        'engagement': 'custom_engagement',
        'Group': 'custom_companies',
        'group': 'custom_companies',
        'Year End': 'custom_year_end',
        'year-end': 'custom_year_end',
        'Year End': 'custom_year_end',
        'YEAR END': 'custom_year_end',
        'Frequency': 'custom_frequency',
        'frequency': 'custom_frequency',
        'Reset Date': 'custom_reset_date',
        'reset-date': 'custom_reset_date'
    }

def get_field_labels():
    """
    获取字段标签（与导出API保持一致）- 更新版本
    
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

def process_table_fields_for_task(task_doc, table_fields_data):
    """
    处理Task的Table字段数据
    
    Args:
        task_doc: Task文档对象
        table_fields_data (dict): Table字段数据
    """
    try:
        frappe.logger().info(f"Processing table fields for task {task_doc.name}: {table_fields_data}")
        
        for field_name, field_value in table_fields_data.items():
            if not field_value:
                continue
                
            frappe.logger().info(f"Processing table field: {field_name} = {field_value}")
            
            if field_name == 'custom_softwares':
                process_software_field(task_doc, field_value)
            elif field_name == 'custom_communication_methods':
                process_communication_methods_field(task_doc, field_value)
            elif field_name == 'custom_companies':
                process_companies_field(task_doc, field_value)
            elif field_name == 'custom_roles':
                process_roles_field(task_doc, field_value)
            elif field_name == 'custom_review_notes':
                process_review_notes_field(task_doc, field_value)
                
    except Exception as e:
        frappe.logger().error(f"Error processing table fields: {str(e)}")
        raise

def process_software_field(task_doc, software_value):
    """
    处理Software字段
    
    Args:
        task_doc: Task文档
        software_value (str): 软件值，如"MYOB; QuickBooks; Excel"
    """
    try:
        # 清理现有的软件记录
        task_doc.custom_softwares = []
        
        # 解析软件列表
        if ';' in software_value:
            software_list = [s.strip() for s in software_value.split(';') if s.strip()]
        elif ',' in software_value:
            software_list = [s.strip() for s in software_value.split(',') if s.strip()]
        else:
            software_list = [software_value.strip()] if software_value.strip() else []
        
        frappe.logger().info(f"Parsed software list: {software_list}")
        
        # 添加软件记录
        for software in software_list:
            task_doc.append('custom_softwares', {
                'software_name': software
            })
            
        frappe.logger().info(f"Added {len(software_list)} software records")
        
    except Exception as e:
        frappe.logger().error(f"Error processing software field: {str(e)}")
        raise

def process_communication_methods_field(task_doc, comm_value):
    """
    处理Communication Methods字段
    
    Args:
        task_doc: Task文档
        comm_value (str): 通信方式值，如"Phone Call; Teams Group"
    """
    try:
        # 清理现有记录
        task_doc.custom_communication_methods = []
        
        # 解析通信方式列表
        if ';' in comm_value:
            comm_list = [c.strip() for c in comm_value.split(';') if c.strip()]
        elif ',' in comm_value:
            comm_list = [c.strip() for c in comm_value.split(',') if c.strip()]
        else:
            comm_list = [comm_value.strip()] if comm_value.strip() else []
        
        frappe.logger().info(f"Parsed communication methods: {comm_list}")
        
        # 添加通信方式记录
        for method in comm_list:
            task_doc.append('custom_communication_methods', {
                'communication_method': method
            })
            
        frappe.logger().info(f"Added {len(comm_list)} communication method records")
        
    except Exception as e:
        frappe.logger().error(f"Error processing communication methods: {str(e)}")
        raise

def process_companies_field(task_doc, companies_value):
    """
    处理Companies字段
    
    Args:
        task_doc: Task文档
        companies_value (str): 公司值
    """
    try:
        # 清理现有记录
        task_doc.custom_companies = []
        
        # 解析公司列表
        if ';' in companies_value:
            company_list = [c.strip() for c in companies_value.split(';') if c.strip()]
        elif ',' in companies_value:
            company_list = [c.strip() for c in companies_value.split(',') if c.strip()]
        else:
            company_list = [companies_value.strip()] if companies_value.strip() else []
        
        frappe.logger().info(f"Parsed companies: {company_list}")
        
        # 添加公司记录
        for i, company in enumerate(company_list):
            task_doc.append('custom_companies', {
                'company': company,
                'is_primary': 1 if i == 0 else 0  # 第一个设为主要
            })
            
        frappe.logger().info(f"Added {len(company_list)} company records")
        
    except Exception as e:
        frappe.logger().error(f"Error processing companies: {str(e)}")
        raise

def process_roles_field(task_doc, roles_value):
    """
    处理角色字段 - 增强版本，支持合并后的角色数据
    
    Args:
        task_doc: Task文档
        roles_value (str): 角色值，格式为 "email | role; email | role"
    """
    try:
        # 清理现有角色记录
        task_doc.custom_roles = []
        
        frappe.logger().info(f"Processing roles value: {roles_value}")
        
        if not roles_value or str(roles_value).strip() == '':
            frappe.logger().info("No roles to process")
            return
        
        # 解析角色分配字符串
        # 期望格式: "jean@topfigures.com.au | Action Person; zigengwang464@gmail.com | Preparer"
        
        entries = [entry.strip() for entry in roles_value.split(';') if entry.strip()]
        
        for entry in entries:
            frappe.logger().info(f"Processing role entry: {entry}")
            
            if '|' in entry:
                # 包含角色信息的格式
                parts = entry.split('|')
                if len(parts) >= 2:
                    user_email = parts[0].strip()
                    role_name = parts[1].strip()
                    
                    if user_email and role_name:
                        # 验证用户是否存在
                        if frappe.db.exists("User", user_email):
                            # 检查用户是否启用
                            user_enabled = frappe.db.get_value("User", user_email, "enabled")
                            if user_enabled:
                                task_doc.append('custom_roles', {
                                    'role': role_name,
                                    'user': user_email,
                                    'is_primary': 1
                                })
                                frappe.logger().info(f"Added role: {role_name} -> {user_email}")
                            else:
                                frappe.logger().warning(f"User {user_email} is disabled")
                        else:
                            frappe.logger().warning(f"User {user_email} does not exist")
                    else:
                        frappe.logger().warning(f"Invalid role entry format: {entry}")
            else:
                # 没有角色信息，可能是纯邮箱列表
                # 这种情况下默认为Action Person
                user_email = entry.strip()
                if user_email and '@' in user_email:
                    if frappe.db.exists("User", user_email):
                        user_enabled = frappe.db.get_value("User", user_email, "enabled")
                        if user_enabled:
                            task_doc.append('custom_roles', {
                                'role': 'Action Person',
                                'user': user_email,
                                'is_primary': 1
                            })
                            frappe.logger().info(f"Added default role: Action Person -> {user_email}")
                        else:
                            frappe.logger().warning(f"User {user_email} is disabled")
                    else:
                        frappe.logger().warning(f"User {user_email} does not exist")
        
        frappe.logger().info(f"Added {len(task_doc.custom_roles)} role records")
        
    except Exception as e:
        frappe.logger().error(f"Error processing roles: {str(e)}")
        raise

def process_review_notes_field(task_doc, notes_value):
    """
    处理Review Notes字段 - 增强版本，支持智能分割
    
    Args:
        task_doc: Task文档
        notes_value (str): 备注值，可能包含多个备注（用分号分隔）
    """
    try:
        # 清理现有记录
        task_doc.custom_review_notes = []
        
        if not notes_value or not notes_value.strip():
            frappe.logger().info("No review notes to process")
            return
        
        frappe.logger().info(f"Processing review notes: {notes_value}")
        
        # 智能分割Review Notes
        individual_notes = smart_split_review_notes(notes_value)
        
        # 为每个备注创建记录
        for i, note_content in enumerate(individual_notes):
            if note_content and note_content.strip():
                task_doc.append('custom_review_notes', {
                    'note': note_content.strip(),
                    'created_by': frappe.session.user,
                    'created_date': frappe.utils.now()
                })
                frappe.logger().info(f"Added review note {i+1}: {note_content.strip()}")
        
        frappe.logger().info(f"Total review notes added: {len(individual_notes)}")
        
    except Exception as e:
        frappe.logger().error(f"Error processing review notes: {str(e)}")
        raise

def smart_split_review_notes(notes_value):
    """
    智能分割Review Notes，处理各种边界情况
    
    Args:
        notes_value (str): 原始备注字符串
    
    Returns:
        list: 分割后的备注列表
    """
    if not notes_value or not notes_value.strip():
        return []
    
    notes_value = notes_value.strip()
    
    # 策略1: 检查是否为导出格式（包含数字和分号）
    if is_likely_exported_format(notes_value):
        frappe.logger().info(f"Detected exported format, splitting by '; '")
        # 使用导出时的分隔符进行分割
        notes = [note.strip() for note in notes_value.split('; ') if note.strip()]
        return notes
    
    # 策略2: 检查是否包含其他分隔符
    elif ';' in notes_value and not is_single_note_with_semicolon(notes_value):
        frappe.logger().info(f"Detected multiple notes with semicolon separator")
        # 使用分号分割，但要更加小心
        notes = [note.strip() for note in notes_value.split(';') if note.strip()]
        return notes
    
    # 策略3: 单个备注（可能包含分号）
    else:
        frappe.logger().info(f"Treating as single note")
        return [notes_value]

def is_likely_exported_format(notes_value):
    """
    判断是否为导出格式的备注
    导出格式特征：
    1. 包含 '; ' (分号+空格)
    2. 分割后的每部分都是简短的数字或简单文本
    3. 没有复杂的句子结构
    
    Args:
        notes_value (str): 备注字符串
    
    Returns:
        bool: 是否为导出格式
    """
    if '; ' not in notes_value:
        return False
    
    # 分割并检查每个部分
    parts = notes_value.split('; ')
    
    # 如果只有2个部分且都是简短的，很可能是导出格式
    if len(parts) == 2:
        for part in parts:
            part = part.strip()
            # 检查是否为简单的数字或短文本
            if len(part) <= 20 and (part.replace('.', '').replace(',', '').replace(' ', '').isdigit() or len(part.split()) <= 3):
                continue
            else:
                return False
        return True
    
    # 如果有3个或更多部分，也可能是导出格式
    elif len(parts) >= 3:
        short_parts = 0
        for part in parts:
            part = part.strip()
            if len(part) <= 15:  # 短文本
                short_parts += 1
        
        # 如果大部分都是短文本，很可能是导出格式
        return short_parts >= len(parts) * 0.7
    
    return False

def has_escaped_quotes(notes_value):
    """
    检查是否包含转义的引号格式
    例如：'"Note with; semicolon"; "Another note"'
    
    Args:
        notes_value (str): 备注字符串
    
    Returns:
        bool: 是否包含转义格式
    """
    import re
    # 检查是否包含被引号包裹的内容
    pattern = r'"[^"]*"; "[^"]*"'
    return bool(re.search(pattern, notes_value))

def parse_escaped_notes(notes_value):
    """
    解析转义格式的备注
    例如：'"Note with; semicolon"; "Another note"' -> ['Note with; semicolon', 'Another note']
    
    Args:
        notes_value (str): 包含转义字符的备注字符串
    
    Returns:
        list: 解析后的备注列表
    """
    import re
    
    # 使用正则表达式提取被引号包裹的内容
    pattern = r'"([^"]*)"; "([^"]*)"|"([^"]*)";|;"([^"]*)"|"([^"]*)"|([^;"]+)'
    matches = re.findall(pattern, notes_value)
    
    notes = []
    for match in matches:
        # match是一个tuple，找到非空的匹配
        for group in match:
            if group and group.strip():
                notes.append(group.strip())
                break
    
    # 如果正则解析失败，回退到简单分割
    if not notes:
        frappe.logger().warning(f"Failed to parse escaped format, falling back to simple split")
        return [note.strip().strip('"') for note in notes_value.split('; ') if note.strip()]
    
    return notes

def clean_note_content(note_content):
    """
    清理备注内容，移除导出时添加的引号和其他格式字符
    
    Args:
        note_content (str): 原始备注内容
    
    Returns:
        str: 清理后的备注内容
    """
    if not note_content:
        return ''
    
    cleaned = str(note_content).strip()
    
    # 移除首尾的引号（导出时可能添加的）
    if cleaned.startswith('"') and cleaned.endswith('"'):
        cleaned = cleaned[1:-1]
    elif cleaned.startswith("'") and cleaned.endswith("'"):
        cleaned = cleaned[1:-1]
    
    # 移除其他可能的格式字符
    cleaned = cleaned.strip()
    
    # 处理转义的引号
    cleaned = cleaned.replace('""', '"')  # CSV转义的双引号
    
    return cleaned

def is_single_note_with_semicolon(notes_value):
    """
    判断是否为包含分号的单个备注
    例如："Please review the Q1 results; pay attention to the cash flow section"
    
    Args:
        notes_value (str): 备注字符串
    
    Returns:
        bool: 是否为单个备注
    """
    # 如果包含常见的句子连接词，很可能是单个备注
    sentence_indicators = [
        'please', 'note that', 'make sure', 'remember to', 'don\'t forget',
        'also', 'additionally', 'furthermore', 'however', 'therefore',
        'pay attention', 'be careful', 'ensure that'
    ]
    
    notes_lower = notes_value.lower()
    for indicator in sentence_indicators:
        if indicator in notes_lower:
            return True
    
    # 如果包含完整的英文句子结构（主谓宾）
    if ' the ' in notes_lower and (' and ' in notes_lower or ' or ' in notes_lower):
        return True
    
    # 如果包含日期或时间格式
    import re
    date_pattern = r'\d{1,2}[/-]\d{1,2}[/-]\d{2,4}'
    if re.search(date_pattern, notes_value):
        return True
    
    return False

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
