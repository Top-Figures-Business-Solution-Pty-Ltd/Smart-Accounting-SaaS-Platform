# Smart Accounting - API Module
# API模块，提供所有对外暴露的API接口

# Dashboard APIs
from .dashboard import (
    get_main_dashboard_data,
    get_workspace_overview_data,
    get_workspace_title
)

# Tasks APIs
from .tasks import (
    update_task_status,
    update_task_field,
    update_task_client,
    create_subtask,
    get_subtasks,
    get_task_status_options,
    archive_task,
    unarchive_task
)

# Partitions APIs
from .partitions import (
    create_partition,
    archive_partition,
    get_child_partitions,
    get_available_workspaces,
    get_all_partitions,
    update_partition_columns,
    get_partition_config,
    get_default_subtask_column_config
)

# Roles APIs
from .roles import (
    get_task_roles,
    update_task_roles,
    add_role_assignment,
    remove_role_assignment,
    set_primary_role,
    get_user_display_info,
    get_bulk_roles_info,
    get_primary_role_user,
    get_role_users_info
)

# Comments APIs
from .comments import (
    get_task_comments,
    add_task_comment,
    delete_task_comment,
    update_task_comment,
    sync_comment_counts
)

# Software APIs
from .software import (
    get_software_options,
    get_task_softwares,
    set_task_softwares,
    get_primary_software,
    get_software_info
)

# Clients APIs
from .clients import (
    get_all_clients,
    get_client_details,
    create_client,
    update_client,
    delete_client,
    search_customers,
    quick_create_customer,
    get_client_groups,
    get_client_contacts
)

# Projects APIs
from .projects import (
    get_project_form_data,
    create_project,
    get_project_details,
    update_project,
    delete_project,
    get_projects_by_partition
)

# Engagement APIs
from .engagement import (
    get_engagement_info,
    upload_engagement_file,
    delete_engagement_file,
    get_review_notes,
    add_review_note,
    get_bulk_review_counts
)

# Columns APIs
from .columns import (
    get_partition_column_config,
    save_partition_column_config,
    save_partition_column_width,
    save_user_column_widths,
    load_user_column_widths,
    get_all_task_columns,
    get_subtask_column_config,
    save_subtask_column_config
)

# Combination View APIs
from .combination import (
    get_available_boards_for_combination,
    save_combination_view,
    get_saved_combinations,
    load_combination_view,
    delete_combination_view,
    get_combination_view_data
)

# Data Loading APIs
from .data import (
    load_partition_data,
    get_data_count,
    get_paginated_data,
    get_companies_for_tftg,
    get_field_options
)

__all__ = [
    # Dashboard
    'get_main_dashboard_data', 'get_workspace_overview_data', 'get_workspace_title',
    # Tasks
    'update_task_status', 'update_task_field', 'update_task_client', 'create_subtask',
    'get_subtasks', 'get_task_status_options', 'archive_task', 'unarchive_task',
    # Partitions
    'create_partition', 'archive_partition', 'get_child_partitions', 'get_available_workspaces',
    'get_all_partitions', 'update_partition_columns', 'get_partition_config', 'get_default_subtask_column_config',
    # Roles
    'get_task_roles', 'update_task_roles', 'add_role_assignment', 'remove_role_assignment',
    'set_primary_role', 'get_user_display_info', 'get_bulk_roles_info', 'get_primary_role_user', 'get_role_users_info',
    # Comments
    'get_task_comments', 'add_task_comment', 'delete_task_comment', 'update_task_comment', 'sync_comment_counts',
    # Software
    'get_software_options', 'get_task_softwares', 'set_task_softwares', 'get_primary_software', 'get_software_info',
    # Clients
    'get_all_clients', 'get_client_details', 'create_client', 'update_client', 'delete_client',
    'search_customers', 'quick_create_customer', 'get_client_groups', 'get_client_contacts',
    # Projects
    'get_project_form_data', 'create_project', 'get_project_details', 'update_project',
    'delete_project', 'get_projects_by_partition',
    # Engagement
    'get_engagement_info', 'upload_engagement_file', 'delete_engagement_file',
    'get_review_notes', 'add_review_note', 'get_bulk_review_counts',
    # Columns
    'get_partition_column_config', 'save_partition_column_config', 'save_partition_column_width',
    'save_user_column_widths', 'load_user_column_widths', 'get_all_task_columns',
    'get_subtask_column_config', 'save_subtask_column_config',
    # Combination
    'get_available_boards_for_combination', 'save_combination_view', 'get_saved_combinations',
    'load_combination_view', 'delete_combination_view', 'get_combination_view_data',
    # Data
    'load_partition_data', 'get_data_count', 'get_paginated_data', 'get_companies_for_tftg', 'get_field_options'
]
