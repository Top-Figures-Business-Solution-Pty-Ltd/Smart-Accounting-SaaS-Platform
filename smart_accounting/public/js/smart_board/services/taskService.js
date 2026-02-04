/**
 * TaskService
 * - Task commands used by Smart Board (website-safe)
 */

import { Perf } from '../utils/perf.js';

export class TaskService {
  /**
   * Delete tasks (optionally cascade to subtasks) in a single backend call.
   * Returns: { deleted: string[], failed: {name,error}[], ... }
   */
  static async deleteTasks(tasks = [], { cascadeSubtasks = true } = {}) {
    const list = Array.isArray(tasks) ? tasks.map((x) => String(x || '').trim()).filter(Boolean) : [];
    if (!list.length) return { deleted: [], failed: [], requested: [] };

    return await Perf.timeAsync(
      'tasks.delete',
      async () => {
        const r = await frappe.call({
          method: 'smart_accounting.api.project_board.delete_tasks',
          type: 'POST',
          args: {
            tasks: list,
            cascade_subtasks: cascadeSubtasks ? 1 : 0,
          },
        });
        return r?.message || {};
      },
      () => ({ count: list.length, cascade: cascadeSubtasks ? 1 : 0 })
    );
  }
}


