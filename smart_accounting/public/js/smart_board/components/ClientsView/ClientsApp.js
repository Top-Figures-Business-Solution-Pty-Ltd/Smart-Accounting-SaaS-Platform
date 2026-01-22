/**
 * ClientsApp
 * - Orchestrates Clients table + store integration
 */
import { ClientsTable } from './ClientsTable.js';
import { notify } from '../../services/uiAdapter.js';
import { getDefaultClientColumns, loadClientColumns } from '../../utils/clientsColumns.js';
import { openClientsColumnsManager } from '../../controllers/clientsColumnsController.js';

export class ClientsApp {
  constructor(container, { store, onOpenProjects } = {}) {
    this.container = container;
    this.store = store;
    this.onOpenProjects = typeof onOpenProjects === 'function' ? onOpenProjects : (() => {});
    this._unsub = null;
    this._table = null;
    this._lastSearch = '';
    this._columns = loadClientColumns() || getDefaultClientColumns();
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
      }
    });

    if (this.store?.subscribe) {
      this._unsub = this.store.subscribe(() => this.render());
    }

    // Initial load
    await this.store?.dispatch?.('clients/fetchClients', { search: '', limit: this._pageSize });
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
    });
  }

  async search(q) {
    this._lastSearch = String(q || '');
    await this.store?.dispatch?.('clients/fetchClients', { search: this._lastSearch, limit: this._pageSize });
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
    const last = state?.clients?.lastFilters || { search: this._lastSearch || '', limit: this._pageSize };
    // Ensure paging size is consistent even if older state didn't persist `limit`.
    const effective = { ...(last || {}), limit: Number(last?.limit || this._pageSize) };
    await this.store?.dispatch?.('clients/fetchMoreClients', effective);
  }

  destroy() {
    try { this._unsub?.(); } catch (e) {}
    this._unsub = null;
    this._table = null;
    try { this.container.innerHTML = ''; } catch (e) {}
  }
}


