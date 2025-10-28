// Multi-Select Manager for Task Management
// Handles task selection, batch operations, and confirmation dialogs

class MultiSelectManager {
    constructor() {
        this.selectedTasks = new Set();
        this.selectedSubtasks = new Set(); // 新增：subtask选择管理
        this.isSelectAllActive = false;
        this.isSubtaskSelectAllActive = false; // 新增：subtask全选状态
        this.bulkUpdateDebounceTimer = null;
        this.lastBulkUpdateKey = null;
        this.confirmationDialogOpen = false;
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

        // Individual subtask checkbox events (新增)
        $(document).on('change', '.pm-subtask-multiselect-checkbox', (e) => {
            e.stopPropagation();
            this.handleSubtaskSelection(e.currentTarget);
        });

        // Select all checkbox events
        $(document).on('change', '.pm-select-all-checkbox', (e) => {
            e.stopPropagation();
            this.handleSelectAll(e.currentTarget);
        });

        // Subtask select all checkbox events (新增)
        $(document).on('change', '.pm-subtask-select-all-checkbox', (e) => {
            e.stopPropagation();
            this.handleSubtaskSelectAll(e.currentTarget);
        });

        // Multi-select action buttons
        $(document).on('click', '.pm-multiselect-action', (e) => {
            e.preventDefault();
            const action = $(e.currentTarget).data('action');
            const type = $(e.currentTarget).data('type') || 'task'; // 新增：区分task和subtask
            this.handleBatchAction(action, type);
        });

        // Clear selection button
        $(document).on('click', '.pm-multiselect-close', (e) => {
            e.preventDefault();
            const type = $(e.currentTarget).data('type') || 'task';
            this.clearSelection(type);
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

    // 新增：处理subtask选择
    handleSubtaskSelection(checkbox) {
        const $checkbox = $(checkbox);
        const subtaskId = $checkbox.data('subtask-id');
        const $subtaskRow = $checkbox.closest('.pm-subtask-row');

        if ($checkbox.is(':checked')) {
            this.selectedSubtasks.add(subtaskId);
            $subtaskRow.addClass('selected');
        } else {
            this.selectedSubtasks.delete(subtaskId);
            $subtaskRow.removeClass('selected');
        }

        this.updateSubtaskSelectAllState();
        this.updateMultiSelectMenu();
    }

    // 新增：处理subtask全选
    handleSubtaskSelectAll(checkbox) {
        const $checkbox = $(checkbox);
        const $subtaskContainer = $checkbox.closest('.pm-subtask-container');
        const $subtaskCheckboxes = $subtaskContainer.find('.pm-subtask-multiselect-checkbox');

        if ($checkbox.is(':checked')) {
            // Select all subtasks in this container
            $subtaskCheckboxes.each((index, subtaskCheckbox) => {
                const $subtaskCheckbox = $(subtaskCheckbox);
                const subtaskId = $subtaskCheckbox.data('subtask-id');
                const $subtaskRow = $subtaskCheckbox.closest('.pm-subtask-row');

                $subtaskCheckbox.prop('checked', true);
                this.selectedSubtasks.add(subtaskId);
                $subtaskRow.addClass('selected');
            });
            this.isSubtaskSelectAllActive = true;
        } else {
            // Deselect all subtasks in this container
            $subtaskCheckboxes.each((index, subtaskCheckbox) => {
                const $subtaskCheckbox = $(subtaskCheckbox);
                const subtaskId = $subtaskCheckbox.data('subtask-id');
                const $subtaskRow = $subtaskCheckbox.closest('.pm-subtask-row');

                $subtaskCheckbox.prop('checked', false);
                this.selectedSubtasks.delete(subtaskId);
                $subtaskRow.removeClass('selected');
            });
            this.isSubtaskSelectAllActive = false;
        }

        this.updateMultiSelectMenu();
    }

    // 新增：更新subtask全选状态
    updateSubtaskSelectAllState() {
        $('.pm-subtask-container').each((index, container) => {
            const $container = $(container);
            const $selectAllCheckbox = $container.find('.pm-subtask-select-all-checkbox');
            const $subtaskCheckboxes = $container.find('.pm-subtask-multiselect-checkbox');
            
            const totalSubtasks = $subtaskCheckboxes.length;
            const selectedSubtasks = $subtaskCheckboxes.filter(':checked').length;

            if (selectedSubtasks === 0) {
                $selectAllCheckbox.prop('checked', false);
                $selectAllCheckbox.prop('indeterminate', false);
            } else if (selectedSubtasks === totalSubtasks) {
                $selectAllCheckbox.prop('checked', true);
                $selectAllCheckbox.prop('indeterminate', false);
            } else {
                $selectAllCheckbox.prop('checked', false);
                $selectAllCheckbox.prop('indeterminate', true);
            }
        });
    }

    updateMultiSelectMenu() {
        const selectedTaskCount = this.selectedTasks.size;
        const selectedSubtaskCount = this.selectedSubtasks.size;
        const $taskMenu = $('#pm-multiselect-menu');
        const $subtaskMenu = $('#pm-subtask-multiselect-menu');

        // 更新task多选菜单
        if (selectedTaskCount > 0) {
            const $count = $taskMenu.find('.pm-multiselect-count');
            $count.text(selectedTaskCount);
            $taskMenu.addClass('show');
        } else {
            $taskMenu.removeClass('show');
        }

        // 更新subtask多选菜单
        if (selectedSubtaskCount > 0) {
            if ($subtaskMenu.length === 0) {
                this.initializeSubtaskMultiSelectMenu();
            }
            const $count = $subtaskMenu.find('.pm-multiselect-count');
            $count.text(selectedSubtaskCount);
            $subtaskMenu.addClass('show');
        } else {
            $subtaskMenu.removeClass('show');
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

    // 新增：初始化subtask多选菜单
    initializeSubtaskMultiSelectMenu() {
        // Create the subtask menu if it doesn't exist
        if ($('#pm-subtask-multiselect-menu').length === 0) {
            const menuHtml = `
                <div class="pm-multiselect-menu pm-subtask-multiselect-menu" id="pm-subtask-multiselect-menu">
                    <div class="pm-multiselect-info">
                        <i class="fa fa-check-square"></i>
                        <span class="pm-multiselect-count">0</span>
                        <span>subtasks selected</span>
                    </div>
                    <div class="pm-bulk-update-hint">
                        <i class="fa fa-magic"></i>
                        <span>Edit any field to apply to all selected subtasks</span>
                    </div>
                    <div class="pm-multiselect-actions">
                        <button class="pm-multiselect-action archive" data-action="archive" data-type="subtask">
                            <i class="fa fa-archive"></i>
                            Archive
                        </button>
                        <button class="pm-multiselect-action delete" data-action="delete" data-type="subtask">
                            <i class="fa fa-trash"></i>
                            Delete
                        </button>
                    </div>
                    <button class="pm-multiselect-close" data-type="subtask" title="Clear selection">
                        <i class="fa fa-times"></i>
                    </button>
                </div>
            `;
            $('body').append(menuHtml);
        }
    }

    clearSelection(type = 'task') {
        if (type === 'subtask') {
            // Clear subtask selections
            this.selectedSubtasks.clear();
            $('.pm-subtask-multiselect-checkbox, .pm-subtask-select-all-checkbox').prop('checked', false);
            $('.pm-subtask-row').removeClass('selected');
            $('.pm-subtask-select-all-checkbox').prop('indeterminate', false);
            $('#pm-subtask-multiselect-menu').removeClass('show');
            this.isSubtaskSelectAllActive = false;
        } else {
            // Clear task selections
            this.selectedTasks.clear();
            $('.pm-task-checkbox, .pm-select-all-checkbox').prop('checked', false);
            $('.pm-task-row').removeClass('selected');
            $('.pm-select-all-checkbox').prop('indeterminate', false);
            $('#pm-multiselect-menu').removeClass('show');
            this.isSelectAllActive = false;
        }
    }

    handleBatchAction(action, type = 'task') {
        const selectedItems = type === 'subtask' ? this.selectedSubtasks : this.selectedTasks;
        
        if (selectedItems.size === 0) {
            frappe.msgprint(__(type === 'subtask' ? 'No subtasks selected' : 'No tasks selected'));
            return;
        }

        // Get item details for confirmation
        const selectedItemDetails = Array.from(selectedItems).map(itemId => {
            if (type === 'subtask') {
                const $subtaskRow = $(`.pm-subtask-row[data-subtask-id="${itemId}"]`);
                // 修复：使用正确的subtask名称选择器
                const subtaskName = $subtaskRow.find('.subtask-name-display').text() || 'Untitled Subtask';
                return { id: itemId, name: subtaskName };
            } else {
                const $taskRow = $(`.pm-task-row[data-task-id="${itemId}"]`);
                const taskName = $taskRow.data('task-name') || $taskRow.find('.task-name-display').text() || 'Untitled Task';
                return { id: itemId, name: taskName };
            }
        });

        // Show confirmation dialog
        this.showConfirmationDialog(action, selectedItemDetails, type);
    }

    showConfirmationDialog(action, items, type = 'task') {
        const actionText = action === 'delete' ? 'Delete' : 'Archive';
        const actionColor = action === 'delete' ? 'danger' : 'primary';
        const actionIcon = action === 'delete' ? 'fa-trash' : 'fa-archive';
        const itemType = type === 'subtask' ? 'subtasks' : 'tasks';
        const actionMessage = action === 'delete' 
            ? `This action cannot be undone. The selected ${itemType} will be permanently deleted.`
            : `The selected ${itemType} will be archived and hidden from the main view. You can restore them later if needed.`;

        const itemListHtml = items.map(item => 
            `<div class="pm-confirmation-task-item">
                <i class="fa fa-${type === 'subtask' ? 'list' : 'tasks'}"></i>
                <span>${item.name}</span>
            </div>`
        ).join('');

        const dialogHtml = `
            <div class="pm-confirmation-dialog" id="pm-confirmation-dialog">
                <div class="pm-confirmation-content">
                    <div class="pm-confirmation-header">
                        <h3 class="pm-confirmation-title">
                            <i class="fa ${actionIcon}"></i>
                            ${actionText} ${items.length} ${itemType.charAt(0).toUpperCase() + itemType.slice(1)}
                        </h3>
                    </div>
                    <div class="pm-confirmation-body">
                        <p class="pm-confirmation-message">${actionMessage}</p>
                        <div class="pm-confirmation-task-list">
                            ${itemListHtml}
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
            const selectedItems = type === 'subtask' ? Array.from(this.selectedSubtasks) : Array.from(this.selectedTasks);
            this.executeAction(action, selectedItems, type);
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

    async executeAction(action, itemIds, type = 'task') {
        if (!itemIds || itemIds.length === 0) {
            frappe.msgprint(__(type === 'subtask' ? 'No subtasks selected' : 'No tasks selected'));
            return;
        }

        try {
            // Show loading indicator
            frappe.show_progress(__('Processing'), 0, itemIds.length, __('Please wait...'));

            const endpoint = type === 'subtask' 
                ? (action === 'delete' ? 'batch_delete_subtasks' : 'batch_archive_subtasks')
                : (action === 'delete' ? 'batch_delete_tasks' : 'batch_archive_tasks');
            
            const args = type === 'subtask' ? { subtask_ids: itemIds } : { task_ids: itemIds };
            
            const response = await frappe.call({
                method: `smart_accounting.www.project_management.index.${endpoint}`,
                args: args,
                callback: (r) => {
                    frappe.hide_progress();
                    
                    if (r.message && r.message.success) {
                        const successCount = r.message.success_count || itemIds.length;
                        const actionText = action === 'delete' ? 'deleted' : 'archived';
                        
                        const itemType = type === 'subtask' ? 'subtask' : 'task';
                        frappe.show_alert({
                            message: __(`Successfully ${actionText} ${successCount} ${itemType}${successCount > 1 ? 's' : ''}`),
                            indicator: 'green'
                        });

                        // Remove processed items from the UI
                        if (type === 'subtask') {
                            this.removeSubtasksFromUI(itemIds);
                        } else {
                            this.removeTasksFromUI(itemIds);
                        }
                        
                        // Clear selection
                        this.clearSelection(type);
                        
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

    // 新增：从UI中移除subtask
    removeSubtasksFromUI(subtaskIds) {
        // Remove subtask rows from the UI
        subtaskIds.forEach(subtaskId => {
            $(`.pm-subtask-row[data-subtask-id="${subtaskId}"]`).fadeOut(300, function() {
                $(this).remove();
            });
        });

        // Update subtask counts for parent tasks if needed
        setTimeout(() => {
            $('.pm-subtask-container').each((index, container) => {
                const $container = $(container);
                const visibleSubtasks = $container.find('.pm-subtask-row:not(.pm-add-subtask-item):visible').length;
                const parentTaskId = $container.data('parent-task');
                const $subtaskToggle = $(`.pm-subtask-toggle[data-parent-task="${parentTaskId}"]`);
                
                if (visibleSubtasks === 0) {
                    $subtaskToggle.removeClass('has-subtasks').text('+ Sub');
                    $container.slideUp(300);
                } else {
                    $subtaskToggle.addClass('has-subtasks').text(`${visibleSubtasks} Sub`);
                }
            });
        }, 350);
    }

    setupBulkUpdateListener() {
        // Remove any existing listeners to prevent duplicates
        $(document).off('pm:cell:changed.multiselect');
        
        // Listen for cell value changes on selected tasks with namespace
        $(document).on('pm:cell:changed.multiselect', (e, data) => {
            const { taskId, field, newValue, oldValue } = data;
            
            // Enhanced debugging for priority field
            if (field === 'priority') {
                console.log(`🎯 ========== MultiSelect received pm:cell:changed ==========`);
                console.log(`🎯 taskId: ${taskId}`);
                console.log(`🎯 field: ${field}`);
                console.log(`🎯 newValue: "${newValue}" (type: ${typeof newValue})`);
                console.log(`🎯 oldValue: "${oldValue}" (type: ${typeof oldValue})`);
                console.log(`🎯 Selected tasks:`, Array.from(this.selectedTasks));
                console.log(`🎯 Bulk update in progress:`, window.bulkUpdateInProgress);
                console.log(`🎯 Reverting task change:`, window.revertingTaskChange);
                console.log(`🎯 Confirmation dialog open:`, this.confirmationDialogOpen);
                
                // Check the actual DOM state at this moment
                const $row = $(`.pm-task-row[data-task-id="${taskId}"]`);
                const $badge = $row.find('.pm-priority-badge');
                console.log(`🎯 DOM State when event received: badge text="${$badge.text().trim()}"`);
                console.log(`🎯 ================================================`);
            }
            
            // Prevent recursive calls during revert operations
            if (window.revertingTaskChange || window.bulkUpdateInProgress) {
                if (field === 'priority') {
                    console.log(`🎯 Skipping bulk update due to flags`);
                }
                return;
            }
            
            // Only proceed if this task is selected and there are other selected tasks
            if (this.selectedTasks.has(taskId) && this.selectedTasks.size > 1) {
                if (field === 'priority') {
                    console.log(`🎯 Proceeding with bulk update`);
                }
                this.applyBulkUpdate(taskId, field, newValue, oldValue);
            } else {
                if (field === 'priority') {
                    console.log(`🎯 Not proceeding: task selected=${this.selectedTasks.has(taskId)}, selected count=${this.selectedTasks.size}`);
                }
            }
        });
        
        // Remove any existing listeners to prevent duplicates
        $(document).off('task:field:updated.multiselect');
        
        // Listen for task editor changes with namespace
        $(document).on('task:field:updated.multiselect', (e, data) => {
            const { taskId, field, newValue } = data;
            
            if (this.selectedTasks.has(taskId) && this.selectedTasks.size > 1) {
                this.applyBulkUpdate(taskId, field, newValue);
            }
        });
    }
    
    applyBulkUpdate(sourceTaskId, field, newValue, oldValue = null) {
        // Check if this field is allowed for bulk update
        if (!this.isBulkUpdateAllowed(field)) {
            return;
        }
        
        // If bulk update is already in progress or confirmation dialog is open, skip
        if (window.bulkUpdateInProgress || this.confirmationDialogOpen) {
            return;
        }
        
        // Execute immediately to avoid DOM reading issues
        this.performBulkUpdate(sourceTaskId, field, newValue, oldValue);
    }
    
    performBulkUpdate(sourceTaskId, field, newValue, oldValue = null) {
        // Show confirmation for bulk update
        const otherTasks = Array.from(this.selectedTasks).filter(id => id !== sourceTaskId);
        
        if (otherTasks.length === 0) return;
        
        
        // Normalize newValue for person fields (handle array format from PersonSelectorManager)
        let normalizedValue = newValue;
        if (field.includes('person') || field.includes('preparer') || field.includes('reviewer') || field.includes('partner')) {
            if (Array.isArray(newValue)) {
                normalizedValue = newValue;
            }
        }
        
        const fieldDisplayName = this.getFieldDisplayName(field);
        const valueDisplay = this.getValueDisplayName(normalizedValue);
        
        // Set flag to prevent duplicate confirmations
        this.confirmationDialogOpen = true;
        
        // Show confirmation dialog
        console.log(`🎯 ========== SHOWING CONFIRMATION DIALOG ==========`);
        console.log(`🎯 Field: ${field}`);
        console.log(`🎯 fieldDisplayName: ${fieldDisplayName}`);
        console.log(`🎯 normalizedValue:`, normalizedValue);
        console.log(`🎯 valueDisplay: ${valueDisplay}`);
        console.log(`🎯 selectedTasks.size: ${this.selectedTasks.size}`);
        console.log(`🎯 otherTasks.length: ${otherTasks.length}`);
        console.log(`🎯 ===============================================`);
        
        frappe.confirm(
            `Apply this change to all ${this.selectedTasks.size} selected tasks?<br><br>
             <strong>Field:</strong> ${fieldDisplayName}<br>
             <strong>New Value:</strong> ${valueDisplay}<br><br>
             This will update ${otherTasks.length} other selected task${otherTasks.length > 1 ? 's' : ''}.`,
            () => {
                // User confirmed - proceed with bulk update
                this.confirmationDialogOpen = false;
                this.executeBulkUpdate(otherTasks, field, normalizedValue);
            },
            () => {
                // User cancelled - revert the source task change if needed
                this.confirmationDialogOpen = false;
                console.log('Bulk update cancelled by user');
                this.revertSourceTaskChange(sourceTaskId, field, oldValue);
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
            // Set flags to prevent any new confirmations during bulk update
            window.bulkUpdateInProgress = true;
            this.confirmationDialogOpen = true;
            
            // Show simple loading message instead of progress bar
            frappe.show_alert({
                message: `Updating ${taskIds.length} tasks...`,
                indicator: 'blue'
            });
            
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
                        
                } catch (error) {
                    console.error(`Error updating task ${taskId}:`, error);
                    errorCount++;
                }
            }
            
            // Clear both flags
            window.bulkUpdateInProgress = false;
            this.confirmationDialogOpen = false;
            
            // Show consolidated result (only one message)
            if (successCount > 0) {
                frappe.show_alert({
                    message: `Successfully updated ${successCount} task${successCount > 1 ? 's' : ''}`,
                    indicator: 'green'
                });
                
                // Force UI refresh for status fields to ensure all changes are visible
                if (field === 'status') {
                    setTimeout(() => {
                        taskIds.forEach(taskId => {
                            const $row = $(`.pm-task-row[data-task-id="${taskId}"]`);
                            const $statusBadge = $row.find('.pm-status-badge');
                            if ($statusBadge.length) {
                                // Update text content, CSS class, and color
                                const statusClass = newValue.toLowerCase().replace(/\s+/g, '-');
                                $statusBadge.attr('class', 'pm-status-badge')
                                           .addClass(`status-${statusClass}`)
                                           .text(newValue); // 确保文字也更新
                                
                                // Apply status color using available utils
                                if (window.PMUtils && window.PMUtils.applyStatusColor) {
                                    window.PMUtils.applyStatusColor($statusBadge, newValue);
                                } else if (window.ProjectManager && window.ProjectManager.utils) {
                                    window.ProjectManager.utils.applyStatusColor($statusBadge, newValue);
                                }
                            }
                        });
                    }, 100);
                }
            }
            
            if (errorCount > 0) {
                frappe.show_alert({
                    message: `Failed to update ${errorCount} task${errorCount > 1 ? 's' : ''}`,
                    indicator: 'orange'
                });
            }
            
        } catch (error) {
            // Clear both flags on error
            window.bulkUpdateInProgress = false;
            this.confirmationDialogOpen = false;
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
                    // Update both class and text content
                    const statusClass = newValue.toLowerCase().replace(/\s+/g, '-');
                    $statusBadge.attr('class', 'pm-status-badge')
                               .addClass(`status-${statusClass}`)
                               .text(newValue);
                } else {
                    // Fallback if no status badge found
                    const statusClass = newValue.toLowerCase().replace(/\s+/g, '-');
                    $cell.html(`<span class="pm-status-badge status-${statusClass}">${newValue}</span>`);
                }
                
                // Apply dynamic color using utils directly
                const $targetBadge = $statusBadge.length ? $statusBadge : $cell.find('.pm-status-badge');
                if (window.PMUtils && window.PMUtils.applyStatusColor) {
                    window.PMUtils.applyStatusColor($targetBadge, newValue);
                } else if (window.ProjectManager && window.ProjectManager.utils && window.ProjectManager.utils.applyStatusColor) {
                    window.ProjectManager.utils.applyStatusColor($targetBadge, newValue);
                }
                
                // Force a repaint to ensure the changes are visible
                $targetBadge[0]?.offsetHeight; // Trigger reflow
                
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
                // For person fields, handle complete role assignment data
                if (Array.isArray(newValue) && newValue.length > 0) {
                    // Multi-person assignment - update with all assigned people
                    await this.updatePersonCellWithMultipleUsers($cell, newValue);
                } else if (typeof newValue === 'string' && newValue.trim()) {
                    // Single person assignment
                    if (window.PersonSelectorManager && window.PersonSelectorManager.updatePersonFieldDisplay) {
                        const name = await this.getPersonNameFromEmail(newValue);
                        window.PersonSelectorManager.updatePersonFieldDisplay($cell, newValue, name);
                    } else {
                        await this.updatePersonCellFallback($cell, newValue);
                    }
                } else {
                    // Clear person assignment
                    if (window.PersonSelectorManager && window.PersonSelectorManager.updatePersonFieldDisplay) {
                        window.PersonSelectorManager.updatePersonFieldDisplay($cell, '', '');
                    } else {
                        await this.updatePersonCellFallback($cell, null);
                    }
                }
            }
            else if (field === 'custom_tftg') {
                // Handle TF/TG display
                let displayValue = newValue;
                if (newValue === 'Top Figures') displayValue = 'TF';
                else if (newValue === 'Top Grants') displayValue = 'TG';
                $cell.html(`<span class="pm-tf-tg-badge ${displayValue.toLowerCase()}">${displayValue}</span>`);
            }
            else if (field === 'priority') {
                // CRITICAL FIX: Use same logic as project.js updateTaskPriority method
                const $priorityBadge = $cell.find('.pm-priority-badge');
                
                if ($priorityBadge.length) {
                    // Update existing badge (same as single update)
                    const priorityClass = newValue ? newValue.toLowerCase() : 'medium';
                    const displayValue = newValue || 'Medium';
                    $priorityBadge.attr('class', 'pm-priority-badge editable-field')
                                 .addClass(`priority-${priorityClass}`)
                                 .text(displayValue);
                    console.log(`🔧 Bulk UI Update - Priority badge updated: text="${$priorityBadge.text()}", classes="${$priorityBadge.attr('class')}"`);
                } else {
                    // Fallback if no priority badge found
                    const priorityClass = newValue ? newValue.toLowerCase() : 'medium';
                    const displayValue = newValue || 'Medium';
                    $cell.html(`<span class="pm-priority-badge priority-${priorityClass} editable-field">${displayValue}</span>`);
                    console.log(`🔧 Bulk UI Update - Priority badge created via fallback`);
                }
            }
            else if (field.includes('date') || field.includes('due')) {
                // Handle date fields
                const displayValue = newValue ? this.formatDateForDisplay(newValue) : '-';
                $cell.find('.editable-field').text(displayValue);
            }
            else if (field.includes('budget') || field.includes('billing') || field.includes('amount')) {
                // Handle currency fields
                const displayValue = newValue ? this.formatCurrencyForDisplay(newValue) : '-';
                $cell.find('.editable-field').text(displayValue);
            }
            else {
                // Default text update for other fields
                const $editableField = $cell.find('.editable-field');
                if ($editableField.length) {
                    $editableField.text(newValue || '-');
                } else {
                    $cell.text(newValue || '');
                }
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
    
    async updatePersonCellFallback($cell, personData) {
        try {
            if (!personData) {
                // Show empty state
                $cell.html(`
                    <div class="pm-user-avatars pm-empty-person">
                        <div class="pm-avatar pm-empty-avatar">
                            <i class="fa fa-user"></i>
                        </div>
                    </div>
                `);
                return;
            }
            
            // Get person details
            const email = typeof personData === 'string' ? personData : personData.user || personData.email;
            if (!email) {
                $cell.html(`
                    <div class="pm-user-avatars pm-empty-person">
                        <div class="pm-avatar pm-empty-avatar">
                            <i class="fa fa-user"></i>
                        </div>
                    </div>
                `);
                return;
            }
            
            const name = await this.getPersonNameFromEmail(email);
            const initials = this.getPersonInitials(name || email);
            const avatarColor = this.getPersonAvatarColor(email);
            
            // Update with proper avatar
            $cell.html(`
                <div class="pm-user-avatars">
                    <div class="pm-avatar" style="background: ${avatarColor}" title="${name || email}">
                        ${initials}
                    </div>
                </div>
            `);
        } catch (error) {
            console.error('Error updating person cell:', error);
            // Fallback to simple text
            const displayText = typeof personData === 'string' ? personData : 
                               (personData && personData.name) ? personData.name : '';
            $cell.text(displayText);
        }
    }
    
    getPersonInitials(name) {
        if (!name) return '?';
        const parts = name.split(' ').filter(part => part.length > 0);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        } else if (parts.length === 1) {
            return parts[0].substring(0, 2).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }
    
    getPersonAvatarColor(email) {
        // Generate consistent color based on email
        const colors = [
            '#0073ea', '#00c875', '#fdab3d', '#e2445c', '#bb3354', 
            '#ff5ac4', '#784bd1', '#a25ddc', '#0086c0', '#579bfc',
            '#66ccff', '#68a1bd', '#9cd326', '#00d647', '#ff7575'
        ];
        
        let hash = 0;
        for (let i = 0; i < email.length; i++) {
            hash = email.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        return colors[Math.abs(hash) % colors.length];
    }
    
    async updatePersonCellWithMultipleUsers($cell, roleAssignments) {
        // Update person cell with multiple user assignments
        try {
            if (!roleAssignments || roleAssignments.length === 0) {
                // Show empty state
                $cell.html(`
                    <div class="pm-user-avatars pm-empty-person">
                        <div class="pm-avatar pm-empty-avatar">
                            <i class="fa fa-user"></i>
                        </div>
                    </div>
                `);
                return;
            }
            
            // Sort by primary status
            const sortedAssignments = roleAssignments.sort((a, b) => {
                if (a.is_primary && !b.is_primary) return -1;
                if (!a.is_primary && b.is_primary) return 1;
                return 0;
            });
            
            let avatarsHtml = '';
            const maxVisible = 2; // Show max 2 avatars, then +N
            
            for (let i = 0; i < Math.min(sortedAssignments.length, maxVisible); i++) {
                const assignment = sortedAssignments[i];
                const email = assignment.user;
                const name = await this.getPersonNameFromEmail(email);
                const initials = this.getPersonInitials(name || email);
                const color = this.getPersonAvatarColor(email);
                const isPrimary = assignment.is_primary;
                
                avatarsHtml += `
                    <div class="pm-avatar ${isPrimary ? 'pm-primary-user' : ''}" 
                         title="${name || email}" 
                         data-email="${email}" 
                         style="background: ${color}">
                        ${initials}
                    </div>
                `;
            }
            
            // Add "more" indicator if there are additional users
            if (sortedAssignments.length > maxVisible) {
                const remainingCount = sortedAssignments.length - maxVisible;
                avatarsHtml += `
                    <div class="pm-avatar-more" title="Total ${sortedAssignments.length} people assigned">
                        +${remainingCount}
                    </div>
                `;
            }
            
            $cell.html(`
                <div class="pm-user-avatars">
                    ${avatarsHtml}
                </div>
            `);
            
        } catch (error) {
            console.error('Error updating person cell with multiple users:', error);
            // Fallback to simple display
            await this.updatePersonCellFallback($cell, roleAssignments[0]?.user);
        }
    }
    
    revertSourceTaskChange(taskId, field, oldValue) {
        // Revert the source task's change when user cancels bulk update
        try {
            // Set flag to prevent recursive event triggering
            window.revertingTaskChange = true;
            
            const $taskRow = $(`.pm-task-row[data-task-id="${taskId}"]`);
            const $cell = $taskRow.find(`[data-field="${field}"]`);
            
            if (!$cell.length || !oldValue) {
                window.revertingTaskChange = false;
                return;
            }
            
            // Revert based on field type
            if (field === 'status') {
                const $statusBadge = $cell.find('.pm-status-badge');
                if ($statusBadge.length) {
                    const statusClass = oldValue.toLowerCase().replace(/\s+/g, '-');
                    $statusBadge.attr('class', 'pm-status-badge')
                               .addClass(`status-${statusClass}`)
                               .text(oldValue);
                    
                    // Apply original color
                    if (window.PMUtils && window.PMUtils.applyStatusColor) {
                        window.PMUtils.applyStatusColor($statusBadge, oldValue);
                    }
                }
            } else if (field === 'priority') {
                // CRITICAL FIX: Add priority field reversion support
                const $priorityBadge = $cell.find('.pm-priority-badge');
                if ($priorityBadge.length) {
                    const priorityClass = oldValue.toLowerCase().replace(/\s+/g, '-');
                    $priorityBadge.attr('class', 'pm-priority-badge editable-field')
                                 .addClass(`priority-${priorityClass}`)
                                 .text(oldValue);
                }
            }
            // Add more field type reversions as needed
            
            // Clear the flag after a short delay
            setTimeout(() => {
                window.revertingTaskChange = false;
            }, 100);
            
        } catch (error) {
            console.error('Error reverting source task change:', error);
            window.revertingTaskChange = false;
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
        // Extensible field display name mapping
        const fieldNames = {
            'status': 'Status',
            'custom_action_person': 'Action Person',
            'custom_preparer': 'Preparer', 
            'custom_reviewer': 'Reviewer',
            'custom_partner': 'Partner',
            'custom_softwares': 'Software',
            'custom_target_month': 'Target Month',
            'custom_budget_planning': 'Budget',
            'custom_actual_billing': 'Actual',
            'custom_process_date': 'Process Date',
            'custom_lodgement_due_date': 'Lodgement Due Date',
            'custom_reset_date': 'Reset Date',
            'custom_year_end': 'Year End',
            'custom_frequency': 'Frequency',
            'custom_note': 'Note',
            'custom_review_note': 'Review Note',
            'custom_tftg': 'TF/TG',
            'priority': 'Priority'
        };
        
        // If not found in mapping, try to generate a readable name
        if (!fieldNames[field]) {
            return field.replace(/^custom_/, '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        }
        
        return fieldNames[field];
    }
    
    formatDateForDisplay(dateValue) {
        // Format date for display (extensible)
        if (!dateValue) return '-';
        
        try {
            // Handle different date formats
            if (typeof dateValue === 'string') {
                const date = new Date(dateValue);
                if (!isNaN(date.getTime())) {
                    // Use DD-MM-YYYY format with dash separators for consistency
                    const day = String(date.getDate()).padStart(2, '0');
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const year = date.getFullYear();
                    return `${day}-${month}-${year}`;
                }
            }
            return dateValue;
        } catch (error) {
            return dateValue;
        }
    }
    
    formatCurrencyForDisplay(currencyValue) {
        // Format currency for display (extensible)
        if (!currencyValue || currencyValue === 0) return '-';
        
        try {
            const numValue = typeof currencyValue === 'string' ? parseFloat(currencyValue) : currencyValue;
            if (!isNaN(numValue)) {
                return new Intl.NumberFormat('en-AU', {
                    style: 'currency',
                    currency: 'AUD',
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2
                }).format(numValue);
            }
            return currencyValue;
        } catch (error) {
            return currencyValue;
        }
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

// Initialize MultiSelectManager globally - avoid duplicate declaration
if (!window.MultiSelectManager) {
    window.MultiSelectManager = MultiSelectManager;
}

// Auto-initialize when DOM is ready
$(document).ready(() => {
    if (!window.multiSelectManager) {
        window.multiSelectManager = new MultiSelectManager();
    }
});

