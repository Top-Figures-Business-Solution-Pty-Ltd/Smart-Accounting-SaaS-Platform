/**
 * NewProjectModal (Website-safe)
 * - UI-only: renders a small form in a Modal and returns user input on submit.
 * - Data access is performed by controllers/services.
 */
import { Modal } from '../Common/Modal.js';
import { LinkInput } from '../Common/LinkInput.js';
import { DoctypeMetaService } from '../../services/doctypeMetaService.js';

export class NewProjectModal {
  constructor({ title = 'New Project', initial = {}, onSubmit, onCreateClient, onClose } = {}) {
    this.title = title;
    this.initial = initial || {};
    this.onSubmit = onSubmit || (async () => {});
    this.onCreateClient = onCreateClient || null;
    this.onClose = onClose || (() => {});

    this._modal = null;
    this._root = null;
    this._linkInputs = [];
    this._linkInputsByDoctype = new Map(); // key: doctype -> LinkInput
  }

  async open() {
    this.close();

    const content = document.createElement('div');
    content.innerHTML = `
      <div class="sb-newproj">
        <div class="sb-newproj__row">
          <label class="sb-newproj__label">Project Name</label>
          <input class="form-control" id="sbNewProjName" type="text" placeholder="e.g. Client A - FY25 ITR" />
        </div>

        <div class="sb-newproj__row">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
            <label class="sb-newproj__label" style="margin:0;">Client</label>
            <button class="btn btn-default" type="button" id="sbNewProjNewClient" style="padding:4px 10px; font-size:12px;">
              New Client
            </button>
          </div>
          <div id="sbNewProjCustomer"></div>
        </div>

        <div class="sb-newproj__row">
          <label class="sb-newproj__label">Company</label>
          <div id="sbNewProjCompany"></div>
        </div>

        <div class="sb-newproj__row">
          <label class="sb-newproj__label">Fiscal Year</label>
          <div id="sbNewProjFiscalYear"></div>
        </div>

        <div class="sb-newproj__row">
          <label class="sb-newproj__label">Project Type</label>
          <div id="sbNewProjType"></div>
        </div>

        <div class="sb-newproj__error text-danger" id="sbNewProjError" style="display:none;"></div>
      </div>
    `;

    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.justifyContent = 'flex-end';
    footer.style.gap = '10px';
    footer.innerHTML = `
      <button class="btn btn-default" type="button" id="sbNewProjCancel">Cancel</button>
      <button class="btn btn-primary" type="button" id="sbNewProjCreate">Create</button>
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
    this._root = content;

    // Populate initial values
    const nameEl = content.querySelector('#sbNewProjName');
    if (nameEl) nameEl.value = this.initial.project_name || '';

    // Link inputs
    this._mountLink('sbNewProjCustomer', 'Customer', this.initial.customer || null);
    this._mountLink('sbNewProjCompany', 'Company', this.initial.company || null);
    this._mountLink('sbNewProjFiscalYear', 'Fiscal Year', this.initial.custom_fiscal_year || this.initial.fiscal_year || null);
    this._mountLink('sbNewProjType', 'Project Type', this.initial.project_type || null);

    // Preload DocType meta (best-effort) so future enhancements can derive required fields/options.
    try { await DoctypeMetaService.getMeta('Project'); } catch (e) {}

    // Bind
    footer.querySelector('#sbNewProjCancel')?.addEventListener('click', () => this.close());
    footer.querySelector('#sbNewProjCreate')?.addEventListener('click', () => this._handleSubmit());
    content.querySelector('#sbNewProjNewClient')?.addEventListener('click', () => this._handleCreateClient());
    if (!this.onCreateClient) {
      const btn = content.querySelector('#sbNewProjNewClient');
      if (btn) btn.style.display = 'none';
    }

    // Enter to submit when in Project Name field
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

  _destroyInputs() {
    for (const li of this._linkInputs) {
      try { li?.destroy?.(); } catch (e) {}
    }
    this._linkInputs = [];
  }

  _setError(msg) {
    const el = this._root?.querySelector?.('#sbNewProjError');
    if (!el) return;
    const m = String(msg || '').trim();
    el.textContent = m;
    el.style.display = m ? 'block' : 'none';
  }

  _mountLink(mountId, doctype, initialValue) {
    const mount = this._root?.querySelector?.(`#${CSS.escape(mountId)}`);
    if (!mount) return;
    mount.innerHTML = `<div class="sb-inline-editor sb-inline-editor--link"></div>`;
    const inner = mount.querySelector('.sb-inline-editor--link');
    if (!inner) return;
    const displayLabel = (doctype === 'Customer') ? 'Client' : doctype;
    const li = new LinkInput(inner, {
      doctype,
      placeholder: `Search ${displayLabel}...`,
      initialValue: initialValue || null,
      onChange: () => {},
    });
    this._linkInputs.push(li);
    this._linkInputsByDoctype.set(doctype, li);
  }

  _setValueForLinkInput(doctype, value) {
    const li = this._linkInputsByDoctype.get(doctype);
    if (li?.setValue) {
      li.setValue(value || null);
      return;
    }
    // fallback: best-effort DOM write
    const map = {
      'Customer': '#sbNewProjCustomer',
      'Company': '#sbNewProjCompany',
      'Fiscal Year': '#sbNewProjFiscalYear',
      'Project Type': '#sbNewProjType',
    };
    const sel = map[doctype];
    const mount = sel ? this._root?.querySelector?.(sel) : null;
    const input = mount?.querySelector?.('input');
    if (input) input.value = value || '';
  }

  _readValueFromLinkInput(doctype) {
    // LinkInput stores value in an input; we can query by placeholder-ish container order.
    // We keep this deterministic by looking for the mount container id by doctype.
    const map = {
      'Customer': '#sbNewProjCustomer',
      'Company': '#sbNewProjCompany',
      'Fiscal Year': '#sbNewProjFiscalYear',
      'Project Type': '#sbNewProjType',
    };
    const sel = map[doctype];
    const mount = sel ? this._root?.querySelector?.(sel) : null;
    const input = mount?.querySelector?.('input');
    return String(input?.value || '').trim();
  }

  async _handleCreateClient() {
    if (!this.onCreateClient) return;
    const btn = this._root?.querySelector?.('#sbNewProjNewClient');
    if (btn) btn.disabled = true;
    try {
      const initialName = this._readValueFromLinkInput('Customer');
      await this.onCreateClient({
        initialName,
        onCreated: (item) => {
          const name = item?.name || item?.customer_name || item?.customer || null;
          if (name) this._setValueForLinkInput('Customer', name);
        }
      });
    } catch (e) {
      // Only show unexpected errors; validation is handled inside the New Client modal itself.
      this._setError(e?.message || String(e));
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async _handleSubmit() {
    this._setError('');
    const name = String(this._root?.querySelector?.('#sbNewProjName')?.value || '').trim();
    const customer = this._readValueFromLinkInput('Customer');
    const company = this._readValueFromLinkInput('Company');
    const custom_fiscal_year = this._readValueFromLinkInput('Fiscal Year');
    const project_type = this._readValueFromLinkInput('Project Type');

    const missing = [];
    if (!name) missing.push('Project Name');
    if (!customer) missing.push('Client');
    if (!company) missing.push('Company');
    if (!custom_fiscal_year) missing.push('Fiscal Year');
    if (!project_type) missing.push('Project Type');
    if (missing.length) {
      this._setError(`Please fill: ${missing.join(', ')}`);
      return;
    }

    const btn = this._modal?._overlay?.querySelector?.('#sbNewProjCreate');
    if (btn) btn.disabled = true;
    try {
      await this.onSubmit({ project_name: name, customer, company, custom_fiscal_year, project_type });
      this.close();
    } catch (e) {
      this._setError(e?.message || String(e));
    } finally {
      if (btn) btn.disabled = false;
    }
  }
}


