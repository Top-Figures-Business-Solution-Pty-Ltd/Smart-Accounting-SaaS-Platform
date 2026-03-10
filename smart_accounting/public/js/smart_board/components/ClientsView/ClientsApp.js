/**
 * ClientsApp
 * - Orchestrates Clients table + store integration
 */
import { ClientsTable } from './ClientsTable.js';
import { notify } from '../../services/uiAdapter.js';
import { getDefaultClientColumns, loadClientColumns } from '../../utils/clientsColumns.js';
import { openClientsColumnsManager } from '../../controllers/clientsColumnsController.js';
import { openEditClientFlow } from '../../controllers/editClientController.js';
import { ClientDeleteService } from '../../services/clientDeleteService.js';
import { confirmDialog } from '../../services/uiAdapter.js';
import { ClientsService } from '../../services/clientsService.js';

export class ClientsApp {
  constructor(container, { store, onOpenProjects, archivedMode = false, canArchive = false, canRestore = false } = {}) {
    this.container = container;
    this.store = store;
    this.onOpenProjects = typeof onOpenProjects === 'function' ? onOpenProjects : (() => {});
    this.archivedMode = !!archivedMode;
    this.canArchive = !!canArchive;
    this.canRestore = !!canRestore;
    this._unsub = null;
    this._table = null;
    this._lastSearch = '';
    this._columns = this.archivedMode ? ['customer_name', 'entity_type', 'year_end', 'project_count'] : (loadClientColumns() || getDefaultClientColumns());
    this._pageSize = 50;
  }

  async init() {
    this._table = new ClientsTable(this.container, {
      onLoadMore: () => this.loadMore(),
      onRowClick: (client) => {
        // Placeholder until we implement a dedicated client details screen.
        notify(`Client: ${client?.customer_name || client?.name}`, 'blue');
      },
      onOpenProjects: (client) => {
        this.onOpenProjects(client);
      },
      onEdit: (client) => {
        openEditClientFlow({ app: this, client });
      },
      onDelete: (client) => {
        this.deleteClient(client);
      },
      onArchive: (client) => {
        this.archiveClient(client);
      },
      onRestore: (client) => {
        this.restoreClient(client);
      },
    });

    if (this.store?.subscribe) {
      this._unsub = this.store.subscribe(() => this.render());
    }

    // Initial load
    await this.store?.dispatch?.('clients/fetchClients', { search: '', limit: this._pageSize, disabledOnly: this.archivedMode });
    this.render();
  }

  render() {
    const state = this.store?.getState?.() || {};
    const clients = state.clients || {};
    this._table?.render?.({
      items: clients.items || [],
      loading: !!clients.loading,
      loadingMore: !!clients.loadingMore,
      hasMore: clients.hasMore !== false,
      error: clients.error || null,
      columns: this._columns,
      totalCount: clients.totalCount,
      archivedMode: this.archivedMode,
      canArchive: this.canArchive,
      canRestore: this.canRestore,
      projectCountClickable: !this.archivedMode,
    });
  }

  async search(q) {
    this._lastSearch = String(q || '');
    await this.store?.dispatch?.('clients/fetchClients', { search: this._lastSearch, limit: this._pageSize, disabledOnly: this.archivedMode });
  }

  openColumnsManager() {
    openClientsColumnsManager({
      onSaved: (fields) => {
        this._columns = Array.isArray(fields) && fields.length ? fields : getDefaultClientColumns();
        this.render();
      }
    });
  }

  async loadMore() {
    const state = this.store?.getState?.() || {};
    const last = state?.clients?.lastFilters || { search: this._lastSearch || '', limit: this._pageSize, disabledOnly: this.archivedMode };
    // Ensure paging size is consistent even if older state didn't persist `limit`.
    const effective = { ...(last || {}), limit: Number(last?.limit || this._pageSize), disabledOnly: this.archivedMode };
    await this.store?.dispatch?.('clients/fetchMoreClients', effective);
  }

  async deleteClient(client) {
    const name = client?.name || '';
    const label = client?.customer_name || name;
    const ok = await confirmDialog(`Delete client "${label}"? This cannot be undone.`);
    if (!ok) return;
    try {
      const r = await ClientDeleteService.deleteClient(name);
      if (r?.blocked) {
        notify(r?.message || 'Client has linked projects. Delete them first.', 'orange');
        return;
      }
      this.store?.commit?.('clients/removeClient', { name });
      notify('Client deleted', 'green');
    } catch (e) {
      notify(e?.message || 'Delete client failed', 'red');
    }
  }

  async archiveClient(client) {
    const name = client?.name || '';
    const label = client?.customer_name || name;
    const ok = await confirmDialog(`Archive client "${label}" and archive all related active projects?`);
    if (!ok) return;
    try {
      const r = await ClientsService.archiveClient(name);
      this.store?.commit?.('clients/removeClient', { name });
      notify(`Client archived${Number(r?.archived_projects || 0) ? ` (${Number(r.archived_projects)} projects)` : ''}`, 'green');
    } catch (e) {
      notify(e?.message || 'Archive client failed', 'red');
    }
  }

  async restoreClient(client) {
    const name = client?.name || '';
    const label = client?.customer_name || name;
    const ok = await confirmDialog(`Restore client "${label}" and restore its archived projects?`);
    if (!ok) return;
    try {
      const r = await ClientsService.restoreClient(name);
      this.store?.commit?.('clients/removeClient', { name });
      notify(`Client restored${Number(r?.restored_projects || 0) ? ` (${Number(r.restored_projects)} projects)` : ''}`, 'green');
    } catch (e) {
      notify(e?.message || 'Restore client failed', 'red');
    }
  }

  destroy() {
    try { this._unsub?.(); } catch (e) {}
    this._unsub = null;
    this._table = null;
    try { this.container.innerHTML = ''; } catch (e) {}
  }
}


