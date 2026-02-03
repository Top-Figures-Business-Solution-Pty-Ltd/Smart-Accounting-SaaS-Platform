/**
 * BoardStatusModal (website-safe)
 * - Configure allowed status options for a specific board (Project Type).
 */
import { Modal } from '../Common/Modal.js';
import { escapeHtml } from '../../utils/dom.js';

export class BoardStatusModal {
  constructor({ title = 'Status Settings', pool = [], selected = [], onSave, onClose } = {}) {
    this.title = title;
    this.pool = Array.isArray(pool) ? pool : [];
    this.selected = new Set((Array.isArray(selected) ? selected : []).map(String));
    this.onSave = typeof onSave === 'function' ? onSave : (async () => {});
    this.onClose = typeof onClose === 'function' ? onClose : (() => {});
    this._modal = null;
    this._root = null;
  }

  open() {
    this.close();

    const content = document.createElement('div');
    content.innerHTML = `
      <div class="sb-status-modal">
        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:10px;">
          <input class="form-control" id="sbStatusSearch" placeholder="Search status..." style="max-width:320px;" />
          <button class="btn btn-default" type="button" id="sbStatusSelectAll">Select all</button>
          <button class="btn btn-default" type="button" id="sbStatusClearAll">Clear</button>
          <div class="text-muted" style="font-size:12px;">Tip: leaving it as “all selected” means no custom board config.</div>
        </div>
        <div class="sb-status-modal__list" id="sbStatusList"></div>
        <div class="sb-newproj__error text-danger" id="sbStatusError" style="display:none; margin-top:10px;"></div>
      </div>
    `;

    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.justifyContent = 'flex-end';
    footer.style.gap = '10px';
    footer.innerHTML = `
      <button class="btn btn-default" type="button" id="sbStatusCancel">Cancel</button>
      <button class="btn btn-primary" type="button" id="sbStatusSave">Save</button>
    `;

    this._modal = new Modal({
      title: this.title,
      contentEl: content,
      footerEl: footer,
      onClose: () => this.onClose(),
    });
    this._modal.open();
    this._root = content;

    this._renderList('');

    content.querySelector('#sbStatusSearch')?.addEventListener('input', (e) => {
      const q = String(e?.target?.value || '').trim();
      this._renderList(q);
    });
    content.querySelector('#sbStatusSelectAll')?.addEventListener('click', () => {
      for (const s of this.pool) this.selected.add(String(s));
      const q = String(content.querySelector('#sbStatusSearch')?.value || '').trim();
      this._renderList(q);
    });
    content.querySelector('#sbStatusClearAll')?.addEventListener('click', () => {
      this.selected = new Set();
      const q = String(content.querySelector('#sbStatusSearch')?.value || '').trim();
      this._renderList(q);
    });

    footer.querySelector('#sbStatusCancel')?.addEventListener('click', () => this.close());
    footer.querySelector('#sbStatusSave')?.addEventListener('click', () => this._handleSave());
  }

  close() {
    this._modal?.close?.();
    this._modal = null;
    this._root = null;
  }

  _setError(msg) {
    const el = this._root?.querySelector?.('#sbStatusError');
    if (!el) return;
    const m = String(msg || '').trim();
    el.textContent = m;
    el.style.display = m ? 'block' : 'none';
  }

  _renderList(query) {
    const q = String(query || '').toLowerCase();
    const list = this._root?.querySelector?.('#sbStatusList');
    if (!list) return;
    const items = (this.pool || []).filter((s) => {
      const t = String(s || '');
      return !q || t.toLowerCase().includes(q);
    });
    list.innerHTML = `
      <div style="border:1px solid var(--smart-board-border); border-radius:12px; background:#fff; padding:8px;">
        ${items.map((s) => {
          const v = String(s || '').trim();
          const checked = this.selected.has(v) ? 'checked' : '';
          return `
            <label style="display:flex; align-items:center; gap:10px; padding:8px 8px; border-radius:10px; cursor:pointer;">
              <input type="checkbox" class="sb-status-cb" data-value="${escapeHtml(v)}" ${checked} />
              <span style="font-weight:600;">${escapeHtml(v)}</span>
            </label>
          `;
        }).join('')}
      </div>
    `;

    list.querySelectorAll('input.sb-status-cb')?.forEach((cb) => {
      cb.addEventListener('change', (e) => {
        const v = e?.target?.getAttribute?.('data-value') || '';
        const val = String(v || '').trim();
        if (!val) return;
        if (e.target.checked) this.selected.add(val);
        else this.selected.delete(val);
      });
    });
  }

  async _handleSave() {
    this._setError('');
    const selected = Array.from(this.selected || []).map(String).filter(Boolean);
    if (!selected.length) {
      this._setError('Please select at least 1 status.');
      return;
    }
    const btn = this._modal?._overlay?.querySelector?.('#sbStatusSave');
    if (btn) btn.disabled = true;
    try {
      await this.onSave(selected);
      this.close();
    } catch (e) {
      this._setError(e?.message || String(e));
    } finally {
      if (btn) btn.disabled = false;
    }
  }
}


