/**
 * ActivityLogService
 * - Data access for Activity Log (Projects/Clients).
 */
import { Perf } from '../utils/perf.js';

export class ActivityLogService {
  static async fetchActivityLog({
    limitStart = 0,
    limit = 50,
    user = '',
    target = '',
    activity = '',
    password = '',
  } = {}) {
    return await Perf.timeAsync('activity.get_activity_log', async () => {
      const r = await frappe.call({
        method: 'smart_accounting.api.activity_log.get_activity_log',
        args: {
          limit_start: Math.max(0, Number(limitStart) || 0),
          limit_page_length: Math.max(1, Number(limit) || 50),
          user: String(user || ''),
          target: String(target || ''),
          activity: String(activity || ''),
          password: String(password || ''),
        }
      });
      return r?.message || { items: [], meta: {} };
    }, () => ({ limitStart, limit, user, target, activity }));
  }

  static async fetchUsers() {
    return await Perf.timeAsync('activity.get_users', async () => {
      const r = await frappe.call({
        method: 'smart_accounting.api.activity_log.get_activity_users',
        args: {}
      });
      return r?.message?.items || [];
    }, () => ({}));
  }
}


