/**
 * Permission helpers (Frappe runtime)
 */

/**
 * 检查权限
 * NOTE: kept behavior for backward compatibility (perm_type not used yet).
 */
export function hasPermission(doctype, perm_type = 'read') {
  return frappe.model.can_read(doctype);
}


