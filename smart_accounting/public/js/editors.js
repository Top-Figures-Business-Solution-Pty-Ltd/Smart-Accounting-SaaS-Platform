// Project Management - Inline Editors
// Inline editing functionality for tasks and fields

class EditorsManager {
    constructor() {
        this.utils = window.PMUtils;
        
        // Performance optimization: Cache DocType metadata
        this.metaCache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes cache
        this.lastCacheClean = Date.now();
        
        // Preload commonly used field options
        this.preloadCommonFieldOptions();
    }

    // Preload commonly used field options for better performance
    preloadCommonFieldOptions() {
        const commonFields = ['custom_target_month', 'custom_year_end', 'custom_frequency'];
        
        // Preload in background without blocking UI
        setTimeout(() => {
            commonFields.forEach(fieldName => {
                frappe.call({
                    method: 'smart_accounting.www.project_management.index.get_field_options',
                    args: {
                        doctype: 'Task',
                        fieldname: fieldName
                    },
                    callback: (response) => {
                        if (response.message && response.message.success) {
                            const cacheKey = `Task.${fieldName}`;
                            this.metaCache.set(cacheKey, {
                                options: response.message.options,
                                timestamp: Date.now()
                            });
                        }
                    }
                });
            });
            console.debug('📦 Preloading field options for better performance');
        }, 1000); // Delay 1 second to not interfere with page load
    }

    // Inline editing initialization
    initializeInlineEditing() {
        // Bind click events for client selector trigger
        $(document).on('click', '.pm-client-selector-trigger', (e) => {
            e.stopPropagation();
            
            const $trigger = $(e.currentTarget);
            const $cell = $trigger.closest('.pm-cell-client');
            
            if (window.ClientSelectorModal) {
                window.ClientSelectorModal.showClientSelector($cell);
            } else {
                console.error('ClientSelectorModal not loaded');
                frappe.show_alert({
                    message: 'Client selector not available',
                    indicator: 'red'
                });
            }
        });
        
        // Bind click events for other editable fields
        $(document).on('click', '[data-editable="true"]', (e) => {
            e.stopPropagation();
            
            // Don't trigger editing if clicking on subtask toggle
            if ($(e.target).closest('.pm-subtask-toggle').length > 0) {
                return;
            }
            
            // Don't trigger inline editing for priority field - it has its own menu system
            const fieldName = $(e.currentTarget).data('field');
            if (fieldName === 'priority') {
                return;
            }
            
            const fieldType = $(e.currentTarget).data('field-type');
            const taskId = $(e.currentTarget).data('task-id');
            
            if (fieldType === 'person_selector') {
                if (window.PersonSelectorManager) {
                    window.PersonSelectorManager.showMultiPersonSelector($(e.currentTarget), taskId, fieldName);
                }
            } else if (fieldType === 'software_selector') {
                if (window.SoftwareSelectorManager) {
                    window.SoftwareSelectorManager.showSoftwareSelector($(e.currentTarget), taskId, fieldName);
                }
            } else if (fieldType === 'communication_methods_selector') {
                if (window.CommunicationMethodsSelectorManager) {
                    window.CommunicationMethodsSelectorManager.showCommunicationMethodsSelector($(e.currentTarget), taskId, fieldName);
                }
            } else if (fieldType === 'client_contact_selector') {
                if (window.ClientContactSelectorManager) {
                    window.ClientContactSelectorManager.showClientContactSelector($(e.currentTarget), taskId, fieldName);
                }
            } else if (fieldType === 'date') {
                // Date fields directly show date picker, never text editor
                console.log('📅 Opening date picker for:', fieldName);
                this.showDatePicker($(e.currentTarget), taskId, fieldName);
                return; // Prevent any other editing behavior
            } else {
                this.makeEditable(e.currentTarget);
            }
        });

        // Calendar icon removed - entire cell is now clickable for date fields

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
        
        // Don't allow text editing for special selector fields and date fields
        if (fieldType === 'person_selector' || fieldType === 'software_selector' || fieldType === 'communication_methods_selector' || fieldType === 'client_contact_selector' || fieldType === 'date') {
            // Date fields should use the date picker, not text editing
            if (fieldType === 'date') {
                this.showDatePicker($cell, taskId, field);
            }
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
            case 'text':
                // Check if this is a note field for special handling
                if (field === 'custom_note') {
                    editor = this.createNoteEditor($cell, currentValue);
                } else {
                    editor = this.createTextEditor($cell, currentValue);
                }
                break;
            default:
                editor = this.createTextEditor($cell, currentValue);
        }
        
        // For note fields, create floating editor and placeholder
        if (field === 'custom_note') {
            // Create placeholder in the cell
            $cell.html('<div class="pm-note-editing-placeholder"><i class="fa fa-edit"></i> Editing note...</div>');
            
            // Create floating editor
            const $floatingEditor = $(editor);
            $('body').append($floatingEditor);
            
            // Setup note editor behavior
            this.setupNoteEditorBehavior($cell, $floatingEditor);
            
            // Focus the floating editor
            $floatingEditor.focus();
        } else {
            // Replace content with editor for other fields
            $cell.html(editor);
            
            // Focus the input
            const $input = $cell.find('input, select, textarea');
            $input.focus();
        }
        
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
        
        // Handle save/cancel - special handling for note fields
        if (field === 'custom_note') {
            this.bindNoteEditorEvents($input, $cell, taskId, field, currentValue, fieldType);
        } else {
            // Original logic for other fields
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
    }

    createSelectEditor($cell, currentValue) {
        // Check if options are provided directly or need to be loaded dynamically
        const directOptions = $cell.data('options');
        const optionsSource = $cell.data('options-source');
        
        if (directOptions) {
            // Handle direct options (e.g., TF/TG field)
            const displayOptions = directOptions.split(',');
            const backendOptions = $cell.data('backend-options') ? $cell.data('backend-options').split(',') : displayOptions;
            
            // Find current selected option by matching the value
            let selectedIndex = displayOptions.findIndex(option => option.trim() === currentValue);
            if (selectedIndex === -1) {
                selectedIndex = 0; // Default to first option if not found
            }
            
            let optionsHtml = displayOptions.map((displayText, index) => {
                const cleanText = displayText.trim();
                const isSelected = index === selectedIndex;
                const backendValue = backendOptions[index] || cleanText;
                return `<option value="${cleanText}" data-backend-value="${backendValue}" ${isSelected ? 'selected' : ''}>${cleanText}</option>`;
            }).join('');
            
            return `<select class="pm-inline-select">${optionsHtml}</select>`;
        } else if (optionsSource) {
            // Handle dynamic options (e.g., frequency, target_month fields)
            this.createDynamicSelectEditor($cell, currentValue, optionsSource);
            return `<div class="pm-loading-options">Loading options...</div>`;
        } else {
            // Fallback to text editor if no options defined
            console.warn(`No options defined for select field: ${$cell.data('field')}`);
            return this.createTextEditor($cell, currentValue);
        }
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

    createNoteEditor($cell, currentValue) {
        const cleanValue = currentValue === '-' ? '' : currentValue;
        
        // Calculate optimal size for Monday.com style expansion
        const contentLength = cleanValue.length;
        
        // Always create a generous size for better UX - Monday.com style
        let optimalWidth = Math.max(350, Math.min(600, contentLength * 7 + 150));
        let optimalHeight = Math.max(100, Math.min(250, Math.ceil(contentLength / 60) * 25 + 80));
        
        // Create a complete floating note editor with header and close button
        return `
            <div class="pm-floating-note-container pm-expandable-note" 
                 style="width: ${optimalWidth}px;">
                <div class="pm-floating-note-header">
                    <span class="pm-floating-note-title">📝 Edit Note</span>
                    <button class="pm-floating-note-close" type="button">
                        <i class="fa fa-times"></i>
                    </button>
                </div>
                <textarea class="pm-floating-note-textarea" 
                          style="height: ${optimalHeight}px; min-height: 80px;"
                          placeholder="Enter your note here...">${cleanValue}</textarea>
                <div class="pm-floating-note-footer">
                    <span class="pm-floating-note-hint">💡 Ctrl+Enter to save • Esc to cancel</span>
                    <div class="pm-floating-note-actions">
                        <button class="pm-btn pm-btn-secondary pm-floating-note-cancel" type="button">Cancel</button>
                        <button class="pm-btn pm-btn-primary pm-floating-note-save" type="button">
                            <i class="fa fa-check"></i> Save
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    setupNoteEditorBehavior($cell, $floatingContainer) {
        // Find the textarea within the floating container
        const $textarea = $floatingContainer.find('.pm-floating-note-textarea');
        const originalValue = $textarea.val() || '';
        
        // Add expanded class to cell for styling
        $cell.addClass('pm-note-editing');
        
        // Position the floating container
        this.positionFloatingNoteEditor($cell, $floatingContainer);
        
        // Auto-resize functionality for textarea
        this.setupTextareaAutoResize($textarea);
        
        // Bind all events for the floating editor
        this.bindFloatingNoteEvents($cell, $floatingContainer, $textarea, originalValue);
    }

    setupTextareaAutoResize($textarea) {
        // Auto-resize textarea based on content for floating note editors
        const autoResize = () => {
            $textarea[0].style.height = 'auto';
            const scrollHeight = $textarea[0].scrollHeight;
            
            // Generous sizing for floating note editors
            const newHeight = Math.max(80, Math.min(300, scrollHeight + 20));
            $textarea[0].style.height = newHeight + 'px';
            
            // Also adjust container width if content is very long
            const contentLength = $textarea.val().length;
            const $container = $textarea.closest('.pm-floating-note-container');
            
            if (contentLength > 200) {
                const newWidth = Math.max(400, Math.min(700, contentLength * 4 + 250));
                $container.css('width', newWidth + 'px');
            }
        };
        
        // Initial resize
        setTimeout(autoResize, 10);
        
        // Resize on input
        $textarea.on('input', autoResize);
    }

    setupInputToTextareaConversion($input, $cell) {
        // Convert input to textarea if content gets long
        $input.on('input', () => {
            const content = $input.val();
            if (content.length > 50 && $input.is('input')) {
                // Convert to textarea
                const $textarea = $(`<textarea class="pm-inline-textarea pm-note-editor" 
                                        style="width: ${Math.min(500, content.length * 8 + 100)}px; min-height: 32px;"
                                        placeholder="Enter note...">${content}</textarea>`);
                
                $input.replaceWith($textarea);
                $textarea.focus();
                
                // Set cursor position to end
                const textLength = $textarea.val().length;
                $textarea[0].setSelectionRange(textLength, textLength);
                
                // Setup auto-resize for the new textarea
                this.setupTextareaAutoResize($textarea);
                
                // Re-bind the save/cancel events for the new textarea
                const $cell_ref = $cell;
                const taskId = $cell.data('task-id');
                const field = $cell.data('field');
                const fieldType = $cell.data('field-type');
                const currentValue = $input.data('original-value') || '';
                
                $textarea.on('blur keydown', (e) => {
                    // For note fields (textarea), only save on blur or Ctrl+Enter, not just Enter
                    if (field === 'custom_note' && $textarea.is('textarea')) {
                        if (e.type === 'keydown') {
                            if (e.key === 'Escape') {
                                this.cancelEdit($cell_ref, currentValue, fieldType);
                                return;
                            } else if (e.key === 'Enter' && e.ctrlKey) {
                                // Ctrl+Enter saves for textarea
                                let valueToSave = $textarea.val();
                                this.saveEdit($cell_ref, taskId, field, valueToSave, fieldType);
                                return;
                            } else if (e.key === 'Enter') {
                                // Regular Enter just adds new line in textarea
                                return;
                            } else {
                                return; // Don't handle other keys
                            }
                        } else if (e.type === 'blur') {
                            // Save on blur for textarea
                            let valueToSave = $textarea.val();
                            this.saveEdit($cell_ref, taskId, field, valueToSave, fieldType);
                        }
                    }
                });
            } else if (content.length > 20) {
                // Just expand the input width
                const newWidth = Math.max(200, Math.min(400, content.length * 8 + 50));
                $input.css('width', newWidth + 'px');
            }
        });
    }

    positionFloatingNoteEditor($cell, $floatingContainer) {
        // Get cell position relative to viewport
        const cellRect = $cell[0].getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Get container dimensions
        const containerWidth = $floatingContainer.outerWidth();
        const containerHeight = $floatingContainer.outerHeight();
        
        // Calculate optimal position
        let topPosition = cellRect.top - containerHeight - 10;
        if (topPosition < 20) {
            // Not enough space above, position below
            topPosition = cellRect.bottom + 10;
            if (topPosition + containerHeight > viewportHeight - 20) {
                // Not enough space below either, center vertically
                topPosition = Math.max(20, (viewportHeight - containerHeight) / 2);
            }
        }
        
        // Ensure it doesn't go off the horizontal edges
        let leftPosition = Math.max(20, Math.min(cellRect.left, viewportWidth - containerWidth - 20));
        
        // Apply positioning
        $floatingContainer.css({
            'position': 'fixed',
            'top': topPosition + 'px',
            'left': leftPosition + 'px',
            'z-index': '1001'
        });
    }

    bindFloatingNoteEvents($cell, $floatingContainer, $textarea, originalValue) {
        const taskId = $cell.data('task-id');
        const field = $cell.data('field');
        const fieldType = $cell.data('field-type');
        
        // Save function
        const saveNote = () => {
            const valueToSave = $textarea.val();
            this.saveEdit($cell, taskId, field, valueToSave, fieldType);
        };
        
        // Cancel function
        const cancelNote = () => {
            this.cancelEdit($cell, originalValue, fieldType);
        };
        
        // Textarea events
        $textarea.on('keydown', (e) => {
            if (e.key === 'Escape') {
                cancelNote();
                return;
            } else if (e.key === 'Enter' && e.ctrlKey) {
                saveNote();
                return;
            }
        });
        
        // Button events
        $floatingContainer.on('click', '.pm-floating-note-save', saveNote);
        $floatingContainer.on('click', '.pm-floating-note-cancel', cancelNote);
        $floatingContainer.on('click', '.pm-floating-note-close', cancelNote);
        
        // Outside click to save
        setTimeout(() => {
            $(document).on('click.floating-note', (e) => {
                if (!$(e.target).closest('.pm-floating-note-container').length) {
                    saveNote();
                    $(document).off('click.floating-note');
                }
            });
        }, 100);
        
        // Prevent container clicks from bubbling
        $floatingContainer.on('click', (e) => {
            e.stopPropagation();
        });
    }


    addNoteEditingIndicator($cell) {
        // Add a subtle indicator that this is an expanded note
        const $indicator = $('<div class="pm-note-editing-indicator">📝</div>');
        $cell.append($indicator);
    }

    cleanupNoteEditor($cell) {
        // Remove editing classes and styles
        $cell.removeClass('pm-note-editing');
        $cell.css({
            'position': '',
            'z-index': '',
            'overflow': ''
        });
        
        // Remove indicator and placeholder
        $cell.find('.pm-note-editing-indicator, .pm-note-editing-placeholder').remove();
        
        // Clean up any floating note editors
        $('.pm-floating-note-container').remove();
        
        // Remove document event listeners
        $(document).off('click.floating-note');
        
        // Smooth transition back to normal size
        setTimeout(() => {
            $cell.css({
                'width': '',
                'height': '',
                'max-width': '',
                'max-height': ''
            });
        }, 200);
    }

    async createDynamicSelectEditor($cell, currentValue, optionsSource) {
        // Create dynamic select editor for fields with options-source
        try {
            const taskId = $cell.data('task-id');
            const fieldName = $cell.data('field');
            
            // Try to get options from cache first
            const cacheKey = `${optionsSource}_options`;
            let options = this.getCachedOptions(cacheKey);
            
            if (!options) {
                // Load options from backend
                const response = await frappe.call({
                    method: 'smart_accounting.www.project_management.index.get_field_options',
                    args: {
                        doctype: 'Task',
                        fieldname: fieldName
                    }
                });
                
                if (response.message && response.message.success) {
                    options = response.message.options;
                    this.setCachedOptions(cacheKey, options);
                } else {
                    // Use fallback options
                    options = this.getFallbackOptions(fieldName, currentValue);
                }
            }
            
            // Create select element
            let optionsHtml = options.map(option => {
                const isSelected = option === currentValue;
                return `<option value="${option}" ${isSelected ? 'selected' : ''}>${option}</option>`;
            }).join('');
            
            // Replace loading indicator with actual select
            $cell.html(`<select class="pm-inline-select">${optionsHtml}</select>`);
            
            // Focus the select
            const $select = $cell.find('select');
            $select.focus();
            
        } catch (error) {
            console.error('Error creating dynamic select editor:', error);
            // Fallback to text editor
            $cell.html(this.createTextEditor($cell, currentValue));
        }
    }

    getCachedOptions(cacheKey) {
        // Get options from cache if available and not expired
        const cached = this.metaCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
            return cached.options;
        }
        return null;
    }

    setCachedOptions(cacheKey, options) {
        // Cache options for future use
        this.metaCache.set(cacheKey, {
            options: options,
            timestamp: Date.now()
        });
    }

    getFallbackOptions(fieldName, currentValue) {
        // Provide fallback options for common fields
        const fallbackMap = {
            'custom_frequency': ['Annually', 'Half Yearly', 'Quarterly', 'Monthly', 'Fortnightly', 'Weekly', 'Daily', 'Ad-Hoc', 'Other'],
            'custom_target_month': ['January', 'February', 'March', 'April', 'May', 'June', 
                                   'July', 'August', 'September', 'October', 'November', 'December'],
            'custom_year_end': ['June', 'December', 'March', 'September']
        };
        
        let options = fallbackMap[fieldName] || ['Option 1', 'Option 2', 'Option 3'];
        
        // Ensure current value is in options
        if (currentValue && currentValue !== '-' && !options.includes(currentValue)) {
            options.unshift(currentValue);
        }
        
        return options;
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
    
    showDatePicker($cell, taskId, fieldName) {
        console.log('📅 Showing date picker for field:', fieldName);
        
        // Get current date value
        const currentValue = $cell.find('.pm-date-display, .editable-field').text().trim();
        let initialDate = '';
        let displayValue = '';
        
        // Parse current date value and format for display
        if (currentValue && currentValue !== '-') {
            // Try to parse various date formats
            const parsed = this.parseDateValue(currentValue);
            if (parsed) {
                initialDate = parsed;  // YYYY-MM-DD for HTML date input
                displayValue = this.formatDateForDisplay(parsed);  // DD/MM/YYYY for text input
            } else {
                // If already in DD/MM/YYYY format, use as-is
                displayValue = currentValue;
            }
        }
        
        // Create custom date picker HTML with English interface and DD/MM/YYYY format
        const datePickerHTML = `
            <div class="pm-date-picker-modal" id="pm-date-picker-${taskId}-${fieldName}" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;">
                <div class="pm-date-picker-overlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></div>
                <div class="pm-date-picker-content" style="background: white; border-radius: 8px; padding: 20px; min-width: 300px; max-width: 400px; position: relative; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
                    <div class="pm-date-picker-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <h3 style="margin: 0; color: #333;">Select Date</h3>
                        <button class="pm-date-picker-close" style="background: none; border: none; font-size: 18px; cursor: pointer; color: #666;">
                            <i class="fa fa-times"></i>
                        </button>
                    </div>
                    <div class="pm-date-picker-body" style="margin-bottom: 20px;">
                        <div style="margin-bottom: 10px;">
                            <input type="text" 
                                   class="pm-date-text-input" 
                                   placeholder="DD-MM-YYYY"
                                   value="${displayValue}"
                                   style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; text-align: center;">
                        </div>
                        <div style="margin-bottom: 10px;">
                            <input type="date" 
                                   class="pm-date-input" 
                                   value="${initialDate}"
                                   lang="en-US"
                                   data-locale="en-US"
                                   style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; color-scheme: light;">
                        </div>
                        <div class="pm-date-format-info" style="font-size: 12px; color: #666; text-align: center;">
                            Enter date as DD-MM-YYYY or DD-MM-YY, or use the date picker above
                        </div>
                    </div>
                    <div class="pm-date-picker-footer" style="display: flex; justify-content: space-between; align-items: center;">
                        <button class="pm-btn pm-btn-secondary pm-date-clear" style="background: #f8f9fa; border: 1px solid #ddd; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Clear</button>
                        <div class="pm-date-actions" style="display: flex; gap: 8px;">
                            <button class="pm-btn pm-btn-secondary pm-date-cancel" style="background: #f8f9fa; border: 1px solid #ddd; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Cancel</button>
                            <button class="pm-btn pm-btn-primary pm-date-save" style="background: #007bff; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Save</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing date picker
        $('.pm-date-picker-modal').remove();
        
        // Add to body
        $('body').append(datePickerHTML);
        
        const $datePicker = $(`#pm-date-picker-${taskId}-${fieldName}`);
        
        // Show modal
        $datePicker.fadeIn(200);
        
        // Focus the text input by default
        setTimeout(() => {
            const $textInput = $datePicker.find('.pm-date-text-input');
            $textInput.focus().select();
            
            // Sync between text input and date input
            const $dateInput = $datePicker.find('.pm-date-input');
            
            // When date picker changes, update text input
            $dateInput.on('change', () => {
                const dateValue = $dateInput.val();
                if (dateValue) {
                    const displayDate = this.formatDateForDisplay(dateValue);
                    $textInput.val(displayDate);
                }
            });
            
            // When text input changes, try to update date picker
            $textInput.on('input', () => {
                const textValue = $textInput.val();
                const isoDate = this.parseDateValue(textValue);
                if (isoDate) {
                    $dateInput.val(isoDate);
                }
            });
        }, 100);
        
        // Bind events
        this.bindDatePickerEvents($datePicker, $cell, taskId, fieldName);
    }
    
    parseDateValue(value) {
        // Parse various date formats and convert to YYYY-MM-DD for HTML date input
        if (!value || value === '-') return '';
        
        // Already in ISO format (YYYY-MM-DD)
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            return value;
        }
        
        // DD-MM-YYYY format (preferred)
        const ddmmyyyy_dash = value.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
        if (ddmmyyyy_dash) {
            const day = ddmmyyyy_dash[1].padStart(2, '0');
            const month = ddmmyyyy_dash[2].padStart(2, '0');
            const year = ddmmyyyy_dash[3];
            return `${year}-${month}-${day}`;
        }
        
        // DD-MM-YY format (assume YY is 20YY for 00-30, 19YY for 31-99)
        const ddmmyy_dash = value.match(/^(\d{1,2})-(\d{1,2})-(\d{2})$/);
        if (ddmmyy_dash) {
            const day = ddmmyy_dash[1].padStart(2, '0');
            const month = ddmmyy_dash[2].padStart(2, '0');
            let year = parseInt(ddmmyy_dash[3]);
            // Assume 00-30 is 20xx, 31-99 is 19xx
            year = year <= 30 ? 2000 + year : 1900 + year;
            return `${year}-${month.padStart(2, '0')}-${day}`;
        }
        
        // DD/MM/YYYY format (legacy support)
        const ddmmyyyy = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (ddmmyyyy) {
            const day = ddmmyyyy[1].padStart(2, '0');
            const month = ddmmyyyy[2].padStart(2, '0');
            const year = ddmmyyyy[3];
            return `${year}-${month}-${day}`;
        }
        
        // DD/MM/YY format (legacy support)
        const ddmmyy = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
        if (ddmmyy) {
            const day = ddmmyy[1].padStart(2, '0');
            const month = ddmmyy[2].padStart(2, '0');
            let year = parseInt(ddmmyy[3]);
            // Assume 00-30 is 20xx, 31-99 is 19xx
            year = year <= 30 ? 2000 + year : 1900 + year;
            return `${year}-${month.padStart(2, '0')}-${day}`;
        }
        
        return '';
    }
    
    bindDatePickerEvents($datePicker, $cell, taskId, fieldName) {
        // Close button
        $datePicker.on('click', '.pm-date-picker-close, .pm-date-cancel', () => {
            $datePicker.fadeOut(200, () => $datePicker.remove());
        });
        
        // Click overlay to close
        $datePicker.on('click', '.pm-date-picker-overlay', () => {
            $datePicker.fadeOut(200, () => $datePicker.remove());
        });
        
        // Clear date
        $datePicker.on('click', '.pm-date-clear', () => {
            this.saveDateValue($cell, taskId, fieldName, '');
            $datePicker.fadeOut(200, () => $datePicker.remove());
        });
        
        // Save date
        $datePicker.on('click', '.pm-date-save', () => {
            // Get value from text input (preferred) or date input as fallback
            const textValue = $datePicker.find('.pm-date-text-input').val().trim();
            const dateValue = $datePicker.find('.pm-date-input').val();
            
            let finalValue = '';
            if (textValue) {
                // Validate the text input format
                const isoDate = this.parseDateValue(textValue);
                if (isoDate) {
                    finalValue = textValue; // Keep the DD/MM/YYYY format for display
                } else {
                    frappe.show_alert({
                        message: 'Invalid date format. Please use DD/MM/YYYY or DD/MM/YY',
                        indicator: 'red'
                    });
                    return;
                }
            } else if (dateValue) {
                // Convert ISO date to DD/MM/YYYY format
                finalValue = this.formatDateForDisplay(dateValue);
            }
            
            if (finalValue) {
                this.saveDateValue($cell, taskId, fieldName, finalValue);
            }
            $datePicker.fadeOut(200, () => $datePicker.remove());
        });
        
        // ESC key to close
        $(document).on('keydown.date-picker', (e) => {
            if (e.key === 'Escape') {
                $datePicker.fadeOut(200, () => $datePicker.remove());
                $(document).off('keydown.date-picker');
            }
        });
    }
    
    formatDateForDisplay(isoDate) {
        // Convert YYYY-MM-DD to DD-MM-YYYY for display
        if (!isoDate) return '';
        
        const parts = isoDate.split('-');
        if (parts.length === 3) {
            return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        return isoDate;
    }
    
    async saveDateValue($cell, taskId, fieldName, dateValue) {
        try {
            console.log('💾 Saving date value:', { taskId, fieldName, dateValue });
            
            // Validate and convert date format for backend
            let backendValue = '';
            if (dateValue && dateValue !== '-') {
                // If it's in DD/MM/YYYY or DD/MM/YY format, convert to YYYY-MM-DD for backend
                const isoDate = this.parseDateValue(dateValue);
                if (isoDate) {
                    backendValue = isoDate;
                } else {
                    throw new Error('Invalid date format. Please use DD/MM/YYYY or DD/MM/YY format.');
                }
            }
            
            // Update UI display immediately
            $cell.find('.pm-date-display, .editable-field').text(dateValue || '-');
            
            // Save to backend with ISO format
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.update_task_field',
                args: {
                    task_id: taskId,
                    field_name: fieldName,
                    new_value: backendValue
                }
            });
            
            if (response.message && response.message.success) {
                frappe.show_alert({
                    message: 'Date updated successfully',
                    indicator: 'green'
                });
                
                // Trigger bulk update event
                $(document).trigger('pm:cell:changed', {
                    taskId: taskId,
                    field: fieldName,
                    newValue: backendValue,
                    oldValue: null
                });
            } else {
                throw new Error(response.message?.error || 'Unknown error');
            }
        } catch (error) {
            console.error('Error saving date:', error);
            frappe.show_alert({
                message: 'Error saving date: ' + error.message,
                indicator: 'red'
            });
            // Restore original value
            $cell.find('.pm-date-display, .editable-field').text('-');
        }
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
                
                // Trigger bulk update event
                $(document).trigger('pm:cell:changed', {
                    taskId: taskId,
                    field: field,
                    newValue: newValue,
                    oldValue: null
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
        
        // Special cleanup for note editor
        if (field === 'custom_note') {
            this.cleanupNoteEditor($cell);
        }
    }

    cancelEdit($cell, originalValue, fieldType) {
        const field = $cell.data('field');
        
        this.updateCellDisplay($cell, originalValue, fieldType);
        $cell.removeClass('editing');
        $cell.closest('.pm-task-row').removeClass('editing');
        
        // Special cleanup for note editor
        if (field === 'custom_note') {
            this.cleanupNoteEditor($cell);
        }
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
                } else if (field === 'priority') {
                    // Handle priority field with proper badge styling
                    const priorityClass = value ? value.toLowerCase() : 'medium';
                    const displayValue = value || 'Medium';
                    $cell.html(`<span class="pm-priority-badge priority-${priorityClass} editable-field">${displayValue}</span>`);
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
            case 'text':
                if (field === 'custom_note') {
                    // Special handling for note fields - use the new structure
                    $cell.html(`
                        <div class="pm-note-content">
                            <span class="editable-field note-display">${value || '-'}</span>
                        </div>
                    `);
                } else {
                    $cell.html(`<span class="editable-field">${value || '-'}</span>`);
                }
                break;
            default:
                if (field === 'custom_note') {
                    // Ensure note fields always use the correct structure
                    $cell.html(`
                        <div class="pm-note-content">
                            <span class="editable-field note-display">${value || '-'}</span>
                        </div>
                    `);
                } else {
                    $cell.html(`<span class="editable-field">${value || '-'}</span>`);
                }
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
        
        switch(fieldType) {
            case 'client_selector':
                // Use new modal-based client selector - no need to add editing class
                if (window.ClientSelectorModal) {
                    window.ClientSelectorModal.showClientSelector($cell);
                } else {
                    console.error('ClientSelectorModal not loaded');
                    frappe.show_alert({
                        message: 'Client selector not available',
                        indicator: 'red'
                    });
                }
                break;
            case 'task_name_editor':
                $cell.addClass('editing');
                this.showTaskNameEditor($cell);
                break;
            case 'select':
                $cell.addClass('editing');
                this.showSelectEditor($cell);
                break;
            case 'currency':
                $cell.addClass('editing');
                this.showCurrencyEditor($cell);
                break;
            default:
                $cell.addClass('editing');
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
                
                // Trigger bulk update event
                $(document).trigger('pm:cell:changed', {
                    taskId: taskId,
                    field: 'subject',
                    newValue: newTaskName || 'Untitled Task',
                    oldValue: null
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
        
        // Debug: Check what data attributes are available
        const optionsSource = $cell.data('options-source');
        const options = $cell.data('options');
        
        // Handle different field types
        if (fieldName === 'custom_tftg') {
            this.showCompanySelector($cell);
        } else {
            // Regular select field
            const backendOptions = $cell.data('backend-options');
            
            // Handle dynamic options loading FIRST (before checking static options)
            if (optionsSource === 'custom_task_status') {
                this.showTaskStatusSelector($cell);
                return;
            }
            
            if (optionsSource === 'dynamic') {
                this.showDynamicFieldSelector($cell);
                return;
            }
            
            // Only check for static options if no dynamic source is specified
            if (!options && !optionsSource) {
                return;
            }
            
            // Handle static options (only if options exist)
            if (!options) {
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
                
                // Trigger bulk update event
                $(document).trigger('pm:cell:changed', {
                    taskId: taskId,
                    field: fieldName,
                    newValue: newValue,
                    oldValue: null
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
                            
                            // Trigger bulk update event
                            $(document).trigger('pm:cell:changed', {
                                taskId: taskId,
                                field: fieldName,
                                newValue: newValue,
                                oldValue: originalValue
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

    // Show dynamic field selector (loads options from DocType with caching)
    showDynamicFieldSelector($cell) {
        const fieldName = $cell.data('field');
        const taskId = $cell.data('task-id');
        const currentValue = $cell.find('.editable-field').text().trim();
        
        console.debug(`📋 Dynamic field selector called for: ${fieldName}, current value: "${currentValue}"`);
        
        // Clean expired cache periodically
        this.cleanExpiredCache();
        
        // Check cache first
        const cacheKey = `Task.${fieldName}`;
        const cached = this.metaCache.get(cacheKey);
        
        if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
            // Use cached options - instant response
            console.debug(`⚡ Using cached options for ${fieldName}:`, cached.options);
            this.renderDynamicSelect($cell, cached.options, currentValue, taskId, fieldName);
            return;
        }
        
        // Show loading state
        $cell.html('<div class="pm-loading-options">Loading options...</div>');
        
        // Get field options using a more reliable method
        frappe.call({
            method: 'smart_accounting.www.project_management.index.get_field_options',
            args: {
                doctype: 'Task',
                fieldname: fieldName
            },
            callback: (response) => {
                console.debug(`📡 API response for ${fieldName}:`, response);
                
                if (response.message && response.message.success) {
                    const options = response.message.options;
                    console.debug(`✅ Got dynamic options for ${fieldName}:`, options);
                    
                    // Cache the options
                    this.metaCache.set(cacheKey, {
                        options: options,
                        timestamp: Date.now()
                    });
                    
                    this.renderDynamicSelect($cell, options, currentValue, taskId, fieldName);
                } else {
                    // Fallback to default options if field not found
                    console.warn(`❌ Field ${fieldName} not found, using fallback. Response:`, response);
                    this.useFallbackOptions($cell, fieldName, currentValue, taskId);
                }
            },
            error: (error) => {
                console.error('Error loading field options:', error);
                this.useFallbackOptions($cell, fieldName, currentValue, taskId);
            }
        });
    }

    // Use fallback options when dynamic loading fails
    useFallbackOptions($cell, fieldName, currentValue, taskId) {
        let fallbackOptions = [];
        
        // Define fallback options for known fields - avoid hardcoding, use minimal fallbacks
        switch (fieldName) {
            case 'custom_target_month':
            case 'custom_year_end':
                // Minimal fallback - let user know there's an issue
                console.warn(`⚠️ Failed to load options for ${fieldName}, using minimal fallback`);
                fallbackOptions = [currentValue || '-', '-', 'January', 'February', 'March', 'April', 'May', 'June',
                                 'July', 'August', 'September', 'October', 'November', 'December'];
                break;
            case 'custom_frequency':
                console.warn(`⚠️ Failed to load options for ${fieldName}, using minimal fallback`);
                fallbackOptions = [currentValue || 'Annually', 'Annually', 'Half Yearly', 'Quarterly', 'Monthly', 'Fortnightly', 'Weekly', 'Daily', 'Ad-Hoc', 'Other'];
                break;
            default:
                // If no fallback available, show error message and current value
                console.error(`❌ No fallback options available for field: ${fieldName}`);
                $cell.html(`<span class="editable-field error" title="Failed to load options for ${fieldName}">${currentValue}</span>`);
                return;
        }
        
        // Remove duplicates while preserving order
        fallbackOptions = [...new Set(fallbackOptions)];
        
        this.renderDynamicSelect($cell, fallbackOptions, currentValue, taskId, fieldName);
    }

    // Clean expired cache entries
    cleanExpiredCache() {
        const now = Date.now();
        
        // Only clean every 2 minutes to avoid frequent operations
        if (now - this.lastCacheClean < 2 * 60 * 1000) {
            return;
        }
        
        this.lastCacheClean = now;
        
        for (const [key, value] of this.metaCache.entries()) {
            if (now - value.timestamp > this.cacheExpiry) {
                this.metaCache.delete(key);
            }
        }
    }

    // Render dynamic select dropdown
    renderDynamicSelect($cell, options, currentValue, taskId, fieldName) {
        console.debug(`🎨 Rendering select for ${fieldName} with options:`, options, `current: "${currentValue}"`);
        
        let selectHTML = '<select class="pm-inline-select">';
        
        options.forEach(option => {
            const selected = currentValue === option ? 'selected' : '';
            selectHTML += `<option value="${option}" ${selected}>${option}</option>`;
        });
        
        selectHTML += '</select>';
        
        $cell.html(selectHTML);
        const $select = $cell.find('.pm-inline-select');
        
        // Focus and show dropdown
        $select.focus();
        
        // Handle selection
        $select.on('change blur', (e) => {
            const newValue = $select.val();
            
            if (newValue !== currentValue) {
                // Update the field
                this.updateTaskField(taskId, fieldName, newValue, $cell);
            } else {
                // No change, revert to display
                $cell.html(`<span class="editable-field">${currentValue}</span>`);
            }
        });

        // Handle escape key
        $select.on('keydown', (e) => {
            if (e.key === 'Escape') {
                $cell.html(`<span class="editable-field">${currentValue}</span>`);
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
