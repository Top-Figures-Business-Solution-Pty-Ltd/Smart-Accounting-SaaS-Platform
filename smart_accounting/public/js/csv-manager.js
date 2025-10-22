// Smart Accounting - CSV Export/Import Manager
// Modular CSV export/import functionality integrated with ERPNext built-in features

/**
 * Field Processor - Handles different field types with specialized processing
 */
class FieldProcessor {
    constructor() {
        // Cache for link field names to avoid repeated API calls
        this.linkFieldCache = {};
    }

    /**
     * Main field processing entry point
     */
    async processField(fieldName, value, fieldTypeInfo) {
        const processorMethod = fieldTypeInfo.config.processor;
        
        if (this[processorMethod]) {
            return await this[processorMethod](fieldName, value, fieldTypeInfo.config);
        } else {
            console.warn(`Processor ${processorMethod} not found, using default text processing`);
            return this.processTextField(fieldName, value);
        }
    }

    /**
     * Process Table Multi fields (softwares, roles, communication_methods)
     */
    async processTableMultiField(fieldName, value, config) {
        if (!value) return '';
        
        // Check if this is a role field that needs special parsing
        const roleFields = ['action_person', 'action-person', 'preparer', 'reviewer', 'partner'];
        if (roleFields.includes(fieldName) && typeof value === 'string' && value.includes(' | ')) {
            return this.parseFormattedRoleString(fieldName, value);
        }
        
        // Handle different input formats
        let items = [];
        
        if (typeof value === 'string') {
            try {
                // Try to parse as JSON first
                items = JSON.parse(value);
            } catch (e) {
                // Otherwise treat as comma-separated string
                return value;
            }
        } else if (Array.isArray(value)) {
            items = value;
        } else if (typeof value === 'object') {
            // Single object, convert to array
            items = [value];
        }

        if (!Array.isArray(items) || items.length === 0) {
            return '';
        }

        // Get display field for this specific field type
        const displayField = config.displayFields && config.displayFields[fieldName] || 'name';
        
        // Extract display values
        const displayValues = items.map(item => {
            if (typeof item === 'string') {
                return item;
            } else if (typeof item === 'object') {
                return item[displayField] || item.name || item.title || String(item);
            }
            return String(item);
        }).filter(val => val && val.trim());

        return displayValues.join(', ');
    }

    /**
     * Parse formatted role string from ERPNext
     * Format: "jean@topfigures.com.au | Action Person; zigengwang464@gmail.com | Preparer; ..."
     */
    parseFormattedRoleString(fieldName, value) {
        if (!value || typeof value !== 'string') return '';
        
        // 先尝试按分号分割
        let entries = value.split(';').map(entry => entry.trim()).filter(entry => entry);
        
        // 如果没有分号，尝试其他分隔符
        if (entries.length <= 1) {
            // 尝试按其他可能的分隔符分割
            if (value.includes('; ')) {
                entries = value.split('; ').map(entry => entry.trim()).filter(entry => entry);
            } else if (value.includes(',')) {
                entries = value.split(',').map(entry => entry.trim()).filter(entry => entry);
            } else {
                entries = [value];
            }
        }
        
        // 角色映射 - 支持多种字段名格式
        const roleMap = {
            'action_person': 'Action Person',
            'action-person': 'Action Person',  // 支持连字符格式
            'preparer': 'Preparer', 
            'reviewer': 'Reviewer',
            'partner': 'Partner'
        };
        
        const targetRole = roleMap[fieldName];
        if (!targetRole) {
            return entries.map(entry => {
                const parts = entry.split(' | ');
                return parts[0] || entry;
            }).join(', ');
        }
        
        // 查找匹配的条目
        const matchingEntries = [];
        
        for (const entry of entries) {
            const parts = entry.split(' | ');
            if (parts.length >= 2) {
                const email = parts[0].trim();
                const role = parts[1].trim();
                
                if (role === targetRole) {
                    matchingEntries.push(email);
                }
            }
        }
        
        // 如果没有找到匹配的，可能数据格式不同，尝试其他方法
        if (matchingEntries.length === 0) {
            // 可能所有条目都标记为同一个角色，我们需要根据位置来分配
            // 这是一个备用方案
            const allEmails = entries.map(entry => {
                const parts = entry.split(' | ');
                return parts[0].trim();
            }).filter(email => email);
            
            // 根据字段名返回对应位置的邮箱
            const fieldIndex = {
                'action_person': 0,
                'preparer': 1,
                'reviewer': 2,
                'partner': 3
            };
            
            const index = fieldIndex[fieldName];
            if (index !== undefined && allEmails[index]) {
                return allEmails[index];
            }
        }
        
        return matchingEntries.join(', ');
    }

    /**
     * Process Date fields
     */
    processDateField(fieldName, value) {
        if (!value) return '';
        
        try {
            // Handle different date formats
            if (typeof value === 'string') {
                // Try to format using Frappe's date formatting if available
                if (window.frappe && frappe.datetime && frappe.datetime.str_to_user) {
                    return frappe.datetime.str_to_user(value);
                }
                
                // Fallback: basic date formatting
                const date = new Date(value);
                if (!isNaN(date.getTime())) {
                    return date.toLocaleDateString();
                }
            }
            
            return String(value);
        } catch (e) {
            console.warn(`Error processing date field ${fieldName}:`, e);
            return String(value || '');
        }
    }

    /**
     * Process Currency fields
     */
    processCurrencyField(fieldName, value) {
        if (!value && value !== 0) return '';
        
        try {
            // If value contains HTML tags, extract the numeric value
            if (typeof value === 'string' && value.includes('<')) {
                // Extract text content from HTML
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = value;
                const textContent = tempDiv.textContent || tempDiv.innerText || '';
                
                // Extract numeric value from text (remove currency symbols, commas, etc.)
                const numericMatch = textContent.match(/[\d,.-]+/);
                if (numericMatch) {
                    const cleanValue = numericMatch[0].replace(/,/g, '');
                    const numValue = parseFloat(cleanValue);
                    if (!isNaN(numValue)) {
                        return numValue.toString();
                    }
                }
                return textContent.trim();
            }
            
            // Handle numeric values
            const numValue = parseFloat(value);
            if (!isNaN(numValue)) {
                return numValue.toString();
            }
            
            return String(value);
        } catch (e) {
            console.warn(`Error processing currency field ${fieldName}:`, e);
            return String(value || '');
        }
    }

    /**
     * Process Select fields (status, priority)
     */
    processSelectField(fieldName, value) {
        if (!value) return '';
        
        // Apply any field-specific transformations
        const selectTransforms = {
            'status': {
                'Open': 'Open',
                'Working': 'In Progress', 
                'Pending Review': 'Pending Review',
                'Overdue': 'Overdue',
                'Completed': 'Completed',
                'Cancelled': 'Cancelled'
            },
            'priority': {
                'Low': 'Low',
                'Medium': 'Medium', 
                'High': 'High',
                'Urgent': 'Urgent'
            }
        };
        
        const transforms = selectTransforms[fieldName];
        if (transforms && transforms[value]) {
            return transforms[value];
        }
        
        return String(value);
    }

    /**
     * Process Link fields (user references, project references)
     */
    async processLinkField(fieldName, value) {
        if (!value) return '';
        
        // Check cache first
        const cacheKey = `${fieldName}_${value}`;
        if (this.linkFieldCache[cacheKey]) {
            return this.linkFieldCache[cacheKey];
        }
        
        try {
            // For user fields, try to get full name
            if (['assigned_to', 'action_person', 'preparer', 'reviewer', 'partner'].includes(fieldName)) {
                const displayName = await this.getUserDisplayName(value);
                this.linkFieldCache[cacheKey] = displayName;
                return displayName;
            }
            
            // For other link fields, return the value as-is for now
            // In the future, we could add more specific link resolution
            this.linkFieldCache[cacheKey] = String(value);
            return String(value);
            
        } catch (e) {
            console.warn(`Error processing link field ${fieldName}:`, e);
            const fallback = String(value);
            this.linkFieldCache[cacheKey] = fallback;
            return fallback;
        }
    }

    /**
     * Get user display name from user ID
     */
    async getUserDisplayName(userId) {
        if (!userId) return '';
        
        try {
            // Try to get from global user data if available
            if (window.frappe && frappe.boot && frappe.boot.user_info && frappe.boot.user_info[userId]) {
                const userInfo = frappe.boot.user_info[userId];
                return userInfo.fullname || userInfo.name || userId;
            }
            
            // Fallback: return the user ID
            return userId;
        } catch (e) {
            return userId;
        }
    }

    /**
     * Process Text fields (default processing)
     */
    processTextField(fieldName, value) {
        if (!value && value !== 0) return '';
        return String(value).trim();
    }
}

class CSVManager {
    constructor() {
        this.currentView = null;
        this.currentBoardData = null;
        this.availableFields = {};
        this.selectedFields = [];
        this.displayTypeManager = window.displayTypeManager;
        this.currentDisplayType = 'Task-Centric';
        this.selectedFile = null;
        this.csvContent = null; // Store parsed CSV content for import
        
        // Initialize field type system and processors
        this.initializeFieldTypeSystem();
        this.fieldProcessor = new FieldProcessor();
        
        // Initialize current view information
        this.initializeCurrentView();
        
        // 完全禁用display type监听，避免循环
        // this.displayTypeUpdateTimeout = null;
    }

    /**
     * Initialize field type system for dynamic processing
     */
    initializeFieldTypeSystem() {
        // Define field types and their processing strategies
        this.FIELD_TYPES = {
            // 关联表字段 - 需要展开为逗号分隔的字符串
            TABLE_MULTI: {
                fields: ['softwares', 'communication_methods', 'roles'],
                processor: 'processTableMultiField',
                displayFields: {
                    'softwares': 'software_name',
                    'communication_methods': 'method_name',
                    'roles': 'role_name'
                }
            },
            
            // 日期字段 - 需要格式化
            DATE: {
                fields: ['target_month', 'exp_start_date', 'exp_end_date', 'creation', 'modified'],
                processor: 'processDateField'
            },
            
            // 货币字段 - 需要格式化
            CURRENCY: {
                fields: ['budget', 'actual'],
                processor: 'processCurrencyField'
            },
            
            // 选择字段 - 需要本地化
            SELECT: {
                fields: ['status', 'priority'],
                processor: 'processSelectField'
            },
            
            // 人员角色字段 - 需要从复合字符串中提取特定角色
            ROLE_FIELD: {
                fields: ['action_person', 'action-person', 'preparer', 'reviewer', 'partner'],
                processor: 'processTableMultiField'
            },
            
            // 链接字段 - 需要显示名称而非ID
            LINK: {
                fields: ['assigned_to', 'project', 'client'],
                processor: 'processLinkField'
            },
            
            // 普通文本字段 - 直接使用
            TEXT: {
                fields: ['subject', 'description', 'note', 'entity', 'tf_tg', 'service_line'],
                processor: 'processTextField'
            }
        };

        // Create field type lookup map for quick access
        this.fieldTypeMap = {};
        Object.entries(this.FIELD_TYPES).forEach(([typeName, typeConfig]) => {
            typeConfig.fields.forEach(fieldName => {
                this.fieldTypeMap[fieldName] = {
                    type: typeName,
                    config: typeConfig
                };
            });
        });

        // Load custom field configurations for SaaS extensibility (disabled for now)
        // this.loadCustomFieldConfigurations();
    }

    /**
     * Load custom field configurations for SaaS extensibility
     */
    async loadCustomFieldConfigurations() {
        try {
            // Try to load custom field configurations from server
            // This allows different tenants to have different field types
            const customConfig = await this.getCustomFieldConfig();
            
            if (customConfig && customConfig.length > 0) {
                this.applyCustomFieldConfig(customConfig);
            }
        } catch (e) {
            console.log('No custom field configuration found, using defaults');
        }
    }

    /**
     * Get custom field configuration from server
     */
    async getCustomFieldConfig() {
        return new Promise((resolve) => {
            frappe.call({
                method: 'smart_accounting.api.field_config.get_custom_field_types',
                args: {
                    board_view: this.currentView
                },
                callback: (response) => {
                    if (response.message && response.message.success) {
                        resolve(response.message.field_config);
                    } else {
                        resolve([]);
                    }
                },
                error: () => resolve([])
            });
        });
    }

    /**
     * Apply custom field configuration
     */
    applyCustomFieldConfig(customConfig) {
        customConfig.forEach(config => {
            // Add custom field type
            if (!this.FIELD_TYPES[config.type]) {
                this.FIELD_TYPES[config.type] = {
                    fields: [],
                    processor: config.processor || 'processTextField'
                };
            }

            // Add field to type mapping
            this.fieldTypeMap[config.field_name] = {
                type: config.type,
                config: {
                    ...this.FIELD_TYPES[config.type],
                    ...config.config
                }
            };

            // Add to field type list
            if (!this.FIELD_TYPES[config.type].fields.includes(config.field_name)) {
                this.FIELD_TYPES[config.type].fields.push(config.field_name);
            }
        });

        console.log('Applied custom field configuration:', customConfig.length, 'fields');
    }

    /**
     * Register new field type dynamically (for future SaaS features)
     */
    registerFieldType(typeName, config) {
        this.FIELD_TYPES[typeName] = config;
        
        // Update field type map
        config.fields.forEach(fieldName => {
            this.fieldTypeMap[fieldName] = {
                type: typeName,
                config: config
            };
        });

        console.log(`Registered new field type: ${typeName}`);
    }

    /**
     * Add custom field processor (for future SaaS features)
     */
    addCustomFieldProcessor(processorName, processorFunction) {
        if (this.fieldProcessor) {
            this.fieldProcessor[processorName] = processorFunction;
            console.log(`Added custom field processor: ${processorName}`);
        }
    }

    /**
     * Initialize current view information
     */
    initializeCurrentView() {
        // Get current view from URL or global variables
        const urlParams = new URLSearchParams(window.location.search);
        this.currentView = urlParams.get('view') || 'main';
        
        // Load current board field configuration
        this.loadCurrentBoardFields();
    }

    /**
     * Load available fields for current board
     */
    loadCurrentBoardFields() {
        try {
            if (window.ColumnConfigManager && typeof window.ColumnConfigManager.getAllColumns === 'function') {
            // Get all available fields
                const allColumns = window.ColumnConfigManager.getAllColumns();
                if (allColumns && typeof allColumns === 'object') {
                    this.availableFields = allColumns;
            
            // Get current board's visible fields as default selection
                    if (typeof window.ColumnConfigManager.getDefaultVisibleColumns === 'function') {
                        const visibleColumns = window.ColumnConfigManager.getDefaultVisibleColumns();
                        if (Array.isArray(visibleColumns)) {
                            this.selectedFields = visibleColumns;
        } else {
                            this.selectedFields = Object.keys(this.availableFields).slice(0, 10);
                        }
                    } else {
                        this.selectedFields = Object.keys(this.availableFields).slice(0, 10);
                    }
                } else {
                    throw new Error('Invalid columns data from ColumnConfigManager');
                }
            } else {
                throw new Error('ColumnConfigManager not available or invalid');
            }
        } catch (error) {
            console.warn('CSV Manager: Error loading board fields, using fallback:', error.message);
            this.availableFields = this.getFallbackFields();
            this.selectedFields = Object.keys(this.availableFields).slice(0, 10);
        }
    }

    /**
     * Get fallback field definitions (when ColumnConfigManager is not available)
     */
    getFallbackFields() {
        return {
            'client': 'Client Name',
            'task-name': 'Task Name',
            'project': 'Project Name',
            'entity': 'Entity',
            'tf-tg': 'TF/TG',
            'software': 'Software',
            'status': 'Status',
            'note': 'Note',
            'target-month': 'Target Month',
            'budget': 'Budget',
            'actual': 'Actual'
        };
    }

    /**
     * Show CSV export dialog
     */
    showExportDialog() {
        // Check board type and route accordingly
        const boardType = this.getBoardType();
        
        if (boardType === 'task-centric') {
            // Current flow: show project selection dialog
        this.showProjectSelectionDialog('export');
        } else {
            // Future: other centric views (placeholder for now)
            this.showOtherCentricExportDialog(boardType);
        }
    }

    /**
     * Show CSV import dialog
     */
    showImportDialog() {
        // Check board type and route accordingly
        const boardType = this.getBoardType();
        
        if (boardType === 'task-centric') {
            // Current flow: show project selection dialog
        this.showProjectSelectionDialog('import');
        } else {
            // Future: other centric views (placeholder for now)
            this.showOtherCentricImportDialog(boardType);
        }
    }

    /**
     * Get current board type (task-centric, client-centric, contact-centric)
     */
    getBoardType() {
        // TODO: Implement logic to detect board type from current board data
        // For now, default to task-centric to maintain current functionality
        // In the future, this should check the board's centric type from the database
        
        // Placeholder logic - you can replace this with actual board type detection
        if (this.currentBoardData && this.currentBoardData.board_type) {
            return this.currentBoardData.board_type;
        }
        
        // Default to task-centric for backward compatibility
        return 'task-centric';
    }

    /**
     * Show export dialog for non-task-centric boards (placeholder)
     */
    showOtherCentricExportDialog(boardType) {
        frappe.show_alert({
            message: `Export functionality for ${boardType} boards is coming soon!`,
            indicator: 'blue'
        });
        
        // TODO: Implement specific export flows for:
        // - client-centric boards
        // - contact-centric boards
        // - other future centric types
    }

    /**
     * Show import dialog for non-task-centric boards (placeholder)
     */
    showOtherCentricImportDialog(boardType) {
        frappe.show_alert({
            message: `Import functionality for ${boardType} boards is coming soon!`,
            indicator: 'blue'
        });
        
        // TODO: Implement specific import flows for:
        // - client-centric boards
        // - contact-centric boards
        // - other future centric types
    }

    /**
     * Show project selection dialog
     */
    showProjectSelectionDialog(mode) {
        // Load projects for current board
        this.loadBoardProjects().then(projects => {
            if (projects.length === 0) {
                frappe.show_alert({
                    message: 'No projects found in this board',
                    indicator: 'orange'
                });
                return;
            }

            const dialog = this.createProjectSelectionDialog(projects, mode);
            $('body').append(dialog);
            this.bindProjectSelectionEvents(mode);
            $('#csv-project-selection-dialog').fadeIn(300);
        }).catch(error => {
            console.error('Error loading projects:', error);
            frappe.show_alert({
                message: 'Failed to load projects',
                indicator: 'red'
            });
        });
    }

    /**
     * Load projects for current board
     */
    loadBoardProjects() {
        return new Promise((resolve, reject) => {
            frappe.call({
                method: 'smart_accounting.api.csv_export.get_board_projects',
                args: {
                    board_view: this.currentView
                },
                callback: (response) => {
                    if (response.message && response.message.success) {
                        resolve(response.message.projects);
                    } else {
                        reject(response.message?.error || 'Failed to load projects');
                    }
                },
                error: (error) => {
                    reject(error);
                }
            });
        });
    }

    /**
     * Create project selection dialog HTML
     */
    createProjectSelectionDialog(projects, mode) {
        const actionText = mode === 'export' ? 'Export' : 'Import';
        const actionIcon = mode === 'export' ? 'fa-download' : 'fa-upload';
        
        const projectsHtml = projects.map(project => `
            <div class="csv-project-item" data-project-id="${project.id}">
                <div class="csv-project-checkbox">
                    <input type="checkbox" id="project-${project.id}" value="${project.id}">
                    <label for="project-${project.id}"></label>
                </div>
                <div class="csv-project-info">
                    <div class="csv-project-name">${project.name}</div>
                    <div class="csv-project-details">
                        <span class="csv-project-client">${project.client}</span>
                        <span class="csv-project-task-count">${project.task_count} tasks</span>
                    </div>
                </div>
            </div>
        `).join('');

        return $(`
            <div class="csv-dialog-overlay" id="csv-project-selection-dialog" style="display: none;">
                <div class="csv-dialog">
                    <div class="csv-dialog-header">
                        <h3><i class="fa ${actionIcon}"></i> Select Projects to ${actionText}</h3>
                        <button class="csv-dialog-close" title="Close">
                            <i class="fa fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="csv-dialog-content">
                        <div class="csv-project-selection-info">
                            <div class="csv-info-item">
                                <i class="fa fa-table"></i>
                                <span>Current Board: <strong>${this.getCurrentBoardName()}</strong></span>
                            </div>
                            <div class="csv-info-item">
                                <i class="fa fa-folder"></i>
                                <span>Available Projects: <strong>${projects.length}</strong></span>
                            </div>
                        </div>
                        
                        <div class="csv-project-selection">
                            <div class="csv-selection-header">
                                <h4>Select Projects</h4>
                                <div class="csv-selection-actions">
                                    <button class="pm-btn pm-btn-link csv-select-all-projects">Select All</button>
                                    <button class="pm-btn pm-btn-link csv-select-none-projects">Select None</button>
                                </div>
                            </div>
                            
                            <div class="csv-projects-container">
                                ${projectsHtml}
                            </div>
                        </div>
                        
                        <div class="csv-project-summary">
                            <div class="csv-summary-item">
                                <span>Selected Projects: <strong id="selected-project-count">0</strong></span>
                            </div>
                            <div class="csv-summary-item">
                                <span>Total Tasks: <strong id="selected-task-count">0</strong></span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="csv-dialog-footer">
                        <button class="pm-btn pm-btn-secondary csv-cancel">Cancel</button>
                        <button class="pm-btn pm-btn-primary csv-project-continue" disabled>
                            <i class="fa fa-arrow-right"></i>
                            Continue
                        </button>
                    </div>
                </div>
            </div>
        `);
    }

    /**
     * Bind project selection dialog events
     */
    bindProjectSelectionEvents(mode) {
        const $dialog = $('#csv-project-selection-dialog');
        
        // Close dialog
        $dialog.on('click', '.csv-dialog-close, .csv-cancel', () => {
            this.closeDialog('csv-project-selection-dialog');
        });
        
        // Click overlay to close
        $dialog.on('click', (e) => {
            if (e.target === $dialog[0]) {
                this.closeDialog('csv-project-selection-dialog');
            }
        });
        
        // Select all projects
        $dialog.on('click', '.csv-select-all-projects', () => {
            $dialog.find('.csv-project-item input[type="checkbox"]').prop('checked', true);
            this.updateProjectSelectionSummary();
        });
        
        // Select no projects
        $dialog.on('click', '.csv-select-none-projects', () => {
            $dialog.find('.csv-project-item input[type="checkbox"]').prop('checked', false);
            this.updateProjectSelectionSummary();
        });
        
        // Project checkbox change
        $dialog.on('change', '.csv-project-item input[type="checkbox"]', () => {
            this.updateProjectSelectionSummary();
        });
        
        // Continue button
        $dialog.on('click', '.csv-project-continue', () => {
            const selectedProjects = [];
            $dialog.find('.csv-project-item input[type="checkbox"]:checked').each(function() {
                selectedProjects.push($(this).val());
            });
            
            if (selectedProjects.length === 0) {
                frappe.show_alert({
                    message: 'Please select at least one project',
                    indicator: 'orange'
                });
                return;
            }
            
            // Store selected projects and proceed to field selection
            this.selectedProjects = selectedProjects;
            this.closeDialog('csv-project-selection-dialog');
            
            if (mode === 'export') {
                this.showExportFieldDialog();
            } else {
                this.showImportFieldDialog();
            }
        });
    }

    /**
     * Update project selection summary
     */
    updateProjectSelectionSummary() {
        const $dialog = $('#csv-project-selection-dialog');
        const selectedCount = $dialog.find('.csv-project-item input[type="checkbox"]:checked').length;
        let totalTasks = 0;
        
        $dialog.find('.csv-project-item input[type="checkbox"]:checked').each(function() {
            const $projectItem = $(this).closest('.csv-project-item');
            const taskCountText = $projectItem.find('.csv-project-task-count').text();
            const taskCount = parseInt(taskCountText.match(/\d+/)?.[0] || '0');
            totalTasks += taskCount;
        });
        
        $('#selected-project-count').text(selectedCount);
        $('#selected-task-count').text(totalTasks);
        
        // Enable/disable continue button
        $('.csv-project-continue').prop('disabled', selectedCount === 0);
    }

    /**
     * Show export field selection dialog (after project selection)
     */
    showExportFieldDialog() {
        const dialog = this.createExportDialog();
        $('body').append(dialog);
        
        // Update dialog title to show selected projects
        const projectCount = this.selectedProjects.length;
        $('#csv-export-dialog .csv-dialog-header h3').html(
            `<i class="fa fa-download"></i> Export Data from ${projectCount} Project${projectCount > 1 ? 's' : ''}`
        );
        
        // Bind events
        this.bindExportDialogEvents();
        
        // Show dialog
        $('#csv-export-dialog').fadeIn(300);
    }

    /**
     * Show import field selection dialog (after project selection)
     */
    showImportFieldDialog() {
        const dialog = this.createImportDialog();
        $('body').append(dialog);
        
        // Update dialog title to show selected projects
        const projectCount = this.selectedProjects.length;
        $('#csv-import-dialog .csv-dialog-header h3').html(
            `<i class="fa fa-upload"></i> Import Data to ${projectCount} Project${projectCount > 1 ? 's' : ''}`
        );
        
        // Bind events
        this.bindImportDialogEvents();
        
        // Show dialog
        $('#csv-import-dialog').fadeIn(300);
    }

    /**
     * Create export dialog HTML
     */
    createExportDialog() {
        const availableFieldsHtml = Object.entries(this.availableFields)
            .map(([key, label]) => `
                <div class="csv-field-item" data-field="${key}">
                    <div class="csv-field-checkbox">
                        <input type="checkbox" id="export-field-${key}" ${this.selectedFields.includes(key) ? 'checked' : ''}>
                        <label for="export-field-${key}"></label>
                    </div>
                    <div class="csv-field-info">
                        <span class="csv-field-label">${label}</span>
                        <small class="csv-field-key">${key}</small>
                    </div>
                </div>
            `).join('');

        return $(`
            <div class="csv-dialog-overlay" id="csv-export-dialog" style="display: none;">
                <div class="csv-dialog">
                    <div class="csv-dialog-header">
                        <h3><i class="fa fa-download"></i> Export Data to CSV</h3>
                        <button class="csv-dialog-close" title="Close">
                            <i class="fa fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="csv-dialog-content">
                        <div class="csv-export-info">
                            <div class="csv-info-item">
                                <i class="fa fa-table"></i>
                                <span>Current Board: <strong>${this.getCurrentBoardName()}</strong></span>
                            </div>
                            <div class="csv-info-item">
                                <i class="fa fa-list"></i>
                                <span>Available Fields: <strong>${Object.keys(this.availableFields).length}</strong></span>
                            </div>
                        </div>
                        
                        <div class="csv-field-selection">
                            <div class="csv-selection-header">
                                <h4>Select Fields to Export</h4>
                                <div class="csv-selection-actions">
                                    <button class="pm-btn pm-btn-link csv-select-all">Select All</button>
                                    <button class="pm-btn pm-btn-link csv-select-none">Select None</button>
                                    <button class="pm-btn pm-btn-link csv-select-visible">Visible Only</button>
                                </div>
                            </div>
                            
                            <div class="csv-fields-container">
                                ${availableFieldsHtml}
                            </div>
                        </div>
                        
                        <div class="csv-export-options">
                            <h4>Export Options</h4>
                            <div class="csv-option-group">
                                <label class="csv-option">
                                    <input type="checkbox" id="csv-include-headers" checked>
                                    <span>Include column headers</span>
                                </label>
                                <label class="csv-option">
                                    <input type="checkbox" id="csv-export-all-data" checked>
                                    <span>Export all data (uncheck to export only current filtered results)</span>
                                </label>
                            </div>
                        </div>
                    </div>
                    
                    <div class="csv-dialog-footer">
                        <button class="pm-btn pm-btn-secondary csv-cancel">Cancel</button>
                        <button class="pm-btn pm-btn-primary csv-export-confirm">
                            <i class="fa fa-download"></i>
                            Export CSV
                        </button>
                    </div>
                </div>
            </div>
        `);
    }

    /**
     * Create import dialog HTML
     */
    createImportDialog() {
        return $(`
            <div class="csv-dialog-overlay" id="csv-import-dialog" style="display: none;">
                <div class="csv-dialog">
                    <div class="csv-dialog-header">
                        <h3><i class="fa fa-upload"></i> Import Data from CSV</h3>
                        <button class="csv-dialog-close" title="Close">
                            <i class="fa fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="csv-dialog-content">
                        <div class="csv-import-info">
                            <div class="csv-info-item">
                                <i class="fa fa-table"></i>
                                <span>Target Board: <strong>${this.getCurrentBoardName()}</strong></span>
                            </div>
                            <div class="csv-info-item">
                                <i class="fa fa-info-circle"></i>
                                <span>Supported Fields: <strong>${Object.keys(this.availableFields).length}</strong></span>
                            </div>
                        </div>
                        
                        <div class="csv-template-section">
                            <h4>Download Template</h4>
                            <div class="csv-template-info">
                                <p>Download a template with the correct field structure for importing data:</p>
                                <button class="pm-btn pm-btn-primary csv-download-template">
                                    <i class="fa fa-download"></i>
                                    Download Import Template
                                </button>
                            </div>
                        </div>
                        
                        <div class="csv-upload-section">
                            <h4>Select CSV File</h4>
                            <div class="csv-upload-area" id="csv-upload-area">
                                <div class="csv-upload-content">
                                    <i class="fa fa-cloud-upload"></i>
                                    <p>Click to select file or drag CSV file here</p>
                                    <small>Supports .csv format, max 5MB</small>
                                </div>
                                <input type="file" id="csv-file-input" accept=".csv" style="display: none;">
                            </div>
                            <div class="csv-file-info" id="csv-file-info" style="display: none;">
                                <div class="csv-file-details">
                                    <i class="fa fa-file-text"></i>
                                    <span class="csv-file-name"></span>
                                    <span class="csv-file-size"></span>
                                </div>
                                <button class="pm-btn pm-btn-link csv-remove-file">
                                    <i class="fa fa-times"></i>
                                </button>
                            </div>
                        </div>
                        
                        <div class="csv-import-options">
                            <h4>Import Options</h4>
                            <div class="csv-option-group">
                                <label class="csv-option">
                                    <input type="radio" name="csv-import-mode" value="insert" checked>
                                    <span>Insert new records</span>
                                </label>
                                <label class="csv-option">
                                    <input type="radio" name="csv-import-mode" value="update">
                                    <span>Update existing records</span>
                                </label>
                            </div>
                            <div class="csv-option-group">
                                <label class="csv-option">
                                    <input type="checkbox" id="csv-skip-errors" checked>
                                    <span>Skip error rows and continue import</span>
                                </label>
                            </div>
                        </div>
                        
                        <div class="csv-preview-section" id="csv-preview-section" style="display: none;">
                            <h4>Data Preview</h4>
                            <div class="csv-preview-container">
                                <table class="csv-preview-table" id="csv-preview-table">
                                    <!-- Preview data will be displayed here -->
                                </table>
                            </div>
                        </div>
                    </div>
                    
                    <div class="csv-dialog-footer">
                        <button class="pm-btn pm-btn-secondary csv-cancel">Cancel</button>
                        <button class="pm-btn pm-btn-primary csv-import-confirm" disabled>
                            <i class="fa fa-upload"></i>
                            Import Data
                        </button>
                    </div>
                </div>
            </div>
        `);
    }

    /**
     * Bind export dialog events
     */
    bindExportDialogEvents() {
        const $dialog = $('#csv-export-dialog');
        
        // Close dialog
        $dialog.on('click', '.csv-dialog-close, .csv-cancel', () => {
            this.closeDialog('csv-export-dialog');
        });
        
        // Click overlay to close
        $dialog.on('click', (e) => {
            if (e.target === $dialog[0]) {
                this.closeDialog('csv-export-dialog');
            }
        });
        
        // Field selection actions
        $dialog.on('click', '.csv-select-all', () => {
            $dialog.find('.csv-field-item input[type="checkbox"]').prop('checked', true);
        });
        
        $dialog.on('click', '.csv-select-none', () => {
            $dialog.find('.csv-field-item input[type="checkbox"]').prop('checked', false);
        });
        
        $dialog.on('click', '.csv-select-visible', () => {
            $dialog.find('.csv-field-item input[type="checkbox"]').prop('checked', false);
            this.selectedFields.forEach(field => {
                $dialog.find(`#export-field-${field}`).prop('checked', true);
            });
        });
        
        // Confirm export
        $dialog.on('click', '.csv-export-confirm', () => {
            this.performExport();
        });
    }

    /**
     * Bind import dialog events
     */
    bindImportDialogEvents() {
        const $dialog = $('#csv-import-dialog');
        
        // 先清除所有可能的重复事件
        $dialog.off('click change');
        
        // Close dialog
        $dialog.on('click', '.csv-dialog-close, .csv-cancel', () => {
            this.closeDialog('csv-import-dialog');
        });
        
        // Click overlay to close
        $dialog.on('click', (e) => {
            if (e.target === $dialog[0]) {
                this.closeDialog('csv-import-dialog');
            }
        });
        
        // Download template button
        $dialog.on('click', '.csv-download-template', () => {
            this.showTemplateFieldSelectionDialog();
        });
        
        // File upload area click - 使用一次性事件绑定
        const self = this;
        $dialog.on('click', '#csv-upload-area', function(e) {
            console.log('Upload area clicked - triggering file dialog');
            e.preventDefault();
            e.stopPropagation();
            
            // 直接创建并触发文件输入
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.csv';
            fileInput.style.display = 'none';
            fileInput.id = 'dynamic-csv-file-input'; // 给动态输入一个ID
            
            fileInput.onchange = function(event) {
                if (event.target.files && event.target.files[0]) {
                    // 保存文件到实例变量
                    self.selectedFile = event.target.files[0];
                    self.handleFileSelection(event.target.files[0]);
                }
            };
            
            document.body.appendChild(fileInput);
            fileInput.click();
            document.body.removeChild(fileInput);
        });
        
        // Remove file
        $dialog.on('click', '.csv-remove-file', () => {
            this.removeSelectedFile();
        });
        
        // Confirm import
        $dialog.on('click', '.csv-import-confirm', () => {
            this.performImport();
        });
    }

    /**
     * Get current board name
     */
    getCurrentBoardName() {
        if (this.currentView === 'main') {
            return 'Main Dashboard';
        }
        // Get board name from page title or other sources
        const titleElement = $('.pm-breadcrumb-current');
        if (titleElement.length > 0) {
            return titleElement.text().trim();
        }
        return `Board (${this.currentView})`;
    }

    /**
     * Close dialog
     */
    closeDialog(dialogId) {
        $(`#${dialogId}`).fadeOut(300, function() {
            $(this).remove();
        });
    }

    /**
     * Handle file selection
     */
    handleFileSelection(file) {
        if (!file) {
            console.warn('No file provided to handleFileSelection');
            return;
        }
        
        // Clear any previous error states
        $('#csv-upload-area').removeClass('csv-error');
        
        // Validate file type
        if (!file.name.toLowerCase().endsWith('.csv')) {
            $('#csv-upload-area').addClass('csv-error');
            frappe.show_alert({
                message: 'Please select a CSV format file (.csv)',
                indicator: 'red'
            });
            this.resetFileInput();
            return;
        }
        
        // Validate file size (5MB)
        if (file.size > 5 * 1024 * 1024) {
            $('#csv-upload-area').addClass('csv-error');
            frappe.show_alert({
                message: 'File size cannot exceed 5MB',
                indicator: 'red'
            });
            this.resetFileInput();
            return;
        }
        
        // Validate file is not empty
        if (file.size === 0) {
            $('#csv-upload-area').addClass('csv-error');
            frappe.show_alert({
                message: 'Selected file is empty',
                indicator: 'red'
            });
            this.resetFileInput();
            return;
        }
        
        try {
        // Display file information
        this.displayFileInfo(file);
        
        // Preview file content
        this.previewCSVFile(file);
            
            frappe.show_alert({
                message: 'File loaded successfully',
                indicator: 'green'
            });
        } catch (error) {
            console.error('Error handling file selection:', error);
            $('#csv-upload-area').addClass('csv-error');
            frappe.show_alert({
                message: 'Error processing file: ' + error.message,
                indicator: 'red'
            });
            this.resetFileInput();
        }
    }
    
    /**
     * Reset file input
     */
    resetFileInput() {
        $('#csv-file-input').val('');
        $('#csv-upload-area').removeClass('csv-drag-over csv-error');
    }

    /**
     * Display file information
     */
    displayFileInfo(file) {
        const $fileInfo = $('#csv-file-info');
        const $fileName = $fileInfo.find('.csv-file-name');
        const $fileSize = $fileInfo.find('.csv-file-size');
        
        $fileName.text(file.name);
        $fileSize.text(this.formatFileSize(file.size));
        
        $('#csv-upload-area').hide();
        $fileInfo.show();
        
        // Enable import button
        $('.csv-import-confirm').prop('disabled', false);
    }

    /**
     * Remove selected file
     */
    removeSelectedFile() {
        // 清除保存的文件和内容
        this.selectedFile = null;
        this.csvContent = null;
        $('#csv-file-info').hide();
        $('#csv-upload-area').show();
        $('#csv-preview-section').hide();
        $('.csv-import-confirm').prop('disabled', true);
    }

    /**
     * Preview CSV file content
     */
    previewCSVFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                // Store the full CSV content for import
                this.csvContent = e.target.result;
                
                // Parse and display preview
                const csvData = this.parseCSV(e.target.result);
                this.displayCSVPreview(csvData);
            } catch (error) {
                console.error('CSV parsing error:', error);
                frappe.show_alert({
                    message: 'CSV file format error, please check file content',
                    indicator: 'red'
                });
            }
        };
        reader.readAsText(file);
    }

    /**
     * Parse CSV content safely
     */
    parseCSV(csvText) {
        try {
            if (!csvText || typeof csvText !== 'string') {
                console.warn('Invalid CSV text provided');
                return [];
            }
            
        const lines = csvText.split('\n');
        const result = [];
            const maxLines = Math.min(lines.length, 6); // Only preview first 5 rows of data
            
            for (let i = 0; i < maxLines; i++) {
                const line = lines[i];
                if (line && line.trim()) {
                    try {
                        // Simple CSV parsing, handle comma separation with safety checks
                        const row = line.split(',').map(cell => {
                            if (typeof cell === 'string') {
                                return cell.trim().replace(/^"|"$/g, '');
                            }
                            return String(cell || '');
                        });
                        
                        // Only add non-empty rows
                        if (row.some(cell => cell && cell.trim())) {
                result.push(row);
                        }
                    } catch (cellError) {
                        console.warn('Error parsing CSV line:', i, cellError);
                        // Skip problematic lines
                        continue;
                    }
            }
        }
        
        return result;
            
        } catch (error) {
            console.error('Error parsing CSV content:', error);
            return [];
        }
    }

    /**
     * Display CSV preview
     */
    displayCSVPreview(csvData) {
        if (csvData.length === 0) return;
        
        const $previewTable = $('#csv-preview-table');
        let tableHtml = '';
        
        csvData.forEach((row, index) => {
            const rowClass = index === 0 ? 'csv-header-row' : 'csv-data-row';
            const cellTag = index === 0 ? 'th' : 'td';
            
            tableHtml += `<tr class="${rowClass}">`;
            row.forEach(cell => {
                tableHtml += `<${cellTag}>${cell || ''}</${cellTag}>`;
            });
            tableHtml += '</tr>';
        });
        
        $previewTable.html(tableHtml);
        $('#csv-preview-section').show();
    }

    /**
     * Format file size
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Perform export operation
     */
    performExport() {
        // Get selected fields
        const selectedFields = [];
        $('#csv-export-dialog .csv-field-item input[type="checkbox"]:checked').each(function() {
            selectedFields.push($(this).closest('.csv-field-item').data('field'));
        });
        
        if (selectedFields.length === 0) {
            frappe.show_alert({
                message: 'Please select at least one field to export',
                indicator: 'orange'
            });
            return;
        }
        
        // Get export options
        const includeHeaders = $('#csv-include-headers').is(':checked');
        const exportAllData = $('#csv-export-all-data').is(':checked');
        
        // Show loading state
        $('.csv-export-confirm').prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i> Exporting...');
        
        // Call backend export API
        this.callExportAPI(selectedFields, includeHeaders, exportAllData);
    }

    /**
     * Perform import operation
     */
    performImport() {
        // 使用保存的文件而不是DOM元素
        if (!this.selectedFile) {
            frappe.show_alert({
                message: 'Please select a CSV file to import',
                indicator: 'orange'
            });
            return;
        }
        
        const importMode = $('input[name="csv-import-mode"]:checked').val();
        const skipErrors = $('#csv-skip-errors').is(':checked');
        
        // Show loading state
        $('.csv-import-confirm').prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i> Importing...');
        
        // Call backend import API
        this.callImportAPI(this.selectedFile, importMode, skipErrors);
    }


    /**
     * Call export API - Hybrid approach: Built-in API + Custom field processing
     */
    callExportAPI(selectedFields, includeHeaders, exportAllData) {
        // Use hybrid export strategy
        this.hybridExportData(selectedFields, includeHeaders, exportAllData);
    }

    /**
     * Hybrid export: Combine built-in API with custom field processing
     */
    async hybridExportData(selectedFields, includeHeaders, exportAllData) {
        try {
            // Step 1: Try to get data from built-in API first
            let rawData = await this.getDataFromBuiltinAPI(selectedFields, exportAllData);
            
            // Step 2: If built-in API fails or returns no data, fallback to UI extraction
            if (!rawData || rawData.length === 0) {
                console.log('Built-in API returned no data, falling back to UI extraction');
                rawData = this.getCurrentUIData(exportAllData);
            }
            
            if (!rawData || rawData.length === 0) {
                frappe.show_alert({
                    message: 'No data available to export',
                    indicator: 'orange'
                });
                $('.csv-export-confirm').prop('disabled', false).html('<i class="fa fa-download"></i> Export CSV');
                return;
            }

            // Step 3: Process special fields using our field type system
            const processedData = await this.processSpecialFields(rawData, selectedFields);
            
            // Step 4: Apply user-friendly field mapping
            const finalData = this.applyFieldMapping(processedData, selectedFields);

            // Step 5: Generate and download CSV
            const csvContent = this.generateCSVFromProcessedData(finalData, selectedFields, includeHeaders);
            const filename = this.generateExportFilename();
            this.downloadCSVContent(csvContent, filename);
            
            // Close dialog and show success message
            this.closeDialog('csv-export-dialog');
            frappe.show_alert({
                message: `Data exported successfully (${finalData.length} records)`,
                indicator: 'green'
            });
            
        } catch (error) {
            console.error('Hybrid export error:', error);
            frappe.show_alert({
                message: 'Error occurred during export: ' + error.message,
                indicator: 'red'
            });
        } finally {
            $('.csv-export-confirm').prop('disabled', false).html('<i class="fa fa-download"></i> Export CSV');
        }
    }

    /**
     * Get data from ERPNext built-in export API
     */
    async getDataFromBuiltinAPI(selectedFields, exportAllData) {
        return new Promise((resolve) => {
        frappe.call({
            method: 'smart_accounting.api.csv_export.export_board_data',
            args: {
                board_view: this.currentView,
                selected_fields: selectedFields,
                    include_headers: false, // We'll handle headers ourselves
                export_all_data: exportAllData,
                    selected_projects: this.selectedProjects || [],
                    return_data: true // Request raw data instead of file
            },
            callback: (response) => {
                    if (response.message && response.message.success && response.message.data) {
                        console.log('Successfully got data from built-in API');
                        resolve(response.message.data);
                } else {
                        console.log('Built-in API failed or returned no data');
                        resolve([]);
                }
            },
            error: (error) => {
                    console.log('Built-in API error, will fallback to UI extraction:', error);
                    resolve([]);
                }
            });
        });
    }

    /**
     * Process special fields using field type system
     */
    async processSpecialFields(rawData, selectedFields) {
        const processedData = [];
        
        for (const row of rawData) {
            const processedRow = {};
            
            // Process each field based on its type
            for (const fieldName of selectedFields) {
                const value = row[fieldName];
                const fieldTypeInfo = this.fieldTypeMap[fieldName];
                
                if (fieldTypeInfo) {
                    // Use specialized processor for this field type
                    processedRow[fieldName] = await this.fieldProcessor.processField(
                        fieldName, value, fieldTypeInfo
                    );
                } else {
                    // Default processing for unknown fields
                    processedRow[fieldName] = this.fieldProcessor.processTextField(fieldName, value);
                }
            }
            
            processedData.push(processedRow);
        }
        
        return processedData;
    }

    /**
     * Apply user-friendly field mapping
     */
    applyFieldMapping(data, selectedFields) {
        return data.map(row => {
            const mappedRow = {};
            
            selectedFields.forEach(fieldName => {
                const displayName = this.getFieldDisplayName(fieldName);
                mappedRow[displayName] = row[fieldName] || '';
            });
            
            return mappedRow;
        });
    }

    /**
     * Generate CSV from processed data
     */
    generateCSVFromProcessedData(data, selectedFields, includeHeaders) {
        let csvContent = '';
        
        // Add headers if requested
        if (includeHeaders) {
            const headers = selectedFields.map(field => this.getFieldDisplayName(field));
            csvContent += headers.join(',') + '\n';
        }
        
        // Add data rows
        data.forEach(row => {
            const values = Object.values(row).map(value => this.escapeCSVValue(value));
            csvContent += values.join(',') + '\n';
        });
        
        return csvContent;
    }

    /**
     * Call import API
     */
    callImportAPI(file, importMode, skipErrors) {
        // Use the CSV content that was already read during preview
        if (!this.csvContent) {
            frappe.show_alert({
                message: 'CSV content not available. Please select file again.',
                indicator: 'red'
            });
            $('.csv-import-confirm').prop('disabled', false).html('<i class="fa fa-upload"></i> Import Data');
            return;
        }
        
        // Use frappe.call to send CSV content as text (no file upload needed!)
        frappe.call({
            method: 'smart_accounting.api.csv_import.import_board_data_from_content',
            args: {
                csv_content: this.csvContent,
                filename: file.name,
                board_view: this.currentView,
                import_mode: importMode,
                skip_errors: skipErrors,
                selected_projects: this.selectedProjects || []
            },
            callback: (response) => {
                $('.csv-import-confirm').prop('disabled', false).html('<i class="fa fa-upload"></i> Import Data');
                
                if (response.message && response.message.success) {
                    this.closeDialog('csv-import-dialog');
                    this.showImportResults(response.message);
                    
                    // Refresh page data
                    setTimeout(() => {
                        if (window.location.reload) {
                            window.location.reload();
                        }
                    }, 2000);
                } else {
                    frappe.show_alert({
                        message: response.message?.error || 'Import failed, please try again',
                        indicator: 'red'
                    });
                }
            },
            error: (error) => {
                $('.csv-import-confirm').prop('disabled', false).html('<i class="fa fa-upload"></i> Import Data');
                console.error('Import error:', error);
                frappe.show_alert({
                    message: 'Error occurred during import: ' + (error.message || 'Unknown error'),
                    indicator: 'red'
                });
            }
        });
    }

    /**
     * Get current UI data (what user sees in the interface)
     */
    getCurrentUIData(exportAllData) {
        // Try multiple data sources in order of preference
        let data = [];
        
        if (exportAllData) {
            // Export all data from selected projects
            // Try global data sources first
            data = this.getDataFromGlobalSources();
            if (data.length > 0) {
                return data;
            }
        }
        
        // Try to extract from DOM table
        data = this.extractDataFromDOMTable();
        if (data.length > 0) {
            return data;
        }
        
        // Last resort: try other data sources
        data = this.getDataFromAlternativeSources();
        return data;
    }

    /**
     * Get data from global JavaScript variables or window objects
     */
    getDataFromGlobalSources() {
        // Try various global data sources
        const dataSources = [
            'window.currentTableData',
            'window.boardData',
            'window.taskData',
            'window.projectData',
            'this.currentBoardData'
        ];
        
        for (const source of dataSources) {
            try {
                let data = null;
                if (source === 'this.currentBoardData') {
                    data = this.currentBoardData;
                } else {
                    data = eval(source);
                }
                
                if (data && Array.isArray(data) && data.length > 0) {
                    console.log(`Found data from: ${source}`);
                    return data;
                }
            } catch (e) {
                // Ignore errors and try next source
            }
        }
        
        return [];
    }

    /**
     * Get data from alternative sources (API calls, etc.)
     */
    getDataFromAlternativeSources() {
        // If we can't find data in DOM or global variables,
        // we could make an API call here, but for now return empty
        console.warn('No data found from any source');
        return [];
    }

    /**
     * Extract data from DOM table (what user currently sees)
     */
    extractDataFromDOMTable() {
        const tableData = [];
        
        // Try multiple selectors to find the main data table
        let $table = null;
        const tableSelectors = [
            '.pm-table',
            '.task-table', 
            '.board-table',
            'table.table',
            '.table-responsive table',
            '.datatable table',
            '#task-table',
            '.project-management-table',
            'table',
            '.table'
        ];
        
        for (const selector of tableSelectors) {
            $table = $(selector).first();
            if ($table.length > 0) {
                console.log(`Found table using selector: ${selector}`);
                break;
            }
        }
        
        if (!$table || $table.length === 0) {
            console.warn('No data table found in DOM. Available tables:', $('table').length);
            
            // Debug: log all available tables and their info
            $('table').each((i, table) => {
                const $t = $(table);
                console.log(`Table ${i}:`, {
                    classes: table.className,
                    id: table.id,
                    rows: $t.find('tr').length,
                    headers: $t.find('th').length,
                    bodyRows: $t.find('tbody tr').length
                });
            });
            
            // Fallback: try to find any table with data
            $table = $('table').filter((i, el) => {
                const $el = $(el);
                return $el.find('tbody tr').length > 0 || $el.find('tr').length > 1;
            }).first();
            
            if ($table.length === 0) {
                console.error('Still no table found. Trying to find any table...');
                $table = $('table').first();
                if ($table.length === 0) {
                    console.error('No tables exist on the page at all!');
                    return [];
                }
            }
        }

        // Extract data from table rows
        $table.find('tbody tr').each((index, row) => {
            const $row = $(row);
            const rowData = {};
            
            // Extract data from each cell based on column headers
            $row.find('td').each((cellIndex, cell) => {
                const $cell = $(cell);
                const columnName = this.getColumnNameFromIndex(cellIndex);
                
                if (columnName) {
                    // Get the actual displayed text/content
                    rowData[columnName] = this.extractCellContent($cell);
                }
            });
            
            if (Object.keys(rowData).length > 0) {
                tableData.push(rowData);
            }
        });
        
        return tableData;
    }

    /**
     * Get column name from table header by index
     */
    getColumnNameFromIndex(cellIndex) {
        // Use the same table finding logic as extractDataFromDOMTable
        let $table = null;
        const tableSelectors = [
            '.pm-table',
            '.task-table', 
            '.board-table',
            'table.table',
            '.table-responsive table',
            '.datatable table',
            '#task-table',
            '.project-management-table',
            'table',
            '.table'
        ];
        
        for (const selector of tableSelectors) {
            $table = $(selector).first();
            if ($table.length > 0) {
                break;
            }
        }
        
        if (!$table || $table.length === 0) {
            // Fallback: find any table with headers
            $table = $('table').filter((i, el) => {
                const $el = $(el);
                return $el.find('thead th, th').length > 0;
            }).first();
        }
        
        if ($table && $table.length > 0) {
            // Try different header selectors
            let $headerCell = $table.find('thead th').eq(cellIndex);
            if ($headerCell.length === 0) {
                $headerCell = $table.find('th').eq(cellIndex);
            }
            if ($headerCell.length === 0) {
                $headerCell = $table.find('tr:first td').eq(cellIndex);
            }
            
            if ($headerCell.length > 0) {
                // Map header text to field names
                const headerText = $headerCell.text().trim();
                return this.mapHeaderToFieldName(headerText);
            }
        }
        
        return `column_${cellIndex}`;
    }

    /**
     * Map table header text to field names
     */
    mapHeaderToFieldName(headerText) {
        const headerMap = {
            'Task Name': 'subject',
            'Description': 'description',
            'Status': 'status',
            'Priority': 'priority',
            'Assigned To': 'assigned_to',
            'Project': 'project',
            'Software': 'softwares',
            'Communication Methods': 'communication_methods',
            'Roles': 'roles',
            'Client': 'client',
            'Service Line': 'service_line',
            'TF/TG': 'tf_tg',
            'Action Person': 'action_person',
            'ACTION PERSON': 'action_person',  // 大写版本
            'Preparer': 'preparer',
            'Reviewer': 'reviewer',
            'Partner': 'partner',
            'Note': 'note',
            'Target Month': 'target_month',
            'Budget': 'budget',
            'Actual': 'actual'
        };
        
        return headerMap[headerText] || headerText.toLowerCase().replace(/\s+/g, '_');
    }

    /**
     * Extract content from table cell (handles different content types)
     */
    extractCellContent($cell) {
        // Handle different types of cell content
        
        // Check for multiple items (like software, roles, etc.)
        const $items = $cell.find('.item, .tag, .badge');
        if ($items.length > 0) {
            const items = [];
            $items.each((i, item) => {
                const text = $(item).text().trim();
                if (text) items.push(text);
            });
            return items.join(', ');
        }
        
        // Check for links
        const $link = $cell.find('a');
        if ($link.length > 0) {
            return $link.text().trim();
        }
        
        // Default: get text content
        return $cell.text().trim();
    }

    /**
     * Generate CSV content from UI data
     */
    generateCSVFromUIData(data, selectedFields, includeHeaders) {
        let csvContent = '';
        
        // Add headers if requested
        if (includeHeaders) {
            const headers = selectedFields.map(field => {
                return this.getFieldDisplayName(field);
            });
            csvContent += headers.join(',') + '\n';
        }
        
        // Add data rows
        data.forEach(row => {
            const values = selectedFields.map(field => {
                const value = row[field] || '';
                // Escape CSV values (handle commas, quotes, newlines)
                return this.escapeCSVValue(value);
            });
            csvContent += values.join(',') + '\n';
        });
        
        return csvContent;
    }

    /**
     * Get display name for field
     */
    getFieldDisplayName(fieldName) {
        const displayNames = {
            'subject': 'Task Name',
            'description': 'Description',
            'status': 'Status',
            'priority': 'Priority',
            'assigned_to': 'Assigned To',
            'project': 'Project',
            'softwares': 'Software',
            'communication_methods': 'Communication Methods',
            'roles': 'Roles',
            'client': 'Client',
            'service_line': 'Service Line',
            'tf_tg': 'TF/TG',
            'action_person': 'Action Person',
            'action-person': 'Action Person',  // 支持连字符格式
            'preparer': 'Preparer',
            'reviewer': 'Reviewer',
            'partner': 'Partner',
            'note': 'Note',
            'target_month': 'Target Month',
            'budget': 'Budget',
            'actual': 'Actual'
        };
        
        return displayNames[fieldName] || fieldName;
    }

    /**
     * Escape CSV value (handle special characters)
     */
    escapeCSVValue(value) {
        if (typeof value !== 'string') {
            value = String(value || '');
        }
        
        // If value contains comma, quote, or newline, wrap in quotes and escape quotes
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            value = '"' + value.replace(/"/g, '""') + '"';
        }
        
        return value;
    }

    /**
     * Generate export filename
     */
    generateExportFilename() {
        const boardName = this.getCurrentBoardName().replace(/[^a-zA-Z0-9]/g, '_');
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
        return `${boardName}_Export_${timestamp}.csv`;
    }

    /**
     * Download CSV content as file
     */
    downloadCSVContent(csvContent, filename) {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }
    }

    /**
     * Download CSV file (legacy method, kept for compatibility)
     */
    downloadCSVFile(fileUrl, filename) {
        const link = document.createElement('a');
        link.href = fileUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * Show template field selection dialog
     */
    showTemplateFieldSelectionDialog() {
        const dialog = this.createTemplateFieldSelectionDialog();
        $('body').append(dialog);
        this.bindTemplateFieldSelectionEvents();
        $('#csv-template-field-dialog').fadeIn(300);
    }

    /**
     * Create template field selection dialog
     */
    createTemplateFieldSelectionDialog() {
        const availableFieldsHtml = Object.entries(this.availableFields)
            .map(([key, label]) => `
                <div class="csv-field-item" data-field="${key}">
                    <div class="csv-field-checkbox">
                        <input type="checkbox" id="template-field-${key}" ${this.selectedFields.includes(key) ? 'checked' : ''}>
                        <label for="template-field-${key}"></label>
                    </div>
                    <div class="csv-field-info">
                        <span class="csv-field-label">${label}</span>
                        <small class="csv-field-key">${key}</small>
                    </div>
                </div>
            `).join('');

        return $(`
            <div class="csv-dialog-overlay" id="csv-template-field-dialog" style="display: none;">
                <div class="csv-dialog">
                    <div class="csv-dialog-header">
                        <h3><i class="fa fa-download"></i> Select Fields for Template</h3>
                        <button class="csv-dialog-close" title="Close">
                            <i class="fa fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="csv-dialog-content">
                        <div class="csv-template-field-info">
                            <div class="csv-info-item">
                                <i class="fa fa-info-circle"></i>
                                <span>Select the fields you want to include in the import template</span>
                            </div>
                            <div class="csv-info-item">
                                <i class="fa fa-table"></i>
                                <span>Board: <strong>${this.getCurrentBoardName()}</strong></span>
                            </div>
                        </div>
                        
                        <div class="csv-field-selection">
                            <div class="csv-selection-header">
                                <h4>Available Fields</h4>
                                <div class="csv-selection-actions">
                                    <button class="pm-btn pm-btn-link csv-template-select-all">Select All</button>
                                    <button class="pm-btn pm-btn-link csv-template-select-none">Select None</button>
                                    <button class="pm-btn pm-btn-link csv-template-select-visible">Current Visible</button>
                                    <button class="pm-btn pm-btn-link csv-template-select-essential">Essential Only</button>
                                </div>
                            </div>
                            
                            <div class="csv-fields-container">
                                ${availableFieldsHtml}
                            </div>
                        </div>
                        
                        <div class="csv-template-options">
                            <h4>Template Options</h4>
                            <div class="csv-option-group">
                                <label class="csv-option">
                                    <input type="checkbox" id="csv-template-include-examples" checked>
                                    <span>Include example data row</span>
                                </label>
                                <label class="csv-option">
                                    <input type="checkbox" id="csv-template-include-descriptions">
                                    <span>Include field descriptions in header comments</span>
                                </label>
                            </div>
                        </div>
                        
                        <div class="csv-template-preview">
                            <h4>Selected Fields Preview</h4>
                            <div class="csv-selected-fields-preview" id="csv-selected-fields-preview">
                                <em>Select fields to see preview</em>
                            </div>
                        </div>
                    </div>
                    
                    <div class="csv-dialog-footer">
                        <button class="pm-btn pm-btn-secondary csv-cancel">Cancel</button>
                        <button class="pm-btn pm-btn-primary csv-generate-template" disabled>
                            <i class="fa fa-download"></i>
                            Generate Template
                        </button>
                    </div>
                </div>
            </div>
        `);
    }

    /**
     * Bind template field selection events
     */
    bindTemplateFieldSelectionEvents() {
        const $dialog = $('#csv-template-field-dialog');
        
        // Close dialog
        $dialog.on('click', '.csv-dialog-close, .csv-cancel', () => {
            this.closeDialog('csv-template-field-dialog');
        });
        
        // Click overlay to close
        $dialog.on('click', (e) => {
            if (e.target === $dialog[0]) {
                this.closeDialog('csv-template-field-dialog');
            }
        });
        
        // Field selection actions
        $dialog.on('click', '.csv-template-select-all', () => {
            $dialog.find('.csv-field-item input[type="checkbox"]').prop('checked', true);
            this.updateTemplateFieldPreview();
        });
        
        $dialog.on('click', '.csv-template-select-none', () => {
            $dialog.find('.csv-field-item input[type="checkbox"]').prop('checked', false);
            this.updateTemplateFieldPreview();
        });
        
        $dialog.on('click', '.csv-template-select-visible', () => {
            $dialog.find('.csv-field-item input[type="checkbox"]').prop('checked', false);
            this.selectedFields.forEach(field => {
                $dialog.find(`#template-field-${field}`).prop('checked', true);
            });
            this.updateTemplateFieldPreview();
        });
        
        $dialog.on('click', '.csv-template-select-essential', () => {
            $dialog.find('.csv-field-item input[type="checkbox"]').prop('checked', false);
            // Select essential fields
            const essentialFields = ['client', 'task-name', 'status', 'target-month'];
            essentialFields.forEach(field => {
                $dialog.find(`#template-field-${field}`).prop('checked', true);
            });
            this.updateTemplateFieldPreview();
        });
        
        // Field checkbox change
        $dialog.on('change', '.csv-field-item input[type="checkbox"]', () => {
            this.updateTemplateFieldPreview();
        });
        
        // Generate template button
        $dialog.on('click', '.csv-generate-template', () => {
            this.generateCustomTemplate();
        });
        
        // Initial preview update
        this.updateTemplateFieldPreview();
    }

    /**
     * Update template field preview
     */
    updateTemplateFieldPreview() {
        const $dialog = $('#csv-template-field-dialog');
        const selectedFields = [];
        const selectedLabels = [];
        
        $dialog.find('.csv-field-item input[type="checkbox"]:checked').each((index, checkbox) => {
            const $item = $(checkbox).closest('.csv-field-item');
            const field = $item.data('field');
            const label = $item.find('.csv-field-label').text();
            
            selectedFields.push(field);
            selectedLabels.push(label);
        });
        
        // Update preview
        const $preview = $('#csv-selected-fields-preview');
        if (selectedFields.length === 0) {
            $preview.html('<em>No fields selected</em>');
            $('.csv-generate-template').prop('disabled', true);
        } else {
            const previewHtml = `
                <div class="csv-preview-summary">
                    <strong>${selectedFields.length} fields selected:</strong>
                </div>
                <div class="csv-preview-fields">
                    ${selectedLabels.map(label => `<span class="csv-preview-field-tag">${label}</span>`).join('')}
                </div>
            `;
            $preview.html(previewHtml);
            $('.csv-generate-template').prop('disabled', false);
        }
        
        // Store selected fields for template generation
        this.templateSelectedFields = selectedFields;
    }

    /**
     * Generate custom template with selected fields
     */
    generateCustomTemplate() {
        if (!this.templateSelectedFields || this.templateSelectedFields.length === 0) {
            frappe.show_alert({
                message: 'Please select at least one field for the template',
                indicator: 'orange'
            });
            return;
        }
        
        const includeExamples = $('#csv-template-include-examples').is(':checked');
        const includeDescriptions = $('#csv-template-include-descriptions').is(':checked');
        
        // Show loading state
        $('.csv-generate-template').prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i> Generating...');
        
        this.downloadImportTemplate(this.templateSelectedFields, includeExamples, includeDescriptions);
    }

    /**
     * Download import template
     */
    downloadImportTemplate(selectedFields = null, includeExamples = true, includeDescriptions = false) {
        // Show loading state
        $('.csv-download-template').prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i> Generating...');
        
        frappe.call({
            method: 'smart_accounting.api.csv_import.get_import_template',
            args: {
                board_view: this.currentView,
                selected_fields: selectedFields,
                include_examples: includeExamples,
                include_descriptions: includeDescriptions
            },
            callback: (response) => {
                if (response.message && response.message.success) {
                    // Create and download the template file
                    const blob = new Blob([response.message.csv_content], { type: 'text/csv;charset=utf-8;' });
                    const link = document.createElement('a');
                    const url = URL.createObjectURL(blob);
                    
                    link.setAttribute('href', url);
                    link.setAttribute('download', response.message.filename);
                    link.style.visibility = 'hidden';
                    
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    
                    frappe.show_alert({
                        message: 'Template downloaded successfully',
                        indicator: 'green'
                    });
                    
                    // Close template field selection dialog if open
                    this.closeDialog('csv-template-field-dialog');
                } else {
                    frappe.show_alert({
                        message: response.message?.error || 'Failed to generate template',
                        indicator: 'red'
                    });
                }
            },
            error: (error) => {
                console.error('Template download error:', error);
                frappe.show_alert({
                    message: 'Error occurred while downloading template',
                    indicator: 'red'
                });
            },
            always: () => {
                $('.csv-download-template').prop('disabled', false).html('<i class="fa fa-download"></i> Download Import Template');
            }
        });
    }

    /**
     * Show import results
     */
    showImportResults(results) {
        const message = `
            <div class="csv-import-results">
                <h4><i class="fa fa-check-circle text-success"></i> Import Completed</h4>
                <ul>
                    <li>Successfully imported: <strong>${results.success_count || 0}</strong> records</li>
                    ${results.error_count ? `<li>Failed: <strong>${results.error_count}</strong> records</li>` : ''}
                    ${results.updated_count ? `<li>Updated: <strong>${results.updated_count}</strong> records</li>` : ''}
                </ul>
                ${results.errors && results.errors.length > 0 ? `
                    <div class="csv-import-errors">
                        <h5>Error Details:</h5>
                        <ul>
                            ${results.errors.slice(0, 5).map(error => `<li>${error}</li>`).join('')}
                            ${results.errors.length > 5 ? `<li>... and ${results.errors.length - 5} more errors</li>` : ''}
                        </ul>
                    </div>
                ` : ''}
            </div>
        `;
        
        frappe.msgprint({
            title: 'Import Results',
            message: message,
            indicator: 'green'
        });
    }

    // 移除所有display type相关方法，避免循环

    /**
     * Get export data based on current display type
     */
    getExportDataForDisplayType() {
        // This method should be called by the export functionality
        // to get data in the format appropriate for the current display type
        
        switch (this.currentDisplayType) {
            case 'Contact-Centric':
                return this.getContactCentricExportData();
            case 'Client-Centric':
                return this.getClientCentricExportData();
            default: // Task-Centric
                return this.getTaskCentricExportData();
        }
    }

    getContactCentricExportData() {
        // Extract contact data from current page
        const contacts = [];
        try {
            const $projectGroups = $('.pm-project-group');
            if ($projectGroups.length === 0) {
                console.warn('No project groups found for contact export');
                return contacts;
            }

            $projectGroups.each(function(groupIndex) {
                if (groupIndex > 100) { // Safety limit
                    console.warn('Too many project groups, limiting to 100');
                    return false;
                }
                
                const $group = $(this);
                const companyName = $group.find('.pm-group-header h3').first().text().trim() || 'Unknown Company';
                
                const $taskRows = $group.find('.pm-task-row');
                $taskRows.each(function(rowIndex) {
                    if (rowIndex > 500) { // Safety limit
                        console.warn('Too many task rows, limiting to 500 per group');
                        return false;
                    }
                    
                    const $row = $(this);
                    const contactData = {
                        company_name: companyName,
                        contact_name: $row.find('[data-column="contact-name"]').first().text().trim() || '',
                        email_id: $row.find('[data-column="email"]').first().text().trim() || '',
                        phone: $row.find('[data-column="phone"]').first().text().trim() || '',
                        status: $row.find('[data-column="status"]').first().text().trim() || '',
                        custom_last_contact_date: $row.find('[data-column="last-contact"]').first().text().trim() || '',
                        custom_contact_notes: $row.find('[data-column="notes"]').first().text().trim() || ''
                    };
                    contacts.push(contactData);
                });
            });
        } catch (error) {
            console.error('Error extracting contact data:', error);
        }
        return contacts;
    }

    getClientCentricExportData() {
        // Extract client data from current page
        const clients = [];
        try {
            const $projectGroups = $('.pm-project-group');
            if ($projectGroups.length === 0) {
                console.warn('No project groups found for client export');
                return clients;
            }

            $projectGroups.each(function(groupIndex) {
                if (groupIndex > 100) { // Safety limit
                    console.warn('Too many project groups, limiting to 100');
                    return false;
                }
                
                const $group = $(this);
                const groupName = $group.find('.pm-group-header h3').first().text().trim() || 'Unknown Group';
                
                const $taskRows = $group.find('.pm-task-row');
                $taskRows.each(function(rowIndex) {
                    if (rowIndex > 500) { // Safety limit
                        console.warn('Too many task rows, limiting to 500 per group');
                        return false;
                    }
                    
                    const $row = $(this);
                    const clientData = {
                        customer_group: groupName,
                        customer_name: $row.find('[data-column="client-name"]').first().text().trim() || '',
                        priority_level: $row.find('[data-column="priority-level"]').first().text().trim() || '',
                        accountant: $row.find('[data-column="accountant"]').first().text().trim() || '',
                        darren_progress: $row.find('[data-column="progress"]').first().text().trim() || '',
                        referral_person: $row.find('[data-column="referral"]').first().text().trim() || '',
                        industry: $row.find('[data-column="industry"]').first().text().trim() || '',
                        darren_risks: $row.find('[data-column="risk-profile"]').first().text().trim() || ''
                    };
                    clients.push(clientData);
                });
            });
        } catch (error) {
            console.error('Error extracting client data:', error);
        }
        return clients;
    }

    getTaskCentricExportData() {
        // Extract task data from current page (existing functionality)
        const tasks = [];
        try {
            const $projectGroups = $('.pm-project-group');
            if ($projectGroups.length === 0) {
                console.warn('No project groups found for task export');
                return tasks;
            }

            $projectGroups.each(function(groupIndex) {
                if (groupIndex > 100) { // Safety limit
                    console.warn('Too many project groups, limiting to 100');
                    return false;
                }
                
                const $group = $(this);
                const clientName = $group.find('.pm-group-header h3').first().text().trim() || 'Unknown Client';
                
                const $taskRows = $group.find('.pm-task-row');
                $taskRows.each(function(rowIndex) {
                    if (rowIndex > 500) { // Safety limit
                        console.warn('Too many task rows, limiting to 500 per group');
                        return false;
                    }
                    
                    const $row = $(this);
                    const taskData = {
                        client: clientName,
                        subject: $row.find('[data-column="task-name"]').first().text().trim() || '',
                        status: $row.find('[data-column="status"]').first().text().trim() || '',
                        priority: $row.find('[data-column="priority"]').first().text().trim() || '',
                        assigned_to: $row.find('[data-column="action-person"]').first().text().trim() || '',
                        exp_end_date: $row.find('[data-column="target-month"]').first().text().trim() || ''
                    };
                    tasks.push(taskData);
                });
            });
        } catch (error) {
            console.error('Error extracting task data:', error);
        }
        return tasks;
    }

    /**
     * Cleanup method to prevent memory leaks
     */
    destroy() {
        // Clear any pending timeouts
        if (this.displayTypeUpdateTimeout) {
            clearTimeout(this.displayTypeUpdateTimeout);
        }
        
        // 不需要移除事件监听器，因为没有添加
        
        // Clear references
        this.availableFields = {};
        this.selectedFields = [];
        this.templateSelectedFields = null;
        this.selectedProjects = null;
    }
}

// Initialize CSV Manager when DOM is ready with enhanced safety
function initializeCSVManager() {
    // Check if we're in a valid environment
    if (typeof $ === 'undefined' || typeof frappe === 'undefined') {
        console.warn('CSV Manager: Required dependencies not available, retrying...');
        setTimeout(initializeCSVManager, 1000);
        return;
    }
    
    try {
        // Destroy existing instance if it exists
        if (window.CSVManager && typeof window.CSVManager.destroy === 'function') {
            window.CSVManager.destroy();
        }
        
        // Create fallback first
        window.CSVManager = createFallbackCSVManager();
        
        // Wait for other components to initialize
        setTimeout(() => {
            try {
                // Check if page is still valid
                if (document.readyState !== 'complete' && document.readyState !== 'interactive') {
                    console.warn('CSV Manager: Page not ready, skipping initialization');
                    return;
                }
                
                const csvManager = new CSVManager();
                window.CSVManager = csvManager;
                console.log('CSV Manager initialized successfully');
                
                // Add cleanup on page unload
                $(window).on('beforeunload.csvManager', () => {
                    if (window.CSVManager && typeof window.CSVManager.destroy === 'function') {
                        window.CSVManager.destroy();
                    }
                });
                
            } catch (initError) {
                console.error('Error during CSV Manager initialization:', initError);
                // Keep fallback manager
            }
        }, 800); // Give more time for components to initialize
        
    } catch (error) {
        console.error('Error setting up CSV Manager:', error);
        window.CSVManager = createFallbackCSVManager();
    }
}

// Initialize when DOM is ready
$(document).ready(function() {
    // Add global error handler for CSV Manager
    window.addEventListener('error', function(event) {
        if (event.error && event.error.stack && event.error.stack.includes('CSVManager')) {
            console.error('CSV Manager Global Error:', event.error);
            // Reset to fallback if there's a critical error
            if (window.CSVManager && typeof window.CSVManager.destroy === 'function') {
                try {
                    window.CSVManager.destroy();
                } catch (destroyError) {
                    console.error('Error destroying CSV Manager:', destroyError);
                }
            }
            window.CSVManager = createFallbackCSVManager();
        }
    });
    
    // Add a small delay to ensure all scripts are loaded
    setTimeout(initializeCSVManager, 200);
});

// Fallback CSV Manager
function createFallbackCSVManager() {
    return {
        showExportDialog: () => {
            frappe.show_alert({
                message: 'CSV export feature is temporarily unavailable. Please refresh the page.',
                indicator: 'orange'
            });
        },
        showImportDialog: () => {
            frappe.show_alert({
                message: 'CSV import feature is temporarily unavailable. Please refresh the page.',
                indicator: 'orange'
            });
        },
        destroy: () => {
            console.log('Fallback CSV Manager destroyed');
        }
    };
}