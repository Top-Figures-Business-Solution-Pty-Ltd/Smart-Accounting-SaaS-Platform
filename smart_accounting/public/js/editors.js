// Project Management - Inline Editors
// Inline editing functionality for tasks and fields

class EditorsManager {
    constructor() {
        this.utils = window.PMUtils;
    }

    // Inline editing initialization
    initializeInlineEditing() {
        // Bind click events for editable fields
        $(document).on('click', '[data-editable="true"]', (e) => {
            e.stopPropagation();
            
            // Don't trigger editing if clicking on subtask toggle
            if ($(e.target).closest('.pm-subtask-toggle').length > 0) {
                return;
            }
            
            const fieldType = $(e.currentTarget).data('field-type');
            const taskId = $(e.currentTarget).data('task-id');
            const fieldName = $(e.currentTarget).data('field');
            
            if (fieldType === 'person_selector') {
                if (window.PersonSelectorManager) {
                    window.PersonSelectorManager.showMultiPersonSelector($(e.currentTarget), taskId, fieldName);
                }
            } else if (fieldType === 'software_selector') {
                if (window.SoftwareSelectorManager) {
                    window.SoftwareSelectorManager.showSoftwareSelector($(e.currentTarget), taskId, fieldName);
                }
            } else {
                this.makeEditable(e.currentTarget);
            }
        });

        // Prevent row click when editing
        $(document).on('click', '.pm-task-row.editing', (e) => {
            e.stopPropagation();
        });
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
            // Force English locale for date picker
            $input.attr('lang', 'en-US');
            $input.css('color-scheme', 'light');
            
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

    createDateEditor($cell, currentValue) {
        // Very simple date editor with English locale
        let dateValue = '';
        if (currentValue && currentValue !== '-' && currentValue.trim() !== '') {
            const cleanValue = currentValue.trim();
            // Only use value if it's already in YYYY-MM-DD format
            if (/^\d{4}-\d{2}-\d{2}$/.test(cleanValue)) {
                dateValue = cleanValue;
            }
        }
        
        return `<input type="date" value="${dateValue}" lang="en-US" data-locale="en-US" style="width: 100%; border: 2px solid var(--monday-blue); padding: 6px 8px; border-radius: 4px; font-size: 14px; z-index: 10000; position: relative; background: white; color-scheme: light;">`;
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

    // Field-specific editors
    startFieldEditing(fieldElement) {
        const $field = $(fieldElement);
        // Support both main task cells and subtask cells
        const $cell = $field.closest('.pm-cell, .pm-subtask-status-cell, .pm-subtask-due-cell, .pm-subtask-note-cell, [data-editable="true"]');
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
            case 'task_name_editor':
                this.showTaskNameEditor($cell);
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

    // Client Selector
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
            const confirmed = await this.utils.showConfirmDialog(
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
                const currentTaskId = $cell.data('task-id'); // Re-get taskId to avoid scope issues
                $cell.html(`
                    <div class="pm-client-content">
                        <button class="pm-subtask-toggle" data-task-id="${currentTaskId}" title="Show/hide subtasks">
                            <i class="fa fa-chevron-right"></i>
                        </button>
                        <span class="editable-field client-display">${customerName}</span>
                    </div>
                    ${currentCommentHtml}
                `);
                $cell.removeClass('editing');
                $cell[0].offsetHeight; // Force reflow
                
                // Remove dropdown from body
                $(`#client-dropdown-${taskId}`).remove();
                
                // Remove event listener
                $(document).off('click.client-selector');
                
                // Update group display based on new customer
                if (window.ProjectManager) {
                    window.ProjectManager.updateGroupDisplay(taskId, customerId);
                }
                
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
            const confirmed = await this.utils.showConfirmDialog(
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
        const currentTaskId = $cell.data('task-id'); // Use different variable name to avoid conflicts
        
        // Preserve comment indicator when canceling
        const currentCommentHtml = $cell.find('.pm-client-comments').prop('outerHTML') || `
            <div class="pm-client-comments">
                <div class="pm-comment-indicator" data-task-id="${currentTaskId}">
                    <i class="fa fa-comment-o"></i>
                    <span class="pm-comment-count">0</span>
                </div>
            </div>
        `;
        
        $cell.html(`
            <div class="pm-client-content">
                <button class="pm-subtask-toggle" data-task-id="${currentTaskId}" title="Show/hide subtasks">
                    <i class="fa fa-chevron-right"></i>
                </button>
                <span class="editable-field client-display">${originalName}</span>
            </div>
            ${currentCommentHtml}
        `);
        $cell.removeClass('editing');
        
        // Remove dropdown from body
        $(`#client-dropdown-${currentTaskId}`).remove();
        
        // Remove event listener
        $(document).off('click.client-selector');
    }

    // Task Name Editor
    showTaskNameEditor($cell) {
        const currentTaskName = $cell.data('current-task-name') || '';
        const taskId = $cell.data('task-id');
        
        // Create task name editor HTML with confirmation dialog
        const editorHTML = `
            <div class="task-name-editor-container">
                <input type="text" class="task-name-input" 
                       value="${currentTaskName}"
                       placeholder="Enter task name..." 
                       data-task-id="${taskId}"
                       maxlength="140">
                <div class="task-name-actions">
                    <button class="task-name-save-btn" type="button" title="Save">
                        <i class="fa fa-check"></i>
                    </button>
                    <button class="task-name-cancel-btn" type="button" title="Cancel">
                        <i class="fa fa-times"></i>
                    </button>
                </div>
            </div>
        `;
        
        // Replace cell content with editor
        $cell.html(editorHTML);
        
        // Focus and select text
        const $input = $cell.find('.task-name-input');
        $input.focus().select();
        
        // Handle save button click
        $cell.find('.task-name-save-btn').on('click', (e) => {
            e.stopPropagation();
            const newTaskName = $input.val().trim();
            this.saveTaskName($cell, taskId, newTaskName);
        });
        
        // Handle cancel button click
        $cell.find('.task-name-cancel-btn').on('click', (e) => {
            e.stopPropagation();
            this.cancelTaskNameEditing($cell, currentTaskName);
        });
        
        // Handle Enter/Escape keys
        $input.on('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const newTaskName = $input.val().trim();
                this.saveTaskName($cell, taskId, newTaskName);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.cancelTaskNameEditing($cell, currentTaskName);
            }
        });
        
        // Handle click outside (blur)
        $input.on('blur', (e) => {
            // Small delay to allow button clicks to register
            setTimeout(() => {
                if (!$cell.find('.task-name-actions button:hover').length) {
                    const newTaskName = $input.val().trim();
                    if (newTaskName !== currentTaskName) {
                        this.saveTaskName($cell, taskId, newTaskName);
                    } else {
                        this.cancelTaskNameEditing($cell, currentTaskName);
                    }
                }
            }, 150);
        });
    }

    saveTaskName($cell, taskId, newTaskName) {
        // Prevent multiple simultaneous saves
        if ($cell.data('saving')) {
            return;
        }
        
        $cell.data('saving', true);
        
        // Show confirmation dialog
        frappe.confirm(
            `Are you sure you want to change the task name to "${newTaskName || 'Untitled Task'}"?<br><br>
             <small class="text-muted">This will update the task's subject field and may affect reports and references.</small>`,
            () => {
                // User confirmed, close dialog immediately and proceed with save
                this.utils.closeConfirmDialog();
                this.performTaskNameSave($cell, taskId, newTaskName);
            },
            () => {
                // User cancelled, close dialog immediately and restore original name
                this.utils.closeConfirmDialog();
                $cell.removeData('saving');
                const originalName = $cell.data('current-task-name') || '';
                this.cancelTaskNameEditing($cell, originalName);
            }
        );
    }

    async performTaskNameSave($cell, taskId, newTaskName) {
        try {
            // Show loading state
            $cell.html('<i class="fa fa-spinner fa-spin"></i> Saving...');
            
            // Call backend to update task subject
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.update_task_field',
                args: {
                    task_id: taskId,
                    field_name: 'subject',
                    new_value: newTaskName || 'Untitled Task'
                }
            });
            
            if (response.message && response.message.success) {
                // Update the cell display
                const displayName = newTaskName || 'Untitled Task';
                $cell.data('current-task-name', displayName);
                $cell.html(`
                    <div class="pm-task-name-content">
                        <span class="editable-field task-name-display">${displayName}</span>
                        <i class="fa fa-edit pm-edit-icon"></i>
                    </div>
                `);
                
                $cell.removeClass('editing');
                $cell.removeData('saving');
                
                frappe.show_alert({
                    message: 'Task name updated successfully',
                    indicator: 'green'
                });
            } else {
                throw new Error('Update failed');
            }
        } catch (error) {
            console.error('Save task name error:', error);
            const originalName = $cell.data('current-task-name') || '';
            this.cancelTaskNameEditing($cell, originalName);
            $cell.removeData('saving');
            
            frappe.show_alert({
                message: 'Failed to update task name',
                indicator: 'red'
            });
        }
    }

    cancelTaskNameEditing($cell, originalName) {
        const displayName = originalName || 'Untitled Task';
        $cell.html(`
            <div class="pm-task-name-content">
                <span class="editable-field task-name-display">${displayName}</span>
                <i class="fa fa-edit pm-edit-icon"></i>
            </div>
        `);
        $cell.removeClass('editing');
    }

    // Clear all editing states
    clearAllEditingStates() {
        // Remove editing class from all cells
        $('.pm-cell.editing').removeClass('editing');
        
        // Close all dropdowns and modals
        if (window.FilterManager) {
            window.FilterManager.closeAllDropdowns();
        }
        $('.pm-person-selector-modal').remove();
        $('.pm-contact-dropdown').remove();
        $('.pm-person-tooltip').remove();
        
        // Clean up event listeners
        $(document).off('click.person-selector click.contact-dropdown');
    }

    // Other editors (select, currency, text)
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
            const optionsSource = $cell.data('options-source');
            const backendOptions = $cell.data('backend-options');
            
            // Handle dynamic options loading
            if (optionsSource === 'custom_task_status') {
                this.showTaskStatusSelector($cell);
                return;
            }
            
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

    async showTaskStatusSelector($cell) {
        // Support both main task and subtask status badge formats
        const currentValue = $cell.find('.editable-field, .pm-status-badge').text().trim();
        
        try {
            // Get status options from backend (no hardcoding!)
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.get_task_status_options'
            });
            
            if (response.message && response.message.success) {
                const statusOptions = response.message.status_options;
                
                let selectHTML = '<select class="pm-inline-select">';
                statusOptions.forEach(status => {
                    const selected = currentValue === status ? 'selected' : '';
                    selectHTML += `<option value="${status}" ${selected}>${status}</option>`;
                });
                selectHTML += '</select>';
                
                $cell.html(selectHTML);
                
                const $select = $cell.find('.pm-inline-select');
                $select.focus();
                
                this.bindSelectEvents($cell, $select, currentValue);
            } else {
                frappe.show_alert({
                    message: 'Failed to load status options',
                    indicator: 'red'
                });
            }
        } catch (error) {
            console.error('Error loading status options:', error);
            frappe.show_alert({
                message: 'Failed to load status options',
                indicator: 'red'
            });
        }
    }

    bindSelectEvents($cell, $select, originalValue) {
        const fieldName = $cell.data('field');
        const taskId = $cell.data('task-id');
        
        // Handle selection change
        $select.on('change blur', async (e) => {
            if (e.type === 'change' || e.type === 'blur') {
                const newValue = $select.val();
                
                if (newValue !== originalValue) {
                    try {
                        // Save the field change
                        const response = await frappe.call({
                            method: 'smart_accounting.www.project_management.index.update_task_field',
                            args: {
                                task_id: taskId,
                                field_name: fieldName,
                                new_value: newValue
                            }
                        });
                        
                        if (response.message && response.message.success) {
                            // Update display with proper status badge styling
                            const statusClass = newValue.toLowerCase().replace(/\s+/g, '-');
                            $cell.html(`<span class="pm-status-badge status-${statusClass}">${newValue}</span>`);
                            
                            frappe.show_alert({
                                message: 'Status updated successfully',
                                indicator: 'green'
                            });
                        } else {
                            throw new Error(response.message?.error || 'Update failed');
                        }
                    } catch (error) {
                        console.error('Status update error:', error);
                        frappe.show_alert({
                            message: 'Failed to update status: ' + error.message,
                            indicator: 'red'
                        });
                        // Restore original value
                        const originalStatusClass = originalValue.toLowerCase().replace(/\s+/g, '-');
                        $cell.html(`<span class="pm-status-badge status-${originalStatusClass}">${originalValue}</span>`);
                    }
                } else {
                    // No change, restore original display
                    const originalStatusClass = originalValue.toLowerCase().replace(/\s+/g, '-');
                    $cell.html(`<span class="pm-status-badge status-${originalStatusClass}">${originalValue}</span>`);
                }
                
                // Remove editing state
                $cell.removeClass('editing');
            }
        });
        
        // Handle escape key
        $select.on('keydown', (e) => {
            if (e.key === 'Escape') {
                // Restore original value
                const originalStatusClass = originalValue.toLowerCase().replace(/\s+/g, '-');
                $cell.html(`<span class="pm-status-badge status-${originalStatusClass}">${originalValue}</span>`);
                $cell.removeClass('editing');
            }
        });
    }
}

// Create global instance
window.EditorsManager = new EditorsManager();

// Export for module systems if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EditorsManager;
}
