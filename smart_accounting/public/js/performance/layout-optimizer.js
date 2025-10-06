// Smart Accounting - Layout Optimizer
// 布局预配置和渲染优化

class LayoutOptimizer {
    constructor() {
        this.layoutCache = new Map();
        this.columnConfigs = new Map();
        this.resizeObserver = null;
        this.intersectionObserver = null;
        
        this.init();
    }

    init() {
        this.setupObservers();
        this.preloadLayoutConfigs();
    }

    // 设置观察器
    setupObservers() {
        // 监听元素大小变化
        if (window.ResizeObserver) {
            this.resizeObserver = new ResizeObserver(entries => {
                this.handleResize(entries);
            });
        }

        // 监听元素可见性
        if (window.IntersectionObserver) {
            this.intersectionObserver = new IntersectionObserver(entries => {
                this.handleIntersection(entries);
            }, {
                rootMargin: '100px' // 提前100px开始加载
            });
        }
    }

    // 预加载布局配置
    async preloadLayoutConfigs() {
        try {
            const configs = await frappe.call({
                method: 'smart_accounting.www.project_management.index.get_layout_configs'
            });
            
            if (configs.message) {
                configs.message.forEach(config => {
                    this.columnConfigs.set(config.view, config);
                });
            }
        } catch (error) {
            console.warn('Failed to preload layout configs:', error);
            this.setDefaultConfigs();
        }
    }

    // 设置默认配置
    setDefaultConfigs() {
        const defaultConfig = {
            columns: [
                { key: 'select', width: 40, fixed: true },
                { key: 'client', width: 150, resizable: true },
                { key: 'task-name', width: 200, resizable: true },
                { key: 'status', width: 100, resizable: true },
                { key: 'priority', width: 100, resizable: true },
                { key: 'action-person', width: 120, resizable: true }
            ]
        };
        
        this.columnConfigs.set('default', defaultConfig);
    }

    // 获取优化的布局
    getOptimizedLayout(view, containerWidth) {
        const cacheKey = `${view}_${containerWidth}`;
        
        if (this.layoutCache.has(cacheKey)) {
            return this.layoutCache.get(cacheKey);
        }

        const config = this.columnConfigs.get(view) || this.columnConfigs.get('default');
        const optimizedLayout = this.calculateOptimalLayout(config, containerWidth);
        
        this.layoutCache.set(cacheKey, optimizedLayout);
        return optimizedLayout;
    }

    // 计算最优布局
    calculateOptimalLayout(config, containerWidth) {
        const columns = [...config.columns];
        const totalFixedWidth = columns
            .filter(col => col.fixed)
            .reduce((sum, col) => sum + col.width, 0);
        
        const availableWidth = containerWidth - totalFixedWidth - 20; // 20px for scrollbar
        const flexibleColumns = columns.filter(col => !col.fixed);
        
        // 按优先级分配宽度
        const priorityColumns = flexibleColumns.sort((a, b) => 
            (b.priority || 0) - (a.priority || 0)
        );
        
        let remainingWidth = availableWidth;
        
        priorityColumns.forEach(col => {
            const minWidth = col.minWidth || 80;
            const maxWidth = col.maxWidth || 300;
            const preferredWidth = col.width || 150;
            
            const allocatedWidth = Math.min(
                maxWidth,
                Math.max(minWidth, Math.min(preferredWidth, remainingWidth / priorityColumns.length))
            );
            
            col.calculatedWidth = allocatedWidth;
            remainingWidth -= allocatedWidth;
        });

        return {
            columns,
            totalWidth: containerWidth,
            scrollable: totalFixedWidth + flexibleColumns.reduce((sum, col) => sum + col.calculatedWidth, 0) > containerWidth
        };
    }

    // 应用布局到DOM
    applyLayout(container, layout) {
        const $container = $(container);
        if (!$container.length) return;

        // 设置表格宽度
        const $table = $container.find('.pm-table, .pm-project-table-header').first();
        if (layout.scrollable) {
            $table.css('min-width', layout.totalWidth + 'px');
            $container.addClass('pm-scrollable-table');
        } else {
            $table.css('width', '100%');
            $container.removeClass('pm-scrollable-table');
        }

        // 应用列宽
        layout.columns.forEach(col => {
            const width = col.calculatedWidth || col.width;
            const $cells = $container.find(`[data-column="${col.key}"]`);
            
            $cells.css({
                'width': `${width}px`,
                'min-width': `${width}px`,
                'max-width': `${width}px`
            });
        });

        // 启用虚拟滚动（如果需要）
        if (layout.scrollable && $container.find('.pm-task-row').length > 50) {
            this.enableVirtualScrolling($container);
        }
    }

    // 启用虚拟滚动
    enableVirtualScrolling($container) {
        if (!window.VirtualTableManager) return;

        const virtualTable = new window.VirtualTableManager({
            container: $container[0],
            rowHeight: 48,
            bufferSize: 10
        });

        // 提取数据
        const data = this.extractTableData($container);
        virtualTable.setData(data);

        // 保存引用以便后续操作
        $container.data('virtualTable', virtualTable);
    }

    // 提取表格数据
    extractTableData($container) {
        const data = [];
        
        $container.find('.pm-task-row').each((index, row) => {
            const $row = $(row);
            const rowData = {
                task_id: $row.data('task-id'),
                task_name: $row.find('.task-name-display').text().trim(),
                client_name: $row.find('.client-display').text().trim(),
                status: $row.find('.pm-status-badge').text().trim(),
                priority: $row.find('.pm-priority-badge').text().trim()
            };
            data.push(rowData);
        });
        
        return data;
    }

    // 处理大小变化
    handleResize(entries) {
        entries.forEach(entry => {
            const $element = $(entry.target);
            const view = $element.data('view') || 'default';
            const newWidth = entry.contentRect.width;
            
            // 清除缓存
            this.clearLayoutCache(view);
            
            // 重新应用布局
            const layout = this.getOptimizedLayout(view, newWidth);
            this.applyLayout(entry.target, layout);
        });
    }

    // 处理可见性变化
    handleIntersection(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // 元素进入视口，应用完整样式
                this.applyFullStyles(entry.target);
            } else {
                // 元素离开视口，应用简化样式
                this.applyMinimalStyles(entry.target);
            }
        });
    }

    // 应用完整样式
    applyFullStyles(element) {
        const $element = $(element);
        $element.removeClass('pm-minimal-render');
        
        // 恢复所有交互功能
        $element.find('[data-lazy-load]').each((index, el) => {
            this.loadLazyContent(el);
        });
    }

    // 应用简化样式
    applyMinimalStyles(element) {
        const $element = $(element);
        $element.addClass('pm-minimal-render');
    }

    // 懒加载内容
    loadLazyContent(element) {
        const $element = $(element);
        const contentType = $element.data('lazy-load');
        
        switch (contentType) {
            case 'avatar':
                this.loadUserAvatar($element);
                break;
            case 'status-badge':
                this.loadStatusBadge($element);
                break;
            case 'software-tags':
                this.loadSoftwareTags($element);
                break;
        }
    }

    // 加载用户头像
    async loadUserAvatar($element) {
        const email = $element.data('email');
        if (!email) return;

        try {
            const userInfo = await window.DataManager.getData(
                `user_${email}`,
                () => window.PMUtils.getRealUserInfo(email)
            );

            if (userInfo.user_image) {
                $element.css('background-image', `url(${userInfo.user_image})`);
                $element.addClass('pm-avatar-with-image');
            }
        } catch (error) {
            console.warn('Failed to load user avatar:', error);
        }
    }

    // 观察元素
    observeElement(element) {
        if (this.resizeObserver) {
            this.resizeObserver.observe(element);
        }
        if (this.intersectionObserver) {
            this.intersectionObserver.observe(element);
        }
    }

    // 取消观察元素
    unobserveElement(element) {
        if (this.resizeObserver) {
            this.resizeObserver.unobserve(element);
        }
        if (this.intersectionObserver) {
            this.intersectionObserver.unobserve(element);
        }
    }

    // 清除布局缓存
    clearLayoutCache(view) {
        const keysToDelete = [];
        this.layoutCache.forEach((value, key) => {
            if (key.startsWith(`${view}_`)) {
                keysToDelete.push(key);
            }
        });
        keysToDelete.forEach(key => this.layoutCache.delete(key));
    }

    // 销毁
    destroy() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        if (this.intersectionObserver) {
            this.intersectionObserver.disconnect();
        }
        
        this.layoutCache.clear();
        this.columnConfigs.clear();
    }
}

// 全局实例
window.LayoutOptimizer = new LayoutOptimizer();

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LayoutOptimizer;
}
