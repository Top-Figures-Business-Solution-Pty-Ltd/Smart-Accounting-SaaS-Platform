/**
 * Environment helpers
 * - Distinguish Desk (/app) vs Website (/smart) runtime.
 */

export function isDesk() {
  // Desk provides set_route/new_doc/msgprint/ui.Dialog, Website doesn't.
  return typeof window?.frappe?.set_route === 'function';
}

export function hasDialog() {
  // Website may have a partial frappe.ui.Dialog that can't render fields.
  // Only treat it as available when core control builder exists.
  return !!(window?.frappe?.ui?.Dialog && window?.frappe?.ui?.form?.make_control);
}


