/**
 * BoardSettingsModal
 * - UI-only: manage Project Type ordering (drag & drop).
 */
import { Modal } from '../Common/Modal.js';
import { escapeHtml } from '../../utils/dom.js';

export class BoardSettingsModal {
  constructor({ title = 'Board Settings', projectTypes = [], onSave, onClose } = {}) {
    this.title = title;
    this.projectTypes = Array.isArray(projectTypes) ? projectTypes : [];
    this.onSave = onSave || (async () => {});
    this.onClose = onClose || (() => {});

    this._modal = null;
    this._root = null;
    this._list = [...this.projectTypes];
    this._drag = { from: null };
  }

  async open() {
    this.close();
    const content = document.createElement('div');
    content.innerHTML = `
      <div class="sb-board-settings">
        <div class="text-muted" style="font-size:12px; margin-bottom:10px;">
          Drag to reorder Project Types shown in the left sidebar.
        </div>
        <div id="sbBoardSettingsList"></div>
        <div class="sb-newproj__error text-danger" id="sbBoardSettingsError" style="display:none;"></div>
      </div>
    `;

    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.justifyContent = 'flex-end';
    footer.style.gap = '10px';
    footer.innerHTML = `
      <button class="btn btn-default" type="button" id="sbBoardSettingsCancel">Cancel</button>
      <button class="btn btn-primary" type="button" id="sbBoardSettingsSave">Save</button>
    `;

    this._modal = new Modal({
      title: this.title,
      contentEl: content,
      footerEl: footer,
      onClose: () => this.onClose(),
    });
    this._modal.open();
    this._root = content;

    this._renderList();

    footer.querySelector('#sbBoardSettingsCancel')?.addEventListener('click', () => this.close());
    footer.querySelector('#sbBoardSettingsSave')?.addEventListener('click', () => this._handleSave());
  }

  close() {
    this._modal?.close?.();
    this._modal = null;
    this._root = null;
  }

  _setError(msg) {
    const el = this._root?.querySelector?.('#sbBoardSettingsError');
    if (!el) return;
    const m = String(msg || '').trim();
    el.textContent = m;
    el.style.display = m ? 'block' : 'none';
  }

  _renderList() {
    const mount = this._root?.querySelector?.('#sbBoardSettingsList');
    if (!mount) return;
    const rows = this._list.map((n, idx) => {
      return `
        <div class="sb-bs-row" draggable="true" data-idx="${idx}" style="display:flex; align-items:center; gap:10px; padding:10px 12px; border:1px solid var(--smart-board-border); border-radius:12px; background:#fff; margin-bottom:8px;">
          <span class="text-muted" style="cursor:grab;">☰</span>
          <div style="flex:1; font-weight:600;">${escapeHtml(n)}</div>
          <button class="btn btn-default btn-sm" type="button" data-action="up" data-idx="${idx}">↑</button>
          <button class="btn btn-default btn-sm" type="button" data-action="down" data-idx="${idx}">↓</button>
        </div>
      `;
    }).join('');
    mount.innerHTML = rows || `<div class="text-muted">No Project Types found.</div>`;

    // Drag events (delegated)
    mount.querySelectorAll('.sb-bs-row').forEach((el) => {
      el.addEventListener('dragstart', (e) => {
        const i = Number(el.getAttribute('data-idx') || -1);
        this._drag.from = Number.isFinite(i) ? i : null;
        try { e.dataTransfer.effectAllowed = 'move'; } catch (e2) {}
      });
      el.addEventListener('dragover', (e) => {
        e.preventDefault();
        try { e.dataTransfer.dropEffect = 'move'; } catch (e2) {}
      });
      el.addEventListener('drop', (e) => {
        e.preventDefault();
        const from = this._drag.from;
        const to = Number(el.getAttribute('data-idx') || -1);
        if (from == null || !Number.isFinite(to) || to < 0) return;
        this._move(from, to);
      });
    });

    // Up/down buttons
    mount.querySelectorAll('button[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-action');
        const idx = Number(btn.getAttribute('data-idx') || -1);
        if (!Number.isFinite(idx) || idx < 0) return;
        if (action === 'up') this._move(idx, Math.max(0, idx - 1));
        if (action === 'down') this._move(idx, Math.min(this._list.length - 1, idx + 1));
      });
    });
  }

  _move(from, to) {
    if (from === to) return;
    const list = [...this._list];
    const [item] = list.splice(from, 1);
    list.splice(to, 0, item);
    this._list = list;
    this._drag.from = null;
    this._renderList();
  }

  async _handleSave() {
    this._setError('');
    const btn = this._modal?._overlay?.querySelector?.('#sbBoardSettingsSave');
    if (btn) btn.disabled = true;
    try {
      await this.onSave([...this._list]);
      this.close();
    } catch (e) {
      this._setError(e?.message || String(e));
    } finally {
      if (btn) btn.disabled = false;
    }
  }
}


