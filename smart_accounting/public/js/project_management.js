// Project Management - Monday.com Style JavaScript

class ProjectManagement {
    constructor() {
        this.tooltipHideTimer = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.initializeFilters();
        this.setupSearch();
        this.initializeInlineEditing();
        this.initializeColumnResizing();
        this.initializeAdvancedFilter();
        this.loadSystemOptions();
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
        
        // Person avatar hover events with delay
        $(document).on('mouseenter', '.pm-avatar[data-email]', (e) => {
            clearTimeout(this.tooltipHideTimer);
            this.showPersonTooltip(e.currentTarget);
        });
        
        $(document).on('mouseleave', '.pm-avatar[data-email]', () => {
            this.tooltipHideTimer = setTimeout(() => {
                if (!$('.pm-person-tooltip:hover').length) {
                    this.hidePersonTooltip();
                }
            }, 300);
        });
        
        // Keep tooltip open when hovering over it
        $(document).on('mouseenter', '.pm-person-tooltip', () => {
            clearTimeout(this.tooltipHideTimer);
        });
        
        $(document).on('mouseleave', '.pm-person-tooltip', () => {
            this.tooltipHideTimer = setTimeout(() => {
                this.hidePersonTooltip();
            }, 200);
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

        // Comment indicator click
        $(document).on('click', '.pm-comment-indicator', (e) => {
            e.stopPropagation();
            const taskId = $(e.currentTarget).data('task-id');
            this.showCommentModal(taskId);
        });

        // Comment modal events
        $(document).on('click', '.pm-comment-modal-close', () => {
            this.closeCommentModal();
        });

        $(document).on('click', '.pm-comment-modal', (e) => {
            if (e.target === e.currentTarget) {
                this.closeCommentModal();
            }
        });

        $(document).on('click', '.pm-comment-submit', (e) => {
            e.preventDefault();
            this.submitComment();
        });

        // Comment actions
        $(document).on('click', '.pm-comment-action[data-action="edit"]', (e) => {
            e.stopPropagation();
            const commentId = $(e.currentTarget).data('comment-id');
            this.editComment(commentId);
        });

        $(document).on('click', '.pm-comment-action[data-action="delete"]', (e) => {
            e.stopPropagation();
            const commentId = $(e.currentTarget).data('comment-id');
            this.deleteComment(commentId);
        });

        // Unified dropdown management - close all when clicking outside
        $(document).on('click', (e) => {
            // Check if click is outside any dropdown
            const isOutsideDropdown = !$(e.target).closest('.pm-dropdown-container, .pm-new-task-dropdown, .pm-person-filter-dropdown, .pm-client-filter-dropdown, .pm-status-filter-dropdown, .pm-advanced-filter-dropdown').length;
            
            if (isOutsideDropdown) {
                this.closeAllDropdowns();
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
                           .addClass(`status-${this.getStatusClass(newStatus)}`)
                           .text(newStatus);
                
                // Apply dynamic color
                this.applyStatusColor($statusBadge, newStatus);

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
            case 'date':
                editor = this.createDateEditor($cell, currentValue);
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
                
                console.log(`Updated ${fieldType} field with value: ${displayValue}`);
                
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
        
        // Force CSS reflow and ensure proper styling
        $cell.removeClass('editing');
        $cell[0].offsetHeight; // Force reflow
        
        // For currency fields, ensure proper styling is applied
        if (fieldType === 'currency') {
            const $currencySpan = $cell.find('.pm-currency, .pm-no-amount');
            if ($currencySpan.length) {
                $currencySpan[0].offsetHeight; // Force reflow for currency elements
            }
        }
        
        // Re-trigger any hover/focus states if needed
        setTimeout(() => {
            $cell.trigger('updated');
        }, 10);
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
        
        // Get current column widths and generate HTML
        const currentWidths = this.getCurrentColumnWidths();
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
        
        // Clear all previous editing states and close dropdowns
        this.clearAllEditingStates();
        
        $cell.addClass('editing');
        
        switch(fieldType) {
            case 'client_selector':
                this.showClientSelector($cell);
                break;
            case 'person_selector':
                this.showPersonSelector($cell, taskId, fieldName);
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
                // Update frontend immediately - preserve comment indicator
                $cell.data('current-client-id', customerId);
                $cell.data('current-client-name', customerName);
                const currentCommentHtml = $cell.find('.pm-client-comments').prop('outerHTML');
                $cell.html(`
                    <div class="pm-client-content">
                        <span class="editable-field client-display">${customerName}</span>
                    </div>
                    ${currentCommentHtml}
                `);
                $cell.removeClass('editing');
                $cell[0].offsetHeight; // Force reflow
                
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
        
        // Preserve comment indicator when canceling
        const currentCommentHtml = $cell.find('.pm-client-comments').prop('outerHTML') || `
            <div class="pm-client-comments">
                <div class="pm-comment-indicator" data-task-id="${taskId}">
                    <i class="fa fa-comment-o"></i>
                    <span class="pm-comment-count">0</span>
                </div>
            </div>
        `;
        
        $cell.html(`
            <div class="pm-client-content">
                <span class="editable-field client-display">${originalName}</span>
            </div>
            ${currentCommentHtml}
        `);
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
                // Update display immediately with proper styling
                $cell.html(`<span class="pm-software-badge editable-field">${newValue}</span>`);
                $cell.removeClass('editing');
                $cell[0].offsetHeight; // Force reflow
                
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
                // Get field type from cell data
                const fieldType = $cell.data('field-type') || 'text';
                
                // Update display immediately with proper field type handling
                this.updateCellDisplay($cell, displayValue || newValue, fieldType);
                
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
        this.openDropdown('pm-new-task-dropdown', 'pm-new-task-menu');
    }

    closeNewTaskMenu() {
        const $dropdown = $('.pm-new-task-dropdown');
        const $menu = $('.pm-new-task-menu');
        
        $dropdown.removeClass('active');
        $menu.slideUp(200);
    }

    async quickAddTask() {
        this.closeAllDropdowns();
        
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
        const currentWidths = this.getCurrentColumnWidths();
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
        this.closeAllDropdowns();
        
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
        this.openDropdown('pm-person-filter-dropdown', 'pm-person-filter-menu');
        // Load people data when opening
        if ($('.pm-person-filter-menu').is(':visible')) {
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
        
        this.closeAllDropdowns();
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
        this.openDropdown('pm-client-filter-dropdown', 'pm-client-filter-menu');
        // Load clients data when opening
        if ($('.pm-client-filter-menu').is(':visible')) {
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
        
        this.closeAllDropdowns();
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
        this.openDropdown('pm-status-filter-dropdown', 'pm-status-filter-menu');
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
        
        this.closeAllDropdowns();
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
        
        // Load column widths and initialize after loading
        this.loadColumnWidthsAsync().then(() => {
            // Bind resize events after column widths are loaded
            this.bindResizeEvents();
        });
    }
    
    bindResizeEvents() {
        // Mouse events
        $(document).on('mousedown', '.pm-column-resizer', (e) => {
            e.preventDefault();
            this.startResize(e);
        });
        
        $(document).on('mousemove', (e) => {
            if (this.isResizing) {
                this.doResize(e);
            }
        });
        
        $(document).on('mouseup', () => {
            if (this.isResizing) {
                this.endResize();
            }
        });
        
        // Touch events for mobile support
        $(document).on('touchstart', '.pm-column-resizer', (e) => {
            e.preventDefault();
            const touch = e.originalEvent.touches[0];
            this.startResize({
                clientX: touch.clientX,
                target: e.target
            });
        });
        
        $(document).on('touchmove', (e) => {
            if (this.isResizing) {
                e.preventDefault();
                const touch = e.originalEvent.touches[0];
                this.doResize({
                    clientX: touch.clientX
                });
            }
        });
        
        $(document).on('touchend', () => {
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
        
        // Handle window resize
        $(window).on('resize', () => {
            if (!this.isResizing) {
                this.updateTableWidth();
            }
        });
        
        // Right-click context menu for column headers
        $(document).on('contextmenu', '.pm-header-cell', (e) => {
            e.preventDefault();
            this.showColumnContextMenu(e);
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
        
        // Add visual feedback
        this.showResizeGuide(e.clientX);
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
        this.hideResizeGuide();
    }
    
    showResizeGuide(clientX) {
        let guide = $('.pm-resize-guide');
        if (guide.length === 0) {
            guide = $('<div class="pm-resize-guide"></div>');
            $('body').append(guide);
        }
        
        const tableContainer = $('.pm-table-container');
        const containerRect = tableContainer[0].getBoundingClientRect();
        
        guide.css({
            left: clientX + 'px',
            top: containerRect.top + 'px',
            height: containerRect.height + 'px',
            display: 'block'
        });
    }
    
    hideResizeGuide() {
        $('.pm-resize-guide').hide();
    }
    
    setColumnWidth(column, width) {
        // Ensure minimum width
        const minWidth = Math.max(width, 50);
        
        // Set width for header cells
        $(`.pm-header-cell[data-column="${column}"]`).css({
            'width': minWidth + 'px',
            'min-width': minWidth + 'px',
            'max-width': minWidth + 'px',
            'flex': `0 0 ${minWidth}px`
        });
        
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
            $(cellClass).css({
                'width': minWidth + 'px',
                'min-width': minWidth + 'px',
                'max-width': minWidth + 'px',
                'flex': `0 0 ${minWidth}px`
            });
        }
        
        // Update total table width
        this.updateTableWidth();
    }
    
    applyColumnWidths() {
        Object.keys(this.columnWidths).forEach(column => {
            this.setColumnWidth(column, this.columnWidths[column]);
        });
        // Update total table width after applying all column widths
        this.updateTableWidth();
    }
    
    loadColumnWidthsAsync() {
        // Load user-specific column widths from server (User Preferences DocType)
        return new Promise((resolve) => {
            frappe.call({
                method: 'smart_accounting.www.project_management.index.load_user_column_widths',
                callback: (r) => {
                    if (r.message && r.message.success) {
                        this.columnWidths = r.message.column_widths;
                        console.log('✅ Loaded user column widths for:', frappe.session.user, this.columnWidths);
                    } else {
                        // If server fails, try localStorage as fallback
                        const userKey = `pm-column-widths-${frappe.session.user}`;
                        const saved = localStorage.getItem(userKey);
                        if (saved) {
                            try {
                                this.columnWidths = JSON.parse(saved);
                                console.log('✅ Loaded from localStorage fallback:', this.columnWidths);
                            } catch (e) {
                                this.columnWidths = this.getDefaultColumnWidths();
                            }
                        } else {
                            this.columnWidths = this.getDefaultColumnWidths();
                        }
                        console.log('⚠️ Using fallback column widths for:', frappe.session.user);
                    }
                    // Apply widths immediately after loading
                    this.applyColumnWidths();
                    resolve();
                }
            });
        });
    }
    
    // Keep old method for compatibility
    loadColumnWidths() {
        return this.loadColumnWidthsAsync();
    }
    
    getDefaultColumnWidths() {
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
        // Save user-specific column widths with dual storage (server + localStorage)
        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => {
            // Save to localStorage immediately for instant fallback
            const userKey = `pm-column-widths-${frappe.session.user}`;
            try {
                localStorage.setItem(userKey, JSON.stringify(this.columnWidths));
                console.log('✅ Column widths saved to localStorage for user:', frappe.session.user);
            } catch (e) {
                console.warn('Failed to save to localStorage:', e);
            }
            
            // Also try to save to server
            frappe.call({
                method: 'smart_accounting.www.project_management.index.save_user_column_widths',
                args: {
                    column_widths: this.columnWidths
                },
                callback: (r) => {
                    if (r.message && r.message.success) {
                        console.log('✅ Column widths saved to server for user:', frappe.session.user);
                    } else {
                        console.warn('⚠️ Failed to save to server, localStorage fallback active:', r.message?.error);
                    }
                }
            });
        }, 300); // Reduced debounce for better responsiveness
    }
    
    updateTableWidth() {
        // Calculate total width based on all column widths
        const totalWidth = Object.values(this.columnWidths).reduce((sum, width) => sum + width, 0);
        const minTotalWidth = Math.max(totalWidth, 2000); // Minimum table width
        
        // Update table container widths
        $('.pm-project-table-header, .pm-task-row').css({
            'width': minTotalWidth + 'px',
            'min-width': minTotalWidth + 'px'
        });
    }
    
    resetColumnWidths() {
        // Reset to default widths
        this.columnWidths = this.getDefaultColumnWidths();
        this.applyColumnWidths();
        
        // Clear saved widths on server
        frappe.call({
            method: 'smart_accounting.www.project_management.index.save_user_column_widths',
            args: {
                column_widths: {} // Empty object to clear saved preferences
            },
            callback: (r) => {
                if (r.message && r.message.success) {
                    frappe.show_alert({
                        message: 'Column widths reset to default',
                        indicator: 'blue'
                    });
                }
            }
        });
    }
    
    showColumnContextMenu(e) {
        // Remove existing menu
        $('.pm-column-context-menu').remove();
        
        const menu = $(`
            <div class="pm-column-context-menu">
                <div class="pm-context-menu-item" data-action="reset-widths">
                    <i class="fa fa-refresh"></i>
                    Reset all column widths
                </div>
                <div class="pm-context-menu-item" data-action="auto-fit">
                    <i class="fa fa-arrows-h"></i>
                    Auto-fit columns
                </div>
            </div>
        `);
        
        // Position menu
        menu.css({
            position: 'fixed',
            left: e.clientX + 'px',
            top: e.clientY + 'px',
            zIndex: 10000
        });
        
        $('body').append(menu);
        
        // Bind menu actions
        menu.on('click', '.pm-context-menu-item', (event) => {
            const action = $(event.currentTarget).data('action');
            
            switch(action) {
                case 'reset-widths':
                    this.resetColumnWidths();
                    break;
                case 'auto-fit':
                    this.autoFitColumns();
                    break;
            }
            
            menu.remove();
        });
        
        // Close menu on outside click
        $(document).one('click', () => {
            menu.remove();
        });
    }
    
    autoFitColumns() {
        // Auto-fit columns based on content
        Object.keys(this.columnWidths).forEach(column => {
            const headerCell = $(`.pm-header-cell[data-column="${column}"]`);
            const headerText = headerCell.find('span').text();
            
            // Calculate width based on content
            const tempElement = $('<span>').text(headerText).css({
                'font-size': '11px',
                'font-weight': '600',
                'visibility': 'hidden',
                'position': 'absolute'
            });
            
            $('body').append(tempElement);
            const textWidth = tempElement.outerWidth();
            tempElement.remove();
            
            // Set minimum width based on content + padding
            const newWidth = Math.max(textWidth + 40, 80);
            this.setColumnWidth(column, newWidth);
            this.columnWidths[column] = newWidth;
        });
        
        this.saveColumnWidths();
        
        frappe.show_alert({
            message: 'Columns auto-fitted',
            indicator: 'green'
        });
    }
    
    getCurrentColumnWidths() {
        // Get current column widths (either from stored widths or actual DOM)
        const currentWidths = {};
        
        Object.keys(this.columnWidths).forEach(column => {
            const headerCell = $(`.pm-header-cell[data-column="${column}"]`);
            if (headerCell.length > 0) {
                // Get actual width from DOM
                currentWidths[column] = headerCell.outerWidth() || this.columnWidths[column];
            } else {
                // Fallback to stored width
                currentWidths[column] = this.columnWidths[column];
            }
        });
        
        return currentWidths;
    }
    
    generateNewTaskRowHTML(taskData, clientName, currentWidths, totalWidth, additionalClasses = '') {
        // Generate new task row HTML with current column widths
        return `
            <div class="pm-task-row ${additionalClasses}" data-task-id="${taskData.task_id}" data-task-name="${taskData.task_subject}" style="display: flex; width: 2000px; min-width: 2000px;">
                <div class="pm-cell pm-cell-client pm-client-with-comments" style="width: ${currentWidths.client}px; min-width: ${currentWidths.client}px; flex: 0 0 ${currentWidths.client}px;" data-editable="true" data-field="custom_client" data-task-id="${taskData.task_id}" data-field-type="client_selector" data-current-client-id="" data-current-client-name="${clientName || 'No Client'}">
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
                <div class="pm-cell pm-cell-entity" style="width: ${currentWidths.entity}px; min-width: ${currentWidths.entity}px; flex: 0 0 ${currentWidths.entity}px;">
                    <span class="pm-entity-badge entity-company">Company</span>
                </div>
                <div class="pm-cell pm-cell-tf-tg" style="width: ${currentWidths['tf-tg']}px; min-width: ${currentWidths['tf-tg']}px; flex: 0 0 ${currentWidths['tf-tg']}px;" data-editable="true" data-field="custom_tftg" data-task-id="${taskData.task_id}" data-field-type="select" data-options="TF,TG" data-backend-options="Top Figures,Top Grants">
                    <span class="pm-tf-tg-badge editable-field">TF</span>
                </div>
                <div class="pm-cell pm-cell-software" style="width: ${currentWidths.software}px; min-width: ${currentWidths.software}px; flex: 0 0 ${currentWidths.software}px;" data-editable="true" data-field="custom_software" data-task-id="${taskData.task_id}" data-field-type="select" data-options="Xero,MYOB,QuickBooks,Excel,Other">
                    <span class="pm-software-badge editable-field">Xero</span>
                </div>
                <div class="pm-cell pm-cell-status" style="width: ${currentWidths.status}px; min-width: ${currentWidths.status}px; flex: 0 0 ${currentWidths.status}px;">
                    <span class="pm-status-badge status-open">Open</span>
                </div>
                <div class="pm-cell pm-cell-target-month" style="width: ${currentWidths['target-month']}px; min-width: ${currentWidths['target-month']}px; flex: 0 0 ${currentWidths['target-month']}px;" data-editable="true" data-field="custom_target_month" data-task-id="${taskData.task_id}" data-field-type="select" data-options="January,February,March,April,May,June,July,August,September,October,November,December">
                    <span class="editable-field">-</span>
                </div>
                <div class="pm-cell pm-cell-budget" style="width: ${currentWidths.budget}px; min-width: ${currentWidths.budget}px; flex: 0 0 ${currentWidths.budget}px;" data-editable="true" data-field="custom_budget_planning" data-task-id="${taskData.task_id}" data-field-type="currency">
                    <span class="pm-no-amount editable-field">-</span>
                </div>
                <div class="pm-cell pm-cell-actual" style="width: ${currentWidths.actual}px; min-width: ${currentWidths.actual}px; flex: 0 0 ${currentWidths.actual}px;" data-editable="true" data-field="custom_actual_billing" data-task-id="${taskData.task_id}" data-field-type="currency">
                    <span class="pm-no-amount editable-field">-</span>
                </div>
                                <div class="pm-cell pm-cell-review-note" style="width: ${currentWidths['review-note']}px; min-width: ${currentWidths['review-note']}px; flex: 0 0 ${currentWidths['review-note']}px;">
                                    <div class="pm-review-note-indicator no-notes">
                                        <i class="fa fa-times-circle"></i>
                                        <span>none</span>
                                    </div>
                                </div>
                <div class="pm-cell pm-cell-action-person" style="width: ${currentWidths['action-person']}px; min-width: ${currentWidths['action-person']}px; flex: 0 0 ${currentWidths['action-person']}px;" data-editable="true" data-field="custom_action_person" data-task-id="${taskData.task_id}" data-field-type="person_selector">
                    <div class="pm-user-avatars editable-field pm-empty-person">
                        <div class="pm-avatar pm-empty-avatar">
                            <i class="fa fa-user"></i>
                        </div>
                    </div>
                </div>
                <div class="pm-cell pm-cell-preparer" style="width: ${currentWidths.preparer}px; min-width: ${currentWidths.preparer}px; flex: 0 0 ${currentWidths.preparer}px;" data-editable="true" data-field="custom_preparer" data-task-id="${taskData.task_id}" data-field-type="person_selector">
                    <div class="pm-user-avatars editable-field pm-empty-person">
                        <div class="pm-avatar pm-empty-avatar">
                            <i class="fa fa-user"></i>
                        </div>
                    </div>
                </div>
                <div class="pm-cell pm-cell-reviewer" style="width: ${currentWidths.reviewer}px; min-width: ${currentWidths.reviewer}px; flex: 0 0 ${currentWidths.reviewer}px;" data-editable="true" data-field="custom_reviewer" data-task-id="${taskData.task_id}" data-field-type="person_selector">
                    <div class="pm-user-avatars editable-field pm-empty-person">
                        <div class="pm-avatar pm-empty-avatar">
                            <i class="fa fa-user"></i>
                        </div>
                    </div>
                </div>
                <div class="pm-cell pm-cell-partner" style="width: ${currentWidths.partner}px; min-width: ${currentWidths.partner}px; flex: 0 0 ${currentWidths.partner}px;" data-editable="true" data-field="custom_partner" data-task-id="${taskData.task_id}" data-field-type="person_selector">
                    <div class="pm-user-avatars editable-field pm-empty-person">
                        <div class="pm-avatar pm-empty-avatar">
                            <i class="fa fa-user"></i>
                        </div>
                    </div>
                </div>
                <div class="pm-cell pm-cell-lodgment-due" style="width: ${currentWidths['lodgment-due']}px; min-width: ${currentWidths['lodgment-due']}px; flex: 0 0 ${currentWidths['lodgment-due']}px;">
                    <span class="pm-no-date">-</span>
                </div>
                <div class="pm-cell pm-cell-year-end" style="width: ${currentWidths['year-end']}px; min-width: ${currentWidths['year-end']}px; flex: 0 0 ${currentWidths['year-end']}px;">-</div>
                <div class="pm-cell pm-cell-last-updated" style="width: ${currentWidths['last-updated']}px; min-width: ${currentWidths['last-updated']}px; flex: 0 0 ${currentWidths['last-updated']}px;">
                    <span class="pm-last-updated">Just now</span>
                </div>
                <div class="pm-cell pm-cell-priority" style="width: ${currentWidths.priority}px; min-width: ${currentWidths.priority}px; flex: 0 0 ${currentWidths.priority}px;">
                    <span class="pm-priority-badge priority-medium">Medium</span>
                </div>
            </div>
        `;
    }
    
    // Clear all editing states
    clearAllEditingStates() {
        // Remove editing class from all cells
        $('.pm-cell.editing').removeClass('editing');
        
        // Close all dropdowns and modals
        this.closeAllDropdowns();
        $('.pm-person-selector-modal').remove();
        $('.pm-contact-dropdown').remove();
        $('.pm-person-tooltip').remove();
        
        // Clean up event listeners
        $(document).off('click.person-selector click.contact-dropdown');
    }
    
    // Unified Dropdown Management
    closeAllDropdowns() {
        // Close all dropdown menus
        $('.pm-new-task-menu').hide();
        $('.pm-person-filter-menu').hide();
        $('.pm-client-filter-menu').hide();
        $('.pm-status-filter-menu').hide();
        $('.pm-advanced-filter-panel').hide();
        
        // Remove active states
        $('.pm-new-task-dropdown').removeClass('active');
        $('.pm-person-filter-dropdown').removeClass('active');
        $('.pm-client-filter-dropdown').removeClass('active');
        $('.pm-status-filter-dropdown').removeClass('active');
        $('.pm-advanced-filter-dropdown').removeClass('active');
    }
    
    openDropdown(dropdownClass, menuClass) {
        const $dropdown = $(`.${dropdownClass}`);
        const $menu = $(`.${menuClass}`);
        const $btn = $dropdown.find('button').first();
        
        // If this dropdown is already open, close it
        if ($menu.is(':visible')) {
            this.closeAllDropdowns();
            return;
        }
        
        // Close all other dropdowns first
        this.closeAllDropdowns();
        
        // Position the dropdown menu properly
        this.positionDropdownMenu($btn, $menu);
        
        // Show the menu and add active state
        $menu.show();
        $dropdown.addClass('active');
    }
    
    positionDropdownMenu($button, $menu) {
        // Get button position and dimensions
        const btnOffset = $button.offset();
        const btnHeight = $button.outerHeight();
        const btnWidth = $button.outerWidth();
        const menuWidth = $menu.outerWidth();
        const menuHeight = $menu.outerHeight();
        const windowWidth = $(window).width();
        const windowHeight = $(window).height();
        const scrollTop = $(window).scrollTop();
        
        // Calculate initial position below button
        let left = btnOffset.left;
        let top = btnOffset.top + btnHeight + 5; // 5px gap
        
        // Adjust horizontal position if menu goes beyond screen edges
        if (left + menuWidth > windowWidth - 20) {
            left = btnOffset.left + btnWidth - menuWidth;
        }
        if (left < 20) {
            left = 20;
        }
        
        // Adjust vertical position if menu goes beyond bottom of screen
        if (top + menuHeight > scrollTop + windowHeight - 20) {
            top = btnOffset.top - menuHeight - 5; // Show above button
        }
        
        // Ensure menu doesn't go above viewport
        if (top < scrollTop + 20) {
            top = scrollTop + 20;
        }
        
        // Set position with higher z-index for modals
        const zIndex = $menu.hasClass('pm-person-selector-modal') ? 1001 : 1000;
        
        $menu.css({
            position: 'fixed',
            top: top + 'px',
            left: left + 'px',
            zIndex: zIndex
        });
    }

    // Person Selector and Tooltip Functions
    showPersonSelector($cell, taskId, fieldName) {
        // Get current person emails
        const currentEmails = [];
        $cell.find('.pm-avatar[data-email]').each(function() {
            const email = $(this).data('email');
            if (email) currentEmails.push(email);
        });
        
        // Create person selector dropdown outside the table
        const selectorHTML = `
            <div class="pm-person-selector-modal" id="pm-person-selector-${taskId}-${fieldName}">
                <div class="pm-person-selector-content">
                    <div class="pm-person-selector-header">
                        <input type="text" class="pm-person-search" placeholder="Search names, roles or teams" value="">
                        <button class="pm-person-selector-close">
                            <i class="fa fa-times"></i>
                        </button>
                    </div>
                    <div class="pm-person-selector-body">
                        ${currentEmails.length > 0 ? `
                            <div class="pm-current-people">
                                <div class="pm-current-person-list">
                                    ${currentEmails.map(email => {
                                        const avatar = $cell.find(`[data-email="${email}"]`);
                                        const name = avatar.attr('title') || email;
                                        return `
                                            <div class="pm-current-person" data-email="${email}">
                                                <div class="pm-avatar" style="background: ${this.getAvatarColor(name)}">
                                                    ${this.getInitials(name)}
                                                </div>
                                                <span class="pm-person-name">${name.split(' ')[0]}</span>
                                                <button class="pm-remove-person" data-email="${email}">
                                                    <i class="fa fa-times"></i>
                                                </button>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                        ` : ''}
                        <h4>Suggested people</h4>
                        <div class="pm-person-options">
                            <div class="pm-person-option pm-clear-person" data-email="">
                                <div class="pm-avatar pm-empty-avatar">
                                    <i class="fa fa-user"></i>
                                </div>
                                <div class="pm-person-info">
                                    <div class="pm-person-name">No assignment</div>
                                    <div class="pm-person-email">Clear current assignment</div>
                                </div>
                            </div>
                        </div>
                        <div class="pm-person-list">
                            <!-- People will be loaded dynamically -->
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing selector
        $('.pm-person-selector-modal').remove();
        
        // Add to body
        $('body').append(selectorHTML);
        const $selector = $(`#pm-person-selector-${taskId}-${fieldName}`);
        
        // Position the modal properly relative to cell
        this.positionModalRelativeToCell($cell, $selector);
        
        // Show with animation
        $selector.fadeIn(200);
        
        // Focus search input
        const $searchInput = $selector.find('.pm-person-search');
        $searchInput.focus();
        
        // Load all people
        this.loadPeopleForSelector($selector.find('.pm-person-list'));
        
        // Bind events
        $searchInput.on('input', (e) => {
            this.searchPeopleForSelector(e.target.value, $selector.find('.pm-person-list'));
        });
        
        $selector.on('click', '.pm-person-option', (e) => {
            e.stopPropagation();
            const email = $(e.currentTarget).data('email');
            const name = $(e.currentTarget).data('name') || '';
            this.selectPerson($cell, taskId, fieldName, email, name);
            $selector.remove();
        });
        
        $selector.find('.pm-person-selector-close').on('click', () => {
            this.cancelPersonSelection($cell);
            $selector.remove();
        });
        
        // Remove person button
        $selector.on('click', '.pm-remove-person', (e) => {
            e.stopPropagation();
            const emailToRemove = $(e.currentTarget).data('email');
            this.removePerson($cell, taskId, fieldName, emailToRemove);
            $selector.remove();
        });
        
        // Close on outside click
        setTimeout(() => {
            $(document).on('click.person-selector', (e) => {
                if (!$(e.target).closest('.pm-person-selector-modal').length) {
                    this.cancelPersonSelection($cell);
                    $('.pm-person-selector-modal').remove();
                    $(document).off('click.person-selector');
                }
            });
        }, 100);
    }
    
    
    positionModalRelativeToCell($cell, $modal) {
        const cellOffset = $cell.offset();
        const cellHeight = $cell.outerHeight();
        const cellWidth = $cell.outerWidth();
        const modalWidth = 320;
        const modalHeight = 400;
        const windowWidth = $(window).width();
        const windowHeight = $(window).height();
        const scrollTop = $(window).scrollTop();
        const scrollLeft = $(window).scrollLeft();
        
        // Calculate position - prefer right side of cell
        let left = cellOffset.left + cellWidth + 10;
        let top = cellOffset.top;
        
        // If modal would go off right edge, position on left side
        if (left + modalWidth > scrollLeft + windowWidth - 20) {
            left = cellOffset.left - modalWidth - 10;
        }
        
        // If still off left edge, center horizontally
        if (left < scrollLeft + 20) {
            left = cellOffset.left - (modalWidth / 2) + (cellWidth / 2);
            // Position below cell if centered
            top = cellOffset.top + cellHeight + 10;
        }
        
        // Adjust vertical position if modal goes off bottom
        if (top + modalHeight > scrollTop + windowHeight - 20) {
            top = cellOffset.top - modalHeight + cellHeight;
        }
        
        // Ensure modal stays within viewport
        if (top < scrollTop + 20) {
            top = scrollTop + 20;
        }
        if (left < scrollLeft + 20) {
            left = scrollLeft + 20;
        }
        
        $modal.css({
            position: 'fixed',
            left: left + 'px',
            top: top + 'px',
            zIndex: 1001
        });
    }
    
    async loadPeopleForSelector($container) {
        try {
            // Get all enabled users with roles
            const response = await frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'User',
                    fields: ['name', 'email', 'full_name', 'user_image', 'role_profile_name'],
                    filters: [
                        ['enabled', '=', 1],
                        ['user_type', '=', 'System User'],
                        ['name', '!=', 'Guest']
                    ],
                    limit_page_length: 50,
                    order_by: 'full_name asc'
                }
            });
            
            if (response.message && response.message.length > 0) {
                const peopleHTML = response.message.map(user => {
                    const displayName = user.full_name || user.email;
                    const role = user.role_profile_name || 'System User';
                    return `
                        <div class="pm-person-option" data-email="${user.email}" data-name="${displayName}">
                            <div class="pm-avatar" style="background: ${this.getAvatarColor(displayName)}">
                                ${this.getInitials(displayName)}
                            </div>
                            <div class="pm-person-info">
                                <div class="pm-person-name">${displayName}</div>
                                <div class="pm-person-role">${role}</div>
                            </div>
                        </div>
                    `;
                }).join('');
                
                $container.html(peopleHTML);
            } else {
                $container.html('<div class="pm-no-people">No users found</div>');
            }
        } catch (error) {
            console.error('Error loading people:', error);
            $container.html('<div class="pm-no-people">Error loading users</div>');
        }
    }
    
    searchPeopleForSelector(query, $container) {
        if (!query) {
            this.loadPeopleForSelector($container);
            return;
        }
        
        // Filter existing options
        $container.find('.pm-person-option').each(function() {
            const name = $(this).data('name') || '';
            const email = $(this).data('email') || '';
            const visible = name.toLowerCase().includes(query.toLowerCase()) || 
                           email.toLowerCase().includes(query.toLowerCase());
            $(this).toggle(visible);
        });
    }
    
    async selectPerson($cell, taskId, fieldName, email, name) {
        try {
            // Update task field
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.update_task_field',
                args: {
                    task_id: taskId,
                    field_name: fieldName,
                    new_value: email
                }
            });
            
            if (response.message && response.message.success) {
                // Update UI
                this.updatePersonFieldDisplay($cell, email, name);
                
                frappe.show_alert({
                    message: 'Person assignment updated',
                    indicator: 'green'
                });
            } else {
                throw new Error(response.message?.error || 'Update failed');
            }
        } catch (error) {
            console.error('Error updating person:', error);
            frappe.show_alert({
                message: 'Failed to update assignment',
                indicator: 'red'
            });
            this.cancelPersonSelection($cell);
        }
        
        // Clean up
        $(document).off('click.person-selector');
    }
    
    updatePersonFieldDisplay($cell, email, name) {
        if (!email) {
            // Show empty state
            $cell.html(`
                <div class="pm-user-avatars editable-field pm-empty-person">
                    <div class="pm-avatar pm-empty-avatar">
                        <i class="fa fa-user"></i>
                    </div>
                </div>
            `);
        } else {
            // Show person
            const initials = this.getInitials(name);
            const color = this.getAvatarColor(name);
            $cell.html(`
                <div class="pm-user-avatars editable-field">
                    <div class="pm-avatar" title="${name}" data-email="${email}" style="background: ${color}">
                        ${initials}
                    </div>
                </div>
            `);
        }
        $cell.removeClass('editing');
    }
    
    async removePerson($cell, taskId, fieldName, emailToRemove) {
        try {
            // Update task field to remove this person
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.update_task_field',
                args: {
                    task_id: taskId,
                    field_name: fieldName,
                    new_value: ''
                }
            });
            
            if (response.message && response.message.success) {
                // Update UI to empty state
                this.updatePersonFieldDisplay($cell, '', '');
                
                frappe.show_alert({
                    message: 'Person removed',
                    indicator: 'orange'
                });
            }
        } catch (error) {
            console.error('Error removing person:', error);
            frappe.show_alert({
                message: 'Failed to remove person',
                indicator: 'red'
            });
        }
        
        $(document).off('click.person-selector');
    }
    
    cancelPersonSelection($cell) {
        // Get original content from data attributes or restore from server
        const taskId = $cell.data('task-id');
        const fieldName = $cell.data('field');
        
        // Restore from current data without making server call
        this.restorePersonFieldFromData($cell, taskId, fieldName);
        
        $cell.removeClass('editing');
        $(document).off('click.person-selector');
    }
    
    async restorePersonFieldFromData($cell, taskId, fieldName) {
        try {
            // Get fresh data from server to restore accurate state
            const response = await frappe.call({
                method: 'frappe.client.get',
                args: {
                    doctype: 'Task',
                    name: taskId,
                    fields: [fieldName]
                }
            });
            
            if (response.message) {
                const currentValue = response.message[fieldName];
                if (currentValue) {
                    // Get user info and restore display
                    const userResponse = await frappe.call({
                        method: 'frappe.client.get',
                        args: {
                            doctype: 'User',
                            name: currentValue,
                            fields: ['full_name', 'email']
                        }
                    });
                    
                    if (userResponse.message) {
                        const user = userResponse.message;
                        const displayName = user.full_name || user.email;
                        this.updatePersonFieldDisplay($cell, user.email, displayName);
                        return;
                    }
                }
            }
            
            // If no data, show empty state
            this.updatePersonFieldDisplay($cell, '', '');
            
        } catch (error) {
            console.error('Error restoring field data:', error);
            // Show empty state on error
            this.updatePersonFieldDisplay($cell, '', '');
        }
    }
    
    showPersonTooltip(avatarElement) {
        const $avatar = $(avatarElement);
        const email = $avatar.data('email');
        const name = $avatar.attr('title') || email;
        
        if (!email) return;
        
        // Create tooltip
        const tooltipHTML = `
            <div class="pm-person-tooltip">
                <div class="pm-person-tooltip-header">
                    <div class="pm-person-tooltip-avatar" style="background: ${this.getAvatarColor(name)}">
                        ${this.getInitials(name)}
                    </div>
                    <div class="pm-person-tooltip-info">
                        <h4>${name}</h4>
                        <p>Team Member</p>
                        <p>9:32 AM, Sydney</p>
                    </div>
                </div>
                <div class="pm-person-tooltip-actions">
                    <button class="pm-person-tooltip-action pm-contact-details-btn" data-email="${email}">
                        Contact Details <i class="fa fa-chevron-down"></i>
                    </button>
                    <button class="pm-person-tooltip-action">Ask for an update</button>
                </div>
            </div>
        `;
        
        // Remove existing tooltip
        $('.pm-person-tooltip').remove();
        
        // Add to body
        $('body').append(tooltipHTML);
        
        // Position tooltip
        const $tooltip = $('.pm-person-tooltip');
        const avatarOffset = $avatar.offset();
        const avatarHeight = $avatar.outerHeight();
        
        // Use unified positioning for tooltip
        this.positionDropdownMenu($avatar, $tooltip);
        $tooltip.show();
        
        // Bind contact details click in tooltip
        $tooltip.on('click', '.pm-contact-details-btn', (e) => {
            e.stopPropagation();
            const email = $(e.currentTarget).data('email');
            this.showContactDropdown(e.currentTarget, email);
        });
    }
    
    hidePersonTooltip() {
        $('.pm-person-tooltip').remove();
    }
    
    getInitials(name) {
        if (!name) return '?';
        const parts = name.split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }
    
    getAvatarColor(name) {
        const colors = [
            '#0073ea', '#00c875', '#ff5ac4', '#ffcb00', '#a25ddc',
            '#ff642e', '#66ccff', '#bb3354', '#9cd326', '#784bd1'
        ];
        let hash = 0;
        for (let i = 0; i < (name || '').length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    }
    
    getUserRole(email) {
        const roleMap = {
            'admin': 'Administrator',
            'manager': 'Manager', 
            'partner': 'Partner',
            'senior': 'Senior',
            'junior': 'Junior'
        };
        
        const emailLower = email.toLowerCase();
        for (const [key, role] of Object.entries(roleMap)) {
            if (emailLower.includes(key)) {
                return role;
            }
        }
        return 'Team Member';
    }
    
    async showContactDropdown(button, email) {
        $('.pm-contact-dropdown').remove();
        
        // Get user details for contact info
        let contactItems = [];
        
        // Always show email
        contactItems.push(`
            <div class="pm-contact-item" data-action="email" data-contact="${email}">
                <i class="fa fa-envelope"></i>
                <span>Email: ${email}</span>
            </div>
        `);
        
        // Try to get phone from user profile
        try {
            const userResponse = await frappe.call({
                method: 'frappe.client.get',
                args: {
                    doctype: 'User',
                    name: email,
                    fields: ['phone', 'mobile_no']
                }
            });
            
            if (userResponse.message) {
                const phone = userResponse.message.phone || userResponse.message.mobile_no;
                if (phone) {
                    contactItems.push(`
                        <div class="pm-contact-item" data-action="phone" data-contact="${phone}">
                            <i class="fa fa-phone"></i>
                            <span>Phone: ${phone}</span>
                        </div>
                    `);
                }
            }
        } catch (error) {
            console.log('Could not load phone number');
        }
        
        const dropdownHTML = `
            <div class="pm-contact-dropdown">
                ${contactItems.join('')}
            </div>
        `;
        
        $('body').append(dropdownHTML);
        const $dropdown = $('.pm-contact-dropdown');
        const btnOffset = $(button).offset();
        
        // Use unified positioning for contact dropdown
        this.positionDropdownMenu($(button), $dropdown);
        $dropdown.show();
        
        $dropdown.on('click', '.pm-contact-item', (e) => {
            const action = $(e.currentTarget).data('action');
            const contact = $(e.currentTarget).data('contact');
            this.handleContactAction(action, contact);
            $dropdown.remove();
        });
        
        setTimeout(() => {
            $(document).on('click.contact-dropdown', (e) => {
                if (!$(e.target).closest('.pm-contact-dropdown').length) {
                    $dropdown.remove();
                    $(document).off('click.contact-dropdown');
                }
            });
        }, 100);
    }
    
    handleContactAction(action, contact) {
        switch(action) {
            case 'email':
                window.open(`mailto:${contact}`);
                break;
            case 'phone':
                window.open(`tel:${contact}`);
                break;
            default:
                frappe.show_alert({message: 'Contact action completed', indicator: 'blue'});
        }
    }

    // Advanced Filter Functionality
    initializeAdvancedFilter() {
        this.activeFilters = [];
        this.bindAdvancedFilterEvents();
        this.updateTaskCount();
    }

    bindAdvancedFilterEvents() {
        // Toggle filter panel
        $(document).on('click', '.pm-advanced-filter-btn', (e) => {
            e.stopPropagation();
            this.openDropdown('pm-advanced-filter-dropdown', 'pm-advanced-filter-panel');
        });

        // Close filter panel
        $(document).on('click', '.pm-filter-close', () => {
            this.closeAllDropdowns();
        });

        // Column selection change
        $(document).on('change', '.pm-filter-column', (e) => {
            this.updateValueOptions($(e.target));
        });

        // Apply filters when condition changes (real-time filtering)
        $(document).on('change', '.pm-filter-column, .pm-filter-condition-type, .pm-filter-value', () => {
            this.applyAdvancedFilters();
        });

        // Remove filter condition
        $(document).on('click', '.pm-filter-remove', (e) => {
            $(e.target).closest('.pm-filter-condition').remove();
            this.applyAdvancedFilters();
            this.updateRemoveButtons();
        });

        // Add new filter
        $(document).on('click', '.pm-add-filter', () => {
            this.addNewFilterCondition();
        });

        // Clear all filters
        $(document).on('click', '.pm-clear-all', () => {
            this.clearAllFilters();
        });

        // Click outside handling is now managed by unified dropdown system
    }

    updateValueOptions($columnSelect) {
        const column = $columnSelect.val();
        const $valueSelect = $columnSelect.closest('.pm-filter-condition').find('.pm-filter-value');
        
        // Clear existing options
        $valueSelect.empty().append('<option value="">Value</option>');
        
        if (!column) return;
        
        // Get unique values for selected column
        const values = new Set();
        $('.pm-task-row').each((i, row) => {
            const $row = $(row);
            let value = '';
            
            switch (column) {
                case 'client_name':
                    value = $row.find('.pm-cell-client .client-display').text().trim();
                    break;
                case 'entity':
                    value = $row.find('.pm-cell-entity .pm-entity-badge').text().trim();
                    break;
                case 'tf_tg':
                    value = $row.find('.pm-cell-tf-tg .pm-tf-tg-badge').text().trim();
                    break;
                case 'software':
                    value = $row.find('.pm-cell-software .pm-software-badge').text().trim();
                    break;
                case 'status':
                    value = $row.find('.pm-cell-status .pm-status-badge').text().trim();
                    break;
                case 'target_month':
                    value = $row.find('.pm-cell-target-month .editable-field').text().trim();
                    break;
            }
            
            if (value && value !== '-' && value !== 'No Client') {
                values.add(value);
            }
        });
        
        // Add options to select
        Array.from(values).sort().forEach(value => {
            $valueSelect.append(`<option value="${value}">${value}</option>`);
        });
    }

    applyAdvancedFilters() {
        const filters = [];
        
        // Collect all filter conditions
        $('.pm-filter-condition').each((i, condition) => {
            const $condition = $(condition);
            const column = $condition.find('.pm-filter-column').val();
            const conditionType = $condition.find('.pm-filter-condition-type').val();
            const value = $condition.find('.pm-filter-value').val();
            
            if (column && conditionType && (value || conditionType === 'is_empty' || conditionType === 'is_not_empty')) {
                filters.push({ column, condition: conditionType, value });
            }
        });
        
        this.activeFilters = filters;
        this.filterTasks();
        this.updateTaskCount();
    }

    filterTasks() {
        $('.pm-task-row').each((i, row) => {
            const $row = $(row);
            let shouldShow = true;
            
            // Apply each filter
            this.activeFilters.forEach(filter => {
                const cellValue = this.getCellValue($row, filter.column);
                
                switch (filter.condition) {
                    case 'equals':
                        if (cellValue !== filter.value) shouldShow = false;
                        break;
                    case 'contains':
                        if (!cellValue.toLowerCase().includes(filter.value.toLowerCase())) shouldShow = false;
                        break;
                    case 'not_equals':
                        if (cellValue === filter.value) shouldShow = false;
                        break;
                    case 'is_empty':
                        if (cellValue && cellValue !== '-') shouldShow = false;
                        break;
                    case 'is_not_empty':
                        if (!cellValue || cellValue === '-') shouldShow = false;
                        break;
                }
            });
            
            if (shouldShow) {
                $row.show();
            } else {
                $row.hide();
            }
        });
        
        // Hide/show project groups based on visible tasks
        this.updateProjectVisibility();
    }

    getCellValue($row, column) {
        switch (column) {
            case 'client_name':
                return $row.find('.pm-cell-client .client-display').text().trim();
            case 'entity':
                return $row.find('.pm-cell-entity .pm-entity-badge').text().trim();
            case 'tf_tg':
                return $row.find('.pm-cell-tf-tg .pm-tf-tg-badge').text().trim();
            case 'software':
                return $row.find('.pm-cell-software .pm-software-badge').text().trim();
            case 'status':
                return $row.find('.pm-cell-status .pm-status-badge').text().trim();
            case 'target_month':
                return $row.find('.pm-cell-target-month .editable-field').text().trim();
            default:
                return '';
        }
    }

    addNewFilterCondition() {
        const conditionIndex = $('.pm-filter-condition').length;
        const newCondition = `
            <div class="pm-filter-condition" data-index="${conditionIndex}">
                <div class="pm-filter-where">And</div>
                <select class="pm-filter-column">
                    <option value="">Column</option>
                    <option value="client_name">Client Name</option>
                    <option value="entity">Entity</option>
                    <option value="tf_tg">TF/TG</option>
                    <option value="software">Software</option>
                    <option value="status">Status</option>
                    <option value="target_month">Target Month</option>
                    <option value="budget">Budget</option>
                    <option value="actual">Actual</option>
                </select>
                <select class="pm-filter-condition-type">
                    <option value="">Condition</option>
                    <option value="equals">equals</option>
                    <option value="not_equals">doesn't equal</option>
                </select>
                <select class="pm-filter-value">
                    <option value="">Value</option>
                </select>
                <button class="pm-filter-remove">
                    <i class="fa fa-times"></i>
                </button>
            </div>
        `;
        
        $('.pm-filter-conditions').append(newCondition);
        this.updateRemoveButtons();
    }

    updateRemoveButtons() {
        const $conditions = $('.pm-filter-condition');
        
        if ($conditions.length > 1) {
            $conditions.find('.pm-filter-remove').show();
        } else {
            $conditions.find('.pm-filter-remove').hide();
        }
    }

    clearAllFilters() {
        $('.pm-filter-conditions').html(`
            <div class="pm-filter-condition">
                <div class="pm-filter-where">Where</div>
                <select class="pm-filter-column">
                    <option value="">Column</option>
                    <option value="client_name">Client Name</option>
                    <option value="entity">Entity</option>
                    <option value="tf_tg">TF/TG</option>
                    <option value="software">Software</option>
                    <option value="status">Status</option>
                    <option value="target_month">Target Month</option>
                    <option value="budget">Budget</option>
                    <option value="actual">Actual</option>
                </select>
                <select class="pm-filter-condition-type">
                    <option value="">Condition</option>
                    <option value="equals">equals</option>
                    <option value="not_equals">doesn't equal</option>
                </select>
                <select class="pm-filter-value">
                    <option value="">Value</option>
                </select>
            </div>
        `);
        
        this.activeFilters = [];
        $('.pm-task-row').show();
        this.updateProjectVisibility();
        this.updateTaskCount();
    }

    updateTaskCount() {
        const totalTasks = $('.pm-task-row:not(.pm-add-task-row)').length;
        const visibleTasks = $('.pm-task-row:not(.pm-add-task-row):visible').length;
        
        $('#total-tasks').text(totalTasks);
        
        if (this.activeFilters.length > 0) {
            $('.pm-filter-count').html(`Showing ${visibleTasks} of ${totalTasks} tasks`);
        } else {
            $('.pm-filter-count').html(`Showing all of ${totalTasks} tasks`);
        }
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
            const statusClass = this.getStatusClass(status);
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

    getStatusClass(status) {
        // Convert status to CSS-friendly class name
        return status.toLowerCase().replace(/[^a-z0-9]/g, '-');
    }

    applyStatusColor($badge, status) {
        const colors = [
            'var(--monday-orange)',
            'var(--monday-blue)', 
            'var(--monday-green)',
            'var(--monday-red)',
            'var(--monday-purple)',
            'var(--monday-pink)',
            '#9333ea', '#059669', '#dc2626', '#ea580c', '#7c3aed', '#0891b2'
        ];
        
        const statusIndex = this.statusOptions.indexOf(status);
        const color = colors[statusIndex % colors.length];
        
        $badge.css('background-color', color);
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
            const statusClass = this.getStatusClass(status);
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
                this.applyStatusColor($badge, status);
                // Also update CSS class
                $badge.addClass(`status-${this.getStatusClass(status)}`);
            }
        });
    }

    // Comment System Methods
    async showCommentModal(taskId) {
        try {
            // Get task info first
            const taskResponse = await frappe.call({
                method: 'frappe.client.get',
                args: {
                    doctype: 'Task',
                    name: taskId,
                    fields: ['subject']
                }
            });

            const taskSubject = taskResponse.message ? taskResponse.message.subject : `Task ${taskId}`;
            
            // Create modal HTML
            const modalHTML = `
                <div class="pm-comment-modal" id="pm-comment-modal-${taskId}">
                    <div class="pm-comment-modal-content">
                        <div class="pm-comment-modal-header">
                            <h3 class="pm-comment-modal-title">Updates - ${taskSubject}</h3>
                            <div class="pm-comment-modal-tabs">
                                <button class="pm-comment-tab active" data-tab="comments">
                                    <i class="fa fa-comment"></i> Comments
                                </button>
                                <button class="pm-comment-tab" data-tab="activity">
                                    <i class="fa fa-history"></i> Activity Log
                                </button>
                            </div>
                            <button class="pm-comment-modal-close">
                                <i class="fa fa-times"></i>
                            </button>
                        </div>
                        <div class="pm-comment-modal-body">
                            <div class="pm-tab-content">
                                <div class="pm-comment-list pm-tab-panel active" id="pm-comment-list-${taskId}" data-tab="comments">
                                    <div class="pm-comment-loading">
                                        <i class="fa fa-spinner fa-spin"></i> Loading comments...
                                    </div>
                                </div>
                                <div class="pm-activity-list pm-tab-panel" id="pm-activity-list-${taskId}" data-tab="activity" style="display: none;">
                                    <div class="pm-activity-loading">
                                        <i class="fa fa-spinner fa-spin"></i> Loading activity...
                                    </div>
                                </div>
                            </div>
                            <div class="pm-comment-input-area">
                                <div class="pm-comment-input-container">
                                    <textarea class="pm-comment-input" placeholder="Write a comment... (Type @ to mention someone)" data-task-id="${taskId}"></textarea>
                                    <div class="pm-mention-dropdown" id="pm-mention-dropdown-${taskId}" style="display: none;">
                                        <!-- Mention suggestions will appear here -->
                                    </div>
                                </div>
                                <div class="pm-comment-input-footer">
                                    <div class="pm-comment-input-info">
                                        Press Ctrl+Enter to send • Type @ to mention
                                    </div>
                                    <button class="pm-comment-submit" data-task-id="${taskId}">
                                        Send Comment
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Remove existing modal
            $('.pm-comment-modal').remove();
            
            // Add modal to body
            $('body').append(modalHTML);
            
            // Show modal
            $(`#pm-comment-modal-${taskId}`).fadeIn(200);
            
            // Load comments
            await this.loadComments(taskId);
            
            // Focus on input
            $('.pm-comment-input').focus();
            
            // Handle Ctrl+Enter and @ mentions
            $('.pm-comment-input').on('keydown', (e) => {
                if (e.ctrlKey && e.key === 'Enter') {
                    e.preventDefault();
                    this.submitComment();
                } else if (e.key === 'Escape') {
                    this.hideMentionDropdown(taskId);
                } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    if ($(`#pm-mention-dropdown-${taskId}`).is(':visible')) {
                        e.preventDefault();
                        this.navigateMentions(taskId, e.key === 'ArrowDown' ? 1 : -1);
                    }
                } else if (e.key === 'Enter' && $(`#pm-mention-dropdown-${taskId}`).is(':visible')) {
                    e.preventDefault();
                    this.selectCurrentMention(taskId);
                }
            });
            
            // Handle @ mention typing
            $('.pm-comment-input').on('input', (e) => {
                this.handleMentionInput(e.target, taskId);
            });
            
            // Handle tab switching
            $('.pm-comment-tab').on('click', (e) => {
                const tab = $(e.currentTarget).data('tab');
                this.switchCommentTab(taskId, tab);
            });
            
        } catch (error) {
            console.error('Error showing comment modal:', error);
            frappe.show_alert({
                message: 'Failed to open comments',
                indicator: 'red'
            });
        }
    }
    
    async loadComments(taskId) {
        if (!taskId) {
            console.error('Task ID is required to load comments');
            return;
        }
        
        try {
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.get_task_comments',
                args: {
                    task_id: taskId
                }
            });
            
            if (response.message && response.message.success) {
                const comments = response.message.comments || [];
                this.renderComments(taskId, comments);
                
                // Update comment count in the table
                const commentCount = response.message.count || comments.length;
                this.updateCommentCount(taskId, commentCount);
            } else {
                throw new Error(response.message?.error || 'Failed to load comments');
            }
        } catch (error) {
            console.error('Error loading comments:', error);
            const $commentList = $(`#pm-comment-list-${taskId}`);
            if ($commentList.length > 0) {
                $commentList.html(`
                    <div class="pm-comment-empty">
                        <i class="fa fa-exclamation-triangle"></i>
                        <h4>Failed to load comments</h4>
                        <p>Please try again later</p>
                        <button class="pm-btn pm-btn-secondary" onclick="window.projectManagement.loadComments('${taskId}')">
                            <i class="fa fa-refresh"></i> Retry
                        </button>
                    </div>
                `);
            }
        }
    }
    
    renderComments(taskId, comments) {
        const $commentList = $(`#pm-comment-list-${taskId}`);
        
        if (!comments || comments.length === 0) {
            $commentList.html(`
                <div class="pm-comment-empty">
                    <i class="fa fa-comment-o"></i>
                    <h4>No comments yet</h4>
                    <p>Be the first to add a comment!</p>
                </div>
            `);
            return;
        }
        
        let html = '';
        comments.forEach(comment => {
            const timeAgo = this.formatTimeAgo(comment.creation);
            const initials = this.getInitials(comment.comment_by);
            const avatarColor = this.getAvatarColor(comment.comment_by);
            
            html += `
                <div class="pm-comment-item" data-comment-id="${comment.name}">
                    <div class="pm-comment-avatar" style="background: ${avatarColor}">
                        ${initials}
                    </div>
                    <div class="pm-comment-content">
                        <div class="pm-comment-header">
                            <span class="pm-comment-author">${comment.comment_by}</span>
                            <span class="pm-comment-time">${timeAgo}</span>
                        </div>
                        <div class="pm-comment-text">${this.escapeHtml(comment.content)}</div>
                        <div class="pm-comment-actions">
                            <button class="pm-comment-action" data-action="reply" data-comment-id="${comment.name}">
                                Reply
                            </button>
                            ${comment.can_edit ? `
                                <button class="pm-comment-action" data-action="edit" data-comment-id="${comment.name}">
                                    Edit
                                </button>
                            ` : ''}
                            ${comment.can_delete ? `
                                <button class="pm-comment-action" data-action="delete" data-comment-id="${comment.name}">
                                    Delete
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        });
        
        $commentList.html(html);
    }
    
    async submitComment() {
        const $input = $('.pm-comment-input');
        const taskId = $input.data('task-id');
        const content = $input.val().trim();
        
        if (!content) {
            frappe.show_alert({
                message: 'Please enter a comment',
                indicator: 'orange'
            });
            return;
        }
        
        try {
            // Disable submit button
            const $submitBtn = $('.pm-comment-submit');
            $submitBtn.prop('disabled', true).text('Sending...');
            
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.add_task_comment',
                args: {
                    task_id: taskId,
                    comment_content: content
                }
            });
            
            if (response.message && response.message.success) {
                // Clear input
                $input.val('');
                
                // Reload comments
                await this.loadComments(taskId);
                
                // Update comment count in table
                this.updateCommentCount(taskId, response.message.comment_count);
                
                frappe.show_alert({
                    message: 'Comment added successfully',
                    indicator: 'green'
                });
            } else {
                throw new Error(response.message?.error || 'Failed to add comment');
            }
        } catch (error) {
            console.error('Error submitting comment:', error);
            frappe.show_alert({
                message: 'Failed to add comment: ' + error.message,
                indicator: 'red'
            });
        } finally {
            // Re-enable submit button
            $('.pm-comment-submit').prop('disabled', false).text('Send Comment');
        }
    }
    
    async deleteComment(commentId) {
        const confirmed = await this.showConfirmDialog(
            'Delete Comment',
            'Are you sure you want to delete this comment? This action cannot be undone.'
        );
        
        if (!confirmed) return;
        
        try {
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.delete_task_comment',
                args: {
                    comment_id: commentId
                }
            });
            
            if (response.message && response.message.success) {
                // Remove comment from UI
                $(`.pm-comment-item[data-comment-id="${commentId}"]`).fadeOut(300, function() {
                    $(this).remove();
                });
                
                // Update comment count
                const taskId = $('.pm-comment-input').data('task-id');
                this.updateCommentCount(taskId, response.message.comment_count);
                
                frappe.show_alert({
                    message: 'Comment deleted',
                    indicator: 'orange'
                });
            } else {
                throw new Error(response.message?.error || 'Failed to delete comment');
            }
        } catch (error) {
            console.error('Error deleting comment:', error);
            frappe.show_alert({
                message: 'Failed to delete comment',
                indicator: 'red'
            });
        }
    }
    
    closeCommentModal() {
        $('.pm-comment-modal').fadeOut(200, function() {
            $(this).remove();
        });
    }
    
    updateCommentCount(taskId, count) {
        const $indicator = $(`.pm-comment-indicator[data-task-id="${taskId}"]`);
        
        if ($indicator.length === 0) {
            console.warn(`Comment indicator not found for task ${taskId}`);
            return;
        }
        
        const $countSpan = $indicator.find('.pm-comment-count');
        const validCount = Math.max(0, parseInt(count) || 0); // Ensure non-negative integer
        
        $countSpan.text(validCount);
        
        if (validCount > 0) {
            $indicator.addClass('has-comments');
            $indicator.find('i').removeClass('fa-comment-o').addClass('fa-comment');
        } else {
            $indicator.removeClass('has-comments');
            $indicator.find('i').removeClass('fa-comment').addClass('fa-comment-o');
        }
    }
    
    formatTimeAgo(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return date.toLocaleDateString();
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // @ Mention System
    handleMentionInput(textarea, taskId) {
        const text = textarea.value;
        const cursorPosition = textarea.selectionStart;
        
        // Find @ symbol before cursor
        const textBeforeCursor = text.substring(0, cursorPosition);
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');
        
        if (lastAtIndex === -1) {
            this.hideMentionDropdown(taskId);
            return;
        }
        
        // Check if @ is at start or after whitespace
        const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' ';
        if (charBeforeAt !== ' ' && charBeforeAt !== '\n') {
            this.hideMentionDropdown(taskId);
            return;
        }
        
        // Get text after @
        const mentionText = textBeforeCursor.substring(lastAtIndex + 1);
        
        // Check if there's a space after @ (which would end the mention)
        if (mentionText.includes(' ') || mentionText.includes('\n')) {
            this.hideMentionDropdown(taskId);
            return;
        }
        
        // Show mention suggestions
        this.showMentionSuggestions(taskId, mentionText, lastAtIndex);
    }
    
    async showMentionSuggestions(taskId, query, atPosition) {
        const $dropdown = $(`#pm-mention-dropdown-${taskId}`);
        
        try {
            // Get users for mentions
            const response = await frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'User',
                    fields: ['name', 'email', 'full_name'],
                    filters: [
                        ['enabled', '=', 1],
                        ['user_type', '=', 'System User'],
                        ['name', '!=', 'Guest']
                    ],
                    limit_page_length: 10,
                    order_by: 'full_name asc'
                }
            });
            
            if (response.message) {
                let users = response.message;
                
                // Filter by query if provided
                if (query) {
                    users = users.filter(user => 
                        (user.full_name || '').toLowerCase().includes(query.toLowerCase()) ||
                        user.email.toLowerCase().includes(query.toLowerCase())
                    );
                }
                
                this.renderMentionSuggestions(taskId, users, atPosition);
            }
        } catch (error) {
            console.error('Error loading mention suggestions:', error);
        }
    }
    
    renderMentionSuggestions(taskId, users, atPosition) {
        const $dropdown = $(`#pm-mention-dropdown-${taskId}`);
        
        if (!users || users.length === 0) {
            $dropdown.hide();
            return;
        }
        
        let html = '';
        users.forEach((user, index) => {
            const displayName = user.full_name || user.email;
            const initials = this.getInitials(displayName);
            const avatarColor = this.getAvatarColor(displayName);
            
            html += `
                <div class="pm-mention-item ${index === 0 ? 'selected' : ''}" 
                     data-email="${user.email}" 
                     data-name="${displayName}"
                     data-index="${index}">
                    <div class="pm-mention-avatar" style="background: ${avatarColor}">
                        ${initials}
                    </div>
                    <div class="pm-mention-info">
                        <div class="pm-mention-name">${displayName}</div>
                        <div class="pm-mention-email">${user.email}</div>
                    </div>
                </div>
            `;
        });
        
        $dropdown.html(html).show();
        
        // Store position for insertion
        $dropdown.data('at-position', atPosition);
        
        // Handle clicks
        $dropdown.off('click').on('click', '.pm-mention-item', (e) => {
            const $item = $(e.currentTarget);
            this.insertMention(taskId, $item.data('email'), $item.data('name'));
        });
    }
    
    navigateMentions(taskId, direction) {
        const $dropdown = $(`#pm-mention-dropdown-${taskId}`);
        const $items = $dropdown.find('.pm-mention-item');
        const $selected = $items.filter('.selected');
        
        if ($items.length === 0) return;
        
        let newIndex = 0;
        if ($selected.length > 0) {
            const currentIndex = $selected.data('index');
            newIndex = currentIndex + direction;
            
            // Wrap around
            if (newIndex < 0) newIndex = $items.length - 1;
            if (newIndex >= $items.length) newIndex = 0;
        }
        
        $items.removeClass('selected');
        $items.eq(newIndex).addClass('selected');
    }
    
    selectCurrentMention(taskId) {
        const $dropdown = $(`#pm-mention-dropdown-${taskId}`);
        const $selected = $dropdown.find('.pm-mention-item.selected');
        
        if ($selected.length > 0) {
            this.insertMention(taskId, $selected.data('email'), $selected.data('name'));
        }
    }
    
    insertMention(taskId, email, name) {
        const $textarea = $('.pm-comment-input');
        const text = $textarea.val();
        const cursorPosition = $textarea[0].selectionStart;
        const $dropdown = $(`#pm-mention-dropdown-${taskId}`);
        const atPosition = $dropdown.data('at-position');
        
        // Replace from @ to cursor with mention
        const beforeAt = text.substring(0, atPosition);
        const afterCursor = text.substring(cursorPosition);
        const mention = `@${name} `;
        
        const newText = beforeAt + mention + afterCursor;
        const newCursorPos = beforeAt.length + mention.length;
        
        $textarea.val(newText);
        $textarea[0].setSelectionRange(newCursorPos, newCursorPos);
        $textarea.focus();
        
        this.hideMentionDropdown(taskId);
    }
    
    hideMentionDropdown(taskId) {
        $(`#pm-mention-dropdown-${taskId}`).hide();
    }
    
    // Tab Switching and Activity Log
    switchCommentTab(taskId, tab) {
        // Update tab buttons
        $('.pm-comment-tab').removeClass('active');
        $(`.pm-comment-tab[data-tab="${tab}"]`).addClass('active');
        
        // Update tab panels - 使用正确的选择器
        $('.pm-tab-panel').removeClass('active').hide();
        
        if (tab === 'comments') {
            $(`#pm-comment-list-${taskId}`).addClass('active').show();
            $('.pm-comment-input-area').show();
        } else if (tab === 'activity') {
            $(`#pm-activity-list-${taskId}`).addClass('active').show();
            $('.pm-comment-input-area').hide();
            // Load activity log if needed
            this.loadActivityLog(taskId);
        }
    }
    
    async loadActivityLog(taskId) {
        const $activityList = $(`#pm-activity-list-${taskId}`);
        
        try {
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.get_task_activity_log',
                args: {
                    task_id: taskId
                }
            });
            
            if (response.message && response.message.success) {
                const activities = response.message.activities || [];
                this.renderActivityLog(taskId, activities);
            } else {
                throw new Error(response.message?.error || 'Failed to load activity log');
            }
        } catch (error) {
            console.error('Error loading activity log:', error);
            $activityList.html(`
                <div class="pm-comment-empty">
                    <i class="fa fa-exclamation-triangle"></i>
                    <h4>Failed to load activity log</h4>
                    <p>Please try again later</p>
                </div>
            `);
        }
    }
    
    renderActivityLog(taskId, activities) {
        const $activityList = $(`#pm-activity-list-${taskId}`);
        
        if (!activities || activities.length === 0) {
            $activityList.html(`
                <div class="pm-comment-empty">
                    <i class="fa fa-history"></i>
                    <h4>No activity yet</h4>
                    <p>Task activity will appear here</p>
                </div>
            `);
            return;
        }
        
        let html = '';
        activities.forEach(activity => {
            const timeAgo = this.formatTimeAgo(activity.creation);
            const initials = this.getInitials(activity.owner);
            const avatarColor = this.getAvatarColor(activity.owner);
            
            html += `
                <div class="pm-activity-item">
                    <div class="pm-comment-avatar" style="background: ${avatarColor}">
                        ${initials}
                    </div>
                    <div class="pm-comment-content">
                        <div class="pm-comment-header">
                            <span class="pm-comment-author">${activity.owner}</span>
                            <span class="pm-comment-time">${timeAgo}</span>
                        </div>
                        <div class="pm-activity-description">
                            <i class="fa fa-edit"></i>
                            ${this.formatActivityDescription(activity)}
                        </div>
                    </div>
                </div>
            `;
        });
        
        $activityList.html(html);
    }
    
    formatActivityDescription(activity) {
        const data = activity.data ? JSON.parse(activity.data) : {};
        
        if (data.changed && data.changed.length > 0) {
            const changes = data.changed.map(change => {
                const fieldLabel = this.getFieldLabel(change[0]);
                const oldValue = change[1] || 'Empty';
                const newValue = change[2] || 'Empty';
                return `Changed <strong>${fieldLabel}</strong> from "${oldValue}" to "${newValue}"`;
            });
            return changes.join('<br>');
        }
        
        return 'Task updated';
    }
    
    getFieldLabel(fieldName) {
        const fieldLabels = {
            'status': 'Status',
            'priority': 'Priority',
            'custom_client': 'Client',
            'custom_tftg': 'TF/TG',
            'custom_software': 'Software',
            'custom_target_month': 'Target Month',
            'custom_budget_planning': 'Budget',
            'custom_actual_billing': 'Actual',
            'custom_action_person': 'Action Person',
            'custom_preparer': 'Preparer',
            'custom_reviewer': 'Reviewer',
            'custom_partner': 'Partner',
            'subject': 'Task Name',
            'description': 'Description'
        };
        
        return fieldLabels[fieldName] || fieldName;
    }

    createDateEditor($cell, currentValue) {
        // Convert display value to date format if needed
        let dateValue = '';
        if (currentValue && currentValue !== '-') {
            // If it's already in YYYY-MM-DD format, use as is
            if (/^\d{4}-\d{2}-\d{2}$/.test(currentValue)) {
                dateValue = currentValue;
            } else if (/^\d{4}-\d{2}-\d{2}/.test(currentValue)) {
                // Extract just the date part if it has time
                dateValue = currentValue.split(' ')[0];
            }
        }
        
        return `<input type="date" class="pm-inline-input" value="${dateValue}" lang="en" style="width: 100%; border: 2px solid var(--monday-blue); padding: 6px 8px; border-radius: 4px;">`;
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
