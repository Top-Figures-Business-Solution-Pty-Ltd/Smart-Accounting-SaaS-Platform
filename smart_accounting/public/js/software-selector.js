// Project Management - Software Selector
// Software selection and management functionality

class SoftwareSelectorManager {
    constructor() {
        this.utils = window.PMUtils;
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
}

// Create global instance
window.SoftwareSelectorManager = new SoftwareSelectorManager();

// Export for module systems if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SoftwareSelectorManager;
}
