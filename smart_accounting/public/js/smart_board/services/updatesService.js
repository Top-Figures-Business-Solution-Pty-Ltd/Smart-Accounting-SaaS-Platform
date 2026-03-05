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
    return r?.message || { items: [], meta: {} };
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

  static async updateProjectUpdate(updateName, content) {
    const name = String(updateName || '').trim();
    const text = String(content || '').trim();
    if (!name) throw new Error('Missing update name');
    if (!text) throw new Error('Missing content');
    const r = await frappe.call({
      method: 'smart_accounting.api.updates.update_project_update',
      args: { update_name: name, content: text }
    });
    return r?.message?.item || null;
  }

  static async deleteProjectUpdate(updateName) {
    const name = String(updateName || '').trim();
    if (!name) throw new Error('Missing update name');
    const r = await frappe.call({
      method: 'smart_accounting.api.updates.delete_project_update',
      args: { update_name: name }
    });
    return !!r?.message?.ok;
  }

  static async getUpdateCounts(projects = []) {
    const names = Array.isArray(projects) ? projects : [];
    if (!names.length) return {};
    const r = await frappe.call({
      method: 'smart_accounting.api.updates.get_project_update_counts',
      args: { projects: names }
    });
    return r?.message?.counts || {};
  }
}


