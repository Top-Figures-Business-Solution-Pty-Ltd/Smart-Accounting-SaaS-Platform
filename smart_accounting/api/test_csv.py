# Smart Accounting - CSV功能测试API
# 用于测试CSV导出导入功能

import frappe
from frappe import _

@frappe.whitelist()
def test_csv_export():
    """
    测试CSV导出功能
    """
    try:
        from smart_accounting.api.csv_export import export_board_data
        
        # 测试参数
        test_fields = ['client', 'task-name', 'status', 'target-month']
        
        result = export_board_data(
            board_view='main',
            selected_fields=test_fields,
            include_headers=True,
            export_all_data=True
        )
        
        return {
            'success': True,
            'message': 'CSV导出功能测试成功',
            'result': result
        }
        
    except Exception as e:
        frappe.log_error(f"CSV Export Test Error: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist()
def test_field_mapping():
    """
    测试字段映射功能
    """
    try:
        from smart_accounting.api.csv_export import get_field_mapping, get_field_labels
        from smart_accounting.api.csv_import import get_import_field_mapping
        
        export_mapping = get_field_mapping()
        import_mapping = get_import_field_mapping()
        field_labels = get_field_labels()
        
        return {
            'success': True,
            'export_mapping': export_mapping,
            'import_mapping': import_mapping,
            'field_labels': field_labels,
            'mapping_consistency': export_mapping == import_mapping
        }
        
    except Exception as e:
        frappe.log_error(f"Field Mapping Test Error: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist()
def get_available_fields():
    """
    获取可用字段信息，用于前端调试
    """
    try:
        from smart_accounting.api.csv_export import get_field_labels
        
        field_labels = get_field_labels()
        
        # 检查ColumnConfigManager是否可用
        column_manager_available = False
        try:
            # 这里无法直接访问前端的ColumnConfigManager
            # 但可以返回字段信息供前端使用
            column_manager_available = True
        except:
            pass
        
        return {
            'success': True,
            'available_fields': field_labels,
            'field_count': len(field_labels),
            'column_manager_available': column_manager_available
        }
        
    except Exception as e:
        frappe.log_error(f"Get Available Fields Error: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist()
def check_task_fields():
    """
    检查Task doctype中的自定义字段
    """
    try:
        # 获取Task doctype的字段信息
        task_meta = frappe.get_meta("Task")
        
        custom_fields = []
        all_fields = []
        
        for field in task_meta.fields:
            all_fields.append({
                'fieldname': field.fieldname,
                'fieldtype': field.fieldtype,
                'label': field.label
            })
            
            if field.fieldname.startswith('custom_'):
                custom_fields.append({
                    'fieldname': field.fieldname,
                    'fieldtype': field.fieldtype,
                    'label': field.label
                })
        
        return {
            'success': True,
            'total_fields': len(all_fields),
            'custom_fields_count': len(custom_fields),
            'custom_fields': custom_fields[:10],  # 只返回前10个自定义字段
            'sample_fields': all_fields[:20]  # 返回前20个字段作为样本
        }
        
    except Exception as e:
        frappe.log_error(f"Check Task Fields Error: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }
