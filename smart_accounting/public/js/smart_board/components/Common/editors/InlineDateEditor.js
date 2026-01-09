/**
 * InlineDateEditor
 * - Uses native <input type="date"> (website-safe)
 * - Confirmation is handled by column spec / manager (not here)
 */
export class InlineDateEditor {
  constructor(mountEl, { initialValue = '', min = null, max = null } = {}) {
    this.mountEl = mountEl;
    this.initialValue = initialValue ?? '';
    this.min = min;
    this.max = max;
    this._input = null;
    this.render();
  }

  render() {
    if (!this.mountEl) return;
    this.mountEl.innerHTML = `
      <input class="form-control sb-inline-editor sb-inline-editor--date" type="date" />
    `;
    this._input = this.mountEl.querySelector('input.sb-inline-editor--date');
    if (this._input) {
      this._input.value = String(this.initialValue ?? '');
      if (this.min) this._input.min = String(this.min);
      if (this.max) this._input.max = String(this.max);
    }
  }

  focus() {
    if (!this._input) return;
    try { this._input.focus(); } catch (e) {}
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


