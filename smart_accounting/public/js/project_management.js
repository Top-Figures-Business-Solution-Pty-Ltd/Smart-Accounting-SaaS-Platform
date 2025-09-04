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
        this.initializeColumnResizing();
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

        // Editable field click - Handle different field types
        $(document).on('click', '.editable-field', (e) => {
            e.stopPropagation();
            this.startFieldEditing(e.currentTarget);
        });

        // Main table tab click - Navigate to current page
        $(document).on('click', '.pm-tab[data-url]', (e) => {
            const url = $(e.currentTarget).data('url');
            if (url) {
                window.location.href = url;
            }
        });

        // New Task dropdown toggle
        $(document).on('click', '.pm-new-task-btn', (e) => {
            e.stopPropagation();
            this.toggleNewTaskMenu();
        });

        // Quick add task
        $(document).on('click', '.pm-quick-add-task', (e) => {
            e.stopPropagation();
            this.quickAddTask();
        });

        // New project
        $(document).on('click', '.pm-new-project', (e) => {
            e.stopPropagation();
            this.createNewProject();
        });

        // Person filter dropdown toggle
        $(document).on('click', '.pm-person-filter-btn', (e) => {
            e.stopPropagation();
            this.togglePersonFilter();
        });

        // Person option click
        $(document).on('click', '.pm-person-option', (e) => {
            e.stopPropagation();
            this.selectPersonFilter(e.currentTarget);
        });

        // Person search input
        $(document).on('input', '.pm-person-search-input', (e) => {
            this.searchPeople(e.target.value);
        });

        // Client filter dropdown toggle
        $(document).on('click', '.pm-client-filter-btn', (e) => {
            e.stopPropagation();
            this.toggleClientFilter();
        });

        // Client filter option click
        $(document).on('click', '.pm-client-filter-menu .pm-filter-option', (e) => {
            e.stopPropagation();
            this.selectClientFilter(e.currentTarget);
        });

        // Client search input
        $(document).on('input', '.pm-client-search-input', (e) => {
            this.searchClients(e.target.value);
        });

        // Status filter dropdown toggle
        $(document).on('click', '.pm-status-filter-btn', (e) => {
            e.stopPropagation();
            this.toggleStatusFilter();
        });

        // Status filter option click
        $(document).on('click', '.pm-status-filter-menu .pm-filter-option', (e) => {
            e.stopPropagation();
            this.selectStatusFilter(e.currentTarget);
        });

        // Close dropdowns when clicking outside
        $(document).on('click', (e) => {
            if (!$(e.target).closest('.pm-new-task-dropdown').length) {
                this.closeNewTaskMenu();
            }
            if (!$(e.target).closest('.pm-person-filter-dropdown').length) {
                this.closePersonFilter();
            }
            if (!$(e.target).closest('.pm-client-filter-dropdown').length) {
                this.closeClientFilter();
            }
            if (!$(e.target).closest('.pm-status-filter-dropdown').length) {
                this.closeStatusFilter();
            }
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
        
        // Create new task row HTML
        const newTaskRowHTML = `
            <div class="pm-task-row" data-task-id="${taskData.task_id}" data-task-name="${taskData.task_subject}" style="display: flex; width: 2000px; min-width: 2000px;">
                <div class="pm-cell pm-cell-client" style="width: 150px; min-width: 150px; flex: 0 0 150px;" data-editable="true" data-field="custom_client" data-task-id="${taskData.task_id}" data-field-type="client_selector" data-current-client-id="" data-current-client-name="${clientName || 'No Client'}">
                    <span class="editable-field client-display">${clientName || 'No Client'}</span>
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

    startFieldEditing(fieldElement) {
        const $field = $(fieldElement);
        const $cell = $field.closest('.pm-cell');
        const fieldType = $cell.data('field-type');
        const taskId = $cell.data('task-id');
        const fieldName = $cell.data('field');
        
        // Prevent multiple editing
        if ($cell.hasClass('editing')) {
            return;
        }
        
        $cell.addClass('editing');
        
        switch(fieldType) {
            case 'client_selector':
                this.showClientSelector($cell);
                break;
            case 'select':
                this.showSelectEditor($cell);
                break;
            case 'currency':
                this.showCurrencyEditor($cell);
                break;
            default:
                this.showTextEditor($cell);
        }
    }

    showClientSelector($cell) {
        const currentClientName = $cell.data('current-client-name') || '';
        const taskId = $cell.data('task-id');
        
        // Create client selector HTML
        const selectorHTML = `
            <div class="client-selector-container">
                <input type="text" class="client-search-input" 
                       value="${currentClientName === 'No Client' ? '' : currentClientName}"
                       placeholder="Search client or enter new client name..." 
                       data-task-id="${taskId}">
            </div>
        `;
        
        // Create dropdown outside the cell
        const dropdownHTML = `
            <div class="client-dropdown" id="client-dropdown-${taskId}" style="display: none;">
                <div class="client-loading">
                    <i class="fa fa-spinner fa-spin"></i> Searching...
                </div>
            </div>
        `;
        
        $cell.html(selectorHTML);
        
        // Add dropdown to body
        $('body').append(dropdownHTML);
        
        const $input = $cell.find('.client-search-input');
        const $dropdown = $(`#client-dropdown-${taskId}`);
        
        // Focus and select text
        $input.focus().select();
        
        // Search as user types
        let searchTimeout;
        $input.on('input', (e) => {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim();
            
            if (query.length < 2) {
                $dropdown.hide();
                return;
            }
            
            searchTimeout = setTimeout(() => {
                this.searchCustomers(query, $dropdown, $cell);
            }, 300);
        });
        
        // Handle escape and enter
        $input.on('keydown', (e) => {
            if (e.key === 'Escape') {
                this.cancelClientEditing($cell);
            } else if (e.key === 'Enter') {
                const query = e.target.value.trim();
                if (query) {
                    this.createNewCustomer(query, $cell);
                }
            }
        });
        
        // Handle click outside
        $(document).on('click.client-selector', (e) => {
            if (!$(e.target).closest('.client-selector-container').length) {
                this.cancelClientEditing($cell);
            }
        });
    }

    async searchCustomers(query, $dropdown, $cell) {
        try {
            $dropdown.html('<div class="client-loading"><i class="fa fa-spinner fa-spin"></i> Searching...</div>');
            
            // Position dropdown relative to input
            const $input = $cell.find('.client-search-input');
            const inputOffset = $input.offset();
            const inputHeight = $input.outerHeight();
            
            $dropdown.css({
                top: inputOffset.top + inputHeight + 2,
                left: inputOffset.left,
                width: Math.max($input.outerWidth(), 250)
            }).show();
            
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.search_customers',
                args: { query: query }
            });
            
            if (response.message && response.message.success) {
                const customers = response.message.customers;
                let html = '';
                
                // Show existing customers
                customers.forEach(customer => {
                    html += `
                        <div class="client-option existing" data-customer-id="${customer.name}" data-customer-name="${customer.customer_name}">
                            <i class="fa fa-building"></i>
                            <span>${customer.customer_name}</span>
                            <small>(${customer.customer_type})</small>
                        </div>
                    `;
                });
                
                // Add create new option
                html += `
                    <div class="client-option create-new" data-customer-name="${query}">
                        <i class="fa fa-plus"></i>
                        <span>Create new client: "${query}"</span>
                    </div>
                `;
                
                $dropdown.html(html);
                
                // Handle option clicks
                $dropdown.find('.client-option').on('click', (e) => {
                    const $option = $(e.currentTarget);
                    if ($option.hasClass('create-new')) {
                        this.createNewCustomer(query, $cell);
                    } else {
                        this.selectExistingCustomer($option.data('customer-id'), $option.data('customer-name'), $cell);
                    }
                });
            }
        } catch (error) {
            console.error('Customer search error:', error);
            $dropdown.html('<div class="client-error">Search failed</div>');
        }
    }

    async selectExistingCustomer(customerId, customerName, $cell) {
        const taskId = $cell.data('task-id');
        
        try {
            // Show confirmation dialog
            const confirmed = await this.showConfirmDialog(
                `Confirm Client Change`,
                `Change this task's client to "${customerName}"?`
            );
            
            if (!confirmed) {
                this.cancelClientEditing($cell);
                return;
            }
            
            // Update backend
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.update_task_client',
                args: {
                    task_id: taskId,
                    customer_id: customerId
                }
            });
            
            if (response.message && response.message.success) {
                // Update frontend immediately
                $cell.data('current-client-id', customerId);
                $cell.data('current-client-name', customerName);
                $cell.html(`<span class="editable-field client-display">${customerName}</span>`);
                $cell.removeClass('editing');
                
                // Remove dropdown from body
                const taskId = $cell.data('task-id');
                $(`#client-dropdown-${taskId}`).remove();
                
                // Remove event listener
                $(document).off('click.client-selector');
                
                frappe.show_alert({
                    message: 'Client updated successfully',
                    indicator: 'green'
                });
            } else {
                throw new Error(response.message?.error || 'Update failed');
            }
        } catch (error) {
            console.error('Client update error:', error);
            frappe.show_alert({
                message: 'Update failed: ' + error.message,
                indicator: 'red'
            });
            this.cancelClientEditing($cell);
        }
    }

    async createNewCustomer(customerName, $cell) {
        const taskId = $cell.data('task-id');
        
        try {
            // Show confirmation dialog
            const confirmed = await this.showConfirmDialog(
                `Create New Client`,
                `Create new client "${customerName}" and link to this task?`
            );
            
            if (!confirmed) {
                this.cancelClientEditing($cell);
                return;
            }
            
            // Create new customer
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.quick_create_customer',
                args: {
                    customer_name: customerName,
                    customer_type: 'Company'
                }
            });
            
            if (response.message && response.message.success) {
                // Update task with new customer
                await this.selectExistingCustomer(
                    response.message.customer_id, 
                    response.message.customer_name, 
                    $cell
                );
            } else {
                throw new Error(response.message?.error || 'Creation failed');
            }
        } catch (error) {
            console.error('Customer creation error:', error);
            frappe.show_alert({
                message: 'Creation failed: ' + error.message,
                indicator: 'red'
            });
            this.cancelClientEditing($cell);
        }
    }

    cancelClientEditing($cell) {
        const originalName = $cell.data('current-client-name') || 'No Client';
        const taskId = $cell.data('task-id');
        
        $cell.html(`<span class="editable-field client-display">${originalName}</span>`);
        $cell.removeClass('editing');
        
        // Remove dropdown from body
        $(`#client-dropdown-${taskId}`).remove();
        
        // Remove event listener
        $(document).off('click.client-selector');
    }

    showConfirmDialog(title, message) {
        return new Promise((resolve) => {
            frappe.confirm(
                message,
                () => resolve(true),
                () => resolve(false),
                title
            );
        });
    }

    // Implement other field type editors
    showSelectEditor($cell) {
        const fieldName = $cell.data('field');
        const taskId = $cell.data('task-id');
        const currentValue = $cell.find('.editable-field').text().trim();
        
        // Handle different field types
        if (fieldName === 'custom_tftg') {
            this.showCompanySelector($cell);
        } else if (fieldName === 'custom_software') {
            this.showSoftwareSelector($cell);
        } else {
            // Regular select field
            const options = $cell.data('options');
            const backendOptions = $cell.data('backend-options');
            
            if (!options) {
                console.log('No options available for select field');
                return;
            }
            
            const optionList = options.split(',');
            const backendList = backendOptions ? backendOptions.split(',') : optionList;
            
            let selectHTML = '<select class="pm-inline-select">';
            optionList.forEach((option, index) => {
                const backendValue = backendList[index] || option;
                const selected = currentValue === option ? 'selected' : '';
                selectHTML += `<option value="${backendValue}" ${selected}>${option}</option>`;
            });
            selectHTML += '</select>';
            
            $cell.html(selectHTML);
            const $select = $cell.find('.pm-inline-select');
            $select.focus();
            
            // Handle selection change
            $select.on('change blur', () => {
                const newValue = $select.val();
                const newDisplay = $select.find('option:selected').text();
                this.saveFieldValue($cell, fieldName, taskId, newValue, newDisplay);
            });
            
            // Handle escape
            $select.on('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.cancelFieldEditing($cell, currentValue);
                }
            });
        }
    }

    async showCompanySelector($cell) {
        const taskId = $cell.data('task-id');
        const currentValue = $cell.find('.editable-field').text().trim();
        
        try {
            // Get dynamic company list
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.get_companies_for_tftg'
            });
            
            if (response.message && response.message.success) {
                const companies = response.message.companies;
                
                let selectHTML = '<select class="pm-inline-select">';
                companies.forEach(company => {
                    const selected = currentValue === company.display ? 'selected' : '';
                    selectHTML += `<option value="${company.id}" ${selected}>${company.display}</option>`;
                });
                selectHTML += '</select>';
                
                $cell.html(selectHTML);
                const $select = $cell.find('.pm-inline-select');
                $select.focus();
                
                // Handle selection change
                $select.on('change blur', () => {
                    const newValue = $select.val();
                    const newDisplay = $select.find('option:selected').text();
                    this.saveFieldValue($cell, 'custom_tftg', taskId, newValue, newDisplay);
                });
                
                // Handle escape
                $select.on('keydown', (e) => {
                    if (e.key === 'Escape') {
                        this.cancelFieldEditing($cell, currentValue);
                    }
                });
            }
        } catch (error) {
            console.error('Company selector error:', error);
            this.cancelFieldEditing($cell, currentValue);
        }
    }

    showSoftwareSelector($cell) {
        const taskId = $cell.data('task-id');
        const currentValue = $cell.find('.editable-field').text().trim();
        
        // Fixed software options - these are standard accounting platforms
        const softwareOptions = [
            'Xero', 'MYOB', 'QuickBooks', 'Excel', 'Other'
        ];
        
        let selectHTML = '<select class="pm-inline-select">';
        softwareOptions.forEach(software => {
            const selected = currentValue === software ? 'selected' : '';
            selectHTML += `<option value="${software}" ${selected}>${software}</option>`;
        });
        selectHTML += '</select>';
        
        $cell.html(selectHTML);
        const $select = $cell.find('.pm-inline-select');
        $select.focus();
        
        // Handle selection change - use special software update method
        $select.on('change blur', () => {
            const newValue = $select.val();
            this.saveSoftwareValue($cell, taskId, newValue);
        });
        
        // Handle escape
        $select.on('keydown', (e) => {
            if (e.key === 'Escape') {
                this.cancelFieldEditing($cell, currentValue);
            }
        });
    }

    async saveSoftwareValue($cell, taskId, newValue) {
        try {
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.update_task_software',
                args: {
                    task_id: taskId,
                    software_value: newValue
                }
            });
            
            if (response.message && response.message.success) {
                // Update display immediately
                $cell.html(`<span class="editable-field">${newValue}</span>`);
                $cell.removeClass('editing');
                
                frappe.show_alert({
                    message: 'Software updated successfully',
                    indicator: 'green'
                });
            } else {
                throw new Error(response.message?.error || 'Update failed');
            }
        } catch (error) {
            console.error('Software update error:', error);
            frappe.show_alert({
                message: 'Update failed: ' + error.message,
                indicator: 'red'
            });
            this.cancelFieldEditing($cell, newValue);
        }
    }

    showCurrencyEditor($cell) {
        const fieldName = $cell.data('field');
        const taskId = $cell.data('task-id');
        const currentValue = $cell.find('.editable-field').text().replace(/[$,]/g, '').trim();
        
        const inputHTML = `<input type="number" class="pm-inline-input" value="${currentValue === '-' ? '' : currentValue}" step="0.01" min="0">`;
        
        $cell.html(inputHTML);
        const $input = $cell.find('.pm-inline-input');
        $input.focus().select();
        
        // Handle enter and blur
        $input.on('blur keydown', (e) => {
            if (e.type === 'blur' || e.key === 'Enter') {
                const newValue = parseFloat($input.val()) || 0;
                this.saveFieldValue($cell, fieldName, taskId, newValue, `$${newValue.toFixed(2)}`);
            } else if (e.key === 'Escape') {
                this.cancelFieldEditing($cell, currentValue);
            }
        });
    }

    showTextEditor($cell) {
        const fieldName = $cell.data('field');
        const taskId = $cell.data('task-id');
        const currentValue = $cell.find('.editable-field').text().trim();
        
        const inputHTML = `<input type="text" class="pm-inline-input" value="${currentValue}">`;
        
        $cell.html(inputHTML);
        const $input = $cell.find('.pm-inline-input');
        $input.focus().select();
        
        // Handle enter and blur
        $input.on('blur keydown', (e) => {
            if (e.type === 'blur' || e.key === 'Enter') {
                const newValue = $input.val().trim();
                this.saveFieldValue($cell, fieldName, taskId, newValue, newValue);
            } else if (e.key === 'Escape') {
                this.cancelFieldEditing($cell, currentValue);
            }
        });
    }

    async saveFieldValue($cell, fieldName, taskId, newValue, displayValue) {
        try {
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.update_task_field',
                args: {
                    task_id: taskId,
                    field_name: fieldName,
                    new_value: newValue
                }
            });
            
            if (response.message && response.message.success) {
                // Update display immediately
                $cell.html(`<span class="editable-field">${displayValue || newValue || '-'}</span>`);
                $cell.removeClass('editing');
                
                frappe.show_alert({
                    message: 'Field updated successfully',
                    indicator: 'green'
                });
            } else {
                throw new Error(response.message?.error || 'Update failed');
            }
        } catch (error) {
            console.error('Field update error:', error);
            frappe.show_alert({
                message: 'Update failed: ' + error.message,
                indicator: 'red'
            });
            this.cancelFieldEditing($cell, displayValue);
        }
    }

    cancelFieldEditing($cell, originalValue) {
        $cell.html(`<span class="editable-field">${originalValue || '-'}</span>`);
        $cell.removeClass('editing');
    }

    toggleNewTaskMenu() {
        const $dropdown = $('.pm-new-task-dropdown');
        const $menu = $('.pm-new-task-menu');
        
        if ($dropdown.hasClass('active')) {
            this.closeNewTaskMenu();
        } else {
            $dropdown.addClass('active');
            $menu.slideDown(200);
        }
    }

    closeNewTaskMenu() {
        const $dropdown = $('.pm-new-task-dropdown');
        const $menu = $('.pm-new-task-menu');
        
        $dropdown.removeClass('active');
        $menu.slideUp(200);
    }

    async quickAddTask() {
        this.closeNewTaskMenu();
        
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
        
        // Create new task row HTML (same as before)
        const newTaskRowHTML = `
            <div class="pm-task-row new-task-highlight" data-task-id="${taskData.task_id}" data-task-name="${taskData.task_subject}" style="display: flex; width: 2000px; min-width: 2000px;">
                <div class="pm-cell pm-cell-client" style="width: 150px; min-width: 150px; flex: 0 0 150px;" data-editable="true" data-field="custom_client" data-task-id="${taskData.task_id}" data-field-type="client_selector" data-current-client-id="" data-current-client-name="${clientName || 'No Client'}">
                    <span class="editable-field client-display">${clientName || 'No Client'}</span>
                </div>
                <div class="pm-cell pm-cell-entity" style="width: 120px; min-width: 120px; flex: 0 0 120px;">
                    <span class="pm-entity-badge entity-company">Company</span>
                </div>
                <div class="pm-cell pm-cell-tf-tg" style="width: 80px; min-width: 80px; flex: 0 0 80px;" data-editable="true" data-field="custom_tftg" data-task-id="${taskData.task_id}" data-field-type="select">
                    <span class="pm-tf-tg-badge editable-field">TF</span>
                </div>
                <div class="pm-cell pm-cell-software" style="width: 100px; min-width: 100px; flex: 0 0 100px;" data-editable="true" data-field="custom_software" data-task-id="${taskData.task_id}" data-field-type="select">
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
        this.closeNewTaskMenu();
        
        // Navigate to ERPNext project creation
        frappe.show_alert({
            message: 'Redirecting to project creation...',
            indicator: 'blue'
        });
        
        setTimeout(() => {
            window.open('/app/project/new-project', '_blank');
        }, 500);
    }

    togglePersonFilter() {
        const $dropdown = $('.pm-person-filter-dropdown');
        const $menu = $('.pm-person-filter-menu');
        
        if ($dropdown.hasClass('active')) {
            this.closePersonFilter();
        } else {
            $dropdown.addClass('active');
            $menu.slideDown(200);
            this.loadAllPeople();
        }
    }

    closePersonFilter() {
        const $dropdown = $('.pm-person-filter-dropdown');
        const $menu = $('.pm-person-filter-menu');
        
        $dropdown.removeClass('active');
        $menu.slideUp(200);
    }

    async loadAllPeople() {
        const $personList = $('.pm-person-list');
        
        try {
            console.log('Loading all people...');
            
            // Get all people from tasks - simplified approach
            const people = new Map();
            
            // Find all avatars on the page
            $('.pm-avatar').each((index, avatar) => {
                try {
                    const $avatar = $(avatar);
                    const fullName = $avatar.attr('title');
                    const initials = $avatar.text();
                    
                    if (fullName && fullName !== '-' && fullName.trim() !== '') {
                        const email = fullName.includes('@') ? fullName : `${fullName.toLowerCase().replace(/\s+/g, '.')}@company.com`;
                        
                        if (!people.has(email)) {
                            people.set(email, {
                                email: email,
                                name: fullName,
                                initials: initials
                            });
                        }
                    }
                } catch (e) {
                    console.log('Error processing avatar:', e);
                }
            });
            
            console.log('Found people:', people);
            
            // Convert to array and sort
            const peopleArray = Array.from(people.values()).sort((a, b) => a.name.localeCompare(b.name));
            
            console.log('People array:', peopleArray);
            
            // Generate HTML
            let html = '';
            if (peopleArray.length === 0) {
                html = '<div class="pm-person-option"><span>No people found</span></div>';
            } else {
                peopleArray.forEach(person => {
                    html += `
                        <div class="pm-person-option" data-person-email="${person.email}" data-person-name="${person.name}">
                            <div class="pm-person-avatar" style="background-color: ${this.getPersonColor(person.email)}">
                                ${person.initials}
                            </div>
                            <span>${person.name}</span>
                        </div>
                    `;
                });
            }
            
            $personList.html(html);
            console.log('Person list updated');
            
        } catch (error) {
            console.error('Load people error:', error);
            $personList.html('<div class="pm-person-option"><span>Failed to load people</span></div>');
        }
    }

    extractPeopleFromCell($cell, peopleMap, role) {
        try {
            // Extract people from avatar cells
            $cell.find('.pm-avatar').each((index, avatar) => {
                try {
                    const $avatar = $(avatar);
                    const fullName = $avatar.attr('title') || '';
                    const initials = $avatar.text() || '';
                    
                    if (fullName && fullName !== '-' && fullName.trim() !== '') {
                        const email = fullName.includes('@') ? fullName : `${fullName.toLowerCase().replace(/\s+/g, '.')}@company.com`;
                        
                        if (!peopleMap.has(email)) {
                            peopleMap.set(email, {
                                email: email,
                                name: fullName,
                                initials: initials,
                                roles: [role]
                            });
                        } else {
                            const existing = peopleMap.get(email);
                            if (existing.roles && !existing.roles.includes(role)) {
                                existing.roles.push(role);
                            }
                        }
                    }
                } catch (avatarError) {
                    console.log('Error processing avatar:', avatarError);
                }
            });
        } catch (cellError) {
            console.log('Error processing cell:', cellError);
        }
    }

    getPersonColor(email) {
        // Generate consistent color based on email
        const colors = ['#0073ea', '#00c875', '#fdab3d', '#e2445c', '#a25ddc', '#ff5ac4'];
        let hash = 0;
        for (let i = 0; i < email.length; i++) {
            hash = email.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    }

    selectPersonFilter(optionElement) {
        const $option = $(optionElement);  // Ensure it's a jQuery object
        const $btn = $('.pm-person-filter-btn');
        const personEmail = $option.data('person-email');
        const personName = $option.data('person-name');
        
        if ($option.hasClass('pm-clear-filter')) {
            // Clear filter
            this.clearPersonFilter();
        } else {
            // Apply filter
            this.applyPersonFilter(personEmail, personName);
            
            // Update button state
            $btn.addClass('has-filter');
            $btn.find('.pm-person-count').text('1').show();
            
            // Mark option as selected
            $('.pm-person-option').removeClass('selected');
            $option.addClass('selected');
        }
        
        this.closePersonFilter();
    }

    applyPersonFilter(personEmail, personName) {
        let visibleTasks = 0;
        
        $('.pm-task-row').each((index, row) => {
            const $row = $(row);
            
            // Skip add task rows
            if ($row.hasClass('pm-add-task-row')) {
                return;
            }
            
            // Check if person is involved in this task
            const isInvolved = this.isPersonInvolvedInTask($row, personEmail, personName);
            
            if (isInvolved) {
                $row.show();
                visibleTasks++;
            } else {
                $row.hide();
            }
        });
        
        // Update projects visibility
        this.updateProjectVisibility();
        
        frappe.show_alert({
            message: `Filtered by ${personName} - ${visibleTasks} tasks shown`,
            indicator: 'blue'
        });
    }

    isPersonInvolvedInTask($row, personEmail, personName) {
        try {
            // Check all people-related cells
            const peopleCells = [
                '.pm-cell-action-person',
                '.pm-cell-preparer', 
                '.pm-cell-reviewer',
                '.pm-cell-partner'
            ];
            
            for (let cellSelector of peopleCells) {
                const $cell = $row.find(cellSelector);
                
                // Check avatar titles
                const $avatars = $cell.find('.pm-avatar');
                for (let i = 0; i < $avatars.length; i++) {
                    const title = $($avatars[i]).attr('title');
                    if (title && title.toLowerCase().includes(personName.toLowerCase())) {
                        return true;
                    }
                }
            }
            
            return false;
        } catch (error) {
            console.log('Error checking person involvement:', error);
            return false;
        }
    }

    clearPersonFilter() {
        const $btn = $('.pm-person-filter-btn');
        
        // Show all tasks
        $('.pm-task-row').show();
        $('.pm-project-group').show();
        
        // Reset button state
        $btn.removeClass('has-filter');
        $btn.find('.pm-person-count').hide();
        
        // Clear selection
        $('.pm-person-option').removeClass('selected');
        
        frappe.show_alert({
            message: 'Person filter cleared',
            indicator: 'green'
        });
    }

    updateProjectVisibility() {
        // Hide projects that have no visible tasks
        $('.pm-project-group').each((index, group) => {
            const $group = $(group);
            const visibleTasks = $group.find('.pm-task-row:visible:not(.pm-add-task-row)').length;
            
            if (visibleTasks > 0) {
                $group.show();
            } else {
                $group.hide();
            }
        });
    }

    searchPeople(query) {
        const $personList = $('.pm-person-list');
        
        if (!query || query.length < 2) {
            $personList.find('.pm-person-option').show();
            return;
        }
        
        // Filter people list
        $personList.find('.pm-person-option').each((index, option) => {
            const $option = $(option);
            const personName = $option.data('person-name') || '';
            
            if (personName.toLowerCase().includes(query.toLowerCase())) {
                $option.show();
            } else {
                $option.hide();
            }
        });
    }

    // Client Filter Methods
    toggleClientFilter() {
        const $dropdown = $('.pm-client-filter-dropdown');
        const $menu = $('.pm-client-filter-menu');
        
        if ($dropdown.hasClass('active')) {
            this.closeClientFilter();
        } else {
            $dropdown.addClass('active');
            $menu.slideDown(200);
            this.loadAllClients();
        }
    }

    closeClientFilter() {
        const $dropdown = $('.pm-client-filter-dropdown');
        const $menu = $('.pm-client-filter-menu');
        
        $dropdown.removeClass('active');
        $menu.slideUp(200);
    }

    loadAllClients() {
        const $clientList = $('.pm-client-list');
        
        try {
            // Get all unique clients from tasks
            const clients = new Set();
            
            $('.pm-task-row:not(.pm-add-task-row)').each((index, row) => {
                const $row = $(row);
                const clientName = $row.find('.pm-cell-client .client-display').text().trim();
                
                if (clientName && clientName !== 'No Client' && clientName !== '-') {
                    clients.add(clientName);
                }
            });
            
            // Convert to sorted array
            const clientArray = Array.from(clients).sort();
            
            // Generate HTML
            let html = '';
            clientArray.forEach(client => {
                html += `
                    <div class="pm-filter-option" data-client-name="${client}">
                        <div class="pm-filter-icon">
                            <i class="fa fa-building"></i>
                        </div>
                        <span>${client}</span>
                    </div>
                `;
            });
            
            $clientList.html(html);
            
        } catch (error) {
            console.error('Load clients error:', error);
            $clientList.html('<div class="pm-filter-option"><span>Failed to load clients</span></div>');
        }
    }

    selectClientFilter(optionElement) {
        const $option = $(optionElement);
        const $btn = $('.pm-client-filter-btn');
        const clientName = $option.data('client-name');
        
        if ($option.hasClass('pm-clear-client-filter')) {
            // Clear filter
            this.clearClientFilter();
        } else {
            // Apply filter
            this.applyClientFilter(clientName);
            
            // Update button state
            $btn.addClass('has-filter');
            $btn.find('span:first').text(clientName);
            
            // Mark option as selected
            $('.pm-client-filter-menu .pm-filter-option').removeClass('selected');
            $option.addClass('selected');
        }
        
        this.closeClientFilter();
    }

    applyClientFilter(clientName) {
        let visibleTasks = 0;
        
        $('.pm-task-row:not(.pm-add-task-row)').each((index, row) => {
            const $row = $(row);
            const rowClientName = $row.find('.pm-cell-client .client-display').text().trim();
            
            if (rowClientName === clientName) {
                $row.show();
                visibleTasks++;
            } else {
                $row.hide();
            }
        });
        
        // Update projects visibility
        this.updateProjectVisibility();
        
        frappe.show_alert({
            message: `Filtered by ${clientName} - ${visibleTasks} tasks shown`,
            indicator: 'blue'
        });
    }

    clearClientFilter() {
        const $btn = $('.pm-client-filter-btn');
        
        // Show all tasks
        $('.pm-task-row').show();
        $('.pm-project-group').show();
        
        // Reset button state
        $btn.removeClass('has-filter');
        $btn.find('span:first').text('All Clients');
        
        // Clear selection
        $('.pm-client-filter-menu .pm-filter-option').removeClass('selected');
        
        frappe.show_alert({
            message: 'Client filter cleared',
            indicator: 'green'
        });
    }

    searchClients(query) {
        const $clientList = $('.pm-client-list');
        
        if (!query || query.length < 2) {
            $clientList.find('.pm-filter-option').show();
            return;
        }
        
        // Filter client list
        $clientList.find('.pm-filter-option').each((index, option) => {
            const $option = $(option);
            const clientName = $option.data('client-name') || '';
            
            if (clientName.toLowerCase().includes(query.toLowerCase())) {
                $option.show();
            } else {
                $option.hide();
            }
        });
    }

    // Status Filter Methods
    toggleStatusFilter() {
        const $dropdown = $('.pm-status-filter-dropdown');
        const $menu = $('.pm-status-filter-menu');
        
        if ($dropdown.hasClass('active')) {
            this.closeStatusFilter();
        } else {
            $dropdown.addClass('active');
            $menu.slideDown(200);
        }
    }

    closeStatusFilter() {
        const $dropdown = $('.pm-status-filter-dropdown');
        const $menu = $('.pm-status-filter-menu');
        
        $dropdown.removeClass('active');
        $menu.slideUp(200);
    }

    selectStatusFilter(optionElement) {
        const $option = $(optionElement);
        const $btn = $('.pm-status-filter-btn');
        const status = $option.data('status');
        
        if ($option.hasClass('pm-clear-status-filter')) {
            // Clear filter
            this.clearStatusFilter();
        } else {
            // Apply filter
            this.applyStatusFilter(status);
            
            // Update button state
            $btn.addClass('has-filter');
            $btn.find('span:first').text(status);
            
            // Mark option as selected
            $('.pm-status-filter-menu .pm-filter-option').removeClass('selected');
            $option.addClass('selected');
        }
        
        this.closeStatusFilter();
    }

    applyStatusFilter(status) {
        let visibleTasks = 0;
        
        $('.pm-task-row:not(.pm-add-task-row)').each((index, row) => {
            const $row = $(row);
            const rowStatus = $row.find('.pm-status-badge').text().trim();
            
            if (rowStatus.toLowerCase() === status.toLowerCase()) {
                $row.show();
                visibleTasks++;
            } else {
                $row.hide();
            }
        });
        
        // Update projects visibility
        this.updateProjectVisibility();
        
        frappe.show_alert({
            message: `Filtered by ${status} - ${visibleTasks} tasks shown`,
            indicator: 'blue'
        });
    }

    clearStatusFilter() {
        const $btn = $('.pm-status-filter-btn');
        
        // Show all tasks
        $('.pm-task-row').show();
        $('.pm-project-group').show();
        
        // Reset button state
        $btn.removeClass('has-filter');
        $btn.find('span:first').text('All Status');
        
        // Clear selection
        $('.pm-status-filter-menu .pm-filter-option').removeClass('selected');
        
        frappe.show_alert({
            message: 'Status filter cleared',
            indicator: 'green'
        });
    }

    // Column Resizing Functionality
    initializeColumnResizing() {
        this.isResizing = false;
        this.currentColumn = null;
        this.startX = 0;
        this.startWidth = 0;
        this.columnWidths = this.loadColumnWidths();
        
        // Apply saved column widths
        this.applyColumnWidths();
        
        // Bind resize events
        this.bindResizeEvents();
    }
    
    bindResizeEvents() {
        // Mouse down on resizer
        $(document).on('mousedown', '.pm-column-resizer', (e) => {
            e.preventDefault();
            this.startResize(e);
        });
        
        // Mouse move
        $(document).on('mousemove', (e) => {
            if (this.isResizing) {
                this.doResize(e);
            }
        });
        
        // Mouse up
        $(document).on('mouseup', () => {
            if (this.isResizing) {
                this.endResize();
            }
        });
        
        // Prevent text selection during resize
        $(document).on('selectstart', () => {
            if (this.isResizing) {
                return false;
            }
        });
    }
    
    startResize(e) {
        this.isResizing = true;
        this.currentColumn = $(e.target).closest('.pm-header-cell').data('column');
        this.startX = e.clientX;
        this.startWidth = $(e.target).closest('.pm-header-cell').outerWidth();
        
        // Add visual feedback
        $('.pm-table-container').addClass('resizing');
        $(e.target).addClass('resizing');
        
        // Prevent default behavior
        e.preventDefault();
    }
    
    doResize(e) {
        if (!this.isResizing || !this.currentColumn) return;
        
        const diff = e.clientX - this.startX;
        const newWidth = Math.max(50, this.startWidth + diff); // Minimum width of 50px
        
        // Apply new width to all cells in this column
        this.setColumnWidth(this.currentColumn, newWidth);
    }
    
    endResize() {
        if (!this.isResizing) return;
        
        // Save the new width
        if (this.currentColumn) {
            const newWidth = $(`.pm-header-cell[data-column="${this.currentColumn}"]`).outerWidth();
            this.columnWidths[this.currentColumn] = newWidth;
            this.saveColumnWidths();
        }
        
        // Clean up
        this.isResizing = false;
        this.currentColumn = null;
        $('.pm-table-container').removeClass('resizing');
        $('.pm-column-resizer').removeClass('resizing');
    }
    
    setColumnWidth(column, width) {
        // Set width for header
        $(`.pm-header-cell[data-column="${column}"]`).css('width', width + 'px');
        
        // Set width for corresponding data cells - map column names to CSS classes
        const columnClassMap = {
            'client': 'pm-cell-client',
            'entity': 'pm-cell-entity',
            'tf-tg': 'pm-cell-tf-tg',
            'software': 'pm-cell-software',
            'status': 'pm-cell-status',
            'target-month': 'pm-cell-target-month',
            'budget': 'pm-cell-budget',
            'actual': 'pm-cell-actual',
            'review-note': 'pm-cell-review-note',
            'action-person': 'pm-cell-action-person',
            'preparer': 'pm-cell-preparer',
            'reviewer': 'pm-cell-reviewer',
            'partner': 'pm-cell-partner',
            'lodgment-due': 'pm-cell-lodgment-due',
            'year-end': 'pm-cell-year-end',
            'last-updated': 'pm-cell-last-updated',
            'priority': 'pm-cell-priority'
        };
        
        const cellClass = `.${columnClassMap[column]}`;
        if (cellClass !== '.undefined') {
            $(cellClass).css('width', width + 'px');
        }
    }
    
    applyColumnWidths() {
        Object.keys(this.columnWidths).forEach(column => {
            this.setColumnWidth(column, this.columnWidths[column]);
        });
    }
    
    loadColumnWidths() {
        const saved = localStorage.getItem('pm-column-widths');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.warn('Failed to load column widths:', e);
            }
        }
        
        // Default column widths
        return {
            'client': 150,
            'entity': 100,
            'tf-tg': 80,
            'software': 120,
            'status': 100,
            'target-month': 120,
            'budget': 120,
            'actual': 120,
            'review-note': 120,
            'action-person': 130,
            'preparer': 120,
            'reviewer': 120,
            'partner': 120,
            'lodgment-due': 130,
            'year-end': 100,
            'last-updated': 130,
            'priority': 100
        };
    }
    
    saveColumnWidths() {
        try {
            localStorage.setItem('pm-column-widths', JSON.stringify(this.columnWidths));
        } catch (e) {
            console.warn('Failed to save column widths:', e);
        }
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
