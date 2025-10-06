// Progressive Enhancement - 渐进式增强和容错设计
// 确保在任何情况下都能提供基本功能

class ProgressiveEnhancement {
    constructor() {
        this.features = new Map();
        this.fallbacks = new Map();
        this.errorCount = 0;
        this.maxErrors = 5; // 最大错误次数
        
        this.init();
    }
    
    init() {
        // 检测浏览器能力
        this.detectCapabilities();
        
        // 设置错误处理
        this.setupErrorHandling();
        
        // 注册核心功能
        this.registerCoreFeatures();
        
        // 设置回退机制
        this.setupFallbacks();
    }
    
    // 检测浏览器能力
    detectCapabilities() {
        const capabilities = {
            // CSS特性检测
            cssGrid: CSS.supports('display', 'grid'),
            cssCustomProperties: CSS.supports('--test', 'value'),
            cssContainment: CSS.supports('contain', 'layout'),
            
            // JavaScript特性检测
            intersectionObserver: 'IntersectionObserver' in window,
            performanceObserver: 'PerformanceObserver' in window,
            customElements: 'customElements' in window,
            
            // 网络特性检测
            serviceWorker: 'serviceWorker' in navigator,
            networkInformation: 'connection' in navigator,
            
            // 存储特性检测
            localStorage: this.testLocalStorage(),
            indexedDB: 'indexedDB' in window,
            
            // 设备特性检测
            touchSupport: 'ontouchstart' in window,
            reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        };
        
        this.features.set('capabilities', capabilities);
        console.log('🔍 Browser Capabilities:', capabilities);
    }
    
    // 测试localStorage可用性
    testLocalStorage() {
        try {
            const test = '__test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }
    
    // 设置错误处理
    setupErrorHandling() {
        // 全局错误处理
        window.addEventListener('error', (event) => {
            this.handleError('JavaScript Error', event.error);
        });
        
        // Promise错误处理
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError('Promise Rejection', event.reason);
        });
        
        // 资源加载错误
        window.addEventListener('error', (event) => {
            if (event.target !== window) {
                this.handleError('Resource Load Error', {
                    source: event.target.src || event.target.href,
                    type: event.target.tagName
                });
            }
        }, true);
    }
    
    // 处理错误
    handleError(type, error) {
        this.errorCount++;
        
        console.warn(`⚠️ ${type}:`, error);
        
        // 如果错误过多，启用安全模式
        if (this.errorCount >= this.maxErrors) {
            this.enableSafeMode();
        }
        
        // 尝试恢复
        this.attemptRecovery(type, error);
    }
    
    // 启用安全模式
    enableSafeMode() {
        console.warn('🛡️ Enabling Safe Mode due to multiple errors');
        
        // 禁用非关键功能
        this.disableNonEssentialFeatures();
        
        // 显示用户通知
        this.showSafeModeNotification();
        
        // 使用最基本的布局
        this.applyBasicLayout();
    }
    
    // 禁用非关键功能
    disableNonEssentialFeatures() {
        const nonEssential = [
            'animations',
            'virtualScrolling',
            'advancedFilters',
            'realTimeUpdates'
        ];
        
        nonEssential.forEach(feature => {
            this.features.set(feature, false);
        });
        
        // 添加安全模式类
        document.body.classList.add('pm-safe-mode');
    }
    
    // 显示安全模式通知
    showSafeModeNotification() {
        const notification = document.createElement('div');
        notification.className = 'pm-safe-mode-notification';
        notification.innerHTML = `
            <div class="pm-notification-content">
                <i class="fa fa-shield"></i>
                <span>Safe mode enabled. Some features may be limited.</span>
                <button class="pm-notification-close" onclick="this.parentElement.parentElement.remove()">
                    <i class="fa fa-times"></i>
                </button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // 自动移除通知
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 10000);
    }
    
    // 应用基本布局
    applyBasicLayout() {
        const style = document.createElement('style');
        style.textContent = `
            .pm-safe-mode .pm-table-container {
                display: block !important;
                overflow: auto !important;
            }
            
            .pm-safe-mode .pm-task-row {
                display: block !important;
                border-bottom: 1px solid #ddd !important;
                padding: 10px !important;
                margin-bottom: 5px !important;
            }
            
            .pm-safe-mode .pm-cell {
                display: inline-block !important;
                margin-right: 10px !important;
                margin-bottom: 5px !important;
            }
            
            .pm-safe-mode [class*="pm-skeleton-"] {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
    }
    
    // 尝试恢复
    attemptRecovery(type, error) {
        switch (type) {
            case 'JavaScript Error':
                this.recoverFromJSError(error);
                break;
            case 'Resource Load Error':
                this.recoverFromResourceError(error);
                break;
            case 'Promise Rejection':
                this.recoverFromPromiseError(error);
                break;
        }
    }
    
    // 从JavaScript错误恢复
    recoverFromJSError(error) {
        // 重新初始化关键组件
        setTimeout(() => {
            try {
                if (window.ProjectManagement && !window.pm) {
                    window.pm = new ProjectManagement();
                }
            } catch (e) {
                console.warn('Failed to recover from JS error:', e);
            }
        }, 1000);
    }
    
    // 从资源加载错误恢复
    recoverFromResourceError(error) {
        if (error.type === 'SCRIPT') {
            // 尝试从CDN加载备用脚本
            this.loadFallbackScript(error.source);
        } else if (error.type === 'LINK') {
            // 尝试加载备用样式
            this.loadFallbackStyle(error.source);
        }
    }
    
    // 从Promise错误恢复
    recoverFromPromiseError(error) {
        // 重置相关状态
        if (window.LayoutPreloader) {
            window.LayoutPreloader.finishLoading();
        }
    }
    
    // 注册核心功能
    registerCoreFeatures() {
        const coreFeatures = {
            tableDisplay: this.testTableDisplay.bind(this),
            dataLoading: this.testDataLoading.bind(this),
            userInteraction: this.testUserInteraction.bind(this),
            layoutStability: this.testLayoutStability.bind(this)
        };
        
        Object.entries(coreFeatures).forEach(([name, test]) => {
            try {
                this.features.set(name, test());
            } catch (e) {
                console.warn(`Feature test failed for ${name}:`, e);
                this.features.set(name, false);
            }
        });
    }
    
    // 测试表格显示
    testTableDisplay() {
        const testElement = document.createElement('div');
        testElement.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr;';
        document.body.appendChild(testElement);
        
        const supportsGrid = getComputedStyle(testElement).display === 'grid';
        document.body.removeChild(testElement);
        
        return supportsGrid;
    }
    
    // 测试数据加载
    testDataLoading() {
        return typeof fetch === 'function' && typeof Promise === 'function';
    }
    
    // 测试用户交互
    testUserInteraction() {
        return 'addEventListener' in document;
    }
    
    // 测试布局稳定性
    testLayoutStability() {
        return this.features.get('capabilities')?.cssCustomProperties && 
               this.features.get('capabilities')?.cssGrid;
    }
    
    // 设置回退机制
    setupFallbacks() {
        // 表格显示回退
        if (!this.features.get('tableDisplay')) {
            this.fallbacks.set('tableDisplay', this.useFlexboxTable.bind(this));
        }
        
        // 数据加载回退
        if (!this.features.get('dataLoading')) {
            this.fallbacks.set('dataLoading', this.useXHR.bind(this));
        }
        
        // 布局稳定性回退
        if (!this.features.get('layoutStability')) {
            this.fallbacks.set('layoutStability', this.useFixedLayout.bind(this));
        }
    }
    
    // 使用Flexbox表格
    useFlexboxTable() {
        const style = document.createElement('style');
        style.textContent = `
            .pm-project-table-header,
            .pm-task-row {
                display: flex !important;
            }
            
            .pm-header-cell,
            .pm-cell {
                flex: 1 1 auto;
                min-width: 100px;
            }
        `;
        document.head.appendChild(style);
    }
    
    // 使用XHR代替fetch
    useXHR() {
        if (!window.fetch) {
            window.fetch = function(url, options = {}) {
                return new Promise((resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    xhr.open(options.method || 'GET', url);
                    
                    if (options.headers) {
                        Object.entries(options.headers).forEach(([key, value]) => {
                            xhr.setRequestHeader(key, value);
                        });
                    }
                    
                    xhr.onload = () => {
                        resolve({
                            ok: xhr.status >= 200 && xhr.status < 300,
                            status: xhr.status,
                            json: () => Promise.resolve(JSON.parse(xhr.responseText)),
                            text: () => Promise.resolve(xhr.responseText)
                        });
                    };
                    
                    xhr.onerror = () => reject(new Error('Network error'));
                    xhr.send(options.body);
                });
            };
        }
    }
    
    // 使用固定布局
    useFixedLayout() {
        const style = document.createElement('style');
        style.textContent = `
            .pm-table-container {
                width: 1400px;
                overflow-x: auto;
            }
            
            .pm-header-cell,
            .pm-cell {
                width: 120px;
                flex-shrink: 0;
            }
            
            .pm-cell-select { width: 50px; }
            .pm-cell-client { width: 200px; }
            .pm-cell-task-name { width: 250px; }
        `;
        document.head.appendChild(style);
    }
    
    // 公共API
    isFeatureSupported(featureName) {
        return this.features.get(featureName) === true;
    }
    
    enableFallback(featureName) {
        const fallback = this.fallbacks.get(featureName);
        if (fallback) {
            fallback();
            return true;
        }
        return false;
    }
    
    getCapabilities() {
        return this.features.get('capabilities');
    }
    
    isSafeMode() {
        return document.body.classList.contains('pm-safe-mode');
    }
}

// 全局实例
window.ProgressiveEnhancement = new ProgressiveEnhancement();

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProgressiveEnhancement;
}
