// Project Management - Column Configuration Management
// Centralized column definitions to avoid hardcoding across multiple files

class ColumnConfigManager {
    constructor() {
        // 统一的列定义 - 所有列配置的单一数据源
        this.allColumns = {
            'client': 'Client Name',
            'task-name': 'Task Name', 
            'entity': 'Entity',
            'tf-tg': 'TF/TG',
            'software': 'Software',
            'communication-methods': 'Communication Methods',
            'client-contact': 'Client Contact',
            'status': 'Status',
            'note': 'Note',
            'target-month': 'Target Month',
            'budget': 'Budget',
            'actual': 'Actual',
            'review-note': 'Review Note',
            'action-person': window.AppConfig?.mapFieldToRole('action_person') || 'Action Person',
            'preparer': window.AppConfig?.mapFieldToRole('preparer') || 'Preparer',
            'reviewer': window.AppConfig?.mapFieldToRole('reviewer') || 'Reviewer',
            'partner': window.AppConfig?.mapFieldToRole('partner') || 'Partner',
            'process-date': 'Process Date',
            'lodgment-due': 'Lodgement Due',
            'engagement': 'Engagement',
            'group': 'Group',
            'year-end': 'Year End',
            'last-updated': 'Last Updated',
            'priority': 'Priority',
            'frequency': 'Frequency',
            'reset-date': 'Reset Date'
        };

        // 默认可见列（用于main视图和新partition的默认配置）
        this.defaultVisibleColumns = [
            'client', 'task-name', 'entity', 'tf-tg', 'software', 'communication-methods', 'client-contact', 'status', 
            'note', 'target-month', 'budget', 'actual', 'review-note', 
            'action-person', 'preparer', 'reviewer', 'partner', 'lodgment-due', 
            'engagement', 'group', 'year-end', 'last-updated', 'priority'
        ];

        // 必需列（不能隐藏）- 移除client的required属性
        this.requiredColumns = [];
        
        // 默认列顺序
        this.defaultColumnOrder = Object.keys(this.allColumns);
        
        // 默认主列
        this.defaultPrimaryColumn = 'client';

        // Subtask使用和Task相同的列定义，但有不同的默认配置
        // Subtask可以使用所有Task列，因为它们本质上都是Task
        
        // 定义不适合subtask的列（排除法，避免硬编码）
        this.excludedSubtaskColumns = [
            'client',           // Subtask继承父task的client
            'entity',           // Subtask继承父task的entity  
            'tf-tg',            // Subtask继承父task的tf-tg
            'software',         // 通常subtask不需要单独的software配置
            'communication-methods', // 通常subtask不需要单独的communication配置
            'client-contact',   // Subtask继承父task的client contact
            'group',            // Subtask不需要group分组
            'review-note'       // Review note通常在父task级别
        ];
        
        // 默认可见subtask列 - 选择最常用的几个列作为默认，用户可以在manage columns里调整
        const suitableColumns = Object.keys(this.allColumns).filter(
            columnKey => !this.excludedSubtaskColumns.includes(columnKey)
        );
        const defaultVisible = [
            'task-name', 'status', 'note', 'action-person', 'priority', 
            'target-month', 'budget', 'actual', 'preparer', 'reviewer'
        ];
        // 确保默认列都在适合的列中
        this.defaultVisibleSubtaskColumns = defaultVisible.filter(col => suitableColumns.includes(col));

        // 必需subtask列（不能隐藏）
        this.requiredSubtaskColumns = ['task-name'];
        
        // 动态生成subtask列顺序（排除不适合的列）
        this.defaultSubtaskColumnOrder = Object.keys(this.allColumns).filter(
            columnKey => !this.excludedSubtaskColumns.includes(columnKey)
        );
        
        // 默认subtask主列
        this.defaultSubtaskPrimaryColumn = 'task-name';
    }

    /**
     * 获取所有可用列的定义
     * @returns {Object} 列键值对映射
     */
    getAllColumns() {
        return { ...this.allColumns };
    }

    /**
     * 获取所有列的键数组
     * @returns {Array} 列键数组
     */
    getAllColumnKeys() {
        return Object.keys(this.allColumns);
    }

    /**
     * 获取列的显示名称
     * @param {string} columnKey - 列键
     * @returns {string} 显示名称
     */
    getColumnDisplayName(columnKey) {
        return this.allColumns[columnKey] || columnKey;
    }

    /**
     * 检查列是否为必需列
     * @param {string} columnKey - 列键
     * @returns {boolean} 是否必需
     */
    isRequiredColumn(columnKey) {
        return this.requiredColumns.includes(columnKey);
    }

    /**
     * 获取默认可见列
     * @returns {Array} 默认可见列数组
     */
    getDefaultVisibleColumns() {
        return [...this.defaultVisibleColumns];
    }

    /**
     * 获取默认列顺序
     * @returns {Array} 默认列顺序数组
     */
    getDefaultColumnOrder() {
        return [...this.defaultColumnOrder];
    }

    /**
     * 验证列配置的有效性
     * @param {Array} visibleColumns - 可见列数组
     * @param {Array} columnOrder - 列顺序数组
     * @returns {Object} 验证结果
     */
    validateColumnConfig(visibleColumns, columnOrder) {
        const errors = [];
        const allKeys = this.getAllColumnKeys();

        // 检查可见列是否都是有效的
        const invalidVisible = visibleColumns.filter(col => !allKeys.includes(col));
        if (invalidVisible.length > 0) {
            errors.push(`Invalid visible columns: ${invalidVisible.join(', ')}`);
        }

        // 检查必需列是否都包含在可见列中
        const missingRequired = this.requiredColumns.filter(col => !visibleColumns.includes(col));
        if (missingRequired.length > 0) {
            errors.push(`Missing required columns: ${missingRequired.join(', ')}`);
        }

        // 检查列顺序是否包含所有列
        if (columnOrder && columnOrder.length > 0) {
            const missingInOrder = allKeys.filter(col => !columnOrder.includes(col));
            const extraInOrder = columnOrder.filter(col => !allKeys.includes(col));
            
            if (missingInOrder.length > 0) {
                errors.push(`Missing columns in order: ${missingInOrder.join(', ')}`);
            }
            if (extraInOrder.length > 0) {
                errors.push(`Invalid columns in order: ${extraInOrder.join(', ')}`);
            }
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * 规范化列配置，确保包含所有必需列
     * @param {Array} visibleColumns - 可见列数组
     * @returns {Array} 规范化后的可见列数组
     */
    normalizeVisibleColumns(visibleColumns) {
        const normalized = [...visibleColumns];
        
        // 确保必需列包含在内
        this.requiredColumns.forEach(col => {
            if (!normalized.includes(col)) {
                normalized.unshift(col); // 添加到开头
            }
        });

        return normalized;
    }

    /**
     * 根据列顺序对可见列进行排序
     * @param {Array} visibleColumns - 可见列数组
     * @param {Array} columnOrder - 列顺序数组
     * @returns {Array} 排序后的可见列数组
     */
    sortVisibleColumnsByOrder(visibleColumns, columnOrder) {
        if (!columnOrder || columnOrder.length === 0) {
            return visibleColumns;
        }

        // 按照columnOrder的顺序排列visibleColumns
        const sorted = [];
        
        // 首先添加在columnOrder中且在visibleColumns中的列
        columnOrder.forEach(col => {
            if (visibleColumns.includes(col)) {
                sorted.push(col);
            }
        });

        // 然后添加在visibleColumns中但不在columnOrder中的列
        visibleColumns.forEach(col => {
            if (!sorted.includes(col)) {
                sorted.push(col);
            }
        });

        return sorted;
    }

    /**
     * 获取主列 - 简化逻辑：第一个可见列就是主列
     * @param {Object} partitionConfig - 分区配置
     * @param {Array} visibleColumns - 可见列数组
     * @returns {string} 主列键
     */
    getPrimaryColumn(partitionConfig, visibleColumns = []) {
        // 简化逻辑：第一个可见列就是主列
        return visibleColumns[0] || this.defaultPrimaryColumn;
    }

    // ==================== Subtask Column Methods ====================

    /**
     * 获取所有可用subtask列的定义（只包含适合subtask的列）
     * @returns {Object} 列键值对映射
     */
    getAllSubtaskColumns() {
        const subtaskColumns = {};
        // 使用动态生成的列顺序
        this.getDefaultSubtaskColumnOrder().forEach(columnKey => {
            if (this.allColumns[columnKey]) {
                subtaskColumns[columnKey] = this.allColumns[columnKey];
            }
        });
        return subtaskColumns;
    }

    /**
     * 获取所有subtask列的键数组（只包含适合subtask的列）
     * @returns {Array} 列键数组
     */
    getAllSubtaskColumnKeys() {
        return [...this.defaultSubtaskColumnOrder];
    }

    /**
     * 获取subtask列的显示名称（使用统一的getColumnDisplayName方法）
     * @param {string} columnKey - 列键
     * @returns {string} 显示名称
     */
    getSubtaskColumnDisplayName(columnKey) {
        return this.getColumnDisplayName(columnKey);
    }

    /**
     * 获取默认可见subtask列
     * @returns {Array} 默认可见列数组
     */
    getDefaultVisibleSubtaskColumns() {
        return [...this.defaultVisibleSubtaskColumns];
    }

    /**
     * 获取必需subtask列（不能隐藏的列）
     * @returns {Array} 必需列数组
     */
    getRequiredSubtaskColumns() {
        return [...this.requiredSubtaskColumns];
    }

    /**
     * 获取默认subtask列顺序
     * @returns {Array} 默认列顺序数组
     */
    getDefaultSubtaskColumnOrder() {
        return [...this.defaultSubtaskColumnOrder];
    }

    /**
     * 获取排除的subtask列
     * @returns {Array} 排除的列数组
     */
    getExcludedSubtaskColumns() {
        return [...this.excludedSubtaskColumns];
    }

    /**
     * 检查列是否适合subtask使用
     * @param {string} columnKey - 列键
     * @returns {boolean} 是否适合subtask
     */
    isColumnSuitableForSubtask(columnKey) {
        return !this.excludedSubtaskColumns.includes(columnKey) && this.allColumns.hasOwnProperty(columnKey);
    }

    /**
     * 从后端同步最新的列定义（可选的增强功能）
     * @returns {Promise} 同步结果
     */
    async syncColumnDefinitionsFromBackend() {
        try {
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.get_all_task_columns'
            });
            
            if (response.message && Array.isArray(response.message)) {
                const backendColumns = response.message;
                console.log('🔄 Synced columns from backend:', backendColumns);
                
                // 可以在这里验证前后端列定义是否一致
                const frontendColumns = Object.keys(this.allColumns);
                const missingInFrontend = backendColumns.filter(col => !frontendColumns.includes(col));
                const extraInFrontend = frontendColumns.filter(col => !backendColumns.includes(col));
                
                if (missingInFrontend.length > 0) {
                    console.warn('⚠️ Backend has columns not in frontend:', missingInFrontend);
                }
                if (extraInFrontend.length > 0) {
                    console.warn('⚠️ Frontend has columns not in backend:', extraInFrontend);
                }
                
                return {
                    success: true,
                    backend_columns: backendColumns,
                    frontend_columns: frontendColumns,
                    missing_in_frontend: missingInFrontend,
                    extra_in_frontend: extraInFrontend
                };
            }
        } catch (error) {
            console.error('❌ Failed to sync column definitions:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 验证subtask列配置的有效性
     * @param {Array} visibleColumns - 可见列数组
     * @param {Array} columnOrder - 列顺序数组
     * @returns {Object} 验证结果
     */
    validateSubtaskColumnConfig(visibleColumns, columnOrder) {
        const allColumns = this.getAllSubtaskColumnKeys();
        const requiredColumns = this.getRequiredSubtaskColumns();
        
        // 检查必需列是否都存在
        const missingRequired = requiredColumns.filter(col => !visibleColumns.includes(col));
        if (missingRequired.length > 0) {
            return {
                valid: false,
                error: `Missing required subtask columns: ${missingRequired.join(', ')}`
            };
        }
        
        // 检查是否有无效列
        const invalidColumns = visibleColumns.filter(col => !allColumns.includes(col));
        if (invalidColumns.length > 0) {
            return {
                valid: false,
                error: `Invalid subtask columns: ${invalidColumns.join(', ')}`
            };
        }
        
        return { valid: true };
    }

    /**
     * 根据列顺序排序subtask可见列
     * @param {Array} visibleColumns - 可见列数组
     * @param {Array} columnOrder - 列顺序数组
     * @returns {Array} 排序后的可见列数组
     */
    sortSubtaskVisibleColumns(visibleColumns, columnOrder) {
        if (!columnOrder || columnOrder.length === 0) {
            columnOrder = this.getDefaultSubtaskColumnOrder();
        }
        
        // 按照columnOrder的顺序排列visibleColumns
        const sorted = [];
        
        // 首先添加在columnOrder中且在visibleColumns中的列
        columnOrder.forEach(col => {
            if (visibleColumns.includes(col)) {
                sorted.push(col);
            }
        });

        // 然后添加在visibleColumns中但不在columnOrder中的列
        visibleColumns.forEach(col => {
            if (!sorted.includes(col)) {
                sorted.push(col);
            }
        });

        return sorted;
    }

    /**
     * 获取subtask主列
     * @param {Object} partitionConfig - 分区配置
     * @param {Array} visibleColumns - 可见列数组
     * @returns {string} 主列键
     */
    getSubtaskPrimaryColumn(partitionConfig, visibleColumns = []) {
        // 简化逻辑：第一个可见列就是主列
        return visibleColumns[0] || this.defaultSubtaskPrimaryColumn;
    }

    /**
     * 检查列是否可以作为主列 - 现在任何列都可以作为主列
     * @param {string} columnKey - 列键
     * @returns {boolean} 是否可以作为主列
     */
    canBePrimaryColumn(columnKey) {
        // 简化逻辑：任何存在的列都可以作为主列
        return this.allColumns.hasOwnProperty(columnKey);
    }
}

// 创建全局实例
window.ColumnConfigManager = new ColumnConfigManager();

// Export for module systems if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ColumnConfigManager;
}
