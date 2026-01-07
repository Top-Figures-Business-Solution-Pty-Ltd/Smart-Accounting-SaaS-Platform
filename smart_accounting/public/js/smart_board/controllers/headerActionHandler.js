/**
 * Header Action Handler
 * Keeps app.js small by moving action switch to a dedicated module.
 */

import { msgprint } from '../services/uiAdapter.js';

export async function handleHeaderAction(app, action, data) {
  switch (action) {
    case 'new_project':
      return app?.createNewProject?.();
    case 'filter':
      return app?.applyFilters?.(data);
    case 'search':
      return app?.performSearch?.(data);
    case 'manage_columns':
      return app?.showColumnManager?.();
    case 'new_client':
      return msgprint('New Client - coming soon.');
    case 'clients_search':
      return console.log('Client search:', data);
    case 'dashboard_refresh':
      return app?.loadViewData?.('dashboard');
    default:
      console.warn('Unknown action:', action, data);
  }
}


