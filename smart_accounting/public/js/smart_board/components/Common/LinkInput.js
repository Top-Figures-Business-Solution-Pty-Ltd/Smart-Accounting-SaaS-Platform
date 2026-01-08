/**
 * LinkInput (Website-safe)
 * - Uses frappe.desk.search.search_link for dynamic search
 * - Debounced input, caches results, discards stale responses
 */
import { escapeHtml } from '../../utils/dom.js';
import { debounce } from '../../utils/helpers.js';

export class LinkInput {
  constructor(mountEl, { doctype, placeholder = 'Search...', initialValue = null, onChange } = {}) {
    this.mountEl = mountEl;
    this.doctype = doctype;
    this.placeholder = placeholder;
    this.value = initialValue || null;
    this.onChange = onChange || (() => {});

    this._cache = new Map(); // key: txt -> results
    this._seq = 0;
    this._open = false;
    this._onDocClick = null;

    this._render();
    this._bind();
    this.setValue(this.value);
  }

  _render() {
    this.mountEl.innerHTML = `
      <div class="sb-linkinput">
        <input class="form-control sb-linkinput__input" type="text" placeholder="${escapeHtml(this.placeholder)}" />
        <div class="sb-linkinput__menu" style="display:none;"></div>
      </div>
    `;
    this._root = this.mountEl.querySelector('.sb-linkinput');
    this._input = this.mountEl.querySelector('.sb-linkinput__input');
    this._menu = this.mountEl.querySelector('.sb-linkinput__menu');
  }

  _bind() {
    if (!this._input) return;
    const onInput = debounce(() => {
      const txt = (this._input.value || '').trim();
      this._search(txt);
    }, 300);

    this._input.addEventListener('input', onInput);
    this._input.addEventListener('focus', () => {
      const txt = (this._input.value || '').trim();
      this._search(txt);
    });

    this._menu?.addEventListener('click', (e) => {
      const item = e.target?.closest?.('.sb-linkinput__item');
      if (!item) return;
      e.preventDefault();
      const val = item.dataset.value || null;
      this.setValue(val);
      this.closeMenu();
      this.onChange(this.value);
    });

    this._onDocClick = (e) => {
      if (!this._root) return;
      if (!this._root.contains(e.target)) this.closeMenu();
    };
    document.addEventListener('click', this._onDocClick);
  }

  async _search(txt) {
    // Empty: just show selected value; keep menu closed.
    if (!this._menu) return;

    if (!txt) {
      this.closeMenu();
      return;
    }

    const key = txt.toLowerCase();
    if (this._cache.has(key)) {
      this._renderMenu(this._cache.get(key));
      return;
    }

    const seq = ++this._seq;
    try {
      const r = await frappe.call({
        method: 'frappe.desk.search.search_link',
        args: {
          doctype: this.doctype,
          txt,
          page_length: 10
        }
      });

      if (seq !== this._seq) return; // stale
      const results = (r.message || []).map((row) => row.value).filter(Boolean);
      this._cache.set(key, results);
      this._renderMenu(results);
    } catch (e) {
      // fail silent; don't spam
      if (seq !== this._seq) return;
      this._renderMenu([]);
    }
  }

  _renderMenu(items) {
    if (!this._menu) return;
    const list = Array.isArray(items) ? items : [];
    this._menu.innerHTML = list.length
      ? list.map((v) => `<div class="sb-linkinput__item" data-value="${escapeHtml(v)}">${escapeHtml(v)}</div>`).join('')
      : `<div class="sb-linkinput__empty text-muted">No results</div>`;
    this.openMenu();
  }

  openMenu() {
    if (!this._menu) return;
    this._menu.style.display = 'block';
    this._open = true;
  }

  closeMenu() {
    if (!this._menu) return;
    this._menu.style.display = 'none';
    this._open = false;
  }

  getValue() {
    return this.value;
  }

  setValue(value) {
    this.value = value || null;
    if (this._input) this._input.value = this.value || '';
  }

  destroy() {
    if (this._onDocClick) {
      document.removeEventListener('click', this._onDocClick);
      this._onDocClick = null;
    }
    this.mountEl.innerHTML = '';
  }
}


