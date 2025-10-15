# Copyright (c) 2025, Top Figures Pty Ltd and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.custom.doctype.custom_field.custom_field import create_custom_field


class DynamicFieldConfig(Document):
    """
    Dynamic Field Configuration for Smart Accounting
    Allows users to add custom fields without manual coding
    """
    
    def validate(self):
        """Validate field configuration before saving"""
        self.validate_field_name()
        self.validate_field_options()
        self.validate_transformation_rule()
    
    def validate_field_name(self):
        """Ensure field name follows ERPNext conventions"""
        if not self.field_name.startswith('custom_'):
            self.field_name = f"custom_{self.field_name}"
        
        # Remove spaces and special characters
        self.field_name = frappe.scrub(self.field_name)
    
    def validate_field_options(self):
        """Validate field options for Select fields"""
        if self.field_type == 'Select' and not self.field_options:
            frappe.throw("Field Options are required for Select field type")
    
    def validate_transformation_rule(self):
        """Validate transformation rule syntax"""
        if self.field_mapping_type != 'Direct' and self.transformation_rule:
            # Basic syntax validation - can be enhanced
            if 'return' not in self.transformation_rule:
                frappe.throw("Transformation rule must contain a return statement")
    
    def on_update(self):
        """Create or update the actual custom field when config is saved"""
        if self.is_active:
            self.create_custom_field()
        else:
            self.remove_custom_field()
    
    def create_custom_field(self):
        """Create the actual Custom Field based on this configuration"""
        try:
            # Check if custom field already exists
            existing_field = frappe.db.exists("Custom Field", {
                "dt": self.target_doctype,
                "fieldname": self.field_name
            })
            
            field_dict = {
                "dt": self.target_doctype,
                "fieldname": self.field_name,
                "label": self.field_label,
                "fieldtype": self.field_type,
                "options": self.field_options if self.field_type == 'Select' else None,
                "default": self.default_value,
                "reqd": 1 if self.is_mandatory else 0,
                "in_list_view": 1 if self.in_list_view else 0,
                "in_standard_filter": 1 if self.in_standard_filter else 0,
                "description": self.description,
                "depends_on": self.depends_on,
                "fetch_from": self.fetch_from,
                "insert_after": self.insert_after or "custom_client"
            }
            
            if existing_field:
                # Update existing field
                custom_field = frappe.get_doc("Custom Field", existing_field)
                for key, value in field_dict.items():
                    if value is not None:
                        setattr(custom_field, key, value)
                custom_field.save()
                frappe.msgprint(f"Updated custom field: {self.field_label}")
            else:
                # Create new field
                create_custom_field(self.target_doctype, field_dict)
                frappe.msgprint(f"Created custom field: {self.field_label}")
            
            # Clear cache to reflect changes
            frappe.clear_cache(doctype=self.target_doctype)
            
        except Exception as e:
            frappe.throw(f"Error creating custom field: {str(e)}")
    
    def remove_custom_field(self):
        """Remove the custom field if it exists"""
        try:
            existing_field = frappe.db.exists("Custom Field", {
                "dt": self.target_doctype,
                "fieldname": self.field_name
            })
            
            if existing_field:
                frappe.delete_doc("Custom Field", existing_field)
                frappe.msgprint(f"Removed custom field: {self.field_label}")
                
                # Clear cache to reflect changes
                frappe.clear_cache(doctype=self.target_doctype)
                
        except Exception as e:
            frappe.throw(f"Error removing custom field: {str(e)}")
    
    def on_trash(self):
        """Remove custom field when config is deleted"""
        self.remove_custom_field()


@frappe.whitelist()
def get_monday_board_fields(board_name):
    """
    Get available fields from a Monday.com board
    This is a placeholder - implement actual Monday.com API integration
    """
    # Placeholder data - replace with actual Monday.com API call
    sample_fields = {
        "Bookkeeping Clients": [
            "Task", "Method of Communication", "WeChat Group / WeChat Name / Email", 
            "Industry", "July", "August"
        ],
        "R&D Clients": [
            "Project", "Priority Level", "Accountant", "Progress Tracker", "Contacts"
        ],
        "Superannuation Processing": [
            "Task", "Preparer", "Status", "Process Date", "Date Due", "TF/TG", 
            "Software Used"
        ]
    }
    
    return sample_fields.get(board_name, [])


@frappe.whitelist()
def sync_monday_board(board_name):
    """
    Sync field configurations from a Monday.com board
    This creates Dynamic Field Config records based on Monday board structure
    """
    try:
        board_fields = get_monday_board_fields(board_name)
        created_configs = []
        
        for field_name in board_fields:
            # Skip if config already exists
            if frappe.db.exists("Dynamic Field Config", {"monday_field_name": field_name}):
                continue
            
            # Create field config based on field name analysis
            field_type = guess_field_type(field_name)
            
            config = frappe.get_doc({
                "doctype": "Dynamic Field Config",
                "field_name": frappe.scrub(field_name),
                "field_label": field_name,
                "field_type": field_type,
                "target_doctype": "Task",
                "monday_board_name": board_name,
                "monday_field_name": field_name,
                "field_mapping_type": "Direct",
                "is_active": 0,  # Start as inactive for review
                "in_list_view": 1
            })
            
            config.insert()
            created_configs.append(config.name)
        
        return {
            "success": True,
            "created_configs": created_configs,
            "message": f"Created {len(created_configs)} field configurations from {board_name}"
        }
        
    except Exception as e:
        frappe.log_error(f"Error syncing Monday board: {str(e)}")
        return {
            "success": False,
            "message": f"Error syncing board: {str(e)}"
        }


def guess_field_type(field_name):
    """Guess ERPNext field type based on Monday field name"""
    field_name_lower = field_name.lower()
    
    if 'date' in field_name_lower:
        return 'Date'
    elif 'email' in field_name_lower:
        return 'Data'
    elif 'status' in field_name_lower:
        return 'Select'
    elif 'priority' in field_name_lower:
        return 'Select'
    elif 'progress' in field_name_lower or 'tracker' in field_name_lower:
        return 'Percent'
    elif 'method' in field_name_lower or 'software' in field_name_lower:
        return 'Select'
    elif 'industry' in field_name_lower:
        return 'Data'
    else:
        return 'Data'  # Default to Data field
