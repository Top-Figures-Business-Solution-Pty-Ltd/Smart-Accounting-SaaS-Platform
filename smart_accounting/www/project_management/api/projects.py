# Smart Accounting - Projects API
# 项目相关API模块

import frappe
from frappe import _


@frappe.whitelist()
def get_project_form_data():
    """
    Get data needed for project creation form
    """
    try:
        partitions = frappe.get_all("Partition", 
            fields=["name", "partition_name"],
            filters={"is_archived": ["!=", 1]},
            order_by="partition_name"
        )
        
        service_lines = []
        try:
            if frappe.db.exists("DocType", "Service Line"):
                service_lines = frappe.get_all("Service Line",
                    fields=["name", "service_name"],
                    order_by="service_name"
                )
        except:
            pass
        
        return {
            'success': True,
            'partitions': partitions,
            'service_lines': service_lines
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting project form data: {str(e)}")
        return {'success': False, 'error': str(e), 'partitions': [], 'service_lines': []}


@frappe.whitelist()
def create_project(project_name, service_line=None, partition=None, is_archived=0):
    """
    Create a new project
    """
    try:
        if not project_name or not project_name.strip():
            return {'success': False, 'error': 'Project name is required'}
        
        if not partition:
            return {'success': False, 'error': 'Partition is required'}
        
        if not frappe.db.exists("Partition", partition):
            return {'success': False, 'error': f'Partition "{partition}" not found'}
        
        project_doc = frappe.new_doc("Project")
        project_doc.project_name = project_name.strip()
        
        # Set naming series
        if hasattr(project_doc, 'naming_series'):
            try:
                series_list = frappe.get_meta("Project").get_field("naming_series")
                if series_list and series_list.options:
                    project_doc.naming_series = series_list.options.split('\n')[0].strip()
                else:
                    project_doc.naming_series = "PROJ-.####"
            except:
                project_doc.naming_series = "PROJ-.####"
        
        if service_line and hasattr(project_doc, 'service_line'):
            project_doc.service_line = service_line
        
        if hasattr(project_doc, 'custom_partition'):
            project_doc.custom_partition = partition
        
        if hasattr(project_doc, 'is_archived'):
            project_doc.is_archived = 1 if frappe.utils.cint(is_archived) else 0
        
        project_doc.status = "Open"
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
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def get_project_details(project_id):
    """Get project details"""
    try:
        if not project_id:
            return {'success': False, 'error': 'Project ID is required'}
        
        project = frappe.get_doc("Project", project_id)
        
        task_count = frappe.db.count("Task", {"project": project_id})
        
        return {
            'success': True,
            'project': {
                'name': project.name,
                'project_name': project.project_name,
                'status': project.status,
                'customer': project.customer,
                'custom_partition': getattr(project, 'custom_partition', None),
                'creation': project.creation,
                'modified': project.modified,
                'task_count': task_count
            }
        }
    except Exception as e:
        frappe.log_error(f"Error getting project details: {str(e)}")
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def update_project(project_id, project_name=None, status=None, customer=None, partition=None):
    """Update project details"""
    try:
        if not project_id:
            return {'success': False, 'error': 'Project ID is required'}
        
        project = frappe.get_doc("Project", project_id)
        
        if project_name:
            project.project_name = project_name
        if status:
            project.status = status
        if customer is not None:
            project.customer = customer
        if partition and hasattr(project, 'custom_partition'):
            project.custom_partition = partition
        
        project.save()
        frappe.db.commit()
        
        return {'success': True, 'message': 'Project updated successfully'}
    except Exception as e:
        frappe.log_error(f"Error updating project: {str(e)}")
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def delete_project(project_id):
    """Delete a project (with safety checks)"""
    try:
        if not project_id:
            return {'success': False, 'error': 'Project ID is required'}
        
        task_count = frappe.db.count("Task", {"project": project_id})
        if task_count > 0:
            return {'success': False, 'error': f'Cannot delete project. {task_count} tasks are associated.'}
        
        project_name = frappe.db.get_value("Project", project_id, "project_name")
        frappe.delete_doc("Project", project_id)
        
        return {'success': True, 'message': f'Project "{project_name}" deleted successfully'}
    except Exception as e:
        frappe.log_error(f"Error deleting project: {str(e)}")
        return {'success': False, 'error': str(e)}


@frappe.whitelist()
def get_projects_by_partition(partition):
    """Get all projects in a partition"""
    try:
        projects = frappe.get_all("Project",
            filters={"custom_partition": partition, "status": ["!=", "Cancelled"]},
            fields=["name", "project_name", "status", "customer", "creation"],
            order_by="project_name"
        )
        
        return {'success': True, 'projects': projects}
    except Exception as e:
        frappe.log_error(f"Error getting projects by partition: {str(e)}")
        return {'success': False, 'error': str(e), 'projects': []}

