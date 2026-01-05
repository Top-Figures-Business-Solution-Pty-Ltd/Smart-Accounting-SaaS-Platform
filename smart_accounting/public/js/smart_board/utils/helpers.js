/**
 * Smart Board - Helper Functions
 * 通用工具函数
 */

import { STATUS_COLORS } from './constants.js';

/**
 * 格式化日期
 */
export function formatDate(date, format = 'YYYY-MM-DD') {
    if (!date) return '';
    return frappe.datetime.str_to_user(date);
}

/**
 * 格式化货币
 */
export function formatCurrency(amount) {
    if (!amount) return '';
    return frappe.format(amount, { fieldtype: 'Currency' });
}

/**
 * 获取状态颜色
 */
export function getStatusColor(status) {
    return STATUS_COLORS[status] || '#6c757d';
}

/**
 * 从本地存储获取数据
 */
export function getFromStorage(key, defaultValue = null) {
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : defaultValue;
    } catch (e) {
        console.error('Error reading from storage:', e);
        return defaultValue;
    }
}

/**
 * 保存数据到本地存储
 */
export function saveToStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (e) {
        console.error('Error saving to storage:', e);
        return false;
    }
}

/**
 * 防抖函数
 */
export function debounce(func, wait = 300) {
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

/**
 * 节流函数
 */
export function throttle(func, limit = 300) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * 深度克隆对象
 */
export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * 提取团队成员显示名称
 */
export function formatTeamMembers(teamMembers) {
    if (!teamMembers || !teamMembers.length) return '';
    
    const names = teamMembers.map(member => {
        const user = member.user || member;
        // 从 email 提取名字（bob@tf.com -> Bob）
        const name = user.split('@')[0];
        return name.charAt(0).toUpperCase() + name.slice(1);
    });
    
    return names.join(', ');
}

/**
 * 按角色分组团队成员
 */
export function groupTeamByRole(teamMembers) {
    if (!teamMembers || !teamMembers.length) return {};
    
    return teamMembers.reduce((acc, member) => {
        const role = member.role || 'Preparer';
        if (!acc[role]) acc[role] = [];
        acc[role].push(member.user);
        return acc;
    }, {});
}

/**
 * 检查权限
 */
export function hasPermission(doctype, perm_type = 'read') {
    return frappe.model.can_read(doctype);
}

/**
 * 显示通知
 */
export function showNotification(message, type = 'info') {
    frappe.show_alert({
        message: message,
        indicator: type // 'info', 'green', 'red', 'yellow', 'blue'
    });
}

/**
 * 显示确认对话框
 */
export function showConfirmDialog(message, callback) {
    frappe.confirm(
        message,
        () => callback(true),
        () => callback(false)
    );
}

/**
 * 生成唯一ID
 */
export function generateId() {
    return `_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 比较两个对象是否相等
 */
export function isEqual(obj1, obj2) {
    return JSON.stringify(obj1) === JSON.stringify(obj2);
}

/**
 * 获取字段显示值
 */
export function getFieldValue(doc, fieldname) {
    if (!doc || !fieldname) return '';
    
    const value = doc[fieldname];
    if (!value) return '';
    
    // 处理不同字段类型
    if (Array.isArray(value)) {
        return value.join(', ');
    }
    
    return value;
}

/**
 * 构建筛选器查询
 */
export function buildFilters(filterObj) {
    const filters = [];
    
    Object.keys(filterObj).forEach(key => {
        const value = filterObj[key];
        if (value !== null && value !== undefined && value !== '') {
            if (Array.isArray(value)) {
                filters.push([key, 'in', value]);
            } else {
                filters.push([key, '=', value]);
            }
        }
    });
    
    return filters;
}

