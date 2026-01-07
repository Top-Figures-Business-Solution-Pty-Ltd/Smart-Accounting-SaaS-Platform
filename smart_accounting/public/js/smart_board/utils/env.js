/**
 * Environment helpers
 * - Distinguish Desk (/app) vs Website (/smart) runtime.
 */

export function isDesk() {
  // Desk provides set_route/new_doc/msgprint/ui.Dialog, Website doesn't.
  return typeof window?.frappe?.set_route === 'function';
}

export function hasDialog() {
  return !!(window?.frappe?.ui?.Dialog);
}


