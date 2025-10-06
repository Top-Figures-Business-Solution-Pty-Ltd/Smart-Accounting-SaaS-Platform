// Smart Accounting - Data Manager
// 统一数据管理，缓存和状态同步

class DataManager {
    constructor() {
        this.cache = new Map();
        this.subscribers = new Map();
        this.apiQueue = [];
        this.isProcessingQueue = false;
        this.batchTimeout = null;
        
        // 配置缓存策略
        this.cacheConfig = {
            tasks: { ttl: 5 * 60 * 1000 }, // 5分钟
            users: { ttl: 30 * 60 * 1000 }, // 30分钟
            clients: { ttl: 15 * 60 * 1000 }, // 15分钟
            projects: { ttl: 10 * 60 * 1000 } // 10分钟
        };
    }

    // 获取数据（带缓存）
    async getData(key, fetcher, options = {}) {
        const cacheKey = this.getCacheKey(key, options);
        const cached = this.getFromCache(cacheKey);
        
        if (cached && !this.isCacheExpired(cached)) {
            return cached.data;
        }

        // 如果正在获取相同数据，返回相同的Promise
        if (this.cache.has(`loading_${cacheKey}`)) {
            return this.cache.get(`loading_${cacheKey}`);
        }

        const promise = this.fetchAndCache(cacheKey, fetcher, options);
        this.cache.set(`loading_${cacheKey}`, promise);
        
        try {
            const data = await promise;
            this.cache.delete(`loading_${cacheKey}`);
            return data;
        } catch (error) {
            this.cache.delete(`loading_${cacheKey}`);
            throw error;
        }
    }

    // 批量API调用
    batchApiCall(method, args) {
        return new Promise((resolve, reject) => {
            this.apiQueue.push({ method, args, resolve, reject });
            
            // 延迟处理，允许批量合并
            clearTimeout(this.batchTimeout);
            this.batchTimeout = setTimeout(() => {
                this.processBatchQueue();
            }, 50); // 50ms内的请求会被批量处理
        });
    }

    // 处理批量队列
    async processBatchQueue() {
        if (this.isProcessingQueue || this.apiQueue.length === 0) {
            return;
        }

        this.isProcessingQueue = true;
        const currentQueue = [...this.apiQueue];
        this.apiQueue = [];

        // 按方法分组
        const groupedCalls = this.groupApiCalls(currentQueue);
        
        // 并行处理不同类型的调用
        const promises = Object.entries(groupedCalls).map(([method, calls]) => {
            return this.processBatchMethod(method, calls);
        });

        try {
            await Promise.all(promises);
        } catch (error) {
            console.error('Batch API processing error:', error);
        } finally {
            this.isProcessingQueue = false;
            
            // 如果队列中还有新的请求，继续处理
            if (this.apiQueue.length > 0) {
                setTimeout(() => this.processBatchQueue(), 10);
            }
        }
    }

    // 分组API调用
    groupApiCalls(calls) {
        const groups = {};
        calls.forEach(call => {
            if (!groups[call.method]) {
                groups[call.method] = [];
            }
            groups[call.method].push(call);
        });
        return groups;
    }

    // 处理批量方法调用
    async processBatchMethod(method, calls) {
        if (calls.length === 1) {
            // 单个调用直接处理
            const call = calls[0];
            try {
                const result = await frappe.call({
                    method: call.method,
                    args: call.args
                });
                call.resolve(result);
            } catch (error) {
                call.reject(error);
            }
            return;
        }

        // 批量调用
        try {
            const batchArgs = calls.map(call => call.args);
            const result = await frappe.call({
                method: `${method}_batch`,
                args: { batch_args: batchArgs }
            });

            // 分发结果
            if (result.message && Array.isArray(result.message)) {
                result.message.forEach((res, index) => {
                    if (calls[index]) {
                        calls[index].resolve({ message: res });
                    }
                });
            } else {
                // 如果批量方法不存在，回退到单个调用
                await Promise.all(calls.map(call => 
                    this.processBatchMethod(method, [call])
                ));
            }
        } catch (error) {
            // 批量失败时，尝试单个调用
            await Promise.all(calls.map(call => 
                this.processBatchMethod(method, [call])
            ));
        }
    }

    // 订阅数据变化
    subscribe(key, callback) {
        if (!this.subscribers.has(key)) {
            this.subscribers.set(key, new Set());
        }
        this.subscribers.get(key).add(callback);
        
        // 返回取消订阅函数
        return () => {
            const subs = this.subscribers.get(key);
            if (subs) {
                subs.delete(callback);
                if (subs.size === 0) {
                    this.subscribers.delete(key);
                }
            }
        };
    }

    // 通知订阅者
    notify(key, data) {
        const subscribers = this.subscribers.get(key);
        if (subscribers) {
            subscribers.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('Subscriber callback error:', error);
                }
            });
        }
    }

    // 更新缓存并通知
    updateCache(key, data, options = {}) {
        const cacheKey = this.getCacheKey(key, options);
        this.setCache(cacheKey, data);
        this.notify(key, data);
    }

    // 缓存相关方法
    getCacheKey(key, options) {
        const optionsStr = Object.keys(options).length > 0 ? 
            JSON.stringify(options) : '';
        return `${key}${optionsStr}`;
    }

    getFromCache(key) {
        return this.cache.get(key);
    }

    setCache(key, data) {
        const keyType = key.split('_')[0];
        const config = this.cacheConfig[keyType] || { ttl: 5 * 60 * 1000 };
        
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl: config.ttl
        });
    }

    isCacheExpired(cached) {
        return Date.now() - cached.timestamp > cached.ttl;
    }

    async fetchAndCache(key, fetcher, options) {
        const data = await fetcher();
        this.setCache(key, data);
        return data;
    }

    // 清理过期缓存
    cleanupCache() {
        const now = Date.now();
        const toDelete = [];
        
        this.cache.forEach((value, key) => {
            if (key.startsWith('loading_')) return;
            
            if (value.timestamp && now - value.timestamp > value.ttl) {
                toDelete.push(key);
            }
        });
        
        toDelete.forEach(key => this.cache.delete(key));
    }

    // 预加载数据
    async preloadData() {
        const preloadTasks = [
            this.getData('users', () => this.fetchUsers()),
            this.getData('clients', () => this.fetchClients()),
            this.getData('status_options', () => this.fetchStatusOptions())
        ];

        try {
            await Promise.all(preloadTasks);
        } catch (error) {
            console.warn('Preload data error:', error);
        }
    }

    // 数据获取方法
    async fetchUsers() {
        const response = await frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'User',
                fields: ['name', 'full_name', 'user_image'],
                filters: { enabled: 1 },
                limit_page_length: 100
            }
        });
        return response.message || [];
    }

    async fetchClients() {
        const response = await frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'Customer',
                fields: ['name', 'customer_name'],
                limit_page_length: 200
            }
        });
        return response.message || [];
    }

    async fetchStatusOptions() {
        const response = await frappe.call({
            method: 'smart_accounting.www.project_management.index.get_status_options'
        });
        return response.message || [];
    }

    // 销毁
    destroy() {
        clearTimeout(this.batchTimeout);
        this.cache.clear();
        this.subscribers.clear();
        this.apiQueue = [];
    }
}

// 全局实例
window.DataManager = new DataManager();

// 启动缓存清理定时器
setInterval(() => {
    window.DataManager.cleanupCache();
}, 5 * 60 * 1000); // 每5分钟清理一次

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataManager;
}
