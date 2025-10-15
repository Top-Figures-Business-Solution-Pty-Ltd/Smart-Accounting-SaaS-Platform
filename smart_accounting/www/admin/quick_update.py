"""
快速更新工具 - 为所有Partition添加Process Date列
访问: /admin/quick_update?action=update_columns
"""

import frappe
from smart_accounting.www.project_management.index import update_all_partitions_with_new_column

def get_context(context):
    """处理GET请求"""
    
    # 检查用户权限
    if not frappe.session.user or frappe.session.user == 'Guest':
        frappe.throw("请先登录")
    
    if not frappe.has_permission("Partition", "write"):
        frappe.throw("权限不足：需要Partition写入权限")
    
    # 获取action参数
    action = frappe.form_dict.get('action')
    
    if action == 'update_columns':
        try:
            # 执行更新
            result = update_all_partitions_with_new_column()
            
            context.update({
                'success': True,
                'result': result,
                'message': f"成功更新了 {result.get('updated_count', 0)} 个Partition"
            })
            
        except Exception as e:
            context.update({
                'success': False,
                'error': str(e),
                'message': f"更新失败: {str(e)}"
            })
    else:
        context.update({
            'success': None,
            'message': '请提供有效的action参数'
        })
    
    return context
