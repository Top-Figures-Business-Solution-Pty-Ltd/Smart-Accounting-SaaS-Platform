/**
 * newClientController
 * - Orchestrates the New Client modal for website shell (/smart).
 */
import { NewClientModal } from '../components/ClientsView/NewClientModal.js';
import { ClientCreateService } from '../services/clientCreateService.js';
import { notify } from '../services/uiAdapter.js';
import { isDesk } from '../utils/env.js';

export async function openNewClientFlow({ app, initial = {}, onCreated } = {}) {
  // Desk: keep native ERPNext behavior
  if (isDesk()) {
    try { frappe?.new_doc?.('Customer'); } catch (e) {}
    return null;
  }

  const store = app?.store || null;

  const modal = new NewClientModal({
    title: 'New Client',
    initial: initial || {},
    onSubmit: async (payload) => {
      const item = await ClientCreateService.createClient(payload);
      notify('Client created', 'green');
      try { onCreated?.(item); } catch (e) {}
      // Refresh clients list (keeps counts/ordering consistent)
      const last = store?.getState?.()?.clients?.lastFilters || { search: '' };
      try {
        await store?.dispatch?.('clients/fetchClients', { ...(last || {}), limit: 200 });
      } catch (e) {
        // best-effort: no-op
      }
      return item;
    },
  });

  await modal.open();
  return modal;
}


