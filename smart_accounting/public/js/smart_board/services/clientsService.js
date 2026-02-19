/**
 * ClientsService
 * - Data access for Customers + entity summary
 */
import { Perf } from '../utils/perf.js';

export class ClientsService {
  static async fetchClients({ search = '', limitStart = 0, limit = 50 } = {}) {
    return await Perf.timeAsync('clients.get_clients', async () => {
      const r = await frappe.call({
        method: 'smart_accounting.api.clients.get_clients',
        args: {
          search: String(search || ''),
          limit_start: Math.max(0, Number(limitStart) || 0),
          limit_page_length: Math.max(1, Number(limit) || 50),
        }
      });
      return {
        items: r?.message?.items || [],
        meta: r?.message?.meta || {},
      };
    }, () => ({ search: String(search || ''), limitStart: Number(limitStart) || 0, limit: Number(limit) || 50 }));
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
}


