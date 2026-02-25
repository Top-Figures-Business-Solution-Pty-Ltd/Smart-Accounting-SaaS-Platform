/**
 * TeamRoleService
 * - Fetch role options for Project Team Member.role dynamically from backend meta
 * - Strong cache (memory + localStorage TTL)
 * - Website-safe, no Desk dependency
 */
import { ROLE_OPTIONS } from '../utils/constants.js';

const STORAGE_KEY = 'sb_team_roles_v2';
const TTL_MS = 24 * 60 * 60 * 1000; // 24h

export class TeamRoleService {
  static _roles = null;
  static _loading = null;

  static peekRoles() {
    if (Array.isArray(this._roles) && this._roles.length) return this._roles;
    // localStorage cache (best-effort)
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed?.expiresAt && Date.now() < parsed.expiresAt && Array.isArray(parsed.roles) && parsed.roles.length) {
        this._roles = parsed.roles;
        return this._roles;
      }
    } catch (e) {}
    return null;
  }

  static async getRoles() {
    const cached = this.peekRoles();
    if (cached && cached.length) return cached;
    if (this._loading) return this._loading;

    this._loading = (async () => {
      try {
        const r = await frappe.call({
          method: 'frappe.desk.form.load.getdoctype',
          type: 'GET',
          args: { doctype: 'Project Team Member' }
        });

        const docs = r?.docs || [];
        const meta = docs.find((d) => d?.name === 'Project Team Member') || docs[0];
        const fields = meta?.fields || [];
        const roleField = fields.find((f) => f?.fieldname === 'role') || null;
        const options = (roleField?.options || '').split('\n').map((s) => s.trim()).filter(Boolean);

        const roles = options.length ? options : (ROLE_OPTIONS || []);
        this._roles = roles;

        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ roles, expiresAt: Date.now() + TTL_MS }));
        } catch (e) {}

        return roles;
      } catch (e) {
        // Fail safe: fallback to default roles
        this._roles = ROLE_OPTIONS || [];
        return this._roles;
      } finally {
        this._loading = null;
      }
    })();

    return this._loading;
  }
}


