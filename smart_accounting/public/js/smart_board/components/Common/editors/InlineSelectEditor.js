/**
 * InlineSelectEditor
 * - Single select (Status / Priority / Month / Company etc.)
 */
export class InlineSelectEditor {
  constructor(mountEl, { options = [], initialValue = null, placeholder = null } = {}) {
    this.mountEl = mountEl;
    this.options = Array.isArray(options) ? options : [];
    this.initialValue = initialValue;
    this.placeholder = placeholder;
    this._select = null;
    this.render();
  }

  render() {
    if (!this.mountEl) return;
    const hasPlaceholder = this.placeholder != null && this.placeholder !== '';
    const placeholderOpt = hasPlaceholder
      ? `<option value="" disabled>${String(this.placeholder)}</option>`
      : '';

    const opts = this.options
      .map((o) => {
        if (o && typeof o === 'object') {
          const value = String(o.value ?? o.label ?? '');
          const label = String(o.label ?? o.value ?? '');
          return `<option value="${this._esc(value)}">${this._esc(label)}</option>`;
        }
        const v = String(o ?? '');
        return `<option value="${this._esc(v)}">${this._esc(v)}</option>`;
      })
      .join('');

    this.mountEl.innerHTML = `
      <select class="form-control sb-inline-editor sb-inline-editor--select">
        ${placeholderOpt}
        ${opts}
      </select>
    `;
    this._select = this.mountEl.querySelector('select.sb-inline-editor--select');
    if (this._select) {
      const v = this.initialValue == null ? '' : String(this.initialValue);
      this._select.value = v;
      if (hasPlaceholder && !v) this._select.selectedIndex = 0;
    }
  }

  focus() {
    if (!this._select) return;
    try { this._select.focus(); } catch (e) {}
  }

  getValue() {
    return this._select ? this._select.value : '';
  }

  setValue(v) {
    if (this._select) this._select.value = String(v ?? '');
  }

  getInputEl() {
    return this._select;
  }

  destroy() {
    if (this.mountEl) this.mountEl.innerHTML = '';
    this._select = null;
    this.mountEl = null;
  }

  _esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}


