/**
 * AutomationModal (Monday-like)
 * - Left: saved automation list
 * - Right: edit selected automation
 * - Each rule: When [trigger] → Then [action1] And [action2] ...
 * - Website-safe (Modal + native HTML)
 */
import { escapeHtml } from '../../utils/dom.js';
import { Modal } from '../Common/Modal.js';

export class AutomationModal {
  constructor({ meta = {}, items = [], onSave, onToggle, onDelete, onClose } = {}) {
    this.meta = meta || {};
    this.items = Array.isArray(items) ? items.map((it) => ({
      ...it,
      automation_name: String(it?.automation_name || '').trim(),
      triggers: this._normalizeTriggers(it),
      actions: Array.isArray(it.actions) ? [...it.actions] : [],
    })) : [];
    this.onSave = onSave || (async () => {});
    this.onToggle = onToggle || (async () => {});
    this.onDelete = onDelete || (async () => {});
    this.onClose = onClose || (() => {});

    this._modal = null;
    this._root = null;
    this._saving = false;
    this._activeIdx = this.items.length ? 0 : -1;
  }

  open() {
    this.close();

    const content = document.createElement('div');
    content.className = 'sb-automation';
    content.innerHTML = `
      <div class="sb-automation__hint text-muted">
        Configure automations: When a trigger fires → execute actions automatically.
      </div>
      <div class="sb-automation__list" id="sbAutoList"></div>
    `;

    this._modal = new Modal({
      title: 'Automations',
      contentEl: content,
      onClose: () => this.onClose(),
    });
    this._modal.open();
    this._root = content;

    this._renderList();
  }

  close() {
    this._modal?.close?.();
    this._modal = null;
    this._root = null;
  }

  // =========================================================================
  // Rendering
  // =========================================================================

  _renderList() {
    const wrap = this._root?.querySelector('#sbAutoList');
    if (!wrap) return;

    if (!this.items.length) this._activeIdx = -1;
    if (this._activeIdx >= this.items.length) this._activeIdx = this.items.length - 1;

    wrap.innerHTML = `
      <div class="sb-auto__layout">
        <div class="sb-auto__saved">
          <div class="sb-auto__saved-title">Saved Automations</div>
          <div class="sb-auto__saved-list" id="sbAutoSavedList">
            ${this.items.map((item, idx) => this._savedItemHTML(item, idx)).join('')}
          </div>
          <button class="btn btn-default btn-sm" type="button" id="sbAutoAdd">+ Add Automation</button>
        </div>
        <div class="sb-auto__editor" id="sbAutoEditor">
          ${this._editorHTML()}
        </div>
      </div>
    `;
    wrap.querySelector('#sbAutoAdd')?.addEventListener('click', () => this._addNew());
    wrap.querySelectorAll('.sb-auto__saved-item').forEach((el) => {
      el.addEventListener('click', (e) => this._handleSelectSavedItem(e));
    });
    const editor = wrap.querySelector('#sbAutoEditor');
    if (editor) this._bindRuleEvents(editor);
  }

  _savedItemHTML(item, idx) {
    const active = idx === this._activeIdx;
    const name = this._displayName(item, idx);
    const state = item.enabled ? 'ON' : 'OFF';
    return `
      <button type="button" class="sb-auto__saved-item ${active ? 'is-active' : ''}" data-idx="${idx}">
        <span class="sb-auto__saved-name">${escapeHtml(name)}</span>
        <span class="sb-auto__saved-state">${state}</span>
      </button>
    `;
  }

  _editorHTML() {
    if (this._activeIdx < 0 || !this.items[this._activeIdx]) {
      return `
        <div class="sb-automation__empty text-muted">
          No automations configured yet. Click "+ Add Automation" to create one.
        </div>
      `;
    }
    return this._ruleHTML(this.items[this._activeIdx], this._activeIdx);
  }

  _ruleHTML(item, idx) {
    const enabled = item.enabled ? 'checked' : '';
    const name = item.name || '';
    const automationName = String(item.automation_name || '').trim();
    const triggerRows = Array.isArray(item.triggers) && item.triggers.length
      ? item.triggers
      : [{ trigger_type: '', config: {} }];
    const actions = Array.isArray(item.actions) ? item.actions : [];
    const triggersHTML = triggerRows.map((t, ti) => this._triggerRowHTML(t, idx, ti, ti > 0)).join('');

    // Actions rows
    const actionsHTML = actions.length
      ? actions.map((a, ai) => this._actionRowHTML(a, idx, ai, ai > 0)).join('')
      : this._actionRowHTML({}, idx, 0, false);

    return `
      <div class="sb-automation__rule" data-idx="${idx}" data-name="${escapeHtml(name)}">
        <div class="sb-automation__rule-header">
          <label class="sb-automation__toggle">
            <input type="checkbox" class="sb-auto__enabled" data-idx="${idx}" ${enabled} />
            <span class="sb-automation__toggle-label">${enabled ? 'ON' : 'OFF'}</span>
          </label>
          <button class="btn btn-danger btn-sm sb-auto__delete" data-idx="${idx}" type="button" title="Delete">Delete</button>
        </div>
        <div class="sb-automation__rule-body">
          <div class="sb-automation__row">
            <span class="sb-automation__label">Name</span>
            <input class="form-control sb-auto__name" data-idx="${idx}" type="text" maxlength="140" placeholder="Automation name" value="${escapeHtml(automationName)}" />
          </div>
          ${triggersHTML}
          <div class="sb-automation__rule-actions-bar">
            <button class="btn btn-default btn-sm sb-auto__add-trigger" data-idx="${idx}" type="button">+ And Trigger</button>
          </div>
          ${actionsHTML}
        </div>
        <div class="sb-automation__rule-actions-bar">
          <button class="btn btn-default btn-sm sb-auto__add-action" data-idx="${idx}" type="button">+ And</button>
        </div>
        <div class="sb-automation__rule-footer">
          <button class="btn btn-primary btn-sm sb-auto__save" data-idx="${idx}" type="button">Save</button>
          ${item.execution_count ? `<span class="text-muted" style="font-size:11px;">Executed ${item.execution_count} times</span>` : ''}
        </div>
      </div>
    `;
  }

  _triggerRowHTML(trigger, ruleIdx, triggerIdx, showAnd) {
    const allTriggers = this.meta?.triggers || {};
    const triggerType = trigger?.trigger_type || '';
    const triggerConfig = trigger?.config || {};
    const triggerOpts = Object.entries(allTriggers)
      .filter(([, v]) => !v?.hidden)
      .map(([k, v]) =>
      `<option value="${escapeHtml(k)}" ${k === triggerType ? 'selected' : ''}>${escapeHtml(v.label || k)}</option>`
    ).join('');
    const configHTML = this._configFieldsHTML(allTriggers[triggerType], triggerConfig, `trigger_${ruleIdx}_${triggerIdx}`);
    const andLabel = showAnd ? '<span class="sb-automation__and-label">And</span>' : '<span class="sb-automation__label">When</span>';
    const removeBtn = showAnd
      ? `<button class="btn btn-default sb-auto__remove-trigger" data-idx="${ruleIdx}" data-tidx="${triggerIdx}" type="button" title="Remove">×</button>`
      : '';
    return `
      <div class="sb-automation__row sb-automation__trigger-row" data-idx="${ruleIdx}" data-tidx="${triggerIdx}">
        ${andLabel}
        <select class="form-control sb-auto__trigger-type" data-idx="${ruleIdx}" data-tidx="${triggerIdx}">
          <option value="" disabled ${!triggerType ? 'selected' : ''}>Select trigger</option>
          ${triggerOpts}
        </select>
        ${configHTML}
        ${removeBtn}
      </div>
    `;
  }

  _actionRowHTML(action, ruleIdx, actionIdx, showAnd) {
    const allActions = this.meta?.actions || {};
    const actionType = action?.action_type || '';
    const actionConfig = action?.config || {};

    const actionOpts = Object.entries(allActions).map(([k, v]) =>
      `<option value="${escapeHtml(k)}" ${k === actionType ? 'selected' : ''}>${escapeHtml(v.label || k)}</option>`
    ).join('');

    const configHTML = this._configFieldsHTML(allActions[actionType], actionConfig, `action_${ruleIdx}_${actionIdx}`);

    const andLabel = showAnd ? '<span class="sb-automation__and-label">And</span>' : '<span class="sb-automation__label">Then</span>';
    const removeBtn = showAnd
      ? `<button class="btn btn-default sb-auto__remove-action" data-idx="${ruleIdx}" data-aidx="${actionIdx}" type="button" title="Remove">×</button>`
      : '';

    return `
      <div class="sb-automation__row sb-automation__action-row" data-idx="${ruleIdx}" data-aidx="${actionIdx}">
        ${andLabel}
        <select class="form-control sb-auto__action-type" data-idx="${ruleIdx}" data-aidx="${actionIdx}">
          <option value="" disabled ${!actionType ? 'selected' : ''}>Select action</option>
          ${actionOpts}
        </select>
        ${configHTML}
        ${removeBtn}
      </div>
    `;
  }

  _configFieldsHTML(typeMeta, config, prefix) {
    if (!typeMeta?.config_fields?.length) return '';

    return typeMeta.config_fields.map((cf) => {
      const key = cf.key || '';
      const currentVal = config?.[key] ?? cf.default ?? '';
      const id = `${prefix}_${key}`;

      if (cf.type === 'select' && Array.isArray(cf.options)) {
        const opts = cf.options.map((o) => {
          const val = typeof o === 'string' ? o : (o.value || '');
          const label = typeof o === 'string' ? o : (o.label || val);
          return `<option value="${escapeHtml(val)}" ${val === currentVal ? 'selected' : ''}>${escapeHtml(label)}</option>`;
        }).join('');
        return `
          <select class="form-control sb-auto__config" data-prefix="${escapeHtml(prefix)}" data-key="${escapeHtml(key)}" id="${escapeHtml(id)}">
            <option value="" disabled ${!currentVal ? 'selected' : ''}>${escapeHtml(cf.label || key)}</option>
            ${opts}
          </select>
        `;
      }

      return `
        <input class="form-control sb-auto__config" type="text"
          data-prefix="${escapeHtml(prefix)}" data-key="${escapeHtml(key)}" id="${escapeHtml(id)}"
          placeholder="${escapeHtml(cf.label || key)}" value="${escapeHtml(String(currentVal))}" />
      `;
    }).join('');
  }

  // =========================================================================
  // Events
  // =========================================================================

  _bindRuleEvents(wrap) {
    wrap.querySelectorAll('.sb-auto__enabled').forEach((el) => {
      el.addEventListener('change', (e) => this._handleToggle(e));
    });
    wrap.querySelectorAll('.sb-auto__delete').forEach((el) => {
      el.addEventListener('click', (e) => this._handleDelete(e));
    });
    wrap.querySelectorAll('.sb-auto__save').forEach((el) => {
      el.addEventListener('click', (e) => this._handleSave(e));
    });
    wrap.querySelectorAll('.sb-auto__trigger-type').forEach((el) => {
      el.addEventListener('change', (e) => this._handleTriggerTypeChange(e));
    });
    wrap.querySelectorAll('.sb-auto__add-trigger').forEach((el) => {
      el.addEventListener('click', (e) => this._handleAddTrigger(e));
    });
    wrap.querySelectorAll('.sb-auto__remove-trigger').forEach((el) => {
      el.addEventListener('click', (e) => this._handleRemoveTrigger(e));
    });
    wrap.querySelectorAll('.sb-auto__action-type').forEach((el) => {
      el.addEventListener('change', (e) => this._handleActionTypeChange(e));
    });
    wrap.querySelectorAll('.sb-auto__add-action').forEach((el) => {
      el.addEventListener('click', (e) => this._handleAddAction(e));
    });
    wrap.querySelectorAll('.sb-auto__remove-action').forEach((el) => {
      el.addEventListener('click', (e) => this._handleRemoveAction(e));
    });
  }

  _handleSelectSavedItem(e) {
    const idx = parseInt(e.currentTarget?.dataset?.idx, 10);
    if (!Number.isFinite(idx) || idx < 0 || idx >= this.items.length) return;
    this._activeIdx = idx;
    this._renderList();
  }

  async _handleToggle(e) {
    const idx = parseInt(e.target?.dataset?.idx, 10);
    const item = this.items[idx];
    if (!item?.name) return;

    const enabled = e.target.checked;
    const label = e.target?.parentElement?.querySelector('.sb-automation__toggle-label');
    if (label) label.textContent = enabled ? 'ON' : 'OFF';

    try {
      await this.onToggle(item.name, enabled);
      item.enabled = enabled ? 1 : 0;
    } catch (err) {
      e.target.checked = !enabled;
      if (label) label.textContent = enabled ? 'OFF' : 'ON';
    }
  }

  async _handleDelete(e) {
    const idx = parseInt(e.target?.dataset?.idx, 10);
    const item = this.items[idx];
    if (!item) return;
    const ok = window.confirm(`Delete automation "${this._displayName(item, idx)}"?`);
    if (!ok) return;

    if (item.name) {
      try { await this.onDelete(item.name); } catch (err) { return; }
    }
    this.items.splice(idx, 1);
    if (this._activeIdx >= this.items.length) this._activeIdx = this.items.length - 1;
    this._renderList();
  }

  async _handleSave(e) {
    if (this._saving) return;
    const idx = parseInt(e.target?.dataset?.idx, 10);
    const item = this.items[idx];
    if (!item) return;

    const ruleEl = this._root?.querySelector(`.sb-automation__rule[data-idx="${idx}"]`);
    if (!ruleEl) return;

    const triggers = [];
    const triggerRows = ruleEl.querySelectorAll('.sb-automation__trigger-row');
    triggerRows.forEach((row) => {
      const tidx = parseInt(row.dataset.tidx, 10);
      const triggerType = row.querySelector('.sb-auto__trigger-type')?.value || '';
      if (!triggerType) return;
      const config = {};
      row.querySelectorAll(`.sb-auto__config[data-prefix="trigger_${idx}_${tidx}"]`).forEach((el) => {
        const key = el.dataset.key;
        if (key) config[key] = el.value || '';
      });
      triggers.push({ trigger_type: triggerType, config });
    });
    if (!triggers.length) return;

    // Read all action rows
    const actions = [];
    const actionRows = ruleEl.querySelectorAll('.sb-automation__action-row');
    actionRows.forEach((row) => {
      const aidx = parseInt(row.dataset.aidx, 10);
      const actionType = row.querySelector('.sb-auto__action-type')?.value || '';
      if (!actionType) return;

      const config = {};
      row.querySelectorAll(`.sb-auto__config[data-prefix="action_${idx}_${aidx}"]`).forEach((el) => {
        const key = el.dataset.key;
        if (key) config[key] = el.value || '';
      });

      actions.push({ action_type: actionType, config });
    });

    if (!actions.length) return;

    const enabled = ruleEl.querySelector('.sb-auto__enabled')?.checked ? 1 : 0;
    const automationName = String(ruleEl.querySelector('.sb-auto__name')?.value || '').trim() || this._displayName(item, idx);

    this._saving = true;
    const btn = e.target;
    const prevText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Saving…';

    try {
      const result = await this.onSave({
        name: item.name || '',
        enabled,
        automation_name: automationName,
        trigger_type: triggers[0]?.trigger_type || '',
        trigger_config: { triggers },
        actions,
      });

      item.name = result?.name || item.name;
      item.automation_name = String(result?.automation_name || automationName || '').trim();
      item.enabled = enabled;
      item.trigger_type = triggers[0]?.trigger_type || '';
      item.trigger_config = { triggers };
      item.triggers = triggers;
      item.actions = actions;

      // Re-render to update data-name
      this._renderList();
    } catch (err) {
      // handled by controller
    } finally {
      this._saving = false;
      btn.disabled = false;
      btn.textContent = prevText;
    }
  }

  _handleTriggerTypeChange(e) {
    const idx = parseInt(e.target?.dataset?.idx, 10);
    const tidx = parseInt(e.target?.dataset?.tidx, 10);
    const item = this.items[idx];
    if (!item) return;
    if (!Array.isArray(item.triggers)) item.triggers = [];
    while (item.triggers.length <= tidx) item.triggers.push({ trigger_type: '', config: {} });
    item.triggers[tidx] = { trigger_type: e.target.value || '', config: {} };
    item.trigger_type = item.triggers[0]?.trigger_type || '';
    item.trigger_config = { triggers: item.triggers };
    this._renderList();
  }

  _handleAddTrigger(e) {
    const idx = parseInt(e.target?.dataset?.idx, 10);
    const item = this.items[idx];
    if (!item) return;
    if (!Array.isArray(item.triggers)) item.triggers = [];
    item.triggers.push({ trigger_type: '', config: {} });
    this._renderList();
  }

  _handleRemoveTrigger(e) {
    const idx = parseInt(e.target?.dataset?.idx, 10);
    const tidx = parseInt(e.target?.dataset?.tidx, 10);
    const item = this.items[idx];
    if (!item || !Array.isArray(item.triggers)) return;
    item.triggers.splice(tidx, 1);
    if (!item.triggers.length) item.triggers.push({ trigger_type: '', config: {} });
    item.trigger_type = item.triggers[0]?.trigger_type || '';
    item.trigger_config = { triggers: item.triggers };
    this._renderList();
  }

  _handleActionTypeChange(e) {
    const idx = parseInt(e.target?.dataset?.idx, 10);
    const aidx = parseInt(e.target?.dataset?.aidx, 10);
    const item = this.items[idx];
    if (!item) return;

    if (!Array.isArray(item.actions)) item.actions = [];
    while (item.actions.length <= aidx) item.actions.push({});
    item.actions[aidx] = { action_type: e.target.value || '', config: {} };
    this._renderList();
  }

  _handleAddAction(e) {
    const idx = parseInt(e.target?.dataset?.idx, 10);
    const item = this.items[idx];
    if (!item) return;
    if (!Array.isArray(item.actions)) item.actions = [];
    item.actions.push({ action_type: '', config: {} });
    this._renderList();
  }

  _handleRemoveAction(e) {
    const idx = parseInt(e.target?.dataset?.idx, 10);
    const aidx = parseInt(e.target?.dataset?.aidx, 10);
    const item = this.items[idx];
    if (!item || !Array.isArray(item.actions)) return;
    item.actions.splice(aidx, 1);
    if (!item.actions.length) item.actions.push({ action_type: '', config: {} });
    this._renderList();
  }

  _addNew() {
    this.items.push({
      name: '',
      enabled: 1,
      automation_name: '',
      trigger_type: '',
      trigger_config: { triggers: [{ trigger_type: '', config: {} }] },
      triggers: [{ trigger_type: '', config: {} }],
      actions: [{ action_type: '', config: {} }],
      execution_count: 0,
    });
    this._activeIdx = this.items.length - 1;
    this._renderList();
  }

  _displayName(item, idx) {
    const explicit = String(item?.automation_name || '').trim();
    if (explicit) return explicit;
    return `Automation ${Number(idx) + 1}`;
  }

  _normalizeTriggers(item) {
    const tc = (item && typeof item.trigger_config === 'object' && item.trigger_config) ? item.trigger_config : {};
    const fromConfig = Array.isArray(tc?.triggers) ? tc.triggers : [];
    if (fromConfig.length) {
      return fromConfig
        .filter((t) => t && typeof t === 'object')
        .map((t) => ({ trigger_type: t.trigger_type || '', config: t.config || {} }));
    }
    const ttype = item?.trigger_type || '';
    if (ttype) return [{ trigger_type: ttype, config: tc || {} }];
    return [{ trigger_type: '', config: {} }];
  }
}
