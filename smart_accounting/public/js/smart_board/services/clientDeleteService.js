/**
 * ClientDeleteService
 * - Data access for deleting Customers from the product shell (/smart).
 */
import { notify } from './uiAdapter.js';
import { getErrorMessage } from '../utils/errorMessage.js';
import { isDesk } from '../utils/env.js';

export class ClientDeleteService {
  static async deleteClient(name) {
    const docname = String(name || '').trim();
    if (!docname) throw new Error('Client ID is required');

    try {
      const r = await frappe.call({
        method: 'smart_accounting.api.clients.delete_client',
        type: 'POST',
        args: { name: docname },
      });
      return r?.message || {};
    } catch (e) {
      const msg = getErrorMessage(e) || 'Delete client failed';
      if (isDesk()) notify(`Delete client failed: ${msg}`, 'red');
      throw new Error(msg);
    }
  }
}


