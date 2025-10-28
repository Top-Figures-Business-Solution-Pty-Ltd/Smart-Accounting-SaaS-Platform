// Project Management - Software Selector
// Software selection and management functionality

console.log('🔥 LOADING SoftwareSelector - NEW VERSION');

class SoftwareSelectorManager {
    constructor() {
        this.utils = window.PMUtils;
        // 大数据量环境检测
        this.isLargeDataset = false;
        this.checkDatasetSize();
    }

    // 🔧 检测数据集大小，调整策略
    checkDatasetSize() {
        const taskCount = document.querySelectorAll('.pm-task-row').length;
        this.isLargeDataset = taskCount > 100;
        
        if (this.isLargeDataset) {
            console.log(`🔧 Large dataset detected (${taskCount} tasks), using enhanced DOM timing`);
        }
    }

    // 🔧 增强的DOM元素确认机制
    async ensureDOMElementAndInitialize(selector, $cell, taskId) {
        const maxAttempts = this.isLargeDataset ? 15 : 8; // 增加尝试次数
        const baseDelay = this.isLargeDataset ? 50 : 25;  // 增加基础延迟
        const maxDelay = this.isLargeDataset ? 500 : 300; // 增加最大延迟
        
        console.log(`🔧 [ENHANCED VERSION] Starting DOM element search for ${selector}, max attempts: ${maxAttempts}`);
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            // 多重检查策略
            await new Promise(resolve => requestAnimationFrame(resolve));
            
            // 方法1: 标准jQuery选择器
            let $selector = $(selector);
            console.log(`🔧 Attempt ${attempt + 1}: jQuery selector result: ${$selector.length} elements`);
            
            // 方法2: 如果jQuery失败，尝试原生DOM查询
            if ($selector.length === 0) {
                const nativeElement = document.querySelector(selector);
                console.log(`🔧 Attempt ${attempt + 1}: Native DOM query result: ${nativeElement ? 'found' : 'not found'}`);
                if (nativeElement) {
                    $selector = $(nativeElement);
                    console.log(`🔧 Found element using native DOM query on attempt ${attempt + 1}`);
                }
            }
            
            // 方法3: 强制DOM刷新后再次尝试
            if ($selector.length === 0 && attempt > 2) {
                console.log(`🔧 Attempt ${attempt + 1}: Forcing DOM refresh...`);
                // 强制浏览器重新计算DOM
                document.body.offsetHeight;
                $selector = $(selector);
                console.log(`🔧 Attempt ${attempt + 1}: After DOM refresh: ${$selector.length} elements`);
            }
            
            // 方法4: 检查元素是否真的在DOM中
            if ($selector.length === 0 && attempt > 4) {
                console.log(`🔧 Attempt ${attempt + 1}: Checking all elements with similar IDs...`);
                const allModals = document.querySelectorAll('[id*="pm-software-selector"]');
                console.log(`🔧 Found ${allModals.length} elements with similar IDs:`, Array.from(allModals).map(el => el.id));
            }
            
            if ($selector.length > 0) {
                console.log(`✅ Software selector found on attempt ${attempt + 1} (method: ${$selector.length > 0 ? 'success' : 'unknown'})`);
                this.initializeSoftwareSelectorAfterAppend($selector, $cell, taskId);
                return;
            }
            
            // 指数退避延迟，但有最大限制
            if (attempt < maxAttempts - 1) {
                const delay = Math.min(baseDelay * Math.pow(1.2, attempt), maxDelay);
                console.log(`🔧 Attempt ${attempt + 1} failed, waiting ${delay}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        // 最终降级处理
        console.error(`❌ Software selector ${selector} not found after ${maxAttempts} attempts`);
        this.handleSelectorNotFound($cell, taskId);
    }

    // 🔧 选择器未找到的降级处理
    handleSelectorNotFound($cell, taskId) {
        $cell.removeClass('editing selector-opening');
        frappe.show_alert({
            message: 'Unable to open software selector. Please try again.',
            indicator: 'orange'
        });
        
        // 记录错误用于调试
        console.warn('Software selector failed to initialize:', {
            taskId: taskId,
            cellHtml: $cell[0]?.outerHTML?.substring(0, 100),
            taskCount: document.querySelectorAll('.pm-task-row').length
        });
    }

    async showSoftwareSelector($cell, taskId, fieldName) {
        try {
            console.log('🚀 NEW VERSION: showSoftwareSelector called with:', taskId, fieldName);
            
            // 🔧 防抖机制：防止重复点击
            if ($cell.hasClass('editing') || $cell.hasClass('selector-opening')) {
                console.log('Software selector already opening/open for task:', taskId);
                return;
            }
            
            // 标记为正在打开
            $cell.addClass('editing selector-opening');
            
            // 立即显示空选择器，不等待数据加载
            this.showEmptySoftwareSelector($cell, taskId);
            
            // 异步加载数据，不阻塞UI
            this.loadSoftwareDataAsync($cell, taskId);
            
        } catch (error) {
            console.error('Error in showSoftwareSelector:', error);
            $cell.removeClass('editing selector-opening');
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
        
        // 清理taskId，确保CSS选择器有效
        const cleanTaskId = taskId.replace(/[^a-zA-Z0-9-_]/g, '-');
        
        // 创建带加载状态的选择器
        const selectorHTML = `
            <div class="pm-software-selector-modal" id="pm-software-selector-${cleanTaskId}">
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
        
        // 🔧 立即验证DOM添加是否成功
        // 使用之前清理的taskId
        const expectedId = `pm-software-selector-${cleanTaskId}`;
        console.log(`🔧 Original taskId: ${taskId}`);
        console.log(`🔧 Clean taskId: ${cleanTaskId}`);
        console.log(`🔧 Appended selector with ID: ${expectedId}`);
        console.log(`🔧 Body children count after append: ${document.body.children.length}`);
        
        // 🔧 增强DOM时序保证机制：确保在大数据量环境下也能正常工作
        this.ensureDOMElementAndInitialize(`#${expectedId}`, $cell, taskId);
    }

    // 🔧 新增方法：在DOM确认存在后初始化软件选择器
    initializeSoftwareSelectorAfterAppend($selector, $cell, taskId) {
        // 清理状态标记
        $cell.removeClass('selector-opening');
        
        console.log('🔧 Initializing software selector:', {
            selectorId: $selector.attr('id'),
            selectorLength: $selector.length,
            cellPosition: $cell.offset()
        });
        
        // 定位选择器 - 使用更安全的定位逻辑
        const cellRect = $cell[0].getBoundingClientRect();
        const windowHeight = $(window).height();
        const modalHeight = 400; // 预估模态框高度
        
        // 计算最佳位置
        let top = cellRect.bottom + 10; // 默认在单元格下方
        if (top + modalHeight > windowHeight) {
            // 如果下方空间不够，显示在上方
            top = cellRect.top - modalHeight - 10;
        }
        
        // 确保不会超出屏幕边界
        if (top < 10) {
            top = 10;
        }
        
        $selector.css({
            position: 'fixed',
            left: Math.max(10, cellRect.left) + 'px',
            top: top + 'px',
            zIndex: 9999,
            width: '280px',
            display: 'block' // 确保显示
        });
        
        console.log('🔧 Software selector positioned at:', {
            left: Math.max(10, cellRect.left),
            top: top,
            display: $selector.css('display')
        });
        
        // 确保选择器可见
        $selector.show();
        console.log('🔧 Selector visibility after show():', $selector.is(':visible'));
        
        // 立即显示选择器
        $selector.fadeIn(200, function() {
            console.log('🔧 FadeIn completed, selector visible:', $(this).is(':visible'));
        });
        
        // 绑定事件
        try {
            this.bindSoftwareSelectorEvents($selector, $cell, taskId);
            console.log('✅ Events bound successfully');
        } catch (eventError) {
            console.error('❌ Error binding events:', eventError);
        }
        
        console.log('✅ Software selector initialization completed');
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
                // console.log Software options loaded from server:', softwareOptions);
            } else {
                console.warn('⚠️ Using default software options:', optionsResult.reason);
            }

            // 处理当前选择
            let currentSoftwares = [];
            if (currentResult.status === 'fulfilled' && currentResult.value) {
                currentSoftwares = currentResult.value;
                // console.log Current softwares loaded:', currentSoftwares);
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
