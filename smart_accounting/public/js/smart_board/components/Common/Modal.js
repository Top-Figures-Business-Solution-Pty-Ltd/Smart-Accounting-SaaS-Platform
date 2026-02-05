/**
 * Modal foundation (Website-safe)
 * - Focus trap, ESC to close, click overlay to close
 * - Scroll lock (body)
 * - Minimal API for reuse by different modals
 *
 * Performance notes:
 * - No global listeners left behind on close
 * - Avoid reflow loops; DOM created once per open
 */
import { escapeHtml } from '../../utils/dom.js';

export class Modal {
  static _openModals = new Set();

  static closeAll() {
    try {
      // Copy first to avoid mutation during iteration
      const list = Array.from(Modal._openModals || []);
      for (const m of list) {
        try { m?.close?.(); } catch (e) {}
      }
    } catch (e) {}
  }

  constructor({ title = 'Modal', contentEl, footerEl, onClose } = {}) {
    this.title = title;
    this.contentEl = contentEl || document.createElement('div');
    this.footerEl = footerEl || null;
    this.onClose = onClose || (() => {});

    this._overlay = null;
    this._modal = null;
    this._onKeyDown = null;
    this._lastActive = null;
  }

  open() {
    this.close();
    this._lastActive = document.activeElement;

    const overlay = document.createElement('div');
    overlay.className = 'sb-modal-overlay';
    // Treat modal as an "editor portal" so inline EditingManager won't auto-commit
    // when user interacts with a modal triggered from a table cell.
    overlay.setAttribute('data-sb-editor-portal', '1');
    overlay.innerHTML = `
      <div class="sb-modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(this.title)}">
        <div class="sb-modal__header">
          <div class="sb-modal__title">${escapeHtml(this.title)}</div>
          <button class="sb-modal__close" type="button" aria-label="Close">×</button>
        </div>
        <div class="sb-modal__body"></div>
        <div class="sb-modal__footer"></div>
      </div>
    `;

    document.body.appendChild(overlay);
    this._overlay = overlay;
    this._modal = overlay.querySelector('.sb-modal');
    try { Modal._openModals.add(this); } catch (e) {}

    // Scroll lock
    this._lockScroll(true);

    const body = overlay.querySelector('.sb-modal__body');
    if (body) body.appendChild(this.contentEl);

    const footer = overlay.querySelector('.sb-modal__footer');
    if (footer) {
      if (this.footerEl) footer.appendChild(this.footerEl);
      else footer.remove();
    }

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });
    overlay.querySelector('.sb-modal__close')?.addEventListener('click', () => this.close());

    this._onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
        return;
      }
      if (e.key === 'Tab') {
        this._trapFocus(e);
      }
    };
    document.addEventListener('keydown', this._onKeyDown);

    // Focus first focusable element
    queueMicrotask(() => {
      const el = this._getFocusableElements()[0];
      if (el) el.focus();
      else this._modal?.focus?.();
    });
  }

  _lockScroll(lock) {
    try {
      if (lock) {
        document.body.dataset.sbScrollLock = '1';
        document.body.style.overflow = 'hidden';
      } else if (document.body.dataset.sbScrollLock === '1') {
        delete document.body.dataset.sbScrollLock;
        document.body.style.overflow = '';
      }
    } catch (e) {}
  }

  _getFocusableElements() {
    const root = this._modal;
    if (!root) return [];
    const nodes = root.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    return Array.from(nodes).filter((el) => !el.disabled && el.offsetParent !== null);
  }

  _trapFocus(e) {
    const focusables = this._getFocusableElements();
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    const goingBack = e.shiftKey;

    if (!goingBack && active === last) {
      e.preventDefault();
      first.focus();
    } else if (goingBack && active === first) {
      e.preventDefault();
      last.focus();
    }
  }

  close() {
    if (this._onKeyDown) {
      document.removeEventListener('keydown', this._onKeyDown);
      this._onKeyDown = null;
    }
    try { Modal._openModals.delete(this); } catch (e) {}
    this._overlay?.remove();
    this._overlay = null;
    this._modal = null;
    this._lockScroll(false);

    // Restore focus
    try {
      this._lastActive?.focus?.();
    } catch (e) {}
    this._lastActive = null;

    this.onClose();
  }
}


