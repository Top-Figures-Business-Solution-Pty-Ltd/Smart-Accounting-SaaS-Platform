// Project Management - Project and Task Management
// Core project and task management logic

class ProjectManager {
    constructor() {
        this.utils = window.PMUtils;
        // Status options are now loaded dynamically from backend
        this.statusOptions = [];
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
        
        // Generate HTML with current column configuration
        const newTaskRowHTML = this.generateNewTaskRowHTML(taskData, clientName);
        
        // Insert the new row before the add task row
        $addRow.before(newTaskRowHTML);
        
        // Apply current column configuration to the new row
        let $newRow = $addRow.prev();
        
        // Apply column widths if TableManager exists
        if (window.TableManager && window.TableManager.getCurrentColumnWidths) {
            const currentWidths = window.TableManager.getCurrentColumnWidths();
            
            // Apply widths to each cell in the new row
            Object.keys(currentWidths).forEach(column => {
                const width = currentWidths[column];
                const $cell = $newRow.find(`.pm-cell-${column}`);
                if ($cell.length && width) {
                    $cell.css({
                        'width': `${width}px`,
                        'min-width': `${width}px`,
                        'flex': `0 0 ${width}px`
                    });
                }
            });
        }
        
        // Apply current column visibility configuration
        if (window.TableManager && window.TableManager.applyColumnConfigurationToRow) {
            window.TableManager.applyColumnConfigurationToRow($newRow);
        } else {
            // Fallback: manually apply current column visibility
            this.applyCurrentColumnVisibility($newRow);
        }
        
        // Restore the add task button
        $(addTaskBtn).html('<i class="fa fa-plus"></i><span>Add new task</span>');
        
        // Add a subtle animation to highlight the new row
        $newRow = $addRow.prev();
        $newRow.css('background-color', '#e8f5e8');
        
        // Initialize functional buttons for the new task using Primary Column Manager
        if (window.PrimaryColumnManager && taskData.task_id) {
            window.PrimaryColumnManager.initializeFunctionalButtonsForNewTask(taskData.task_id, clientName);
        }
        
        setTimeout(() => {
            $newRow.css('background-color', '');
        }, 2000);
    }

    generateNewTaskRowHTML(taskData, clientName, currentWidths, totalWidth, additionalClasses = '') {
        // Generate new task row HTML that matches the template structure exactly
        // IMPORTANT: Always generate ALL columns, let CSS control visibility (for dynamic column management)
        const statusValue = taskData.status || 'Not Started';
        const statusClass = statusValue.toLowerCase().replace(/\s+/g, '-');
        
        return `<div class="pm-task-row pm-responsive-table ${additionalClasses}" data-task-id="${taskData.task_id}" data-task-name="${taskData.task_subject}">
            <div class="pm-cell pm-cell-select">
                <input type="checkbox" class="pm-task-checkbox" data-task-id="${taskData.task_id}" title="Select this task">
            </div>
            <div class="pm-cell pm-cell-client pm-client-with-comments" data-field="custom_client" data-task-id="${taskData.task_id}" data-current-client-id="" data-current-client-name="${clientName || 'No Client'}">
                <span class="pm-client-selector-trigger client-display" 
                      data-task-id="${taskData.task_id}"
                      data-field="custom_client"
                      data-field-type="client_selector"
                      data-current-client-id=""
                      data-current-client-name="${clientName || 'No Client'}"
                      title="Click to select client">${clientName || 'No Client'}</span>
            </div>
            <div class="pm-cell pm-cell-task-name pm-editable-task-name" data-editable="true" data-field="subject" data-task-id="${taskData.task_id}" data-field-type="task_name_editor" data-current-task-name="${taskData.task_subject || ''}">
                <div class="pm-task-name-content">
                    <span class="editable-field task-name-display">${taskData.task_subject || 'Untitled Task'}</span>
                    <i class="fa fa-edit pm-edit-icon"></i>
                </div>
            </div>
            <div class="pm-cell pm-cell-entity">
                <span class="pm-entity-badge entity-company">Company</span>
            </div>
            <div class="pm-cell pm-cell-tf-tg" data-editable="true" data-field="custom_tftg" data-task-id="${taskData.task_id}" data-field-type="select" data-options="TF,TG" data-backend-options="Top Figures,Top Grants">
                <span class="pm-tf-tg-badge editable-field">TF</span>
            </div>
            <div class="pm-cell pm-cell-software" data-editable="true" data-field="custom_softwares" data-task-id="${taskData.task_id}" data-field-type="software_selector">
                <div class="pm-software-tags pm-empty-software">
                    <span class="pm-software-badge pm-empty-badge">
                        <i class="fa fa-plus"></i>
                        Add software
                    </span>
                </div>
            </div>
            <div class="pm-cell pm-cell-status">
                <span class="pm-status-badge status-${statusClass}">${statusValue}</span>
            </div>
            <div class="pm-cell pm-cell-target-month" data-editable="true" data-field="custom_target_month" data-task-id="${taskData.task_id}" data-field-type="select" data-options-source="dynamic">
                <span class="editable-field">${taskData.target_month || '-'}</span>
            </div>
            <div class="pm-cell pm-cell-budget" data-editable="true" data-field="custom_budget_planning" data-task-id="${taskData.task_id}" data-field-type="currency">
                <span class="pm-no-amount editable-field">-</span>
            </div>
            <div class="pm-cell pm-cell-actual" data-editable="true" data-field="custom_actual_billing" data-task-id="${taskData.task_id}" data-field-type="currency">
                <span class="pm-no-amount editable-field">-</span>
            </div>
            <div class="pm-cell pm-cell-review-note">
                <div class="pm-review-note-indicator no-notes" data-task-id="${taskData.task_id}">
                    <i class="fa fa-times-circle"></i>
                    <span>none</span>
                </div>
            </div>
            <div class="pm-cell pm-cell-action-person" data-editable="true" data-field="custom_action_person" data-task-id="${taskData.task_id}" data-field-type="person_selector">
                <div class="pm-user-avatars pm-empty-person">
                    <div class="pm-avatar pm-empty-avatar">
                        <i class="fa fa-user"></i>
                    </div>
                </div>
            </div>
            <div class="pm-cell pm-cell-preparer" data-editable="true" data-field="custom_preparer" data-task-id="${taskData.task_id}" data-field-type="person_selector">
                <div class="pm-user-avatars pm-empty-person">
                    <div class="pm-avatar pm-empty-avatar">
                        <i class="fa fa-user"></i>
                    </div>
                </div>
            </div>
            <div class="pm-cell pm-cell-reviewer" data-editable="true" data-field="custom_reviewer" data-task-id="${taskData.task_id}" data-field-type="person_selector">
                <div class="pm-user-avatars pm-empty-person">
                    <div class="pm-avatar pm-empty-avatar">
                        <i class="fa fa-user"></i>
                    </div>
                </div>
            </div>
            <div class="pm-cell pm-cell-partner" data-editable="true" data-field="custom_partner" data-task-id="${taskData.task_id}" data-field-type="person_selector">
                <div class="pm-user-avatars pm-empty-person">
                    <div class="pm-avatar pm-empty-avatar">
                        <i class="fa fa-user"></i>
                    </div>
                </div>
            </div>
            <div class="pm-cell pm-cell-process-date" data-editable="true" data-field="custom_process_date" data-task-id="${taskData.task_id}" data-field-type="date">
                <span class="editable-field">-</span>
            </div>
            <div class="pm-cell pm-cell-lodgment-due" data-editable="true" data-field="custom_lodgement_due_date" data-task-id="${taskData.task_id}" data-field-type="date">
                <span class="editable-field">-</span>
            </div>
            <div class="pm-cell pm-cell-engagement pm-engagement-indicator" data-task-id="${taskData.task_id}" data-current-engagement="">
                <div class="pm-engagement-content">
                    <span class="pm-engagement-display no-engagement">No engagement</span>
                </div>
            </div>
            <div class="pm-cell pm-cell-group">
                <div class="pm-group-content">
                    <span class="pm-group-display">-</span>
                </div>
            </div>
            <div class="pm-cell pm-cell-year-end" data-editable="true" data-field="custom_year_end" data-task-id="${taskData.task_id}" data-field-type="select" data-options-source="dynamic">
                <span class="editable-field">${taskData.year_end || '-'}</span>
            </div>
            <div class="pm-cell pm-cell-note" data-editable="true" data-field="custom_note" data-task-id="${taskData.task_id}" data-field-type="text">
                <span class="editable-field">-</span>
            </div>
            <div class="pm-cell pm-cell-last-updated">
                <span class="pm-last-updated">Just now</span>
            </div>
            <div class="pm-cell pm-cell-priority"
                 data-editable="true"
                 data-field="priority"
                 data-task-id="${taskData.task_id}"
                 data-field-type="select"
                 data-options="Low,Medium,High,Urgent">
                <span class="pm-priority-badge priority-medium editable-field">Medium</span>
            </div>
            <div class="pm-cell pm-cell-frequency" 
                 data-editable="true" 
                 data-field="custom_frequency" 
                 data-task-id="${taskData.task_id}" 
                 data-field-type="select" 
                 data-options="Annually,Half Yearly,Quarterly,Monthly,Fortnightly,Weekly,Daily,Ad-Hoc,Other">
                <span class="editable-field">-</span>
            </div>
            <div class="pm-cell pm-cell-reset-date" data-editable="true" data-field="custom_reset_date" data-task-id="${taskData.task_id}" data-field-type="date">
                <span class="editable-field">-</span>
            </div>
        </div>`;
    }

    applyCurrentColumnVisibility($row) {
        // Apply current column visibility to a specific row
        // This ensures new rows respect the current Manage Columns settings
        const allColumns = window.ColumnConfigManager ? 
            window.ColumnConfigManager.getAllColumnKeys() : 
            // 后备硬编码列表（如果ColumnConfigManager不可用）
            ['client', 'task-name', 'entity', 'tf-tg', 'software', 'status', 'target-month', 
             'budget', 'actual', 'review-note', 'action-person', 'preparer', 
             'reviewer', 'partner', 'process-date', 'lodgment-due', 'engagement', 'group', 'year-end', 'note', 'last-updated', 'priority', 'frequency', 'reset-date'];
        
        allColumns.forEach(column => {
            const $headerCell = $(`.pm-header-cell[data-column="${column}"]`).first();
            const $rowCell = $row.find(`.pm-cell-${column}`);
            
            if ($headerCell.length && $rowCell.length) {
                // Copy visibility state from header to row cell
                if ($headerCell.is(':visible') && $headerCell.css('display') !== 'none') {
                    $rowCell.show().css('display', '').removeClass('column-hidden');
                } else {
                    $rowCell.hide().css('display', 'none !important').addClass('column-hidden');
                }
            }
        });
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
        
        // Generate HTML with current column configuration
        const newTaskRowHTML = this.generateNewTaskRowHTML(taskData, clientName, {}, 0, 'new-task-highlight');
        
        // Insert at the top of the project's task group
        const $taskGroup = $projectGroup.find('.pm-task-group');
        $taskGroup.prepend(newTaskRowHTML);
        
        // Apply current column configuration to the new row
        let $newRow = $taskGroup.find('.new-task-highlight');
        
        // Apply column widths
        if (window.TableManager && window.TableManager.getCurrentColumnWidths) {
            const currentWidths = window.TableManager.getCurrentColumnWidths();
            
            // Apply widths to each cell in the new row
            Object.keys(currentWidths).forEach(column => {
                const width = currentWidths[column];
                const $cell = $newRow.find(`.pm-cell-${column}`);
                if ($cell.length && width) {
                    $cell.css({
                        'width': `${width}px`,
                        'min-width': `${width}px`,
                        'flex': `0 0 ${width}px`
                    });
                }
            });
        }
        
        // Apply current column visibility configuration
        if (window.TableManager && window.TableManager.applyColumnConfigurationToRow) {
            window.TableManager.applyColumnConfigurationToRow($newRow);
        } else {
            // Fallback: manually apply current column visibility
            this.applyCurrentColumnVisibility($newRow);
        }
        
        // Scroll to the new task
        $newRow[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Highlight animation
        $newRow.css('background-color', '#e8f5e8');
        setTimeout(() => {
            $newRow.css('background-color', '').removeClass('new-task-highlight');
        }, 3000);
    }

    createNewProject() {
        // Show custom project creation modal
        this.showCreateProjectModal();
    }

    async showCreateProjectModal() {
        try {
            // Get form data from backend
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.get_project_form_data'
            });

            if (!response.message || !response.message.success) {
                frappe.show_alert({
                    message: 'Error loading form data: ' + (response.message?.error || 'Unknown error'),
                    indicator: 'red'
                });
                return;
            }

            const formData = response.message;
            console.log('DEBUG: Form data received:', formData);
            console.log('DEBUG: Service lines:', formData.service_lines);
            this.renderCreateProjectModal(formData);

        } catch (error) {
            frappe.show_alert({
                message: 'Error loading form data: ' + error.message,
                indicator: 'red'
            });
        }
    }

    renderCreateProjectModal(formData) {
        // Get current partition from URL if available
        const currentView = new URLSearchParams(window.location.search).get('view');
        const currentPartition = currentView && currentView !== 'main' ? currentView : '';

        const modalHTML = `
            <div class="pm-project-modal-overlay">
                <div class="pm-project-modal">
                    <div class="pm-project-modal-header">
                        <h3><i class="fa fa-folder-plus"></i> New Project</h3>
                        <button class="pm-project-modal-close">
                            <i class="fa fa-times"></i>
                        </button>
                    </div>
                    <div class="pm-project-modal-body">
                        <form class="pm-project-form">
                            <div class="pm-form-row">
                                <div class="pm-form-group">
                                    <label for="project-name">Project Name <span class="required">*</span></label>
                                    <input type="text" id="project-name" class="pm-form-control" 
                                           placeholder="Enter project name..." maxlength="140" required>
                                </div>
                            </div>
                            
                            <div class="pm-form-row">
                                <div class="pm-form-group">
                                    <label for="service-line">Service Line</label>
                                    <div class="pm-service-line-selector">
                                        <input type="text" id="service-line" class="pm-form-control pm-service-line-input" 
                                               placeholder="Search or enter service line..." autocomplete="off">
                                        <div class="pm-service-line-dropdown" style="display: none;">
                                            ${formData.service_lines.map(sl => 
                                                `<div class="pm-service-line-option" data-value="${sl.name}">
                                                    <span class="pm-option-title">${sl.service_name || sl.name}</span>
                                                    ${sl.service_name && sl.service_name !== sl.name ? 
                                                        `<small class="pm-option-subtitle">${sl.name}</small>` : ''
                                                    }
                                                </div>`
                                            ).join('')}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="pm-form-row">
                                <div class="pm-form-group">
                                    <label for="project-partition">Partition <span class="required">*</span></label>
                                    <select id="project-partition" class="pm-form-control" required>
                                        <option value="">Select partition...</option>
                                        ${formData.partitions.map(partition => 
                                            `<option value="${partition.name}" ${partition.name === currentPartition ? 'selected' : ''}>
                                                ${partition.partition_name}
                                            </option>`
                                        ).join('')}
                                    </select>
                                </div>
                            </div>
                            
                            <div class="pm-form-row">
                                <div class="pm-form-group pm-checkbox-group">
                                    <label class="pm-checkbox-label">
                                        <input type="checkbox" id="is-archived" class="pm-checkbox">
                                        <span class="pm-checkbox-text">Is Archived</span>
                                    </label>
                                </div>
                            </div>
                        </form>
                    </div>
                    <div class="pm-project-modal-footer">
                        <button type="button" class="pm-btn pm-btn-secondary pm-project-cancel">Cancel</button>
                        <button type="button" class="pm-btn pm-btn-primary pm-project-save">
                            <i class="fa fa-save"></i> Create Project
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal
        $('.pm-project-modal-overlay').remove();
        
        // Add modal to body
        $('body').append(modalHTML);
        
        // Show modal with animation
        $('.pm-project-modal-overlay').fadeIn(200);
        
        // Focus on project name field
        setTimeout(() => {
            $('#project-name').focus();
        }, 250);
        
        // Bind events
        this.bindCreateProjectModalEvents();
        
        // Initialize service line selector
        this.initializeServiceLineSelector(formData.service_lines);
    }

    initializeServiceLineSelector(serviceLines) {
        const $input = $('.pm-service-line-input');
        const $dropdown = $('.pm-service-line-dropdown');
        let selectedValue = '';

        // Show dropdown on focus
        $input.on('focus', () => {
            if (serviceLines.length > 0) {
                $dropdown.show();
                this.filterServiceLineOptions('');
            }
        });

        // Filter options on input
        $input.on('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            this.filterServiceLineOptions(searchTerm);
            selectedValue = ''; // Clear selection when typing
        });

        // Handle option selection
        $(document).on('click', '.pm-service-line-option', (e) => {
            const $option = $(e.currentTarget);
            const value = $option.data('value');
            const displayText = $option.find('.pm-option-title').text();
            
            $input.val(displayText);
            selectedValue = value;
            $dropdown.hide();
        });

        // Hide dropdown when clicking outside
        $(document).on('click', (e) => {
            if (!$(e.target).closest('.pm-service-line-selector').length) {
                $dropdown.hide();
            }
        });

        // Handle keyboard navigation
        $input.on('keydown', (e) => {
            const $options = $('.pm-service-line-option:visible');
            const $current = $('.pm-service-line-option.highlighted');
            let $next;

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    if ($dropdown.is(':hidden')) {
                        $dropdown.show();
                        this.filterServiceLineOptions('');
                    } else {
                        $next = $current.length ? $current.next('.pm-service-line-option:visible') : $options.first();
                        if ($next.length) {
                            $('.pm-service-line-option').removeClass('highlighted');
                            $next.addClass('highlighted');
                        }
                    }
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    $next = $current.length ? $current.prev('.pm-service-line-option:visible') : $options.last();
                    if ($next.length) {
                        $('.pm-service-line-option').removeClass('highlighted');
                        $next.addClass('highlighted');
                    }
                    break;
                case 'Enter':
                    e.preventDefault();
                    if ($current.length) {
                        $current.click();
                    }
                    break;
                case 'Escape':
                    $dropdown.hide();
                    break;
            }
        });

        // Store selected value for form submission
        $input.data('selected-value', () => selectedValue || $input.val());
    }

    filterServiceLineOptions(searchTerm) {
        $('.pm-service-line-option').each(function() {
            const $option = $(this);
            const title = $option.find('.pm-option-title').text().toLowerCase();
            const subtitle = $option.find('.pm-option-subtitle').text().toLowerCase();
            
            if (title.includes(searchTerm) || subtitle.includes(searchTerm)) {
                $option.show();
            } else {
                $option.hide();
            }
        });

        // Remove highlight when filtering
        $('.pm-service-line-option').removeClass('highlighted');
    }

    bindCreateProjectModalEvents() {
        // Close modal events
        $('.pm-project-modal-close, .pm-project-cancel').on('click', () => {
            this.closeCreateProjectModal();
        });
        
        // Close on overlay click
        $('.pm-project-modal-overlay').on('click', (e) => {
            if (e.target === e.currentTarget) {
                this.closeCreateProjectModal();
            }
        });
        
        // Handle enter key in form
        $('.pm-project-form input, .pm-project-form select').on('keypress', (e) => {
            if (e.which === 13) {
                e.preventDefault();
                $('.pm-project-save').click();
            }
        });
        
        // Handle form submission
        $('.pm-project-save').on('click', () => {
            this.submitCreateProject();
        });
        
        // ESC key to close
        $(document).on('keydown.project-modal', (e) => {
            if (e.key === 'Escape') {
                this.closeCreateProjectModal();
            }
        });
    }

    closeCreateProjectModal() {
        $('.pm-project-modal-overlay').fadeOut(200, function() {
            $(this).remove();
        });
        $(document).off('keydown.project-modal');
    }

    async submitCreateProject() {
        try {
            // Get form values
            const projectName = $('#project-name').val().trim();
            const $serviceLineInput = $('.pm-service-line-input');
            const serviceLine = $serviceLineInput.data('selected-value') ? $serviceLineInput.data('selected-value')() : $serviceLineInput.val().trim();
            const partition = $('#project-partition').val();
            const isArchived = $('#is-archived').is(':checked') ? 1 : 0;

            // Validate required fields
            if (!projectName) {
                frappe.show_alert({
                    message: 'Project name is required',
                    indicator: 'red'
                });
                $('#project-name').focus();
                return;
            }

            if (!partition) {
                frappe.show_alert({
                    message: 'Partition is required',
                    indicator: 'red'
                });
                $('#project-partition').focus();
                return;
            }

            // Disable save button during submission
            $('.pm-project-save').prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i> Creating...');

            // Submit to backend
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.create_project',
                args: {
                    project_name: projectName,
                    service_line: serviceLine,
                    partition: partition,
                    is_archived: isArchived
                }
            });

            if (response.message && response.message.success) {
                frappe.show_alert({
                    message: response.message.message,
                    indicator: 'green'
                });
                
                // Close modal
                this.closeCreateProjectModal();
                
                // Refresh the page to show new project
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
                
            } else {
                throw new Error(response.message?.error || 'Project creation failed');
            }

        } catch (error) {
            frappe.show_alert({
                message: 'Error creating project: ' + error.message,
                indicator: 'red'
            });
            
            // Re-enable save button
            $('.pm-project-save').prop('disabled', false).html('<i class="fa fa-save"></i> Create Project');
        }
    }

    // Status management
    showStatusMenu(statusBadge) {
        const $badge = $(statusBadge);
        // 修复：支持both task和subtask的status badge点击
        const $taskRow = $badge.closest('.pm-task-row');
        const $subtaskRow = $badge.closest('.pm-subtask-row');
        const taskId = $taskRow.length ? $taskRow.data('task-id') : $subtaskRow.data('subtask-id');
        
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
        
        // Use dynamic status options, with minimal fallback if needed
        const availableStatuses = this.statusOptions.length > 0 ? this.statusOptions : ['Open', 'Completed'];
        const statusOptions = availableStatuses.map((status, index) => ({
            value: status,
            label: status,
            color: colors[index % colors.length]
        }));

        this.showContextMenu($badge, statusOptions, (newStatus) => {
            // Always update the current task first, let multiselect.js handle bulk update confirmation
            this.updateTaskStatus(taskId, newStatus);
        });
    }

    showPriorityMenu(priorityBadge) {
        const $badge = $(priorityBadge);
        // 修复：支持both task和subtask的priority badge点击
        const $taskRow = $badge.closest('.pm-task-row');
        const $subtaskRow = $badge.closest('.pm-subtask-row');
        const $row = $taskRow.length ? $taskRow : $subtaskRow;
        const taskId = $taskRow.length ? $taskRow.data('task-id') : $subtaskRow.data('subtask-id');
        
        console.log(`🔍 DEBUG showPriorityMenu:`);
        console.log(`🔍   - priorityBadge element:`, priorityBadge);
        console.log(`🔍   - $badge jQuery object:`, $badge);
        console.log(`🔍   - $badge length:`, $badge.length);
        console.log(`🔍   - $badge text:`, $badge.text());
        console.log(`🔍   - $badge classes:`, $badge.attr('class'));
        console.log(`🔍   - $taskRow:`, $taskRow);
        console.log(`🔍   - taskId:`, taskId);
        
        const priorityOptions = [
            { value: 'Low', label: 'Low', color: 'var(--monday-blue)' },
            { value: 'Medium', label: 'Medium', color: 'var(--monday-orange)' },
            { value: 'High', label: 'High', color: 'var(--monday-red)' },
            { value: 'Urgent', label: 'Urgent', color: 'var(--monday-purple)' }
        ];

        this.showContextMenu($badge, priorityOptions, (newPriority) => {
            // CRITICAL FIX: Store original value BEFORE any changes, then call API
            // Don't update UI here - let the API success handler do it (like status field)
            const originalValue = $badge.text().trim();
            console.log(`🎯 Priority Menu Click: taskId=${taskId}, originalValue="${originalValue}", newValue="${newPriority}"`);
            
            // Call API directly - UI will be updated in success handler
            this.updateTaskPriority(taskId, newPriority);
        });
    }

    showContextMenu($trigger, options, callback) {
        // Remove existing menus
        $('.pm-context-menu').remove();

        // Determine if this is a status menu (for grid layout)
        const isStatusMenu = $trigger.hasClass('pm-status-badge') || $trigger.closest('.pm-cell-status').length > 0;
        
        if (isStatusMenu) {
            this.showStatusGridMenu($trigger, options, callback);
        } else {
            this.showStandardContextMenu($trigger, options, callback);
        }
    }

    showStatusGridMenu($trigger, options, callback) {
        // Create grid-based status menu (3 columns per row)
        const columnsPerRow = 3;
        const rows = [];
        
        for (let i = 0; i < options.length; i += columnsPerRow) {
            const rowOptions = options.slice(i, i + columnsPerRow);
            rows.push(rowOptions);
        }

        const menu = $(`
            <div class="pm-context-menu pm-status-grid-menu">
                <div class="pm-status-grid-header">
                    <span class="pm-grid-title">Select Status</span>
                    <button class="pm-grid-close" type="button">
                        <i class="fa fa-times"></i>
                    </button>
                </div>
                <div class="pm-status-grid-container">
                    ${rows.map(row => `
                        <div class="pm-status-grid-row">
                            ${row.map(option => `
                                <div class="pm-status-grid-item" data-value="${option.value}" title="${option.label}">
                                    <div class="pm-status-color-indicator" style="background: ${option.color}"></div>
                                    <span class="pm-status-label">${option.label}</span>
                                </div>
                            `).join('')}
                            ${row.length < columnsPerRow ? 
                                Array(columnsPerRow - row.length).fill('<div class="pm-status-grid-item pm-empty-slot"></div>').join('') 
                                : ''
                            }
                        </div>
                    `).join('')}
                </div>
            </div>
        `);

        // Position menu with better positioning logic
        const offset = $trigger.offset();
        const menuWidth = 320; // Approximate width for 3 columns
        const menuHeight = Math.ceil(options.length / columnsPerRow) * 50 + 60; // Approximate height
        
        let left = offset.left;
        let top = offset.top + $trigger.outerHeight() + 8;
        
        // Adjust position if menu would go off-screen
        const windowWidth = $(window).width();
        const windowHeight = $(window).height();
        const scrollTop = $(window).scrollTop();
        
        if (left + menuWidth > windowWidth - 20) {
            left = windowWidth - menuWidth - 20;
        }
        
        if (top + menuHeight > windowHeight + scrollTop - 20) {
            top = offset.top - menuHeight - 8; // Show above trigger
        }

        menu.css({
            position: 'fixed',
            top: top - scrollTop,
            left: left,
            zIndex: 9999
        });

        $('body').append(menu);

        // Handle menu clicks
        menu.on('click', '.pm-status-grid-item:not(.pm-empty-slot)', function() {
            const value = $(this).data('value');
            callback(value);
            menu.remove();
        });

        // Handle close button
        menu.on('click', '.pm-grid-close', function(e) {
            e.stopPropagation();
            menu.remove();
        });

        // Close menu on outside click
        setTimeout(() => {
            $(document).one('click', (e) => {
                if (!$(e.target).closest('.pm-status-grid-menu').length) {
                    menu.remove();
                }
            });
        }, 100);

        // Close on escape key
        $(document).one('keydown', (e) => {
            if (e.key === 'Escape') {
                menu.remove();
            }
        });
    }

    showStandardContextMenu($trigger, options, callback) {
        // Original vertical menu for non-status items
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
            console.log(`🎯 Menu item clicked: value="${value}"`);
            console.log(`🎯 About to call callback with value:`, value);
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
            // CRITICAL FIX: Store original value BEFORE making API call
            // 修复：支持both task和subtask的status更新
            const $taskRow = $(`.pm-task-row[data-task-id="${taskId}"]`);
            const $subtaskRow = $(`.pm-subtask-row[data-subtask-id="${taskId}"]`);
            const $row = $taskRow.length ? $taskRow : $subtaskRow;
            const $statusBadge = $row.find('.pm-status-badge');
            const $progressBar = $row.find('.pm-progress-fill');
            const originalValue = $statusBadge.text().trim();
            
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.update_task_status',
                args: {
                    task_id: taskId,
                    new_status: newStatus
                }
            });

            if (response.message && response.message.success) {
                
                // Trigger bulk update event BEFORE UI update to avoid DOM reading issues
                if (!window.bulkUpdateInProgress) {
                    console.log(`🚀 Triggering pm:cell:changed event: taskId=${taskId}, field=status, newValue=${newStatus}, originalValue=${originalValue}`);
                    $(document).trigger('pm:cell:changed', {
                        taskId: taskId,
                        field: 'status',
                        newValue: newStatus,
                        oldValue: originalValue
                    });
                }

                // Update UI after triggering event
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

                // Only show individual success message if not in bulk update mode
                if (!window.bulkUpdateInProgress) {
                    frappe.show_alert({
                        message: 'Task status updated successfully',
                        indicator: 'green'
                    });
                }
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


    async updateTaskPriority(taskId, newPriority) {
        try {
            // CRITICAL FIX: Follow same pattern as updateTaskStatus
            // 修复：支持both task和subtask的priority更新
            const $taskRow = $(`.pm-task-row[data-task-id="${taskId}"]`);
            const $subtaskRow = $(`.pm-subtask-row[data-subtask-id="${taskId}"]`);
            const $row = $taskRow.length ? $taskRow : $subtaskRow;
            const $priorityBadge = $row.find('.pm-priority-badge');
            const originalValue = $priorityBadge.text().trim();
            
            console.log(`🔧 Priority Update START: taskId=${taskId}, originalValue="${originalValue}", newValue="${newPriority}"`);
            
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.update_task_field',
                args: {
                    task_id: taskId,
                    field_name: 'priority',
                    new_value: newPriority
                }
            });

            if (response.message && response.message.success) {
                
                // Trigger bulk update event BEFORE UI update (same as status field)
                if (!window.bulkUpdateInProgress && window.multiSelectManager && 
                    window.multiSelectManager.selectedTasks.has(taskId) && 
                    window.multiSelectManager.selectedTasks.size > 1) {
                    
                    console.log(`🚀 Triggering pm:cell:changed event: taskId=${taskId}, field=priority, newValue=${newPriority}, originalValue=${originalValue}`);
                    $(document).trigger('pm:cell:changed', {
                        taskId: taskId,
                        field: 'priority',
                        newValue: newPriority,
                        oldValue: originalValue
                    });
                }

                // CRITICAL FIX: Re-find DOM elements after API call (same as status field)
                const $updatedRow = $(`.pm-task-row[data-task-id="${taskId}"]`);
                const $updatedPriorityBadge = $updatedRow.find('.pm-priority-badge');
                
                console.log(`🔧 Re-found elements: row=${$updatedRow.length}, badge=${$updatedPriorityBadge.length}`);
                
                // Update UI after triggering event (same as status field)
                $updatedPriorityBadge.attr('class', 'pm-priority-badge editable-field')
                                   .addClass(`priority-${newPriority.toLowerCase()}`)
                                   .text(newPriority);

                console.log(`🔧 UI Updated: text="${$updatedPriorityBadge.text()}", classes="${$updatedPriorityBadge.attr('class')}"`);

                // Only show individual success message if not in bulk update mode
                if (!window.bulkUpdateInProgress) {
                    frappe.show_alert({
                        message: 'Task priority updated successfully',
                        indicator: 'green'
                    });
                }
            } else {
                frappe.show_alert({
                    message: 'Failed to update task priority',
                    indicator: 'red'
                });
            }
        } catch (error) {
            console.error('Priority update error:', error);
            frappe.show_alert({
                message: 'Error updating task priority: ' + error.message,
                indicator: 'red'
            });
        }
    }

    revertTaskStatus(taskId, originalStatus) {
        // Revert task status to original value (for cancelled bulk updates)
        try {
            const $row = $(`.pm-task-row[data-task-id="${taskId}"]`);
            const $statusBadge = $row.find('.pm-status-badge');
            const $progressBar = $row.find('.pm-progress-fill');

            if ($statusBadge.length) {
                // Restore original status
                const statusClass = originalStatus.toLowerCase().replace(/\s+/g, '-');
                $statusBadge.attr('class', 'pm-status-badge')
                           .addClass(`status-${statusClass}`)
                           .text(originalStatus);
                
                // Apply original color
                if (this.utils && this.utils.applyStatusColor) {
                    this.utils.applyStatusColor($statusBadge, originalStatus);
                }
                
                // Update progress bar
                let progress = 0;
                if (originalStatus === 'Completed') progress = 100;
                else if (originalStatus === 'Working') progress = 50;
                
                if ($progressBar.length) {
                    $progressBar.css('width', `${progress}%`);
                }
            }
        } catch (error) {
            console.error('Error reverting task status:', error);
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
            // 确保frappe完全初始化后再调用API
            if (!window.frappe || !frappe.call || !frappe.csrf_token) {
                // 延迟重试
                setTimeout(() => this.loadSystemOptions(), 500);
                return;
            }
            
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
            // Status options will be loaded dynamically via API when needed
            this.statusOptions = [];
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
