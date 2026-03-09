import { Modal } from '../Common/Modal.js';
import { escapeHtml } from '../../utils/dom.js';
import { ProjectActivityService } from '../../services/projectActivityService.js';
import { UpdatesService } from '../../services/updatesService.js';
import { notify } from '../../services/uiAdapter.js';
import { formatDate } from '../../utils/helpers.js';

function _norm(v) {
  return String(v || '').trim();
}

function _splitCsv(v) {
  const s = _norm(v);
  if (!s) return [];
  return s.split(',').map((x) => _norm(x)).filter(Boolean);
}

function _toRoleMap(v) {
  const out = {};
  const s = _norm(v);
  if (!s) return out;
  s.split('|').map((x) => _norm(x)).filter(Boolean).forEach((part) => {
    const i = part.indexOf(':');
    if (i <= 0) return;
    const role = _norm(part.slice(0, i));
    const users = _splitCsv(part.slice(i + 1));
    out[role] = new Set(users);
  });
  return out;
}

function _arrFromSet(s) {
  return Array.from(s || []).filter(Boolean).sort((a, b) => String(a).localeCompare(String(b)));
}

function _joinList(arr) {
  const xs = Array.isArray(arr) ? arr.filter(Boolean) : [];
  if (!xs.length) return '';
  return xs.join(', ');
}

function _shortText(v, max = 120) {
  const s = _norm(v);
  if (s.length <= max) return s;
  return `${s.slice(0, max - 3)}...`;
}

export class ProjectActivityModal {
  constructor({ project, onClose, onChanged } = {}) {
    this.project = project || null;
    this.onClose = typeof onClose === 'function' ? onClose : (() => {});
    this.onChanged = typeof onChanged === 'function' ? onChanged : (() => {});
    this._modal = null;
    this._listEl = null;
    this._loading = false;
    this._undoing = false;
    this._savingComment = false;
    this._deletingComment = false;
    this._editingCommentName = '';
  }

  open() {
    this.close();
    const content = document.createElement('div');
    content.innerHTML = `
      <div class="sb-project-activity">
        <div class="sb-project-activity__hint text-muted">Who changed which field and when.</div>
        <div class="sb-project-activity__list" id="sbProjectActivityList"></div>
      </div>
    `;

    this._modal = new Modal({
      title: `Activity · ${escapeHtml(this.project?.project_name || this.project?.name || '')}`,
      contentEl: content,
      onClose: () => this.onClose(),
    });
    this._modal.open();
    this._listEl = content.querySelector('#sbProjectActivityList');
    content.addEventListener('click', (e) => {
      const btn = e.target?.closest?.('button[data-action]');
      if (!btn) return;
      const action = String(btn.dataset.action || '').trim();
      if (action === 'undo') {
        const activityName = btn.dataset.activityName;
        const expectedTo = btn.dataset.expectedTo || '';
        this._undo(activityName, expectedTo);
        return;
      }
      if (action === 'edit-comment') {
        this._editingCommentName = String(btn.dataset.commentName || '').trim();
        this._load();
        return;
      }
      if (action === 'cancel-edit-comment') {
        this._editingCommentName = '';
        this._load();
        return;
      }
      if (action === 'save-comment') {
        this._saveComment(btn.dataset.commentName);
        return;
      }
      if (action === 'delete-comment') {
        this._deleteComment(btn.dataset.commentName);
      }
    });
    this._load();
  }

  close() {
    this._modal?.close?.();
    this._modal = null;
    this._listEl = null;
  }

  async _load() {
    if (!this._listEl || this._loading) return;
    this._loading = true;
    this._listEl.innerHTML = `<div class="text-muted">Loading activity...</div>`;
    try {
      const name = String(this.project?.name || '').trim();
      const msg = await ProjectActivityService.getProjectActivity(name, { limit: 200 });
      const items = Array.isArray(msg?.items) ? msg.items : [];
      if (!items.length) {
        this._listEl.innerHTML = `<div class="text-muted">No activity yet.</div>`;
        return;
      }
      this._listEl.innerHTML = items.map((it) => this._rowHTML(it)).join('');
    } catch (e) {
      this._listEl.innerHTML = `<div class="text-danger">Failed to load activity.</div>`;
    } finally {
      this._loading = false;
    }
  }

  _rowHTML(it) {
    const who = escapeHtml(String(it?.user_label || 'Unknown'));
    const when = escapeHtml(formatDate(it?.timestamp) || String(it?.timestamp || ''));
    const isCreate = String(it?.action || '') === 'create';
    if (String(it?.kind || '') === 'update_comment') {
      return this._commentRowHTML(it, who, when);
    }
    const desc = isCreate ? 'created this project' : this._describeChangeHTML(it);
    const canUndo = !isCreate && !!it?.undoable && !!String(it?.activity_name || '').trim();
    return `
      <div class="sb-project-activity__item">
        <div class="sb-project-activity__meta">
          <span class="sb-project-activity__who">${who}</span>
          <span class="sb-project-activity__when">${when}</span>
        </div>
        <div class="sb-project-activity__body">
          ${desc}
        </div>
        ${canUndo ? `
          <div class="sb-project-activity__actions">
            <button class="btn btn-default btn-xs" type="button" data-action="undo" data-activity-name="${escapeHtml(String(it?.activity_name || ''))}" data-expected-to="${escapeHtml(String(it?.to_value || ''))}">Undo</button>
          </div>
        ` : ''}
      </div>
    `;
  }

  _commentRowHTML(it, who, when) {
    const name = _norm(it?.update_name);
    const canManage = !!it?.can_manage;
    const isEdited = !!it?.is_edited;
    const isEditing = !!name && this._editingCommentName === name;
    const content = escapeHtml(_norm(it?.content));
    if (isEditing) {
      return `
        <div class="sb-project-activity__item">
          <div class="sb-project-activity__meta">
            <span class="sb-project-activity__who">${who}</span>
            <span class="sb-project-activity__when">${when}</span>
          </div>
          <textarea class="form-control sb-updates__edit-textarea" data-comment-edit="${escapeHtml(name)}" rows="4">${content}</textarea>
          <div class="sb-project-activity__actions">
            <button class="btn btn-default btn-xs" type="button" data-action="cancel-edit-comment" data-comment-name="${escapeHtml(name)}">Cancel</button>
            <button class="btn btn-primary btn-xs" type="button" data-action="save-comment" data-comment-name="${escapeHtml(name)}">Save</button>
          </div>
        </div>
      `;
    }
    return `
      <div class="sb-project-activity__item">
        <div class="sb-project-activity__meta">
          <span class="sb-project-activity__who">${who}</span>
          <span class="sb-project-activity__when">${when}</span>
        </div>
        <div class="sb-project-activity__body">
          posted update${isEdited ? ' (edited)' : ''}: <span class="sb-project-activity__to">${content || '(empty)'}</span>
        </div>
        ${canManage ? `
          <div class="sb-project-activity__actions">
            <button class="btn btn-default btn-xs" type="button" data-action="edit-comment" data-comment-name="${escapeHtml(name)}">Edit</button>
            <button class="btn btn-default btn-xs" type="button" data-action="delete-comment" data-comment-name="${escapeHtml(name)}">Delete</button>
          </div>
        ` : ''}
      </div>
    `;
  }

  async _undo(activityName, expectedToValue) {
    if (this._undoing) return;
    const name = String(activityName || '').trim();
    if (!name) return;
    const ok = window.confirm('Undo this update?');
    if (!ok) return;
    this._undoing = true;
    try {
      await ProjectActivityService.undoProjectActivity(this.project?.name, name, expectedToValue);
      frappe.show_alert({ message: 'Undo completed.', indicator: 'green' });
      try { this.onChanged?.(); } catch (e) {}
      await this._load();
    } catch (e) {
      const msg = String(e?.message || 'Undo failed');
      frappe.show_alert({ message: msg, indicator: 'red' });
    } finally {
      this._undoing = false;
    }
  }

  async _saveComment(commentName) {
    if (this._savingComment) return;
    const name = _norm(commentName);
    if (!name) return;
    const taList = Array.from(this._listEl?.querySelectorAll?.('textarea[data-comment-edit]') || []);
    let ta = null;
    for (const x of taList) {
      if (_norm(x?.dataset?.commentEdit) === name) {
        ta = x;
        break;
      }
    }
    const text = _norm(ta?.value);
    if (!text) {
      notify('Update cannot be empty.', 'orange');
      return;
    }
    this._savingComment = true;
    try {
      await UpdatesService.updateProjectUpdate(name, text);
      this._editingCommentName = '';
      notify('Updated.', 'green');
      try { this.onChanged?.(); } catch (e) {}
      await this._load();
    } catch (e) {
      notify(String(e?.message || 'Update failed'), 'red');
    } finally {
      this._savingComment = false;
    }
  }

  async _deleteComment(commentName) {
    if (this._deletingComment) return;
    const name = _norm(commentName);
    if (!name) return;
    if (!window.confirm('Delete this update?')) return;
    this._deletingComment = true;
    try {
      const ok = await UpdatesService.deleteProjectUpdate(name);
      if (ok) {
        this._editingCommentName = this._editingCommentName === name ? '' : this._editingCommentName;
        notify('Deleted.', 'green');
        try { this.onChanged?.(); } catch (e) {}
        await this._load();
      }
    } catch (e) {
      notify(String(e?.message || 'Delete failed'), 'red');
    } finally {
      this._deletingComment = false;
    }
  }

  _describeChangeHTML(it) {
    const field = _norm(it?.field);
    const label = _norm(it?.field_label || field || 'Field');
    const fromRaw = _norm(it?.from_value);
    const toRaw = _norm(it?.to_value);
    const changeSource = _norm(it?.change_source).toLowerCase();
    const automationName = _norm(it?.automation_name);
    const archiveSource = _norm(it?.archive_source).toLowerCase();
    const archiveRule = _norm(it?.archive_rule);
    const prefix = changeSource === 'automation'
      ? `<span class="sb-project-activity__source sb-project-activity__source--automation">Automation${automationName ? ` · ${escapeHtml(automationName)}` : ''}</span> `
      : '';

    if (field === 'is_active') {
      if (fromRaw === 'Yes' && toRaw === 'No') {
        if (archiveSource === 'automation') {
          const byRule = archiveRule ? ` via automation <span class="sb-project-activity__field">${escapeHtml(archiveRule)}</span>` : ' via automation';
          return `${prefix}archived this project${byRule}`;
        }
        return `${prefix}archived this project`;
      }
      if (fromRaw === 'No' && toRaw === 'Yes') {
        return `${prefix}restored this project`;
      }
    }

    if (field === 'custom_team_members') {
      return this._teamMembersChangeHTML(label, fromRaw, toRaw);
    }
    if (field === 'custom_softwares') {
      return this._softwaresChangeHTML(label, fromRaw, toRaw);
    }

    const fieldHtml = `<span class="sb-project-activity__field">${escapeHtml(label)}</span>`;
    if (!fromRaw && toRaw) {
      return `${prefix}set ${fieldHtml} to <span class="sb-project-activity__to">${escapeHtml(_shortText(toRaw))}</span>`;
    }
    if (fromRaw && !toRaw) {
      return `${prefix}cleared ${fieldHtml} (was <span class="sb-project-activity__from">${escapeHtml(_shortText(fromRaw))}</span>)`;
    }
    if (fromRaw !== toRaw) {
      return `${prefix}changed ${fieldHtml} from <span class="sb-project-activity__from">${escapeHtml(_shortText(fromRaw))}</span> to <span class="sb-project-activity__to">${escapeHtml(_shortText(toRaw))}</span>`;
    }
    return `${prefix}updated ${fieldHtml}`;
  }

  _teamMembersChangeHTML(label, fromRaw, toRaw) {
    const before = _toRoleMap(fromRaw);
    const after = _toRoleMap(toRaw);
    const roles = Array.from(new Set(Object.keys(before).concat(Object.keys(after)))).sort((a, b) => String(a).localeCompare(String(b)));
    const parts = [];

    roles.forEach((role) => {
      const b = before[role] || new Set();
      const a = after[role] || new Set();
      const added = _arrFromSet(new Set(_arrFromSet(a).filter((x) => !b.has(x))));
      const removed = _arrFromSet(new Set(_arrFromSet(b).filter((x) => !a.has(x))));
      if (added.length) parts.push(`added ${escapeHtml(role)}: <span class="sb-project-activity__to">${escapeHtml(_joinList(added))}</span>`);
      if (removed.length) parts.push(`removed ${escapeHtml(role)}: <span class="sb-project-activity__from">${escapeHtml(_joinList(removed))}</span>`);
    });

    if (parts.length) {
      return `${parts.join(' · ')}`;
    }
    return `updated <span class="sb-project-activity__field">${escapeHtml(label)}</span>`;
  }

  _softwaresChangeHTML(label, fromRaw, toRaw) {
    const b = new Set(_splitCsv(fromRaw));
    const a = new Set(_splitCsv(toRaw));
    const added = _arrFromSet(new Set(_arrFromSet(a).filter((x) => !b.has(x))));
    const removed = _arrFromSet(new Set(_arrFromSet(b).filter((x) => !a.has(x))));
    const parts = [];
    if (added.length) parts.push(`added <span class="sb-project-activity__field">${escapeHtml(label)}</span>: <span class="sb-project-activity__to">${escapeHtml(_joinList(added))}</span>`);
    if (removed.length) parts.push(`removed <span class="sb-project-activity__field">${escapeHtml(label)}</span>: <span class="sb-project-activity__from">${escapeHtml(_joinList(removed))}</span>`);
    if (parts.length) return parts.join(' · ');
    return `updated <span class="sb-project-activity__field">${escapeHtml(label)}</span>`;
  }
}

