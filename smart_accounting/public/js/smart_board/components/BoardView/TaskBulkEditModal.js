/**
 * TaskBulkEditModal
 * - Bulk update dialog for selected tasks.
 */
import { escapeHtml } from '../../utils/dom.js';
import { Modal } from '../Common/Modal.js';
import { DoctypeMetaService } from '../../services/doctypeMetaService.js';

const TASK_STATUS_FALLBACK = ['Not started yet', 'Working on it', 'Stuck', 'Done'];
const TASK_PRIORITY_FALLBACK = ['Low', 'Medium', 'High', 'Urgent'];

export class TaskBulkEditModal {
  constructor({ title = 'Bulk Update Tasks', count = 0, onApply, onClose } = {}) {
    this.title = title;
    this.count = Number(count) || 0;
    this.onApply = onApply || (() => {});
    this.onClose = onClose || (() => {});
    this._modal = null;
    this._root = null;
    this._statusOptions = null;
    this._priorityOptions = null;
  }

  async open() {
    this.close();
    const content = document.createElement('div');
    content.innerHTML = `
      <div class="sb-modal__hint">Apply one field update to <b>${escapeHtml(String(this.count))}</b> selected tasks.</div>
      <div style="display:flex; gap:12px; flex-wrap:wrap; margin-top:10px;">
        <div style="min-width:220px; flex:1;">
          <div style="font-weight:600;font-size:13px;margin-bottom:6px;">Field</div>
          <select class="form-control" id="sbTaskBulkField">
            <option value="status">Status</option>
            <option value="priority">Priority</option>
            <option value="exp_end_date">Due Date</option>
            <option value="subject">Task Name</option>
          </select>
        </div>
        <div style="min-width:260px; flex:2;">
          <div style="font-weight:600;font-size:13px;margin-bottom:6px;">Value</div>
          <div id="sbTaskBulkValue"></div>
        </div>
      </div>
    `;

    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.justifyContent = 'flex-end';
    footer.style.gap = '10px';
    footer.innerHTML = `
      <button class="btn btn-default" type="button" id="sbTaskBulkCancel">Cancel</button>
      <button class="btn btn-primary" type="button" id="sbTaskBulkApply">Apply</button>
    `;

    this._modal = new Modal({
      title: this.title,
      contentEl: content,
      footerEl: footer,
      onClose: () => this.onClose(),
    });
    this._modal.open();
    this._root = content;

    const fieldSel = content.querySelector('#sbTaskBulkField');
    fieldSel?.addEventListener('change', () => this._mountValueEditor(fieldSel.value));
    footer.querySelector('#sbTaskBulkCancel')?.addEventListener('click', () => this.close());
    footer.querySelector('#sbTaskBulkApply')?.addEventListener('click', () => this._apply(fieldSel?.value || 'status'));
    await this._mountValueEditor(fieldSel?.value || 'status');
  }

  close() {
    this._modal?.close?.();
    this._modal = null;
    this._root = null;
  }

  async _mountValueEditor(field) {
    const host = this._root?.querySelector?.('#sbTaskBulkValue');
    if (!host) return;
    host.innerHTML = '';

    if (field === 'exp_end_date') {
      host.innerHTML = `<input class="form-control" id="sbTaskBulkDate" type="date" />`;
      return;
    }
    if (field === 'subject') {
      host.innerHTML = `<input class="form-control" id="sbTaskBulkSubject" type="text" placeholder="e.g. Review BAS" />`;
      return;
    }
    if (field === 'priority') {
      if (!Array.isArray(this._priorityOptions)) {
        try {
          const x = await DoctypeMetaService.getSelectOptions('Task', 'priority', { force: true });
          this._priorityOptions = Array.isArray(x) && x.length ? x : TASK_PRIORITY_FALLBACK;
        } catch (e) {
          this._priorityOptions = TASK_PRIORITY_FALLBACK;
        }
      }
      const opts = (this._priorityOptions || []).map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
      host.innerHTML = `<select class="form-control" id="sbTaskBulkPriority">${opts}</select>`;
      return;
    }

    if (!Array.isArray(this._statusOptions)) {
      try {
        const x = await DoctypeMetaService.getSelectOptions('Task', 'status', { force: true });
        this._statusOptions = Array.isArray(x) && x.length ? x : TASK_STATUS_FALLBACK;
      } catch (e) {
        this._statusOptions = TASK_STATUS_FALLBACK;
      }
    }
    const opts = (this._statusOptions || []).map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
    host.innerHTML = `<select class="form-control" id="sbTaskBulkStatus">${opts}</select>`;
  }

  _apply(field) {
    if (!this._root) return;
    let value = '';
    if (field === 'exp_end_date') value = String(this._root.querySelector('#sbTaskBulkDate')?.value || '').trim();
    else if (field === 'subject') value = String(this._root.querySelector('#sbTaskBulkSubject')?.value || '').trim();
    else if (field === 'priority') value = String(this._root.querySelector('#sbTaskBulkPriority')?.value || '').trim();
    else value = String(this._root.querySelector('#sbTaskBulkStatus')?.value || '').trim();
    if (!value) return;
    this.onApply({ field, value });
    this.close();
  }
}

