/**
 * ProjectFrequencyChangeModal (Website-safe)
 * - UI-only: pick a new Project Frequency for a Project, with a double-confirm step.
 *
 * Notes:
 * - Changing frequency impacts Auto Repeat. Backend will sync/create/disable automatically.
 */
import { Modal } from '../Common/Modal.js';
import { escapeHtml } from '../../utils/dom.js';

export class ProjectFrequencyChangeModal {
  constructor({ project, frequencyOptions = [], onConfirm, onClose } = {}) {
    this.project = project || null; // { name, project_name?, custom_project_frequency? }
    this.frequencyOptions = Array.isArray(frequencyOptions) ? frequencyOptions : [];
    this.onConfirm = typeof onConfirm === 'function' ? onConfirm : (async () => {});
    this.onClose = typeof onClose === 'function' ? onClose : (() => {});

    this._modal = null;
    this._root = null;
    this._submitting = false;
  }

  async open() {
    this.close();

    const p = this.project || {};
    const current = String(p?.custom_project_frequency || '').trim();
    const title = 'Change Frequency';

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
            <label class="sb-newproj__label">Current Frequency</label>
            <input class="form-control" type="text" value="${escapeHtml(current || '—')}" disabled />
          </div>
          <div class="sb-newproj__row" style="min-width:220px; flex:1;">
            <label class="sb-newproj__label">New Frequency *</label>
            <select class="form-control" id="sbProjFreqNew">
              <option value="" disabled selected>Select frequency</option>
            </select>
          </div>
        </div>

        <div class="text-muted" style="font-size:12px; margin-top:10px;">
          Backend will automatically sync Auto Repeat (create/update/disable) for this project.
        </div>

        <div class="sb-newproj__error text-danger" id="sbProjFreqErr" style="display:none;"></div>
      </div>
    `;

    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.justifyContent = 'flex-end';
    footer.style.gap = '10px';
    footer.innerHTML = `
      <button class="btn btn-default" type="button" id="sbProjFreqCancel">Cancel</button>
      <button class="btn btn-primary" type="button" id="sbProjFreqContinue">Continue</button>
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

    footer.querySelector('#sbProjFreqCancel')?.addEventListener('click', () => this.close());
    footer.querySelector('#sbProjFreqContinue')?.addEventListener('click', () => this._handleContinue());
  }

  close() {
    this._modal?.close?.();
    this._modal = null;
    this._root = null;
  }

  _setError(msg) {
    const el = this._root?.querySelector?.('#sbProjFreqErr');
    if (!el) return;
    const m = String(msg || '').trim();
    el.textContent = m;
    el.style.display = m ? 'block' : 'none';
  }

  _renderOptions() {
    const sel = this._root?.querySelector?.('#sbProjFreqNew');
    if (!sel) return;
    const current = String(this.project?.custom_project_frequency || '').trim();

    const list = (this.frequencyOptions || []).map(String).map((s) => s.trim()).filter(Boolean);
    const uniq = [];
    const seen = new Set();
    for (const t of list) {
      if (seen.has(t)) continue;
      seen.add(t);
      uniq.push(t);
    }
    // Ensure current is present for clarity
    if (current && !seen.has(current)) uniq.unshift(current);

    sel.innerHTML = `
      <option value="" disabled selected>Select frequency</option>
      ${uniq.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('')}
    `;
  }

  _autoRepeatImpactText({ current, next }) {
    const cur = String(current || '').trim();
    const nxt = String(next || '').trim();
    if (!nxt) return '';
    if (nxt === 'One-off') return 'Auto Repeat will be disabled (if present).';
    if (!cur || cur === 'One-off') return 'Auto Repeat will be created or enabled automatically.';
    return 'Auto Repeat will be updated automatically.';
  }

  async _handleContinue() {
    this._setError('');
    if (this._submitting) return;

    const p = this.project || {};
    const current = String(p?.custom_project_frequency || '').trim();
    const next = String(this._root?.querySelector?.('#sbProjFreqNew')?.value || '').trim();

    if (!next) {
      this._setError('Please select a Frequency');
      return;
    }
    if (next === current) {
      this._setError('No change (same Frequency)');
      return;
    }

    const ok = await this._confirmSecondStep({ current, next });
    if (!ok) return;

    this._submitting = true;
    const btnCancel = this._modal?._overlay?.querySelector?.('#sbProjFreqCancel');
    const btnContinue = this._modal?._overlay?.querySelector?.('#sbProjFreqContinue');
    const prevContinueText = btnContinue?.textContent || '';
    if (btnCancel) btnCancel.disabled = true;
    if (btnContinue) {
      btnContinue.disabled = true;
      btnContinue.textContent = 'Saving…';
    }

    try {
      await this.onConfirm({ current, next });
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

  async _confirmSecondStep({ current, next }) {
    return await new Promise((resolve) => {
      let settled = false;
      const done = (v) => {
        if (settled) return;
        settled = true;
        resolve(!!v);
      };

      const p = this.project || {};
      const impact = this._autoRepeatImpactText({ current, next });
      const content = document.createElement('div');
      content.innerHTML = `
        <div style="font-size:14px; line-height:1.5;">
          <div style="margin-bottom:10px;">Please confirm the change:</div>
          <div style="margin-bottom:6px;"><strong>Project:</strong> ${escapeHtml(p?.project_name || p?.name || '—')}</div>
          <div style="margin-bottom:6px;"><strong>From:</strong> ${escapeHtml(current || '—')}</div>
          <div style="margin-bottom:10px;"><strong>To:</strong> ${escapeHtml(next || '—')}</div>
          <div class="text-muted" style="font-size:12px;">${escapeHtml(impact)}</div>
        </div>
      `;

      const footer = document.createElement('div');
      footer.style.display = 'flex';
      footer.style.justifyContent = 'flex-end';
      footer.style.gap = '10px';
      footer.innerHTML = `
        <button class="btn btn-default" type="button" id="sbProjFreqBack">Back</button>
        <button class="btn btn-primary" type="button" id="sbProjFreqConfirm">Confirm</button>
      `;

      const modal = new Modal({
        title: 'Confirm Frequency Change',
        contentEl: content,
        footerEl: footer,
        onClose: () => done(false),
      });
      modal.open();

      footer.querySelector('#sbProjFreqBack')?.addEventListener('click', () => {
        done(false);
        modal.close();
      });
      footer.querySelector('#sbProjFreqConfirm')?.addEventListener('click', () => {
        done(true);
        modal.close();
      });
    });
  }
}


