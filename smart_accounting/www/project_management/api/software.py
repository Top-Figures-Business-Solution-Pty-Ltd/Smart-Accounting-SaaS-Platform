# Smart Accounting - Software API
# 软件相关API模块

import frappe
from frappe import _
import json


@frappe.whitelist()
def get_software_options():
    """
    Get available software options from Task Software DocType
    带缓存机制，避免重复的元数据查询
    """
    cache_key = "smart_accounting:software_options"
    
    cached_result = frappe.cache().get_value(cache_key)
    if cached_result:
        return cached_result
    
    try:
        task_software_meta = frappe.get_meta("Task Software")
        software_field = None
        
        for field in task_software_meta.fields:
            if field.fieldname == "software":
                software_field = field
                break
        
        if software_field and hasattr(software_field, 'options') and software_field.options:
            options = [opt.strip() for opt in software_field.options.split('\n') if opt.strip()]
            result = {'success': True, 'software_options': options}
        else:
            result = {
                'success': True, 
                'software_options': ['Xero', 'MYOB', 'QuickBooks', 'Excel', 'Payroller', 'Oracle', 'Logdit', 'Other']
            }
        
        frappe.cache().set_value(cache_key, result, expires_in_sec=3600)
        return result
            
    except Exception as e:
        frappe.log_error(f"Error getting software options: {str(e)}")
        result = {
            'success': True,
            'software_options': ['Xero', 'MYOB', 'QuickBooks', 'Excel', 'Other']
        }
        frappe.cache().set_value(cache_key, result, expires_in_sec=300)
        return result


@frappe.whitelist()
def get_task_softwares(task_id):
    """
    Get task software assignments from sub-table
    """
    try:
        if not task_id:
            return {'success': False, 'error': 'Task ID is required'}
        
        cache_key = f"smart_accounting:task_softwares:{task_id}"
        
        cached_result = frappe.cache().get_value(cache_key)
        if cached_result:
            return cached_result
        
        softwares = frappe.get_all("Task Software",
            filters={"parent": task_id},
            fields=["software", "is_primary"],
            order_by="is_primary desc, software"
        )
        
        result = {'success': True, 'softwares': softwares}
        
        frappe.cache().set_value(cache_key, result, expires_in_sec=300)
        return result
        
    except Exception as e:
        frappe.log_error(f"Error getting task softwares: {str(e)}")
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def set_task_softwares(task_id, softwares_data):
    """
    Set task software assignments
    softwares_data: [{"software": "Xero", "is_primary": True}, ...]
    """
    try:
        if not task_id:
            return {'success': False, 'error': 'Task ID is required'}
        
        if isinstance(softwares_data, str):
            softwares_data = json.loads(softwares_data)
        
        task_doc = frappe.get_doc("Task", task_id)
        task_doc.custom_softwares = []
        
        for software_data in softwares_data:
            software = software_data.get('software')
            is_primary = software_data.get('is_primary', False)
            
            if not software:
                continue
                
            task_doc.append('custom_softwares', {
                'software': software,
                'is_primary': is_primary
            })
        
        task_doc.save()
        frappe.db.commit()
        
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


def get_primary_software(task_doc):
    """
    Get primary software from sub-table
    """
    try:
        if not hasattr(task_doc, 'custom_softwares') or not task_doc.custom_softwares:
            return None
        
        for software_assignment in task_doc.custom_softwares:
            if software_assignment.is_primary:
                return software_assignment.software
        
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
        
        softwares = []
        for software_assignment in task_doc.custom_softwares:
            softwares.append({
                'software': software_assignment.software,
                'is_primary': software_assignment.is_primary
            })
        
        return softwares if softwares else None
        
    except:
        return None

