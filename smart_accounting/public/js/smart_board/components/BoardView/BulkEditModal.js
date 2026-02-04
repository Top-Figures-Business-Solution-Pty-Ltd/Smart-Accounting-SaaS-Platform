/**
 * BulkEditModal
 * Minimal bulk update dialog for selected Projects (website-safe).
 *
 * v1 supports:
 * - status (select)
 * - company (Link -> Company)
 * - is_active (archive/unarchive)
 */
import { escapeHtml } from '../../utils/dom.js';
import { Modal } from '../Common/Modal.js';
import { LinkInput } from '../Common/LinkInput.js';
import { DoctypeMetaService } from '../../services/doctypeMetaService.js';
import { BoardStatusService } from '../../services/boardStatusService.js';

export class BulkEditModal {
  constructor({ title = 'Bulk Edit', count = 0, initialField = 'status', projectType = null, onApply, onClose } = {}) {
    this.title = title;
    this.count = Number(count) || 0;
    this.initialField = initialField || 'status';
    this.projectType = String(projectType || '').trim() || null;
    this.onApply = onApply || (() => {});
    this.onClose = onClose || (() => {});

    this._modal = null;
    this._root = null;
    this._link = null;
    this._statusOptions = null;
  }

  async open() {
    this.close();
    const content = document.createElement('div');
    content.innerHTML = `
      <div class="sb-modal__hint">Apply one field update to <b>${escapeHtml(String(this.count))}</b> selected projects.</div>
      <div style="display:flex; gap:12px; flex-wrap:wrap; margin-top:10px;">
        <div style="min-width:220px; flex:1;">
          <div style="font-weight:600;font-size:13px;margin-bottom:6px;">Field</div>
          <select class="form-control" id="sbBulkField">
            <option value="status">Status</option>
            <option value="company">Company</option>
            <option value="is_active">Active (Archive)</option>
          </select>
        </div>
        <div style="min-width:260px; flex:2;">
          <div style="font-weight:600;font-size:13px;margin-bottom:6px;">Value</div>
          <div id="sbBulkValue"></div>
        </div>
      </div>
    `;

    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.justifyContent = 'flex-end';
    footer.style.gap = '10px';
    footer.innerHTML = `
      <button class="btn btn-default" type="button" id="sbBulkCancel">Cancel</button>
      <button class="btn btn-primary" type="button" id="sbBulkApply">Apply</button>
    `;

    this._modal = new Modal({
      title: this.title,
      contentEl: content,
      footerEl: footer,
      onClose: () => {
        this._destroyInputs();
        this.onClose();
      },
    });
    this._modal.open();
    this._root = content;

    const fieldSel = content.querySelector('#sbBulkField');
    if (fieldSel) fieldSel.value = this.initialField;
    fieldSel?.addEventListener('change', () => this._mountValueEditor(fieldSel.value));

    footer.querySelector('#sbBulkCancel')?.addEventListener('click', () => this.close());
    footer.querySelector('#sbBulkApply')?.addEventListener('click', () => this._apply(fieldSel?.value || 'status'));

    await this._mountValueEditor(fieldSel?.value || 'status');
  }

  close() {
    this._modal?.close?.();
    this._modal = null;
    this._root = null;
    this._destroyInputs();
  }

  async _mountValueEditor(field) {
    if (!this._root) return;
    const host = this._root.querySelector('#sbBulkValue');
    if (!host) return;
    host.innerHTML = '';
    this._destroyInputs();

    if (field === 'company') {
      const mount = document.createElement('div');
      host.appendChild(mount);
      this._link = new LinkInput(mount, {
        doctype: 'Company',
        placeholder: 'Search Company...',
        initialValue: null,
      });
      return;
    }

    if (field === 'is_active') {
      host.innerHTML = `
        <select class="form-control" id="sbBulkIsActive">
          <option value="Yes">Yes (Active)</option>
          <option value="No">No (Archived)</option>
        </select>
      `;
      return;
    }

    // status (default): source of truth
    // - Pool comes from Project.status meta (Property Setter)
    // - Board can further restrict to a subset by Project Type (if provided)
    if (!Array.isArray(this._statusOptions)) {
      try {
        if (this.projectType) {
          const opts = await BoardStatusService.getEffectiveOptions({
            projectType: this.projectType,
            currentValue: '',
          });
          this._statusOptions = Array.isArray(opts) ? opts : [];
        } else {
          const opts = await DoctypeMetaService.getSelectOptions('Project', 'status');
          this._statusOptions = Array.isArray(opts) ? opts : [];
        }
      } catch (e) {
        this._statusOptions = [];
      }
    }
    const optsHtml = (this._statusOptions || []).map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
    host.innerHTML = `
      <select class="form-control" id="sbBulkStatus">
        <option value="" selected disabled>Select status</option>
        ${optsHtml}
      </select>
    `;
  }

  _apply(field) {
    if (!this._root) return;
    let value = null;

    if (field === 'company') {
      value = this._link?.getValue?.() || null;
    } else if (field === 'is_active') {
      value = this._root.querySelector('#sbBulkIsActive')?.value || null;
    } else {
      value = this._root.querySelector('#sbBulkStatus')?.value || null;
    }

    this.onApply({ field, value });
    this.close();
  }

  _destroyInputs() {
    try { this._link?.destroy?.(); } catch (e) {}
    this._link = null;
  }
}


