/**
 * UpdatesModal (website-safe)
 * - Step 7: only provides an entrypoint + UI shell (no persistence yet)
 * - Intentionally decoupled from inline editing to keep architecture healthy.
 */
import { escapeHtml } from '../../utils/dom.js';
import { Modal } from '../Common/Modal.js';
import { notify } from '../../services/uiAdapter.js';
import { UpdatesService } from '../../services/updatesService.js';
import { attachMentionPicker } from '../../controllers/mentionPickerController.js';

export class UpdatesModal {
  constructor({ project, onClose } = {}) {
    this.project = project || null;
    this.onClose = onClose || (() => {});
    this._modal = null;
    this._items = [];
    this._loading = false;
    this._posting = false;
    this._limit = 30;
    this._listEl = null;
    this._mentionPicker = null;
    this._mentions = []; // [{name, full_name}]
  }

  open() {
    this.close();
    const title = this.project?.project_name || this.project?.customer || 'Updates';

    const content = document.createElement('div');
    content.innerHTML = `
      <div class="sb-updates">
        <div class="sb-updates__hint text-muted">Updates</div>
        <div class="sb-updates__list" id="sbUpdatesList" style="margin: 10px 0; padding: 10px; border: 1px solid var(--smart-board-border); border-radius: 10px; min-height: 120px;">
          <div class="text-muted">Loading…</div>
        </div>
        <div class="sb-updates__composer">
          <textarea class="form-control sb-updates__textarea" rows="4" placeholder="Write a new update..."></textarea>
          <div style="display:flex; justify-content:flex-end; gap:10px; margin-top: 10px;">
            <button class="btn btn-default" type="button" data-action="cancel">Cancel</button>
            <button class="btn btn-primary" type="button" data-action="post">Post</button>
          </div>
        </div>
      </div>
    `;

    const footer = null;
    this._modal = new Modal({
      title: `Updates · ${escapeHtml(title)}`,
      contentEl: content,
      footerEl: footer,
      onClose: () => {
        this.onClose();
      }
    });

    this._modal.open();

    const ta = content.querySelector('.sb-updates__textarea');
    const listEl = content.querySelector('#sbUpdatesList');
    this._listEl = listEl;
    setTimeout(() => { try { ta?.focus?.(); } catch (e) {} }, 0);

    // @mention picker (MVP)
    this._mentionPicker?.destroy?.();
    this._mentionPicker = attachMentionPicker({
      textareaEl: ta,
      onPick: (u) => {
        const name = String(u?.name || '').trim();
        const full_name = String(u?.full_name || '').trim();
        if (!name || !full_name) return;
        // de-dupe
        const exists = (this._mentions || []).some((m) => m?.name === name);
        if (!exists) this._mentions = (this._mentions || []).concat([{ name, full_name }]);
      }
    });

    this._loadInitial();

    content.addEventListener('click', (e) => {
      const btn = e.target?.closest?.('button[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === 'cancel') {
        this.close();
      } else if (action === 'post') {
        this._postUpdate(ta);
      }
    });
  }

  async _loadInitial() {
    if (this._loading) return;
    const projectName = this.project?.name;
    if (!projectName) return;
    this._loading = true;
    try {
      const items = await UpdatesService.listProjectUpdates(projectName, { limitStart: 0, limit: this._limit });
      this._items = Array.isArray(items) ? items : [];
      this._renderList();
    } catch (e) {
      console.error(e);
      this._renderError(e?.message || String(e));
    } finally {
      this._loading = false;
    }
  }

  _renderError(msg) {
    if (!this._listEl) return;
    this._listEl.innerHTML = `<div class="text-danger">${escapeHtml(msg || 'Failed to load updates')}</div>`;
  }

  _renderList() {
    if (!this._listEl) return;
    const items = Array.isArray(this._items) ? this._items : [];
    if (!items.length) {
      this._listEl.innerHTML = `<div class="text-muted">No updates yet.</div>`;
      return;
    }
    const toPlainText = (v) => {
      const s = String(v || '');
      if (!s) return '';
      // Comment.content is often stored as HTML (e.g. Quill output in Desk). Make it readable here.
      if (s.includes('<') && s.includes('>')) {
        try {
          const tmp = document.createElement('div');
          tmp.innerHTML = s;
          return (tmp.textContent || '').trim();
        } catch (e) {
          // fall through
        }
      }
      return s;
    };
    const rows = items.map((it) => {
      const by = escapeHtml(it?.comment_by || it?.owner || it?.comment_email || 'Unknown');
      const when = escapeHtml(String(it?.creation || '').replace('T', ' ').slice(0, 19));
      const content = escapeHtml(toPlainText(it?.content || ''));
      return `
        <div class="sb-updates__item" style="padding:10px 0; border-bottom: 1px solid rgba(0,0,0,0.06);">
          <div style="display:flex; justify-content:space-between; gap:10px;">
            <div style="font-weight:600;">${by}</div>
            <div class="text-muted" style="font-size:12px;">${when}</div>
          </div>
          <div style="margin-top:6px; white-space:pre-wrap;">${content}</div>
        </div>
      `;
    }).join('');
    this._listEl.innerHTML = `<div class="sb-updates__items">${rows}</div>`;
  }

  async _postUpdate(textareaEl) {
    if (this._posting) return;
    const ta = textareaEl;
    const text = (ta?.value || '').trim();
    if (!text) {
      notify('Please write something first.', 'orange');
      return;
    }
    const projectName = this.project?.name;
    if (!projectName) return;

    // Compose HTML (allow mentions to be represented as safe spans)
    const composed = this._composeContent(text, this._mentions || []);
    const mentions = composed?.mentions || [];
    const html = composed?.html || text;

    this._posting = true;
    try {
      const item = await UpdatesService.addProjectUpdate(projectName, html, { mentions });
      if (item) {
        // Prepend (we render newest-first)
        this._items = [item].concat(this._items || []);
        this._renderList();
        notify('Posted.', 'green');
      }
      if (ta) ta.value = '';
      this._mentions = [];
      // Best-effort: refresh bell badge/list if present
      try { window.smart_accounting?.notifications_controller?.refresh?.(); } catch (e) {}
    } catch (e) {
      console.error(e);
      notify(e?.message || 'Post failed', 'red');
    } finally {
      this._posting = false;
    }
  }

  _composeContent(plainText, mentionObjs) {
    const text = String(plainText || '');
    const mentions = Array.isArray(mentionObjs) ? mentionObjs : [];
    const byLabel = new Map();
    for (const m of mentions) {
      const id = String(m?.name || '').trim();
      const label = String(m?.full_name || '').trim();
      if (!id || !label) continue;
      byLabel.set(label, id);
    }

    // Escape everything first (safe)
    let html = escapeHtml(text).replace(/\n/g, '<br>');
    const outMentions = [];
    for (const [label, id] of byLabel.entries()) {
      const tokenEsc = escapeHtml(`@${label}`);
      const idx = html.indexOf(tokenEsc);
      if (idx < 0) continue;
      const wrapped = `<span class="sb-mention" data-user="${escapeHtml(id)}">${tokenEsc}</span>`;
      html = html.slice(0, idx) + wrapped + html.slice(idx + tokenEsc.length);
      outMentions.push(id);
    }
    return { html, mentions: outMentions };
  }

  close() {
    this._modal?.close?.();
    this._modal = null;
    this._items = [];
    this._listEl = null;
    this._loading = false;
    this._posting = false;
    this._mentionPicker?.destroy?.();
    this._mentionPicker = null;
    this._mentions = [];
  }
}


