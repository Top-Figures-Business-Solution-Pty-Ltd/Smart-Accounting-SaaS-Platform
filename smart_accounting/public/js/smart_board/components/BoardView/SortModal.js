import { Modal } from '../Common/Modal.js';
import { escapeHtml } from '../../utils/dom.js';

export class SortModal {
  constructor({ options = [], initialField = '', initialOrder = 'asc', onApply, onClear, onClose } = {}) {
    this.options = Array.isArray(options) ? options : [];
    this.initialField = String(initialField || '').trim();
    this.initialOrder = String(initialOrder || 'asc').trim().toLowerCase() === 'desc' ? 'desc' : 'asc';
    this.onApply = typeof onApply === 'function' ? onApply : (() => {});
    this.onClear = typeof onClear === 'function' ? onClear : (() => {});
    this.onClose = typeof onClose === 'function' ? onClose : (() => {});
    this._modal = null;
    this._root = null;
  }

  open() {
    this.close();
    const content = document.createElement('div');
    const optionHtml = this.options.map((opt) => {
      const value = String(opt?.value || '').trim();
      const label = String(opt?.label || value).trim();
      return `<option value="${escapeHtml(value)}" ${value === this.initialField ? 'selected' : ''}>${escapeHtml(label)}</option>`;
    }).join('');
    content.innerHTML = `
      <div class="sb-sort">
        <div class="sb-sort__row">
          <label class="sb-sort__label">Sort by</label>
          <select class="form-control" id="sbSortField">
            <option value="">Choose column</option>
            ${optionHtml}
          </select>
        </div>
        <div class="sb-sort__row">
          <label class="sb-sort__label">Order</label>
          <select class="form-control" id="sbSortOrder">
            <option value="asc" ${this.initialOrder === 'asc' ? 'selected' : ''}>Ascending</option>
            <option value="desc" ${this.initialOrder === 'desc' ? 'selected' : ''}>Descending</option>
          </select>
        </div>
      </div>
    `;

    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.justifyContent = 'space-between';
    footer.style.gap = '10px';
    footer.innerHTML = `
      <button class="btn btn-default" type="button" id="sbSortClear">Clear</button>
      <div style="display:flex; gap:10px;">
        <button class="btn btn-default" type="button" id="sbSortCancel">Cancel</button>
        <button class="btn btn-primary" type="button" id="sbSortApply">Apply</button>
      </div>
    `;

    this._modal = new Modal({
      title: 'Sort',
      contentEl: content,
      footerEl: footer,
      onClose: () => this.onClose(),
    });
    this._modal.open();
    this._root = content;

    footer.querySelector('#sbSortCancel')?.addEventListener('click', () => this.close());
    footer.querySelector('#sbSortClear')?.addEventListener('click', async () => {
      await this.onClear?.();
      this.close();
    });
    footer.querySelector('#sbSortApply')?.addEventListener('click', async () => {
      const field = String(this._root?.querySelector?.('#sbSortField')?.value || '').trim();
      const order = String(this._root?.querySelector?.('#sbSortOrder')?.value || 'asc').trim().toLowerCase();
      if (!field) return;
      await this.onApply?.({ field, order });
      this.close();
    });
  }

  close() {
    this._modal?.close?.();
    this._modal = null;
    this._root = null;
  }
}
