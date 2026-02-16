import { Modal } from '../Common/Modal.js';
import { escapeHtml } from '../../utils/dom.js';
import { ProjectActivityService } from '../../services/projectActivityService.js';
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
  constructor({ project, onClose } = {}) {
    this.project = project || null;
    this.onClose = typeof onClose === 'function' ? onClose : (() => {});
    this._modal = null;
    this._listEl = null;
    this._loading = false;
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
    const desc = isCreate ? 'created this project' : this._describeChangeHTML(it);
    return `
      <div class="sb-project-activity__item">
        <div class="sb-project-activity__meta">
          <span class="sb-project-activity__who">${who}</span>
          <span class="sb-project-activity__when">${when}</span>
        </div>
        <div class="sb-project-activity__body">
          ${desc}
        </div>
      </div>
    `;
  }

  _describeChangeHTML(it) {
    const field = _norm(it?.field);
    const label = _norm(it?.field_label || field || 'Field');
    const fromRaw = _norm(it?.from_value);
    const toRaw = _norm(it?.to_value);

    if (field === 'custom_team_members') {
      return this._teamMembersChangeHTML(label, fromRaw, toRaw);
    }
    if (field === 'custom_softwares') {
      return this._softwaresChangeHTML(label, fromRaw, toRaw);
    }

    const fieldHtml = `<span class="sb-project-activity__field">${escapeHtml(label)}</span>`;
    if (!fromRaw && toRaw) {
      return `set ${fieldHtml} to <span class="sb-project-activity__to">${escapeHtml(_shortText(toRaw))}</span>`;
    }
    if (fromRaw && !toRaw) {
      return `cleared ${fieldHtml} (was <span class="sb-project-activity__from">${escapeHtml(_shortText(fromRaw))}</span>)`;
    }
    if (fromRaw !== toRaw) {
      return `changed ${fieldHtml} from <span class="sb-project-activity__from">${escapeHtml(_shortText(fromRaw))}</span> to <span class="sb-project-activity__to">${escapeHtml(_shortText(toRaw))}</span>`;
    }
    return `updated ${fieldHtml}`;
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

