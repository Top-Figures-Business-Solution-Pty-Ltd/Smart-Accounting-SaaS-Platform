/**
 * Filter Modal (no Desk dependency)
 * P1: Status multi-select + Due date range + Link filters (Company/Client/Fiscal Year)
 */
import { escapeHtml } from '../../utils/dom.js';
import { Modal } from '../Common/Modal.js';
import { LinkInput } from '../Common/LinkInput.js';

export class FilterModal {
  constructor({ title = 'Filter', statusOptions = [], initial = {}, onApply, onClose } = {}) {
    this.title = title;
    this.statusOptions = statusOptions || [];
    this.initial = initial || {};
    this.onApply = onApply || (() => {});
    this.onClose = onClose || (() => {});

    this._modal = null;
    this._inputs = {};
  }

  open() {
    this.close();
    const selected = new Set(Array.isArray(this.initial.status) ? this.initial.status : []);
    const dateFrom = this.initial.date_from || '';
    const dateTo = this.initial.date_to || '';
    const initialCompany = this.initial.company || null;
    const initialCustomer = this.initial.customer || null;
    const initialFiscalYear = this.initial.fiscal_year || null;

    const content = document.createElement('div');
    content.innerHTML = `
      <div class="sb-modal__hint">Status/日期范围 + Company/Client/Fiscal Year（Link 搜索）。</div>

      <div style="margin-bottom:12px;">
        <div style="font-weight:600;font-size:13px;margin-bottom:8px;">Status</div>
        <div class="sb-filter__grid">
          ${this.statusOptions.map((s) => {
            const checked = selected.has(s) ? 'checked' : '';
            return `
              <label class="sb-filter__item">
                <input type="checkbox" class="sb-filter__status" value="${escapeHtml(s)}" ${checked} />
                <span>${escapeHtml(s)}</span>
              </label>
            `;
          }).join('')}
        </div>
      </div>

      <div style="display:flex; gap:12px; flex-wrap: wrap; margin-bottom: 12px;">
        <div style="min-width:220px; flex: 1;">
          <div style="font-weight:600;font-size:13px;margin-bottom:6px;">Company</div>
          <div id="sbFilterCompany"></div>
        </div>
        <div style="min-width:220px; flex: 1;">
          <div style="font-weight:600;font-size:13px;margin-bottom:6px;">Client</div>
          <div id="sbFilterCustomer"></div>
        </div>
        <div style="min-width:220px; flex: 1;">
          <div style="font-weight:600;font-size:13px;margin-bottom:6px;">Fiscal Year</div>
          <div id="sbFilterFiscalYear"></div>
        </div>
      </div>

      <div style="display:flex; gap:12px; flex-wrap: wrap;">
        <div style="min-width:220px; flex: 1;">
          <div style="font-weight:600;font-size:13px;margin-bottom:6px;">Due Date From</div>
          <input class="form-control" type="date" id="sbFilterDateFrom" value="${escapeHtml(dateFrom)}" />
        </div>
        <div style="min-width:220px; flex: 1;">
          <div style="font-weight:600;font-size:13px;margin-bottom:6px;">Due Date To</div>
          <input class="form-control" type="date" id="sbFilterDateTo" value="${escapeHtml(dateTo)}" />
        </div>
      </div>
    `;

    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.justifyContent = 'flex-end';
    footer.style.gap = '10px';
    footer.innerHTML = `
      <button class="btn btn-default" type="button" id="sbFilterClear">Clear</button>
      <button class="btn btn-default" type="button" id="sbFilterCancel">Cancel</button>
      <button class="btn btn-primary" type="button" id="sbFilterApply">Apply</button>
    `;

    this._modal = new Modal({
      title: this.title,
      contentEl: content,
      footerEl: footer,
      onClose: () => {
        this._destroyInputs();
        this.onClose();
      }
    });
    this._modal.open();

    // Mount link inputs (debounced search_link)
    this._inputs.company = new LinkInput(content.querySelector('#sbFilterCompany'), {
      doctype: 'Company',
      placeholder: 'Search Company...',
      initialValue: initialCompany
    });
    this._inputs.customer = new LinkInput(content.querySelector('#sbFilterCustomer'), {
      doctype: 'Customer',
      placeholder: 'Search Client...',
      initialValue: initialCustomer
    });
    this._inputs.fiscal_year = new LinkInput(content.querySelector('#sbFilterFiscalYear'), {
      doctype: 'Fiscal Year',
      placeholder: 'Search Fiscal Year...',
      initialValue: initialFiscalYear
    });

    footer.querySelector('#sbFilterCancel')?.addEventListener('click', () => this.close());
    footer.querySelector('#sbFilterApply')?.addEventListener('click', () => this._apply(content));
    footer.querySelector('#sbFilterClear')?.addEventListener('click', () => this._clear(content));
  }

  _clear(root) {
    // Reset UI only; user can Apply afterwards
    root.querySelectorAll('.sb-filter__status').forEach((el) => { el.checked = false; });
    const from = root.querySelector('#sbFilterDateFrom');
    const to = root.querySelector('#sbFilterDateTo');
    if (from) from.value = '';
    if (to) to.value = '';
    this._inputs.company?.setValue?.(null);
    this._inputs.customer?.setValue?.(null);
    this._inputs.fiscal_year?.setValue?.(null);
  }

  _apply(root) {
    if (!root) return;

    const statuses = Array.from(root.querySelectorAll('.sb-filter__status'))
      .filter((el) => el.checked)
      .map((el) => el.value)
      .filter(Boolean);

    const date_from = root.querySelector('#sbFilterDateFrom')?.value || null;
    const date_to = root.querySelector('#sbFilterDateTo')?.value || null;
    const company = this._inputs.company?.getValue?.() || null;
    const customer = this._inputs.customer?.getValue?.() || null;
    const fiscal_year = this._inputs.fiscal_year?.getValue?.() || null;

    this.onApply({ status: statuses, company, customer, fiscal_year, date_from, date_to });
    this.close();
  }

  close() {
    this._modal?.close?.();
    this._modal = null;
  }

  _destroyInputs() {
    Object.values(this._inputs || {}).forEach((inp) => {
      try { inp?.destroy?.(); } catch (e) {}
    });
    this._inputs = {};
  }
}


