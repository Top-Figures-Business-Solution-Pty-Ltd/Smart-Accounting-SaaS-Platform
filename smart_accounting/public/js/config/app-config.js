// Smart Accounting - Application Configuration Manager
// Centralized configuration management to avoid hardcoding and improve maintainability

class AppConfigManager {
    constructor() {
        this.config = this.initializeConfig();
        this.cache = new Map();
        this.observers = new Map();
    }

    // Initialize configuration
    initializeConfig() {
        return {
            // Table column configuration
            columns: {
                // Default visible columns
                defaultVisible: [
                    'select', 'client', 'task-name', 'entity', 'tf-tg', 
                    'software', 'status', 'target-month', 'action-person'
                ],
                
                // 所有可用列定义
                definitions: {
                    'select': { 
                        label: 'Select', 
                        width: 50, 
                        resizable: false, 
                        sortable: false,
                        type: 'checkbox'
                    },
                    'client': { 
                        label: 'Client Name', 
                        width: 200, 
                        resizable: true, 
                        sortable: true,
                        type: 'client_selector'
                    },
                    'task-name': { 
                        label: 'Task Name', 
                        width: 250, 
                        resizable: true, 
                        sortable: true,
                        type: 'task_name_editor'
                    },
                    'entity': { 
                        label: 'Entity', 
                        width: 100, 
                        resizable: true, 
                        sortable: true,
                        type: 'badge'
                    },
                    'tf-tg': { 
                        label: 'TF/TG', 
                        width: 80, 
                        resizable: true, 
                        sortable: true,
                        type: 'select',
                        options: ['TF', 'TG'],
                        backendOptions: ['Top Figures', 'Top Grants']
                    },
                    'software': { 
                        label: 'Software', 
                        width: 150, 
                        resizable: true, 
                        sortable: true,
                        type: 'software_selector'
                    },
                    'status': { 
                        label: 'Status', 
                        width: 120, 
                        resizable: true, 
                        sortable: true,
                        type: 'status_badge'
                    },
                    'note': { 
                        label: 'Note', 
                        width: 200, 
                        resizable: true, 
                        sortable: false,
                        type: 'text'
                    },
                    'target-month': { 
                        label: 'Target Month', 
                        width: 120, 
                        resizable: true, 
                        sortable: true,
                        type: 'select',
                        options: [
                            'January', 'February', 'March', 'April', 'May', 'June',
                            'July', 'August', 'September', 'October', 'November', 'December'
                        ]
                    },
                    'budget': { 
                        label: 'Budget', 
                        width: 100, 
                        resizable: true, 
                        sortable: true,
                        type: 'currency'
                    },
                    'actual': { 
                        label: 'Actual', 
                        width: 100, 
                        resizable: true, 
                        sortable: true,
                        type: 'currency'
                    },
                    'review-note': { 
                        label: 'Review Note', 
                        width: 120, 
                        resizable: true, 
                        sortable: false,
                        type: 'review_indicator'
                    },
                    'action-person': { 
                        label: 'Action Person', 
                        width: 120, 
                        resizable: true, 
                        sortable: true,
                        type: 'person_selector',
                        roleFilter: 'Action Person'
                    },
                    'preparer': { 
                        label: 'Preparer', 
                        width: 120, 
                        resizable: true, 
                        sortable: true,
                        type: 'person_selector',
                        roleFilter: 'Preparer'
                    },
                    'reviewer': { 
                        label: 'Reviewer', 
                        width: 120, 
                        resizable: true, 
                        sortable: true,
                        type: 'person_selector',
                        roleFilter: 'Reviewer'
                    },
                    'partner': { 
                        label: 'Partner', 
                        width: 120, 
                        resizable: true, 
                        sortable: true,
                        type: 'person_selector',
                        roleFilter: 'Partner'
                    },
                    'lodgment-due': { 
                        label: 'Lodgement Due', 
                        width: 120, 
                        resizable: true, 
                        sortable: true,
                        type: 'date'
                    },
                    'engagement': { 
                        label: 'Engagement', 
                        width: 120, 
                        resizable: true, 
                        sortable: false,
                        type: 'engagement_indicator'
                    },
                    'group': { 
                        label: 'Group', 
                        width: 100, 
                        resizable: true, 
                        sortable: true,
                        type: 'text'
                    },
                    'year-end': { 
                        label: 'Year End', 
                        width: 100, 
                        resizable: true, 
                        sortable: true,
                        type: 'select',
                        options: [
                            'January', 'February', 'March', 'April', 'May', 'June',
                            'July', 'August', 'September', 'October', 'November', 'December'
                        ]
                    },
                    'last-updated': { 
                        label: 'Last Updated', 
                        width: 120, 
                        resizable: true, 
                        sortable: true,
                        type: 'datetime'
                    },
                    'priority': { 
                        label: 'Priority', 
                        width: 100, 
                        resizable: true, 
                        sortable: true,
                        type: 'priority_badge'
                    },
                    'frequency': { 
                        label: 'Frequency', 
                        width: 100, 
                        resizable: true, 
                        sortable: true,
                        type: 'select',
                        optionsSource: 'custom_frequency'
                    },
                    'reset-date': { 
                        label: 'Reset Date', 
                        width: 120, 
                        resizable: true, 
                        sortable: true,
                        type: 'date'
                    }
                }
            },

            // 状态配置
            statuses: {
                options: [
                    { value: 'open', label: 'Open', color: '#0073ea', icon: 'fa-circle-o' },
                    { value: 'in-progress', label: 'In Progress', color: '#ffcb00', icon: 'fa-clock-o' },
                    { value: 'review', label: 'Review', color: '#ff5ac4', icon: 'fa-eye' },
                    { value: 'completed', label: 'Completed', color: '#00c875', icon: 'fa-check-circle' },
                    { value: 'on-hold', label: 'On Hold', color: '#a25ddc', icon: 'fa-pause' },
                    { value: 'cancelled', label: 'Cancelled', color: '#bb3354', icon: 'fa-times-circle' }
                ],
                default: 'open'
            },

            // 优先级配置
            priorities: {
                options: [
                    { value: 'low', label: 'Low', color: '#9cd326', icon: 'fa-arrow-down' },
                    { value: 'medium', label: 'Medium', color: '#ffcb00', icon: 'fa-minus' },
                    { value: 'high', label: 'High', color: '#ff642e', icon: 'fa-arrow-up' },
                    { value: 'urgent', label: 'Urgent', color: '#bb3354', icon: 'fa-exclamation' }
                ],
                default: 'medium'
            },

            // 实体类型配置
            entityTypes: {
                options: [
                    { value: 'company', label: 'Company', icon: 'fa-building' },
                    { value: 'individual', label: 'Individual', icon: 'fa-user' },
                    { value: 'trust', label: 'Trust', icon: 'fa-shield' },
                    { value: 'partnership', label: 'Partnership', icon: 'fa-handshake-o' },
                    { value: 'smsf', label: 'SMSF', icon: 'fa-university' }
                ],
                default: 'company'
            },

            // 性能配置
            performance: {
                // 虚拟滚动配置
                virtualScrolling: {
                    enabled: true,
                    rowHeight: 48,
                    bufferSize: 10,
                    threshold: 100 // 超过100行启用虚拟滚动
                },
                
                // 懒加载配置
                lazyLoading: {
                    enabled: true,
                    chunkSize: 50,
                    preloadChunks: 2
                },
                
                // 缓存配置
                cache: {
                    enabled: true,
                    maxAge: 5 * 60 * 1000, // 5分钟
                    maxSize: 100 // 最大缓存条目数
                },
                
                // 防抖配置
                debounce: {
                    search: 300,
                    resize: 100,
                    save: 1000
                }
            },
            
            // 角色映射配置 - 避免硬编码
            roles: {
                // Frontend field names to backend role values mapping
                fieldToRoleMapping: {
                    'action_person': 'Action Person',
                    'preparer': 'Preparer',
                    'reviewer': 'Reviewer',
                    'partner': 'Partner',
                    'roles': 'Owner'  // Handle generic roles field for Owner
                },
                
                // Backend role values to frontend field names mapping
                roleToFieldMapping: {
                    'Action Person': 'action_person',
                    'Preparer': 'preparer',
                    'Reviewer': 'reviewer',
                    'Partner': 'partner',
                    'Owner': 'roles'
                }
            },

            // UI 配置
            ui: {
                // 动画配置
                animations: {
                    enabled: true,
                    duration: 200,
                    easing: 'ease-in-out'
                },
                
                // 主题配置
                theme: {
                    primaryColor: '#0073ea',
                    successColor: '#00c875',
                    warningColor: '#ffcb00',
                    errorColor: '#bb3354',
                    borderRadius: '4px'
                }
            },

            // API 配置
            api: {
                endpoints: {
                    tasks: '/api/method/smart_accounting.www.project_management.index.get_project_management_data',
                    updateTask: '/api/method/smart_accounting.www.project_management.index.update_task_field',
                    createTask: '/api/method/smart_accounting.www.project_management.index.create_task',
                    deleteTask: '/api/method/smart_accounting.www.project_management.index.delete_task',
                    clients: '/api/method/smart_accounting.www.project_management.index.get_clients',
                    users: '/api/method/smart_accounting.www.project_management.index.get_users',
                    software: '/api/method/smart_accounting.www.project_management.index.get_software_options'
                },
                timeout: 30000,
                retries: 3
            }
        };
    }

    // 获取配置值
    get(path, defaultValue = null) {
        const keys = path.split('.');
        let value = this.config;
        
        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return defaultValue;
            }
        }
        
        return value;
    }

    // 设置配置值
    set(path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        let target = this.config;
        
        for (const key of keys) {
            if (!(key in target) || typeof target[key] !== 'object') {
                target[key] = {};
            }
            target = target[key];
        }
        
        const oldValue = target[lastKey];
        target[lastKey] = value;
        
        // 通知观察者
        this.notifyObservers(path, value, oldValue);
        
        // 清除相关缓存
        this.clearCache(path);
    }

    // 获取列配置
    getColumnConfig(columnKey) {
        return this.get(`columns.definitions.${columnKey}`);
    }

    // 获取所有列配置
    getAllColumns() {
        return this.get('columns.definitions', {});
    }

    // 获取默认可见列
    getDefaultVisibleColumns() {
        return this.get('columns.defaultVisible', []);
    }

    // 获取状态选项
    getStatusOptions() {
        return this.get('statuses.options', []);
    }

    // 获取优先级选项
    getPriorityOptions() {
        return this.get('priorities.options', []);
    }

    // 获取实体类型选项
    getEntityTypeOptions() {
        return this.get('entityTypes.options', []);
    }

    // 获取性能配置
    getPerformanceConfig() {
        return this.get('performance', {});
    }
    
    // Get role mapping configuration
    getRoleMapping() {
        return this.get('roles', {});
    }
    
    // Map frontend field name to backend role value
    mapFieldToRole(fieldName) {
        const cleanFieldName = fieldName.replace('custom_', '');
        const mapping = this.get('roles.fieldToRoleMapping', {});
        return mapping[cleanFieldName] || cleanFieldName;
    }
    
    // Map backend role value to frontend field name
    mapRoleToField(roleName) {
        const mapping = this.get('roles.roleToFieldMapping', {});
        return mapping[roleName] || roleName.toLowerCase().replace(' ', '_');
    }

    // 获取 API 端点
    getApiEndpoint(name) {
        return this.get(`api.endpoints.${name}`);
    }

    // 缓存管理
    getCached(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.get('performance.cache.maxAge', 300000)) {
            return cached.value;
        }
        return null;
    }

    setCached(key, value) {
        // 检查缓存大小限制
        if (this.cache.size >= this.get('performance.cache.maxSize', 100)) {
            // 删除最旧的缓存项
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        
        this.cache.set(key, {
            value,
            timestamp: Date.now()
        });
    }

    clearCache(pattern = null) {
        if (pattern) {
            // 清除匹配模式的缓存
            for (const key of this.cache.keys()) {
                if (key.includes(pattern)) {
                    this.cache.delete(key);
                }
            }
        } else {
            // 清除所有缓存
            this.cache.clear();
        }
    }

    // 观察者模式
    observe(path, callback) {
        if (!this.observers.has(path)) {
            this.observers.set(path, new Set());
        }
        this.observers.get(path).add(callback);
        
        // 返回取消观察的函数
        return () => {
            const observers = this.observers.get(path);
            if (observers) {
                observers.delete(callback);
                if (observers.size === 0) {
                    this.observers.delete(path);
                }
            }
        };
    }

    notifyObservers(path, newValue, oldValue) {
        const observers = this.observers.get(path);
        if (observers) {
            observers.forEach(callback => {
                try {
                    callback(newValue, oldValue, path);
                } catch (error) {
                    console.error('配置观察者回调错误:', error);
                }
            });
        }
    }

    // 重置配置
    reset() {
        this.config = this.initializeConfig();
        this.cache.clear();
        this.observers.clear();
    }

    // 导出配置
    export() {
        return JSON.stringify(this.config, null, 2);
    }

    // 导入配置
    import(configJson) {
        try {
            const importedConfig = JSON.parse(configJson);
            this.config = { ...this.config, ...importedConfig };
            this.clearCache();
            return true;
        } catch (error) {
            console.error('配置导入失败:', error);
            return false;
        }
    }
}

// 创建全局实例
window.AppConfig = new AppConfigManager();

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AppConfigManager;
}
