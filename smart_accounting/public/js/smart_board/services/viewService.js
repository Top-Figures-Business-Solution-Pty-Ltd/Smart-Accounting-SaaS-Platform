/**
 * Smart Board - View Service
 * Saved View相关API调用
 */

import { ApiService } from './api.js';

export class ViewService {
    static _jsonify(value) {
        if (value === undefined) return value;
        if (value === null) return value;
        // Frappe JSON field expects a string in DB; passing list/dict will raise validation errors.
        if (typeof value === 'string') return value;
        try {
            return JSON.stringify(value);
        } catch (e) {
            return value;
        }
    }
    /**
     * 获取所有Saved Views
     */
    static async fetchViews(projectType = null) {
        try {
            const filters = projectType ? [['project_type', '=', projectType]] : [];
            
            const response = await frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Saved View',
                    fields: ['*'],
                    filters: filters,
                    order_by: 'is_default desc, title asc'
                }
            });
            
            return response.message || [];
        } catch (error) {
            console.error('Failed to fetch views:', error);
            return [];
        }
    }
    
    /**
     * 获取某个 project_type 的默认 View（团队共享），找不到返回 null
     */
    static async getDefaultView(projectType) {
        try {
            const filters = [
                ['project_type', '=', projectType],
                ['is_default', '=', 1]
            ];

            const response = await frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Saved View',
                    fields: ['name', 'title', 'project_type', 'columns', 'filters', 'sort_by', 'sort_order', 'is_default', 'owner', 'modified'],
                    filters,
                    limit_page_length: 1,
                    order_by: 'modified desc'
                }
            });

            const rows = response.message || [];
            return rows[0] || null;
        } catch (error) {
            console.error('Failed to get default view:', error);
            return null;
        }
    }

    /**
     * 获取或创建某个 project_type 的默认 View
     * - 目标：团队共享默认列（不做个人视图隔离）
     */
    static async getOrCreateDefaultView(projectType, { fallbackTitle, fallbackColumns } = {}) {
        const existing = await this.getDefaultView(projectType);
        if (existing) return existing;

        // Create a minimal default view
        const title = fallbackTitle || `${projectType} Board`;
        const columns = Array.isArray(fallbackColumns) ? fallbackColumns : [];

        try {
            const response = await frappe.call({
                method: 'frappe.client.insert',
                args: {
                    doc: {
                        doctype: 'Saved View',
                        title,
                        project_type: projectType,
                        columns: this._jsonify(columns),
                        filters: this._jsonify({}),
                        sort_by: 'modified',
                        sort_order: 'desc',
                        is_default: 1
                    }
                }
            });
            return response.message || null;
        } catch (error) {
            console.error('Failed to create default view:', error);
            frappe.show_alert?.({ message: __('Failed to create default view'), indicator: 'red' });
            return null;
        }
    }
    
    /**
     * 保存View
     */
    static async saveView(data) {
        try {
            const response = await frappe.call({
                method: 'frappe.client.insert',
                args: {
                    doc: {
                        doctype: 'Saved View',
                        ...(data?.columns !== undefined ? { columns: this._jsonify(data.columns) } : {}),
                        ...(data?.filters !== undefined ? { filters: this._jsonify(data.filters) } : {}),
                        ...data
                    }
                }
            });
            
            frappe.show_alert({
                message: __('View saved successfully'),
                indicator: 'green'
            });
            
            return response.message;
        } catch (error) {
            console.error('Failed to save view:', error);
            frappe.show_alert({
                message: __('Failed to save view'),
                indicator: 'red'
            });
            return null;
        }
    }
    
    /**
     * 更新View
     */
    static async updateView(name, data) {
        const payload = { ...data };
        if (payload.columns !== undefined) payload.columns = this._jsonify(payload.columns);
        if (payload.filters !== undefined) payload.filters = this._jsonify(payload.filters);
        return ApiService.updateDoc('Saved View', name, payload);
    }
    
    /**
     * 删除View
     */
    static async deleteView(name) {
        return ApiService.deleteDoc('Saved View', name);
    }
}

