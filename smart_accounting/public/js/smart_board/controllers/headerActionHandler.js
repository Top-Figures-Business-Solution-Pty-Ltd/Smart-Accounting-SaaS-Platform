/**
 * Header Action Handler
 * Keeps app.js small by moving action switch to a dedicated module.
 */

import { msgprint } from '../services/uiAdapter.js';
import { openNewClientFlow } from './newClientController.js';
import { openBoardSettingsFlow } from './boardSettingsController.js';

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
    case 'board_settings':
      return openBoardSettingsFlow({ app });
    case 'new_client':
      return openNewClientFlow({ app });
    case 'clients_search':
      return app?.setClientsSearch?.(data);
    case 'clients_columns':
      return app?.showClientsColumnManager?.();
    case 'clients_normalize':
      return app?.normalizeClientNames?.();
    case 'dashboard_refresh':
      return app?.loadViewData?.('dashboard');
    case 'client_projects_back':
      return app?.goBackToClients?.();
    case 'client_projects_search':
      return app?.performSearch?.(data);
    default:
      console.warn('Unknown action:', action, data);
  }
}


