/**
 * Smart Board - Project Service
 * Project相关API调用
 */

import { ApiService } from './api.js';

export class ProjectService {
    static _warnedMissingFields = false;
    static _extraFields = null;

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

        // Include optional extra fields (website-safe, best-effort)
        const extra = await this._getExtraFields();
        if (Array.isArray(extra) && extra.length) {
            for (const f of extra) {
                if (f && !fullFields.includes(f)) fullFields.push(f);
            }
        }

        const fetchWithFields = async (fields) => {
            // Advanced groups (supports nested AND/OR across groups).
            const hasGroups = Array.isArray(filters?.advanced_groups) && filters.advanced_groups.length > 0;
            let nameIn = null;
            if (hasGroups) {
                try {
                    const r = await frappe.call({
                        method: 'smart_accounting.api.project_board.query_project_names_advanced',
                        args: {
                            project_type: filters.project_type || null,
                            groups: filters.advanced_groups,
                            limit: filters.limit || 2000,
                            is_active_only: filters.is_active !== false ? 1 : 0,
                            search: filters.search || null,
                        }
                    });
                    const msg = r?.message || {};
                    const noRestriction = !!msg?.no_restriction;
                    const names = msg?.names ?? msg;

                    if (noRestriction) {
                        nameIn = null;
                    } else if (Array.isArray(names) && names.length) {
                        nameIn = names;
                    } else {
                        return [];
                    }
                } catch (e) {
                    // fall back to old path
                }
            }

            const or_filters = this.buildOrFilters(filters);
            const args = {
                doctype: 'Project',
                fields,
                filters: this.buildFilters({ ...filters, ...(nameIn ? { name_in: nameIn } : {}) }),
                ...(or_filters && or_filters.length ? { or_filters } : {}),
                order_by: 'modified desc',
                limit_page_length: filters.limit || 100
            };
            
            const response = await frappe.call({
                method: 'frappe.client.get_list',
                type: 'POST',
                args
            });
            
            const rows = response.message || [];
            // Hydrate child tables (get_list doesn't include Table/child rows)
            try {
                await this._hydrateChildTables(rows);
            } catch (e) {}
            return rows;
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

    static async _hydrateChildTables(projects) {
        const list = Array.isArray(projects) ? projects : [];
        const names = list.map((p) => p?.name).filter(Boolean);
        if (!names.length) return;

        // Use website-safe backend API to avoid PermissionError on child tables
        try {
            const r = await frappe.call({
                method: 'smart_accounting.api.project_board.hydrate_project_children',
                args: { projects: names }
            });
            const msg = r?.message || {};
            const team = msg?.team || {};
            const softwares = msg?.softwares || {};
            for (const p of list) {
                if (!p?.name) continue;
                p.custom_team_members = team[p.name] || [];
                p.custom_softwares = softwares[p.name] || [];
            }
        } catch (e) {
            // Fail-safe: keep UI functional even if child hydration is unavailable
        }
    }

    static async _getExtraFields() {
        // Cache per page load
        if (Array.isArray(this._extraFields)) return this._extraFields;
        this._extraFields = [];

        // Engagement Letter attach field (if present on site meta)
        try {
            const r = await frappe.call({
                method: 'frappe.desk.form.load.getdoctype',
                type: 'GET',
                args: { doctype: 'Project' }
            });
            const docs = r?.docs || [];
            const meta = docs.find((d) => d?.name === 'Project') || docs[0];
            const fields = meta?.fields || [];
            const f = fields.find((x) => (x?.fieldtype === 'Attach' || x?.fieldtype === 'Attach Image') && String(x?.label || '').trim() === 'Engagement Letter');
            if (f?.fieldname) this._extraFields.push(String(f.fieldname));
        } catch (e) {}

        return this._extraFields;
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
     * Bulk update a single field across many Projects (single request).
     */
    static async bulkSetProjectField(projects, field, value) {
        const names = Array.isArray(projects) ? projects : [];
        if (!names.length) return { updated: [] };
        const r = await frappe.call({
            method: 'smart_accounting.api.project_board.bulk_set_project_field',
            args: { projects: names, field, value }
        });
        return r?.message || { updated: [] };
    }

    static async getTaskCounts(projects) {
        const names = Array.isArray(projects) ? projects : [];
        if (!names.length) return {};
        try {
            const r = await frappe.call({
                method: 'smart_accounting.api.project_board.get_task_counts',
                args: { projects: names }
            });
            return r?.message?.counts || {};
        } catch (e) {
            return {};
        }
    }

    static async getTasksForProjects(projects, fields = [], limitPerProject = 200) {
        const names = Array.isArray(projects) ? projects : [];
        if (!names.length) return {};
        try {
            const r = await frappe.call({
                method: 'smart_accounting.api.project_board.get_tasks_for_projects',
                args: { projects: names, fields, limit_per_project: limitPerProject }
            });
            return r?.message?.tasks || {};
        } catch (e) {
            return {};
        }
    }

    static async getBoardFiscalStartMonth(projects) {
        const names = Array.isArray(projects) ? projects : [];
        if (!names.length) return { start_month: null, counts: {}, by_project: {} };
        try {
            const r = await frappe.call({
                method: 'smart_accounting.api.project_board.get_board_fiscal_start_month',
                args: { projects: names }
            });
            return r?.message || { start_month: null, counts: {}, by_project: {} };
        } catch (e) {
            return { start_month: null, counts: {}, by_project: {} };
        }
    }

    static async getMonthlyStatusBundle(projects, { includeTasks = true, includeMatrix = true, includeSummary = true, limitPerProject = 500, taskFields = [] } = {}) {
        const names = Array.isArray(projects) ? projects : [];
        if (!names.length) return { start_month: null, tasks: {}, matrix: {}, summary: {}, fiscal_year: {} };
        try {
            const r = await frappe.call({
                method: 'smart_accounting.api.project_board.get_monthly_status_bundle',
                args: {
                    projects: names,
                    include_tasks: includeTasks ? 1 : 0,
                    include_matrix: includeMatrix ? 1 : 0,
                    include_summary: includeSummary ? 1 : 0,
                    limit_per_project: limitPerProject,
                    task_fields: Array.isArray(taskFields) ? taskFields : []
                }
            });
            return r?.message || { start_month: null, tasks: {}, matrix: {}, summary: {}, fiscal_year: {} };
        } catch (e) {
            return { start_month: null, tasks: {}, matrix: {}, summary: {}, fiscal_year: {} };
        }
    }

    static async setMonthlyStatus({ referenceDoctype = 'Task', referenceName, fiscalYear, monthIndex, status } = {}) {
        if (!referenceName) throw new Error('Missing referenceName');
        if (!fiscalYear) throw new Error('Missing fiscalYear');
        if (!monthIndex) throw new Error('Missing monthIndex');
        if (!status) throw new Error('Missing status');
        const r = await frappe.call({
            method: 'smart_accounting.api.project_board.set_monthly_status',
            args: {
                reference_doctype: referenceDoctype,
                reference_name: referenceName,
                fiscal_year: fiscalYear,
                month_index: monthIndex,
                status
            }
        });
        return r?.message || {};
    }

    static async createTask(project, data = {}) {
        const p = String(project || '').trim();
        if (!p) throw new Error('Missing project');
        const subject = data?.subject != null ? String(data.subject) : null;
        const r = await frappe.call({
            method: 'smart_accounting.api.project_board.create_task_for_project',
            args: { project: p, subject }
        });
        return r?.message?.task || r?.message;
    }

    static async getMyProjectsWithRoles() {
        const r = await frappe.call({
            method: 'smart_accounting.api.project_board.get_my_projects_with_roles',
            args: {}
        });
        return r?.message?.projects || [];
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
                // IMPORTANT: empty array should mean "no status filter"
                if (filters.status.length) result.push(['status', 'in', filters.status]);
            } else if (String(filters.status).trim()) {
                result.push(['status', '=', filters.status]);
            }
        }
        
        // company筛选
        if (filters.company && String(filters.company).trim()) {
            result.push(['company', '=', filters.company]);
        }
        
        // customer筛选
        if (filters.customer && String(filters.customer).trim()) {
            result.push(['customer', '=', filters.customer]);
        }
        
        // fiscal_year筛选
        if (filters.fiscal_year && String(filters.fiscal_year).trim()) {
            result.push(['custom_fiscal_year', '=', filters.fiscal_year]);
        }
        
        // 日期范围筛选
        if (filters.date_from && String(filters.date_from).trim()) {
            result.push(['custom_lodgement_due_date', '>=', filters.date_from]);
        }
        if (filters.date_to && String(filters.date_to).trim()) {
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

        // name IN (from advanced groups resolution)
        if (Array.isArray(filters.name_in) && filters.name_in.length) {
            result.push(['name', 'in', filters.name_in]);
        }

        // Advanced rules (AND rules)
        const rules = Array.isArray(filters?.advanced_rules) ? filters.advanced_rules : [];
        for (const r of rules) {
            const join = (r?.join || '').toLowerCase();
            if (join === 'or') continue; // OR rules handled by buildOrFilters
            const triple = this._ruleToFilterTriple(r);
            if (triple) result.push(triple);
        }
        
        return result;
    }

    /**
     * Build OR filters from advanced_rules.
     * Semantics in frappe.get_list:
     * - filters are ANDed
     * - or_filters are ORed (then ANDed with filters)
     */
    static buildOrFilters(filters) {
        const out = [];
        const rules = Array.isArray(filters?.advanced_rules) ? filters.advanced_rules : [];
        for (const r of rules) {
            const join = (r?.join || '').toLowerCase();
            if (join !== 'or') continue;
            const triple = this._ruleToFilterTriple(r);
            if (triple) out.push(triple);
        }
        return out;
    }

    static _ruleToFilterTriple(rule) {
        const field = (rule?.field || '').trim();
        const cond = (rule?.condition || '').trim();
        const value = rule?.value;
        if (!field || !cond) return null;

        const needsValue = !['is_empty', 'is_not_empty'].includes(cond);
        const v = (value == null) ? '' : String(value);
        if (needsValue && !v) return null;

        switch (cond) {
            case 'equals':
                return [field, '=', v];
            case 'not_equals':
                return [field, '!=', v];
            case 'contains':
                return [field, 'like', `%${v}%`];
            case 'not_contains':
                return [field, 'not like', `%${v}%`];
            case 'starts_with':
                return [field, 'like', `${v}%`];
            case 'before':
                return [field, '<', v];
            case 'after':
                return [field, '>', v];
            case 'on_or_before':
                return [field, '<=', v];
            case 'on_or_after':
                return [field, '>=', v];
            case 'is_empty':
                return [field, '=', ''];
            case 'is_not_empty':
                return [field, '!=', ''];
            default:
                return null;
        }
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

