/**
 * Smart Board - Project Service
 * Project相关API调用
 */

import { ApiService } from './api.js';

export class ProjectService {
    static _warnedMissingFields = false;

    /**
     * 获取Projects列表
     */
    static async fetchProjects(filters = {}) {
        const fullFields = [
                    'name',
                    'project_name',
                    'customer',
                    'company',
                    'project_type',
                    'status',
                    'priority',
                    'expected_start_date',
                    'expected_end_date',
                    'estimated_costing',
                    'notes',
                    'is_active',
                    'percent_complete',
                    'modified',
                    'auto_repeat',
                    'custom_entity_type',
                    'custom_team_members',
                    'custom_fiscal_year',
                    'custom_target_month',
                    'custom_lodgement_due_date',
                    'custom_project_frequency',
                    'custom_softwares'
        ];

        const minimalFields = [
            'name',
            'project_name',
            'customer',
            'company',
            'project_type',
            'status',
            'expected_start_date',
            'expected_end_date',
            'notes',
            'is_active'
        ];

        const fetchWithFields = async (fields) => {
            const args = {
                doctype: 'Project',
                fields,
                filters: this.buildFilters(filters),
                order_by: 'modified desc',
                limit_page_length: filters.limit || 100
            };
            
            const response = await frappe.call({
                method: 'frappe.client.get_list',
                args
            });
            
            return response.message || [];
        };

        try {
            return await fetchWithFields(fullFields);
        } catch (error) {
            console.error('Failed to fetch projects (full fields):', error);

            // If custom fields are missing on site meta, fallback so UI still works.
            try {
                if (!this._warnedMissingFields) {
                    this._warnedMissingFields = true;
                    frappe.show_alert?.({
                        message: __('Some Project custom fields are missing on this site. Falling back to a minimal field set.'),
                        indicator: 'orange'
                    });
                }
                return await fetchWithFields(minimalFields);
            } catch (error2) {
                console.error('Failed to fetch projects (minimal fields):', error2);
                frappe.show_alert?.({
                message: __('Failed to load projects'),
                indicator: 'red'
            });
            return [];
            }
        }
    }
    
    /**
     * 获取单个Project详情
     */
    static async getProject(name) {
        return ApiService.getDoc('Project', name);
    }
    
    /**
     * 更新Project字段
     */
    static async updateProject(name, data) {
        return ApiService.updateDoc('Project', name, data);
    }
    
    /**
     * 删除Project
     */
    static async deleteProject(name) {
        return ApiService.deleteDoc('Project', name);
    }
    
    /**
     * 构建筛选条件
     */
    static buildFilters(filters) {
        const result = [];
        
        // project_type筛选
        if (filters.project_type) {
            result.push(['project_type', '=', filters.project_type]);
        }
        
        // status筛选（支持多选）
        if (filters.status) {
            if (Array.isArray(filters.status)) {
                result.push(['status', 'in', filters.status]);
            } else {
                result.push(['status', '=', filters.status]);
            }
        }
        
        // company筛选
        if (filters.company) {
            result.push(['company', '=', filters.company]);
        }
        
        // customer筛选
        if (filters.customer) {
            result.push(['customer', '=', filters.customer]);
        }
        
        // fiscal_year筛选
        if (filters.fiscal_year) {
            result.push(['custom_fiscal_year', '=', filters.fiscal_year]);
        }
        
        // 日期范围筛选
        if (filters.date_from) {
            result.push(['custom_lodgement_due_date', '>=', filters.date_from]);
        }
        if (filters.date_to) {
            result.push(['custom_lodgement_due_date', '<=', filters.date_to]);
        }
        
        // 搜索关键词
        if (filters.search) {
            result.push(['project_name', 'like', `%${filters.search}%`]);
        }
        
        // 只显示活跃的项目
        if (filters.is_active !== false) {
            result.push(['is_active', '=', 'Yes']);
        }
        
        return result;
    }
    
    /**
     * 获取Project统计信息
     */
    static async getStats(projectType) {
        try {
            const projects = await this.fetchProjects({ project_type: projectType });
            
            const stats = {
                total: projects.length,
                by_status: {},
                by_company: {}
            };
            
            projects.forEach(project => {
                // 按状态统计
                if (project.status) {
                    stats.by_status[project.status] = (stats.by_status[project.status] || 0) + 1;
                }
                
                // 按公司统计
                if (project.company) {
                    stats.by_company[project.company] = (stats.by_company[project.company] || 0) + 1;
                }
            });
            
            return stats;
        } catch (error) {
            console.error('Failed to get stats:', error);
            return null;
        }
    }
}

