/**
 * ClientUpdateService
 * - Data access for updating Customers from the product shell (/smart).
 */
import { notify } from './uiAdapter.js';
import { getErrorMessage } from '../utils/errorMessage.js';
import { isDesk } from '../utils/env.js';

export class ClientUpdateService {
  static async updateClient(payload = {}) {
    const name = String(payload?.name || '').trim();
    if (!name) throw new Error('Client ID is required');

    try {
      const r = await frappe.call({
        method: 'smart_accounting.api.clients.update_client',
        type: 'POST',
        args: { payload },
      });
      return r?.message?.item || null;
    } catch (e) {
      const msg = getErrorMessage(e) || 'Update client failed';
      // Website shell: avoid alert() popups; the modal will show the message.
      if (isDesk()) notify(`Update client failed: ${msg}`, 'red');
      throw new Error(msg);
    }
  }
}


