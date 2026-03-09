export class AutomationLogService {
  static async listRuns({ automation = '', project = '', limitStart = 0, limit = 10 } = {}) {
    const r = await frappe.call({
      method: 'smart_accounting.api.automation_logs.get_automation_run_logs',
      quiet: true,
      args: {
        automation: String(automation || '').trim(),
        project: String(project || '').trim(),
        limit_start: Math.max(0, Number(limitStart) || 0),
        limit_page_length: Math.max(1, Number(limit) || 10),
      },
    });
    return r?.message || { items: [], meta: {} };
  }
}
