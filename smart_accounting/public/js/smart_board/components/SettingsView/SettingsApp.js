/**
 * SettingsApp
 * - Currently only implements "My Settings" -> Change Password.
 */
import { ChangePasswordForm } from './ChangePasswordForm.js';

export class SettingsApp {
  constructor(container) {
    this.container = container;
    this._form = null;
    this._active = 'password';
    this._onNavClick = null;
  }

  init() {
    this.container.innerHTML = `
      <div class="sb-page">
        <div class="sb-settings">
          <div class="sb-settings__nav" id="sbSettingsNav">
            <button class="sb-settings__tab sb-settings__tab--active" type="button" data-key="password">Change Password</button>
            <button class="sb-settings__tab" type="button" data-key="prefs" disabled title="Coming soon">Personal Preferences</button>
            <button class="sb-settings__tab" type="button" data-key="notifs" disabled title="Coming soon">Notification Preferences</button>
          </div>
          <div class="sb-settings__content" id="sbSettingsContent"></div>
        </div>
      </div>
    `;

    this._mountActive();
    this._bind();
  }

  _bind() {
    const nav = this.container.querySelector('#sbSettingsNav');
    if (!nav) return;
    this._onNavClick = (e) => {
      const btn = e.target?.closest?.('button[data-key]');
      if (!btn) return;
      const key = String(btn.getAttribute('data-key') || '');
      if (!key || btn.disabled) return;
      this._active = key;
      this._renderNavActive();
      this._mountActive();
    };
    nav.addEventListener('click', this._onNavClick);
  }

  _renderNavActive() {
    const nav = this.container.querySelector('#sbSettingsNav');
    if (!nav) return;
    nav.querySelectorAll('button[data-key]').forEach((b) => {
      const k = String(b.getAttribute('data-key') || '');
      b.classList.toggle('sb-settings__tab--active', k === this._active);
    });
  }

  _mountActive() {
    const mount = this.container.querySelector('#sbSettingsContent');
    if (!mount) return;
    try { this._form?.destroy?.(); } catch (e) {}
    this._form = null;

    // Currently only password is implemented
    this._form = new ChangePasswordForm(mount);
    this._form.render();
  }

  destroy() {
    try { this._form?.destroy?.(); } catch (e) {}
    this._form = null;
    try {
      const nav = this.container.querySelector('#sbSettingsNav');
      if (nav && this._onNavClick) nav.removeEventListener('click', this._onNavClick);
    } catch (e) {}
    this._onNavClick = null;
    this.container.innerHTML = '';
  }
}


