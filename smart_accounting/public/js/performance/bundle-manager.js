// Smart Accounting - Bundle Manager
// 统一资源管理和懒加载

class BundleManager {
    constructor() {
        this.loadedModules = new Set();
        this.loadingPromises = new Map();
        this.cssCache = new Map();
    }

    // 动态加载模块
    async loadModule(moduleName) {
        if (this.loadedModules.has(moduleName)) {
            return Promise.resolve();
        }

        if (this.loadingPromises.has(moduleName)) {
            return this.loadingPromises.get(moduleName);
        }

        const promise = this._loadModuleScript(moduleName);
        this.loadingPromises.set(moduleName, promise);
        
        try {
            await promise;
            this.loadedModules.add(moduleName);
            this.loadingPromises.delete(moduleName);
        } catch (error) {
            this.loadingPromises.delete(moduleName);
            throw error;
        }

        return promise;
    }

    // 批量加载核心模块
    async loadCoreModules() {
        const coreModules = [
            'utils',
            'column-config', 
            'ui/table',
            'ui/modal'
        ];

        return Promise.all(coreModules.map(module => this.loadModule(module)));
    }

    // 懒加载功能模块
    async loadFeatureModule(feature) {
        const featureModules = {
            'combination-view': ['combination-view'],
            'reports': ['reports', 'ui/filters'],
            'client-management': ['client-management', 'client-selector'],
            'engagement': ['engagement'],
            'subtasks': ['subtask'],
            'multiselect': ['multiselect']
        };

        const modules = featureModules[feature] || [];
        return Promise.all(modules.map(module => this.loadModule(module)));
    }

    // 预加载CSS
    preloadCSS(cssFiles) {
        cssFiles.forEach(cssFile => {
            if (!this.cssCache.has(cssFile)) {
                const link = document.createElement('link');
                link.rel = 'preload';
                link.as = 'style';
                link.href = `/assets/smart_accounting/css/${cssFile}`;
                link.onload = () => {
                    link.rel = 'stylesheet';
                    this.cssCache.set(cssFile, true);
                };
                document.head.appendChild(link);
            }
        });
    }

    // 内部方法：加载脚本
    _loadModuleScript(moduleName) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = `/assets/smart_accounting/js/${moduleName}.js`;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // 清理未使用的模块
    cleanup() {
        // 移除不必要的事件监听器
        $(document).off('.pm-cleanup');
        
        // 清理定时器
        this._clearTimers();
    }

    _clearTimers() {
        // 清理所有项目相关的定时器
        for (let i = 1; i < 99999; i++) {
            window.clearTimeout(i);
            window.clearInterval(i);
        }
    }
}

// 全局实例
window.BundleManager = new BundleManager();

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BundleManager;
}
