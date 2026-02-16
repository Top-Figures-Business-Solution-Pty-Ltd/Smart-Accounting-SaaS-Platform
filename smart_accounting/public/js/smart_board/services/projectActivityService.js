export class ProjectActivityService {
  static async getProjectActivity(projectName, { limitStart = 0, limit = 100 } = {}) {
    const r = await frappe.call({
      method: 'smart_accounting.api.activity_log.get_project_activity',
      args: {
        project: String(projectName || '').trim(),
        limit_start: Math.max(0, Number(limitStart) || 0),
        limit_page_length: Math.max(1, Number(limit) || 100),
      },
    });
    return r?.message || { items: [], meta: {} };
  }
}

