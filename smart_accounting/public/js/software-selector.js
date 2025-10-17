// Project Management - Software Selector
// Software selection and management functionality

class SoftwareSelectorManager {
    constructor() {
        this.utils = window.PMUtils;
    }

    async showSoftwareSelector($cell, taskId, fieldName) {
        try {
            console.log('showSoftwareSelector called with:', taskId, fieldName);
            
            // 立即显示空选择器，不等待数据加载
            this.showEmptySoftwareSelector($cell, taskId);
            
            // 异步加载数据，不阻塞UI
            this.loadSoftwareDataAsync($cell, taskId);
            
        } catch (error) {
            console.error('Error in showSoftwareSelector:', error);
            frappe.show_alert({
                message: 'Error opening software selector: ' + error.message,
                indicator: 'red'
            });
        }
    }

    showEmptySoftwareSelector($cell, taskId) {
        // 默认软件选项，立即可用
        const defaultSoftwareOptions = [
            'Xero', 'MYOB', 'QuickBooks', 'Excel', 'Payroller', 'Oracle', 'Logdit', 'Other'
        ];
        
        // 创建带加载状态的选择器
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
                        <div class="pm-software-loading" style="text-align: center; padding: 20px; color: #666;">
                            <i class="fa fa-spinner fa-spin"></i>
                            <span style="margin-left: 8px;">Loading current selections...</span>
                        </div>
                        <div class="pm-software-options" style="display: none;">
                            ${defaultSoftwareOptions.map(software => {
                                return `
                                    <div class="pm-software-option" data-software="${software}">
                                        <div class="pm-software-checkbox">
                                            <i class="fa fa-square-o"></i>
                                        </div>
                                        <span class="pm-software-name">${software}</span>
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
        
        // 移除现有选择器
        $('.pm-software-selector-modal').remove();
        
        // 添加到页面
        $('body').append(selectorHTML);
        const $selector = $(`#pm-software-selector-${taskId}`);
        
        // 定位选择器
        const cellRect = $cell[0].getBoundingClientRect();
        
        $selector.css({
            position: 'fixed',
            left: cellRect.left + 'px',
            top: (cellRect.top - 350) + 'px',
            zIndex: 9999,
            width: '280px'
        });
        
        // 立即显示选择器
        $selector.fadeIn(200);
        
        // 绑定事件
        this.bindSoftwareSelectorEvents($selector, $cell, taskId);
    }

    async loadSoftwareDataAsync($cell, taskId) {
        const $selector = $(`#pm-software-selector-${taskId}`);
        if ($selector.length === 0) return;

        try {
            // 并行加载数据，使用 Promise.allSettled 确保不会因为单个失败而全部失败
            const results = await Promise.allSettled([
                this.getSoftwareOptionsWithTimeout(),
                this.getCurrentTaskSoftwaresWithTimeout(taskId)
            ]);

            const [optionsResult, currentResult] = results;
            
            // 处理软件选项
            let softwareOptions = ['Xero', 'MYOB', 'QuickBooks', 'Excel', 'Payroller', 'Oracle', 'Logdit', 'Other'];
            if (optionsResult.status === 'fulfilled' && optionsResult.value) {
                softwareOptions = optionsResult.value;
                console.log('✅ Software options loaded from server:', softwareOptions);
            } else {
                console.warn('⚠️ Using default software options:', optionsResult.reason);
            }

            // 处理当前选择
            let currentSoftwares = [];
            if (currentResult.status === 'fulfilled' && currentResult.value) {
                currentSoftwares = currentResult.value;
                console.log('✅ Current softwares loaded:', currentSoftwares);
            } else {
                console.warn('⚠️ Could not load current softwares:', currentResult.reason);
            }

            // 更新选择器内容
            this.updateSoftwareSelectorContent($selector, softwareOptions, currentSoftwares);

        } catch (error) {
            console.error('❌ Error loading software data:', error);
            // 即使加载失败，也显示默认选项
            this.showSoftwareLoadError($selector);
        }
    }

    async getSoftwareOptionsWithTimeout(timeout = 5000) {
        return Promise.race([
            frappe.call({
                method: 'smart_accounting.www.project_management.index.get_software_options'
            }).then(response => response.message?.software_options || null),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), timeout)
            )
        ]);
    }

    async getCurrentTaskSoftwaresWithTimeout(taskId, timeout = 5000) {
        return Promise.race([
            this.getCurrentTaskSoftwares(taskId),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), timeout)
            )
        ]);
    }

    updateSoftwareSelectorContent($selector, softwareOptions, currentSoftwares) {
        const optionsHTML = softwareOptions.map(software => {
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
        }).join('');

        // 隐藏加载状态，显示选项
        $selector.find('.pm-software-loading').hide();
        $selector.find('.pm-software-options').html(optionsHTML).show();
    }

    showSoftwareLoadError($selector) {
        $selector.find('.pm-software-loading').html(`
            <div style="text-align: center; padding: 20px; color: #e74c3c;">
                <i class="fa fa-exclamation-triangle"></i>
                <div style="margin-top: 8px;">Failed to load current selections</div>
                <button class="pm-btn pm-btn-secondary pm-retry-load" style="margin-top: 8px; font-size: 12px;">Retry</button>
            </div>
        `);
        
        // 显示默认选项
        const defaultOptions = ['Xero', 'MYOB', 'QuickBooks', 'Excel', 'Other'];
        this.updateSoftwareSelectorContent($selector, defaultOptions, []);
    }

    bindSoftwareSelectorEvents($selector, $cell, taskId) {
        // 重试加载数据
        $selector.on('click', '.pm-retry-load', (e) => {
            e.stopPropagation();
            $selector.find('.pm-software-loading').html(`
                <i class="fa fa-spinner fa-spin"></i>
                <span style="margin-left: 8px;">Retrying...</span>
            `);
            this.loadSoftwareDataAsync($cell, taskId);
        });

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
                
                // Trigger bulk update event
                $(document).trigger('pm:cell:changed', {
                    taskId: $cell.data('task-id'),
                    field: 'custom_softwares',
                    newValue: selectedSoftwares,
                    oldValue: null
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
