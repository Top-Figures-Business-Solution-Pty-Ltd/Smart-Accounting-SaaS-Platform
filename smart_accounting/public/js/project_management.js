// Project Management - Monday.com Style JavaScript

class ProjectManagement {
    constructor() {
        this.init();
    }

    init() {
        this.bindEvents();
        this.initializeFilters();
        this.setupSearch();
        this.initializeInlineEditing();
    }

    bindEvents() {
        // Project expand/collapse
        $(document).on('click', '.pm-project-header', (e) => {
            this.toggleProject(e.currentTarget);
        });

        // Tab switching
        $(document).on('click', '.pm-tab', (e) => {
            this.switchTab(e.currentTarget);
        });

        // Status badge click
        $(document).on('click', '.pm-status-badge', (e) => {
            this.showStatusMenu(e.currentTarget);
        });

        // Priority badge click
        $(document).on('click', '.pm-priority-badge', (e) => {
            this.showPriorityMenu(e.currentTarget);
        });

        // Task row click - Updated to handle editable fields
        $(document).on('click', '.pm-task-row', (e) => {
            // Don't open task details if clicking on editable fields or existing interactive elements
            if ($(e.target).hasClass('pm-status-badge') || 
                $(e.target).hasClass('pm-priority-badge') ||
                $(e.target).hasClass('editable-field') ||
                $(e.target).closest('[data-editable="true"]').length > 0) {
                return;
            }
            this.openTaskDetails(e.currentTarget);
        });

        // Add Task button click - Updated for simple button
        $(document).on('click', '.pm-add-task-btn', (e) => {
            e.stopPropagation();
            this.addNewTask(e.currentTarget);
        });
    }

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

    switchTab(tab) {
        $('.pm-tab').removeClass('active');
        $(tab).addClass('active');
        
        const view = $(tab).data('view');
        this.switchView(view);
    }

    switchView(view) {
        switch(view) {
            case 'main':
                this.showMainTable();
                break;
            case 'gantt':
                this.showGanttView();
                break;
            case 'calendar':
                this.showCalendarView();
                break;
        }
    }

    showMainTable() {
        $('.pm-table-container').show();
        // Hide other views if they exist
    }

    showGanttView() {
        this.showComingSoon('Gantt View');
    }

    showCalendarView() {
        this.showComingSoon('Calendar View');
    }

    showComingSoon(viewName) {
        const message = `
            <div class="pm-coming-soon">
                <i class="fa fa-clock-o"></i>
                <h3>${viewName} Coming Soon</h3>
                <p>This feature is under development</p>
            </div>
        `;
        $('.pm-table-container').html(message);
    }

    initializeFilters() {
        // Populate client filter
        const clients = new Set();
        $('.pm-task-row').each(function() {
            const client = $(this).find('.pm-cell-client').text().trim();
            if (client && client !== 'Unassigned') {
                clients.add(client);
            }
        });

        const $clientFilter = $('#client-filter');
        clients.forEach(client => {
            $clientFilter.append(`<option value="${client}">${client}</option>`);
        });

        // Bind filter events
        $('#client-filter, #status-filter').on('change', () => {
            this.applyFilters();
        });
    }

    setupSearch() {
        let searchTimeout;
        $('#pm-search-input').on('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.performSearch(e.target.value);
            }, 300);
        });
    }

    performSearch(query) {
        const searchTerm = query.toLowerCase().trim();
        
        if (!searchTerm) {
            $('.pm-project-group, .pm-task-row').show();
            return;
        }

        $('.pm-task-row').each(function() {
            const $row = $(this);
            const taskName = $row.find('.pm-task-name').text().toLowerCase();
            const client = $row.find('.pm-cell-client').text().toLowerCase();
            
            if (taskName.includes(searchTerm) || client.includes(searchTerm)) {
                $row.show();
                $row.closest('.pm-project-group').show();
            } else {
                $row.hide();
            }
        });

        // Hide empty project groups
        $('.pm-project-group').each(function() {
            const $group = $(this);
            const visibleTasks = $group.find('.pm-task-row:visible').length;
            if (visibleTasks === 0) {
                $group.hide();
            }
        });
    }

    applyFilters() {
        const clientFilter = $('#client-filter').val();
        const statusFilter = $('#status-filter').val();

        $('.pm-task-row').each(function() {
            const $row = $(this);
            const client = $row.find('.pm-cell-client').text().trim();
            const status = $row.find('.pm-status-badge').text().trim();

            let show = true;

            if (clientFilter && client !== clientFilter) {
                show = false;
            }

            if (statusFilter && status.toLowerCase() !== statusFilter.toLowerCase()) {
                show = false;
            }

            if (show) {
                $row.show();
                $row.closest('.pm-project-group').show();
            } else {
                $row.hide();
            }
        });

        // Hide empty project groups
        $('.pm-project-group').each(function() {
            const $group = $(this);
            const visibleTasks = $group.find('.pm-task-row:visible').length;
            if (visibleTasks === 0) {
                $group.hide();
            }
        });
    }

    showStatusMenu(statusBadge) {
        const $badge = $(statusBadge);
        const taskId = $badge.closest('.pm-task-row').data('task-id');
        
        const statusOptions = [
            { value: 'Open', label: 'Open', color: 'var(--monday-orange)' },
            { value: 'Working', label: 'Working', color: 'var(--monday-blue)' },
            { value: 'Completed', label: 'Completed', color: 'var(--monday-green)' },
            { value: 'Cancelled', label: 'Cancelled', color: 'var(--monday-red)' }
        ];

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

                $statusBadge.removeClass('status-open status-working status-completed status-cancelled')
                           .addClass(`status-${newStatus.toLowerCase()}`)
                           .text(newStatus);

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

    initializeInlineEditing() {
        console.log('Initializing inline editing...');
        
        // Bind click events for editable fields
        $(document).on('click', '[data-editable="true"]', (e) => {
            console.log('Editable field clicked:', e.currentTarget);
            e.stopPropagation();
            this.makeEditable(e.currentTarget);
        });

        // Also bind to editable-field class
        $(document).on('click', '.editable-field', (e) => {
            console.log('Editable field span clicked:', e.currentTarget);
            e.stopPropagation();
            const cell = $(e.currentTarget).closest('[data-editable="true"]')[0];
            if (cell) {
                this.makeEditable(cell);
            }
        });

        // Prevent row click when editing
        $(document).on('click', '.pm-task-row.editing', (e) => {
            e.stopPropagation();
        });
        
        console.log('Inline editing initialized. Found', $('[data-editable="true"]').length, 'editable fields');
    }

    makeEditable(cell) {
        const $cell = $(cell);
        
        // Prevent multiple editing
        if ($cell.hasClass('editing')) return;
        
        const taskId = $cell.data('task-id');
        const field = $cell.data('field');
        const fieldType = $cell.data('field-type');
        const currentValue = $cell.find('.editable-field').text().trim();
        
        // Mark as editing
        $cell.addClass('editing');
        $cell.closest('.pm-task-row').addClass('editing');
        
        // Create editor based on field type
        let editor;
        switch (fieldType) {
            case 'select':
                editor = this.createSelectEditor($cell, currentValue);
                break;
            case 'currency':
                editor = this.createCurrencyEditor($cell, currentValue);
                break;
            case 'text':
                editor = this.createTextEditor($cell, currentValue);
                break;
            default:
                editor = this.createTextEditor($cell, currentValue);
        }
        
        // Replace content with editor
        $cell.html(editor);
        
        // Focus the input
        const $input = $cell.find('input, select');
        $input.focus();
        
        // Handle save/cancel
        $input.on('blur keydown', (e) => {
            if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== 'Escape') return;
            
            if (e.key === 'Escape') {
                this.cancelEdit($cell, currentValue, fieldType);
            } else {
                let valueToSave = $input.val();
                
                // For select fields, get the backend value
                if (fieldType === 'select' && $input.is('select')) {
                    const selectedOption = $input.find('option:selected');
                    const backendValue = selectedOption.data('backend-value');
                    valueToSave = backendValue || valueToSave;
                }
                
                this.saveEdit($cell, taskId, field, valueToSave, fieldType);
            }
        });
    }

    createSelectEditor($cell, currentValue) {
        const displayOptions = $cell.data('options').split(','); // TF,TG
        const backendOptions = $cell.data('backend-options') ? $cell.data('backend-options').split(',') : displayOptions; // Top Figures,Top Grants
        
        // Find current selected option
        let selectedIndex = 0;
        if (currentValue === 'TG' || currentValue === 'Top Grants') {
            selectedIndex = 1;
        }
        
        let optionsHtml = displayOptions.map((displayText, index) => {
            const isSelected = index === selectedIndex;
            return `<option value="${displayText}" data-backend-value="${backendOptions[index] || displayText}" ${isSelected ? 'selected' : ''}>${displayText}</option>`;
        }).join('');
        
        return `<select class="pm-inline-select">${optionsHtml}</select>`;
    }

    createCurrencyEditor($cell, currentValue) {
        // Remove $ and convert to number
        const numValue = currentValue.replace(/[$,\s-]/g, '');
        return `<input type="number" class="pm-inline-input" value="${numValue}" step="0.01" min="0" placeholder="0.00">`;
    }

    createTextEditor($cell, currentValue) {
        const cleanValue = currentValue === '-' ? '' : currentValue;
        return `<input type="text" class="pm-inline-input" value="${cleanValue}" placeholder="Enter text">`;
    }

    async saveEdit($cell, taskId, field, newValue, fieldType) {
        try {
            // Show loading
            $cell.html('<i class="fa fa-spinner fa-spin"></i>');
            
            // Call backend to update
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.update_task_field',
                args: {
                    task_id: taskId,
                    field_name: field,
                    new_value: newValue
                }
            });
            
            if (response.message && response.message.success) {
                // For TF/TG field, use the display value instead of backend value
                let displayValue = newValue;
                if ($cell.data('field') === 'custom_tftg') {
                    if (newValue === 'Top Figures') displayValue = 'TF';
                    else if (newValue === 'Top Grants') displayValue = 'TG';
                }
                
                // Update display based on field type
                this.updateCellDisplay($cell, displayValue, fieldType);
                
                frappe.show_alert({
                    message: 'Field updated successfully',
                    indicator: 'green'
                });
            } else {
                throw new Error('Update failed');
            }
        } catch (error) {
            console.error('Save error:', error);
            this.cancelEdit($cell, $cell.data('original-value'), fieldType);
            
            frappe.show_alert({
                message: 'Failed to update field',
                indicator: 'red'
            });
        }
        
        // Remove editing state
        $cell.removeClass('editing');
        $cell.closest('.pm-task-row').removeClass('editing');
    }

    cancelEdit($cell, originalValue, fieldType) {
        this.updateCellDisplay($cell, originalValue, fieldType);
        $cell.removeClass('editing');
        $cell.closest('.pm-task-row').removeClass('editing');
    }

    updateCellDisplay($cell, value, fieldType) {
        const field = $cell.data('field');
        
        switch (fieldType) {
            case 'select':
                if (field === 'custom_tftg') {
                    // Convert company name to display abbreviation
                    let displayValue = value;
                    if (value === 'Top Figures') displayValue = 'TF';
                    else if (value === 'Top Grants') displayValue = 'TG';
                    
                    $cell.html(`<span class="pm-tf-tg-badge editable-field">${displayValue}</span>`);
                } else if (field === 'custom_software') {
                    $cell.html(`<span class="pm-software-badge editable-field">${value}</span>`);
                } else {
                    $cell.html(`<span class="editable-field">${value || '-'}</span>`);
                }
                break;
            case 'currency':
                if (value && parseFloat(value) > 0) {
                    $cell.html(`<span class="pm-currency editable-field">$${parseFloat(value).toFixed(2)}</span>`);
                } else {
                    $cell.html(`<span class="pm-no-amount editable-field">-</span>`);
                }
                break;
            default:
                $cell.html(`<span class="editable-field">${value || '-'}</span>`);
        }
    }

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
                console.log('Task created successfully, response:', response.message);
                
                // Show success message
                frappe.show_alert({
                    message: 'New task created successfully',
                    indicator: 'green'
                });
                
                // Create and insert new task row dynamically
                console.log('Calling insertNewTaskRow...');
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
        console.log('insertNewTaskRow called with:', taskData);
        
        const $addRow = $(addTaskBtn).closest('.pm-add-task-row');
        const projectName = $addRow.data('project');
        const clientName = $addRow.data('client');
        
        console.log('Project:', projectName, 'Client:', clientName);
        console.log('Add row element:', $addRow);
        
        // Create new task row HTML
        const newTaskRowHTML = `
            <div class="pm-task-row" data-task-id="${taskData.task_id}" data-task-name="${taskData.task_subject}" style="display: flex; width: 2000px; min-width: 2000px;">
                <div class="pm-cell pm-cell-client" style="width: 150px; min-width: 150px; flex: 0 0 150px;" data-editable="true" data-field="custom_client" data-task-id="${taskData.task_id}" data-field-type="text">
                    <span class="editable-field">${clientName || 'No Client'}</span>
                </div>
                <div class="pm-cell pm-cell-entity" style="width: 120px; min-width: 120px; flex: 0 0 120px;">
                    <span class="pm-entity-badge entity-company">Company</span>
                </div>
                <div class="pm-cell pm-cell-tf-tg" style="width: 80px; min-width: 80px; flex: 0 0 80px;" data-editable="true" data-field="custom_tftg" data-task-id="${taskData.task_id}" data-field-type="select" data-options="TF,TG" data-backend-options="Top Figures,Top Grants">
                    <span class="pm-tf-tg-badge editable-field">TF</span>
                </div>
                <div class="pm-cell pm-cell-software" style="width: 100px; min-width: 100px; flex: 0 0 100px;" data-editable="true" data-field="custom_software" data-task-id="${taskData.task_id}" data-field-type="select" data-options="Xero,MYOB,QuickBooks,Excel,Other">
                    <span class="pm-software-badge editable-field">Xero</span>
                </div>
                <div class="pm-cell pm-cell-status" style="width: 100px; min-width: 100px; flex: 0 0 100px;">
                    <span class="pm-status-badge status-open">Open</span>
                </div>
                <div class="pm-cell pm-cell-target-month" style="width: 120px; min-width: 120px; flex: 0 0 120px;" data-editable="true" data-field="custom_target_month" data-task-id="${taskData.task_id}" data-field-type="select" data-options="January,February,March,April,May,June,July,August,September,October,November,December">
                    <span class="editable-field">-</span>
                </div>
                <div class="pm-cell pm-cell-budget" style="width: 100px; min-width: 100px; flex: 0 0 100px;" data-editable="true" data-field="custom_budget_planning" data-task-id="${taskData.task_id}" data-field-type="currency">
                    <span class="pm-no-amount editable-field">-</span>
                </div>
                <div class="pm-cell pm-cell-actual" style="width: 100px; min-width: 100px; flex: 0 0 100px;" data-editable="true" data-field="custom_actual_billing" data-task-id="${taskData.task_id}" data-field-type="currency">
                    <span class="pm-no-amount editable-field">-</span>
                </div>
                <div class="pm-cell pm-cell-review-note" style="width: 150px; min-width: 150px; flex: 0 0 150px;">
                    <div class="pm-review-note-indicator no-notes">
                        <i class="fa fa-times-circle"></i>
                        <span>none</span>
                    </div>
                </div>
                <div class="pm-cell pm-cell-action-person" style="width: 120px; min-width: 120px; flex: 0 0 120px;">-</div>
                <div class="pm-cell pm-cell-preparer" style="width: 120px; min-width: 120px; flex: 0 0 120px;">-</div>
                <div class="pm-cell pm-cell-reviewer" style="width: 120px; min-width: 120px; flex: 0 0 120px;">-</div>
                <div class="pm-cell pm-cell-partner" style="width: 120px; min-width: 120px; flex: 0 0 120px;">-</div>
                <div class="pm-cell pm-cell-lodgment-due" style="width: 120px; min-width: 120px; flex: 0 0 120px;">
                    <span class="pm-no-date">-</span>
                </div>
                <div class="pm-cell pm-cell-year-end" style="width: 100px; min-width: 100px; flex: 0 0 100px;">-</div>
                <div class="pm-cell pm-cell-last-updated" style="width: 120px; min-width: 120px; flex: 0 0 120px;">
                    <span class="pm-last-updated">Just now</span>
                </div>
                <div class="pm-cell pm-cell-priority" style="width: 100px; min-width: 100px; flex: 0 0 100px;">
                    <span class="pm-priority-badge priority-medium">Medium</span>
                </div>
            </div>
        `;
        
        // Insert the new row before the add task row
        console.log('Inserting new task row HTML...');
        $addRow.before(newTaskRowHTML);
        
        // Restore the add task button
        $(addTaskBtn).html('<i class="fa fa-plus"></i><span>Add new task</span>');
        
        // Add a subtle animation to highlight the new row
        const $newRow = $addRow.prev();
        console.log('New row element:', $newRow);
        
        $newRow.css('background-color', '#e8f5e8');
        console.log('Applied background color to new row');
        
        setTimeout(() => {
            $newRow.css('background-color', '');
            console.log('Removed background color from new row');
        }, 2000);
    }

}

// Context Menu Styles
const contextMenuStyles = `
<style>
.pm-context-menu {
    background: white;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    border: 1px solid var(--monday-border);
    min-width: 120px;
    overflow: hidden;
}

.pm-menu-item {
    padding: 8px 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 14px;
    transition: background-color 0.2s ease;
}

.pm-menu-item:hover {
    background: var(--monday-hover);
}

.pm-menu-color {
    width: 12px;
    height: 12px;
    border-radius: 2px;
}

.pm-coming-soon {
    text-align: center;
    padding: 60px 20px;
    color: var(--monday-gray);
}

.pm-coming-soon i {
    font-size: 48px;
    margin-bottom: 16px;
    color: var(--monday-blue);
}

.pm-coming-soon h3 {
    margin: 0 0 8px 0;
    color: var(--monday-dark);
}
</style>
`;

// Initialize when DOM is ready
$(document).ready(function() {
    // Add context menu styles
    $('head').append(contextMenuStyles);
    
    // Initialize project management
    window.projectManagement = new ProjectManagement();
    
    console.log('Project Management interface initialized');
});
