/**
 * ChangePasswordForm
 * - Old password + New password + Confirm
 * - Strength meter uses Frappe's test_password_strength endpoint (ERPNext rules).
 */
import { escapeHtml } from '../../utils/dom.js';
import { PasswordService } from '../../services/passwordService.js';
import { notify } from '../../services/uiAdapter.js';

function _scoreLabel(score) {
  const s = Number(score);
  if (!Number.isFinite(s)) return '';
  if (s <= 1) return 'Weak';
  if (s === 2) return 'Medium';
  return 'Strong';
}

function _barPct(score) {
  const s = Number(score);
  if (!Number.isFinite(s)) return 0;
  return Math.max(0, Math.min(100, (s / 4) * 100));
}

export class ChangePasswordForm {
  constructor(container) {
    this.container = container;
    this._timer = null;
    this._strength = {};
    this._onInput = null;
    this._onSubmit = null;
  }

  render() {
    this.container.innerHTML = `
      <div class="sb-cardlike">
        <div class="sb-cardlike__title">Change Password</div>

        <div class="sb-newproj__row">
          <label class="sb-newproj__label">Current Password</label>
          <input class="form-control" id="sbOldPassword" type="password" autocomplete="current-password" />
        </div>

        <div class="sb-newproj__row" style="margin-top:10px;">
          <label class="sb-newproj__label">New Password</label>
          <input class="form-control" id="sbNewPassword" type="password" autocomplete="new-password" />
        </div>

        <div id="sbPwdStrength" style="margin-top:8px; display:none;">
          <div class="text-muted" style="font-size:12px; margin-bottom:6px;">
            Strength: <span id="sbPwdStrengthLabel"></span>
          </div>
          <div style="height:8px; background:#eef1f4; border-radius:999px; overflow:hidden;">
            <div id="sbPwdStrengthBar" style="height:8px; width:0%; background: var(--smart-board-primary);"></div>
          </div>
          <div class="text-muted" id="sbPwdStrengthHint" style="font-size:12px; margin-top:6px;"></div>
        </div>

        <div class="sb-newproj__row" style="margin-top:10px;">
          <label class="sb-newproj__label">Confirm New Password</label>
          <input class="form-control" id="sbConfirmPassword" type="password" autocomplete="new-password" />
        </div>

        <div class="sb-newproj__error text-danger" id="sbPwdError" style="display:none; margin-top:10px;"></div>

        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:14px;">
          <button class="btn btn-primary" type="button" id="sbPwdSave">Save</button>
        </div>
      </div>
    `;

    this._bind();
  }

  _setError(msg) {
    const el = this.container.querySelector('#sbPwdError');
    if (!el) return;
    const m = String(msg || '').trim();
    el.textContent = m;
    el.style.display = m ? 'block' : 'none';
  }

  _renderStrength() {
    const wrap = this.container.querySelector('#sbPwdStrength');
    const label = this.container.querySelector('#sbPwdStrengthLabel');
    const bar = this.container.querySelector('#sbPwdStrengthBar');
    const hint = this.container.querySelector('#sbPwdStrengthHint');
    if (!wrap || !label || !bar || !hint) return;

    const score = this._strength?.score;
    const feedback = this._strength?.feedback || {};
    const enabled = this._strength && Object.keys(this._strength).length > 0;
    if (!enabled) {
      wrap.style.display = 'none';
      return;
    }

    wrap.style.display = 'block';
    label.textContent = _scoreLabel(score);
    bar.style.width = `${_barPct(score)}%`;

    const warnings = Array.isArray(feedback?.warning) ? feedback.warning : (feedback?.warning ? [feedback.warning] : []);
    const suggestions = Array.isArray(feedback?.suggestions) ? feedback.suggestions : [];
    const text = [...warnings, ...suggestions].filter(Boolean).join(' · ');
    hint.textContent = text ? String(text) : '';
  }

  _bind() {
    const newPwd = this.container.querySelector('#sbNewPassword');
    const btn = this.container.querySelector('#sbPwdSave');
    if (!newPwd || !btn) return;

    this._onInput = () => {
      clearTimeout(this._timer);
      this._timer = setTimeout(async () => {
        const v = String(newPwd.value || '');
        this._strength = await PasswordService.testStrength(v);
        this._renderStrength();
      }, 250);
    };
    newPwd.addEventListener('input', this._onInput);

    this._onSubmit = async () => {
      this._setError('');
      const oldPassword = String(this.container.querySelector('#sbOldPassword')?.value || '');
      const newPassword = String(this.container.querySelector('#sbNewPassword')?.value || '');
      const confirm = String(this.container.querySelector('#sbConfirmPassword')?.value || '');

      if (!oldPassword) return this._setError('Current Password is required');
      if (!newPassword) return this._setError('New Password is required');
      if (newPassword !== confirm) return this._setError('Confirm password does not match');

      btn.disabled = true;
      try {
        await PasswordService.updatePassword({ oldPassword, newPassword });
        notify('Password updated', 'green');
        // Clear fields
        this.container.querySelector('#sbOldPassword').value = '';
        this.container.querySelector('#sbNewPassword').value = '';
        this.container.querySelector('#sbConfirmPassword').value = '';
        this._strength = {};
        this._renderStrength();
      } catch (e) {
        this._setError(e?.message || String(e));
      } finally {
        btn.disabled = false;
      }
    };
    btn.addEventListener('click', this._onSubmit);
  }

  destroy() {
    try { clearTimeout(this._timer); } catch (e) {}
    this._timer = null;
    try {
      const newPwd = this.container.querySelector('#sbNewPassword');
      if (newPwd && this._onInput) newPwd.removeEventListener('input', this._onInput);
      const btn = this.container.querySelector('#sbPwdSave');
      if (btn && this._onSubmit) btn.removeEventListener('click', this._onSubmit);
    } catch (e) {}
    this._onInput = null;
    this._onSubmit = null;
    this.container.innerHTML = '';
  }
}


