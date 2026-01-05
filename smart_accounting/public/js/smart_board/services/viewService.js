/**
 * Smart Board - View Service
 * Saved View相关API调用
 */

import { ApiService } from './api.js';

export class ViewService {
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
     * 获取默认View
     */
    static async getDefaultView(projectType) {
        const views = await this.fetchViews(projectType);
        return views.find(v => v.is_default) || views[0] || null;
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
        return ApiService.updateDoc('Saved View', name, data);
    }
    
    /**
     * 删除View
     */
    static async deleteView(name) {
        return ApiService.deleteDoc('Saved View', name);
    }
}

