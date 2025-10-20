// Smart Accounting - CSV Export/Import Manager
// Modular CSV export/import functionality integrated with ERPNext built-in features

class CSVManager {
    constructor() {
        this.currentView = null;
        this.currentBoardData = null;
        this.availableFields = {};
        this.selectedFields = [];
        
        // Initialize current view information
        this.initializeCurrentView();
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
        if (window.ColumnConfigManager) {
            // Get all available fields
            this.availableFields = window.ColumnConfigManager.getAllColumns();
            
            // Get current board's visible fields as default selection
            this.selectedFields = window.ColumnConfigManager.getDefaultVisibleColumns();
        } else {
            console.warn('ColumnConfigManager not available, using fallback fields');
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
        // First show project selection dialog
        this.showProjectSelectionDialog('export');
    }

    /**
     * Show CSV import dialog
     */
    showImportDialog() {
        // First show project selection dialog
        this.showProjectSelectionDialog('import');
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
        
        // File upload area click
        $dialog.on('click', '#csv-upload-area', () => {
            $('#csv-file-input').click();
        });
        
        // File selection
        $dialog.on('change', '#csv-file-input', (e) => {
            this.handleFileSelection(e.target.files[0]);
        });
        
        // Remove file
        $dialog.on('click', '.csv-remove-file', () => {
            this.removeSelectedFile();
        });
        
        // Drag and drop upload
        $dialog.on('dragover', '#csv-upload-area', (e) => {
            e.preventDefault();
            $(e.currentTarget).addClass('csv-drag-over');
        });
        
        $dialog.on('dragleave', '#csv-upload-area', (e) => {
            e.preventDefault();
            $(e.currentTarget).removeClass('csv-drag-over');
        });
        
        $dialog.on('drop', '#csv-upload-area', (e) => {
            e.preventDefault();
            $(e.currentTarget).removeClass('csv-drag-over');
            const files = e.originalEvent.dataTransfer.files;
            if (files.length > 0) {
                this.handleFileSelection(files[0]);
            }
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
        if (!file) return;
        
        // Validate file type
        if (!file.name.toLowerCase().endsWith('.csv')) {
            frappe.show_alert({
                message: 'Please select a CSV format file',
                indicator: 'red'
            });
            return;
        }
        
        // Validate file size (5MB)
        if (file.size > 5 * 1024 * 1024) {
            frappe.show_alert({
                message: 'File size cannot exceed 5MB',
                indicator: 'red'
            });
            return;
        }
        
        // Display file information
        this.displayFileInfo(file);
        
        // Preview file content
        this.previewCSVFile(file);
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
        $('#csv-file-input').val('');
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
     * Parse CSV content
     */
    parseCSV(csvText) {
        const lines = csvText.split('\n');
        const result = [];
        
        for (let i = 0; i < Math.min(lines.length, 6); i++) { // Only preview first 5 rows of data
            if (lines[i].trim()) {
                // Simple CSV parsing, handle comma separation
                const row = lines[i].split(',').map(cell => cell.trim().replace(/^"|"$/g, ''));
                result.push(row);
            }
        }
        
        return result;
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
        const fileInput = $('#csv-file-input')[0];
        if (!fileInput.files || fileInput.files.length === 0) {
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
        this.callImportAPI(fileInput.files[0], importMode, skipErrors);
    }


    /**
     * Call export API
     */
    callExportAPI(selectedFields, includeHeaders, exportAllData) {
        frappe.call({
            method: 'smart_accounting.api.csv_export.export_board_data',
            args: {
                board_view: this.currentView,
                selected_fields: selectedFields,
                include_headers: includeHeaders,
                export_all_data: exportAllData,
                selected_projects: this.selectedProjects || []
            },
            callback: (response) => {
                if (response.message && response.message.success) {
                    // Download file
                    this.downloadCSVFile(response.message.file_url, response.message.filename);
                    this.closeDialog('csv-export-dialog');
                    
                    frappe.show_alert({
                        message: 'Data exported successfully',
                        indicator: 'green'
                    });
                } else {
                    frappe.show_alert({
                        message: response.message?.error || 'Export failed, please try again',
                        indicator: 'red'
                    });
                }
            },
            error: (error) => {
                console.error('Export error:', error);
                frappe.show_alert({
                    message: 'Error occurred during export',
                    indicator: 'red'
                });
            },
            always: () => {
                $('.csv-export-confirm').prop('disabled', false).html('<i class="fa fa-download"></i> Export CSV');
            }
        });
    }

    /**
     * Call import API
     */
    callImportAPI(file, importMode, skipErrors) {
        // Create FormData object to upload file
        const formData = new FormData();
        formData.append('file', file);
        formData.append('board_view', this.currentView);
        formData.append('import_mode', importMode);
        formData.append('skip_errors', skipErrors);
        formData.append('selected_projects', JSON.stringify(this.selectedProjects || []));
        
        // Use jQuery AJAX to upload file
        $.ajax({
            url: '/api/method/smart_accounting.api.csv_import.import_board_data',
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            headers: {
                'X-Frappe-CSRF-Token': frappe.csrf_token
            },
            success: (response) => {
                if (response.message && response.message.success) {
                    this.closeDialog('csv-import-dialog');
                    
                    // Show import results
                    this.showImportResults(response.message);
                    
                    // Refresh page data
                    if (window.location.reload) {
                        setTimeout(() => window.location.reload(), 2000);
                    }
                } else {
                    frappe.show_alert({
                        message: response.message?.error || 'Import failed, please try again',
                        indicator: 'red'
                    });
                }
            },
            error: (xhr, status, error) => {
                console.error('Import error:', error);
                frappe.show_alert({
                    message: 'Error occurred during import',
                    indicator: 'red'
                });
            },
            complete: () => {
                $('.csv-import-confirm').prop('disabled', false).html('<i class="fa fa-upload"></i> Import Data');
            }
        });
    }

    /**
     * Download CSV file
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
}

// Create global instance
window.CSVManager = new CSVManager();