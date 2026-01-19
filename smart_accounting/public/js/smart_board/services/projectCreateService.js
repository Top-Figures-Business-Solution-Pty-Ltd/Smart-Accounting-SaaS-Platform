/**
 * ProjectCreateService
 * - Data access for creating Projects from the product shell (/smart).
 * - Kept separate from ProjectService to avoid mixing list/query logic with creation workflow.
 */
import { notify } from './uiAdapter.js';

export class ProjectCreateService {
  /**
   * Create a new Project using frappe.client.insert.
   * Returns the created doc (best-effort).
   */
  static async createProject(payload = {}) {
    const doc = {
      doctype: 'Project',
      ...payload,
    };

    const required = ['project_name', 'customer', 'company', 'project_type', 'status'];
    const missing = required.filter((k) => !String(doc?.[k] || '').trim());
    if (missing.length) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    try {
      const r = await frappe.call({
        method: 'frappe.client.insert',
        type: 'POST',
        args: { doc }
      });
      return r?.message || null;
    } catch (e) {
      const msg = e?.message || String(e);
      notify(`Create project failed: ${msg}`, 'red');
      throw e;
    }
  }
}


