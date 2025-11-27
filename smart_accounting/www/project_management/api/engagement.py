# Smart Accounting - Engagement API
# Engagement相关API模块

import frappe
from frappe import _


@frappe.whitelist()
def get_engagement_info(task_id, engagement_id=None):
    """Get engagement information for a task"""
    try:
        task = frappe.get_doc("Task", task_id)
        engagement_id = engagement_id or getattr(task, 'custom_engagement', None)
        
        if not engagement_id:
            return {'success': False, 'message': 'No engagement linked to this task'}
        
        try:
            engagement = frappe.get_doc("Engagement", engagement_id)
        except:
            return {'success': False, 'error': 'Engagement not found or no access permission'}
        
        # Get file attachments
        engagement_letters = []
        try:
            files = frappe.get_all("File", 
                filters={
                    "attached_to_doctype": "Engagement",
                    "attached_to_name": engagement_id
                },
                fields=["file_name", "file_url"]
            )
            engagement_letters = [{'file_name': f.file_name, 'file_url': f.file_url} for f in files]
        except:
            pass
        
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
        
        # Get display names
        if engagement_info['customer']:
            engagement_info['customer_name'] = frappe.db.get_value("Customer", engagement_info['customer'], "customer_name") or engagement_info['customer']
        if engagement_info['company']:
            engagement_info['company_name'] = frappe.db.get_value("Company", engagement_info['company'], "company_name") or engagement_info['company']
        if engagement_info['owner_partner']:
            engagement_info['owner_partner_name'] = frappe.db.get_value("User", engagement_info['owner_partner'], "full_name") or engagement_info['owner_partner']
        
        return {
            'success': True,
            'engagement_info': engagement_info,
            'engagement_letters': engagement_letters,
            'el_count': len(engagement_letters)
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting engagement info: {str(e)}")
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def upload_engagement_file(engagement_id, file_content, file_name):
    """Upload a file to an engagement"""
    try:
        if not engagement_id or not file_content or not file_name:
            return {'success': False, 'error': 'Engagement ID, file content and file name are required'}
        
        if not frappe.db.exists('Engagement', engagement_id):
            return {'success': False, 'error': 'Engagement not found'}
        
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
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def delete_engagement_file(file_name, engagement_id):
    """Delete a file attached to an engagement"""
    try:
        if not file_name or not engagement_id:
            return {'success': False, 'error': 'File name and engagement ID are required'}
        
        file_doc = frappe.get_all("File",
            filters={
                "file_name": file_name,
                "attached_to_doctype": "Engagement",
                "attached_to_name": engagement_id
            },
            limit=1
        )
        
        if not file_doc:
            return {'success': False, 'error': 'File not found'}
        
        frappe.delete_doc("File", file_doc[0].name)
        frappe.db.commit()
        
        return {'success': True, 'message': 'File deleted successfully'}
        
    except Exception as e:
        frappe.log_error(f"Error deleting engagement file: {str(e)}")
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def get_review_notes(task_id):
    """Get review notes for a task"""
    try:
        if not task_id:
            return {'success': False, 'error': 'Task ID is required'}
        
        notes = frappe.get_all("Review Note",
            filters={"parent": task_id},
            fields=["name", "note", "creation", "owner"],
            order_by="creation desc"
        )
        
        return {'success': True, 'notes': notes}
    except Exception as e:
        frappe.log_error(f"Error getting review notes: {str(e)}")
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def add_review_note(task_id, note):
    """Add a review note to a task"""
    try:
        if not task_id or not note:
            return {'success': False, 'error': 'Task ID and note are required'}
        
        task_doc = frappe.get_doc("Task", task_id)
        task_doc.append('custom_review_notes', {'note': note})
        task_doc.save()
        frappe.db.commit()
        
        return {'success': True, 'message': 'Review note added successfully'}
    except Exception as e:
        frappe.log_error(f"Error adding review note: {str(e)}")
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def get_bulk_review_counts(task_ids):
    """Get review note counts for multiple tasks"""
    try:
        import json
        if isinstance(task_ids, str):
            task_ids = json.loads(task_ids)
        
        if not task_ids:
            return {'success': True, 'counts': {}}
        
        counts = {}
        for task_id in task_ids:
            count = frappe.db.count("Review Note", {"parent": task_id})
            counts[task_id] = count
        
        return {'success': True, 'counts': counts}
    except Exception as e:
        frappe.log_error(f"Error getting bulk review counts: {str(e)}")
        return {'success': False, 'error': str(e)}

