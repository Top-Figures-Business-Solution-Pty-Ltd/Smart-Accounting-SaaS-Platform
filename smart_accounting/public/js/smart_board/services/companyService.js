/**
 * CompanyService
 * - Fetch Company list for website-safe selectors (filters, editors).
 * - Best-effort: returns [] on permission errors.
 */
const TTL_MS = 10 * 60 * 1000; // 10 minutes

let _cache = { expiresAt: 0, items: null };
let _loading = null;

function _now() { return Date.now(); }

export class CompanyService {
  static async fetchCompanies({ force = false } = {}) {
    if (!force && Array.isArray(_cache.items) && _now() < (_cache.expiresAt || 0)) return _cache.items;
    if (_loading) return _loading;

    _loading = (async () => {
      try {
        const r = await frappe.call({
          method: 'frappe.client.get_list',
          type: 'POST',
          args: {
            doctype: 'Company',
            fields: ['name'],
            order_by: 'name asc',
            limit_page_length: 200,
          },
        });
        const list = (r?.message || []).map((x) => x?.name).filter(Boolean);
        _cache = { items: list, expiresAt: _now() + TTL_MS };
        return list;
      } catch (e) {
        _cache = { items: [], expiresAt: _now() + TTL_MS };
        return [];
      } finally {
        _loading = null;
      }
    })();

    return _loading;
  }
}


