/**
 * NewProjectModal (Website-safe)
 * - UI-only: renders a small form in a Modal and returns user input on submit.
 * - Data access is performed by controllers/services.
 */
import { Modal } from '../Common/Modal.js';
import { LinkInput } from '../Common/LinkInput.js';
import { DoctypeMetaService } from '../../services/doctypeMetaService.js';
import { escapeHtml } from '../../utils/dom.js';

export class NewProjectModal {
  constructor({ title = 'New Project', initial = {}, onSubmit, onClose } = {}) {
    this.title = title;
    this.initial = initial || {};
    this.onSubmit = onSubmit || (async () => {});
    this.onClose = onClose || (() => {});

    this._modal = null;
    this._root = null;
    this._linkInputs = [];
    this._statusOptions = [];
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
          <label class="sb-newproj__label">Customer</label>
          <div id="sbNewProjCustomer"></div>
        </div>

        <div class="sb-newproj__row">
          <label class="sb-newproj__label">Company</label>
          <div id="sbNewProjCompany"></div>
        </div>

        <div class="sb-newproj__row">
          <label class="sb-newproj__label">Project Type</label>
          <div id="sbNewProjType"></div>
        </div>

        <div class="sb-newproj__row">
          <label class="sb-newproj__label">Status</label>
          <select class="form-control" id="sbNewProjStatus">
            <option value="" disabled selected>Select status</option>
          </select>
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
    this._mountLink('sbNewProjType', 'Project Type', this.initial.project_type || null);

    // Status options from DocType meta (Property Setter)
    await this._loadStatusOptions();
    this._renderStatusSelect();
    if (this.initial.status) {
      const st = content.querySelector('#sbNewProjStatus');
      if (st) st.value = this.initial.status;
    }

    // Bind
    footer.querySelector('#sbNewProjCancel')?.addEventListener('click', () => this.close());
    footer.querySelector('#sbNewProjCreate')?.addEventListener('click', () => this._handleSubmit());

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
    const li = new LinkInput(inner, {
      doctype,
      placeholder: `Search ${doctype}...`,
      initialValue: initialValue || null,
      onChange: () => {},
    });
    this._linkInputs.push(li);
  }

  async _loadStatusOptions() {
    try {
      const opts = await DoctypeMetaService.getSelectOptions('Project', 'status');
      this._statusOptions = Array.isArray(opts) ? opts : [];
    } catch (e) {
      this._statusOptions = [];
    }
  }

  _renderStatusSelect() {
    const sel = this._root?.querySelector?.('#sbNewProjStatus');
    if (!sel) return;
    const options = (this._statusOptions || []).filter(Boolean);
    sel.innerHTML = `
      <option value="" disabled selected>Select status</option>
      ${options.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('')}
    `;
  }

  _readValueFromLinkInput(doctype) {
    // LinkInput stores value in an input; we can query by placeholder-ish container order.
    // We keep this deterministic by looking for the mount container id by doctype.
    const map = {
      'Customer': '#sbNewProjCustomer',
      'Company': '#sbNewProjCompany',
      'Project Type': '#sbNewProjType',
    };
    const sel = map[doctype];
    const mount = sel ? this._root?.querySelector?.(sel) : null;
    const input = mount?.querySelector?.('input');
    return String(input?.value || '').trim();
  }

  async _handleSubmit() {
    this._setError('');
    const name = String(this._root?.querySelector?.('#sbNewProjName')?.value || '').trim();
    const customer = this._readValueFromLinkInput('Customer');
    const company = this._readValueFromLinkInput('Company');
    const project_type = this._readValueFromLinkInput('Project Type');
    const status = String(this._root?.querySelector?.('#sbNewProjStatus')?.value || '').trim();

    const missing = [];
    if (!name) missing.push('Project Name');
    if (!customer) missing.push('Customer');
    if (!company) missing.push('Company');
    if (!project_type) missing.push('Project Type');
    if (!status) missing.push('Status');
    if (missing.length) {
      this._setError(`Please fill: ${missing.join(', ')}`);
      return;
    }

    const btn = this._modal?._overlay?.querySelector?.('#sbNewProjCreate');
    if (btn) btn.disabled = true;
    try {
      await this.onSubmit({ project_name: name, customer, company, project_type, status });
      this.close();
    } catch (e) {
      this._setError(e?.message || String(e));
    } finally {
      if (btn) btn.disabled = false;
    }
  }
}


