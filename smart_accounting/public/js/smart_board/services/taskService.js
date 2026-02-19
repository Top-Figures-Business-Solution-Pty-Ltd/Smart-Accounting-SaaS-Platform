/**
 * TaskService
 * - Task commands used by Smart Board (website-safe)
 */

import { Perf } from '../utils/perf.js';

export class TaskService {
  static async bulkSetTaskField(tasks = [], field, value) {
    const list = Array.isArray(tasks) ? tasks.map((x) => String(x || '').trim()).filter(Boolean) : [];
    const f = String(field || '').trim();
    if (!list.length) return { updated: [], failed: [] };
    if (!f) throw new Error('Missing task field');
    const r = await frappe.call({
      method: 'smart_accounting.api.project_board.bulk_set_task_field',
      type: 'POST',
      args: {
        tasks: list,
        field: f,
        value,
      },
    });
    return r?.message || { updated: [], failed: [] };
  }

  static async bulkCreateForProjects(projects = [], { subject = 'New Task' } = {}) {
    const list = Array.isArray(projects) ? projects.map((x) => String(x || '').trim()).filter(Boolean) : [];
    if (!list.length) return { created: [], failed: [] };
    const r = await frappe.call({
      method: 'smart_accounting.api.project_board.bulk_create_task_for_projects',
      type: 'POST',
      args: {
        projects: list,
        subject: String(subject || '').trim() || 'New Task',
      },
    });
    return r?.message || { created: [], failed: [] };
  }

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


