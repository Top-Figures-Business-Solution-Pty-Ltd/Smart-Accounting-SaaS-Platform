/**
 * ProfileService
 * - Data access for My Profile (website-safe)
 */
export class ProfileService {
  static async getMyProfile() {
    const r = await frappe.call({
      method: 'smart_accounting.api.profile.get_my_profile',
    });
    return r?.message || {};
  }

  static async setMyProfileImage(fileUrl) {
    const r = await frappe.call({
      method: 'smart_accounting.api.profile.set_my_profile_image',
      args: { file_url: String(fileUrl || '') }
    });
    return r?.message || {};
  }

  static async uploadUserImage(file) {
    if (!file) throw new Error('Missing file');
    const form = new FormData();
    form.append('file', file);
    form.append('is_private', '0');
    form.append('doctype', 'User');
    form.append('docname', String(frappe?.session?.user || ''));
    form.append('fieldname', 'user_image');

    const csrf = frappe?.csrf_token || '';
    const res = await fetch('/api/method/upload_file', {
      method: 'POST',
      headers: csrf ? { 'X-Frappe-CSRF-Token': csrf } : undefined,
      body: form
    });
    const data = await res.json();
    const msg = data?.message || {};
    return msg?.file_url || msg?.file_name || '';
  }
}

