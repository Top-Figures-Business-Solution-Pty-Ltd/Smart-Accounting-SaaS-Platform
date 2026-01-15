/**
 * TaskEditingManager
 * - Inline editing for task sub-table
 */
import { InlineTextEditor } from '../Common/editors/InlineTextEditor.js';
import { notify } from '../../services/uiAdapter.js';
import { getTaskColumnSpec } from '../../columns/specs/taskColumns.js';

export class TaskEditingManager {
  constructor({ rootEl, getTaskByName, updateTask, onTaskUpdated } = {}) {
    this.rootEl = rootEl;
    this.getTaskByName = typeof getTaskByName === 'function' ? getTaskByName : (() => null);
    this.updateTask = typeof updateTask === 'function' ? updateTask : (async () => {});
    this.onTaskUpdated = typeof onTaskUpdated === 'function' ? onTaskUpdated : (() => {});

    this._active = null; // { cellEl, projectName, taskName, field, originalHTML, originalValue }
    this._committing = false;
    this._pendingCommit = false;
    this._onDocMouseDown = null;
    this._editorInstance = null;
  }

  isEditing() {
    return !!this._active;
  }

  bindToTbody(tbodyEl) {
    if (!tbodyEl) return;
    tbodyEl.addEventListener('click', (e) => {
      const cell = e.target?.closest?.('td[data-task-field]');
      if (!cell) return;
      if (!cell.classList.contains('editable')) return;
      if (cell.querySelector('.sb-inline-editor')) return;
      e.preventDefault();
      e.stopPropagation();
      this.startEdit(cell);
    });
  }

  async commitAndClose(reason = 'unknown') {
    if (!this._active) return;
    try {
      await this.commit(reason);
    } finally {
      this.closeEditor({ restore: false });
      try {
        this.rootEl?.dispatchEvent?.(new CustomEvent('sb:edit-finished', { detail: { reason } }));
      } catch (e) {}
    }
  }

  startEdit(cellEl) {
    if (!cellEl) return;
    if (this._active && this._active.cellEl !== cellEl) {
      this.commitAndClose('switch-cell');
    }

    const row = cellEl.closest('tr');
    const field = cellEl.dataset.taskField;
    const taskName = cellEl.dataset.taskName || row?.dataset?.taskName;
    const projectName = cellEl.dataset.projectName || row?.dataset?.projectName;
    if (!field || !taskName) return;

    const task = this.getTaskByName(projectName, taskName);
    if (!task) return;

    const content = cellEl.querySelector('.cell-content') || cellEl;
    const originalHTML = content.innerHTML;
    const originalValue = task[field];

    this._active = { cellEl, projectName, taskName, field, originalHTML, originalValue };
    this._editorInstance = null;

    this._installDocOutsideHandler();

    const spec = getTaskColumnSpec(field);
    const editor = spec?.renderEditor;
    if (typeof editor === 'function') {
      try {
        const out = editor({ cellEl, task, column: { field }, manager: this, field });
        if (!this._editorInstance) {
          const input2 = content.querySelector('.sb-inline-editor');
          if (input2) this.bindActiveEditor(input2, null);
        }
        return out;
      } catch (e) {
        // fall back to default editor
      }
    }

    this._mountDefaultEditor({ cellEl, field, task });
  }

  bindActiveEditor(inputEl, editorInstance = null) {
    if (!this._active) return;
    this._editorInstance = editorInstance || null;
    if (!inputEl) return;
    if (inputEl.__sbBound) return;
    inputEl.__sbBound = true;

    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (inputEl.tagName === 'TEXTAREA' && e.shiftKey) return;
        e.preventDefault();
        this.commitAndClose('enter');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.cancel();
      }
    });

    inputEl.addEventListener('blur', () => {
      if (!this._active) return;
      this.commitAndClose('blur');
    });
  }

  _mountDefaultEditor({ cellEl, field, task }) {
    const content = cellEl.querySelector('.cell-content') || cellEl;
    const val = task?.[field];
    const ed = new InlineTextEditor(content, { initialValue: val == null ? '' : String(val) });
    this.bindActiveEditor(ed.getInputEl(), ed);
  }

  async commit(reason = 'unknown') {
    if (!this._active) return;
    if (this._committing) {
      this._pendingCommit = true;
      return;
    }
    this._committing = true;
    try {
      const { cellEl, projectName, taskName, field } = this._active;
      const task = this.getTaskByName(projectName, taskName);
      if (!task) return;

      const content = cellEl.querySelector('.cell-content') || cellEl;
      const input = content.querySelector('.sb-inline-editor');

      let value = null;
      if (this._editorInstance && typeof this._editorInstance.getValue === 'function') {
        value = this._editorInstance.getValue();
      } else if (input && 'value' in input) {
        value = input.value;
      } else {
        return;
      }

      const spec = getTaskColumnSpec(field);
      this._active._committedValue = value;
      if (!(spec && typeof spec.commit === 'function')) {
        const oldVal = task?.[field];
        if ((oldVal == null ? '' : String(oldVal)) === (value == null ? '' : String(value))) {
          return;
        }
      }

      if (spec && typeof spec.commit === 'function') {
        await spec.commit({ task, taskName, field, value, reason });
      } else {
        await this.updateTask(taskName, { [field]: value });
      }

      this.onTaskUpdated({ projectName, taskName, field, value });
      notify('Task updated', 'green');
    } finally {
      this._committing = false;
      if (this._pendingCommit) {
        this._pendingCommit = false;
        setTimeout(() => this.commit('pending'), 0);
      }
    }
  }

  cancel() {
    if (!this._active) return;
    const { cellEl, originalHTML } = this._active;
    const content = cellEl.querySelector('.cell-content') || cellEl;
    content.innerHTML = originalHTML;
    try { this._editorInstance?.destroy?.(); } catch (e) {}
    this._active = null;
    this._editorInstance = null;
    this._removeDocOutsideHandler();
    try {
      this.rootEl?.dispatchEvent?.(new CustomEvent('sb:edit-finished', { detail: { reason: 'cancel' } }));
    } catch (e) {}
  }

  closeEditor({ restore = true } = {}) {
    if (!this._active) return;
    const { cellEl, originalHTML } = this._active;
    const content = cellEl.querySelector('.cell-content') || cellEl;
    if (content.querySelector('.sb-inline-editor')) {
      if (restore) {
        content.innerHTML = originalHTML;
      } else {
        const v = this._active?._committedValue;
        content.textContent = v == null ? '' : String(v);
      }
    }
    try { this._editorInstance?.destroy?.(); } catch (e) {}
    this._active = null;
    this._editorInstance = null;
    this._removeDocOutsideHandler();
  }

  _installDocOutsideHandler() {
    if (this._onDocMouseDown) return;
    this._onDocMouseDown = (e) => {
      if (!this._active) return;
      const cellEl = this._active.cellEl;
      // Ignore clicks inside editor portal (dropdowns rendered to body)
      if (e?.target?.closest?.('[data-sb-editor-portal=\"1\"]')) return;
      if (!cellEl || cellEl.contains(e.target)) return;
      this.commitAndClose('outside');
    };
    document.addEventListener('mousedown', this._onDocMouseDown, true);
  }

  _removeDocOutsideHandler() {
    if (!this._onDocMouseDown) return;
    document.removeEventListener('mousedown', this._onDocMouseDown, true);
    this._onDocMouseDown = null;
  }
}


