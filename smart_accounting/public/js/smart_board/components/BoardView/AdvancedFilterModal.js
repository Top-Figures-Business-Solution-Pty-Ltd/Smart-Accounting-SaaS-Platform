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
import { MultiLinkPicker } from '../Common/MultiLinkPicker.js';
import { MentionService } from '../../services/mentionService.js';

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
  // Website-safe User picker (team role filters)
  user: [
    { value: 'equals', label: 'is' },
    { value: 'not_equals', label: 'is not' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' },
  ],
};

function needsValue(condition) {
  return !['is_empty', 'is_not_empty'].includes(condition);
}

function _isNonEmptyString(v) {
  return v != null && String(v).trim().length > 0;
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
    this._groups = this._normalizeInitialGroups(initial);
    this._linkInputs = new Map(); // key: rowId -> LinkInput
    this._rowsEl = null;
    this._boundRowsEvents = false;
  }

  _normalizeInitialGroups(initial) {
    const groups = Array.isArray(initial?.advanced_groups) ? initial.advanced_groups : null;
    if (groups && groups.length) {
      return groups.map((g, gi) => ({
        id: g.id || `${Date.now()}_g${gi}`,
        join: gi === 0 ? 'where' : (g.join || 'and'),
        rules: (g.rules || []).map((r, ri) => ({
          id: r.id || `${Date.now()}_${gi}_${ri}`,
          field: r.field || '',
          condition: r.condition || 'equals',
          value: r.value ?? '',
        }))
      }));
    }

    // Backward compatibility: old flat advanced_rules -> one group
    const rules = Array.isArray(initial?.advanced_rules) ? initial.advanced_rules : null;
    if (rules && rules.length) {
      return [{
        id: `${Date.now()}_g0`,
        join: 'where',
        rules: rules.map((r, idx) => ({
          id: r.id || `${Date.now()}_0_${idx}`,
          field: r.field || '',
          condition: r.condition || 'equals',
          value: r.value ?? '',
        }))
      }];
    }

    return [{
      id: `${Date.now()}_g0`,
      join: 'where',
      rules: [{
        id: `${Date.now()}_0_0`,
        field: '',
        condition: 'equals',
        value: '',
      }]
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
          <button class="btn btn-default" type="button" id="sbAdvAddGroup" style="margin-left:8px;">+ New group</button>
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
    this._rowsEl = content.querySelector('#sbAdvFilterRows');
    this._renderRows();

    footer.querySelector('#sbAdvCancel')?.addEventListener('click', () => this.close());
    footer.querySelector('#sbAdvApply')?.addEventListener('click', () => this._apply());
    footer.querySelector('#sbAdvClear')?.addEventListener('click', () => this._clear());
    content.querySelector('#sbAdvAddRow')?.addEventListener('click', () => this._addRow());
    content.querySelector('#sbAdvAddGroup')?.addEventListener('click', () => this._addGroup());

    // Bind delegated events ONCE (avoid duplicated handlers on re-render)
    this._bindRowsEventsOnce();
  }

  close() {
    this._modal?.close?.();
    this._modal = null;
    this._root = null;
    this._rowsEl = null;
    this._boundRowsEvents = false;
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

  _ruleRowHTML(group, r, ruleIndex, groupIndex) {
    const colOpts = this._columnsOptionsHTML();
    const conds = this._conditionsForField(r.field);
    const condOpts = conds.map((c) => `<option value="${escapeHtml(c.value)}">${escapeHtml(c.label)}</option>`).join('');

    const joiner = (groupIndex === 0 && ruleIndex === 0)
      ? `<div class="sb-advfilter__join sb-advfilter__join--where">Where</div>`
      : `<div class="sb-advfilter__join sb-advfilter__join--and text-muted">And</div>`;

    const needs = needsValue(r.condition);
    const valueCell = `<div class="sb-advfilter__value" data-role="value" data-id="${escapeHtml(r.id)}"></div>`;

    return `
      <div class="sb-advfilter__row" data-group-id="${escapeHtml(group.id)}" data-id="${escapeHtml(r.id)}">
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

  _groupHeaderHTML(group, groupIndex) {
    if (groupIndex === 0) return '';
    const join = group.join || 'and';
    return `
      <div class="sb-advfilter__groupjoin">
        <select class="form-control sb-advfilter__groupjoin__select" data-role="group-join" data-group-id="${escapeHtml(group.id)}">
          <option value="and" ${join === 'and' ? 'selected' : ''}>And</option>
          <option value="or" ${join === 'or' ? 'selected' : ''}>Or</option>
        </select>
      </div>
    `;
  }

  _renderRows() {
    if (!this._root) return;
    const wrap = this._rowsEl || this._root.querySelector('#sbAdvFilterRows');
    if (!wrap) return;

    // Re-render rows; destroy link inputs first (will be re-mounted)
    this._destroyLinkInputs();

    wrap.innerHTML = this._groups.map((g, gi) => {
      const header = this._groupHeaderHTML(g, gi);
      const rows = (g.rules || []).map((r, ri) => this._ruleRowHTML(g, r, ri, gi)).join('');
      return `${header}${rows}`;
    }).join('');

    // Set current values and mount value editors
    const totalRules = this._groups.reduce((acc, g) => acc + ((g.rules || []).length), 0);
    this._groups.forEach((g) => {
      (g.rules || []).forEach((r) => {
        const rowEl = wrap.querySelector(`.sb-advfilter__row[data-id="${CSS.escape(r.id)}"]`);
        if (!rowEl) return;

        const fieldSel = rowEl.querySelector('select[data-role="field"]');
        const condSel = rowEl.querySelector('select[data-role="condition"]');
        if (fieldSel && r.field) fieldSel.value = r.field;
        if (condSel && r.condition) condSel.value = r.condition;

        this._mountValueEditor(r);

        const delBtn = rowEl.querySelector('button[data-role="delete"]');
        if (delBtn) delBtn.style.visibility = (totalRules === 1) ? 'hidden' : 'visible';
      });
    });

    // Events are bound once in _bindRowsEventsOnce().
  }

  _bindRowsEventsOnce() {
    const wrap = this._rowsEl;
    if (!wrap || this._boundRowsEvents) return;
    this._boundRowsEvents = true;

    wrap.addEventListener('change', (e) => this._onChange(e));
    wrap.addEventListener('click', (e) => this._onClick(e));
  }

  _onChange(e) {
    const el = e.target;
    const role = el?.dataset?.role;
    const id = el?.dataset?.id;
    if (!role) return;

    if (role === 'group-join') {
      const gid = el.dataset.groupId;
      const g = this._groups.find((x) => x.id === gid);
      if (!g) return;
      g.join = el.value;
      return;
    }

    if (!id) return;
    const r = this._findRuleById(id);
    if (!r) return;

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
    this._deleteRule(id);
    this._renderRows();
  }

  _findRuleById(id) {
    for (const g of this._groups) {
      const r = (g.rules || []).find((x) => x.id === id);
      if (r) return r;
    }
    return null;
  }

  _deleteRule(id) {
    for (const g of this._groups) {
      g.rules = (g.rules || []).filter((r) => r.id !== id);
    }
    this._groups = this._groups.filter((g) => (g.rules || []).length > 0);
    if (!this._groups.length) this._groups = this._normalizeInitialGroups({});
    if (this._groups[0]) this._groups[0].join = 'where';
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
        displayField: meta?.displayField || null,
        initialValue: rule.value || null,
        onChange: (v) => { rule.value = v; }
      });
      this._linkInputs.set(rule.id, li);
      return;
    }

    if (type === 'user') {
      const mount = document.createElement('div');
      valueHost.appendChild(mount);
      const initial = rule.value ? [String(rule.value)] : [];
      const picker = new MultiLinkPicker(mount, {
        doctype: 'User',
        placeholder: meta?.placeholder || 'Select user...',
        initialValues: initial,
        max: 1,
        // Website-safe user search (does not require User read perm)
        searchProvider: async (txt) => {
          const list = await MentionService.searchUsers(txt, { limit: 12 });
          return (list || []).map((u) => u?.name).filter(Boolean);
        },
        defaultList: async () => {
          const list = await MentionService.searchUsers('', { limit: 20 });
          return (list || []).map((u) => u?.name).filter(Boolean);
        },
        resolveMeta: async (values) => {
          try {
            const arr = Array.isArray(values) ? values.filter(Boolean) : [];
            if (!arr.length) return {};
            const r = await frappe.call({
              method: 'smart_accounting.api.project_board.get_user_meta',
              args: { users: arr }
            });
            return r?.message || {};
          } catch (e) {
            return {};
          }
        },
        onChange: () => {
          const v = picker.getValue?.() || [];
          rule.value = (Array.isArray(v) && v.length) ? String(v[0]) : '';
        }
      });
      // Store picker for cleanup
      this._linkInputs.set(rule.id, picker);
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
    const g = this._groups[this._groups.length - 1] || null;
    if (!g) return;
    g.rules = g.rules || [];
    g.rules.push({
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      field: '',
      condition: 'equals',
      value: '',
    });
    this._renderRows();
  }

  _addGroup() {
    const gi = this._groups.length;
    this._groups.push({
      id: `${Date.now()}_g${gi}`,
      join: 'and',
      rules: [{
        id: `${Date.now()}_${gi}_0`,
        field: '',
        condition: 'equals',
        value: '',
      }]
    });
    if (this._groups[0]) this._groups[0].join = 'where';
    this._renderRows();
  }

  _clear() {
    this._groups = this._normalizeInitialGroups({});
    this._renderRows();
  }

  _apply() {
    // Persist UI rules back to store so it can be reopened with same configuration
    const cleanedGroups = (this._groups || [])
      .map((g, gi) => {
        const rules = (g.rules || [])
          .filter((r) => {
            if (!_isNonEmptyString(r?.field)) return false;
            if (!_isNonEmptyString(r?.condition)) return false;
            if (needsValue(r.condition) && !_isNonEmptyString(r?.value)) return false;
            return true;
          })
          .map((r) => ({
            id: r.id,
            field: r.field,
            condition: r.condition,
            value: r.value,
          }));

        return {
          id: g.id,
          join: gi === 0 ? 'where' : (g.join || 'and'),
          rules,
        };
      })
      .filter((g) => (g.rules || []).length > 0);

    const payload = { advanced_groups: cleanedGroups };
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



