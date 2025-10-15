// Project Management - Subtask Management
// Subtask creation and management functionality

class SubtaskManager {
    constructor() {
        this.utils = window.PMUtils;
        this.expandedTasks = new Set(); // Track which tasks have subtasks expanded
        this.columnWidths = {}; // Subtask column widths
        this.saveTimeout = null;
    }

    // Initialize subtask functionality
    initializeSubtasks() {
        // Load subtask column widths first
        this.loadSubtaskColumnWidths().then(() => {
            // Initialize column resizing after widths are loaded
            this.initializeSubtaskColumnResizing();
        });
        
        // Bind subtask toggle events
        $(document).on('click', '.pm-subtask-toggle', (e) => {
            e.stopPropagation();
            const taskId = $(e.currentTarget).data('task-id');
            this.toggleSubtasks(taskId);
        });

        // Prevent subtask toggle from triggering client editing
        $(document).on('click', '.pm-subtask-toggle', (e) => {
            e.stopPropagation();
        });
    }

    async toggleSubtasks(taskId) {
        const $toggleBtn = $(`.pm-subtask-toggle[data-task-id="${taskId}"]`);
        const $taskRow = $(`.pm-task-row[data-task-id="${taskId}"]`);
        const $icon = $toggleBtn.find('i');

        if (this.expandedTasks.has(taskId)) {
            // Collapse subtasks
            this.collapseSubtasks(taskId);
        } else {
            // Expand subtasks
            this.expandSubtasks(taskId);
        }
    }

    async expandSubtasks(taskId) {
        const $toggleBtn = $(`.pm-subtask-toggle[data-task-id="${taskId}"]`);
        const $taskRow = $(`.pm-task-row[data-task-id="${taskId}"]`);
        const $icon = $toggleBtn.find('i');

        try {
            // Show loading
            $icon.removeClass('fa-chevron-right').addClass('fa-spinner fa-spin');

            // Load subtasks from backend
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.get_subtasks',
                args: { parent_task_id: taskId }
            });

            if (response.message && response.message.success) {
                const subtasks = response.message.subtasks || [];
                
                // Create subtask container
                this.renderSubtasks(taskId, subtasks);
                
                // Update toggle state
                this.expandedTasks.add(taskId);
                $icon.removeClass('fa-spinner fa-spin').addClass('fa-chevron-down');
                $toggleBtn.addClass('expanded');
                $taskRow.addClass('has-expanded-subtasks');

            } else {
                throw new Error(response.message?.error || 'Failed to load subtasks');
            }

        } catch (error) {
            console.error('Error loading subtasks:', error);
            $icon.removeClass('fa-spinner fa-spin').addClass('fa-chevron-right');
            
            frappe.show_alert({
                message: 'Failed to load subtasks',
                indicator: 'red'
            });
        }
    }

    collapseSubtasks(taskId) {
        const $toggleBtn = $(`.pm-subtask-dropdown-toggle[data-task-id="${taskId}"]`);
        const $taskRow = $(`.pm-task-row[data-task-id="${taskId}"]`);
        const $icon = $toggleBtn.find('i');

        // Remove subtask container
        $(`.pm-subtask-container[data-parent-task="${taskId}"]`).slideUp(300, function() {
            $(this).remove();
        });

        // Update toggle state
        this.expandedTasks.delete(taskId);
        $icon.removeClass('fa-chevron-down').addClass('fa-chevron-right');
        $toggleBtn.removeClass('expanded');
        $taskRow.removeClass('has-expanded-subtasks');
    }

    renderSubtasks(parentTaskId, subtasks) {
        const $parentRow = $(`.pm-task-row[data-task-id="${parentTaskId}"]`);
        
        // Remove existing subtask container
        $(`.pm-subtask-container[data-parent-task="${parentTaskId}"]`).remove();

        // Create Monday.com style subtask container with table structure
        const subtaskHTML = `
            <div class="pm-subtask-container" data-parent-task="${parentTaskId}">
                <div class="pm-subtask-header">
                    <div class="pm-subtask-title">
                        <i class="fa fa-tasks"></i>
                        Subtasks (${subtasks.length})
                    </div>
                </div>
                <div class="pm-subtask-table">
                    <div class="pm-subtask-table-header">
                        <div class="pm-subtask-col pm-subtask-col-name" data-column="name">
                            Task Name
                            <div class="pm-subtask-col-resizer"></div>
                        </div>
                        <div class="pm-subtask-col pm-subtask-col-owner" data-column="owner">
                            Owner
                            <div class="pm-subtask-col-resizer"></div>
                        </div>
                        <div class="pm-subtask-col pm-subtask-col-status" data-column="status">
                            Status
                            <div class="pm-subtask-col-resizer"></div>
                        </div>
                        <div class="pm-subtask-col pm-subtask-col-due" data-column="due">
                            Due Date
                            <div class="pm-subtask-col-resizer"></div>
                        </div>
                        <div class="pm-subtask-col pm-subtask-col-note" data-column="note">
                            Note
                            <div class="pm-subtask-col-resizer"></div>
                        </div>
                    </div>
                    <div class="pm-subtask-list">
                        ${this.renderSubtaskList(subtasks, parentTaskId)}
                        ${this.renderAddSubtaskRow(parentTaskId)}
                    </div>
                </div>
            </div>
        `;

        // Insert after parent row
        $parentRow.after(subtaskHTML);

        // Bind events for new subtask container
        this.bindSubtaskEvents(parentTaskId);

        // Apply column widths to the new subtask table
        this.applySubtaskColumnWidths();

        // Animate in
        $(`.pm-subtask-container[data-parent-task="${parentTaskId}"]`).hide().slideDown(300);
    }

    renderSubtaskList(subtasks, parentTaskId) {
        if (!subtasks || subtasks.length === 0) {
            return `
                <div class="pm-subtask-empty">
                    <i class="fa fa-tasks"></i>
                    <span>No subtasks yet. Click "Add subtask" to create one.</span>
                </div>
            `;
        }

        return subtasks.map(subtask => `
            <div class="pm-subtask-item pm-subtask-row" data-subtask-id="${subtask.name}">
                <div class="pm-subtask-col pm-subtask-col-name">
                    <div class="pm-subtask-name-cell">
                        <div class="pm-subtask-checkbox">
                            <input type="checkbox" ${subtask.status === 'Completed' ? 'checked' : ''}>
                        </div>
                        <span class="pm-subtask-name editable-field" 
                              data-editable="true"
                              data-field="subject"
                              data-task-id="${subtask.name}"
                              data-field-type="text">${subtask.subject || 'Untitled Subtask'}</span>
                    </div>
                </div>
                <div class="pm-subtask-col pm-subtask-col-owner">
                    <div class="pm-subtask-owner-cell"
                         data-editable="true"
                         data-field="custom_roles"
                         data-task-id="${subtask.name}"
                         data-field-type="person_selector"
                         data-role-filter="Owner">
                        ${this.renderOwnerCell(subtask)}
                    </div>
                </div>
                <div class="pm-subtask-col pm-subtask-col-status">
                    <div class="pm-subtask-status-cell"
                         data-editable="true"
                         data-field="custom_task_status"
                         data-task-id="${subtask.name}"
                         data-field-type="select"
                         data-options-source="custom_task_status">
                        <span class="pm-status-badge status-${(subtask.custom_task_status || subtask.status || 'Not Started').toLowerCase().replace(/\s+/g, '-')}">${subtask.custom_task_status || subtask.status || 'Not Started'}</span>
                    </div>
                </div>
                <div class="pm-subtask-col pm-subtask-col-due">
                    <div class="pm-subtask-due-cell"
                         data-editable="true"
                         data-field="custom_due_date"
                         data-task-id="${subtask.name}"
                         data-field-type="date">
                        <span class="editable-field">${subtask.custom_due_date || '-'}</span>
                    </div>
                </div>
                <div class="pm-subtask-col pm-subtask-col-note">
                    <div class="pm-subtask-note-cell"
                         data-editable="true"
                         data-field="custom_note"
                         data-task-id="${subtask.name}"
                         data-field-type="text">
                        <span class="pm-subtask-note editable-field">${subtask.note || '-'}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // Render owner cell based on Task Role Assignment with Owner role
    renderOwnerCell(subtask) {
        // Look for users with "Owner" role in role assignments
        if (subtask.role_assignments && subtask.role_assignments.length > 0) {
            const owners = subtask.role_assignments.filter(assignment => assignment.role === 'Owner');
            
            if (owners.length === 1) {
                const owner = owners[0];
                return `
                    <div class="pm-user-avatars">
                        <div class="pm-avatar pm-primary-user" title="${owner.full_name}" data-email="${owner.email}">
                            ${owner.initials}
                        </div>
                    </div>
                `;
            } else if (owners.length > 1) {
                const primaryOwner = owners[0];
                return `
                    <div class="pm-user-avatars">
                        <div class="pm-avatar pm-primary-user" title="${primaryOwner.full_name}" data-email="${primaryOwner.email}">
                            ${primaryOwner.initials}
                        </div>
                        <div class="pm-avatar-more" title="Total ${owners.length} owners">
                            +${owners.length - 1}
                        </div>
                    </div>
                `;
            }
        }
        
        return `
            <div class="pm-user-avatars pm-empty-person">
                <div class="pm-avatar pm-empty-avatar">
                    <i class="fa fa-user"></i>
                </div>
            </div>
        `;
    }

    // Render inline add subtask row (similar to main task add row)
    renderAddSubtaskRow(parentTaskId) {
        return `
            <div class="pm-subtask-item pm-add-subtask-item pm-subtask-row" data-parent-task="${parentTaskId}">
                <div class="pm-subtask-col pm-subtask-col-name">
                    <div class="pm-subtask-name-cell">
                        <div class="pm-subtask-checkbox">
                            <div class="pm-subtask-placeholder-checkbox"></div>
                        </div>
                        <div class="pm-add-subtask-content">
                            <button class="pm-add-subtask-btn-inline" data-parent-task="${parentTaskId}">
                                <i class="fa fa-plus"></i>
                                <span>Add subtask</span>
                            </button>
                        </div>
                    </div>
                </div>
                <div class="pm-subtask-col pm-subtask-col-owner">
                    <!-- Empty for alignment -->
                </div>
                <div class="pm-subtask-col pm-subtask-col-status">
                    <!-- Empty for alignment -->
                </div>
                <div class="pm-subtask-col pm-subtask-col-due">
                    <!-- Empty for alignment -->
                </div>
                <div class="pm-subtask-col pm-subtask-col-note">
                    <!-- Empty for alignment -->
                </div>
            </div>
        `;
    }

    bindSubtaskEvents(parentTaskId) {
        const $container = $(`.pm-subtask-container[data-parent-task="${parentTaskId}"]`);

        // Inline add subtask button
        $container.find('.pm-add-subtask-btn-inline').on('click', (e) => {
            e.stopPropagation();
            this.showInlineSubtaskEditor(parentTaskId);
        });

        // Subtask checkbox change
        $container.on('change', '.pm-subtask-checkbox input', async (e) => {
            const subtaskId = $(e.target).closest('.pm-subtask-item').data('subtask-id');
            const isCompleted = $(e.target).is(':checked');
            
            // Get available status options dynamically
            let completedStatus = 'Completed';
            let notStartedStatus = 'Not Started';
            
            try {
                const response = await frappe.call({
                    method: 'smart_accounting.www.project_management.index.get_task_status_options'
                });
                
                if (response.message && response.message.success) {
                    const statusOptions = response.message.status_options;
                    // Try to find appropriate status values
                    const completedOption = statusOptions.find(s => s.toLowerCase().includes('completed') || s.toLowerCase().includes('lodged'));
                    const notStartedOption = statusOptions.find(s => s.toLowerCase().includes('not started') || s.toLowerCase() === 'open');
                    
                    if (completedOption) completedStatus = completedOption;
                    if (notStartedOption) notStartedStatus = notStartedOption;
                }
            } catch (error) {
                console.warn('Could not load status options, using defaults');
            }
            
            this.updateSubtaskStatus(subtaskId, isCompleted ? completedStatus : notStartedStatus);
        });

        // Bind editable field events for subtasks - use main editing system
        $container.on('click', '[data-editable="true"]', (e) => {
            e.stopPropagation();
            const $cell = $(e.currentTarget);
            
            // Direct delegation to main editing system
            if (window.EditorsManager && window.EditorsManager.startFieldEditing) {
                window.EditorsManager.startFieldEditing($cell[0]);
            } else {
                console.error('EditorsManager not available');
                frappe.show_alert({
                    message: 'Editor not available',
                    indicator: 'red'
                });
            }
        });

        // Subtask actions (if we add them back later)
        $container.on('click', '.pm-subtask-action', (e) => {
            e.stopPropagation();
            const action = $(e.currentTarget).data('action');
            const subtaskId = $(e.currentTarget).data('subtask-id');
            
            if (action === 'edit') {
                this.editSubtask(subtaskId);
            } else if (action === 'delete') {
                this.deleteSubtask(subtaskId, parentTaskId);
            }
        });
    }

    // Show inline subtask editor (similar to main task inline editing)
    showInlineSubtaskEditor(parentTaskId) {
        const $addRow = $(`.pm-add-subtask-item[data-parent-task="${parentTaskId}"]`);
        const $addContent = $addRow.find('.pm-add-subtask-content');
        
        // Create inline editor
        const editorHTML = `
            <div class="pm-subtask-inline-editor">
                <input type="text" class="pm-subtask-name-input" placeholder="Enter subtask name..." maxlength="140">
                <div class="pm-subtask-editor-actions">
                    <button class="pm-subtask-save-btn" title="Save subtask">
                        <i class="fa fa-check"></i>
                    </button>
                    <button class="pm-subtask-cancel-btn" title="Cancel">
                        <i class="fa fa-times"></i>
                    </button>
                </div>
            </div>
        `;
        
        // Replace add button with editor
        $addContent.html(editorHTML);
        
        // Focus on input
        const $input = $addContent.find('.pm-subtask-name-input');
        $input.focus();
        
        // Bind editor events
        this.bindInlineEditorEvents(parentTaskId, $addContent);
    }

    bindInlineEditorEvents(parentTaskId, $editorContainer) {
        const $input = $editorContainer.find('.pm-subtask-name-input');
        const $saveBtn = $editorContainer.find('.pm-subtask-save-btn');
        const $cancelBtn = $editorContainer.find('.pm-subtask-cancel-btn');
        
        // Save on Enter key
        $input.on('keypress', (e) => {
            if (e.which === 13) { // Enter key
                e.preventDefault();
                this.saveInlineSubtask(parentTaskId, $input.val().trim());
            }
        });
        
        // Cancel on Escape key
        $input.on('keydown', (e) => {
            if (e.which === 27) { // Escape key
                e.preventDefault();
                this.cancelInlineSubtaskEditor(parentTaskId);
            }
        });
        
        // Save button click
        $saveBtn.on('click', (e) => {
            e.stopPropagation();
            this.saveInlineSubtask(parentTaskId, $input.val().trim());
        });
        
        // Cancel button click
        $cancelBtn.on('click', (e) => {
            e.stopPropagation();
            this.cancelInlineSubtaskEditor(parentTaskId);
        });
        
        // Cancel on blur (click outside)
        $input.on('blur', (e) => {
            // Small delay to allow button clicks to register
            setTimeout(() => {
                if (!$editorContainer.find(':focus').length) {
                    this.cancelInlineSubtaskEditor(parentTaskId);
                }
            }, 150);
        });
    }

    async saveInlineSubtask(parentTaskId, subtaskName) {
        if (!subtaskName) {
            this.cancelInlineSubtaskEditor(parentTaskId);
            return;
        }

        try {
            // Show loading state
            const $addRow = $(`.pm-add-subtask-item[data-parent-task="${parentTaskId}"]`);
            $addRow.find('.pm-subtask-inline-editor').html(`
                <div class="pm-subtask-saving">
                    <i class="fa fa-spinner fa-spin"></i>
                    <span>Creating subtask...</span>
                </div>
            `);

            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.create_subtask',
                args: { 
                    parent_task_id: parentTaskId,
                    subtask_name: subtaskName
                }
            });

            if (response.message && response.message.success) {
                // Refresh subtasks display
                await this.refreshSubtasks(parentTaskId);
                
                frappe.show_alert({
                    message: 'Subtask created successfully',
                    indicator: 'green'
                });

                // Update subtask count indicator
                this.updateSubtaskCount(parentTaskId);

            } else {
                throw new Error(response.message?.error || 'Failed to create subtask');
            }

        } catch (error) {
            console.error('Error creating subtask:', error);
            frappe.show_alert({
                message: 'Failed to create subtask: ' + error.message,
                indicator: 'red'
            });
            
            // Restore add button
            this.cancelInlineSubtaskEditor(parentTaskId);
        }
    }

    cancelInlineSubtaskEditor(parentTaskId) {
        const $addRow = $(`.pm-add-subtask-item[data-parent-task="${parentTaskId}"]`);
        const $addContent = $addRow.find('.pm-add-subtask-content');
        
        // Restore original add button
        $addContent.html(`
            <button class="pm-add-subtask-btn-inline" data-parent-task="${parentTaskId}">
                <i class="fa fa-plus"></i>
                <span>Add subtask</span>
            </button>
        `);
        
        // Re-bind click event
        $addContent.find('.pm-add-subtask-btn-inline').on('click', (e) => {
            e.stopPropagation();
            this.showInlineSubtaskEditor(parentTaskId);
        });
    }

    // Status selector for subtasks
    async showStatusSelector($cell, taskId, field) {
        // Prevent multiple editing
        if ($cell.hasClass('editing')) return;
        
        const currentStatus = $cell.find('.pm-status-badge').text().trim();
        
        // Mark as editing
        $cell.addClass('editing');
        $cell.closest('.pm-subtask-item').addClass('editing');
        
        // Get status options from backend (same as main tasks)
        let statusOptions = [];
        try {
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.get_task_status_options'
            });
            
            if (response.message && response.message.success) {
                statusOptions = response.message.status_options.map(status => ({
                    value: status,
                    label: status,
                    class: `status-${status.toLowerCase().replace(/\s+/g, '-')}`
                }));
            }
        } catch (error) {
            console.warn('Failed to load status options, using fallback');
        }
        
        // Fallback options if API fails - use minimal fallback
        if (statusOptions.length === 0) {
            console.warn('No status options available from API, using minimal fallback');
            statusOptions = [
                { value: 'Open', label: 'Open', class: 'status-open' },
                { value: 'Completed', label: 'Completed', class: 'status-completed' }
            ];
        }
        
        // Create status selector
        const selectHTML = `
            <select class="pm-status-select">
                ${statusOptions.map(option => `
                    <option value="${option.value}" ${option.value === currentStatus ? 'selected' : ''}>
                        ${option.label}
                    </option>
                `).join('')}
            </select>
        `;
        
        // Replace content with selector
        $cell.html(selectHTML);
        
        const $select = $cell.find('.pm-status-select');
        $select.focus();
        
        // Handle selection
        $select.on('change blur', async (e) => {
            const newStatus = $select.val();
            
            try {
                // Save the change
                await this.saveFieldChange(taskId, field, newStatus);
                
                // Update display
                const statusOption = statusOptions.find(opt => opt.value === newStatus);
                $cell.html(`<span class="pm-status-badge ${statusOption.class}">${statusOption.label}</span>`);
                
                frappe.show_alert({
                    message: 'Status updated successfully',
                    indicator: 'green'
                });
                
            } catch (error) {
                console.error('Error updating status:', error);
                frappe.show_alert({
                    message: 'Failed to update status',
                    indicator: 'red'
                });
                
                // Restore original
                $cell.html(`<span class="pm-status-badge status-${currentStatus.toLowerCase()}">${currentStatus}</span>`);
            }
            
            // Remove editing state
            $cell.removeClass('editing');
            $cell.closest('.pm-subtask-item').removeClass('editing');
        });
        
        // Handle escape key
        $select.on('keydown', (e) => {
            if (e.which === 27) { // Escape
                // Restore original
                $cell.html(`<span class="pm-status-badge status-${currentStatus.toLowerCase()}">${currentStatus}</span>`);
                $cell.removeClass('editing');
                $cell.closest('.pm-subtask-item').removeClass('editing');
            }
        });
    }

    // Generic field save method for subtasks
    async saveFieldChange(taskId, field, newValue) {
        const response = await frappe.call({
            method: 'smart_accounting.www.project_management.index.update_task_field',
            args: {
                task_id: taskId,
                field_name: field,
                new_value: newValue
            }
        });

        if (!response.message || !response.message.success) {
            throw new Error(response.message?.error || 'Failed to save field change');
        }

        return response.message;
    }

    async addSubtask(parentTaskId) {
        try {
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.create_subtask',
                args: { parent_task_id: parentTaskId }
            });

            if (response.message && response.message.success) {
                // Refresh subtasks display
                await this.refreshSubtasks(parentTaskId);
                
                frappe.show_alert({
                    message: 'Subtask created successfully',
                    indicator: 'green'
                });

                // Update subtask count indicator
                this.updateSubtaskCount(parentTaskId);

            } else {
                throw new Error(response.message?.error || 'Failed to create subtask');
            }

        } catch (error) {
            console.error('Error creating subtask:', error);
            frappe.show_alert({
                message: 'Failed to create subtask: ' + error.message,
                indicator: 'red'
            });
        }
    }

    async refreshSubtasks(parentTaskId) {
        try {
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.get_subtasks',
                args: { parent_task_id: parentTaskId }
            });

            if (response.message && response.message.success) {
                const subtasks = response.message.subtasks || [];
                
                // Update subtask list - include both subtasks and add row
                const $container = $(`.pm-subtask-container[data-parent-task="${parentTaskId}"]`);
                const $list = $container.find('.pm-subtask-list');
                $list.html(this.renderSubtaskList(subtasks, parentTaskId) + this.renderAddSubtaskRow(parentTaskId));

                // Update header count
                $container.find('.pm-subtask-title').html(`
                    <i class="fa fa-tasks"></i>
                    Subtasks (${subtasks.length})
                `);
                
                // Re-bind events for new content
                this.bindSubtaskEvents(parentTaskId);
                
                // Re-apply column widths
                this.applySubtaskColumnWidths();
            }

        } catch (error) {
            console.error('Error refreshing subtasks:', error);
        }
    }

    async updateSubtaskStatus(subtaskId, newStatus) {
        try {
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.update_task_status',
                args: {
                    task_id: subtaskId,
                    new_status: newStatus
                }
            });

            if (response.message && response.message.success) {
                // Update status display
                const $item = $(`.pm-subtask-item[data-subtask-id="${subtaskId}"]`);
                const $status = $item.find('.pm-subtask-status');
                $status.removeClass().addClass(`pm-subtask-status status-${newStatus.toLowerCase()}`).text(newStatus);

                frappe.show_alert({
                    message: 'Subtask status updated',
                    indicator: 'green'
                });
            }

        } catch (error) {
            console.error('Error updating subtask status:', error);
            frappe.show_alert({
                message: 'Failed to update subtask status',
                indicator: 'red'
            });
        }
    }

    editSubtask(subtaskId) {
        // For now, just open the task in ERPNext
        window.open(`/app/task/${subtaskId}`, '_blank');
    }

    async deleteSubtask(subtaskId, parentTaskId) {
        const confirmed = await this.utils.showConfirmDialog(
            'Delete Subtask',
            'Are you sure you want to delete this subtask? This action cannot be undone.'
        );

        if (!confirmed) return;

        try {
            const response = await frappe.call({
                method: 'frappe.client.delete',
                args: {
                    doctype: 'Task',
                    name: subtaskId
                }
            });

            // Refresh subtasks display
            await this.refreshSubtasks(parentTaskId);
            
            frappe.show_alert({
                message: 'Subtask deleted',
                indicator: 'orange'
            });

            // Update subtask count
            this.updateSubtaskCount(parentTaskId);

        } catch (error) {
            console.error('Error deleting subtask:', error);
            frappe.show_alert({
                message: 'Failed to delete subtask',
                indicator: 'red'
            });
        }
    }

    updateSubtaskCount(parentTaskId) {
        // This could update a badge showing subtask count on the parent task
        // For now, just update the toggle button to indicate there are subtasks
        const $toggleBtn = $(`.pm-subtask-toggle[data-task-id="${parentTaskId}"]`);
        $toggleBtn.addClass('has-subtasks');
    }

    // Load subtask counts for all tasks on page load
    async loadSubtaskCounts() {
        const taskIds = [];
        $('.pm-task-row[data-task-id]').each(function() {
            const taskId = $(this).data('task-id');
            if (taskId) {
                taskIds.push(taskId);
            }
        });

        if (taskIds.length === 0) return;

        try {
            // Get subtask counts for all tasks
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.get_bulk_subtask_counts',
                args: { task_ids: taskIds }
            });

            if (response.message && response.message.success) {
                const subtaskCounts = response.message.subtask_counts;
                
                // Update each task's subtask indicator
                Object.keys(subtaskCounts).forEach(taskId => {
                    const count = subtaskCounts[taskId];
                    this.updateSubtaskIndicator(taskId, count);
                });
            }
        } catch (error) {
            console.warn('Could not load subtask counts:', error);
        }
    }

    updateSubtaskIndicator(taskId, count) {
        const $toggleBtn = $(`.pm-subtask-toggle[data-task-id="${taskId}"]`);
        
        if (count > 0) {
            $toggleBtn.addClass('has-subtasks');
            $toggleBtn.attr('title', `Show/hide ${count} subtask${count !== 1 ? 's' : ''}`);
        } else {
            $toggleBtn.removeClass('has-subtasks');
            $toggleBtn.attr('title', 'No subtasks');
        }
    }

    // ===== SUBTASK COLUMN MANAGEMENT =====

    // Load subtask column widths from server
    async loadSubtaskColumnWidths() {
        return new Promise((resolve) => {
            frappe.call({
                method: 'smart_accounting.www.project_management.index.load_user_column_widths',
                args: { column_type: 'subtasks' },
                callback: (r) => {
                    if (r.message && r.message.success) {
                        this.columnWidths = r.message.column_widths;
                        console.log('✅ Loaded subtask column widths:', this.columnWidths);
                    } else {
                        // Use default widths
                        this.columnWidths = this.getDefaultSubtaskColumnWidths();
                        console.log('✅ Using default subtask column widths:', this.columnWidths);
                    }
                    resolve();
                },
                error: () => {
                    this.columnWidths = this.getDefaultSubtaskColumnWidths();
                    resolve();
                }
            });
        });
    }

    // Get default subtask column widths
    getDefaultSubtaskColumnWidths() {
        return {
            'name': 250,      // Task Name column
            'owner': 120,     // Owner column
            'status': 100,    // Status column  
            'due': 120,       // Due Date column
            'note': 180       // Note column
        };
    }

    // Apply subtask column widths to all subtask tables
    applySubtaskColumnWidths() {
        Object.keys(this.columnWidths).forEach(column => {
            this.setSubtaskColumnWidth(column, this.columnWidths[column]);
        });
    }

    // Set width for a specific subtask column
    setSubtaskColumnWidth(column, width) {
        const minWidth = Math.max(width, 50);
        
        // Update column widths in all subtask tables
        $(`.pm-subtask-col-${column}`).css({
            'width': `${minWidth}px`,
            'min-width': `${minWidth}px`,
            'max-width': `${minWidth}px`
        });
        
        // Store the new width
        this.columnWidths[column] = minWidth;
    }

    // Save subtask column widths to server
    saveSubtaskColumnWidths() {
        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => {
            frappe.call({
                method: 'smart_accounting.www.project_management.index.save_user_column_widths',
                args: {
                    column_widths: this.columnWidths,
                    column_type: 'subtasks'
                },
                callback: (r) => {
                    if (r.message && r.message.success) {
                        console.log('✅ Subtask column widths saved to server');
                    } else {
                        console.warn('Failed to save subtask column widths to server');
                    }
                }
            });
        }, 300);
    }

    // Initialize subtask column resizing
    initializeSubtaskColumnResizing() {
        // Apply initial widths
        this.applySubtaskColumnWidths();
        
        // Add resize handles to subtask headers (will be added when subtasks are rendered)
        $(document).on('mousedown', '.pm-subtask-col-resizer', (e) => {
            e.preventDefault();
            this.startSubtaskColumnResize(e);
        });
    }

    // Start subtask column resize
    startSubtaskColumnResize(e) {
        const $resizer = $(e.currentTarget);
        const $column = $resizer.parent();
        const columnType = $column.data('column');
        const startX = e.pageX;
        const startWidth = $column.width();
        
        // Add resizing class
        $('body').addClass('pm-resizing-subtask-column');
        
        // Mouse move handler
        const mouseMoveHandler = (e) => {
            const diff = e.pageX - startX;
            const newWidth = Math.max(startWidth + diff, 50);
            this.setSubtaskColumnWidth(columnType, newWidth);
        };
        
        // Mouse up handler
        const mouseUpHandler = () => {
            $('body').removeClass('pm-resizing-subtask-column');
            $(document).off('mousemove', mouseMoveHandler);
            $(document).off('mouseup', mouseUpHandler);
            
            // Save the new widths
            this.saveSubtaskColumnWidths();
        };
        
        // Bind events
        $(document).on('mousemove', mouseMoveHandler);
        $(document).on('mouseup', mouseUpHandler);
    }
}

// Create global instance - avoid duplicate declaration
if (!window.SubtaskManager) {
    window.SubtaskManager = new SubtaskManager();
}

// Export for module systems if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SubtaskManager;
}
