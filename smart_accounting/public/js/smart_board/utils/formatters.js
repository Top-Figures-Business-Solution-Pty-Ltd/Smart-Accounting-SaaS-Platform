/**
 * Formatters
 * - Date/currency formatting helpers (Smart Board runtime expects `frappe` global).
 */

/**
 * 格式化日期
 */
export function formatDate(date, format = 'YYYY-MM-DD') {
  // NOTE: format is kept for backward compatibility; currently unused.
  if (!date) return '';
  return frappe.datetime.str_to_user(date);
}

/**
 * 格式化货币
 */
export function formatCurrency(amount) {
  if (!amount) return '';
  return frappe.format(amount, { fieldtype: 'Currency' });
}


