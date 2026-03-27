import { UsersService } from '../../services/usersService.js';
import { escapeHtml } from '../../utils/dom.js';

export class UsersApp {
  constructor(container) {
    this.container = container;
    this._state = {
      items: [],
      loading: false,
      error: null,
      search: '',
      totalCount: 0,
    };
    this._bind = this._bind.bind(this);
    this._searchTimer = null;
  }

  async init() {
    this.render();
    this.container.addEventListener('input', this._bind);
    await this._fetch({ reset: true });
  }

  destroy() {
    try { this.container.removeEventListener('input', this._bind); } catch (e) {}
    if (this._searchTimer) {
      clearTimeout(this._searchTimer);
      this._searchTimer = null;
    }
    try { this.container.innerHTML = ''; } catch (e) {}
  }

  _bind(e) {
    const input = e.target?.closest?.('#sbUsersSearch');
    if (!input) return;
    this._state.search = String(input.value || '');
    if (this._searchTimer) clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(() => {
      this._fetch({ reset: true });
    }, 180);
  }

  async _fetch({ reset = false } = {}) {
    this._state.loading = true;
    this._state.error = null;
    this.render();
    try {
      const r = await UsersService.fetchUsers({
        search: this._state.search,
        limitStart: 0,
        limit: 200,
      });
      this._state.items = Array.isArray(r?.items) ? r.items : [];
      this._state.totalCount = Number(r?.meta?.total_count || this._state.items.length || 0);
    } catch (e) {
      this._state.error = e?.message || String(e);
      if (reset) this._state.items = [];
      this._state.totalCount = 0;
    } finally {
      this._state.loading = false;
      this.render();
    }
  }

  render() {
    const { items, loading, error, search, totalCount } = this._state;
    const rows = (items || []).map((user) => {
      const fullName = escapeHtml(user?.full_name || user?.name || 'Unknown User');
      const email = escapeHtml(user?.email || user?.name || '');
      const disabled = Number(user?.enabled || 0) ? '' : '<span class="text-muted" style="font-size:12px;">Disabled</span>';
      return `
        <tr>
          <td>
            <div style="font-weight:600;">${fullName}</div>
            ${disabled}
          </td>
          <td><a href="mailto:${email}">${email}</a></td>
        </tr>
      `;
    }).join('');

    this.container.innerHTML = `
      <div class="sb-page">
        <div class="sb-users__bar" style="display:flex;gap:12px;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;">
          <input
            id="sbUsersSearch"
            class="form-control"
            type="search"
            placeholder="Search name or email"
            value="${escapeHtml(search)}"
            style="max-width:320px;"
          />
          <div class="text-muted" style="font-size:13px;">${loading ? 'Loading users...' : `${totalCount} users`}</div>
        </div>

        ${error ? `<div class="text-danger" style="margin-bottom:12px;">${escapeHtml(error)}</div>` : ''}

        <div class="sb-users__table-wrap" style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
          <table class="table table-bordered" style="margin:0;">
            <thead>
              <tr>
                <th style="width:50%;">Name</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              ${rows || `<tr><td colspan="2" class="text-muted" style="text-align:center;padding:24px;">${loading ? 'Loading...' : 'No users found.'}</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
}
