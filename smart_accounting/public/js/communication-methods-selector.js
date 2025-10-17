// Project Management - Communication Methods Selector
// Communication methods selection and management functionality

class CommunicationMethodsSelectorManager {
    constructor() {
        this.utils = window.PMUtils;
    }

    async showCommunicationMethodsSelector($cell, taskId, fieldName) {
        try {
            console.log('showCommunicationMethodsSelector called with:', taskId, fieldName);
            
            // 立即显示空选择器，不等待数据加载
            this.showEmptyCommunicationMethodsSelector($cell, taskId);
            
            // 异步加载数据，不阻塞UI
            this.loadCommunicationMethodsDataAsync($cell, taskId);
            
        } catch (error) {
            console.error('Error in showCommunicationMethodsSelector:', error);
            frappe.show_alert({
                message: 'Error opening communication methods selector: ' + error.message,
                indicator: 'red'
            });
        }
    }

    showEmptyCommunicationMethodsSelector($cell, taskId) {
        // 默认通信方式选项
        const defaultMethodOptions = ['WeChat', 'Email', 'Phone Call', 'Teams Group'];
        
        // 创建带加载状态的选择器
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
                        <div class="pm-communication-methods-loading" style="text-align: center; padding: 20px; color: #666;">
                            <i class="fa fa-spinner fa-spin"></i>
                            <span style="margin-left: 8px;">Loading current methods...</span>
                        </div>
                        <div class="pm-communication-methods-options" style="display: none;">
                            ${defaultMethodOptions.map(method => {
                                return `
                                    <div class="pm-communication-method-option" data-method="${method}">
                                        <div class="pm-communication-method-checkbox">
                                            <i class="fa fa-square-o"></i>
                                        </div>
                                        <span class="pm-communication-method-name">${method}</span>
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
        
        // 移除现有选择器
        $('.pm-communication-methods-selector-modal').remove();
        
        // 添加到页面
        $('body').append(selectorHTML);
        const $selector = $(`#pm-communication-methods-selector-${taskId}`);
        
        // 定位选择器
        const cellRect = $cell[0].getBoundingClientRect();
        
        $selector.css({
            position: 'fixed',
            left: cellRect.left + 'px',
            top: (cellRect.top - 350) + 'px',
            zIndex: 9999,
            width: '300px'
        });
        
        // 立即显示选择器
        $selector.fadeIn(200);
        
        // 绑定事件
        this.bindCommunicationMethodsSelectorEvents($selector, $cell, taskId);
    }

    async loadCommunicationMethodsDataAsync($cell, taskId) {
        const $selector = $(`#pm-communication-methods-selector-${taskId}`);
        if ($selector.length === 0) return;

        try {
            // 加载当前通信方式，使用超时机制
            const currentMethods = await this.getCurrentTaskCommunicationMethodsWithTimeout(taskId);
            console.log('✅ Current communication methods loaded:', currentMethods);

            // 更新选择器内容
            this.updateCommunicationMethodsSelectorContent($selector, currentMethods);

        } catch (error) {
            console.error('❌ Error loading communication methods data:', error);
            this.showCommunicationMethodsLoadError($selector, $cell, taskId);
        }
    }

    async getCurrentTaskCommunicationMethodsWithTimeout(taskId, timeout = 5000) {
        return Promise.race([
            this.getCurrentTaskCommunicationMethods(taskId),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), timeout)
            )
        ]);
    }

    updateCommunicationMethodsSelectorContent($selector, currentMethods) {
        // 隐藏加载状态
        $selector.find('.pm-communication-methods-loading').hide();
        
        // 显示选项
        $selector.find('.pm-communication-methods-options').show();
        
        // 更新选择状态
        currentMethods.forEach(method => {
            const $option = $selector.find(`[data-method="${method.communication_method}"]`);
            if ($option.length > 0) {
                $option.addClass('selected');
                $option.find('.pm-communication-method-checkbox i')
                    .removeClass('fa-square-o').addClass('fa-check-square-o');
                
                if (method.is_primary) {
                    $option.append('<span class="pm-primary-badge">Primary</span>');
                }
            }
        });
    }

    showCommunicationMethodsLoadError($selector, $cell, taskId) {
        $selector.find('.pm-communication-methods-loading').html(`
            <div style="text-align: center; padding: 20px; color: #e74c3c;">
                <i class="fa fa-exclamation-triangle"></i>
                <div style="margin-top: 8px;">Failed to load current methods</div>
                <button class="pm-btn pm-btn-secondary pm-retry-methods-load" style="margin-top: 8px; font-size: 12px;">Retry</button>
            </div>
        `);
        
        // 显示默认选项
        $selector.find('.pm-communication-methods-options').show();
        
        // 绑定重试事件
        $selector.find('.pm-retry-methods-load').on('click', (e) => {
            e.stopPropagation();
            $selector.find('.pm-communication-methods-loading').html(`
                <i class="fa fa-spinner fa-spin"></i>
                <span style="margin-left: 8px;">Retrying...</span>
            `);
            this.loadCommunicationMethodsDataAsync($cell, taskId);
        });
    }

    bindCommunicationMethodsSelectorEvents($selector, $cell, taskId) {
        // 重试加载数据
        $selector.on('click', '.pm-retry-methods-load', (e) => {
            e.stopPropagation();
            $selector.find('.pm-communication-methods-loading').html(`
                <i class="fa fa-spinner fa-spin"></i>
                <span style="margin-left: 8px;">Retrying...</span>
            `);
            this.loadCommunicationMethodsDataAsync($cell, taskId);
        });

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
