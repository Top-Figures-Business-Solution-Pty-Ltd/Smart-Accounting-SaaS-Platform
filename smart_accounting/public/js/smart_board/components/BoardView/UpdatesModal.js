/**
 * UpdatesModal (website-safe)
 * - Step 7: only provides an entrypoint + UI shell (no persistence yet)
 * - Intentionally decoupled from inline editing to keep architecture healthy.
 */
import { escapeHtml } from '../../utils/dom.js';
import { Modal } from '../Common/Modal.js';
import { notify } from '../../services/uiAdapter.js';

export class UpdatesModal {
  constructor({ project, onClose } = {}) {
    this.project = project || null;
    this.onClose = onClose || (() => {});
    this._modal = null;
  }

  open() {
    this.close();
    const title = this.project?.project_name || this.project?.customer || 'Updates';

    const content = document.createElement('div');
    content.innerHTML = `
      <div class="sb-updates">
        <div class="sb-updates__hint text-muted">
          Updates（占位）：后续会接入持久化、历史列表、@mention、附件等。
        </div>
        <div class="sb-updates__list" style="margin: 10px 0; padding: 10px; border: 1px dashed var(--smart-board-border); border-radius: 10px;">
          <div class="text-muted">No updates yet.</div>
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
    setTimeout(() => { try { ta?.focus?.(); } catch (e) {} }, 0);

    content.addEventListener('click', (e) => {
      const btn = e.target?.closest?.('button[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === 'cancel') {
        this.close();
      } else if (action === 'post') {
        const text = (ta?.value || '').trim();
        if (!text) {
          notify('Please write something first.', 'orange');
          return;
        }
        // Placeholder behavior
        notify('Posted (placeholder).', 'green');
        ta.value = '';
      }
    });
  }

  close() {
    this._modal?.close?.();
    this._modal = null;
  }
}


