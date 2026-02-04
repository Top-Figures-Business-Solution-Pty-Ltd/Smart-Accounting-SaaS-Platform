/**
 * ProjectCommandService
 * - Write/command paths for Projects/Tasks used by Smart Board.
 * - No UI dependencies; errors bubble up to callers.
 */

import { ApiService } from './api.js';

export class ProjectCommandService {
  /**
   * 更新Project字段
   */
  static async updateProject(name, data) {
    return ApiService.updateDoc('Project', name, data);
  }

  /**
   * 更新Task
   */
  static async updateTask(name, data) {
    return ApiService.updateDoc('Task', name, data);
  }

  /**
   * 删除Project
   */
  static async deleteProject(name) {
    return ApiService.deleteDoc('Project', name);
  }

  /**
   * Bulk update a single field across many Projects (single request).
   */
  static async bulkSetProjectField(projects, field, value) {
    const names = Array.isArray(projects) ? projects : [];
    if (!names.length) return { updated: [] };
    const r = await frappe.call({
      method: 'smart_accounting.api.project_board.bulk_set_project_field',
      args: { projects: names, field, value },
    });
    return r?.message || { updated: [] };
  }

  static async createTask(project, data = {}) {
    const p = String(project || '').trim();
    if (!p) throw new Error('Missing project');
    const subject = data?.subject != null ? String(data.subject) : null;
    const r = await frappe.call({
      method: 'smart_accounting.api.project_board.create_task_for_project',
      args: { project: p, subject },
    });
    return r?.message?.task || r?.message;
  }

  static async setTaskTeamMembers(task, members = [], role = 'Assigned Person') {
    const t = String(task || '').trim();
    if (!t) throw new Error('Missing task');
    const list = Array.isArray(members) ? members : [];
    const r = await frappe.call({
      method: 'smart_accounting.api.project_board.set_task_team_members',
      args: { task: t, members: list, role },
    });
    return r?.message || {};
  }
}


