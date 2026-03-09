"""
Smart Accounting - hooks.py
Version: 2.1 (UI Framework Added - 2026-01-04)
Based on: Document A v8.2, Document D v1.1
"""

app_name = "smart_accounting"
app_title = "Smart Accounting"
app_publisher = "Top Figures Pty Ltd"
app_description = "Smart Accounting SaaS Platform for Accounting Firms"
app_email = "Jeffrey@topfigures.com.au"
app_license = "mit"
app_version = "2.1.0"

# Required apps
# required_apps = []

# Home Page
# Set your home page route here (after implementing frontend)
# home_page = "/smart-board"

# App Include - 尽量不要全局注入页面级资源（保持架构健康）
# Smart Board 的 JS/CSS 会在 Desk Page `project_management` 内按需加载。

# Keep legacy URL stable (e.g. Cloudflare Tunnel / bookmarks)
website_redirects = [
    # Keep legacy URL stable (Cloudflare Tunnel / old shortcuts)
    {"source": r"/project_management(.*)", "target": r"/app/project-management\1"},
    # Also accept kebab-case direct entry
    {"source": r"/project-management(.*)", "target": r"/app/project-management\1"},
]

# DocType Class Overrides (Python)
override_doctype_class = {
    "Project": "smart_accounting.custom.project.CustomProject",
    "Project Type": "smart_accounting.overrides.project_type.SmartProjectType",
}

# Document Events
# Hook on document methods and events
# doc_events = {
#     "Project": {
#         "before_save": "smart_accounting.custom_methods.project.before_save"
#     }
# }

# Scheduled Tasks
scheduler_events = {
    "daily": [
        "smart_accounting.api.automation.run_due_date_automations_daily"
    ],
    "hourly": [
        "smart_accounting.api.automation.run_due_date_automations_hourly"
    ]
}

# Fixtures
# Export DocTypes and Custom Fields to fixtures for version control
fixtures = [
    # Roles used by Smart Accounting (so test/prod imports won't miss them)
    {
        "doctype": "Role",
        "filters": [
            ["name", "in", [
                "Smart Accounting User"
            ]]
        ]
    },
    # Role permissions (customized via Role Permission Manager).
    # NOTE: We intentionally export only the permissions for Smart Accounting User
    # to avoid pulling unrelated system-wide permission customizations into this app.
    {
        "doctype": "Custom DocPerm",
        "filters": [
            ["role", "in", [
                "Smart Accounting User"
            ]]
        ]
    },
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
                "Monthly Status",
				"Project Team Member",
				"Project Software",
				"Board Automation",
				"Automation Run Log",
				"Automation Run Log Change"
            ]]
        ]
    }
]

# Override whitelisted methods
override_whitelisted_methods = {
    "frappe.client.insert": "smart_accounting.api.client_insert_override.insert"
}

# Access Control (Product shell hard-gate)
# External users will be redirected away from Desk (/app*) to /smart.
before_request = ["smart_accounting.access_control.before_request"]

# Installation
# before_install = "smart_accounting.setup.before_install"
# after_install = "smart_accounting.setup.after_install"
