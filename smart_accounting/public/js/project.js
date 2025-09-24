// Project Management - Project and Task Management
// Core project and task management logic

class ProjectManager {
    constructor() {
        this.utils = window.PMUtils;
        this.statusOptions = ['Open', 'Working', 'Completed', 'Cancelled'];
    }

    // Project expand/collapse
    toggleProject(projectHeader) {
        const $header = $(projectHeader);
        const $group = $header.parent();
        const $tasks = $group.find('.pm-task-group');
        const $icon = $header.find('.pm-expand-icon');

        $tasks.slideToggle(300);
        $header.toggleClass('collapsed');
        
        if ($header.hasClass('collapsed')) {
            $icon.css('transform', 'rotate(-90deg)');
        } else {
            $icon.css('transform', 'rotate(0deg)');
        }
    }

    // Task creation
    async addNewTask(addTaskBtn) {
        const $addRow = $(addTaskBtn).closest('.pm-add-task-row');
        const projectName = $addRow.data('project');
        const clientName = $addRow.data('client');
        
        try {
            // Show loading
            $(addTaskBtn).html('<i class="fa fa-spinner fa-spin"></i> Creating...');
            
            // Call backend to create new task
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.create_new_task',
                args: {
                    project_name: projectName,
                    client_name: clientName
                }
            });
            
            if (response.message && response.message.success) {
                // Show success message
                frappe.show_alert({
                    message: 'New task created successfully',
                    indicator: 'green'
                });
                
                // Create and insert new task row dynamically
                this.insertNewTaskRow(addTaskBtn, response.message);
                
            } else {
                throw new Error(response.message?.error || 'Failed to create task');
            }
        } catch (error) {
            console.error('Add task error:', error);
            
            // Restore button
            $(addTaskBtn).html('<i class="fa fa-plus"></i><span>Add new task</span>');
            
            frappe.show_alert({
                message: 'Failed to create new task: ' + error.message,
                indicator: 'red'
            });
        }
    }

    insertNewTaskRow(addTaskBtn, taskData) {
        const $addRow = $(addTaskBtn).closest('.pm-add-task-row');
        const projectName = $addRow.data('project');
        const clientName = $addRow.data('client');
        
        // Get current column widths and generate HTML
        const currentWidths = window.TableManager ? window.TableManager.getCurrentColumnWidths() : {};
        const totalWidth = Object.values(currentWidths).reduce((sum, width) => sum + width, 0);
        const newTaskRowHTML = this.generateNewTaskRowHTML(taskData, clientName, currentWidths, totalWidth);
        
        // Insert the new row before the add task row
        $addRow.before(newTaskRowHTML);
        
        // Restore the add task button
        $(addTaskBtn).html('<i class="fa fa-plus"></i><span>Add new task</span>');
        
        // Add a subtle animation to highlight the new row
        const $newRow = $addRow.prev();
        $newRow.css('background-color', '#e8f5e8');
        
        setTimeout(() => {
            $newRow.css('background-color', '');
        }, 2000);
    }

    generateNewTaskRowHTML(taskData, clientName, currentWidths, totalWidth, additionalClasses = '') {
        // Generate new task row HTML with current column widths
        return `
            <div class="pm-task-row ${additionalClasses}" data-task-id="${taskData.task_id}" data-task-name="${taskData.task_subject}" style="display: flex; width: 2000px; min-width: 2000px;">
                <div class="pm-cell pm-cell-client pm-client-with-comments" style="width: ${currentWidths.client || 150}px; min-width: ${currentWidths.client || 150}px; flex: 0 0 ${currentWidths.client || 150}px;" data-editable="true" data-field="custom_client" data-task-id="${taskData.task_id}" data-field-type="client_selector" data-current-client-id="" data-current-client-name="${clientName || 'No Client'}">
                    <div class="pm-client-content">
                        <span class="editable-field client-display">${clientName || 'No Client'}</span>
                    </div>
                    <div class="pm-client-comments">
                        <div class="pm-comment-indicator" data-task-id="${taskData.task_id}">
                            <i class="fa fa-comment-o"></i>
                            <span class="pm-comment-count">0</span>
                        </div>
                    </div>
                </div>
                <div class="pm-cell pm-cell-task-name pm-editable-task-name" style="width: ${currentWidths['task-name'] || 120}px; min-width: ${currentWidths['task-name'] || 120}px; flex: 0 0 ${currentWidths['task-name'] || 120}px;" data-editable="true" data-field="subject" data-task-id="${taskData.task_id}" data-field-type="task_name_editor" data-current-task-name="${taskData.task_subject || ''}">
                    <div class="pm-task-name-content">
                        <span class="editable-field task-name-display">${taskData.task_subject || 'Untitled Task'}</span>
                        <i class="fa fa-edit pm-edit-icon"></i>
                    </div>
                </div>
                <div class="pm-cell pm-cell-engagement pm-engagement-indicator" style="width: ${currentWidths.engagement || 120}px; min-width: ${currentWidths.engagement || 120}px; flex: 0 0 ${currentWidths.engagement || 120}px;" data-task-id="${taskData.task_id}" data-current-engagement="">
                    <div class="pm-engagement-content">
                        <span class="pm-engagement-display no-engagement">No engagement</span>
                    </div>
                </div>
                <div class="pm-cell pm-cell-entity" style="width: ${currentWidths.entity || 100}px; min-width: ${currentWidths.entity || 100}px; flex: 0 0 ${currentWidths.entity || 100}px;">
                    <span class="pm-entity-badge entity-company">Company</span>
                </div>
                <div class="pm-cell pm-cell-tf-tg" style="width: ${currentWidths['tf-tg'] || 80}px; min-width: ${currentWidths['tf-tg'] || 80}px; flex: 0 0 ${currentWidths['tf-tg'] || 80}px;" data-editable="true" data-field="custom_tftg" data-task-id="${taskData.task_id}" data-field-type="select" data-options="TF,TG" data-backend-options="Top Figures,Top Grants">
                    <span class="pm-tf-tg-badge editable-field">TF</span>
                </div>
                <div class="pm-cell pm-cell-software" style="width: ${currentWidths.software || 120}px; min-width: ${currentWidths.software || 120}px; flex: 0 0 ${currentWidths.software || 120}px;" data-editable="true" data-field="custom_softwares" data-task-id="${taskData.task_id}" data-field-type="software_selector">
                    <div class="pm-software-tags pm-empty-software">
                        <span class="pm-software-badge pm-empty-badge">
                            <i class="fa fa-plus"></i>
                            Add software
                        </span>
                    </div>
                </div>
                <div class="pm-cell pm-cell-status" style="width: ${currentWidths.status || 100}px; min-width: ${currentWidths.status || 100}px; flex: 0 0 ${currentWidths.status || 100}px;">
                    <span class="pm-status-badge status-open">Open</span>
                </div>
                <div class="pm-cell pm-cell-target-month" style="width: ${currentWidths['target-month'] || 120}px; min-width: ${currentWidths['target-month'] || 120}px; flex: 0 0 ${currentWidths['target-month'] || 120}px;" data-editable="true" data-field="custom_target_month" data-task-id="${taskData.task_id}" data-field-type="select" data-options="January,February,March,April,May,June,July,August,September,October,November,December">
                    <span class="editable-field">-</span>
                </div>
                <div class="pm-cell pm-cell-budget" style="width: ${currentWidths.budget || 120}px; min-width: ${currentWidths.budget || 120}px; flex: 0 0 ${currentWidths.budget || 120}px;" data-editable="true" data-field="custom_budget_planning" data-task-id="${taskData.task_id}" data-field-type="currency">
                    <span class="pm-no-amount editable-field">-</span>
                </div>
                <div class="pm-cell pm-cell-actual" style="width: ${currentWidths.actual || 120}px; min-width: ${currentWidths.actual || 120}px; flex: 0 0 ${currentWidths.actual || 120}px;" data-editable="true" data-field="custom_actual_billing" data-task-id="${taskData.task_id}" data-field-type="currency">
                    <span class="pm-no-amount editable-field">-</span>
                </div>
                <div class="pm-cell pm-cell-review-note" style="width: ${currentWidths['review-note'] || 120}px; min-width: ${currentWidths['review-note'] || 120}px; flex: 0 0 ${currentWidths['review-note'] || 120}px;">
                    ${taskData.review_notes && taskData.review_notes.length > 0 ? `
                        <div class="pm-review-note-indicator has-notes" data-task-id="${taskData.task_id}" title="点击查看所有Review Notes">
                            <i class="fa fa-check-circle"></i>
                            <span>${taskData.review_notes.length} note${taskData.review_notes.length !== 1 ? 's' : ''}</span>
                        </div>
                    ` : `
                        <div class="pm-review-note-indicator no-notes" data-task-id="${taskData.task_id}">
                            <i class="fa fa-times-circle"></i>
                            <span>none</span>
                        </div>
                    `}
                </div>
                <div class="pm-cell pm-cell-action-person" style="width: ${currentWidths['action-person'] || 130}px; min-width: ${currentWidths['action-person'] || 130}px; flex: 0 0 ${currentWidths['action-person'] || 130}px;" data-editable="true" data-field="custom_action_person" data-task-id="${taskData.task_id}" data-field-type="person_selector">
                    <div class="pm-user-avatars pm-empty-person">
                        <div class="pm-avatar pm-empty-avatar">
                            <i class="fa fa-user"></i>
                        </div>
                    </div>
                </div>
                <div class="pm-cell pm-cell-preparer" style="width: ${currentWidths.preparer || 120}px; min-width: ${currentWidths.preparer || 120}px; flex: 0 0 ${currentWidths.preparer || 120}px;" data-editable="true" data-field="custom_preparer" data-task-id="${taskData.task_id}" data-field-type="person_selector">
                    <div class="pm-user-avatars pm-empty-person">
                        <div class="pm-avatar pm-empty-avatar">
                            <i class="fa fa-user"></i>
                        </div>
                    </div>
                </div>
                <div class="pm-cell pm-cell-reviewer" style="width: ${currentWidths.reviewer || 120}px; min-width: ${currentWidths.reviewer || 120}px; flex: 0 0 ${currentWidths.reviewer || 120}px;" data-editable="true" data-field="custom_reviewer" data-task-id="${taskData.task_id}" data-field-type="person_selector">
                    <div class="pm-user-avatars pm-empty-person">
                        <div class="pm-avatar pm-empty-avatar">
                            <i class="fa fa-user"></i>
                        </div>
                    </div>
                </div>
                <div class="pm-cell pm-cell-partner" style="width: ${currentWidths.partner || 120}px; min-width: ${currentWidths.partner || 120}px; flex: 0 0 ${currentWidths.partner || 120}px;" data-editable="true" data-field="custom_partner" data-task-id="${taskData.task_id}" data-field-type="person_selector">
                    <div class="pm-user-avatars pm-empty-person">
                        <div class="pm-avatar pm-empty-avatar">
                            <i class="fa fa-user"></i>
                        </div>
                    </div>
                </div>
                <div class="pm-cell pm-cell-lodgment-due" style="width: ${currentWidths['lodgment-due'] || 130}px; min-width: ${currentWidths['lodgment-due'] || 130}px; flex: 0 0 ${currentWidths['lodgment-due'] || 130}px;">
                    <span class="pm-no-date">-</span>
                </div>
                <div class="pm-cell pm-cell-year-end" style="width: ${currentWidths['year-end'] || 100}px; min-width: ${currentWidths['year-end'] || 100}px; flex: 0 0 ${currentWidths['year-end'] || 100}px;">-</div>
                <div class="pm-cell pm-cell-last-updated" style="width: ${currentWidths['last-updated'] || 130}px; min-width: ${currentWidths['last-updated'] || 130}px; flex: 0 0 ${currentWidths['last-updated'] || 130}px;">
                    <span class="pm-last-updated">Just now</span>
                </div>
                <div class="pm-cell pm-cell-priority" style="width: ${currentWidths.priority || 100}px; min-width: ${currentWidths.priority || 100}px; flex: 0 0 ${currentWidths.priority || 100}px;">
                    <span class="pm-priority-badge priority-medium">Medium</span>
                </div>
            </div>
        `;
    }

    async quickAddTask() {
        // Find the first project group
        const $firstProject = $('.pm-project-group').first();
        if ($firstProject.length === 0) {
            frappe.show_alert({
                message: 'No projects found. Please create a project first.',
                indicator: 'orange'
            });
            return;
        }
        
        const projectName = $firstProject.data('project');
        const clientName = $firstProject.data('client');
        
        try {
            // Show loading
            frappe.show_alert({
                message: 'Creating task...',
                indicator: 'blue'
            });
            
            // Create task using existing API
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.create_new_task',
                args: {
                    project_name: projectName,
                    client_name: clientName
                }
            });
            
            if (response.message && response.message.success) {
                // Insert new task at the top of the first project
                this.insertTaskAtTop($firstProject, response.message);
                
                frappe.show_alert({
                    message: 'Task created successfully',
                    indicator: 'green'
                });
            } else {
                throw new Error(response.message?.error || 'Failed to create task');
            }
        } catch (error) {
            console.error('Quick add task error:', error);
            frappe.show_alert({
                message: 'Failed to create task: ' + error.message,
                indicator: 'red'
            });
        }
    }

    insertTaskAtTop($projectGroup, taskData) {
        const projectName = $projectGroup.data('project');
        const clientName = $projectGroup.data('client');
        
        // Get current column widths and generate HTML
        const currentWidths = window.TableManager ? window.TableManager.getCurrentColumnWidths() : {};
        const totalWidth = Object.values(currentWidths).reduce((sum, width) => sum + width, 0);
        const newTaskRowHTML = this.generateNewTaskRowHTML(taskData, clientName, currentWidths, totalWidth, 'new-task-highlight');
        
        // Insert at the top of the project's task group
        const $taskGroup = $projectGroup.find('.pm-task-group');
        $taskGroup.prepend(newTaskRowHTML);
        
        // Scroll to the new task
        const $newRow = $taskGroup.find('.new-task-highlight');
        $newRow[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Highlight animation
        $newRow.css('background-color', '#e8f5e8');
        setTimeout(() => {
            $newRow.css('background-color', '').removeClass('new-task-highlight');
        }, 3000);
    }

    createNewProject() {
        // Navigate to ERPNext project creation
        frappe.show_alert({
            message: 'Redirecting to project creation...',
            indicator: 'blue'
        });
        
        setTimeout(() => {
            window.open('/app/project/new-project', '_blank');
        }, 500);
    }

    // Status management
    showStatusMenu(statusBadge) {
        const $badge = $(statusBadge);
        const taskId = $badge.closest('.pm-task-row').data('task-id');
        
        // Use dynamic status options with auto-assigned colors
        const colors = [
            'var(--monday-orange)',
            'var(--monday-blue)', 
            'var(--monday-green)',
            'var(--monday-red)',
            'var(--monday-purple)',
            'var(--monday-pink)',
            '#9333ea', // purple-600
            '#059669', // emerald-600
            '#dc2626', // red-600
            '#ea580c', // orange-600
            '#7c3aed', // violet-600
            '#0891b2'  // cyan-600
        ];
        
        const statusOptions = (this.statusOptions || ['Open', 'Working', 'Completed', 'Cancelled']).map((status, index) => ({
            value: status,
            label: status,
            color: colors[index % colors.length]
        }));

        this.showContextMenu($badge, statusOptions, (newStatus) => {
            this.updateTaskStatus(taskId, newStatus);
        });
    }

    showPriorityMenu(priorityBadge) {
        const $badge = $(priorityBadge);
        
        const priorityOptions = [
            { value: 'High', label: 'High', color: 'var(--monday-red)' },
            { value: 'Medium', label: 'Medium', color: 'var(--monday-orange)' },
            { value: 'Low', label: 'Low', color: 'var(--monday-blue)' }
        ];

        this.showContextMenu($badge, priorityOptions, (newPriority) => {
            $badge.removeClass('priority-high priority-medium priority-low')
                  .addClass(`priority-${newPriority.toLowerCase()}`)
                  .text(newPriority);
        });
    }

    showContextMenu($trigger, options, callback) {
        // Remove existing menus
        $('.pm-context-menu').remove();

        const menu = $(`
            <div class="pm-context-menu">
                ${options.map(option => `
                    <div class="pm-menu-item" data-value="${option.value}">
                        <span class="pm-menu-color" style="background: ${option.color}"></span>
                        ${option.label}
                    </div>
                `).join('')}
            </div>
        `);

        // Position menu
        const offset = $trigger.offset();
        menu.css({
            position: 'absolute',
            top: offset.top + $trigger.outerHeight() + 5,
            left: offset.left,
            zIndex: 1000
        });

        $('body').append(menu);

        // Handle menu clicks
        menu.on('click', '.pm-menu-item', function() {
            const value = $(this).data('value');
            callback(value);
            menu.remove();
        });

        // Close menu on outside click
        setTimeout(() => {
            $(document).one('click', () => menu.remove());
        }, 100);
    }

    async updateTaskStatus(taskId, newStatus) {
        try {
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.update_task_status',
                args: {
                    task_id: taskId,
                    new_status: newStatus
                }
            });

            if (response.message && response.message.success) {
                // Update UI
                const $row = $(`.pm-task-row[data-task-id="${taskId}"]`);
                const $statusBadge = $row.find('.pm-status-badge');
                const $progressBar = $row.find('.pm-progress-fill');

                // Remove all existing status classes and add new one
                $statusBadge.attr('class', 'pm-status-badge')
                           .addClass(`status-${this.utils.getStatusClass(newStatus)}`)
                           .text(newStatus);
                
                // Apply dynamic color
                this.utils.applyStatusColor($statusBadge, newStatus);

                // Update progress bar
                let progress = 0;
                if (newStatus === 'Completed') progress = 100;
                else if (newStatus === 'Working') progress = 50;
                
                $progressBar.css('width', `${progress}%`);

                frappe.show_alert({
                    message: 'Task status updated successfully',
                    indicator: 'green'
                });
            } else {
                frappe.show_alert({
                    message: 'Failed to update task status',
                    indicator: 'red'
                });
            }
        } catch (error) {
            console.error('Status update error:', error);
            frappe.show_alert({
                message: 'Error updating task status',
                indicator: 'red'
            });
        }
    }

    openTaskDetails(taskRow) {
        const taskId = $(taskRow).data('task-id');
        const taskName = $(taskRow).find('.pm-task-name').text();
        
        // For now, just show an alert. In the future, this could open a detailed task modal
        frappe.show_alert({
            message: `Opening details for: ${taskName}`,
            indicator: 'blue'
        });
    }

    // Load system options
    async loadSystemOptions() {
        try {
            // Load task status options
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.get_task_status_options'
            });
            
            if (response.message && response.message.success) {
                this.statusOptions = response.message.status_options;
                this.updateStatusFilters();
                // Apply colors to existing status badges on page load
                this.applyExistingStatusColors();
            }
        } catch (error) {
            console.warn('Failed to load system options:', error);
            // Use fallback options
            this.statusOptions = ['Open', 'Working', 'Completed', 'Cancelled'];
        }
    }

    updateStatusFilters() {
        // Update status filter dropdown in header
        const $statusList = $('.pm-status-list');
        $statusList.empty();
        
        this.statusOptions.forEach((status, index) => {
            const statusClass = this.utils.getStatusClass(status);
            $statusList.append(`
                <div class="pm-filter-option" data-status="${status}">
                    <div class="pm-status-dot status-${statusClass}"></div>
                    <span>${status}</span>
                </div>
            `);
        });
        
        // Generate dynamic CSS for new status colors
        this.generateStatusCSS();
    }

    generateStatusCSS() {
        // Remove existing dynamic status styles
        $('#dynamic-status-styles').remove();
        
        const colors = [
            'var(--monday-orange)',
            'var(--monday-blue)', 
            'var(--monday-green)',
            'var(--monday-red)',
            'var(--monday-purple)',
            'var(--monday-pink)',
            '#9333ea', '#059669', '#dc2626', '#ea580c', '#7c3aed', '#0891b2'
        ];
        
        let css = '<style id="dynamic-status-styles">';
        
        this.statusOptions.forEach((status, index) => {
            const statusClass = this.utils.getStatusClass(status);
            const color = colors[index % colors.length];
            
            css += `
                .pm-status-badge.status-${statusClass} {
                    background-color: ${color} !important;
                    color: white !important;
                }
                .pm-status-dot.status-${statusClass} {
                    background-color: ${color} !important;
                }
            `;
        });
        
        css += '</style>';
        $('head').append(css);
    }

    applyExistingStatusColors() {
        // Apply colors to all existing status badges on the page
        $('.pm-status-badge').each((i, badge) => {
            const $badge = $(badge);
            const status = $badge.text().trim();
            if (status && this.statusOptions.includes(status)) {
                this.utils.applyStatusColor($badge, status);
                // Also update CSS class
                $badge.addClass(`status-${this.utils.getStatusClass(status)}`);
            }
        });
    }

    async updateGroupDisplay(taskId, customerId) {
        try {
            // Get client group ID for this customer
            const response = await frappe.call({
                method: 'frappe.client.get_value',
                args: {
                    doctype: 'Customer',
                    name: customerId,
                    fieldname: 'custom_client_group'
                }
            });

            const clientGroupId = response.message?.custom_client_group || '';
            let clientGroupName = '';
            
            if (clientGroupId) {
                // Get the group name from Client Group DocType
                const groupResponse = await frappe.call({
                    method: 'frappe.client.get_value',
                    args: {
                        doctype: 'Client Group',
                        name: clientGroupId,
                        fieldname: 'group_name'
                    }
                });
                clientGroupName = groupResponse.message?.group_name || '';
            }
            
            // Update group cell display
            const $groupCell = $(`.pm-task-row[data-task-id="${taskId}"] .pm-cell-group`);
            if ($groupCell.length > 0) {
                $groupCell.html(`
                    <div class="pm-group-content">
                        <span class="pm-group-display">${clientGroupName || '-'}</span>
                    </div>
                `);
            }
        } catch (error) {
            console.error('Error updating group display:', error);
            // Silently fail - not critical
        }
    }
}

// Create global instance
window.ProjectManager = new ProjectManager();

// Export for module systems if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProjectManager;
}
