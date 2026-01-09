/**
 * AdvancedFilterModal (Monday-like)
 * - Column / Condition / Value
 * - Multiple rules with AND / OR
 * - Website-safe (uses Modal + LinkInput)
 *
 * NOTE (v1):
 * - Backend mapping uses frappe get_list: `filters` (AND) + `or_filters` (OR).
 * - Mixed AND/OR is supported in the UI; query semantics are: filters AND (or_filters OR ...).
 */
import { escapeHtml } from '../../utils/dom.js';
import { Modal } from '../Common/Modal.js';
import { LinkInput } from '../Common/LinkInput.js';

const CONDITIONS = {
  text: [
    { value: 'equals', label: 'is' },
    { value: 'not_equals', label: 'is not' },
    { value: 'contains', label: 'contains' },
    { value: 'not_contains', label: "doesn't contain" },
    { value: 'starts_with', label: 'starts with' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' },
  ],
  select: [
    { value: 'equals', label: 'is' },
    { value: 'not_equals', label: 'is not' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' },
  ],
  date: [
    { value: 'equals', label: 'is' },
    { value: 'before', label: 'is before' },
    { value: 'after', label: 'is after' },
    { value: 'on_or_before', label: 'on or before' },
    { value: 'on_or_after', label: 'on or after' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' },
  ],
  link: [
    { value: 'equals', label: 'is' },
    { value: 'not_equals', label: 'is not' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' },
  ],
};

function needsValue(condition) {
  return !['is_empty', 'is_not_empty'].includes(condition);
}

export class AdvancedFilterModal {
  constructor({ title = 'Filter', columns = [], initial = {}, onApply, onClose } = {}) {
    this.title = title;
    this.columns = Array.isArray(columns) ? columns : [];
    this.initial = initial || {};
    this.onApply = onApply || (() => {});
    this.onClose = onClose || (() => {});

    this._modal = null;
    this._root = null;
    this._rules = this._normalizeInitialRules(initial);
    this._linkInputs = new Map(); // key: rowId -> LinkInput
  }

  _normalizeInitialRules(initial) {
    const rules = Array.isArray(initial?.advanced_rules) ? initial.advanced_rules : null;
    if (rules && rules.length) {
      return rules.map((r, idx) => ({
        id: r.id || `${Date.now()}_${idx}`,
        join: r.join || (idx === 0 ? 'where' : 'and'),
        field: r.field || '',
        condition: r.condition || 'equals',
        value: r.value ?? '',
      }));
    }
    // default single empty row
    return [{
      id: `${Date.now()}_0`,
      join: 'where',
      field: '',
      condition: 'equals',
      value: '',
    }];
  }

  open() {
    this.close();
    const content = document.createElement('div');
    content.innerHTML = `
      <div class="sb-advfilter">
        <div class="sb-advfilter__hint text-muted">Column / Condition / Value（支持 AND / OR 多条）。</div>
        <div class="sb-advfilter__rows" id="sbAdvFilterRows"></div>
        <div style="margin-top:10px;">
          <button class="btn btn-default" type="button" id="sbAdvAddRow">+ New filter</button>
        </div>
      </div>
    `;

    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.justifyContent = 'flex-end';
    footer.style.gap = '10px';
    footer.innerHTML = `
      <button class="btn btn-default" type="button" id="sbAdvClear">Clear</button>
      <button class="btn btn-default" type="button" id="sbAdvCancel">Cancel</button>
      <button class="btn btn-primary" type="button" id="sbAdvApply">Apply</button>
    `;

    this._modal = new Modal({
      title: this.title,
      contentEl: content,
      footerEl: footer,
      onClose: () => {
        this._destroyLinkInputs();
        this.onClose();
      }
    });
    this._modal.open();

    this._root = content;
    this._renderRows();

    footer.querySelector('#sbAdvCancel')?.addEventListener('click', () => this.close());
    footer.querySelector('#sbAdvApply')?.addEventListener('click', () => this._apply());
    footer.querySelector('#sbAdvClear')?.addEventListener('click', () => this._clear());
    content.querySelector('#sbAdvAddRow')?.addEventListener('click', () => this._addRow());
  }

  close() {
    this._modal?.close?.();
    this._modal = null;
    this._root = null;
  }

  _columnsOptionsHTML() {
    return this.columns.map((c) => `<option value="${escapeHtml(c.field)}">${escapeHtml(c.label || c.field)}</option>`).join('');
  }

  _getColMeta(field) {
    return this.columns.find((c) => c.field === field) || null;
  }

  _conditionsForField(field) {
    const meta = this._getColMeta(field);
    const type = meta?.type || 'text';
    return CONDITIONS[type] || CONDITIONS.text;
  }

  _rowHTML(r, idx) {
    const colOpts = this._columnsOptionsHTML();
    const conds = this._conditionsForField(r.field);
    const condOpts = conds.map((c) => `<option value="${escapeHtml(c.value)}">${escapeHtml(c.label)}</option>`).join('');

    const joiner = idx === 0
      ? `<div class="sb-advfilter__join sb-advfilter__join--where">Where</div>`
      : `
        <select class="form-control sb-advfilter__join sb-advfilter__join--select" data-role="join" data-id="${escapeHtml(r.id)}">
          <option value="and" ${r.join === 'and' ? 'selected' : ''}>And</option>
          <option value="or" ${r.join === 'or' ? 'selected' : ''}>Or</option>
        </select>
      `;

    const needs = needsValue(r.condition);
    const valueCell = `<div class="sb-advfilter__value" data-role="value" data-id="${escapeHtml(r.id)}"></div>`;

    return `
      <div class="sb-advfilter__row" data-id="${escapeHtml(r.id)}">
        ${joiner}
        <select class="form-control sb-advfilter__col" data-role="field" data-id="${escapeHtml(r.id)}">
          <option value="" ${!r.field ? 'selected' : ''} disabled>Select column</option>
          ${colOpts}
        </select>
        <select class="form-control sb-advfilter__cond" data-role="condition" data-id="${escapeHtml(r.id)}">
          ${condOpts}
        </select>
        ${valueCell}
        <button class="btn btn-default sb-advfilter__del" type="button" data-role="delete" data-id="${escapeHtml(r.id)}">×</button>
      </div>
    `;
  }

  _renderRows() {
    if (!this._root) return;
    const wrap = this._root.querySelector('#sbAdvFilterRows');
    if (!wrap) return;

    // Re-render rows; destroy link inputs first (will be re-mounted)
    this._destroyLinkInputs();

    wrap.innerHTML = this._rules.map((r, idx) => this._rowHTML(r, idx)).join('');

    // Set current values and mount value editors
    this._rules.forEach((r, idx) => {
      const rowEl = wrap.querySelector(`.sb-advfilter__row[data-id="${CSS.escape(r.id)}"]`);
      if (!rowEl) return;

      const fieldSel = rowEl.querySelector('select[data-role="field"]');
      const condSel = rowEl.querySelector('select[data-role="condition"]');
      if (fieldSel && r.field) fieldSel.value = r.field;
      if (condSel && r.condition) condSel.value = r.condition;

      this._mountValueEditor(r);

      // Hide delete on first row if it is the only row
      const delBtn = rowEl.querySelector('button[data-role="delete"]');
      if (delBtn) delBtn.style.visibility = (this._rules.length === 1) ? 'hidden' : 'visible';
    });

    // Bind events (delegated)
    wrap.addEventListener('change', (e) => this._onChange(e));
    wrap.addEventListener('click', (e) => this._onClick(e));
  }

  _onChange(e) {
    const el = e.target;
    const role = el?.dataset?.role;
    const id = el?.dataset?.id;
    if (!role || !id) return;
    const r = this._rules.find((x) => x.id === id);
    if (!r) return;

    if (role === 'join') {
      r.join = el.value;
      return;
    }
    if (role === 'field') {
      r.field = el.value;
      // Reset condition/value on field change
      const conds = this._conditionsForField(r.field);
      r.condition = conds[0]?.value || 'equals';
      r.value = '';
      this._renderRows();
      return;
    }
    if (role === 'condition') {
      r.condition = el.value;
      // Reset value if no longer needed
      if (!needsValue(r.condition)) r.value = '';
      this._mountValueEditor(r);
      return;
    }
  }

  _onClick(e) {
    const btn = e.target?.closest?.('[data-role="delete"]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (!id) return;
    this._rules = this._rules.filter((r) => r.id !== id);
    if (!this._rules.length) this._rules = this._normalizeInitialRules({});
    // First row always treated as where
    if (this._rules[0]) this._rules[0].join = 'where';
    this._renderRows();
  }

  _mountValueEditor(rule) {
    if (!this._root) return;
    const wrap = this._root.querySelector('#sbAdvFilterRows');
    if (!wrap) return;
    const valueHost = wrap.querySelector(`[data-role="value"][data-id="${CSS.escape(rule.id)}"]`);
    if (!valueHost) return;

    valueHost.innerHTML = '';

    if (!needsValue(rule.condition)) {
      valueHost.innerHTML = `<div class="text-muted sb-advfilter__value--na">—</div>`;
      return;
    }

    const meta = this._getColMeta(rule.field);
    const type = meta?.type || 'text';

    if (type === 'date') {
      valueHost.innerHTML = `<input class="form-control" type="date" />`;
      const inp = valueHost.querySelector('input');
      if (inp) {
        inp.value = rule.value || '';
        inp.addEventListener('change', () => { rule.value = inp.value; });
      }
      return;
    }

    if (type === 'select') {
      const opts = (meta?.options || []).map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
      valueHost.innerHTML = `
        <select class="form-control">
          <option value="" ${!rule.value ? 'selected' : ''} disabled>Select value</option>
          ${opts}
        </select>
      `;
      const sel = valueHost.querySelector('select');
      if (sel && rule.value) sel.value = rule.value;
      sel?.addEventListener('change', () => { rule.value = sel.value; });
      return;
    }

    if (type === 'link') {
      const mount = document.createElement('div');
      valueHost.appendChild(mount);
      const li = new LinkInput(mount, {
        doctype: meta?.doctype || 'Customer',
        placeholder: meta?.placeholder || 'Search...',
        initialValue: rule.value || null,
        onChange: (v) => { rule.value = v; }
      });
      this._linkInputs.set(rule.id, li);
      return;
    }

    // text default
    valueHost.innerHTML = `<input class="form-control" type="text" placeholder="Value" />`;
    const inp = valueHost.querySelector('input');
    if (inp) {
      inp.value = rule.value || '';
      inp.addEventListener('input', () => { rule.value = inp.value; });
    }
  }

  _addRow() {
    this._rules.push({
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      join: this._rules.length ? 'and' : 'where',
      field: '',
      condition: 'equals',
      value: '',
    });
    if (this._rules[0]) this._rules[0].join = 'where';
    this._renderRows();
  }

  _clear() {
    this._rules = this._normalizeInitialRules({});
    this._renderRows();
  }

  _apply() {
    // Persist UI rules back to store so it can be reopened with same configuration
    const payload = {
      advanced_rules: this._rules.map((r, idx) => ({
        id: r.id,
        join: idx === 0 ? 'where' : (r.join || 'and'),
        field: r.field,
        condition: r.condition,
        value: r.value,
      }))
    };
    this.onApply(payload);
    this.close();
  }

  _destroyLinkInputs() {
    for (const inp of this._linkInputs.values()) {
      try { inp?.destroy?.(); } catch (e) {}
    }
    this._linkInputs.clear();
  }
}


