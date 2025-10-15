// Project Management - Communication Methods Selector
// Communication methods selection and management functionality

class CommunicationMethodsSelectorManager {
    constructor() {
        this.utils = window.PMUtils;
    }

    async showCommunicationMethodsSelector($cell, taskId, fieldName) {
        try {
            console.log('showCommunicationMethodsSelector called with:', taskId, fieldName);
            
            // Get communication methods options from doctype definition
            const methodOptions = ['WeChat', 'Email', 'Phone Call', 'Teams Group'];
            
            console.log('Communication methods options loaded:', methodOptions);
            
            // Get current communication methods assignments
            const currentMethods = await this.getCurrentTaskCommunicationMethods(taskId);
            console.log('Current communication methods:', currentMethods);
        
        // Create simple multi-select modal (Monday style)
        const selectorHTML = `
            <div class="pm-communication-methods-selector-modal" id="pm-communication-methods-selector-${taskId}">
                <div class="pm-communication-methods-selector-content">
                    <div class="pm-communication-methods-selector-header">
                        <h4>Select Communication Methods</h4>
                        <button class="pm-communication-methods-selector-close">
                            <i class="fa fa-times"></i>
                        </button>
                    </div>
                    <div class="pm-communication-methods-selector-body">
                        <div class="pm-communication-methods-options">
                            ${methodOptions.map(method => {
                                const isSelected = currentMethods.some(m => m.communication_method === method);
                                const isPrimary = currentMethods.find(m => m.communication_method === method && m.is_primary);
                                return `
                                    <div class="pm-communication-method-option ${isSelected ? 'selected' : ''}" data-method="${method}">
                                        <div class="pm-communication-method-checkbox">
                                            <i class="fa fa-${isSelected ? 'check-' : ''}square-o"></i>
                                        </div>
                                        <span class="pm-communication-method-name">${method}</span>
                                        ${isPrimary ? '<span class="pm-primary-badge">Primary</span>' : ''}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                        <div class="pm-communication-methods-selector-footer">
                            <button class="pm-btn pm-btn-secondary pm-clear-all-methods">Clear all</button>
                            <button class="pm-btn pm-btn-primary pm-save-methods">
                                <i class="fa fa-check"></i>
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing selector
        $('.pm-communication-methods-selector-modal').remove();
        
        // Add to body
        $('body').append(selectorHTML);
        const $selector = $(`#pm-communication-methods-selector-${taskId}`);
        
        // Position above the cell using viewport coordinates
        const cellRect = $cell[0].getBoundingClientRect();
        
        $selector.css({
            position: 'fixed',
            left: cellRect.left + 'px',
            top: (cellRect.top - 350) + 'px',
            zIndex: 9999,
            width: '300px'
        });
        
        // Show with animation
        $selector.fadeIn(200);
        
            // Bind events
            this.bindCommunicationMethodsSelectorEvents($selector, $cell, taskId);
            
        } catch (error) {
            console.error('Error in showCommunicationMethodsSelector:', error);
            frappe.show_alert({
                message: 'Error opening communication methods selector: ' + error.message,
                indicator: 'red'
            });
        }
    }

    bindCommunicationMethodsSelectorEvents($selector, $cell, taskId) {
        // Toggle method selection
        $selector.on('click', '.pm-communication-method-option', (e) => {
            const $option = $(e.currentTarget);
            const method = $option.data('method');
            
            if ($option.hasClass('selected')) {
                // Deselect
                $option.removeClass('selected');
                $option.find('.pm-communication-method-checkbox i').removeClass('fa-check-square-o').addClass('fa-square-o');
                $option.find('.pm-primary-badge').remove();
            } else {
                // Select
                $option.addClass('selected');
                $option.find('.pm-communication-method-checkbox i').removeClass('fa-square-o').addClass('fa-check-square-o');
                
                // If this is the first selection, make it primary
                const selectedCount = $selector.find('.pm-communication-method-option.selected').length;
                if (selectedCount === 1) {
                    $option.append('<span class="pm-primary-badge">Primary</span>');
                }
            }
        });
        
        // Set primary method (right-click or double-click)
        $selector.on('contextmenu dblclick', '.pm-communication-method-option.selected', (e) => {
            e.preventDefault();
            
            const $option = $(e.currentTarget);
            
            // Remove primary from all others
            $selector.find('.pm-primary-badge').remove();
            
            // Add primary to this one
            $option.append('<span class="pm-primary-badge">Primary</span>');
        });
        
        // Clear all
        $selector.on('click', '.pm-clear-all-methods', () => {
            $selector.find('.pm-communication-method-option').removeClass('selected');
            $selector.find('.pm-communication-method-checkbox i').removeClass('fa-check-square-o').addClass('fa-square-o');
            $selector.find('.pm-primary-badge').remove();
        });
        
        // Save methods
        $selector.on('click', '.pm-save-methods', async () => {
            await this.saveCommunicationMethods($selector, $cell, taskId);
        });
        
        // Close selector
        $selector.on('click', '.pm-communication-methods-selector-close', () => {
            $selector.fadeOut(200, () => $selector.remove());
        });
        
        // Close on outside click
        $(document).on('click.communication-methods-selector', (e) => {
            if (!$(e.target).closest('.pm-communication-methods-selector-modal').length) {
                $selector.fadeOut(200, () => $selector.remove());
                $(document).off('click.communication-methods-selector');
            }
        });
    }

    async getCurrentTaskCommunicationMethods(taskId) {
        try {
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.get_task_communication_methods',
                args: { task_id: taskId }
            });
            
            return response.message?.communication_methods || [];
        } catch (error) {
            console.error('Error getting current communication methods:', error);
            return [];
        }
    }

    async saveCommunicationMethods($selector, $cell, taskId) {
        try {
            // Collect selected methods
            const selectedMethods = [];
            
            $selector.find('.pm-communication-method-option.selected').each(function() {
                const $option = $(this);
                const method = $option.data('method');
                const isPrimary = $option.find('.pm-primary-badge').length > 0;
                
                selectedMethods.push({
                    communication_method: method,
                    is_primary: isPrimary ? 1 : 0
                });
            });
            
            console.log('Saving communication methods:', selectedMethods);
            
            // Save to server
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.update_task_communication_methods',
                args: {
                    task_id: taskId,
                    communication_methods: selectedMethods
                }
            });
            
            if (response.message?.success) {
                // Update cell display
                this.updateCellDisplay($cell, selectedMethods);
                
                // Close selector
                $selector.fadeOut(200, () => $selector.remove());
                
                frappe.show_alert({
                    message: 'Communication methods updated successfully',
                    indicator: 'green'
                });
            } else {
                throw new Error(response.message?.error || 'Failed to update communication methods');
            }
            
        } catch (error) {
            console.error('Error saving communication methods:', error);
            frappe.show_alert({
                message: 'Error saving communication methods: ' + error.message,
                indicator: 'red'
            });
        }
    }

    updateCellDisplay($cell, methods) {
        let displayHTML;
        
        if (!methods || methods.length === 0) {
            // Empty state
            displayHTML = `
                <div class="pm-communication-methods-tags pm-empty-communication-methods">
                    <span class="pm-communication-method-badge pm-empty-badge">
                        <i class="fa fa-plus"></i>
                        Add method
                    </span>
                </div>
            `;
        } else if (methods.length === 1) {
            // Single method
            displayHTML = `
                <div class="pm-communication-methods-tags">
                    <span class="pm-communication-method-badge pm-primary-method">${methods[0].communication_method}</span>
                </div>
            `;
        } else {
            // Multiple methods - show primary + count
            const primaryMethod = methods.find(m => m.is_primary) || methods[0];
            displayHTML = `
                <div class="pm-communication-methods-tags">
                    <span class="pm-communication-method-badge pm-primary-method">${primaryMethod.communication_method}</span>
                    <span class="pm-communication-method-more">+${methods.length - 1}</span>
                </div>
            `;
        }
        
        $cell.html(displayHTML);
    }
}

// Create global instance
window.CommunicationMethodsSelectorManager = new CommunicationMethodsSelectorManager();

// Export for module systems if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CommunicationMethodsSelectorManager;
}
