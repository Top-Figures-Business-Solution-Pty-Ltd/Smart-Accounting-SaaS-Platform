/**
 * ClientsTable (website-safe)
 * - Pure UI: renders list + load more (search/columns handled by global header)
 */
import { escapeHtml } from '../../utils/dom.js';

export class ClientsTable {
  constructor(container, { onLoadMore, onRowClick, onOpenProjects } = {}) {
    this.container = container;
    this.onLoadMore = typeof onLoadMore === 'function' ? onLoadMore : (() => {});
    this.onRowClick = typeof onRowClick === 'function' ? onRowClick : (() => {});
    this.onOpenProjects = typeof onOpenProjects === 'function' ? onOpenProjects : (() => {});
    this._state = { items: [], loading: false, loadingMore: false, hasMore: true, error: null, columns: [] };
  }

  render(state) {
    this._state = { ...(this._state || {}), ...(state || {}) };
    const items = Array.isArray(this._state.items) ? this._state.items : [];
    const loading = !!this._state.loading;
    const err = this._state.error;
    const hasMore = this._state.hasMore !== false;
    const loadingMore = !!this._state.loadingMore;
    const cols = Array.isArray(this._state.columns) && this._state.columns.length ? this._state.columns : ['customer_name','entity_type','abn','year_end','entities_count'];
    const totalCount = (this._state.totalCount == null) ? null : Number(this._state.totalCount);
    const showing = items.length;

    const valueFor = (client, field) => {
      const pe = client?.primary_entity || null;
      if (field === 'customer_name') return escapeHtml(client?.customer_name || client?.name || '—');
      if (field === 'customer_group') return escapeHtml(client?.customer_group || '—');
      if (field === 'territory') return escapeHtml(client?.territory || '—');
      if (field === 'entities_count') return `<span class="text-muted">${Number(client?.entities_count || 0) || '—'}</span>`;
      if (field === 'project_count') {
        const n = Number(client?.project_count || 0) || 0;
        return `<button type="button" class="btn btn-link p-0 sb-client-open-projects" data-client="${escapeHtml(client?.name || '')}">${n}</button>`;
      }
      if (field === 'active_project_count') {
        const n = Number(client?.active_project_count || 0) || 0;
        return `<span class="text-muted">${n}</span>`;
      }
      if (field === 'entity_type') return escapeHtml(pe?.entity_type || '—');
      if (field === 'abn') return escapeHtml(pe?.abn || '—');
      if (field === 'year_end') return escapeHtml(pe?.year_end || '—');
      return escapeHtml(String(client?.[field] ?? '—'));
    };

    const labelFor = (field) => ({
      customer_name: 'Client',
      project_count: 'Projects',
      active_project_count: 'Active',
      entity_type: 'Entity Type',
      abn: 'ABN',
      year_end: 'Year End',
      entities_count: 'Entities',
      customer_group: 'Group',
      territory: 'Territory',
    }[field] || field);

    const thead = cols.map((f) => `<th>${escapeHtml(labelFor(f))}</th>`).join('');
    const rows = items.map((c) => {
      const name = escapeHtml(c?.name || '');
      const tds = cols.map((f, idx) => {
        const val = valueFor(c, f);
        const isFirst = idx === 0;
        return `<td ${isFirst ? 'style="font-weight:600;"' : ''}>${val}</td>`;
      }).join('');
      return `<tr class="sb-clients__row" data-name="${name}">${tds}</tr>`;
    }).join('');

    const body = (() => {
      if (loading) return `<div class="text-muted" style="padding:12px;">Loading clients…</div>`;
      if (err) return `<div class="text-danger" style="padding:12px;">Failed to load: ${escapeHtml(err)}</div>`;
      if (!items.length) return `<div class="text-muted" style="padding:12px;">No clients found.</div>`;
      return `
        <div class="sb-table-scroll" style="border:1px solid var(--smart-board-border); border-radius:12px; background:#fff;">
          <table class="table table-borderless" style="margin:0;">
            <thead style="position:sticky; top:0; background:#fff; border-bottom:1px solid rgba(0,0,0,0.06);">
              <tr>
                ${thead}
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      `;
    })();

    this.container.innerHTML = `
      <div class="sb-page">
        ${body}
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px;">
          <div class="text-muted" style="font-size:12px;">
            ${totalCount == null ? '' : `Showing ${showing} / ${totalCount}`}
          </div>
          <button class="btn btn-default" type="button" id="sbClientsLoadMore" ${(!hasMore || loading || loadingMore) ? 'disabled' : ''}>
            ${loadingMore ? 'Loading…' : (hasMore ? 'Load more' : 'No more')}
          </button>
        </div>
      </div>
    `;

    this.container.querySelector('#sbClientsLoadMore')?.addEventListener('click', () => this.onLoadMore());
    this.container.querySelector('tbody')?.addEventListener('click', (e) => {
      const btn = e.target?.closest?.('.sb-client-open-projects');
      if (btn) {
        e.preventDefault();
        e.stopPropagation();
        const name = btn.getAttribute('data-client') || '';
        const client = items.find((x) => String(x?.name) === String(name)) || null;
        if (client) this.onOpenProjects(client);
        return;
      }
      const tr = e.target?.closest?.('tr[data-name]');
      if (!tr) return;
      const name2 = tr.dataset.name;
      const client = items.find((x) => String(x?.name) === String(name2)) || null;
      if (client) this.onRowClick(client);
    });
  }
}


