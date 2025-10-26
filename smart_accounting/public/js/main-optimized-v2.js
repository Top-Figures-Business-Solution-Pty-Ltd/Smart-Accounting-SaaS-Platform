// Smart Accounting - 优化的主应用入口 V2
// 解决性能问题，实现智能加载和状态管理

class OptimizedProjectManagement {
    constructor() {
        // 核心配置
        this.config = window.AppConfig;
        this.moduleLoader = window.ModuleLoader;
        this.performanceMonitor = new PerformanceMonitor();
        
        // 状态管理
        this.state = {
            initialized: false,
            currentView: window.PM_CONFIG?.currentView || 'main',
            activeFeatures: new Set(),
            loadedManagers: new Map(),
            isLoading: false
        };
        
        // 管理器实例
        this.managers = {};
        
        // 事件系统
        this.eventBus = new EventBus();
        
        // 初始化
        this.init();
    }

    // 初始化应用
    async init() {
        try {
            console.log('🚀 开始初始化优化的项目管理系统...');
            this.performanceMonitor.start('app-init');
            
            // 1. 初始化核心组件
            await this.initializeCore();
            
            // 2. 根据视图类型加载对应功能
            await this.loadViewSpecificFeatures();
            
            // 3. 初始化管理器
            await this.initializeManagers();
            
            // 4. 绑定事件
            this.bindEvents();
            
            // 5. 完成初始化
            this.finishInitialization();
            
            // console.log 项目管理系统初始化完成');
            this.performanceMonitor.end('app-init');
            
        } catch (error) {
            console.error('❌ 应用初始化失败:', error);
            this.handleInitializationError(error);
        }
    }

    // 初始化核心组件
    async initializeCore() {
        this.performanceMonitor.start('core-init');
        
        // 确保核心模块已加载
        if (!this.config || !this.moduleLoader) {
            throw new Error('核心模块未正确加载');
        }
        
        // 初始化性能监控
        this.setupPerformanceMonitoring();
        
        // 初始化错误处理
        this.setupErrorHandling();
        
        this.performanceMonitor.end('core-init');
    }

    // 根据视图类型加载功能
    async loadViewSpecificFeatures() {
        this.performanceMonitor.start('feature-loading');
        
        const projectData = window.PM_CONFIG?.projectData || {};
        const features = [];
        
        if (projectData.is_combination_view) {
            features.push('combination-view');
        } else if (projectData.is_main_dashboard) {
            features.push('workspace');
        } else {
            // 标准表格视图
            features.push(
                'table-management',
                'client-management', 
                'person-management',
                'software-management'
            );
        }
        
        // 并行加载功能模块
        await Promise.all(features.map(feature => this.loadFeature(feature)));
        
        this.performanceMonitor.end('feature-loading');
    }

    // 加载功能模块
    async loadFeature(featureName) {
        if (this.state.activeFeatures.has(featureName)) {
            return; // 已加载
        }
        
        try {
            console.log(`📦 加载功能: ${featureName}`);
            await this.moduleLoader.loadFeatureModule(featureName);
            this.state.activeFeatures.add(featureName);
            
            // 触发功能加载完成事件
            this.eventBus.emit('feature-loaded', { feature: featureName });
            
        } catch (error) {
            console.error(`❌ 功能加载失败: ${featureName}`, error);
            throw error;
        }
    }

    // 初始化管理器
    async initializeManagers() {
        this.performanceMonitor.start('managers-init');
        
        // 定义管理器初始化顺序（按依赖关系）
        const managerInitOrder = [
            { name: 'utils', class: 'PMUtils', required: true },
            { name: 'tableManager', class: 'TableManager', required: true },
            { name: 'modalManager', class: 'ModalManager', required: false },
            { name: 'filterManager', class: 'FilterManager', required: false },
            { name: 'projectManager', class: 'ProjectManager', required: false },
            { name: 'engagementManager', class: 'EngagementManager', required: false },
            { name: 'editorsManager', class: 'EditorsManager', required: false },
            { name: 'personSelectorManager', class: 'PersonSelectorManager', required: false },
            { name: 'softwareSelectorManager', class: 'SoftwareSelectorManager', required: false },
            { name: 'clientManager', class: 'ClientManager', required: false },
            { name: 'workspaceManager', class: 'WorkspaceManager', required: false },
            { name: 'subtaskManager', class: 'SubtaskManager', required: false },
            { name: 'multiSelectManager', class: 'MultiSelectManager', required: false },
            { name: 'combinationViewManager', class: 'CombinationViewManager', required: false },
            { name: 'reportsManager', class: 'ReportsManager', required: false }
        ];
        
        // 按顺序初始化管理器
        for (const managerConfig of managerInitOrder) {
            await this.initializeManager(managerConfig);
        }
        
        this.performanceMonitor.end('managers-init');
    }

    // 初始化单个管理器
    async initializeManager(config) {
        const { name, class: className, required } = config;
        
        try {
            // 检查类是否存在
            if (!window[className]) {
                if (required) {
                    throw new Error(`必需的管理器类不存在: ${className}`);
                } else {
                    console.warn(`⚠️ 可选管理器类不存在: ${className}`);
                    return;
                }
            }
            
            // 创建管理器实例
            if (typeof window[className] === 'function') {
                this.managers[name] = new window[className]();
            } else {
                this.managers[name] = window[className];
            }
            
            // 记录已加载的管理器
            this.state.loadedManagers.set(name, {
                className,
                instance: this.managers[name],
                loadTime: Date.now()
            });
            
            // console.log 管理器初始化完成: ${name}`);
            
        } catch (error) {
            console.error(`❌ 管理器初始化失败: ${name}`, error);
            if (required) {
                throw error;
            }
        }
    }

    // 绑定事件
    bindEvents() {
        this.performanceMonitor.start('events-binding');
        
        // 绑定核心事件
        this.bindCoreEvents();
        
        // 绑定功能特定事件
        this.bindFeatureEvents();
        
        // 绑定性能监控事件
        this.bindPerformanceEvents();
        
        this.performanceMonitor.end('events-binding');
    }

    // 绑定核心事件
    bindCoreEvents() {
        // 窗口大小变化
        let resizeTimer = null;
        window.addEventListener('resize', () => {
            if (resizeTimer) clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                this.handleWindowResize();
            }, this.config.get('performance.debounce.resize', 100));
        });

        // 页面可见性变化
        document.addEventListener('visibilitychange', () => {
            this.handleVisibilityChange();
        });

        // 页面卸载
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });

        // 错误处理
        window.addEventListener('error', (event) => {
            this.handleGlobalError(event.error, event);
        });

        window.addEventListener('unhandledrejection', (event) => {
            this.handleGlobalError(event.reason, event);
        });
    }

    // 绑定功能特定事件
    bindFeatureEvents() {
        // 表格相关事件
        if (this.managers.tableManager) {
            this.bindTableEvents();
        }

        // 模态框相关事件
        if (this.managers.modalManager) {
            this.bindModalEvents();
        }

        // 过滤器相关事件
        if (this.managers.filterManager) {
            this.bindFilterEvents();
        }
    }

    // 绑定表格事件
    bindTableEvents() {
        // 行点击事件
        $(document).on('click', '.pm-task-row', (e) => {
            this.handleRowClick(e);
        });

        // 单元格编辑事件
        $(document).on('click', '[data-editable="true"]', (e) => {
            this.handleCellEdit(e);
        });

        // 复选框选择事件
        $(document).on('change', '.pm-task-checkbox', (e) => {
            this.handleTaskSelection(e);
        });
    }

    // 绑定模态框事件
    bindModalEvents() {
        // 模态框打开/关闭事件通过事件总线处理
        this.eventBus.on('modal:open', (data) => {
            this.handleModalOpen(data);
        });

        this.eventBus.on('modal:close', (data) => {
            this.handleModalClose(data);
        });
    }

    // 绑定过滤器事件
    bindFilterEvents() {
        // 搜索事件（防抖处理）
        let searchTimer = null;
        $(document).on('input', '#pm-search-input', (e) => {
            if (searchTimer) clearTimeout(searchTimer);
            searchTimer = setTimeout(() => {
                this.handleSearch(e.target.value);
            }, this.config.get('performance.debounce.search', 300));
        });

        // 过滤器变化事件
        this.eventBus.on('filter:change', (data) => {
            this.handleFilterChange(data);
        });
    }

    // 绑定性能监控事件
    bindPerformanceEvents() {
        // 监控长任务
        if ('PerformanceObserver' in window) {
            try {
                const observer = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (entry.duration > 50) { // 超过50ms的任务
                            console.warn(`⚠️ 长任务检测: ${entry.name} (${entry.duration.toFixed(2)}ms)`);
                        }
                    }
                });
                observer.observe({ entryTypes: ['longtask'] });
            } catch (error) {
                console.warn('性能监控初始化失败:', error);
            }
        }
    }

    // 事件处理方法
    handleRowClick(e) {
        const $row = $(e.currentTarget);
        const taskId = $row.data('task-id');
        
        // 触发行选择事件
        this.eventBus.emit('row:click', { taskId, element: $row[0] });
    }

    handleCellEdit(e) {
        e.stopPropagation();
        const $cell = $(e.currentTarget);
        const fieldType = $cell.data('field-type');
        const taskId = $cell.data('task-id');
        const fieldName = $cell.data('field');

        // 根据字段类型调用对应的编辑器
        this.openCellEditor($cell, fieldType, taskId, fieldName);
    }

    handleTaskSelection(e) {
        const $checkbox = $(e.currentTarget);
        const taskId = $checkbox.data('task-id');
        const isSelected = $checkbox.is(':checked');

        // 触发任务选择事件
        this.eventBus.emit('task:select', { taskId, selected: isSelected });
    }

    handleWindowResize() {
        // 通知所有管理器窗口大小变化
        this.eventBus.emit('window:resize', {
            width: window.innerWidth,
            height: window.innerHeight
        });
    }

    handleVisibilityChange() {
        const isVisible = !document.hidden;
        
        if (isVisible) {
            // 页面变为可见，恢复更新
            this.eventBus.emit('app:resume');
        } else {
            // 页面隐藏，暂停非必要更新
            this.eventBus.emit('app:pause');
        }
    }

    handleGlobalError(error, event) {
        console.error('❌ 全局错误:', error);
        
        // 发送错误报告
        this.eventBus.emit('error:global', { error, event });
        
        // 如果是关键错误，显示用户友好的错误信息
        if (this.isCriticalError(error)) {
            this.showErrorMessage('系统遇到错误，请刷新页面重试');
        }
    }

    // 打开单元格编辑器
    openCellEditor($cell, fieldType, taskId, fieldName) {
        const editorMap = {
            'person_selector': () => this.managers.personSelectorManager?.showMultiPersonSelector($cell, taskId, fieldName),
            'software_selector': () => this.managers.softwareSelectorManager?.showSoftwareSelector($cell, taskId, fieldName),
            'client_selector': () => this.managers.clientManager?.showClientSelector($cell, taskId, fieldName),
            'date': () => this.managers.editorsManager?.showDatePicker($cell, taskId, fieldName),
            'task_name_editor': () => this.managers.editorsManager?.showTaskNameEditor($cell),
            'text': () => this.managers.editorsManager?.makeEditable($cell[0]),
            'select': () => this.managers.editorsManager?.makeEditable($cell[0]),
            'currency': () => this.managers.editorsManager?.makeEditable($cell[0])
        };

        const editorFunction = editorMap[fieldType];
        if (editorFunction) {
            editorFunction();
        } else {
            console.warn(`⚠️ 未知的字段类型: ${fieldType}`);
        }
    }

    // 完成初始化
    finishInitialization() {
        this.state.initialized = true;
        this.state.isLoading = false;
        
        // 触发初始化完成事件
        this.eventBus.emit('app:initialized', {
            loadedFeatures: Array.from(this.state.activeFeatures),
            loadedManagers: Array.from(this.state.loadedManagers.keys()),
            performanceReport: this.performanceMonitor.getReport()
        });
        
        // 开始后台任务
        this.startBackgroundTasks();
    }

    // 开始后台任务
    startBackgroundTasks() {
        // 定期清理缓存
        setInterval(() => {
            this.cleanupCache();
        }, 5 * 60 * 1000); // 每5分钟

        // 定期检查性能
        setInterval(() => {
            this.checkPerformance();
        }, 30 * 1000); // 每30秒
    }

    // 清理缓存
    cleanupCache() {
        if (this.config && this.config.clearCache) {
            this.config.clearCache();
        }
        
        // 清理其他缓存
        Object.values(this.managers).forEach(manager => {
            if (manager && typeof manager.clearCache === 'function') {
                manager.clearCache();
            }
        });
    }

    // 检查性能
    checkPerformance() {
        const memoryInfo = performance.memory;
        if (memoryInfo) {
            const memoryUsage = memoryInfo.usedJSHeapSize / memoryInfo.totalJSHeapSize;
            if (memoryUsage > 0.8) {
                console.warn('⚠️ 内存使用率过高:', (memoryUsage * 100).toFixed(1) + '%');
                this.eventBus.emit('performance:memory-warning', { usage: memoryUsage });
            }
        }
    }

    // 判断是否为关键错误
    isCriticalError(error) {
        const criticalPatterns = [
            /network/i,
            /fetch/i,
            /timeout/i,
            /permission/i
        ];
        
        return criticalPatterns.some(pattern => pattern.test(error.message));
    }

    // 显示错误信息
    showErrorMessage(message) {
        // 这里可以集成你的通知系统
        console.error('用户错误信息:', message);
        
        // 简单的错误显示
        if (window.frappe && window.frappe.msgprint) {
            window.frappe.msgprint(message);
        } else {
            alert(message);
        }
    }

    // 处理初始化错误
    handleInitializationError(error) {
        console.error('❌ 初始化错误:', error);
        
        if (window.PM_ERROR_HANDLER) {
            window.PM_ERROR_HANDLER.show('系统初始化失败: ' + error.message, error);
        }
    }

    // 设置性能监控
    setupPerformanceMonitoring() {
        // 监控关键指标
        this.performanceMonitor.monitor('memory-usage', () => {
            return performance.memory ? performance.memory.usedJSHeapSize : 0;
        });

        this.performanceMonitor.monitor('dom-nodes', () => {
            return document.querySelectorAll('*').length;
        });
    }

    // 设置错误处理
    setupErrorHandling() {
        // 设置全局错误处理器
        this.eventBus.on('error:global', (data) => {
            // 记录错误
            console.error('全局错误记录:', data);
            
            // 可以在这里添加错误上报逻辑
        });
    }

    // 获取应用状态
    getState() {
        return {
            ...this.state,
            managers: Object.keys(this.managers),
            performance: this.performanceMonitor.getReport()
        };
    }

    // 清理资源
    cleanup() {
        console.log('🧹 清理应用资源...');
        
        // 清理管理器
        Object.values(this.managers).forEach(manager => {
            if (manager && typeof manager.cleanup === 'function') {
                manager.cleanup();
            }
        });
        
        // 清理事件监听器
        this.eventBus.removeAllListeners();
        
        // 清理性能监控
        this.performanceMonitor.cleanup();
        
        // 清理模块加载器
        if (this.moduleLoader && typeof this.moduleLoader.cleanup === 'function') {
            this.moduleLoader.cleanup();
        }
    }
}

// 简单的事件总线实现
class EventBus {
    constructor() {
        this.events = new Map();
    }

    on(event, callback) {
        if (!this.events.has(event)) {
            this.events.set(event, new Set());
        }
        this.events.get(event).add(callback);
    }

    off(event, callback) {
        if (this.events.has(event)) {
            this.events.get(event).delete(callback);
        }
    }

    emit(event, data) {
        if (this.events.has(event)) {
            this.events.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`事件处理错误 (${event}):`, error);
                }
            });
        }
    }

    removeAllListeners() {
        this.events.clear();
    }
}

// 性能监控器
class PerformanceMonitor {
    constructor() {
        this.metrics = new Map();
        this.timers = new Map();
        this.monitors = new Map();
    }

    start(name) {
        this.timers.set(name, performance.now());
    }

    end(name) {
        const startTime = this.timers.get(name);
        if (startTime) {
            const duration = performance.now() - startTime;
            this.metrics.set(name, duration);
            this.timers.delete(name);
            console.log(`⏱️ ${name}: ${duration.toFixed(2)}ms`);
            return duration;
        }
        return 0;
    }

    monitor(name, fn) {
        this.monitors.set(name, fn);
    }

    getReport() {
        const report = {
            metrics: Object.fromEntries(this.metrics),
            monitors: {}
        };

        // 收集监控数据
        this.monitors.forEach((fn, name) => {
            try {
                report.monitors[name] = fn();
            } catch (error) {
                report.monitors[name] = `Error: ${error.message}`;
            }
        });

        return report;
    }

    cleanup() {
        this.metrics.clear();
        this.timers.clear();
        this.monitors.clear();
    }
}

// 创建全局实例
window.OptimizedProjectManagement = OptimizedProjectManagement;

// 兼容性：创建旧的 ProjectManagement 类引用
window.ProjectManagement = OptimizedProjectManagement;

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OptimizedProjectManagement;
}
