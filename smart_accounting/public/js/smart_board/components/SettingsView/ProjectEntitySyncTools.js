/**
 * ProjectEntitySyncTools (debug/test-only UI)
 * - Backfill Project.custom_customer_entity using Customer primary entity.
 *
 * Visibility is controlled by SettingsApp (admin + sb_debug flag).
 */
import { ProjectEntityService } from '../../services/projectEntityService.js';
import { confirmDialog, notify } from '../../services/uiAdapter.js';
import { getErrorMessage } from '../../utils/errorMessage.js';

function _safeNum(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export class ProjectEntitySyncTools {
  constructor(container) {
    this.container = container;
    this._onPreview = null;
    this._onRun = null;
    this._running = false;
  }

  render() {
    this.container.innerHTML = `
      <div class="sb-cardlike">
        <div class="sb-cardlike__title">Entity Sync (Test Tools)</div>
        <div class="text-muted" style="font-size:12px; margin-bottom:10px;">
          Backfill missing <code>Project.custom_customer_entity</code> using the Client’s primary <code>Customer Entity</code>.
          This is intended for test environments only.
        </div>

        <div style="display:flex; gap:12px; flex-wrap: wrap;">
          <div class="sb-newproj__row" style="min-width:180px;">
            <label class="sb-newproj__label">Limit</label>
            <input class="form-control" id="sbEntSyncLimit" type="number" min="1" max="20000" value="2000" />
          </div>
          <div class="sb-newproj__row" style="min-width:180px;">
            <label class="sb-newproj__label">Active only</label>
            <div><input id="sbEntSyncActiveOnly" type="checkbox" /></div>
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:14px;">
          <button class="btn btn-default" type="button" id="sbEntSyncPreview">Preview</button>
          <button class="btn btn-primary" type="button" id="sbEntSyncRun">Run backfill</button>
        </div>

        <div class="sb-newproj__error text-danger" id="sbEntSyncErr" style="display:none; margin-top:10px;"></div>

        <div style="margin-top:12px;">
          <div class="text-muted" style="font-size:12px; margin-bottom:6px;">Result</div>
          <pre id="sbEntSyncOut" style="max-height:280px; overflow:auto; background:#0b1020; color:#e2e8f0; padding:10px; border-radius:10px; font-size:12px;"></pre>
        </div>
      </div>
    `;

    this._bind();
  }

  _els() {
    return {
      limit: this.container.querySelector('#sbEntSyncLimit'),
      activeOnly: this.container.querySelector('#sbEntSyncActiveOnly'),
      btnPreview: this.container.querySelector('#sbEntSyncPreview'),
      btnRun: this.container.querySelector('#sbEntSyncRun'),
      err: this.container.querySelector('#sbEntSyncErr'),
      out: this.container.querySelector('#sbEntSyncOut'),
    };
  }

  _setError(msg) {
    const { err } = this._els();
    if (!err) return;
    const m = String(msg || '').trim();
    err.textContent = m;
    err.style.display = m ? 'block' : 'none';
  }

  _setOutput(obj) {
    const { out } = this._els();
    if (!out) return;
    try {
      out.textContent = JSON.stringify(obj || {}, null, 2);
    } catch (e) {
      out.textContent = String(obj || '');
    }
  }

  _setRunning(running) {
    this._running = !!running;
    const { btnPreview, btnRun } = this._els();
    if (btnPreview) btnPreview.disabled = !!running;
    if (btnRun) btnRun.disabled = !!running;
  }

  _readParams() {
    const { limit, activeOnly } = this._els();
    return {
      limit: _safeNum(limit?.value, 2000),
      activeOnly: !!activeOnly?.checked,
    };
  }

  async _preview() {
    if (this._running) return;
    this._setError('');
    this._setRunning(true);
    try {
      const { limit, activeOnly } = this._readParams();
      const res = await ProjectEntityService.backfillMissingProjectEntities({
        limit,
        dryRun: true,
        activeOnly,
      });
      this._setOutput(res);
      notify('Preview ready', 'gray');
    } catch (e) {
      this._setError(getErrorMessage(e) || String(e) || 'Preview failed');
    } finally {
      this._setRunning(false);
    }
  }

  async _run() {
    if (this._running) return;
    this._setError('');
    const ok = await confirmDialog('Run backfill now? This will update Projects in the database.');
    if (!ok) return;

    this._setRunning(true);
    try {
      const { limit, activeOnly } = this._readParams();
      const res = await ProjectEntityService.backfillMissingProjectEntities({
        limit,
        dryRun: false,
        activeOnly,
      });
      this._setOutput(res);
      notify('Backfill completed', 'green');
    } catch (e) {
      this._setError(getErrorMessage(e) || String(e) || 'Backfill failed');
    } finally {
      this._setRunning(false);
    }
  }

  _bind() {
    const { btnPreview, btnRun } = this._els();
    this._onPreview = () => this._preview();
    this._onRun = () => this._run();
    btnPreview?.addEventListener('click', this._onPreview);
    btnRun?.addEventListener('click', this._onRun);
  }

  destroy() {
    try {
      const { btnPreview, btnRun } = this._els();
      if (btnPreview && this._onPreview) btnPreview.removeEventListener('click', this._onPreview);
      if (btnRun && this._onRun) btnRun.removeEventListener('click', this._onRun);
    } catch (e) {}
    this._onPreview = null;
    this._onRun = null;
    this.container.innerHTML = '';
  }
}


