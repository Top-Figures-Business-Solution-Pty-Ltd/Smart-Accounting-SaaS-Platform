/**
 * ProjectEntityService
 * - Read/write paths for Project <-> Customer Entity selection.
 * - No UI dependencies.
 */
export class ProjectEntityService {
  static async fetchEntitiesForProject(projectName) {
    const pn = String(projectName || '').trim();
    if (!pn) throw new Error('Missing project');
    const r = await frappe.call({
      method: 'smart_accounting.api.project_entity.get_project_customer_entities',
      args: { project: pn },
    });
    return r?.message || { customer: '', items: [] };
  }

  static async setProjectEntity(projectName, customerEntityName) {
    const pn = String(projectName || '').trim();
    const en = String(customerEntityName || '').trim();
    if (!pn) throw new Error('Missing project');
    if (!en) throw new Error('Missing entity');
    const r = await frappe.call({
      method: 'smart_accounting.api.project_entity.set_project_customer_entity',
      args: { project: pn, customer_entity: en },
    });
    return r?.message || {};
  }

  static async setProjectYearEnd(projectName, yearEnd) {
    const pn = String(projectName || '').trim();
    const ye = String(yearEnd || '').trim();
    if (!pn) throw new Error('Missing project');
    if (!ye) throw new Error('Missing year_end');
    const r = await frappe.call({
      method: 'smart_accounting.api.project_entity.set_project_year_end',
      args: { project: pn, year_end: ye },
    });
    return r?.message || {};
  }

  static async backfillMissingProjectEntities({ limit = 2000, dryRun = true, activeOnly = false } = {}) {
    const r = await frappe.call({
      method: 'smart_accounting.api.project_entity.backfill_project_customer_entities',
      args: {
        limit: Number(limit) || 2000,
        dry_run: dryRun ? 1 : 0,
        active_only: activeOnly ? 1 : 0,
      },
    });
    return r?.message || {};
  }
}


