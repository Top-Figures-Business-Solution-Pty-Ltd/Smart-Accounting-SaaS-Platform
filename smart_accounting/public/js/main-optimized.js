// Smart Accounting - Optimized Main Entry Point
// 性能优化的主入口文件

class OptimizedProjectManagement {
    constructor() {
        this.initialized = false;
        this.loadingPromise = null;
        this.activeModules = new Set();
        
        // 性能监控
        this.performanceMetrics = {
            startTime: performance.now(),
            loadTime: 0,
            renderTime: 0,
            interactionTime: 0
        };
        
        this.init();
    }

    async init() {
        if (this.loadingPromise) {
            return this.loadingPromise;
        }

        this.loadingPromise = this.performOptimizedInit();
        return this.loadingPromise;
    }

    async performOptimizedInit() {
        try {
            // 1. 预加载关键CSS
            this.preloadCriticalCSS();
            
            // 2. 初始化性能管理器
            await this.initializePerformanceManagers();
            
            // 3. 预加载数据
            this.preloadData();
            
            // 4. 初始化核心功能
            await this.initializeCoreFeatures();
            
            // 5. 设置懒加载
            this.setupLazyLoading();
            
            // 6. 绑定事件
            this.bindOptimizedEvents();
            
            // 7. 应用布局优化
            this.applyLayoutOptimizations();
            
            this.initialized = true;
            this.recordMetric('loadTime');
            
            console.log('🚀 Smart Accounting optimized initialization completed');
            this.logPerformanceMetrics();
            
        } catch (error) {
            console.error('❌ Initialization failed:', error);
            this.fallbackToBasicMode();
        }
    }

    // 预加载关键CSS
    preloadCriticalCSS() {
        const criticalCSS = [
            'common.css',
            'project_management.css',
            'workspace.css'
        ];
        
        window.BundleManager.preloadCSS(criticalCSS);
    }

    // 初始化性能管理器
    async initializePerformanceManagers() {
        // 确保性能管理器已加载
        if (!window.BundleManager) {
            await this.loadScript('/assets/smart_accounting/js/performance/bundle-manager.js');
        }
        if (!window.DataManager) {
            await this.loadScript('/assets/smart_accounting/js/performance/data-manager.js');
        }
        if (!window.LayoutOptimizer) {
            await this.loadScript('/assets/smart_accounting/js/performance/layout-optimizer.js');
        }
        if (!window.VirtualTableManager) {
            await this.loadScript('/assets/smart_accounting/js/performance/virtual-table.js');
        }
    }

    // 预加载数据
    preloadData() {
        // 异步预加载，不阻塞主流程
        setTimeout(() => {
            window.DataManager.preloadData();
        }, 100);
    }

    // 初始化核心功能
    async initializeCoreFeatures() {
        // 只加载必需的核心模块
        await window.BundleManager.loadCoreModules();
        
        // 初始化核心管理器
        this.initializeCoreManagers();
        
        this.activeModules.add('core');
    }

    // 初始化核心管理器
    initializeCoreManagers() {
        // 使用轻量级的管理器初始化
        this.utils = window.PMUtils;
        
        // 延迟初始化其他管理器
        this.deferredManagers = [
            'tableManager',
            'filterManager', 
            'modalManager',
            'projectManager'
        ];
    }

    // 设置懒加载
    setupLazyLoading() {
        // 功能模块懒加载映射
        this.lazyFeatures = {
            'combination-view': '.pm-combination-view-btn',
            'reports': '.pm-reports-btn, .pm-advanced-filter-btn',
            'client-management': '.pm-client-selector-trigger',
            'engagement': '.pm-engagement-indicator',
            'subtasks': '.pm-subtask-toggle',
            'multiselect': '.pm-task-checkbox'
        };

        // 设置交互观察器
        this.setupInteractionObservers();
    }

    // 设置交互观察器
    setupInteractionObservers() {
        Object.entries(this.lazyFeatures).forEach(([feature, selector]) => {
            $(document).on('mouseenter focus click', selector, (e) => {
                this.loadFeatureOnDemand(feature, e);
            });
        });
    }

    // 按需加载功能
    async loadFeatureOnDemand(feature, event) {
        if (this.activeModules.has(feature)) {
            return; // 已加载
        }

        // 显示加载指示器
        this.showLoadingIndicator(event.currentTarget);
        
        try {
            await window.BundleManager.loadFeatureModule(feature);
            this.activeModules.add(feature);
            
            // 初始化功能
            this.initializeFeature(feature);
            
            this.hideLoadingIndicator(event.currentTarget);
        } catch (error) {
            console.error(`Failed to load feature ${feature}:`, error);
            this.hideLoadingIndicator(event.currentTarget);
        }
    }

    // 初始化功能
    initializeFeature(feature) {
        switch (feature) {
            case 'combination-view':
                if (window.CombinationViewManager) {
                    this.combinationViewManager = new window.CombinationViewManager();
                    this.combinationViewManager.init();
                }
                break;
            case 'reports':
                if (window.ReportsManager) {
                    this.reportsManager = new window.ReportsManager();
                }
                break;
            case 'multiselect':
                if (window.MultiSelectManager) {
                    this.multiSelectManager = new window.MultiSelectManager();
                }
                break;
            // 其他功能...
        }
    }

    // 绑定优化的事件
    bindOptimizedEvents() {
        // 使用事件委托和防抖
        this.bindDebouncedEvents();
        this.bindThrottledEvents();
        this.bindCriticalEvents();
    }

    // 防抖事件
    bindDebouncedEvents() {
        // 搜索输入防抖
        $(document).on('input', '.pm-search-input', 
            this.debounce((e) => this.handleSearch(e), 300)
        );
        
        // 窗口大小变化防抖
        $(window).on('resize', 
            this.debounce(() => this.handleResize(), 250)
        );
    }

    // 节流事件
    bindThrottledEvents() {
        // 滚动事件节流
        $('.pm-table-container').on('scroll', 
            this.throttle((e) => this.handleScroll(e), 16)
        );
    }

    // 关键事件（立即响应）
    bindCriticalEvents() {
        // 任务选择
        $(document).on('change', '.pm-task-checkbox', (e) => {
            this.handleTaskSelection(e);
        });
        
        // 状态变更
        $(document).on('click', '.pm-status-badge', (e) => {
            this.handleStatusChange(e);
        });
    }

    // 应用布局优化
    applyLayoutOptimizations() {
        const $container = $('.pm-table-container');
        if ($container.length) {
            // 观察容器大小变化
            window.LayoutOptimizer.observeElement($container[0]);
            
            // 应用初始布局
            const containerWidth = $container.width();
            const view = this.getCurrentView();
            const layout = window.LayoutOptimizer.getOptimizedLayout(view, containerWidth);
            window.LayoutOptimizer.applyLayout($container[0], layout);
        }
    }

    // 事件处理方法
    handleSearch(e) {
        const query = e.target.value.trim();
        if (query.length >= 2) {
            this.performSearch(query);
        } else if (query.length === 0) {
            this.clearSearch();
        }
    }

    handleResize() {
        // 重新计算布局
        this.applyLayoutOptimizations();
        
        // 更新虚拟表格
        const virtualTable = $('.pm-table-container').data('virtualTable');
        if (virtualTable) {
            virtualTable.updateContainerHeight();
            virtualTable.render();
        }
    }

    handleScroll(e) {
        // 虚拟滚动处理
        const virtualTable = $(e.currentTarget).data('virtualTable');
        if (virtualTable) {
            virtualTable.handleScroll();
        }
    }

    handleTaskSelection(e) {
        const $checkbox = $(e.currentTarget);
        const taskId = $checkbox.data('task-id');
        const isSelected = $checkbox.is(':checked');
        
        // 更新选择状态
        this.updateTaskSelection(taskId, isSelected);
    }

    handleStatusChange(e) {
        const $badge = $(e.currentTarget);
        const taskId = $badge.closest('.pm-task-row').data('task-id');
        
        // 显示状态菜单
        this.showStatusMenu($badge, taskId);
    }

    // 工具方法
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // 加载指示器
    showLoadingIndicator(element) {
        const $element = $(element);
        $element.addClass('pm-loading').attr('disabled', true);
        
        if (!$element.find('.pm-spinner').length) {
            $element.append('<i class="fa fa-spinner fa-spin pm-spinner"></i>');
        }
    }

    hideLoadingIndicator(element) {
        const $element = $(element);
        $element.removeClass('pm-loading').attr('disabled', false);
        $element.find('.pm-spinner').remove();
    }

    // 性能监控
    recordMetric(metricName) {
        this.performanceMetrics[metricName] = performance.now() - this.performanceMetrics.startTime;
    }

    logPerformanceMetrics() {
        console.table(this.performanceMetrics);
        
        // 发送性能数据到服务器（可选）
        if (this.performanceMetrics.loadTime > 3000) {
            console.warn('⚠️ Slow loading detected:', this.performanceMetrics.loadTime + 'ms');
        }
    }

    // 获取当前视图
    getCurrentView() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('view') || 'main';
    }

    // 加载脚本工具方法
    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // 回退到基础模式
    fallbackToBasicMode() {
        console.warn('🔄 Falling back to basic mode');
        
        // 加载原始的main.js作为备用
        this.loadScript('/assets/smart_accounting/js/main.js')
            .then(() => {
                // console.log Basic mode loaded');
            })
            .catch(error => {
                console.error('❌ Failed to load basic mode:', error);
            });
    }

    // 销毁
    destroy() {
        // 清理事件监听器
        $(document).off('.pm-optimized');
        $(window).off('.pm-optimized');
        
        // 销毁管理器
        if (window.LayoutOptimizer) {
            window.LayoutOptimizer.destroy();
        }
        if (window.DataManager) {
            window.DataManager.destroy();
        }
        if (window.BundleManager) {
            window.BundleManager.cleanup();
        }
        
        this.activeModules.clear();
    }
}

// 样式优化
const optimizedStyles = `
<style>
/* 性能优化样式 */
.pm-loading {
    opacity: 0.7;
    pointer-events: none;
}

.pm-spinner {
    margin-left: 8px;
    font-size: 12px;
}

.pm-minimal-render {
    /* 简化渲染样式 */
    transform: translateZ(0); /* 启用硬件加速 */
}

.pm-minimal-render .pm-avatar {
    background: #f0f0f0;
}

.pm-minimal-render .pm-status-badge {
    background: #e0e0e0;
    color: #666;
}

.pm-scrollable-table {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
}

.pm-virtual-table {
    height: 400px;
    overflow: auto;
}

.pm-virtual-scroll-container {
    height: 100%;
    overflow: auto;
}

.pm-virtual-viewport {
    position: relative;
}

.pm-virtual-row {
    will-change: transform;
}

/* 预加载样式 */
.pm-preload-hidden {
    opacity: 0;
    transition: opacity 0.3s ease;
}

.pm-preload-visible {
    opacity: 1;
}
</style>
`;

// 初始化
$(document).ready(function() {
    // 添加优化样式
    $('head').append(optimizedStyles);
    
    // 检查是否启用优化模式
    const urlParams = new URLSearchParams(window.location.search);
    const useOptimized = urlParams.get('optimized') !== 'false';
    
    if (useOptimized) {
        // 使用优化版本
        window.optimizedProjectManagement = new OptimizedProjectManagement();
        console.log('🚀 Using optimized Project Management');
    } else {
        // 使用原版本
        console.log('📊 Using standard Project Management');
    }
});

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OptimizedProjectManagement;
}
