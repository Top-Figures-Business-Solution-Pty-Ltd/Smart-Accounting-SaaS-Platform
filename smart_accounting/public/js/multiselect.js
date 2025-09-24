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
