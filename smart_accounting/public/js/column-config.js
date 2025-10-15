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

        // 必需列（不能隐藏）
        this.requiredColumns = ['client'];
        
        // 默认列顺序
        this.defaultColumnOrder = Object.keys(this.allColumns);
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
}

// 创建全局实例
window.ColumnConfigManager = new ColumnConfigManager();

// Export for module systems if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ColumnConfigManager;
}
