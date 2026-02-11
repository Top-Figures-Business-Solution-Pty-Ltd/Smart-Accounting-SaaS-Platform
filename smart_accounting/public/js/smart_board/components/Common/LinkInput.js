/**
 * LinkInput (Website-safe)
 * - Uses frappe.desk.search.search_link for dynamic search
 * - Debounced input, caches results, discards stale responses
 * - Shows description (e.g. customer_name) as primary display, value (ID) as secondary
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

    this._cache = new Map(); // key: txt -> [{value, description}]
    this._seq = 0;
    this._open = false;
    this._onDocClick = null;
    this._onDocScroll = null;
    this._onWinResize = null;
    this._menuPortal = null;

    this._render();
    this._createPortalMenu();
    this._bind();
    this.setValue(this.value);
  }

  _render() {
    this.mountEl.innerHTML = `
      <div class="sb-linkinput">
        <input class="form-control sb-linkinput__input" type="text" placeholder="${escapeHtml(this.placeholder)}" />
      </div>
    `;
    this._root = this.mountEl.querySelector('.sb-linkinput');
    this._input = this.mountEl.querySelector('.sb-linkinput__input');
    this._menu = null; // portal
  }

  _createPortalMenu() {
    const el = document.createElement('div');
    el.className = 'sb-linkinput__menu sb-linkinput__menu--portal';
    el.style.display = 'none';
    el.dataset.sbEditorPortal = '1';
    document.body.appendChild(el);
    this._menu = el;
    this._menuPortal = el;
  }

  _bind() {
    if (!this._input) return;
    const onInput = debounce(() => {
      const txt = (this._input.value || '').trim();
      this._search(txt);
    }, 300);

    this._input.addEventListener('input', () => {
      // Clear stored value when user types (they're searching for something new)
      this.value = null;
      onInput();
    });
    this._input.addEventListener('focus', () => {
      const txt = (this._input.value || '').trim();
      this._search(txt);
    });

    this._menu?.addEventListener('click', (e) => {
      const item = e.target?.closest?.('.sb-linkinput__item');
      if (!item) return;
      e.preventDefault();
      const val = item.dataset.value || null;
      this._selectItem(val);
    });

    this._onDocClick = (e) => {
      if (!this._root) return;
      const inRoot = this._root.contains(e.target);
      const inMenu = this._menu?.contains?.(e.target);
      if (!inRoot && !inMenu) this.closeMenu();
    };
    document.addEventListener('click', this._onDocClick);

    // Reposition menu on scroll/resize so it always stays aligned
    this._onDocScroll = () => {
      if (this._open) this._repositionMenu();
    };
    document.addEventListener('scroll', this._onDocScroll, true);

    this._onWinResize = () => {
      if (this._open) this._repositionMenu();
    };
    window.addEventListener('resize', this._onWinResize);
  }

  async _search(txt) {
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
      const results = (r.message || []).map((row) => ({
        value: row.value || '',
        description: row.description || '',
      })).filter((r) => r.value);
      this._cache.set(key, results);
      this._renderMenu(results);
    } catch (e) {
      if (seq !== this._seq) return;
      this._renderMenu([]);
    }
  }

  _renderMenu(items) {
    if (!this._menu) return;
    const list = Array.isArray(items) ? items : [];
    if (!list.length) {
      this._menu.innerHTML = `<div class="sb-linkinput__empty text-muted">No results</div>`;
      this.openMenu();
      return;
    }

    this._menu.innerHTML = list.map((item) => {
      const val = item.value || '';
      return `
        <div class="sb-linkinput__item" data-value="${escapeHtml(val)}">
          <span class="sb-linkinput__item-primary">${escapeHtml(val)}</span>
        </div>
      `;
    }).join('');
    this.openMenu();
  }

  _selectItem(value) {
    this.value = value || null;
    if (this._input) {
      this._input.value = this.value || '';
    }
    this.closeMenu();
    this.onChange(this.value);
  }

  _repositionMenu() {
    if (!this._menu || !this._input) return;
    const rect = this._input.getBoundingClientRect();
    const gap = 6;
    const top = rect.bottom + gap;
    const left = rect.left;
    const width = rect.width;

    this._menu.style.position = 'fixed';
    this._menu.style.left = `${Math.max(8, left)}px`;
    this._menu.style.top = `${Math.max(8, top)}px`;
    this._menu.style.width = `${Math.max(220, width)}px`;
    this._menu.style.zIndex = '30000';

    const maxH = Math.max(160, Math.min(320, window.innerHeight - top - 12));
    this._menu.style.maxHeight = `${maxH}px`;
  }

  openMenu() {
    if (!this._menu) return;
    this._repositionMenu();
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
    if (this._onDocScroll) {
      document.removeEventListener('scroll', this._onDocScroll, true);
      this._onDocScroll = null;
    }
    if (this._onWinResize) {
      window.removeEventListener('resize', this._onWinResize);
      this._onWinResize = null;
    }
    if (this._menuPortal?.parentNode) {
      try { this._menuPortal.parentNode.removeChild(this._menuPortal); } catch (e) {}
    }
    this._menuPortal = null;
    this.mountEl.innerHTML = '';
  }
}
