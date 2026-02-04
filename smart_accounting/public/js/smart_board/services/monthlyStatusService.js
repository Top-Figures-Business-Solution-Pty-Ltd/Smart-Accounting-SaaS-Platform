/**
 * MonthlyStatusService
 * - Read/write Monthly Status bundle and updates (Task/Project).
 * - Kept separate to keep Project service boundaries clean.
 */

export class MonthlyStatusService {
  static async getMonthlyStatusBundle(
    projects,
    { includeTasks = true, includeMatrix = true, includeSummary = true, limitPerProject = 500, taskFields = [] } = {}
  ) {
    const names = Array.isArray(projects) ? projects : [];
    if (!names.length) return { start_month: null, tasks: {}, matrix: {}, summary: {}, fiscal_year: {} };
    try {
      const r = await frappe.call({
        method: 'smart_accounting.api.project_board.get_monthly_status_bundle',
        args: {
          projects: names,
          include_tasks: includeTasks ? 1 : 0,
          include_matrix: includeMatrix ? 1 : 0,
          include_summary: includeSummary ? 1 : 0,
          limit_per_project: limitPerProject,
          task_fields: Array.isArray(taskFields) ? taskFields : [],
        },
      });
      return r?.message || { start_month: null, tasks: {}, matrix: {}, summary: {}, fiscal_year: {} };
    } catch (e) {
      return { start_month: null, tasks: {}, matrix: {}, summary: {}, fiscal_year: {} };
    }
  }

  static async setMonthlyStatus({ referenceDoctype = 'Task', referenceName, fiscalYear, monthIndex, status } = {}) {
    if (!referenceName) throw new Error('Missing referenceName');
    if (!fiscalYear) throw new Error('Missing fiscalYear');
    if (!monthIndex) throw new Error('Missing monthIndex');
    if (!status) throw new Error('Missing status');
    const r = await frappe.call({
      method: 'smart_accounting.api.project_board.set_monthly_status',
      args: {
        reference_doctype: referenceDoctype,
        reference_name: referenceName,
        fiscal_year: fiscalYear,
        month_index: monthIndex,
        status,
      },
    });
    return r?.message || {};
  }
}


