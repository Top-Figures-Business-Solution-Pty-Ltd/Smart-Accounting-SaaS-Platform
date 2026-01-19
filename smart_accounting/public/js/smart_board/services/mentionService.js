/**
 * MentionService
 * - Data access for @mention user picker
 */
export class MentionService {
  static async searchUsers(query, { limit = 8 } = {}) {
    const q = String(query || '').trim();
    const r = await frappe.call({
      method: 'smart_accounting.api.mentions.search_users',
      args: { query: q, limit: Math.max(1, Number(limit) || 8) }
    });
    return r?.message?.items || [];
  }
}


