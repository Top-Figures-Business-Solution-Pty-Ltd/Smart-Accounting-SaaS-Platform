/**
 * Column Manager Modal (no Desk dependency)
 * - Supports: show/hide columns, drag to reorder, save/cancel
 * - Persist: caller decides (e.g. Saved View.columns)
 */
import { escapeHtml } from '../../utils/dom.js';
import { Modal } from '../Common/Modal.js';

export class ColumnManagerModal {
  constructor({ title = 'Manage Columns', columns = [], onSave, onClose } = {}) {
    this.title = title;
    // columns: [{ field, label, enabled }]
    this.columns = (columns || []).map(c => ({
      field: c.field,
      label: c.label || c.field,
      enabled: c.enabled !== false,
    }));
    this.onSave = onSave || (() => {});
    this.onClose = onClose || (() => {});

    this._overlay = null;
    this._dragIndex = null;
    this._onKeyDown = null;
    this._modal = null;
  }

  open() {
    this.close(); // ensure single instance

    const content = document.createElement('div');
    content.innerHTML = `
      <div class="sb-modal__hint">勾选要显示的列，拖拽改变顺序（团队共享默认列）。</div>
      <div class="sb-colmgr" id="sbColMgrList">
        ${this.columns.map((c, idx) => this._rowHTML(c, idx)).join('')}
      </div>
    `;

    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.justifyContent = 'flex-end';
    footer.style.gap = '10px';
    footer.innerHTML = `
      <button class="btn btn-default" type="button" id="sbColMgrCancel">Cancel</button>
      <button class="btn btn-primary" type="button" id="sbColMgrSave">Save</button>
    `;

    this._modal = new Modal({
      title: this.title,
      contentEl: content,
      footerEl: footer,
      onClose: () => this.onClose()
    });

    this._modal.open();

    footer.querySelector('#sbColMgrCancel')?.addEventListener('click', () => this.close());
    footer.querySelector('#sbColMgrSave')?.addEventListener('click', () => this._handleSave());

    const list = content.querySelector('#sbColMgrList');
    if (list) this._bindDnD(list);
  }

  _rowHTML(c, idx) {
    return `
      <div class="sb-colmgr__row" draggable="true" data-index="${idx}">
        <div class="sb-colmgr__drag" title="Drag to reorder">⋮⋮</div>
        <label class="sb-colmgr__label">
          <input type="checkbox" class="sb-colmgr__check" data-index="${idx}" ${c.enabled ? 'checked' : ''}/>
          <span class="sb-colmgr__text">${escapeHtml(c.label)}</span>
          <span class="sb-colmgr__field">${escapeHtml(c.field)}</span>
        </label>
      </div>
    `;
  }

  _bindDnD(listEl) {
    listEl.addEventListener('change', (e) => {
      const cb = e.target?.closest?.('.sb-colmgr__check');
      if (!cb) return;
      const idx = Number(cb.dataset.index);
      if (Number.isFinite(idx) && this.columns[idx]) {
        this.columns[idx].enabled = !!cb.checked;
      }
    });

    listEl.addEventListener('dragstart', (e) => {
      const row = e.target?.closest?.('.sb-colmgr__row');
      if (!row) return;
      this._dragIndex = Number(row.dataset.index);
      row.classList.add('is-dragging');
      try { e.dataTransfer.effectAllowed = 'move'; } catch (err) {}
    });

    listEl.addEventListener('dragend', (e) => {
      const row = e.target?.closest?.('.sb-colmgr__row');
      row?.classList.remove('is-dragging');
      this._dragIndex = null;
      // re-render to normalize indices after drag
      this._rerenderList();
    });

    listEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      const overRow = e.target?.closest?.('.sb-colmgr__row');
      if (!overRow) return;
      const overIndex = Number(overRow.dataset.index);
      if (this._dragIndex == null || overIndex === this._dragIndex) return;

      // Move item in array
      const moved = this.columns.splice(this._dragIndex, 1)[0];
      this.columns.splice(overIndex, 0, moved);
      this._dragIndex = overIndex;
      this._rerenderList();
    });
  }

  _rerenderList() {
    const list = this._overlay?.querySelector?.('#sbColMgrList');
    if (!list) return;
    list.innerHTML = this.columns.map((c, idx) => this._rowHTML(c, idx)).join('');
  }

  _handleSave() {
    const enabled = this.columns.filter(c => c.enabled);
    if (enabled.length === 0) {
      alert('至少需要保留 1 列');
      return;
    }
    this.onSave(enabled);
    this.close();
  }

  close() {
    this._modal?.close?.();
    this._modal = null;
  }
}


