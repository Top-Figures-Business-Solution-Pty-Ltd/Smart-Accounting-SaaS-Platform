import frappe
from frappe import _

def before_request():
    """
    Smart Accounting 访问控制系统
    多层安全策略：完全隔离ERPNext系统访问，只允许Administrator访问
    """
    # 确保frappe.local存在
    if not hasattr(frappe, 'local') or not frappe.local:
        return
    
    # 确保request存在
    if not hasattr(frappe.local, 'request') or not frappe.local.request:
        return
    
    # 获取当前请求路径
    path = frappe.local.request.path
    current_user = frappe.session.user
    
    # 调试信息：记录访问尝试
    print(f"DEBUG: Access attempt - User: {current_user}, Path: {path}")
    
    # 强制检查：如果路径是 /app 开头，立即处理
    if path.startswith('/app'):
        print(f"DEBUG: Direct /app access detected by {current_user}")
        if current_user != 'Administrator':
            print(f"DEBUG: BLOCKING access for {current_user} - Redirecting to /project_management")
            # 使用正确的重定向方法
            frappe.local.response['type'] = 'redirect'
            frappe.local.response['location'] = '/project_management'
            return
        else:
            print(f"DEBUG: ALLOWING access for Administrator to {path}")
            # Administrator可以继续访问，不做任何阻拦
            return
    
    # 允许的公共路径（不需要特殊权限）
    public_paths = [
        '/login',
        '/project_management',
        '/api/method/login',
        '/api/method/logout',
        '/api/method/smart_accounting',  # Smart Accounting的API调用
        '/assets/',  # 静态资源
        '/files/',   # 文件访问
        '/private/', # 私有文件
        '/api/method/frappe.website',  # 网站相关API
        '/api/method/frappe.core.doctype.file',  # 文件上传API
    ]
    
    # 检查是否是允许的公共路径
    is_public_path = any(path.startswith(allowed) for allowed in public_paths)
    
    # 如果是ERPNext系统路径 (/app, /desk, 等)
    erpnext_system_paths = [
        '/app',           # Main ERPNext application
        '/desk',          # ERPNext desk interface  
        '/api/resource',  # ERPNext API resources
        '/printview',     # Print views
        '/report',        # ERPNext reports
        '/query-report',  # Query reports
        '/dashboard',     # ERPNext dashboards
        '/list',          # List views
        '/form',          # Form views
        '/tree',          # Tree views
        '/kanban',        # Kanban views
        '/calendar',      # Calendar views
        '/gantt',         # Gantt charts
        '/image',         # Image views
        '/setup'          # Setup wizard
    ]
    is_erpnext_path = any(path.startswith(erpnext_path) for erpnext_path in erpnext_system_paths)
    
    if is_erpnext_path:
        current_user = frappe.session.user
        
        print(f"DEBUG: ERPNext path detected - User: {current_user}, Path: {path}")
        
        # 只允许Administrator用户直接访问ERPNext系统页面
        if current_user != 'Administrator':
            print(f"DEBUG: Access DENIED for {current_user} to {path} - Redirecting to /project_management")
            
            # 非管理员用户一律重定向到项目管理页面
            frappe.local.response['type'] = 'redirect'
            frappe.local.response['location'] = '/project_management'
            
            # 记录未授权访问尝试（用于安全审计）
            frappe.log_error(
                f"Non-administrator access attempt by {current_user} to ERPNext system path {path}",
                "Security Alert - ERPNext Access Denied"
            )
            return
        else:
            print(f"DEBUG: Access GRANTED for Administrator to {path}")
        
        # Administrator用户可以直接访问，无需额外的dev_system_access检查
        # 这简化了管理员的工作流程
    
    # 如果是不允许的路径且不是API调用
    elif not is_public_path and not path.startswith('/api/'):
        # 重定向到适当的页面
        if frappe.session.user != 'Guest':
            frappe.local.response['type'] = 'redirect'
            frappe.local.response['location'] = '/project_management'
        else:
            frappe.local.response['type'] = 'redirect'
            frappe.local.response['location'] = '/login'

@frappe.whitelist()
def get_system_access_status():
    """
    获取当前用户的系统访问状态
    """
    try:
        current_user = frappe.session.user
        user_roles = frappe.get_roles()
        dev_access = frappe.session.get('dev_system_access', False)
        
        return {
            'success': True,
            'user': current_user,
            'roles': user_roles,
            'has_dev_access': dev_access,
            'can_request_dev_access': ('Administrator' in user_roles or 'System Manager' in user_roles),
            'is_smart_accounting_user': current_user != 'Guest'
        }
    except Exception as e:
        frappe.log_error(f"Error getting system access status: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist()
def check_erpnext_access():
    """
    检查当前用户是否可以访问ERPNext系统页面
    """
    try:
        current_user = frappe.session.user
        can_access = current_user == 'Administrator'
        
        return {
            'success': True,
            'user': current_user,
            'can_access_erpnext': can_access,
            'access_level': 'Administrator' if can_access else 'Standard User',
            'message': 'Access granted to ERPNext system' if can_access else 'Access restricted to Smart Accounting only'
        }
    except Exception as e:
        frappe.log_error(f"Error checking ERPNext access: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist()
def revoke_all_dev_access():
    """
    管理员功能：撤销所有用户的开发者访问权限
    """
    try:
        # 只允许Administrator执行此操作
        if frappe.session.user != 'Administrator':
            return {
                'success': False,
                'message': 'Only Administrator can revoke all dev access'
            }
        
        # 这里可以扩展为撤销所有活跃会话的dev access
        # 目前只撤销当前用户的
        frappe.session.pop('dev_system_access', None)
        
        return {
            'success': True,
            'message': 'All developer access revoked'
        }
    except Exception as e:
        frappe.log_error(f"Error revoking all dev access: {str(e)}")
        return {
            'success': False,
            'message': 'Error processing request'
        }
