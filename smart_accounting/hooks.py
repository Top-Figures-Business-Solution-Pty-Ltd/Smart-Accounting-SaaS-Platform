"""
Smart Accounting - hooks.py
Version: 2.0 (Clean Slate - 2025-12-16)
Based on: Document A v6.0, Document E v2.0
"""

app_name = "smart_accounting"
app_title = "Smart Accounting"
app_publisher = "Top Figures Pty Ltd"
app_description = "Smart Accounting SaaS Platform for Accounting Firms"
app_email = "Jeffrey@topfigures.com.au"
app_license = "mit"
app_version = "2.0.0"

# Required apps
# required_apps = []

# Home Page
# Set your home page route here (after implementing frontend)
# home_page = "/smart_accounting"

# Client Scripts (JavaScript)
doctype_js = {
    "Project": "public/js/project.js"
}

# DocType Class Overrides (Python)
override_doctype_class = {
    "Project": "smart_accounting.custom.project.CustomProject"
}

# Document Events
# Hook on document methods and events
# doc_events = {
#     "Project": {
#         "before_save": "smart_accounting.custom_methods.project.before_save"
#     }
# }

# Scheduled Tasks
# scheduler_events = {
#     "daily": [
#         "smart_accounting.tasks.daily"
#     ]
# }

# Fixtures
# Export DocTypes and Custom Fields to fixtures for version control
fixtures = [
    # Custom Fields for ERPNext native DocTypes
    {
        "doctype": "Custom Field",
        "filters": [
            ["dt", "in", [
                "Project",
                "Task", 
                "Customer",
                "Contact",
                "Project Type"
            ]]
        ]
    },
    # Property Setters for Select field options
    {
        "doctype": "Property Setter",
        "filters": [
            ["doc_type", "in", [
                "Project",
                "Task",
                "Customer", 
                "Contact",
                "Project Type"
            ]]
        ]
    },
    # Custom DocTypes
    {
        "doctype": "DocType",
        "filters": [
            ["name", "in", [
                "Software",
                "Saved View",
                "Customer Entity",
                "Project Team Member"
            ]]
        ]
    }
]

# Override standard ERPNext methods (if needed)
# override_whitelisted_methods = {
#     "frappe.desk.doctype.event.event.get_events": "smart_accounting.overrides.get_events"
# }

# Access Control (optional - uncomment if needed)
# before_request = ["smart_accounting.access_control.before_request"]

# Installation
# before_install = "smart_accounting.setup.before_install"
# after_install = "smart_accounting.setup.after_install"
