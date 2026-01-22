/**
 * PasswordService (website-safe)
 * - Uses Frappe built-in password endpoints (same rules as ERPNext).
 */
import { notify } from './uiAdapter.js';

function _extractServerMessage(err) {
  try {
    const raw = err?._server_messages;
    if (raw) {
      const arr = JSON.parse(raw);
      const first = Array.isArray(arr) ? arr[0] : null;
      const decoded = first ? JSON.parse(first) : null;
      if (decoded?.message) return String(decoded.message);
    }
  } catch (e) {}
  return String(err?.message || err?.exc || err?.exception || err || '').trim();
}

export class PasswordService {
  static async testStrength(newPassword) {
    const pwd = String(newPassword || '');
    try {
      const r = await frappe.call({
        method: 'frappe.core.doctype.user.user.test_password_strength',
        type: 'POST',
        args: { new_password: pwd },
      });
      return r?.message || {};
    } catch (e) {
      // Strength test is best-effort; don't block UI.
      return {};
    }
  }

  static async updatePassword({ oldPassword, newPassword } = {}) {
    const old_password = String(oldPassword || '');
    const new_password = String(newPassword || '');
    try {
      const r = await frappe.call({
        method: 'frappe.core.doctype.user.user.update_password',
        type: 'POST',
        args: {
          old_password,
          new_password,
          logout_all_sessions: 0,
          key: null,
        },
      });
      return r?.message || null;
    } catch (e) {
      const msg = _extractServerMessage(e) || 'Failed to update password';
      notify(msg, 'red');
      throw new Error(msg);
    }
  }
}


