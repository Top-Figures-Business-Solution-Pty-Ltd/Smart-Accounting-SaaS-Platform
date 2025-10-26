// Smart Accounting - Optimized Module Loader
// Solves script loading performance issues with on-demand loading and priority management

class ModuleLoader {
    constructor() {
        this.loadedModules = new Set();
        this.loadingPromises = new Map();
        this.moduleCache = new Map();
        this.criticalModules = ['utils', 'column-config', 'ui/table', 'ui/modal'];
        this.featureModules = {
            'table-management': ['ui/table', 'ui/drag-manager'],
            'client-management': ['client-management', 'client-selector'],
            'person-management': ['person-selector'],
            'software-management': ['software-selector'],
            'reports': ['reports', 'ui/filters'],
            'engagement': ['engagement'],
            'subtasks': ['subtask'],
            'multiselect': ['multiselect'],
            'combination-view': ['combination-view'],
            'workspace': ['workspace']
        };
        this.moduleConfig = this.getModuleConfiguration();
    }

    // Get module configuration (avoid hardcoding)
    getModuleConfiguration() {
        return {
            // Core modules - load immediately
            core: {
                'utils': { priority: 1, size: 'small' },
                'column-config': { priority: 1, size: 'small' },
                'ui/table': { priority: 2, size: 'large' },
                'ui/modal': { priority: 2, size: 'medium' }
            },
            // Feature modules - load on demand
            features: {
                'client-management': { priority: 3, size: 'medium', dependencies: ['client-selector'] },
                'person-selector': { priority: 3, size: 'small' },
                'software-selector': { priority: 3, size: 'small' },
                'reports': { priority: 4, size: 'large', dependencies: ['ui/filters'] },
                'engagement': { priority: 4, size: 'medium' },
                'subtask': { priority: 4, size: 'small' },
                'multiselect': { priority: 4, size: 'small' },
                'combination-view': { priority: 5, size: 'large' },
                'workspace': { priority: 3, size: 'medium' }
            }
        };
    }

    // Preload critical modules
    async preloadCriticalModules() {
        console.log('🚀 Starting critical module preload...');
        const startTime = performance.now();
        
        try {
            // Load core modules in parallel
            const corePromises = this.criticalModules.map(module => this.loadModule(module));
            await Promise.all(corePromises);
            
            const loadTime = performance.now() - startTime;
            // console.log Critical modules loaded in: ${loadTime.toFixed(2)}ms`);
            
            // Trigger core modules ready event
            this.dispatchEvent('core-modules-ready');
            
        } catch (error) {
            console.error('❌ Critical module loading failed:', error);
            throw error;
        }
    }

    // Load feature modules on demand
    async loadFeatureModule(featureName) {
        if (!this.featureModules[featureName]) {
            console.warn(`⚠️ Unknown feature module: ${featureName}`);
            return;
        }

        console.log(`📦 Loading feature module: ${featureName}`);
        const modules = this.featureModules[featureName];
        
        try {
            const promises = modules.map(module => this.loadModule(module));
            await Promise.all(promises);
            
            // console.log Feature module ${featureName} loaded successfully`);
            this.dispatchEvent('feature-module-ready', { feature: featureName });
            
        } catch (error) {
            console.error(`❌ Feature module ${featureName} loading failed:`, error);
            throw error;
        }
    }

    // Smart module loading
    async loadModule(moduleName) {
        // Check if already loaded
        if (this.loadedModules.has(moduleName)) {
            return Promise.resolve();
        }

        // Check if currently loading
        if (this.loadingPromises.has(moduleName)) {
            return this.loadingPromises.get(moduleName);
        }

        console.log(`📥 Loading module: ${moduleName}`);
        
        const promise = this._loadModuleScript(moduleName);
        this.loadingPromises.set(moduleName, promise);
        
        try {
            await promise;
            this.loadedModules.add(moduleName);
            this.loadingPromises.delete(moduleName);
            
            // console.log Module loaded successfully: ${moduleName}`);
            
        } catch (error) {
            this.loadingPromises.delete(moduleName);
            console.error(`❌ Module loading failed: ${moduleName}`, error);
            throw error;
        }

        return promise;
    }

    // Internal method: load script file
    _loadModuleScript(moduleName) {
        return new Promise((resolve, reject) => {
            // Check cache
            if (this.moduleCache.has(moduleName)) {
                resolve(this.moduleCache.get(moduleName));
                return;
            }

            const script = document.createElement('script');
            script.src = `/assets/smart_accounting/js/${moduleName}.js`;
            script.async = true; // Async loading
            
            script.onload = () => {
                this.moduleCache.set(moduleName, true);
                resolve();
            };
            
            script.onerror = (error) => {
                console.error(`Script loading failed: ${script.src}`, error);
                reject(new Error(`Failed to load module: ${moduleName}`));
            };
            
            // Use requestIdleCallback to optimize loading timing
            if (window.requestIdleCallback) {
                window.requestIdleCallback(() => {
                    document.head.appendChild(script);
                });
            } else {
                document.head.appendChild(script);
            }
        });
    }

    // Preload CSS resources
    preloadCSS(cssFiles) {
        console.log('🎨 Preloading CSS resources...');
        
        cssFiles.forEach(cssFile => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'style';
            link.href = `/assets/smart_accounting/css/${cssFile}`;
            
            link.onload = () => {
                // Convert to actual stylesheet after preload
                link.rel = 'stylesheet';
            };
            
            document.head.appendChild(link);
        });
    }

    // Get module loading status
    getLoadingStatus() {
        return {
            loaded: Array.from(this.loadedModules),
            loading: Array.from(this.loadingPromises.keys()),
            total: Object.keys(this.moduleConfig.core).length + Object.keys(this.moduleConfig.features).length
        };
    }

    // Clean up resources
    cleanup() {
        console.log('🧹 Cleaning up module loader resources...');
        
        // Clear loading promises
        this.loadingPromises.clear();
        
        // Clear cache
        this.moduleCache.clear();
        
        // Remove event listeners
        this._removeEventListeners();
    }

    // Event dispatch
    dispatchEvent(eventName, data = {}) {
        const event = new CustomEvent(`module-loader:${eventName}`, {
            detail: data
        });
        document.dispatchEvent(event);
    }

    // Remove event listeners
    _removeEventListeners() {
        // Clean up all module loader related event listeners
        const events = ['core-modules-ready', 'feature-module-ready'];
        events.forEach(eventName => {
            document.removeEventListener(`module-loader:${eventName}`, this._handleEvent);
        });
    }
}

// Create global instance
window.ModuleLoader = new ModuleLoader();

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModuleLoader;
}
