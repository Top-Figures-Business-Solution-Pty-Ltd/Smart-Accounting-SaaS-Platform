/**
 * InlineTextareaEditor (Notes-like)
 * - Expands height via CSS class; layout styling is handled by board.css
 */
export class InlineTextareaEditor {
  constructor(mountEl, { initialValue = '', placeholder = '' } = {}) {
    this.mountEl = mountEl;
    this.initialValue = initialValue ?? '';
    this.placeholder = placeholder ?? '';
    this._textarea = null;
    this.render();
  }

  render() {
    if (!this.mountEl) return;
    this.mountEl.innerHTML = `
      <textarea class="form-control sb-inline-editor sb-inline-editor--textarea" rows="3"></textarea>
    `;
    this._textarea = this.mountEl.querySelector('textarea.sb-inline-editor--textarea');
    if (this._textarea) {
      this._textarea.value = String(this.initialValue ?? '');
      this._textarea.placeholder = String(this.placeholder ?? '');
    }
  }

  focus() {
    if (!this._textarea) return;
    try { this._textarea.focus(); } catch (e) {}
  }

  getValue() {
    return this._textarea ? this._textarea.value : '';
  }

  setValue(v) {
    if (this._textarea) this._textarea.value = String(v ?? '');
  }

  getInputEl() {
    return this._textarea;
  }

  destroy() {
    if (this.mountEl) this.mountEl.innerHTML = '';
    this._textarea = null;
    this.mountEl = null;
  }
}


