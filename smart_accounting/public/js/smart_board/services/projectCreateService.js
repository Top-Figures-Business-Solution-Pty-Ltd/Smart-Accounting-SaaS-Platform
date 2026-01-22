/**
 * ProjectCreateService
 * - Data access for creating Projects from the product shell (/smart).
 * - Kept separate from ProjectService to avoid mixing list/query logic with creation workflow.
 */
import { notify } from './uiAdapter.js';

function _extractServerMessage(err) {
  try {
    const raw = err?._server_messages;
    if (raw) {
      const arr = JSON.parse(raw);
      const first = Array.isArray(arr) ? arr[0] : null;
      const decoded = first ? JSON.parse(first) : null;
      if (decoded?.message) return String(decoded.message);
    }
  } catch (e) {}
  return String(err?.message || err?.exc || err?.exception || err || '').trim();
}

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

    // Keep minimal required fields; other fields (e.g. status) can be set later by the user.
    const required = ['project_name', 'customer', 'company', 'custom_fiscal_year', 'project_type'];
    const missing = required.filter((k) => !String(doc?.[k] || '').trim());
    if (missing.length) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    try {
      const r = await frappe.call({
        method: 'frappe.client.insert',
        type: 'POST',
        // Prevent server-side msgprint popups (e.g. Auto Repeat created) from interrupting /smart UX.
        silent: true,
        args: { doc }
      });
      return r?.message || null;
    } catch (e) {
      const msg = _extractServerMessage(e) || 'Create project failed';
      notify(`Create project failed: ${msg}`, 'red');
      throw new Error(msg);
    }
  }
}


