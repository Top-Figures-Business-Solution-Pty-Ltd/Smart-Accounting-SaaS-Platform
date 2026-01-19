/**
 * UpdatesService
 * - Data access layer for Project Updates (Frappe Comment)
 */
export class UpdatesService {
  static async listProjectUpdates(projectName, { limitStart = 0, limit = 20 } = {}) {
    const project = String(projectName || '').trim();
    if (!project) throw new Error('Missing project');
    const r = await frappe.call({
      method: 'smart_accounting.api.updates.get_project_updates',
      args: {
        project,
        limit_start: Math.max(0, Number(limitStart) || 0),
        limit_page_length: Math.max(1, Number(limit) || 20),
      }
    });
    return r?.message?.items || [];
  }

  static async addProjectUpdate(projectName, content, { mentions = [] } = {}) {
    const project = String(projectName || '').trim();
    const text = String(content || '').trim();
    if (!project) throw new Error('Missing project');
    if (!text) throw new Error('Missing content');
    const r = await frappe.call({
      method: 'smart_accounting.api.updates.add_project_update',
      args: { project, content: text, mentions: Array.isArray(mentions) ? mentions : [] }
    });
    return r?.message?.item || null;
  }
}


