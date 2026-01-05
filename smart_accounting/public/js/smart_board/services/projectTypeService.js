/**
 * Smart Board - Project Type Service
 * Project Type 相关 API 调用
 */

export class ProjectTypeService {
    /**
     * 获取系统内已有的 Project Type 列表（ERPNext 原生 DocType）
     */
    static async fetchProjectTypes() {
        try {
            const r = await frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Project Type',
                    fields: ['name'],
                    order_by: 'name asc',
                    limit_page_length: 500
                }
            });

            const rows = r.message || [];
            return rows
                .map(d => d.name)
                .filter(Boolean);
        } catch (e) {
            console.error('Failed to fetch Project Types:', e);
            return [];
        }
    }
}


