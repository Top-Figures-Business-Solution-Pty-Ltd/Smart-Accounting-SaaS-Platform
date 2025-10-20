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
def import_board_data():
    """
    从CSV文件导入board数据
    
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
            return {
                'success': False,
                'error': 'Please upload a CSV file'
            }
        
        # 读取文件内容
        file_content = uploaded_file.read().decode('utf-8')
        
        # 解析CSV数据
        csv_data = parse_csv_content(file_content)
        
        if not csv_data:
            return {
                'success': False,
                'error': 'No valid data found in CSV file'
            }
        
        # 验证数据格式
        validation_result = validate_csv_data(csv_data, board_view)
        if not validation_result['valid']:
            return {
                'success': False,
                'error': validation_result['error']
            }
        
        # Execute import
        import_result = process_csv_import(
            csv_data, 
            board_view, 
            import_mode, 
            skip_errors,
            selected_projects
        )
        
        # 记录导入日志
        log_import_activity(board_view, import_result)
        
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
        
        frappe.log_error(f"CSV Import Activity: {json.dumps(activity_log)}", "CSV Import Log")
        
    except Exception as e:
        frappe.log_error(f"Error logging import activity: {str(e)}")

@frappe.whitelist()
def get_import_template(board_view):
    """
    获取导入模板
    
    Args:
        board_view (str): board视图名称
    
    Returns:
        dict: 模板信息
    """
    try:
        field_labels = get_field_labels()
        
        # 生成模板CSV内容
        template_headers = list(field_labels.values())
        
        # 添加示例数据行
        example_row = {
            'Client Name': 'Example Client Ltd',
            'Task Name': 'Annual Tax Return',
            'Entity': 'Company',
            'TF/TG': 'TF',
            'Software': 'Xero',
            'Status': 'Open',
            'Target Month': '31-12-2024',
            'Budget': '1500.00',
            'Actual': '0.00'
        }
        
        # 生成CSV内容
        import csv
        from io import StringIO
        
        output = StringIO()
        writer = csv.writer(output)
        
        # 写入标题
        writer.writerow(template_headers)
        
        # 写入示例行
        example_values = []
        for header in template_headers:
            example_values.append(example_row.get(header, ''))
        writer.writerow(example_values)
        
        csv_content = output.getvalue()
        
        return {
            'success': True,
            'csv_content': csv_content,
            'filename': f'SmartAccounting_ImportTemplate_{board_view}.csv'
        }
        
    except Exception as e:
        frappe.log_error(f"Error generating import template: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }
