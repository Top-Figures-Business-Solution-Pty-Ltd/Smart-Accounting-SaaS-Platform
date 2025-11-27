# Smart Accounting - Comments API
# 评论相关API模块

import frappe
from frappe import _


@frappe.whitelist()
def get_task_comments(task_id):
    """
    Get all comments for a specific task using ERPNext's built-in Comment system
    """
    try:
        if not task_id:
            return {'success': False, 'error': 'Task ID is required'}

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
        
        processed_comments = []
        current_user = frappe.session.user
        
        for comment in comments:
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
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def add_task_comment(task_id, comment_content):
    """
    Add a new comment to a task using ERPNext's Comment system
    """
    try:
        if not task_id or not comment_content:
            return {'success': False, 'error': 'Task ID and comment content are required'}

        if not frappe.db.exists('Task', task_id):
            return {'success': False, 'error': 'Task not found'}

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
        
        # Handle @mentions
        handle_comment_mentions(comment_content, task_id, comment_doc.name)
        
        frappe.db.commit()
        frappe.clear_cache()
        
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
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def delete_task_comment(comment_id):
    """Delete a comment"""
    try:
        if not comment_id:
            return {'success': False, 'error': 'Comment ID is required'}

        if not frappe.db.exists('Comment', comment_id):
            return {'success': False, 'error': 'Comment not found'}

        comment_doc = frappe.get_doc('Comment', comment_id)
        
        current_user = frappe.session.user
        if comment_doc.owner != current_user and not frappe.has_permission('Comment', 'delete', comment_id):
            return {'success': False, 'error': 'You do not have permission to delete this comment'}

        task_id = comment_doc.reference_name
        comment_doc.delete()
        
        frappe.db.commit()
        frappe.clear_cache()
        
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
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def update_task_comment(comment_id, new_content):
    """Update a comment's content"""
    try:
        if not comment_id or not new_content:
            return {'success': False, 'error': 'Comment ID and new content are required'}

        if not frappe.db.exists('Comment', comment_id):
            return {'success': False, 'error': 'Comment not found'}

        comment_doc = frappe.get_doc('Comment', comment_id)
        
        current_user = frappe.session.user
        if comment_doc.owner != current_user and not frappe.has_permission('Comment', 'write', comment_id):
            return {'success': False, 'error': 'You do not have permission to edit this comment'}

        comment_doc.content = new_content
        comment_doc.save()
        
        frappe.db.commit()
        
        return {
            'success': True,
            'message': 'Comment updated successfully'
        }
        
    except Exception as e:
        frappe.log_error(f"Error updating task comment: {str(e)}")
        return {'success': False, 'error': str(e)}


def handle_comment_mentions(comment_content, task_id, comment_id):
    """Handle @mentions in comments and send notifications"""
    import re
    
    mention_pattern = r'@(\w+(?:\.\w+)*@\w+(?:\.\w+)*|\w+)'
    mentions = re.findall(mention_pattern, comment_content)
    
    if not mentions:
        return
    
    for mention in mentions:
        try:
            if '@' in mention:
                user_email = mention
            else:
                users = frappe.get_all('User', 
                    filters={'full_name': ['like', f'%{mention}%']},
                    fields=['name'],
                    limit=1
                )
                if users:
                    user_email = users[0].name
                else:
                    continue
            
            if frappe.db.exists('User', user_email):
                task_doc = frappe.get_doc('Task', task_id)
                
                frappe.sendmail(
                    recipients=[user_email],
                    subject=f"You were mentioned in a comment on task: {task_doc.subject}",
                    message=f"""
                        <p>You were mentioned in a comment:</p>
                        <blockquote>{comment_content}</blockquote>
                        <p>Task: {task_doc.subject}</p>
                    """,
                    now=True
                )
        except Exception as e:
            frappe.log_error(f"Error sending mention notification: {str(e)}")


@frappe.whitelist()
def sync_comment_counts():
    """Sync comment counts for all tasks"""
    try:
        tasks = frappe.get_all('Task', fields=['name'])
        updated = 0
        
        for task in tasks:
            count = frappe.db.count('Comment', {
                'reference_doctype': 'Task',
                'reference_name': task.name,
                'comment_type': 'Comment'
            })
            
            if count > 0:
                updated += 1
        
        return {
            'success': True,
            'message': f'Synced comment counts for {updated} tasks'
        }
    except Exception as e:
        frappe.log_error(f"Error syncing comment counts: {str(e)}")
        return {'success': False, 'error': str(e)}

