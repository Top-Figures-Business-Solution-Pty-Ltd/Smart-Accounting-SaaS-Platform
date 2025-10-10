// Multi-Select Manager for Task Management
// Handles task selection, batch operations, and confirmation dialogs

class MultiSelectManager {
    constructor() {
        this.selectedTasks = new Set();
        this.isSelectAllActive = false;
        this.init();
    }

    init() {
        this.bindEvents();
        this.initializeMultiSelectMenu();
        this.setupBulkUpdateListener();
    }

    bindEvents() {
        // Individual task checkbox events
        $(document).on('change', '.pm-task-checkbox', (e) => {
            e.stopPropagation();
            this.handleTaskSelection(e.currentTarget);
        });

        // Select all checkbox events
        $(document).on('change', '.pm-select-all-checkbox', (e) => {
            e.stopPropagation();
            this.handleSelectAll(e.currentTarget);
        });

        // Multi-select action buttons
        $(document).on('click', '.pm-multiselect-action', (e) => {
            e.preventDefault();
            const action = $(e.currentTarget).data('action');
            this.handleBatchAction(action);
        });

        // Clear selection button
        $(document).on('click', '.pm-multiselect-close', (e) => {
            e.preventDefault();
            this.clearSelection();
        });

        // Prevent task row click when clicking checkboxes
        $(document).on('click', '.pm-cell-select', (e) => {
            e.stopPropagation();
        });

        // Keyboard shortcuts
        $(document).on('keydown', (e) => {
            // Escape key to clear selection
            if (e.key === 'Escape' && this.selectedTasks.size > 0) {
                this.clearSelection();
            }
            // Delete key for quick delete
            else if (e.key === 'Delete' && this.selectedTasks.size > 0) {
                e.preventDefault();
                this.handleBatchAction('delete');
            }
        });
    }

    handleTaskSelection(checkbox) {
        const $checkbox = $(checkbox);
        const taskId = $checkbox.data('task-id');
        const $taskRow = $checkbox.closest('.pm-task-row');

        if ($checkbox.is(':checked')) {
            this.selectedTasks.add(taskId);
            $taskRow.addClass('selected');
        } else {
            this.selectedTasks.delete(taskId);
            $taskRow.removeClass('selected');
            // Uncheck select-all if it was checked
            $('.pm-select-all-checkbox').prop('checked', false);
            this.isSelectAllActive = false;
        }

        this.updateSelectAllState();
        this.updateMultiSelectMenu();
    }

    handleSelectAll(checkbox) {
        const $checkbox = $(checkbox);
        const $projectGroup = $checkbox.closest('.pm-project-group');
        const $taskCheckboxes = $projectGroup.find('.pm-task-checkbox');

        if ($checkbox.is(':checked')) {
            // Select all tasks in this project
            $taskCheckboxes.each((index, taskCheckbox) => {
                const $taskCheckbox = $(taskCheckbox);
                const taskId = $taskCheckbox.data('task-id');
                const $taskRow = $taskCheckbox.closest('.pm-task-row');

                $taskCheckbox.prop('checked', true);
                this.selectedTasks.add(taskId);
                $taskRow.addClass('selected');
            });
            this.isSelectAllActive = true;
        } else {
            // Deselect all tasks in this project
            $taskCheckboxes.each((index, taskCheckbox) => {
                const $taskCheckbox = $(taskCheckbox);
                const taskId = $taskCheckbox.data('task-id');
                const $taskRow = $taskCheckbox.closest('.pm-task-row');

                $taskCheckbox.prop('checked', false);
                this.selectedTasks.delete(taskId);
                $taskRow.removeClass('selected');
            });
            this.isSelectAllActive = false;
        }

        this.updateMultiSelectMenu();
    }

    updateSelectAllState() {
        // Update select-all checkbox state based on individual selections
        $('.pm-project-group').each((index, projectGroup) => {
            const $projectGroup = $(projectGroup);
            const $selectAllCheckbox = $projectGroup.find('.pm-select-all-checkbox');
            const $taskCheckboxes = $projectGroup.find('.pm-task-checkbox');
            
            const totalTasks = $taskCheckboxes.length;
            const selectedTasks = $taskCheckboxes.filter(':checked').length;

            if (selectedTasks === 0) {
                $selectAllCheckbox.prop('checked', false);
                $selectAllCheckbox.prop('indeterminate', false);
            } else if (selectedTasks === totalTasks) {
                $selectAllCheckbox.prop('checked', true);
                $selectAllCheckbox.prop('indeterminate', false);
            } else {
                $selectAllCheckbox.prop('checked', false);
                $selectAllCheckbox.prop('indeterminate', true);
            }
        });
    }

    updateMultiSelectMenu() {
        const selectedCount = this.selectedTasks.size;
        const $menu = $('#pm-multiselect-menu');
        const $count = $menu.find('.pm-multiselect-count');

        if (selectedCount > 0) {
            $count.text(selectedCount);
            $menu.addClass('show');
        } else {
            $menu.removeClass('show');
        }
    }

    initializeMultiSelectMenu() {
        // Create the menu if it doesn't exist
        if ($('#pm-multiselect-menu').length === 0) {
            const menuHtml = `
                <div class="pm-multiselect-menu" id="pm-multiselect-menu">
                    <div class="pm-multiselect-info">
                        <i class="fa fa-check-square"></i>
                        <span class="pm-multiselect-count">0</span>
                        <span>tasks selected</span>
                    </div>
                    <div class="pm-bulk-update-hint">
                        <i class="fa fa-magic"></i>
                        <span>Edit any field to apply to all selected tasks</span>
                    </div>
                    <div class="pm-multiselect-actions">
                        <button class="pm-multiselect-action archive" data-action="archive">
                            <i class="fa fa-archive"></i>
                            Archive
                        </button>
                        <button class="pm-multiselect-action delete" data-action="delete">
                            <i class="fa fa-trash"></i>
                            Delete
                        </button>
                    </div>
                    <button class="pm-multiselect-close" title="Clear selection">
                        <i class="fa fa-times"></i>
                    </button>
                </div>
            `;
            $('body').append(menuHtml);
        }
    }

    clearSelection() {
        // Clear all selections
        this.selectedTasks.clear();
        $('.pm-task-checkbox, .pm-select-all-checkbox').prop('checked', false);
        $('.pm-task-row').removeClass('selected');
        $('.pm-select-all-checkbox').prop('indeterminate', false);
        $('#pm-multiselect-menu').removeClass('show');
        this.isSelectAllActive = false;
    }

    handleBatchAction(action) {
        if (this.selectedTasks.size === 0) {
            frappe.msgprint(__('No tasks selected'));
            return;
        }

        // Get task details for confirmation
        const selectedTaskDetails = Array.from(this.selectedTasks).map(taskId => {
            const $taskRow = $(`.pm-task-row[data-task-id="${taskId}"]`);
            const taskName = $taskRow.data('task-name') || $taskRow.find('.task-name-display').text() || 'Untitled Task';
            return { id: taskId, name: taskName };
        });

        // Show confirmation dialog
        this.showConfirmationDialog(action, selectedTaskDetails);
    }

    showConfirmationDialog(action, tasks) {
        const actionText = action === 'delete' ? 'Delete' : 'Archive';
        const actionColor = action === 'delete' ? 'danger' : 'primary';
        const actionIcon = action === 'delete' ? 'fa-trash' : 'fa-archive';
        const actionMessage = action === 'delete' 
            ? 'This action cannot be undone. The selected tasks will be permanently deleted.'
            : 'The selected tasks will be archived and hidden from the main view. You can restore them later if needed.';

        const taskListHtml = tasks.map(task => 
            `<div class="pm-confirmation-task-item">
                <i class="fa fa-tasks"></i>
                <span>${task.name}</span>
            </div>`
        ).join('');

        const dialogHtml = `
            <div class="pm-confirmation-dialog" id="pm-confirmation-dialog">
                <div class="pm-confirmation-content">
                    <div class="pm-confirmation-header">
                        <h3 class="pm-confirmation-title">
                            <i class="fa ${actionIcon}"></i>
                            ${actionText} ${tasks.length} Task${tasks.length > 1 ? 's' : ''}
                        </h3>
                    </div>
                    <div class="pm-confirmation-body">
                        <p class="pm-confirmation-message">${actionMessage}</p>
                        <div class="pm-confirmation-task-list">
                            ${taskListHtml}
                        </div>
                    </div>
                    <div class="pm-confirmation-footer">
                        <button class="pm-confirmation-btn" data-action="cancel">Cancel</button>
                        <button class="pm-confirmation-btn ${actionColor}" data-action="confirm">${actionText}</button>
                    </div>
                </div>
            </div>
        `;

        // Remove existing dialog
        $('#pm-confirmation-dialog').remove();
        
        // Add new dialog
        $('body').append(dialogHtml);

        // Bind dialog events
        $('#pm-confirmation-dialog').on('click', '[data-action="cancel"]', () => {
            this.closeConfirmationDialog();
        });

        $('#pm-confirmation-dialog').on('click', '[data-action="confirm"]', () => {
            this.executeAction(action, Array.from(this.selectedTasks));
            this.closeConfirmationDialog();
        });

        // Close on overlay click
        $('#pm-confirmation-dialog').on('click', (e) => {
            if (e.target.id === 'pm-confirmation-dialog') {
                this.closeConfirmationDialog();
            }
        });

        // Close on escape key
        $(document).on('keydown.confirmation', (e) => {
            if (e.key === 'Escape') {
                this.closeConfirmationDialog();
            }
        });
    }

    closeConfirmationDialog() {
        $('#pm-confirmation-dialog').remove();
        $(document).off('keydown.confirmation');
    }

    async executeAction(action, taskIds) {
        if (!taskIds || taskIds.length === 0) {
            frappe.msgprint(__('No tasks selected'));
            return;
        }

        try {
            // Show loading indicator
            frappe.show_progress(__('Processing'), 0, taskIds.length, __('Please wait...'));

            const endpoint = action === 'delete' ? 'batch_delete_tasks' : 'batch_archive_tasks';
            
            const response = await frappe.call({
                method: `smart_accounting.www.project_management.index.${endpoint}`,
                args: {
                    task_ids: taskIds
                },
                callback: (r) => {
                    frappe.hide_progress();
                    
                    if (r.message && r.message.success) {
                        const successCount = r.message.success_count || taskIds.length;
                        const actionText = action === 'delete' ? 'deleted' : 'archived';
                        
                        frappe.show_alert({
                            message: __(`Successfully ${actionText} ${successCount} task${successCount > 1 ? 's' : ''}`),
                            indicator: 'green'
                        });

                        // Remove processed tasks from the UI
                        this.removeTasksFromUI(taskIds);
                        
                        // Clear selection
                        this.clearSelection();
                        
                        // Refresh the page data if needed
                        if (typeof window.location !== 'undefined') {
                            // Optional: Reload the page or refresh data
                            // window.location.reload();
                        }
                    } else {
                        frappe.msgprint({
                            title: __('Error'),
                            message: r.message?.error || __('Failed to process tasks'),
                            indicator: 'red'
                        });
                    }
                },
                error: (err) => {
                    frappe.hide_progress();
                    console.error('Batch action error:', err);
                    frappe.msgprint({
                        title: __('Error'),
                        message: __('An error occurred while processing tasks'),
                        indicator: 'red'
                    });
                }
            });

        } catch (error) {
            frappe.hide_progress();
            console.error('Batch action error:', error);
            frappe.msgprint({
                title: __('Error'),
                message: __('An error occurred while processing tasks'),
                indicator: 'red'
            });
        }
    }

    removeTasksFromUI(taskIds) {
        // Remove task rows from the UI
        taskIds.forEach(taskId => {
            $(`.pm-task-row[data-task-id="${taskId}"]`).fadeOut(300, function() {
                $(this).remove();
                // Update project task counts
                // You might want to implement this based on your UI structure
            });
        });

        // Update project group headers if needed
        setTimeout(() => {
            $('.pm-project-group').each((index, group) => {
                const $group = $(group);
                const visibleTasks = $group.find('.pm-task-row:not(.pm-add-task-row):visible').length;
                const $taskCount = $group.find('.pm-task-count');
                
                if (visibleTasks === 0) {
                    $taskCount.text('0 Tasks');
                } else {
                    $taskCount.text(`${visibleTasks} Task${visibleTasks > 1 ? 's' : ''}`);
                }
            });
        }, 350);
    }

    setupBulkUpdateListener() {
        // Listen for cell value changes on selected tasks
        $(document).on('pm:cell:changed', (e, data) => {
            const { taskId, field, newValue, oldValue } = data;
            
            // Only proceed if this task is selected and there are other selected tasks
            if (this.selectedTasks.has(taskId) && this.selectedTasks.size > 1) {
                this.applyBulkUpdate(taskId, field, newValue, oldValue);
            }
        });
        
        // Listen for task editor changes
        $(document).on('task:field:updated', (e, data) => {
            const { taskId, field, newValue } = data;
            
            if (this.selectedTasks.has(taskId) && this.selectedTasks.size > 1) {
                this.applyBulkUpdate(taskId, field, newValue);
            }
        });
    }
    
    applyBulkUpdate(sourceTaskId, field, newValue, oldValue = null) {
        // Check if this field is allowed for bulk update
        if (!this.isBulkUpdateAllowed(field)) {
            console.log(`Bulk update not allowed for field: ${field}`);
            return;
        }
        
        // Show confirmation for bulk update
        const otherTasks = Array.from(this.selectedTasks).filter(id => id !== sourceTaskId);
        
        if (otherTasks.length === 0) return;
        
        const fieldDisplayName = this.getFieldDisplayName(field);
        const valueDisplay = this.getValueDisplayName(newValue);
        
        // Show confirmation dialog
        frappe.confirm(
            `Apply this change to all ${this.selectedTasks.size} selected tasks?<br><br>
             <strong>Field:</strong> ${fieldDisplayName}<br>
             <strong>New Value:</strong> ${valueDisplay}<br><br>
             This will update ${otherTasks.length} other selected task${otherTasks.length > 1 ? 's' : ''}.`,
            () => {
                this.executeBulkUpdate(otherTasks, field, newValue);
            },
            () => {
                // User cancelled - optionally revert the source task change
                console.log('Bulk update cancelled by user');
            }
        );
    }
    
    isBulkUpdateAllowed(field) {
        // Get bulk update configuration - designed for scalability
        const bulkUpdateConfig = this.getBulkUpdateConfig();
        
        // Check if field is explicitly restricted
        if (bulkUpdateConfig.restrictedFields.includes(field)) {
            return false;
        }
        
        // Check if field is in allowed list (if allowedFields is defined)
        if (bulkUpdateConfig.allowedFields && bulkUpdateConfig.allowedFields.length > 0) {
            return bulkUpdateConfig.allowedFields.includes(field);
        }
        
        // Default: allow if not restricted
        return true;
    }
    
    getBulkUpdateConfig() {
        // Scalable configuration system for bulk updates
        // Can be extended to load from user preferences or admin settings
        
        // Check if there's a custom configuration
        if (window.BulkUpdateConfig) {
            return window.BulkUpdateConfig;
        }
        
        // Default configuration
        return {
            // Fields that cannot be bulk updated
            restrictedFields: [
                'client',           // Client cannot be bulk changed - different tasks may belong to different clients
                'custom_client',    // Same as above
                'engagement',       // Engagement is specific to each task
                'custom_engagement', // Same as above
                'subject',          // Task names should remain unique
                'project',          // Tasks belong to specific projects
                'custom_entity'     // Entity may be task-specific
            ],
            
            // Fields that can be bulk updated (if this array is empty, all non-restricted fields are allowed)
            allowedFields: [
                'status',
                'custom_action_person',
                'custom_preparer', 
                'custom_reviewer',
                'custom_partner',
                'custom_softwares',
                'custom_target_month',
                'custom_budget',
                'custom_actual',
                'priority',
                'custom_tftg',
                'custom_note',
                'custom_review_note'
            ],
            
            // Future extension points
            enableUserCustomization: true,  // Allow users to customize bulk update settings
            enableAdminOverride: true,      // Allow admins to override restrictions
            logBulkOperations: true         // Log bulk operations for audit
        };
    }
    
    async executeBulkUpdate(taskIds, field, newValue) {
        try {
            // Show progress
            frappe.show_progress('Updating Tasks', 0, taskIds.length, 'Applying changes...');
            
            // Update tasks one by one for better error handling
            let successCount = 0;
            let errorCount = 0;
            
            for (let i = 0; i < taskIds.length; i++) {
                const taskId = taskIds[i];
                
                try {
                    await this.updateSingleTask(taskId, field, newValue);
                    successCount++;
                    
                    // Update UI immediately
                    this.updateTaskUI(taskId, field, newValue);
                    
                    // Update progress
                    frappe.show_progress('Updating Tasks', i + 1, taskIds.length, 
                        `Updated ${successCount} of ${taskIds.length} tasks...`);
                        
                } catch (error) {
                    console.error(`Error updating task ${taskId}:`, error);
                    errorCount++;
                }
            }
            
            frappe.hide_progress();
            
            // Show result
            if (successCount > 0) {
                frappe.show_alert({
                    message: `Successfully updated ${successCount} task${successCount > 1 ? 's' : ''}`,
                    indicator: 'green'
                });
            }
            
            if (errorCount > 0) {
                frappe.show_alert({
                    message: `Failed to update ${errorCount} task${errorCount > 1 ? 's' : ''}`,
                    indicator: 'orange'
                });
            }
            
        } catch (error) {
            frappe.hide_progress();
            console.error('Bulk update error:', error);
            frappe.msgprint('Error during bulk update');
        }
    }
    
    async updateSingleTask(taskId, field, newValue) {
        // Use the configuration-based API mapping for scalability
        return new Promise((resolve, reject) => {
            const bulkConfig = this.getBulkUpdateConfig();
            let apiCall;
            
            // Check if field has specific API mapping
            if (bulkConfig.fieldApiMapping && bulkConfig.fieldApiMapping[field]) {
                const apiConfig = bulkConfig.fieldApiMapping[field];
                apiCall = {
                    method: apiConfig.method,
                    args: apiConfig.argsMapper(taskId, newValue)
                };
            } else {
                // Use default API
                const defaultConfig = bulkConfig.defaultApi;
                apiCall = {
                    method: defaultConfig.method,
                    args: defaultConfig.argsMapper(taskId, field, newValue)
                };
            }
            
            console.log(`Updating task ${taskId}, field ${field}:`, apiCall);
            
            frappe.call({
                ...apiCall,
                callback: (r) => {
                    if (r.message && r.message.success) {
                        resolve(r.message);
                    } else {
                        reject(new Error(r.message?.error || 'Update failed'));
                    }
                },
                error: (error) => {
                    reject(error);
                }
            });
        });
    }
    
    async updateTaskUI(taskId, field, newValue) {
        // Update the UI for the task using the same logic as single updates
        const $taskRow = $(`.pm-task-row[data-task-id="${taskId}"]`);
        const $cell = $taskRow.find(`[data-field="${field}"]`);
        
        if (!$cell.length) return;
        
        try {
            // Use the same UI update logic as the original editors
            if (field === 'status') {
                // Use same logic as project.js updateTaskStatus method
                const $statusBadge = $cell.find('.pm-status-badge');
                const $progressBar = $taskRow.find('.pm-progress-fill');
                
                // Remove all existing status classes and add new one
                if ($statusBadge.length) {
                    $statusBadge.attr('class', 'pm-status-badge')
                               .addClass(`status-${newValue.toLowerCase().replace(/\s+/g, '-')}`)
                               .text(newValue);
                } else {
                    // Fallback if no status badge found
                    $cell.html(`<span class="pm-status-badge status-${newValue.toLowerCase().replace(/\s+/g, '-')}">${newValue}</span>`);
                }
                
                // Update progress bar if exists
                if ($progressBar.length) {
                    const progressPercentage = newValue === 'Completed' ? 100 : 
                                             newValue === 'In Progress' ? 50 : 0;
                    $progressBar.css('width', `${progressPercentage}%`);
                }
            } 
            else if (field === 'custom_softwares') {
                // Use software selector's update method
                if (window.SoftwareSelectorManager && window.SoftwareSelectorManager.updateSoftwareCellDisplay) {
                    await window.SoftwareSelectorManager.updateSoftwareCellDisplay($cell, newValue);
                } else {
                    // Fallback
                    this.updateSoftwareCellFallback($cell, newValue);
                }
            }
            else if (field.includes('person') || field.includes('preparer') || field.includes('reviewer') || field.includes('partner')) {
                // Use person selector's update method if available
                if (window.PersonSelectorManager && window.PersonSelectorManager.updatePersonFieldDisplay) {
                    // For person fields, newValue should be email, we need to get the name
                    const name = await this.getPersonNameFromEmail(newValue);
                    window.PersonSelectorManager.updatePersonFieldDisplay($cell, newValue, name);
                } else {
                    // Fallback
                    this.updatePersonCellFallback($cell, newValue);
                }
            }
            else if (field === 'custom_tftg') {
                // Handle TF/TG display
                let displayValue = newValue;
                if (newValue === 'Top Figures') displayValue = 'TF';
                else if (newValue === 'Top Grants') displayValue = 'TG';
                $cell.html(`<span class="pm-tf-tg-badge ${displayValue.toLowerCase()}">${displayValue}</span>`);
            }
            else {
                // Default text update
                $cell.text(newValue || '');
            }
        } catch (error) {
            console.error(`Error updating UI for task ${taskId}, field ${field}:`, error);
            // Fallback to simple text update
            $cell.text(newValue || '');
        }
    }
    
    updateSoftwareCellFallback($cell, softwares) {
        if (!softwares || softwares.length === 0) {
            $cell.html(`
                <div class="pm-software-tags pm-empty-software">
                    <span class="pm-software-badge pm-empty-badge">
                        <i class="fa fa-plus"></i>
                        Add software
                    </span>
                </div>
            `);
        } else {
            const primarySoftware = softwares.find(s => s.is_primary) || softwares[0];
            if (softwares.length === 1) {
                $cell.html(`
                    <div class="pm-software-tags">
                        <span class="pm-software-badge pm-primary-software">${primarySoftware.software}</span>
                    </div>
                `);
            } else {
                $cell.html(`
                    <div class="pm-software-tags">
                        <span class="pm-software-badge pm-primary-software">${primarySoftware.software}</span>
                        <span class="pm-software-more">+${softwares.length - 1}</span>
                    </div>
                `);
            }
        }
    }
    
    updatePersonCellFallback($cell, personData) {
        if (typeof personData === 'string') {
            $cell.text(personData);
        } else if (personData && personData.name) {
            $cell.text(personData.name);
        } else {
            $cell.text('');
        }
    }
    
    async getPersonNameFromEmail(email) {
        // Get person name from email for UI display
        try {
            if (!email) return '';
            
            const response = await frappe.call({
                method: 'frappe.client.get_value',
                args: {
                    doctype: 'User',
                    filters: { email: email },
                    fieldname: ['full_name', 'first_name', 'last_name']
                }
            });
            
            if (response.message) {
                return response.message.full_name || 
                       `${response.message.first_name || ''} ${response.message.last_name || ''}`.trim() ||
                       email;
            }
            
            return email;
        } catch (error) {
            console.error('Error getting person name:', error);
            return email || '';
        }
    }
    
    getFieldDisplayName(field) {
        const fieldNames = {
            'status': 'Status',
            'custom_action_person': 'Action Person',
            'custom_preparer': 'Preparer', 
            'custom_reviewer': 'Reviewer',
            'custom_partner': 'Partner',
            'custom_softwares': 'Software',
            'custom_target_month': 'Target Month',
            'custom_budget': 'Budget',
            'custom_actual': 'Actual',
            'priority': 'Priority'
        };
        return fieldNames[field] || field;
    }
    
    getValueDisplayName(value) {
        if (!value) return 'Empty';
        if (typeof value === 'object') {
            return value.name || value.title || JSON.stringify(value);
        }
        return String(value);
    }

    // Public methods for external access
    getSelectedTasks() {
        return Array.from(this.selectedTasks);
    }

    selectTask(taskId) {
        const $checkbox = $(`.pm-task-checkbox[data-task-id="${taskId}"]`);
        if ($checkbox.length && !$checkbox.is(':checked')) {
            $checkbox.prop('checked', true).trigger('change');
        }
    }

    deselectTask(taskId) {
        const $checkbox = $(`.pm-task-checkbox[data-task-id="${taskId}"]`);
        if ($checkbox.length && $checkbox.is(':checked')) {
            $checkbox.prop('checked', false).trigger('change');
        }
    }
}

// Initialize MultiSelectManager globally
window.MultiSelectManager = MultiSelectManager;

// Auto-initialize when DOM is ready
$(document).ready(() => {
    if (!window.multiSelectManager) {
        window.multiSelectManager = new MultiSelectManager();
    }
});
