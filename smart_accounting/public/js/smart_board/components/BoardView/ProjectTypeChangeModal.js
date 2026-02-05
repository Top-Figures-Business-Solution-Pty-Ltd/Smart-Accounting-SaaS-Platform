/**
 * ProjectTypeChangeModal (Website-safe)
 * - UI-only: pick a new Project Type for a Project, with a double-confirm step.
 */
import { Modal } from '../Common/Modal.js';
import { escapeHtml } from '../../utils/dom.js';

export class ProjectTypeChangeModal {
  constructor({ project, projectTypes = [], onConfirm, onClose } = {}) {
    this.project = project || null; // { name, project_name?, project_type? }
    this.projectTypes = Array.isArray(projectTypes) ? projectTypes : [];
    this.onConfirm = typeof onConfirm === 'function' ? onConfirm : (async () => {});
    this.onClose = typeof onClose === 'function' ? onClose : (() => {});

    this._modal = null;
    this._root = null;
    this._submitting = false;
  }

  async open() {
    this.close();

    const p = this.project || {};
    const current = String(p?.project_type || '').trim();
    const title = 'Change Project Type';
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
            <label class="sb-newproj__label">Current Project Type</label>
            <input class="form-control" type="text" value="${escapeHtml(current || '—')}" disabled />
          </div>
          <div class="sb-newproj__row" style="min-width:220px; flex:1;">
            <label class="sb-newproj__label">New Project Type *</label>
            <select class="form-control" id="sbProjTypeNew">
              <option value="" disabled selected>Select project type</option>
            </select>
          </div>
        </div>

        <div class="sb-newproj__error text-danger" id="sbProjTypeErr" style="display:none;"></div>
      </div>
    `;

    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.justifyContent = 'flex-end';
    footer.style.gap = '10px';
    footer.innerHTML = `
      <button class="btn btn-default" type="button" id="sbProjTypeCancel">Cancel</button>
      <button class="btn btn-primary" type="button" id="sbProjTypeContinue">Continue</button>
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

    footer.querySelector('#sbProjTypeCancel')?.addEventListener('click', () => this.close());
    footer.querySelector('#sbProjTypeContinue')?.addEventListener('click', () => this._handleContinue());
  }

  close() {
    this._modal?.close?.();
    this._modal = null;
    this._root = null;
  }

  _setError(msg) {
    const el = this._root?.querySelector?.('#sbProjTypeErr');
    if (!el) return;
    const m = String(msg || '').trim();
    el.textContent = m;
    el.style.display = m ? 'block' : 'none';
  }

  _renderOptions() {
    const sel = this._root?.querySelector?.('#sbProjTypeNew');
    if (!sel) return;
    const current = String(this.project?.project_type || '').trim();
    const list = (this.projectTypes || []).map(String).map((s) => s.trim()).filter(Boolean);
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
      <option value="" disabled selected>Select project type</option>
      ${uniq.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('')}
    `;
  }

  async _handleContinue() {
    this._setError('');
    if (this._submitting) return;
    const p = this.project || {};
    const current = String(p?.project_type || '').trim();
    const next = String(this._root?.querySelector?.('#sbProjTypeNew')?.value || '').trim();
    if (!next) {
      this._setError('Please select a Project Type');
      return;
    }
    if (next === current) {
      this._setError('No change (same Project Type)');
      return;
    }

    // Double-check modal (prevents misclicks)
    const ok = await this._confirmSecondStep({ current, next });
    if (!ok) return;

    // UX: show progress so user doesn't feel the confirm button "did nothing".
    this._submitting = true;
    const btnCancel = this._modal?._overlay?.querySelector?.('#sbProjTypeCancel');
    const btnContinue = this._modal?._overlay?.querySelector?.('#sbProjTypeContinue');
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
      // Fail-safe: keep modal open and show an inline error.
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
      const content = document.createElement('div');
      content.innerHTML = `
        <div style="font-size:14px; line-height:1.5;">
          <div style="margin-bottom:10px;">Please confirm the change:</div>
          <div style="margin-bottom:6px;"><strong>Project:</strong> ${escapeHtml(p?.project_name || p?.name || '—')}</div>
          <div style="margin-bottom:6px;"><strong>From:</strong> ${escapeHtml(current || '—')}</div>
          <div style="margin-bottom:12px;"><strong>To:</strong> ${escapeHtml(next || '—')}</div>
          <div class="text-muted" style="font-size:12px;">This will move the project to a different board.</div>
        </div>
      `;

      const footer = document.createElement('div');
      footer.style.display = 'flex';
      footer.style.justifyContent = 'flex-end';
      footer.style.gap = '10px';
      footer.innerHTML = `
        <button class="btn btn-default" type="button" id="sbProjTypeBack">Back</button>
        <button class="btn btn-primary" type="button" id="sbProjTypeConfirm">Confirm</button>
      `;

      const modal = new Modal({
        title: 'Confirm Project Type Change',
        contentEl: content,
        footerEl: footer,
        // If user closes via ESC / clicking overlay / X, treat as cancelled.
        onClose: () => done(false),
      });
      modal.open();

      footer.querySelector('#sbProjTypeBack')?.addEventListener('click', () => {
        done(false);
        modal.close();
      });
      footer.querySelector('#sbProjTypeConfirm')?.addEventListener('click', () => {
        done(true);
        modal.close();
      });
    });
  }
}


