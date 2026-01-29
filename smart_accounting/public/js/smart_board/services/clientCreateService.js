/**
 * ClientCreateService
 * - Data access for creating Customers from the product shell (/smart).
 * - Kept separate from ClientsService list/query logic.
 */
import { notify } from './uiAdapter.js';
import { getErrorMessage } from '../utils/errorMessage.js';
import { isDesk } from '../utils/env.js';

export class ClientCreateService {
  static async createClient(payload = {}) {
    const name = String(payload?.customer_name || '').trim();
    if (!name) throw new Error('Client Name is required');

    try {
      const r = await frappe.call({
        method: 'smart_accounting.api.clients.create_client',
        type: 'POST',
        args: { payload },
      });
      return r?.message?.item || null;
    } catch (e) {
      const msg = getErrorMessage(e) || 'Create client failed';
      // Website shell: avoid alert() popups; the modal will show the message.
      if (isDesk()) notify(`Create client failed: ${msg}`, 'red');
      throw new Error(msg);
    }
  }
}


