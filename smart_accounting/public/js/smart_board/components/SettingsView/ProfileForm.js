/**
 * ProfileForm
 * - Display and update user profile avatar
 */
import { ProfileService } from '../../services/profileService.js';
import { getErrorMessage } from '../../utils/errorMessage.js';

export class ProfileForm {
  constructor(container) {
    this.container = container;
    this._profile = null;
    this._error = '';
    this._loading = false;
    this._input = null;
  }

  render() {
    this.container.innerHTML = `
      <div class="sb-profile">
        <div class="sb-profile__card">
          <div class="sb-profile__avatar" id="sbProfileAvatar">A</div>
          <div class="sb-profile__info">
            <div class="sb-profile__name" id="sbProfileName">My Profile</div>
            <div class="sb-profile__email" id="sbProfileEmail"></div>
            <div class="sb-profile__actions">
              <button class="btn btn-default" type="button" id="sbProfileUpload">Upload Photo</button>
              <button class="btn btn-light" type="button" id="sbProfileRemove">Remove</button>
              <input type="file" id="sbProfileFile" accept="image/*" style="display:none;" />
            </div>
            <div class="text-danger" id="sbProfileError" style="display:none;"></div>
          </div>
        </div>
      </div>
    `;
    this._input = this.container.querySelector('#sbProfileFile');
    this._bind();
    this._load();
  }

  _bind() {
    const btnUpload = this.container.querySelector('#sbProfileUpload');
    const btnRemove = this.container.querySelector('#sbProfileRemove');
    btnUpload?.addEventListener('click', () => this._input?.click?.());
    btnRemove?.addEventListener('click', () => this._remove());
    this._input?.addEventListener('change', (e) => this._upload(e));
  }

  async _load() {
    this._setError('');
    try {
      this._profile = await ProfileService.getMyProfile();
      this._renderProfile();
    } catch (e) {
      this._setError(getErrorMessage(e) || 'Failed to load profile');
    }
  }

  _renderProfile() {
    const name = String(this._profile?.full_name || this._profile?.name || '').trim();
    const email = String(this._profile?.email || '').trim();
    const img = String(this._profile?.user_image || '').trim();
    const avatarEl = this.container.querySelector('#sbProfileAvatar');
    const nameEl = this.container.querySelector('#sbProfileName');
    const emailEl = this.container.querySelector('#sbProfileEmail');
    if (nameEl) nameEl.textContent = name || 'My Profile';
    if (emailEl) emailEl.textContent = email || '';
    if (avatarEl) {
      if (img) {
        avatarEl.innerHTML = `<img src="${img}" alt="" />`;
        avatarEl.classList.add('sb-profile__avatar--img');
      } else {
        const initial = (name || email || 'U').charAt(0).toUpperCase();
        avatarEl.textContent = initial;
        avatarEl.classList.remove('sb-profile__avatar--img');
      }
    }

    // Sync topbar avatar (Smart Shell)
    try {
      const top = document.getElementById('userAvatar');
      if (top) {
        if (img) {
          top.innerHTML = `<img src="${img}" alt="" />`;
        } else {
          const initial = (name || email || 'U').charAt(0).toUpperCase();
          top.textContent = initial;
        }
      }
    } catch (e) {}
  }

  _setError(msg) {
    const el = this.container.querySelector('#sbProfileError');
    if (!el) return;
    const m = String(msg || '').trim();
    el.textContent = m;
    el.style.display = m ? 'block' : 'none';
  }

  async _upload(e) {
    const file = e?.target?.files?.[0] || null;
    if (!file) return;
    this._setError('');
    try {
      const url = await ProfileService.uploadUserImage(file);
      const profile = await ProfileService.setMyProfileImage(url);
      this._profile = profile || this._profile;
      this._renderProfile();
    } catch (err) {
      this._setError(getErrorMessage(err) || 'Upload failed');
    } finally {
      if (this._input) this._input.value = '';
    }
  }

  async _remove() {
    this._setError('');
    try {
      const profile = await ProfileService.setMyProfileImage('');
      this._profile = profile || this._profile;
      this._renderProfile();
    } catch (err) {
      this._setError(getErrorMessage(err) || 'Remove failed');
    }
  }

  destroy() {
    this.container.innerHTML = '';
    this._profile = null;
    this._input = null;
  }
}

