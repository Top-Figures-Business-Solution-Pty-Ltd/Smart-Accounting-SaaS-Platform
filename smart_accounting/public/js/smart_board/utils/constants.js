/**
 * Smart Board - Constants
 * 全局常量配置
 */

// Project Types（Sidebar 会从系统实时读取 Project Type 列表）
// 这里仅保留“显示层”的 icon 映射与空态建议，不再写死具体有哪些业务类型
export const PROJECT_TYPE_ICONS = {
    'ITR': '📋',
    'BAS': '📋',
    'Payroll': '📋',
    'Bookkeeping': '📋',
    'R&D Grant': '📋',
    'Grants': '📋',
    'SMSF': '📋',
    'Audit': '📋',
    'Financial Statements': '📋'
};

export const DEFAULT_PROJECT_TYPE_ICON = '📋';

// Status 配置（这些可以从后端动态获取）
export const STATUS_OPTIONS = {
    'ITR': [
        'Not Started',
        'Working',
        'Ready for Review',
        'Under Review',
        'Lodged',
        'Completed',
        'Cancelled'
    ],
    'BAS': [
        'Not Started',
        'Working',
        'Ready for Review',
        'Query from ATO',
        'Resubmit',
        'Lodged',
        'Completed',
        'Cancelled'
    ],
    'Bookkeeping': [
        'Not Started',
        'Working',
        'Completed',
        'Cancelled'
    ],
    'R&D Grant': [
        'Not Started',
        'Working',
        'Partner Review',
        'Under Review',
        'Query from AusIndustry',
        'Resubmit',
        'Approved',
        'Completed',
        'Cancelled'
    ],
    'DEFAULT': [
        'Not Started',
        'Working',
        'Ready for Review',
        'Under Review',
        'Completed',
        'Cancelled'
    ]
};

// Status 颜色映射
export const STATUS_COLORS = {
    'Not Started': '#6c757d',
    'Working': '#007bff',
    'Ready for Review': '#ffc107',
    'Under Review': '#17a2b8',
    'Partner Review': '#17a2b8',
    'Query from ATO': '#fd7e14',
    'Query from AusIndustry': '#fd7e14',
    'Resubmit': '#dc3545',
    'Lodged': '#28a745',
    'Approved': '#28a745',
    'Completed': '#28a745',
    'Cancelled': '#6c757d'
};

// Frequency 选项
export const FREQUENCY_OPTIONS = [
    'One-off',
    'Monthly',
    'Quarterly',
    'Yearly'
];

// Role 选项
export const ROLE_OPTIONS = [
    'Preparer',
    'Reviewer',
    'Partner'
];

// Project 字段列目录（用于 Columns Manager 的“可选列池”）
// - 不依赖具体 project_type，方便未来租户自定义 Project Type
// - 仅包含“Project 可能用到”的核心字段（来自 docs/A + docs/E + 现有 ProjectService）
export const PROJECT_COLUMN_CATALOG = [
    // Core identifiers
    { field: 'project_name', label: 'Project Name', width: 260 },
    { field: 'customer', label: 'Client Name', width: 200, frozen: true },
    { field: 'custom_entity_type', label: 'Entity', width: 160 },

    // Classification / workflow
    { field: 'project_type', label: 'Project Type', width: 150 },
    { field: 'company', label: 'Company', width: 120 },
    { field: 'status', label: 'Status', width: 150 },
    { field: 'priority', label: 'Priority', width: 120 },

    // Team & tools
    { field: 'custom_softwares', label: 'Software', width: 160 },

    // Dates / planning
    { field: 'expected_start_date', label: 'Start Date', width: 130 },
    { field: 'expected_end_date', label: 'End Date', width: 130 },
    { field: 'custom_lodgement_due_date', label: 'Lodgement Due', width: 140 },

    // Periodicity / accounting specifics (docs confirmed)
    { field: 'custom_project_frequency', label: 'Frequency', width: 120 },
    { field: 'custom_target_month', label: 'Target Month', width: 130 },
    { field: 'custom_fiscal_year', label: 'Fiscal Year', width: 120 },

    // Money / notes / archive
    { field: 'estimated_costing', label: 'Budget', width: 120 },
    { field: 'notes', label: 'Notes', width: 260 },
    // "Active" is primarily a filter dimension; hide it from Columns Manager by default.
    // Keep it here for backward compatibility with Saved Views that may already reference it.
    { field: 'is_active', label: 'Active', width: 90, hidden: true },
    { field: 'percent_complete', label: '% Complete', width: 110 },

    // Meta
    { field: 'modified', label: 'Last Updated', width: 150 },
    { field: 'auto_repeat', label: 'Auto Repeat', width: 140 },
    { field: 'name', label: 'ID', width: 180 }
];

// 默认列配置（按 project_type）
export const DEFAULT_COLUMNS = {
    'ITR': [
        { field: 'customer', label: 'Client Name', width: 200, frozen: true },
        { field: 'custom_entity_type', label: 'Entity', width: 150 },
        { field: 'company', label: 'TF/TG', width: 80 },
        { field: 'custom_softwares', label: 'Software', width: 120 },
        { field: 'status', label: 'Status', width: 150 },
        { field: 'custom_lodgement_due_date', label: 'Due Date', width: 120 },
        { field: 'notes', label: 'Notes', width: 250 }
    ],
    'BAS': [
        { field: 'customer', label: 'Client Name', width: 200, frozen: true },
        { field: 'custom_entity_type', label: 'Entity', width: 150 },
        { field: 'company', label: 'TF/TG', width: 80 },
        { field: 'custom_softwares', label: 'Software', width: 120 },
        { field: 'status', label: 'Status', width: 150 },
        { field: 'custom_project_frequency', label: 'Frequency', width: 100 },
        { field: 'custom_target_month', label: 'Target Month', width: 120 },
        { field: 'custom_lodgement_due_date', label: 'Due Date', width: 120 },
        { field: 'notes', label: 'Notes', width: 250 }
    ],
    'Payroll': [
        { field: 'customer', label: 'Client Name', width: 200, frozen: true },
        { field: 'company', label: 'TF/TG', width: 80 },
        { field: 'custom_softwares', label: 'Software', width: 120 },
        { field: 'status', label: 'Status', width: 150 },
        { field: 'custom_project_frequency', label: 'Frequency', width: 100 },
        { field: 'expected_end_date', label: 'Process Date', width: 120 },
        { field: 'notes', label: 'Notes', width: 250 }
    ],
    'Bookkeeping': [
        { field: 'customer', label: 'Client Name', width: 200, frozen: true },
        { field: 'company', label: 'TF/TG', width: 80 },
        { field: 'custom_softwares', label: 'Software', width: 120 },
        { field: 'status', label: 'Status', width: 150 },
        { field: 'custom_project_frequency', label: 'Frequency', width: 100 },
        { field: 'notes', label: 'Notes', width: 250 }
    ],
    'DEFAULT': [
        { field: 'customer', label: 'Client Name', width: 200, frozen: true },
        { field: 'project_name', label: 'Project Name', width: 250 },
        { field: 'status', label: 'Status', width: 150 },
        { field: 'expected_end_date', label: 'Due Date', width: 120 },
        { field: 'notes', label: 'Notes', width: 250 }
    ]
};

// API 端点
export const API_ENDPOINTS = {
    PROJECTS: '/api/resource/Project',
    SAVED_VIEWS: '/api/resource/Saved View',
    USERS: '/api/resource/User',
    CUSTOMERS: '/api/resource/Customer'
};

// 本地存储键名
export const STORAGE_KEYS = {
    COLUMN_WIDTHS: 'smart_board_column_widths',
    LAST_VIEW: 'smart_board_last_view',
    USER_PREFERENCES: 'smart_board_user_preferences'
};

// 分页配置
export const PAGINATION = {
    DEFAULT_PAGE_SIZE: 50,
    PAGE_SIZE_OPTIONS: [20, 50, 100, 200]
};

