/**
 * ClientCreateService
 * - Data access for creating Customers from the product shell (/smart).
 * - Kept separate from ClientsService list/query logic.
 */
import { notify } from './uiAdapter.js';

export class ClientCreateService {
  static async createClient(payload = {}) {
    const name = String(payload?.customer_name || '').trim();
    if (!name) throw new Error('Customer Name is required');

    try {
      const r = await frappe.call({
        method: 'smart_accounting.api.clients.create_client',
        type: 'POST',
        args: { payload },
      });
      return r?.message?.item || null;
    } catch (e) {
      let msg = e?.message || '';
      // Frappe often returns server messages as a JSON string array in _server_messages
      try {
        const raw = e?._server_messages;
        if (raw) {
          const arr = JSON.parse(raw);
          const first = Array.isArray(arr) ? arr[0] : null;
          const decoded = first ? JSON.parse(first) : null;
          if (decoded?.message) msg = decoded.message;
        }
      } catch (e2) {}
      if (!msg) msg = (typeof e === 'string') ? e : (e?.exc || e?.exception || '');
      if (!msg) msg = JSON.stringify(e);
      notify(`Create client failed: ${msg}`, 'red');
      throw e;
    }
  }
}


