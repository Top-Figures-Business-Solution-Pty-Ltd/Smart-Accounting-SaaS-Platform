// Layout Preloader - 防止CLS的布局预加载管理器
// 确保用户看到的第一个布局就是最终布局

class LayoutPreloader {
    constructor() {
        this.config = window.AppConfig;
        this.isPreloading = true;
        this.layoutCache = new Map();
        this.performanceMetrics = {
            cls: 0,
            fcp: 0,
            lcp: 0,
            loadStart: Date.now()
        };
        
        // 滚动位置管理
        this.savedScrollPosition = 0;
        this.shouldRestoreScroll = false;
        
        this.init();
    }
    
    init() {
        // 管理滚动位置
        this.setupScrollManagement();
        
        // 预加载关键布局信息
        this.preloadLayoutConfig();
        
        // 监听性能指标
        this.setupPerformanceMonitoring();
        
        // 设置布局预定义
        this.setupLayoutDimensions();
    }
    
    // 设置滚动位置管理
    setupScrollManagement() {
        // 禁用浏览器的自动滚动恢复
        if ('scrollRestoration' in history) {
            history.scrollRestoration = 'manual';
        }
        
        // 保存当前滚动位置
        this.saveScrollPosition();
        
        // 页面加载时立即滚动到顶部，防止布局变化时的位置跳跃
        window.scrollTo(0, 0);
        
        // 监听页面卸载，保存滚动位置
        window.addEventListener('beforeunload', () => {
            this.saveScrollPosition();
        });
    }
    
    // 保存滚动位置
    saveScrollPosition() {
        try {
            const scrollY = window.pageYOffset || document.documentElement.scrollTop;
            const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
            
            // 只有在用户真正滚动过的情况下才保存
            if (scrollY > 50 || scrollX > 0) {
                sessionStorage.setItem('pm_scroll_position', JSON.stringify({
                    x: scrollX,
                    y: scrollY,
                    timestamp: Date.now(),
                    url: window.location.href
                }));
                this.shouldRestoreScroll = true;
            }
        } catch (e) {
            console.warn('Could not save scroll position:', e);
        }
    }
    
    // 恢复滚动位置
    restoreScrollPosition() {
        if (!this.shouldRestoreScroll) return;
        
        try {
            const saved = sessionStorage.getItem('pm_scroll_position');
            if (!saved) return;
            
            const scrollData = JSON.parse(saved);
            
            // 检查是否是同一个页面，且时间不超过5分钟
            if (scrollData.url === window.location.href && 
                Date.now() - scrollData.timestamp < 5 * 60 * 1000) {
                
                // 等待布局稳定后再恢复滚动位置
                setTimeout(() => {
                    window.scrollTo({
                        left: scrollData.x,
                        top: scrollData.y,
                        behavior: 'smooth'
                    });
                    
                    console.log('📍 Restored scroll position:', scrollData);
                }, 500);
            }
        } catch (e) {
            console.warn('Could not restore scroll position:', e);
        }
    }
    
    // 预加载布局配置
    async preloadLayoutConfig() {
        try {
            // 从localStorage获取用户的列配置
            const savedConfig = this.loadUserLayoutConfig();
            if (savedConfig) {
                this.applyLayoutConfig(savedConfig);
                return;
            }
            
            // 如果没有保存的配置，使用默认配置
            const defaultConfig = this.getDefaultLayoutConfig();
            this.applyLayoutConfig(defaultConfig);
            
        } catch (error) {
            console.warn('Layout preload failed, using fallback:', error);
            this.applyFallbackLayout();
        }
    }
    
    // 加载用户布局配置
    loadUserLayoutConfig() {
        try {
            const currentView = this.getCurrentView();
            const cacheKey = `layout_config_${currentView}`;
            
            // 从缓存获取
            if (this.layoutCache.has(cacheKey)) {
                return this.layoutCache.get(cacheKey);
            }
            
            // 从localStorage获取
            const saved = localStorage.getItem(cacheKey);
            if (saved) {
                const config = JSON.parse(saved);
                this.layoutCache.set(cacheKey, config);
                return config;
            }
            
            return null;
        } catch (error) {
            console.warn('Failed to load user layout config:', error);
            return null;
        }
    }
    
    // 获取默认布局配置
    getDefaultLayoutConfig() {
        const defaultColumns = this.config?.getColumnConfig?.() || {};
        
        return {
            columns: {
                'select': { width: 50, visible: true, order: 0 },
                'client': { width: 200, visible: true, order: 1 },
                'task-name': { width: 250, visible: true, order: 2 },
                'entity': { width: 100, visible: true, order: 3 },
                'tf-tg': { width: 80, visible: true, order: 4 },
                'software': { width: 120, visible: true, order: 5 },
                'status': { width: 100, visible: true, order: 6 },
                'note': { width: 120, visible: false, order: 7 },
                'target-month': { width: 120, visible: true, order: 8 },
                'action-person': { width: 130, visible: true, order: 9 }
            },
            tableWidth: 1400,
            rowHeight: 48,
            headerHeight: 128
        };
    }
    
    // 应用布局配置
    applyLayoutConfig(config) {
        // 设置CSS变量
        const root = document.documentElement;
        
        // 应用列宽
        Object.entries(config.columns).forEach(([columnKey, columnConfig]) => {
            if (columnConfig.visible) {
                root.style.setProperty(`--pm-col-${columnKey}`, `${columnConfig.width}px`);
            }
        });
        
        // 应用表格尺寸
        root.style.setProperty('--pm-table-width', `${config.tableWidth}px`);
        root.style.setProperty('--pm-row-height', `${config.rowHeight}px`);
        root.style.setProperty('--pm-header-height', `${config.headerHeight}px`);
        
        // 预设表格容器尺寸
        this.presetTableDimensions(config);
    }
    
    // 预设表格尺寸
    presetTableDimensions(config) {
        const tableContainer = document.getElementById('pm-table-container');
        if (tableContainer) {
            // 设置最小宽度，防止布局闪烁
            tableContainer.style.minWidth = `${config.tableWidth}px`;
            
            // 预设高度（基于预期行数）
            const estimatedRows = this.getEstimatedRowCount();
            const estimatedHeight = config.headerHeight + (estimatedRows * config.rowHeight) + 100; // 100px padding
            tableContainer.style.minHeight = `${estimatedHeight}px`;
        }
        
        // 预设combination view容器尺寸
        const combinationContainer = document.getElementById('pm-combination-boards-container');
        if (combinationContainer) {
            // 基于预期板块数量设置高度
            const estimatedBoards = this.getEstimatedBoardCount();
            const estimatedHeight = estimatedBoards * 400 + 100; // 每个板块约400px
            combinationContainer.style.minHeight = `${estimatedHeight}px`;
        }
        
        // 预设summary尺寸
        const summary = document.querySelector('.pm-summary');
        if (summary) {
            summary.style.minHeight = '78px';
            summary.style.width = '201px';
        }
    }
    
    // 估算板块数量
    getEstimatedBoardCount() {
        const urlParams = new URLSearchParams(window.location.search);
        const view = urlParams.get('view') || 'main';
        
        if (view === 'combination') {
            // 从localStorage获取历史数据
            const historyKey = `board_count_combination`;
            const savedCount = localStorage.getItem(historyKey);
            
            if (savedCount) {
                return Math.max(parseInt(savedCount), 2); // 至少2个板块
            }
            
            return 4; // 默认4个板块
        }
        
        return 0;
    }
    
    // 估算行数
    getEstimatedRowCount() {
        // 从URL或缓存中获取预期的任务数量
        const urlParams = new URLSearchParams(window.location.search);
        const view = urlParams.get('view') || 'main';
        
        // 从localStorage获取历史数据
        const historyKey = `row_count_${view}`;
        const savedCount = localStorage.getItem(historyKey);
        
        if (savedCount) {
            return Math.max(parseInt(savedCount), 5); // 至少5行
        }
        
        // 默认估算
        return 10;
    }
    
    // 设置布局尺寸
    setupLayoutDimensions() {
        // 确保表格容器有正确的初始样式
        const style = document.createElement('style');
        style.textContent = `
            .pm-table-container.pm-loading {
                min-height: var(--pm-estimated-height, 600px);
                min-width: var(--pm-table-width, 1400px);
            }
            
            .pm-table-container .pm-table-body {
                opacity: 0;
                transition: opacity 0.3s ease-in;
            }
            
            .pm-table-container.pm-loaded .pm-table-body {
                opacity: 1;
            }
            
            /* 预定义列宽，防止重新计算 */
            .pm-header-cell, .pm-cell {
                flex-shrink: 0;
            }
            
            .pm-cell-select { width: var(--pm-col-select, 50px); }
            .pm-cell-client { width: var(--pm-col-client, 200px); }
            .pm-cell-task-name { width: var(--pm-col-task-name, 250px); }
            .pm-cell-entity { width: var(--pm-col-entity, 100px); }
            .pm-cell-tf-tg { width: var(--pm-col-tf-tg, 80px); }
            .pm-cell-software { width: var(--pm-col-software, 120px); }
            .pm-cell-status { width: var(--pm-col-status, 100px); }
            .pm-cell-note { width: var(--pm-col-note, 120px); }
            .pm-cell-target-month { width: var(--pm-col-target-month, 120px); }
            .pm-cell-action-person { width: var(--pm-col-action-person, 130px); }
        `;
        document.head.appendChild(style);
    }
    
    // 完成加载
    finishLoading() {
        const tableContainer = document.getElementById('pm-table-container');
        if (tableContainer) {
            // 平滑过渡到加载完成状态
            tableContainer.classList.remove('pm-loading');
            tableContainer.classList.add('pm-loaded');
            
            // 保存当前布局配置
            this.saveCurrentLayoutConfig();
            
            // 记录性能指标
            this.recordPerformanceMetrics();
        }
        
        // 布局完成后恢复滚动位置
        this.restoreScrollPosition();
        
        this.isPreloading = false;
    }
    
    // 保存当前布局配置
    saveCurrentLayoutConfig() {
        try {
            const currentView = this.getCurrentView();
            const config = this.extractCurrentLayoutConfig();
            
            // 保存到缓存和localStorage
            const cacheKey = `layout_config_${currentView}`;
            this.layoutCache.set(cacheKey, config);
            localStorage.setItem(cacheKey, JSON.stringify(config));
            
            // 保存行数信息
            const rowCount = document.querySelectorAll('.pm-task-row').length;
            localStorage.setItem(`row_count_${currentView}`, rowCount.toString());
            
        } catch (error) {
            console.warn('Failed to save layout config:', error);
        }
    }
    
    // 提取当前布局配置
    extractCurrentLayoutConfig() {
        const config = {
            columns: {},
            tableWidth: 0,
            rowHeight: 48,
            headerHeight: 128
        };
        
        // 提取列配置
        const headerCells = document.querySelectorAll('.pm-header-cell');
        headerCells.forEach((cell, index) => {
            const column = cell.dataset.column;
            if (column) {
                config.columns[column] = {
                    width: cell.offsetWidth,
                    visible: !cell.classList.contains('pm-hidden'),
                    order: index
                };
                config.tableWidth += cell.offsetWidth;
            }
        });
        
        return config;
    }
    
    // 获取当前视图
    getCurrentView() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('view') || 'main';
    }
    
    // 应用回退布局
    applyFallbackLayout() {
        const defaultConfig = this.getDefaultLayoutConfig();
        this.applyLayoutConfig(defaultConfig);
    }
    
    // 设置性能监控
    setupPerformanceMonitoring() {
        // 监听CLS
        if ('LayoutShift' in window) {
            new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (!entry.hadRecentInput) {
                        this.performanceMetrics.cls += entry.value;
                    }
                }
            }).observe({ entryTypes: ['layout-shift'] });
        }
        
        // 监听LCP
        if ('LargestContentfulPaint' in window) {
            new PerformanceObserver((list) => {
                const entries = list.getEntries();
                const lastEntry = entries[entries.length - 1];
                this.performanceMetrics.lcp = lastEntry.startTime;
            }).observe({ entryTypes: ['largest-contentful-paint'] });
        }
        
        // 监听FCP
        if ('PerformancePaintTiming' in window) {
            new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.name === 'first-contentful-paint') {
                        this.performanceMetrics.fcp = entry.startTime;
                    }
                }
            }).observe({ entryTypes: ['paint'] });
        }
    }
    
    // 记录性能指标
    recordPerformanceMetrics() {
        const loadTime = Date.now() - this.performanceMetrics.loadStart;
        
        console.log('📊 Layout Performance Metrics:', {
            loadTime: `${loadTime}ms`,
            cls: this.performanceMetrics.cls.toFixed(4),
            fcp: `${this.performanceMetrics.fcp.toFixed(2)}ms`,
            lcp: `${this.performanceMetrics.lcp.toFixed(2)}ms`
        });
        
        // 发送到分析服务（如果需要）
        if (window.gtag) {
            window.gtag('event', 'layout_performance', {
                'custom_parameter_1': loadTime,
                'custom_parameter_2': this.performanceMetrics.cls
            });
        }
    }
    
    // 公共API
    isLoading() {
        return this.isPreloading;
    }
    
    getPerformanceMetrics() {
        return { ...this.performanceMetrics };
    }
    
    // 强制重新加载布局
    reloadLayout() {
        const currentView = this.getCurrentView();
        const cacheKey = `layout_config_${currentView}`;
        
        // 清除缓存
        this.layoutCache.delete(cacheKey);
        localStorage.removeItem(cacheKey);
        
        // 重新加载
        this.preloadLayoutConfig();
    }
}

// 全局实例
window.LayoutPreloader = new LayoutPreloader();

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LayoutPreloader;
}
