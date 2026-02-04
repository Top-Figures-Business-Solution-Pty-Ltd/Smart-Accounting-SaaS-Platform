/**
 * Legacy UI helpers (direct frappe.* calls)
 * NOTE: Prefer using services/uiAdapter.js for website/desk compatibility.
 */

/**
 * 显示通知
 */
export function showNotification(message, type = 'info') {
  frappe.show_alert({
    message: message,
    indicator: type, // 'info', 'green', 'red', 'yellow', 'blue'
  });
}

/**
 * 显示确认对话框
 */
export function showConfirmDialog(message, callback) {
  frappe.confirm(
    message,
    () => callback(true),
    () => callback(false)
  );
}


