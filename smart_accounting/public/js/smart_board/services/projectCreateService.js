/**
 * ProjectCreateService
 * - Data access for creating Projects from the product shell (/smart).
 * - Kept separate from ProjectService to avoid mixing list/query logic with creation workflow.
 */
import { notify } from './uiAdapter.js';
import { getErrorMessage } from '../utils/errorMessage.js';
import { isDesk } from '../utils/env.js';

export class ProjectCreateService {
  static _defaultCompany = undefined;
  static _defaultFiscalYear = undefined;

  static async getDefaultCompany() {
    if (this._defaultCompany !== undefined) return this._defaultCompany;
    try {
      const r = await frappe.call({
        method: 'frappe.client.get_list',
        args: {
          doctype: 'Company',
          fields: ['name'],
          order_by: 'creation asc',
          limit_page_length: 1,
        }
      });
      this._defaultCompany = String(r?.message?.[0]?.name || '').trim();
    } catch (e) {
      this._defaultCompany = '';
    }
    return this._defaultCompany;
  }

  static async getDefaultFiscalYear() {
    if (this._defaultFiscalYear !== undefined) return this._defaultFiscalYear;
    try {
      const r = await frappe.call({
        method: 'frappe.client.get_list',
        args: {
          doctype: 'Fiscal Year',
          fields: ['name'],
          order_by: 'year_start_date desc, creation desc',
          limit_page_length: 1,
        }
      });
      this._defaultFiscalYear = String(r?.message?.[0]?.name || '').trim();
    } catch (e) {
      this._defaultFiscalYear = '';
    }
    return this._defaultFiscalYear;
  }

  /**
   * Create a new Project using frappe.client.insert.
   * Returns the created doc (best-effort).
   */
  static async createProject(payload = {}, options = {}) {
    const doc = {
      doctype: 'Project',
      ...payload,
    };

    // Keep minimal required fields; other fields (e.g. status) can be set later by the user.
    const required = Array.isArray(options?.requiredFields) && options.requiredFields.length
      ? options.requiredFields
      : ['project_name', 'customer', 'company', 'custom_fiscal_year', 'project_type'];
    const missing = required.filter((k) => !String(doc?.[k] || '').trim());
    if (missing.length) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    try {
      const r = await frappe.call({
        method: 'frappe.client.insert',
        type: 'POST',
        // Prevent server-side msgprint popups from interrupting /smart UX.
        silent: true,
        args: { doc }
      });
      return r?.message || null;
    } catch (e) {
      const msg = getErrorMessage(e) || 'Create project failed';
      // Website shell: do not use alert() popups; surface the message in the modal only.
      if (isDesk()) notify(`Create project failed: ${msg}`, 'red');
      throw new Error(msg);
    }
  }
}


