/**
 * ProjectEntityChangeModal (Website-safe)
 * - Pick a Customer Entity row for a Project, with a double-confirm step.
 *
 * Selected value:
 * - Customer Entity.name (row id)
 */
import { Modal } from '../Common/Modal.js';
import { escapeHtml } from '../../utils/dom.js';

function _labelForEntityRow(row) {
  const type = String(row?.entity_type || '').trim();
  const name = String(row?.entity_name || '').trim();
  const year = String(row?.year_end || '').trim();
  const primary = Number(row?.is_primary || 0) ? ' (Primary)' : '';
  const bits = [];
  if (type) bits.push(type);
  if (name) bits.push(name);
  const base = bits.join(' · ') || String(row?.name || '').trim() || '—';
  return year ? `${base} · ${year}${primary}` : `${base}${primary}`;
}

export class ProjectEntityChangeModal {
  constructor({ project, entities = [], currentEntityName = '', onConfirm, onClose } = {}) {
    this.project = project || null; // { name, project_name?, customer?, custom_customer_entity?, custom_entity_type? }
    this.entities = Array.isArray(entities) ? entities : [];
    this.currentEntityName = String(currentEntityName || '').trim();
    this.onConfirm = typeof onConfirm === 'function' ? onConfirm : (async () => {});
    this.onClose = typeof onClose === 'function' ? onClose : (() => {});

    this._modal = null;
    this._root = null;
    this._submitting = false;
  }

  async open() {
    this.close();

    const p = this.project || {};
    const currentText = String(p?.custom_entity_type || '').trim();
    const title = 'Change Entity';

    const content = document.createElement('div');
    content.innerHTML = `
      <div class="sb-newclient">
        <div class="sb-newproj__row">
          <label class="sb-newproj__label">Project</label>
          <div style="font-weight:600;">${escapeHtml(p?.project_name || p?.name || '—')}</div>
          <div class="text-muted" style="font-size:12px;">${escapeHtml(p?.name || '')}</div>
        </div>

        <div style="display:flex; gap:12px; flex-wrap:wrap;">
          <div class="sb-newproj__row" style="min-width:220px; flex:1;">
            <label class="sb-newproj__label">Current Entity</label>
            <input class="form-control" type="text" value="${escapeHtml(currentText || '—')}" disabled />
          </div>
          <div class="sb-newproj__row" style="min-width:220px; flex:1;">
            <label class="sb-newproj__label">New Entity *</label>
            <select class="form-control" id="sbProjEntityNew">
              <option value="" disabled selected>Select entity</option>
            </select>
          </div>
        </div>

        <div class="sb-newproj__error text-danger" id="sbProjEntityErr" style="display:none;"></div>
      </div>
    `;

    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.justifyContent = 'flex-end';
    footer.style.gap = '10px';
    footer.innerHTML = `
      <button class="btn btn-default" type="button" id="sbProjEntityCancel">Cancel</button>
      <button class="btn btn-primary" type="button" id="sbProjEntityContinue">Continue</button>
    `;

    this._modal = new Modal({
      title,
      contentEl: content,
      footerEl: footer,
      onClose: () => this.onClose(),
    });
    this._modal.open();
    this._root = content;

    this._renderOptions();
    // Empty state: no entities for this client
    try {
      const list = Array.isArray(this.entities) ? this.entities : [];
      if (!list.length) {
        this._setError('No entities found for this client. Please create a Customer Entity (primary) first.');
        const btn = this._modal?._overlay?.querySelector?.('#sbProjEntityContinue');
        if (btn) btn.disabled = true;
        const sel = this._root?.querySelector?.('#sbProjEntityNew');
        if (sel) sel.disabled = true;
      }
    } catch (e) {}

    footer.querySelector('#sbProjEntityCancel')?.addEventListener('click', () => this.close());
    footer.querySelector('#sbProjEntityContinue')?.addEventListener('click', () => this._handleContinue());
  }

  close() {
    this._modal?.close?.();
    this._modal = null;
    this._root = null;
  }

  _setError(msg) {
    const el = this._root?.querySelector?.('#sbProjEntityErr');
    if (!el) return;
    const m = String(msg || '').trim();
    el.textContent = m;
    el.style.display = m ? 'block' : 'none';
  }

  _renderOptions() {
    const sel = this._root?.querySelector?.('#sbProjEntityNew');
    if (!sel) return;
    const list = Array.isArray(this.entities) ? this.entities : [];
    const current = this.currentEntityName;

    // Sort: primary first, then by modified order returned from backend
    const items = list.slice();
    sel.innerHTML = `
      <option value="" disabled selected>Select entity</option>
      ${items.map((r) => {
        const v = String(r?.name || '').trim();
        const lbl = _labelForEntityRow(r);
        const selected = current && v && v === current ? 'selected' : '';
        return `<option value="${escapeHtml(v)}" ${selected}>${escapeHtml(lbl)}</option>`;
      }).join('')}
    `;
  }

  async _handleContinue() {
    this._setError('');
    if (this._submitting) return;

    const p = this.project || {};
    const current = String(this.currentEntityName || '').trim();
    const next = String(this._root?.querySelector?.('#sbProjEntityNew')?.value || '').trim();
    if (!next) {
      this._setError('Please select an Entity');
      return;
    }
    if (next === current) {
      this._setError('No change (same Entity)');
      return;
    }

    const nextRow = (this.entities || []).find((x) => String(x?.name || '').trim() === next) || null;
    const nextLabel = nextRow ? _labelForEntityRow(nextRow) : next;

    const ok = await this._confirmSecondStep({ current, next, nextLabel });
    if (!ok) return;

    this._submitting = true;
    const btnCancel = this._modal?._overlay?.querySelector?.('#sbProjEntityCancel');
    const btnContinue = this._modal?._overlay?.querySelector?.('#sbProjEntityContinue');
    const prevContinueText = btnContinue?.textContent || '';
    if (btnCancel) btnCancel.disabled = true;
    if (btnContinue) {
      btnContinue.disabled = true;
      btnContinue.textContent = 'Saving…';
    }

    try {
      await this.onConfirm({ current, next, nextRow });
      this.close();
    } catch (e) {
      this._setError(e?.message || String(e) || 'Update failed');
      this._submitting = false;
      if (btnCancel) btnCancel.disabled = false;
      if (btnContinue) {
        btnContinue.disabled = false;
        btnContinue.textContent = prevContinueText || 'Continue';
      }
    }
  }

  async _confirmSecondStep({ current, next, nextLabel }) {
    return await new Promise((resolve) => {
      let settled = false;
      const done = (v) => {
        if (settled) return;
        settled = true;
        resolve(!!v);
      };

      const p = this.project || {};
      const content = document.createElement('div');
      content.innerHTML = `
        <div style="font-size:14px; line-height:1.5;">
          <div style="margin-bottom:10px;">Please confirm the change:</div>
          <div style="margin-bottom:6px;"><strong>Project:</strong> ${escapeHtml(p?.project_name || p?.name || '—')}</div>
          <div style="margin-bottom:6px;"><strong>From:</strong> ${escapeHtml(current || '—')}</div>
          <div style="margin-bottom:12px;"><strong>To:</strong> ${escapeHtml(nextLabel || next || '—')}</div>
          <div class="text-muted" style="font-size:12px;">This changes the Entity shown on this board.</div>
        </div>
      `;

      const footer = document.createElement('div');
      footer.style.display = 'flex';
      footer.style.justifyContent = 'flex-end';
      footer.style.gap = '10px';
      footer.innerHTML = `
        <button class="btn btn-default" type="button" id="sbProjEntityBack">Back</button>
        <button class="btn btn-primary" type="button" id="sbProjEntityConfirm">Confirm</button>
      `;

      const modal = new Modal({
        title: 'Confirm Entity Change',
        contentEl: content,
        footerEl: footer,
        onClose: () => done(false),
      });
      modal.open();

      footer.querySelector('#sbProjEntityBack')?.addEventListener('click', () => {
        done(false);
        modal.close();
      });
      footer.querySelector('#sbProjEntityConfirm')?.addEventListener('click', () => {
        done(true);
        modal.close();
      });
    });
  }
}


