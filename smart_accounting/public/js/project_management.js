// Project Management - Monday.com Style JavaScript

class ProjectManagement {
    constructor() {
        this.tooltipHideTimer = null;
        this.userCache = {}; // Initialize user cache for better display
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
        this.initializeWorkspaceSwitcher();
        this.refreshReviewNoteCounts();
        // TODO: Add Monday-style column add/remove interface
        // this.applyPartitionColumnConfig();
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
                $(e.target).closest('[data-editable="true"]').length > 0 ||
                $(e.target).closest('.pm-comment-indicator').length > 0 ||
                $(e.target).closest('.pm-review-note-indicator').length > 0) {
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

        // Review Note indicator click
        $(document).on('click', '.pm-review-note-indicator', (e) => {
            e.stopPropagation();
            const taskId = $(e.currentTarget).data('task-id');
            if (taskId) {
                this.showReviewNoteModal(taskId);
            }
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
            e.stopPropagation();
            
            const fieldType = $(e.currentTarget).data('field-type');
            const taskId = $(e.currentTarget).data('task-id');
            const fieldName = $(e.currentTarget).data('field');
            
            if (fieldType === 'person_selector') {
                this.showMultiPersonSelector($(e.currentTarget), taskId, fieldName);
            } else if (fieldType === 'software_selector') {
                this.showSoftwareSelector($(e.currentTarget), taskId, fieldName);
            } else {
                this.makeEditable(e.currentTarget);
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
        
        // Don't allow text editing for special selector fields
        if (fieldType === 'person_selector' || fieldType === 'software_selector') {
            // These are handled in the main click handler
            return;
        }
        
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
        
        // For date inputs, trigger click to show date picker
        if (fieldType === 'date' && $input.attr('type') === 'date') {
            setTimeout(() => {
                try {
                    // Try different methods to trigger date picker
                    if ($input[0].showPicker) {
                        $input[0].showPicker();
                    } else {
                        // Fallback: trigger click event
                        $input[0].click();
                        $input[0].focus();
                    }
                } catch (e) {
                    console.log('Date picker trigger failed:', e);
                    // Just focus the input
                    $input[0].focus();
                }
            }, 150);
        }
        
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

    async showSoftwareSelector($cell, taskId, fieldName) {
        try {
            console.log('showSoftwareSelector called with:', taskId, fieldName);
            
            // Get software options from server (professional approach)
            const optionsResponse = await frappe.call({
                method: 'smart_accounting.www.project_management.index.get_software_options'
            });
            
            const softwareOptions = optionsResponse.message?.software_options || [
                'Xero', 'MYOB', 'QuickBooks', 'Excel', 'Other'
            ];
            
            console.log('Software options loaded:', softwareOptions);
            
            // Get current software assignments
            const currentSoftwares = await this.getCurrentTaskSoftwares(taskId);
            console.log('Current softwares:', currentSoftwares);
        
        // Create simple multi-select modal (Monday style)
        const selectorHTML = `
            <div class="pm-software-selector-modal" id="pm-software-selector-${taskId}">
                <div class="pm-software-selector-content">
                    <div class="pm-software-selector-header">
                        <h4>Select Software</h4>
                        <button class="pm-software-selector-close">
                            <i class="fa fa-times"></i>
                        </button>
                    </div>
                    <div class="pm-software-selector-body">
                        <div class="pm-software-options">
                            ${softwareOptions.map(software => {
                                const isSelected = currentSoftwares.some(s => s.software === software);
                                const isPrimary = currentSoftwares.find(s => s.software === software && s.is_primary);
                                return `
                                    <div class="pm-software-option ${isSelected ? 'selected' : ''}" data-software="${software}">
                                        <div class="pm-software-checkbox">
                                            <i class="fa fa-${isSelected ? 'check-' : ''}square-o"></i>
                                        </div>
                                        <span class="pm-software-name">${software}</span>
                                        ${isPrimary ? '<span class="pm-primary-badge">Primary</span>' : ''}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                        <div class="pm-software-selector-footer">
                            <button class="pm-btn pm-btn-secondary pm-clear-all-software">Clear all</button>
                            <button class="pm-btn pm-btn-primary pm-save-software">
                                <i class="fa fa-check"></i>
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing selector
        $('.pm-software-selector-modal').remove();
        
        // Add to body
        $('body').append(selectorHTML);
        const $selector = $(`#pm-software-selector-${taskId}`);
        
        // Position above the cell using viewport coordinates
        const cellRect = $cell[0].getBoundingClientRect();
        
        $selector.css({
            position: 'fixed',
            left: cellRect.left + 'px',
            top: (cellRect.top - 350) + 'px',
            zIndex: 9999,
            width: '280px'
        });
        
        // Show with animation
        $selector.fadeIn(200);
        
            // Bind events
            this.bindSoftwareSelectorEvents($selector, $cell, taskId);
            
        } catch (error) {
            console.error('Error in showSoftwareSelector:', error);
            frappe.show_alert({
                message: 'Error opening software selector: ' + error.message,
                indicator: 'red'
            });
        }
    }

    bindSoftwareSelectorEvents($selector, $cell, taskId) {
        // Toggle software selection
        $selector.on('click', '.pm-software-option', (e) => {
            e.stopPropagation();
            const $option = $(e.currentTarget);
            const software = $option.data('software');
            
            $option.toggleClass('selected');
            
            // Update checkbox icon
            const $checkbox = $option.find('.pm-software-checkbox i');
            if ($option.hasClass('selected')) {
                $checkbox.removeClass('fa-square-o').addClass('fa-check-square-o');
            } else {
                $checkbox.removeClass('fa-check-square-o').addClass('fa-square-o');
                // Remove primary badge if unselected
                $option.find('.pm-primary-badge').remove();
            }
            
            // Auto-set first selected as primary
            const selectedOptions = $selector.find('.pm-software-option.selected');
            if (selectedOptions.length === 1 && !selectedOptions.find('.pm-primary-badge').length) {
                selectedOptions.append('<span class="pm-primary-badge">Primary</span>');
            }
        });
        
        // Set primary software
        $selector.on('click', '.pm-software-option.selected .pm-software-name', (e) => {
            e.stopPropagation();
            
            // Remove all primary badges
            $selector.find('.pm-primary-badge').remove();
            
            // Add primary badge to clicked option
            const $option = $(e.currentTarget).closest('.pm-software-option');
            $option.append('<span class="pm-primary-badge">Primary</span>');
        });
        
        // Clear all software
        $selector.find('.pm-clear-all-software').on('click', (e) => {
            e.stopPropagation();
            $selector.find('.pm-software-option').removeClass('selected');
            $selector.find('.pm-software-checkbox i').removeClass('fa-check-square-o').addClass('fa-square-o');
            $selector.find('.pm-primary-badge').remove();
        });
        
        // Save software selections
        $selector.find('.pm-save-software').on('click', async (e) => {
            e.stopPropagation();
            await this.saveSoftwareSelections($selector, $cell, taskId);
            $selector.remove();
        });
        
        // Close button
        $selector.find('.pm-software-selector-close').on('click', () => {
            $selector.remove();
            $cell.removeClass('editing');
        });
        
        // Close on outside click
        setTimeout(() => {
            $(document).on('click.software-selector', (e) => {
                if (!$(e.target).closest('.pm-software-selector-modal').length) {
                    $('.pm-software-selector-modal').remove();
                    $cell.removeClass('editing');
                    $(document).off('click.software-selector');
                }
            });
        }, 100);
    }

    async getCurrentTaskSoftwares(taskId) {
        try {
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.get_task_softwares',
                args: { task_id: taskId }
            });
            
            if (response.message && response.message.success) {
                return response.message.softwares || [];
            }
            return [];
        } catch (error) {
            console.error('Error getting current task softwares:', error);
            return [];
        }
    }

    async saveSoftwareSelections($selector, $cell, taskId) {
        try {
            // Get selected software options
            const selectedSoftwares = [];
            $selector.find('.pm-software-option.selected').each(function() {
                const software = $(this).data('software');
                const isPrimary = $(this).find('.pm-primary-badge').length > 0;
                selectedSoftwares.push({
                    software: software,
                    is_primary: isPrimary
                });
            });
            
            // Ensure at least one is primary if any selected
            if (selectedSoftwares.length > 0 && !selectedSoftwares.some(s => s.is_primary)) {
                selectedSoftwares[0].is_primary = true;
            }
            
            // Save to server
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.set_task_softwares',
                args: {
                    task_id: taskId,
                    softwares_data: JSON.stringify(selectedSoftwares)
                }
            });
            
            if (response.message && response.message.success) {
                // Update cell display
                await this.updateSoftwareCellDisplay($cell, selectedSoftwares);
                
                frappe.show_alert({
                    message: `Software updated (${selectedSoftwares.length} selected)`,
                    indicator: 'green'
                });
            }
        } catch (error) {
            console.error('Error saving software selections:', error);
            frappe.show_alert({
                message: 'Error saving software',
                indicator: 'red'
            });
        }
    }

    async updateSoftwareCellDisplay($cell, softwares) {
        try {
            if (!softwares || softwares.length === 0) {
                $cell.html(`
                    <div class="pm-software-tags pm-empty-software">
                        <span class="pm-software-badge pm-empty-badge">
                            <i class="fa fa-plus"></i>
                            Add software
                        </span>
                    </div>
                `);
                return;
            }
            
            // Find primary software or use first one
            const primarySoftware = softwares.find(s => s.is_primary) || softwares[0];
            
            let displayHTML = '';
            if (softwares.length === 1) {
                displayHTML = `
                    <div class="pm-software-tags">
                        <span class="pm-software-badge pm-primary-software">${primarySoftware.software}</span>
                    </div>
                `;
            } else {
                displayHTML = `
                    <div class="pm-software-tags">
                        <span class="pm-software-badge pm-primary-software">${primarySoftware.software}</span>
                        <span class="pm-software-more">+${softwares.length - 1}</span>
                    </div>
                `;
            }
            
            $cell.html(displayHTML);
            $cell.removeClass('editing');
            
        } catch (error) {
            console.error('Error updating software cell display:', error);
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
            
            // Immediately update table width to maintain consistency
            this.updateTableWidth();
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
                                console.log('❌ localStorage parse failed, using defaults');
                            }
                        } else {
                            this.columnWidths = this.getDefaultColumnWidths();
                            console.log('⚠️ No saved widths found, using defaults');
                        }
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
        const calculatedWidth = Math.max(totalWidth + 50, 1200); // Add padding and set minimum
        
        console.log('Updating table width to:', calculatedWidth);
        
        // Update all table elements to maintain consistency
        $('.pm-project-table-header, .pm-task-row, .pm-project-group, .pm-add-task-row').css({
            'width': calculatedWidth + 'px',
            'min-width': calculatedWidth + 'px'
        });
        
        // Update table body container
        $('.pm-table-body').css({
            'width': calculatedWidth + 'px',
            'min-width': calculatedWidth + 'px'
        });
        
        // Force table container to accommodate new width
        $('.pm-table-container').css({
            'overflow-x': 'auto'
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
                <div class="pm-cell pm-cell-software" style="width: ${currentWidths.software}px; min-width: ${currentWidths.software}px; flex: 0 0 ${currentWidths.software}px;" data-editable="true" data-field="custom_softwares" data-task-id="${taskData.task_id}" data-field-type="software_selector">
                    <div class="pm-software-tags pm-empty-software">
                        <span class="pm-software-badge pm-empty-badge">
                            <i class="fa fa-plus"></i>
                            Add software
                        </span>
                    </div>
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
                <div class="pm-cell pm-cell-action-person" style="width: ${currentWidths['action-person']}px; min-width: ${currentWidths['action-person']}px; flex: 0 0 ${currentWidths['action-person']}px;" data-editable="true" data-field="custom_action_person" data-task-id="${taskData.task_id}" data-field-type="person_selector">
                    <div class="pm-user-avatars pm-empty-person">
                        <div class="pm-avatar pm-empty-avatar">
                            <i class="fa fa-user"></i>
                        </div>
                    </div>
                </div>
                <div class="pm-cell pm-cell-preparer" style="width: ${currentWidths.preparer}px; min-width: ${currentWidths.preparer}px; flex: 0 0 ${currentWidths.preparer}px;" data-editable="true" data-field="custom_preparer" data-task-id="${taskData.task_id}" data-field-type="person_selector">
                    <div class="pm-user-avatars pm-empty-person">
                        <div class="pm-avatar pm-empty-avatar">
                            <i class="fa fa-user"></i>
                        </div>
                    </div>
                </div>
                <div class="pm-cell pm-cell-reviewer" style="width: ${currentWidths.reviewer}px; min-width: ${currentWidths.reviewer}px; flex: 0 0 ${currentWidths.reviewer}px;" data-editable="true" data-field="custom_reviewer" data-task-id="${taskData.task_id}" data-field-type="person_selector">
                    <div class="pm-user-avatars pm-empty-person">
                        <div class="pm-avatar pm-empty-avatar">
                            <i class="fa fa-user"></i>
                        </div>
                    </div>
                </div>
                <div class="pm-cell pm-cell-partner" style="width: ${currentWidths.partner}px; min-width: ${currentWidths.partner}px; flex: 0 0 ${currentWidths.partner}px;" data-editable="true" data-field="custom_partner" data-task-id="${taskData.task_id}" data-field-type="person_selector">
                    <div class="pm-user-avatars pm-empty-person">
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
    showMultiPersonSelector($cell, taskId, fieldName) {
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
                        <div class="pm-person-selector-footer">
                            <button class="pm-btn pm-btn-primary pm-done-selecting">
                                <i class="fa fa-check"></i>
                                Done
                            </button>
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
            
            if (email === '') {
                // Clear all people for this role
                this.clearRolePeople($cell, taskId, fieldName);
                $selector.remove();
            } else {
                // Add person to role (multi-select)
                this.addPersonToRole($cell, taskId, fieldName, email, name);
                // Don't close selector - allow multiple selections
                // Update current people display in selector
                this.updateCurrentPeopleInSelector($selector, $cell);
            }
        });
        
        $selector.find('.pm-person-selector-close').on('click', () => {
            // Just close without clearing data
            $selector.remove();
            $cell.removeClass('editing');
        });
        
        // Done button to close selector
        $selector.find('.pm-done-selecting').on('click', () => {
            $selector.remove();
            $cell.removeClass('editing');
        });
        
        // Remove person button
        $selector.on('click', '.pm-remove-person', (e) => {
            e.stopPropagation();
            const emailToRemove = $(e.currentTarget).data('email');
            this.removePersonFromRole($cell, taskId, fieldName, emailToRemove);
            // Don't close selector - allow continued editing
            this.updateCurrentPeopleInSelector($selector, $cell);
        });
        
        // Close on outside click (without clearing data)
        setTimeout(() => {
            $(document).on('click.person-selector', (e) => {
                if (!$(e.target).closest('.pm-person-selector-modal').length) {
                    // Just close the selector, don't clear data
                    $('.pm-person-selector-modal').remove();
                    $cell.removeClass('editing');
                    $(document).off('click.person-selector');
                }
            });
        }, 100);
    }
    
    
    positionSoftwareModal($cell, $modal) {
        // Get actual modal dimensions after it's added to DOM
        $modal.css({
            position: 'fixed',
            left: '-9999px',
            top: '-9999px',
            zIndex: 9999,
            visibility: 'hidden',
            display: 'block'
        });
        
        const modalWidth = $modal.outerWidth();
        const modalHeight = $modal.outerHeight();
        
        // Get cell and viewport info
        const cellOffset = $cell.offset();
        const cellHeight = $cell.outerHeight();
        const cellWidth = $cell.outerWidth();
        const windowWidth = $(window).width();
        const windowHeight = $(window).height();
        const scrollTop = $(window).scrollTop();
        const scrollLeft = $(window).scrollLeft();
        
        // Calculate cell position relative to viewport center
        const cellCenterY = cellOffset.top - scrollTop + (cellHeight / 2);
        const viewportCenterY = windowHeight / 2;
        const isInLowerHalf = cellCenterY > viewportCenterY;
        
        console.log('Smart positioning:', {
            cellCenterY,
            viewportCenterY,
            isInLowerHalf,
            cellOffset
        });
        
        // Smart vertical positioning based on screen position
        let top;
        if (isInLowerHalf) {
            // Cell in lower half → show modal above the cell
            top = cellOffset.top - modalHeight - 10;
            console.log('Positioning above cell (lower half)');
        } else {
            // Cell in upper half → show modal below the cell
            top = cellOffset.top + cellHeight + 10;
            console.log('Positioning below cell (upper half)');
        }
        
        // Horizontal positioning - prefer right side, fallback to left
        let left = cellOffset.left + cellWidth + 10;
        
        // If would go off right edge, position on left side
        if (left + modalWidth > scrollLeft + windowWidth - 20) {
            left = cellOffset.left - modalWidth - 10;
        }
        
        // If still off left edge, center on cell
        if (left < scrollLeft + 20) {
            left = cellOffset.left - (modalWidth / 2) + (cellWidth / 2);
        }
        
        // Final viewport boundary checks
        if (top < scrollTop + 20) {
            top = scrollTop + 20;
        }
        if (top + modalHeight > scrollTop + windowHeight - 20) {
            top = scrollTop + windowHeight - modalHeight - 20;
        }
        if (left < scrollLeft + 20) {
            left = scrollLeft + 20;
        }
        if (left + modalWidth > scrollLeft + windowWidth - 20) {
            left = scrollLeft + windowWidth - modalWidth - 20;
        }
        
        console.log('Final position:', { left, top });
        
        $modal.css({
            position: 'fixed',
            left: left + 'px',
            top: top + 'px',
            zIndex: 9999,
            visibility: 'visible',
            display: 'none' // Will be shown with fadeIn
        });
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
            // Get all enabled users with roles (exclude system users)
            const response = await frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'User',
                    fields: ['name', 'email', 'full_name', 'user_image', 'role_profile_name'],
                    filters: [
                        ['enabled', '=', 1],
                        ['user_type', '=', 'System User'],
                        ['name', '!=', 'Guest'],
                        ['name', '!=', 'Administrator'],
                        ['email', '!=', 'admin@example.com']
                    ],
                    limit_page_length: 50,
                    order_by: 'full_name asc'
                }
            });
            
            if (response.message && response.message.length > 0) {
                // Build user cache while generating HTML
                const peopleHTML = response.message.map(user => {
                    const displayName = user.full_name || user.email;
                    const role = user.role_profile_name || 'System User';
                    
                    // Cache user info
                    this.userCache[user.email] = {
                        full_name: displayName,
                        email: user.email,
                        user_image: user.user_image
                    };
                    
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
    
    async addPersonToRole($cell, taskId, fieldName, email, name) {
        try {
            // Direct sub-table approach (no fallback needed after cleanup)
            
            // Get current roles for this task
            const currentRoles = await this.getCurrentTaskRoles(taskId);
            
            // Get role type from field name and map to sub-table values
            let roleType = fieldName.replace('custom_', '');
            // Map frontend field names to sub-table role values
            const roleMapping = {
                'action_person': 'Action Person',
                'preparer': 'Preparer',
                'reviewer': 'Reviewer',
                'partner': 'Partner'
            };
            roleType = roleMapping[roleType] || roleType;
            
            // Check if person already assigned to this role
            const existingRole = currentRoles.find(r => r.role === roleType && r.user === email);
            if (existingRole) {
                frappe.show_alert({
                    message: 'Person already assigned to this role',
                    indicator: 'orange'
                });
                return;
            }
            
            // Add new role assignment
            currentRoles.push({
                role: roleType,
                user: email,
                is_primary: currentRoles.filter(r => r.role === roleType).length === 0 // First person is primary
            });
            
            // Save roles
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.set_task_roles',
                args: {
                    task_id: taskId,
                    roles_data: JSON.stringify(currentRoles)
                }
            });
            
            if (response.message && response.message.success) {
                // Update cell display
                await this.updatePersonCellDisplay($cell, taskId, roleType);
                
                frappe.show_alert({
                    message: `${name} added as ${roleType}`,
                    indicator: 'green'
                });
            }
        } catch (error) {
            console.error('Error adding person to role:', error);
            frappe.show_alert({
                message: 'Error adding person',
                indicator: 'red'
            });
        }
    }

    async clearRolePeople($cell, taskId, fieldName) {
        try {
            // Get current roles for this task
            const currentRoles = await this.getCurrentTaskRoles(taskId);
            
            // Get role type from field name and map to sub-table values
            let roleType = fieldName.replace('custom_', '');
            const roleMapping = {
                'action_person': 'Action Person',
                'preparer': 'Preparer',
                'reviewer': 'Reviewer',
                'partner': 'Partner'
            };
            roleType = roleMapping[roleType] || roleType;
            
            // Remove all assignments for this role
            const filteredRoles = currentRoles.filter(r => r.role !== roleType);
            
            // Save roles
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.set_task_roles',
                args: {
                    task_id: taskId,
                    roles_data: JSON.stringify(filteredRoles)
                }
            });
            
            if (response.message && response.message.success) {
                // Update cell display to empty
                $cell.html(`
                    <div class="pm-user-avatars pm-empty-person">
                        <div class="pm-avatar pm-empty-avatar">
                            <i class="fa fa-user"></i>
                        </div>
                    </div>
                `);
                
                frappe.show_alert({
                    message: 'All people removed from role',
                    indicator: 'orange'
                });
            }
        } catch (error) {
            console.error('Error clearing role people:', error);
            frappe.show_alert({
                message: 'Error clearing people',
                indicator: 'red'
            });
        }
    }

    async getCurrentTaskRoles(taskId) {
        try {
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.get_task_roles',
                args: { task_id: taskId }
            });
            
            if (response.message && response.message.success) {
                return response.message.roles || [];
            }
            return [];
        } catch (error) {
            console.error('Error getting current task roles:', error);
            return [];
        }
    }

    async updatePersonCellDisplay($cell, taskId, roleType) {
        try {
            const roles = await this.getCurrentTaskRoles(taskId);
            // roleType is already mapped to sub-table format (e.g., "Action Person")
            const roleUsers = roles.filter(r => r.role === roleType);
            
            if (roleUsers.length === 0) {
                $cell.html(`
                    <div class="pm-user-avatars pm-empty-person">
                        <div class="pm-avatar pm-empty-avatar">
                            <i class="fa fa-user"></i>
                        </div>
                    </div>
                `);
                return;
            }
            
            // Generate avatars - max 2 displayed, rest as "+N"
            let avatarsHTML = '';
            let moreHTML = '';
            
            if (roleUsers.length === 1) {
                // Single user - show full avatar
                const userInfo = await this.getRealUserInfo(roleUsers[0].user);
                const initials = this.getInitials(userInfo?.full_name || roleUsers[0].user);
                const isPrimary = roleUsers[0].is_primary ? ' pm-primary-user' : '';
                
                avatarsHTML = `<div class="pm-avatar${isPrimary}" title="${userInfo?.full_name || roleUsers[0].user}" data-email="${roleUsers[0].user}">${initials}</div>`;
            } else if (roleUsers.length >= 2) {
                // Multiple users - show first user + "+N" count
                const firstUser = roleUsers[0];
                const userInfo = await this.getRealUserInfo(firstUser.user);
                const initials = this.getInitials(userInfo?.full_name || firstUser.user);
                const isPrimary = firstUser.is_primary ? ' pm-primary-user' : '';
                
                avatarsHTML = `<div class="pm-avatar${isPrimary}" title="${userInfo?.full_name || firstUser.user}" data-email="${firstUser.user}">${initials}</div>`;
                moreHTML = `<div class="pm-avatar-more" title="Total ${roleUsers.length} people assigned">+${roleUsers.length - 1}</div>`;
            }
            
            $cell.html(`
                <div class="pm-user-avatars">
                    ${avatarsHTML}
                    ${moreHTML}
                </div>
            `);
            
        } catch (error) {
            console.error('Error updating person cell display:', error);
        }
    }

    async getRealUserInfo(email) {
        try {
            // Initialize user cache if not exists
            if (!this.userCache) {
                this.userCache = {};
            }
            
            // Return cached info if available
            if (this.userCache[email]) {
                return this.userCache[email];
            }
            
            // Fetch real user info from server
            const response = await frappe.call({
                method: 'frappe.client.get',
                args: {
                    doctype: 'User',
                    name: email
                }
            });
            
            if (response.message) {
                const userInfo = {
                    full_name: response.message.full_name || email,
                    email: email,
                    user_image: response.message.user_image
                };
                
                // Cache the result
                this.userCache[email] = userInfo;
                return userInfo;
            }
            
            // Fallback to email-based name
            return this.getUserInfoSync(email);
            
        } catch (error) {
            console.warn('Could not fetch user info for', email, error);
            return this.getUserInfoSync(email);
        }
    }

    getUserInfoSync(email) {
        // Try to get real user info from cache or generate from email
        try {
            // Check if we have user info in our cache
            if (this.userCache && this.userCache[email]) {
                return this.userCache[email];
            }
            
            // Generate from email as fallback
            return {
                full_name: email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                email: email
            };
        } catch (error) {
            return {
                full_name: email,
                email: email
            };
        }
    }

    async legacySelectPerson($cell, taskId, fieldName, email, name) {
        try {
            // Use the original single-person assignment logic
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
                    message: `${name} assigned as ${fieldName.replace('custom_', '')}`,
                    indicator: 'green'
                });
            } else {
                frappe.show_alert({
                    message: 'Failed to assign person: ' + (response.message?.error || 'Unknown error'),
                    indicator: 'red'
                });
            }
        } catch (error) {
            console.error('Error in legacy person assignment:', error);
            frappe.show_alert({
                message: 'Error assigning person',
                indicator: 'red'
            });
        }
    }

    async removePersonFromRole($cell, taskId, fieldName, emailToRemove) {
        try {
            // Get current roles for this task
            const currentRoles = await this.getCurrentTaskRoles(taskId);
            
            // Get role type from field name and map to sub-table values
            let roleType = fieldName.replace('custom_', '');
            const roleMapping = {
                'action_person': 'Action Person',
                'preparer': 'Preparer',
                'reviewer': 'Reviewer',
                'partner': 'Partner'
            };
            roleType = roleMapping[roleType] || roleType;
            
            // Remove this specific person from this role
            const filteredRoles = currentRoles.filter(r => !(r.role === roleType && r.user === emailToRemove));
            
            // If we removed the primary person, make the next person primary
            const remainingInRole = filteredRoles.filter(r => r.role === roleType);
            if (remainingInRole.length > 0 && !remainingInRole.some(r => r.is_primary)) {
                remainingInRole[0].is_primary = true;
            }
            
            // Save roles
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.set_task_roles',
                args: {
                    task_id: taskId,
                    roles_data: JSON.stringify(filteredRoles)
                }
            });
            
            if (response.message && response.message.success) {
                // Update cell display
                await this.updatePersonCellDisplay($cell, taskId, roleType);
                
                frappe.show_alert({
                    message: 'Person removed from role',
                    indicator: 'orange'
                });
            }
        } catch (error) {
            console.error('Error removing person from role:', error);
            frappe.show_alert({
                message: 'Error removing person',
                indicator: 'red'
            });
        }
    }

    updateCurrentPeopleInSelector($selector, $cell) {
        // Get current people from cell
        const currentEmails = [];
        $cell.find('.pm-avatar[data-email]').each(function() {
            const email = $(this).data('email');
            if (email) currentEmails.push(email);
        });
        
        // Update the current people section in selector
        const $currentSection = $selector.find('.pm-current-people');
        if (currentEmails.length > 0) {
            const currentHTML = `
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
            `;
            
            if ($currentSection.length === 0) {
                $selector.find('.pm-person-selector-body').prepend(`
                    <div class="pm-current-people">
                        ${currentHTML}
                    </div>
                `);
            } else {
                $currentSection.html(currentHTML);
            }
        } else {
            $currentSection.remove();
        }
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
                    value = $row.find('.pm-cell-software .pm-primary-software').text().trim();
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
                return $row.find('.pm-cell-software .pm-primary-software').text().trim();
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
            
            // Get client name from the task row for a more professional title
            const $taskRow = $(`.pm-task-row[data-task-id="${taskId}"]`);
            const clientName = $taskRow.find('.pm-cell-client .client-display').text().trim() || 'No Client';
            
            // Create professional title: "Updates - [Client Name] - [Project Name]"
            const titleParts = taskSubject.split(' - ');
            const projectName = titleParts.length > 1 ? titleParts.slice(1).join(' - ') : taskSubject;
            const professionalTitle = `Updates - ${clientName} - ${projectName}`;
            
            // Create modal HTML
            const modalHTML = `
                <div class="pm-comment-modal" id="pm-comment-modal-${taskId}">
                    <div class="pm-comment-modal-content">
                        <div class="pm-comment-modal-header">
                            <h3 class="pm-comment-modal-title">${professionalTitle}</h3>
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

    showReviewNoteModal(taskId) {
        if (!taskId) {
            frappe.show_alert({message: 'Task ID not found', indicator: 'red'});
            return;
        }

        const professionalTitle = `Review Notes - Task ${taskId}`;
        
        const modalHTML = `
            <div class="pm-review-modal-overlay">
                <div class="pm-review-modal" id="pm-review-modal-${taskId}">
                    <div class="pm-review-modal-content">
                        <div class="pm-review-modal-header">
                            <h3 class="pm-review-modal-title">${professionalTitle}</h3>
                            <div class="pm-review-modal-tabs">
                                <button class="pm-review-tab active" data-tab="reviews">
                                    <i class="fa fa-clipboard"></i> Review Notes
                                </button>
                                <button class="pm-review-tab" data-tab="activity">
                                    <i class="fa fa-history"></i> Activity Log
                                </button>
                            </div>
                            <button class="pm-review-modal-close">
                                <i class="fa fa-times"></i>
                            </button>
                        </div>
                        <div class="pm-review-modal-body">
                            <div class="pm-tab-content">
                                <div class="pm-review-list pm-tab-panel active" id="pm-review-list-${taskId}" data-tab="reviews">
                                    <div class="pm-review-loading">
                                        <i class="fa fa-spinner fa-spin"></i> Loading review notes...
                                    </div>
                                </div>
                                <div class="pm-activity-log pm-tab-panel" id="pm-activity-log-${taskId}" data-tab="activity">
                                    <div class="pm-activity-loading">
                                        <i class="fa fa-spinner fa-spin"></i> Loading activity log...
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="pm-review-input-section" id="pm-review-input-${taskId}">
                            <div class="pm-review-input-area">
                                <div class="pm-review-input-container">
                                    <textarea class="pm-review-input" placeholder="Add a review note..." data-task-id="${taskId}"></textarea>
                                </div>
                                <div class="pm-review-input-footer">
                                    <div class="pm-review-input-info">
                                        Press Ctrl+Enter to send
                                    </div>
                                    <button class="pm-review-submit" data-task-id="${taskId}">
                                        Add Review Note
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modals
        $('.pm-review-modal-overlay').remove();
        
        // Add modal to body
        $('body').append(modalHTML);

        // Show modal
        $(`#pm-review-modal-${taskId}`).fadeIn(200);
        
        // Load review notes and check permissions
        this.loadReviewNotes(taskId);
        this.checkReviewPermissions(taskId);
        
        // Focus on input
        $('.pm-review-input').focus();
        
        // Bind events
        this.bindReviewModalEvents(taskId);
    }

    async getTaskInfo(taskId) {
        try {
            const response = await frappe.call({
                method: 'frappe.client.get',
                args: {
                    doctype: 'Task',
                    name: taskId
                }
            });
            return response.message;
        } catch (error) {
            console.error('Error fetching task info:', error);
            return null;
        }
    }

    async loadReviewNotes(taskId) {
        try {
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.get_review_notes',
                args: { task_id: taskId }
            });

            if (response.message && response.message.success) {
                this.displayReviewNotes(taskId, response.message.review_notes);
            } else {
                this.showReviewNotesError(taskId, response.message?.error || 'Failed to load review notes');
            }
        } catch (error) {
            console.error('Error loading review notes:', error);
            this.showReviewNotesError(taskId, 'Network error occurred');
        }
    }

    displayReviewNotes(taskId, reviewNotes) {
        const $reviewList = $(`#pm-review-list-${taskId}`);
        
        if (!reviewNotes || reviewNotes.length === 0) {
            $reviewList.html(`
                <div class="pm-review-empty">
                    <i class="fa fa-clipboard"></i>
                    <h4>No review notes yet</h4>
                    <p>Add the first review note below!</p>
                </div>
            `);
            return;
        }

        const reviewsHTML = reviewNotes.map(review => {
            const timeAgo = this.formatTimeAgo(review.creation);
            const avatarColor = this.getAvatarColor(review.owner);
            const initials = this.getInitials(review.created_by || review.owner);
            
            return `
                <div class="pm-review-item" data-review-id="${review.name}">
                    <div class="pm-review-avatar" style="background: ${avatarColor}">
                        ${initials}
                    </div>
                    <div class="pm-review-content">
                        <div class="pm-review-header">
                            <span class="pm-review-author">${review.created_by || review.owner}</span>
                            <span class="pm-review-time">${timeAgo}</span>
                        </div>
                        <div class="pm-review-text">${this.escapeHtml(review.note)}</div>
                    </div>
                </div>
            `;
        }).join('');

        $reviewList.html(reviewsHTML);
    }

    showReviewNotesError(taskId, error) {
        const $reviewList = $(`#pm-review-list-${taskId}`);
        $reviewList.html(`
            <div class="pm-review-empty">
                <i class="fa fa-exclamation-triangle"></i>
                <h4>Failed to load review notes</h4>
                <p>${error}</p>
            </div>
        `);
    }

    async checkReviewPermissions(taskId) {
        try {
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.check_review_permissions',
                args: { task_id: taskId }
            });

            const canAddReview = response.message && response.message.can_add_review;
            const $inputSection = $(`#pm-review-input-${taskId}`);
            
            if (!canAddReview) {
                $inputSection.hide();
            } else {
                $inputSection.show();
            }
        } catch (error) {
            console.error('Error checking permissions:', error);
            // Default to hiding input section if error
            $(`#pm-review-input-${taskId}`).hide();
        }
    }

    bindReviewModalEvents(taskId) {
        // Close modal events
        $('.pm-review-modal-close').on('click', () => {
            this.closeReviewModal();
        });

        $('.pm-review-modal-overlay').on('click', (e) => {
            if (e.target === e.currentTarget) {
                this.closeReviewModal();
            }
        });

        // Tab switching
        $('.pm-review-tab').on('click', (e) => {
            const tab = $(e.currentTarget).data('tab');
            this.switchReviewTab(taskId, tab);
        });

        // Submit review note
        $('.pm-review-submit').on('click', () => {
            this.submitReviewNote(taskId);
        });

        // Ctrl+Enter to submit
        $('.pm-review-input').on('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                this.submitReviewNote(taskId);
            }
        });
    }

    closeReviewModal() {
        $('.pm-review-modal-overlay').fadeOut(200, function() {
            $(this).remove();
        });
    }

    switchReviewTab(taskId, tab) {
        // Update tab buttons
        $('.pm-review-tab').removeClass('active');
        $(`.pm-review-tab[data-tab="${tab}"]`).addClass('active');
        
        // Update tab panels
        $('.pm-tab-panel').removeClass('active');
        $(`#pm-${tab === 'reviews' ? 'review-list' : 'activity-log'}-${taskId}`).addClass('active');
        
        // Load activity log if needed
        if (tab === 'activity' && !$(`#pm-activity-log-${taskId}`).hasClass('loaded')) {
            this.loadActivityLog(taskId);
        }
    }

    async submitReviewNote(taskId) {
        const $input = $('.pm-review-input');
        const content = $input.val().trim();
        
        if (!content) {
            frappe.show_alert({
                message: 'Please enter a review note',
                indicator: 'red'
            });
            return;
        }

        try {
            const $submitBtn = $('.pm-review-submit');
            $submitBtn.prop('disabled', true).text('Adding...');
            
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.add_review_note',
                args: {
                    task_id: taskId,
                    note: content
                }
            });

            if (response.message && response.message.success) {
                // Clear input
                $input.val('');
                
                // Reload review notes
                await this.loadReviewNotes(taskId);
                
                // Update review count in table
                this.updateReviewCount(taskId, response.message.review_count);
                
                frappe.show_alert({
                    message: 'Review note added successfully',
                    indicator: 'green'
                });
            } else {
                throw new Error(response.message?.error || 'Failed to add review note');
            }
        } catch (error) {
            console.error('Error submitting review note:', error);
            frappe.show_alert({
                message: 'Error: ' + error.message,
                indicator: 'red'
            });
        } finally {
            $('.pm-review-submit').prop('disabled', false).text('Add Review Note');
        }
    }

    updateReviewCount(taskId, count) {
        // Find all review note indicators for this task (both in HTML template and dynamic rows)
        const $indicators = $(`.pm-review-note-indicator[data-task-id="${taskId}"]`);
        
        console.log(`Updating review count for task ${taskId}: ${count} notes, found ${$indicators.length} indicators`);
        
        $indicators.each(function() {
            const $indicator = $(this);
            if (count > 0) {
                $indicator.removeClass('no-notes').addClass('has-notes');
                $indicator.find('i').removeClass('fa-times-circle').addClass('fa-check-circle');
                $indicator.find('span').text(`${count} note${count !== 1 ? 's' : ''}`);
                $indicator.attr('title', '点击查看所有Review Notes');
            } else {
                $indicator.removeClass('has-notes').addClass('no-notes');
                $indicator.find('i').removeClass('fa-check-circle').addClass('fa-times-circle');
                $indicator.find('span').text('none');
                $indicator.attr('title', '点击添加Review Note');
            }
        });
    }

    async refreshReviewNoteCounts() {
        // Get all task IDs from the page
        const taskIds = [];
        $('.pm-task-row[data-task-id]').each(function() {
            const taskId = $(this).data('task-id');
            if (taskId) {
                taskIds.push(taskId);
            }
        });

        if (taskIds.length === 0) return;

        try {
            // Get review counts for all tasks at once
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.get_bulk_review_counts',
                args: { task_ids: taskIds }
            });

            if (response.message && response.message.success) {
                const reviewCounts = response.message.review_counts;
                
                // Update each task's review note display
                Object.keys(reviewCounts).forEach(taskId => {
                    this.updateReviewCount(taskId, reviewCounts[taskId]);
                });
                
                console.log('Review note counts refreshed for', Object.keys(reviewCounts).length, 'tasks');
            }
        } catch (error) {
            console.warn('Could not refresh review note counts:', error);
        }
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
            'custom_softwares': 'Software',
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
        // Very simple date editor
        let dateValue = '';
        if (currentValue && currentValue !== '-' && currentValue.trim() !== '') {
            const cleanValue = currentValue.trim();
            // Only use value if it's already in YYYY-MM-DD format
            if (/^\d{4}-\d{2}-\d{2}$/.test(cleanValue)) {
                dateValue = cleanValue;
            }
        }
        
        return `<input type="date" value="${dateValue}" style="width: 100%; border: 2px solid var(--monday-blue); padding: 6px 8px; border-radius: 4px; font-size: 14px; z-index: 10000; position: relative; background: white;">`;
    }

    // Workspace Switcher - Monday.com style hierarchical
    initializeWorkspaceSwitcher() {
        // Toggle workspace menu
        $(document).on('click', '.pm-workspace-btn', (e) => {
            e.stopPropagation();
            $('.pm-workspace-menu').toggle();
        });
        
        // Handle create workspace button (top-level or in submenu)
        $(document).on('click', '.pm-create-workspace', (e) => {
            e.stopPropagation();
            const parentPartition = $(e.currentTarget).data('parent');
            this.showCreateWorkspaceDialog(parentPartition);
        });
        
        // Handle create board button (can be top-level or under workspace)
        $(document).on('click', '.pm-create-board', (e) => {
            e.stopPropagation();
            const parentPartition = $(e.currentTarget).data('parent');
            this.showCreateBoardDialog(parentPartition);
        });
        
        // Handle workspace item clicks (exclude create buttons)
        $(document).on('click', '.pm-workspace-item:not(.pm-create-workspace):not(.pm-create-board)', (e) => {
            e.stopPropagation();
            const $item = $(e.currentTarget);
            const view = $item.data('view');
            const isWorkspace = $item.find('i').hasClass('fa-sitemap') || $item.find('i').hasClass('fa-folder');
            
            if (view) {
                // Check if this item represents a workspace (should show submenu)
                // or a board (should navigate directly)
                frappe.call({
                    method: 'smart_accounting.www.project_management.index.get_partition_info',
                    args: { partition_name: view },
                    callback: (r) => {
                        if (r.message && r.message.is_workspace) {
                            // Always show submenu for workspaces
                            this.showChildPartitions($item, view);
                        } else {
                            // Navigate directly for boards
                            console.log('Switching to partition:', view);
                            const currentUrl = new URL(window.location);
                            currentUrl.searchParams.set('view', view);
                            currentUrl.searchParams.set('_t', Date.now());
                            window.location.href = currentUrl.toString();
                        }
                    }
                });
            }
        });
        
        // Close menu when clicking outside
        $(document).on('click', (e) => {
            if (!$(e.target).closest('.pm-workspace-switcher').length) {
                $('.pm-workspace-menu').hide();
                $('.pm-workspace-submenu').remove();
            }
        });

        // Handle breadcrumb navigation
        $(document).on('click', '.pm-breadcrumb-item', (e) => {
            e.preventDefault();
            const targetView = $(e.currentTarget).data('view');
            if (targetView) {
                const currentUrl = new URL(window.location);
                currentUrl.searchParams.set('view', targetView);
                currentUrl.searchParams.set('_t', Date.now());
                window.location.href = currentUrl.toString();
            }
        });

        // Handle empty state back button
        $(document).on('click', '.pm-back-to-parent', (e) => {
            e.preventDefault();
            const targetView = $(e.currentTarget).data('view');
            if (targetView) {
                const currentUrl = new URL(window.location);
                currentUrl.searchParams.set('view', targetView);
                currentUrl.searchParams.set('_t', Date.now());
                window.location.href = currentUrl.toString();
            }
        });
    }

    showChildPartitions($parentItem, parentPartition) {
        // Check if we're already in a submenu (going deeper)
        const isGoingDeeper = $('.pm-workspace-submenu').length > 0;
        
        // Remove existing submenus
        $('.pm-workspace-submenu').remove();
        
        // Always show submenu for consistent UX, even if empty
        frappe.call({
            method: 'smart_accounting.www.project_management.index.get_child_partitions',
            args: { parent_partition: parentPartition },
            callback: (r) => {
                const childPartitions = r.message || [];
                this.createSubmenu($parentItem, childPartitions, parentPartition, isGoingDeeper);
            }
        });
    }
    
    createSubmenu($parentItem, childPartitions, parentPartition, isGoingDeeper = false) {
        const parentName = $parentItem.find('span').text();
        const isEmpty = childPartitions.length === 0;
        
        // Determine if we should show parent menu or main menu based on depth
        const backTarget = isGoingDeeper ? 'parent' : 'main';
        
        const submenuHtml = `
            <div class="pm-workspace-submenu" data-parent="${parentPartition}" data-back-target="${backTarget}">
                <div class="pm-submenu-header">
                    <button class="pm-back-btn" title="返回上级菜单" data-back-target="${backTarget}">
                        <i class="fa fa-arrow-left"></i>
                        <span>Back</span>
                    </button>
                    <span class="pm-submenu-title">Currently in: ${parentName}</span>
                </div>
                ${isEmpty ? `
                    <div class="pm-empty-workspace">
                        <i class="fa fa-folder-open"></i>
                        <h4>Empty Workspace</h4>
                        <p>No boards created yet. Create your first board below.</p>
                        <div class="pm-empty-workspace-actions">
                            <button class="pm-btn-secondary pm-back-to-main" onclick="this.closest('.pm-workspace-submenu').querySelector('.pm-back-btn').click()">
                                <i class="fa fa-arrow-left"></i>
                                ${backTarget === 'main' ? 'Back to Main Menu' : 'Back to Parent'}
                            </button>
                        </div>
                    </div>
                ` : childPartitions.map(child => `
                    <div class="pm-workspace-item" data-view="${child.name}" data-has-children="${child.has_children || false}">
                        <i class="fa fa-${child.is_workspace ? 'sitemap' : 'folder'}"></i>
                        <span class="pm-item-name">${child.partition_name}</span>
                        <span class="pm-item-type">(${child.is_workspace ? 'workspace' : 'board'})</span>
                        ${child.has_children ? '<i class="fa fa-chevron-right pm-workspace-arrow"></i>' : ''}
                    </div>
                `).join('')}
                <div class="pm-workspace-divider"></div>
                <div class="pm-workspace-item pm-create-workspace" data-parent="${parentPartition}">
                    <i class="fa fa-plus-circle"></i>
                    <span>Create new workspace</span>
                </div>
                <div class="pm-workspace-item pm-create-board" data-parent="${parentPartition}">
                    <i class="fa fa-folder-plus"></i>
                    <span>Create new board</span>
                </div>
            </div>
        `;
        
        $('.pm-workspace-menu').after(submenuHtml);
        
        // Handle back button
        $('.pm-back-btn').on('click', (e) => {
            e.stopPropagation();
            const backTarget = $(e.currentTarget).data('back-target');
            const parentPartition = $(e.currentTarget).closest('.pm-workspace-submenu').data('parent');
            
            console.log('Back button clicked - target:', backTarget, 'parent:', parentPartition);
            
            if (backTarget === 'main') {
                // Return to main menu
                this.showMainMenu();
            } else {
                // Return to parent submenu
                this.showParentSubmenu(parentPartition);
            }
        });
    }
    
    showMainMenu() {
        console.log('Showing main menu - removing submenu');
        // Remove submenu and show main menu
        $('.pm-workspace-submenu').remove();
        $('.pm-workspace-menu').show();
        console.log('Main menu should now be visible');
    }

    showParentSubmenu(currentPartition) {
        console.log('Showing parent submenu for:', currentPartition);
        
        // Get parent partition info
        frappe.call({
            method: 'smart_accounting.www.project_management.index.get_partition_info',
            args: { partition_name: currentPartition },
            callback: (r) => {
                if (r.message && r.message.parent_partition) {
                    const parentPartition = r.message.parent_partition;
                    console.log('Found parent partition:', parentPartition);
                    
                    // First try to find parent in main menu
                    let $parentItem = $(`.pm-workspace-menu .pm-workspace-item[data-view="${parentPartition}"]`);
                    
                    if ($parentItem.length) {
                        // Parent is in main menu, hide main menu and show parent's submenu
                        $('.pm-workspace-menu').hide();
                        this.showChildPartitions($parentItem, parentPartition);
                    } else {
                        // Parent might be in a deeper level, need to reconstruct the path
                        this.reconstructParentPath(parentPartition);
                    }
                } else {
                    // No parent, show main menu
                    console.log('No parent found, showing main menu');
                    this.showMainMenu();
                }
            }
        });
    }

    reconstructParentPath(parentPartition) {
        console.log('Reconstructing path for:', parentPartition);
        
        // Get parent info to build the correct menu hierarchy
        frappe.call({
            method: 'smart_accounting.www.project_management.index.get_partition_info',
            args: { partition_name: parentPartition },
            callback: (r) => {
                if (r.message) {
                    // Create a virtual parent item for the submenu
                    const $virtualParentItem = $(`
                        <div class="pm-workspace-item" data-view="${r.message.name}">
                            <span>${r.message.partition_name}</span>
                        </div>
                    `);
                    
                    // Show the parent's submenu
                    this.showChildPartitions($virtualParentItem, parentPartition);
                } else {
                    // Fallback to main menu
                    this.showMainMenu();
                }
            }
        });
    }

    showCreateWorkspaceDialog(parentPartition = null) {
        const currentView = parentPartition || new URLSearchParams(window.location.search).get('view');
        const contextText = currentView ? `Creating workspace in: ${currentView}` : 'Creating top-level workspace';
        
        const dialogHTML = `
            <div class="pm-create-dialog-overlay">
                <div class="pm-create-dialog">
                    <div class="pm-create-dialog-header">
                        <h3>Create New Workspace</h3>
                        <button class="pm-create-dialog-close">
                            <i class="fa fa-times"></i>
                        </button>
                    </div>
                    <div class="pm-create-dialog-body">
                        <div class="pm-context-indicator">
                            <i class="fa fa-info-circle"></i>
                            <span>${contextText}</span>
                        </div>
                        <div class="pm-form-group">
                            <label>Workspace Name</label>
                            <input type="text" class="pm-workspace-name-input" placeholder="Enter workspace name..." maxlength="50">
                        </div>
                        ${!parentPartition ? `
                        <div class="pm-form-group">
                            <label>Parent Workspace (Optional)</label>
                            <select class="pm-parent-workspace-select">
                                <option value="">No parent (top-level workspace)</option>
                            </select>
                        </div>
                        ` : ''}
                        <div class="pm-form-group">
                            <label>Description (Optional)</label>
                            <textarea class="pm-workspace-description-input" placeholder="Brief description..." rows="2" maxlength="200"></textarea>
                        </div>
                        ${parentPartition ? `<input type="hidden" class="pm-parent-partition" value="${parentPartition}">` : ''}
                    </div>
                    <div class="pm-create-dialog-footer">
                        <button class="pm-btn pm-btn-secondary pm-cancel-create">Cancel</button>
                        <button class="pm-btn pm-btn-primary pm-confirm-create">
                            <i class="fa fa-plus"></i>
                            Create Workspace
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        $('body').append(dialogHTML);
        $('.pm-create-dialog-overlay').fadeIn(200);
        $('.pm-workspace-name-input').focus();
        
        // Load available workspaces if creating standalone workspace
        if (!parentPartition) {
            this.loadAvailableWorkspaces();
        }
        
        this.bindCreateDialogEvents(true, parentPartition); // true = workspace
    }

    showCreateBoardDialog(parentPartition) {
        const isUnderWorkspace = !!parentPartition;
        const dialogTitle = isUnderWorkspace ? `Create New Board` : `Create New Board`;
        const contextText = parentPartition ? `Creating board in workspace: ${parentPartition}` : 'Creating standalone board';
        
        const dialogHTML = `
            <div class="pm-create-dialog-overlay">
                <div class="pm-create-dialog">
                    <div class="pm-create-dialog-header">
                        <h3>${dialogTitle}</h3>
                        <button class="pm-create-dialog-close">
                            <i class="fa fa-times"></i>
                        </button>
                    </div>
                    <div class="pm-create-dialog-body">
                        <div class="pm-context-indicator">
                            <i class="fa fa-info-circle"></i>
                            <span>${contextText}</span>
                        </div>
                        <div class="pm-form-group">
                            <label>Board Name</label>
                            <input type="text" class="pm-workspace-name-input" placeholder="Enter board name..." maxlength="50">
                        </div>
                        ${!parentPartition ? `
                        <div class="pm-form-group">
                            <label>Parent Workspace (Optional)</label>
                            <select class="pm-parent-workspace-select">
                                <option value="">No parent (standalone board)</option>
                            </select>
                        </div>
                        ` : ''}
                        <div class="pm-form-group">
                            <label>Description (Optional)</label>
                            <textarea class="pm-workspace-description-input" placeholder="Brief description..." rows="2" maxlength="200"></textarea>
                        </div>
                        ${parentPartition ? `<input type="hidden" class="pm-parent-partition" value="${parentPartition}">` : ''}
                    </div>
                    <div class="pm-create-dialog-footer">
                        <button class="pm-btn pm-btn-secondary pm-cancel-create">Cancel</button>
                        <button class="pm-btn pm-btn-primary pm-confirm-create">
                            <i class="fa fa-plus"></i>
                            Create Board
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        $('body').append(dialogHTML);
        $('.pm-create-dialog-overlay').fadeIn(200);
        $('.pm-workspace-name-input').focus();
        
        // Load available workspaces if creating standalone board
        if (!parentPartition) {
            this.loadAvailableWorkspaces();
        }
        
        this.bindCreateDialogEvents(false, parentPartition); // false = board, not workspace
    }

    loadAvailableWorkspaces() {
        frappe.call({
            method: 'smart_accounting.www.project_management.index.get_available_workspaces',
            callback: (r) => {
                if (r.message) {
                    const select = $('.pm-parent-workspace-select');
                    r.message.forEach(workspace => {
                        select.append(`<option value="${workspace.name}">${workspace.partition_name}</option>`);
                    });
                }
            }
        });
    }

    bindCreateDialogEvents(isWorkspace, parentPartition = null) {
        // Close dialog
        $('.pm-create-dialog-close, .pm-cancel-create').on('click', () => {
            $('.pm-create-dialog-overlay').fadeOut(200, function() {
                $(this).remove();
            });
        });
        
        // Close on overlay click
        $('.pm-create-dialog-overlay').on('click', (e) => {
            if (e.target === e.currentTarget) {
                $('.pm-create-dialog-overlay').fadeOut(200, function() {
                    $(this).remove();
                });
            }
        });
        
        // Handle enter key
        $('.pm-workspace-name-input').on('keypress', (e) => {
            if (e.which === 13) {
                $('.pm-confirm-create').click();
            }
        });
        
        // Create button
        $('.pm-confirm-create').on('click', async () => {
            const name = $('.pm-workspace-name-input').val().trim();
            const description = $('.pm-workspace-description-input').val().trim();
            const parent = $('.pm-parent-partition').val() || $('.pm-parent-workspace-select').val() || parentPartition;
            
            if (!name) {
                frappe.show_alert({
                    message: 'Name is required',
                    indicator: 'red'
                });
                return;
            }
            
            // Disable button during creation
            $('.pm-confirm-create').prop('disabled', true).text('Creating...');
            
            try {
                const response = await frappe.call({
                    method: 'smart_accounting.www.project_management.index.create_partition',
                    args: {
                        partition_name: name,
                        is_workspace: isWorkspace,
                        parent_partition: parent,
                        description: description
                    }
                });
                
                if (response.message && response.message.success) {
                    frappe.show_alert({
                        message: response.message.message,
                        indicator: 'green'
                    });
                    
                    // Close dialog
                    $('.pm-create-dialog-overlay').remove();
                    
                    // Navigate to new partition
                    const currentUrl = new URL(window.location);
                    currentUrl.searchParams.set('view', response.message.name);
                    currentUrl.searchParams.set('_t', Date.now());
                    window.location.href = currentUrl.toString();
                    
                } else {
                    throw new Error(response.message?.error || 'Creation failed');
                }
                
            } catch (error) {
                frappe.show_alert({
                    message: 'Error: ' + error.message,
                    indicator: 'red'
                });
                $('.pm-confirm-create').prop('disabled', false).html('<i class="fa fa-plus"></i> Create ' + (isWorkspace ? 'Workspace' : 'Board'));
            }
        });
    }

    async loadAvailableWorkspaces() {
        try {
            // Get all workspaces (is_workspace = 1)
            const response = await frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Partition',
                    fields: ['name', 'partition_name'],
                    filters: [
                        ['is_workspace', '=', 1],
                        ['is_archived', '!=', 1]
                    ],
                    order_by: 'partition_name'
                }
            });
            
            if (response.message && response.message.length > 0) {
                const $select = $('.pm-parent-workspace-select');
                response.message.forEach(workspace => {
                    $select.append(`<option value="${workspace.name}">${workspace.partition_name}</option>`);
                });
            }
        } catch (error) {
            // If loading fails, just keep the default "No parent" option
        }
    }

    // Apply partition-specific column configuration
    applyPartitionColumnConfig() {
        // Get current partition from URL
        const urlParams = new URLSearchParams(window.location.search);
        const currentView = urlParams.get('view') || 'main';
        
        // Load column configuration for current partition
        frappe.call({
            method: 'smart_accounting.www.project_management.index.get_partition_column_config',
            args: { partition_name: currentView },
            callback: (r) => {
                if (r.message && r.message.success) {
                    this.hideUnwantedColumns(r.message.visible_columns);
                    console.log('Applied column config for partition:', currentView, r.message.visible_columns);
                }
            }
        });
    }
    
    hideUnwantedColumns(visibleColumns) {
        // All possible columns
        const allColumns = [
            'client', 'entity', 'tf-tg', 'software', 'status', 'target-month', 
            'budget', 'actual', 'review-note', 'action-person', 'preparer', 
            'reviewer', 'partner', 'lodgment-due', 'year-end', 'last-updated', 'priority'
        ];
        
        // Hide columns not in visible list
        allColumns.forEach(column => {
            const shouldShow = visibleColumns.includes(column);
            
            // Hide/show header cells
            $(`.pm-header-cell[data-column="${column}"]`).toggle(shouldShow);
            
            // Hide/show data cells
            $(`.pm-cell-${column}`).toggle(shouldShow);
        });
        
        // Recalculate table width after hiding columns
        this.updateTableWidth();
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
