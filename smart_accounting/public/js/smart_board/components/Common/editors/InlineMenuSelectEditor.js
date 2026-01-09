/**
 * InlineMenuSelectEditor
 * - Click once to open a menu immediately (Monday-like affordance)
 * - Website-safe; no native <select> quirks (no "needs second click")
 *
 * options:
 * - string[] OR { value: string, label?: string, color?: string }[]
 */
import { escapeHtml } from '../../../utils/dom.js';

export class InlineMenuSelectEditor {
  constructor(mountEl, { options = [], initialValue = '', placeholder = null } = {}) {
    this.mountEl = mountEl;
    this.options = Array.isArray(options) ? options : [];
    this.initialValue = initialValue ?? '';
    this.placeholder = placeholder;
    this._root = null;
    this._value = null; // selected value during edit; null means unchanged
    this.render();
  }

  render() {
    if (!this.mountEl) return;
    const items = this._normalizeOptions(this.options);

    this.mountEl.innerHTML = `
      <div class="sb-inline-editor sb-inline-editor--menu" tabindex="0">
        <div class="sb-menu">
          ${items.map((it) => this._itemHTML(it)).join('')}
        </div>
      </div>
    `;
    this._root = this.mountEl.querySelector('.sb-inline-editor--menu');

    // Click to choose
    this._root?.addEventListener('click', (e) => {
      const btn = e.target?.closest?.('button[data-value]');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const v = btn.dataset.value ?? '';
      this._value = v;
      // host manager decides commit timing; we just store value
      this._root?.dispatchEvent?.(new CustomEvent('sb:menu-select', { bubbles: true, detail: { value: v } }));
    });
  }

  focus() {
    try { this._root?.focus?.(); } catch (e) {}
  }

  getValue() {
    // If user didn't pick, return initial value to avoid accidental "empty save"
    return this._value == null ? this.initialValue : this._value;
  }

  setValue(v) {
    this._value = v;
  }

  getInputEl() {
    return this._root;
  }

  destroy() {
    if (this.mountEl) this.mountEl.innerHTML = '';
    this._root = null;
    this.mountEl = null;
  }

  _normalizeOptions(options) {
    return (options || []).map((o) => {
      if (o && typeof o === 'object') {
        const value = String(o.value ?? o.label ?? '');
        const label = String(o.label ?? o.value ?? '');
        const color = o.color ? String(o.color) : '';
        return { value, label, color };
      }
      const v = String(o ?? '');
      return { value: v, label: v, color: '' };
    }).filter((it) => !!it.value);
  }

  _itemHTML(it) {
    const style = it.color ? ` style="background:${escapeHtml(it.color)};color:#fff;border-color:transparent;"` : '';
    return `<button type="button" class="sb-menu__item"${style} data-value="${escapeHtml(it.value)}">${escapeHtml(it.label)}</button>`;
  }
}


