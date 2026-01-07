/**
 * UI Adapter
 * - One place to show alerts/notifications/confirm/dialog across Desk and Website.
 */

import { isDesk, hasDialog } from '../utils/env.js';

export function notify(message, indicator = 'blue') {
  if (isDesk() && typeof frappe?.show_alert === 'function') {
    frappe.show_alert({ message, indicator });
    return;
  }
  // Website fallback
  alert(message);
}

export function confirmDialog(message) {
  return new Promise((resolve) => {
    if (isDesk() && typeof frappe?.confirm === 'function') {
      frappe.confirm(message, () => resolve(true), () => resolve(false));
      return;
    }
    resolve(window.confirm(message));
  });
}

export function msgprint(message) {
  if (isDesk() && typeof frappe?.msgprint === 'function') {
    frappe.msgprint(message);
    return;
  }
  alert(message);
}

export function openDialog(DialogClassArgs) {
  if (!hasDialog()) {
    msgprint('This dialog is not available in this view yet.');
    return null;
  }
  const d = new frappe.ui.Dialog(DialogClassArgs);
  d.show();
  return d;
}


