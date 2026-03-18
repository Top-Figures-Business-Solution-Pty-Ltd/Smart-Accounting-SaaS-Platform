/**
 * ClientsService
 * - Data access for Customers + entity summary
 */
import { Perf } from '../utils/perf.js';

function getRuntimeProjectScope() {
  const cfg = window.smart_accounting || {};
  const allowed = Array.isArray(cfg?.allowed_project_types)
    ? cfg.allowed_project_types.map((x) => String(x || '').trim()).filter(Boolean)
    : [];
  const excluded = Array.isArray(cfg?.excluded_project_types)
    ? cfg.excluded_project_types.map((x) => String(x || '').trim()).filter(Boolean)
    : [];
  const out = {};
  if (allowed.length) out.project_types = allowed;
  if (excluded.length) out.excluded_project_types = excluded;
  return out;
}

export class ClientsService {
  static async fetchClients({ search = '', limitStart = 0, limit = 50, includeDisabled = false, disabledOnly = false } = {}) {
    return await Perf.timeAsync('clients.get_clients', async () => {
      const projectScope = getRuntimeProjectScope();
      const r = await frappe.call({
        method: 'smart_accounting.api.clients.get_clients',
        args: {
          search: String(search || ''),
          limit_start: Math.max(0, Number(limitStart) || 0),
          limit_page_length: Math.max(1, Number(limit) || 50),
          include_disabled: includeDisabled ? 1 : 0,
          disabled_only: disabledOnly ? 1 : 0,
          ...(projectScope || {}),
        }
      });
      return {
        items: r?.message?.items || [],
        meta: r?.message?.meta || {},
      };
    }, () => ({ search: String(search || ''), limitStart: Number(limitStart) || 0, limit: Number(limit) || 50, includeDisabled: !!includeDisabled, disabledOnly: !!disabledOnly }));
  }

  static async checkClientNameExists(name = '', { excludeName = '' } = {}) {
    return await Perf.timeAsync('clients.check_name', async () => {
      const r = await frappe.call({
        method: 'smart_accounting.api.clients.check_client_name_exists',
        args: {
          name: String(name || ''),
          exclude_name: String(excludeName || ''),
        }
      });
      return r?.message || { exists: false, items: [] };
    }, () => ({ name: String(name || ''), exclude_name: String(excludeName || '') }));
  }

  static async archiveClient(name = '') {
    const r = await frappe.call({
      method: 'smart_accounting.api.clients.archive_client',
      args: { name: String(name || '').trim() }
    });
    return r?.message || {};
  }

  static async restoreClient(name = '') {
    const r = await frappe.call({
      method: 'smart_accounting.api.clients.restore_client',
      args: { name: String(name || '').trim() }
    });
    return r?.message || {};
  }
}


