/**
 * ClientsService
 * - Data access for Customers + entity summary
 */
export class ClientsService {
  static async fetchClients({ search = '', limitStart = 0, limit = 50 } = {}) {
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
  }
}


