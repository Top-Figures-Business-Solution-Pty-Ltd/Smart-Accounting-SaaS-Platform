/**
 * NewClientModal (Website-safe)
 * - UI-only: minimal customer creation form.
 */
import { Modal } from '../Common/Modal.js';
import { escapeHtml } from '../../utils/dom.js';
import { DoctypeMetaService } from '../../services/doctypeMetaService.js';

export class NewClientModal {
  constructor({ title = 'New Client', initial = {}, onSubmit, onClose } = {}) {
    this.title = title;
    this.initial = initial || {};
    this.onSubmit = onSubmit || (async () => {});
    this.onClose = onClose || (() => {});
    this._modal = null;
    this._root = null;
  }

  async open() {
    this.close();

    const content = document.createElement('div');
    content.innerHTML = `
      <div class="sb-newclient">
        <div class="sb-newproj__row">
          <label class="sb-newproj__label">Customer Name *</label>
          <input class="form-control" id="sbNewClientName" type="text" placeholder="e.g. David Tao" />
        </div>

        <div style="display:flex; gap:12px; flex-wrap: wrap;">
          <div class="sb-newproj__row" style="min-width:220px; flex:1;">
            <label class="sb-newproj__label">Customer Type</label>
            <select class="form-control" id="sbNewClientType">
              <option value="" disabled selected>Loading...</option>
            </select>
          </div>
          <div class="sb-newproj__row" style="min-width:220px; flex:1;">
            <label class="sb-newproj__label">Year End *</label>
            <select class="form-control" id="sbNewClientYearEnd">
              <option value="" disabled selected>Loading...</option>
            </select>
          </div>
        </div>

        <div style="display:flex; gap:12px; flex-wrap: wrap;">
          <div class="sb-newproj__row" style="min-width:220px; flex:1;">
            <label class="sb-newproj__label">ABN (optional)</label>
            <input class="form-control" id="sbNewClientAbn" type="text" placeholder="(optional)" />
          </div>
        </div>

        <div class="sb-newproj__error text-danger" id="sbNewClientError" style="display:none;"></div>
        <div class="text-muted" style="font-size:12px; margin-top:6px;">
          Note: Customer Group / Territory will use system defaults. You can refine later in ERPNext if needed.
        </div>
      </div>
    `;

    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.justifyContent = 'flex-end';
    footer.style.gap = '10px';
    footer.innerHTML = `
      <button class="btn btn-default" type="button" id="sbNewClientCancel">Cancel</button>
      <button class="btn btn-primary" type="button" id="sbNewClientCreate">Create</button>
    `;

    this._modal = new Modal({
      title: this.title,
      contentEl: content,
      footerEl: footer,
      onClose: () => this.onClose(),
    });
    this._modal.open();
    this._root = content;

    // Init
    const nameEl = content.querySelector('#sbNewClientName');
    if (nameEl) nameEl.value = this.initial.customer_name || '';

    // Load select options from backend meta (single source of truth)
    await this._loadSelectOptions();

    // Bind
    footer.querySelector('#sbNewClientCancel')?.addEventListener('click', () => this.close());
    footer.querySelector('#sbNewClientCreate')?.addEventListener('click', () => this._handleSubmit());
    nameEl?.addEventListener?.('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this._handleSubmit();
      }
    });
  }

  close() {
    this._modal?.close?.();
    this._modal = null;
    this._root = null;
  }

  _setError(msg) {
    const el = this._root?.querySelector?.('#sbNewClientError');
    if (!el) return;
    const m = String(msg || '').trim();
    el.textContent = m;
    el.style.display = m ? 'block' : 'none';
  }

  async _loadSelectOptions() {
    const typeSel = this._root?.querySelector?.('#sbNewClientType');
    const yearSel = this._root?.querySelector?.('#sbNewClientYearEnd');
    if (!typeSel || !yearSel) return;

    // Customer.customer_type options
    const types = await DoctypeMetaService.getSelectOptions('Customer', 'customer_type');
    const safeTypes = (types || []).filter(Boolean);
    typeSel.innerHTML = safeTypes.length
      ? safeTypes.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('')
      : `<option value="Individual">Individual</option><option value="Company">Company</option>`;

    // Customer Entity.year_end options (configured in ERPNext)
    const yearEnds = await DoctypeMetaService.getSelectOptions('Customer Entity', 'year_end');
    const safeYears = (yearEnds || []).filter(Boolean);
    yearSel.innerHTML = `
      <option value="" disabled selected>Select year end</option>
      ${safeYears.map((m) => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('')}
    `;
  }

  async _handleSubmit() {
    this._setError('');
    const customer_name = String(this._root?.querySelector?.('#sbNewClientName')?.value || '').trim();
    const customer_type = String(this._root?.querySelector?.('#sbNewClientType')?.value || '').trim() || 'Individual';

    const year_end = String(this._root?.querySelector?.('#sbNewClientYearEnd')?.value || '').trim();
    const abn = String(this._root?.querySelector?.('#sbNewClientAbn')?.value || '').trim();

    if (!customer_name) {
      this._setError('Customer Name is required');
      return;
    }
    if (!year_end) {
      this._setError('Year End is required');
      return;
    }

    // Current phase: customer itself is treated as the primary entity.
    // We keep the backend interface ready for future multi-entity expansion.
    const primary_entity = {
      entity_name: customer_name,
      entity_type: (customer_type === 'Company' ? 'Company' : 'Individual'),
      year_end: year_end,
      abn: abn || null,
    };

    const btn = this._modal?._overlay?.querySelector?.('#sbNewClientCreate');
    if (btn) btn.disabled = true;
    try {
      await this.onSubmit({ customer_name, customer_type, primary_entity });
      this.close();
    } catch (e) {
      this._setError(e?.message || String(e));
    } finally {
      if (btn) btn.disabled = false;
    }
  }
}


