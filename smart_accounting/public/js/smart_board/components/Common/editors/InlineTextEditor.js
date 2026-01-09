/**
 * InlineTextEditor
 * - Website-safe, no Desk dependency
 * - Controlled by caller (manager handles commit/cancel triggers)
 */
export class InlineTextEditor {
  constructor(mountEl, { initialValue = '', placeholder = '' } = {}) {
    this.mountEl = mountEl;
    this.initialValue = initialValue ?? '';
    this.placeholder = placeholder ?? '';
    this._input = null;
    this.render();
  }

  render() {
    if (!this.mountEl) return;
    this.mountEl.innerHTML = `
      <input class="form-control sb-inline-editor sb-inline-editor--text" type="text" />
    `;
    this._input = this.mountEl.querySelector('input.sb-inline-editor--text');
    if (this._input) {
      this._input.value = String(this.initialValue ?? '');
      this._input.placeholder = String(this.placeholder ?? '');
    }
  }

  focus({ select = true } = {}) {
    if (!this._input) return;
    try {
      this._input.focus();
      if (select && this._input.select) this._input.select();
    } catch (e) {}
  }

  getValue() {
    return this._input ? this._input.value : '';
  }

  setValue(v) {
    if (this._input) this._input.value = String(v ?? '');
  }

  getInputEl() {
    return this._input;
  }

  destroy() {
    if (this.mountEl) this.mountEl.innerHTML = '';
    this._input = null;
    this.mountEl = null;
  }
}


