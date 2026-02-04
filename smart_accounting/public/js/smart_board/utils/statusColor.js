/**
 * Status color helpers
 */

import { STATUS_COLORS } from './constants.js';

/**
 * 获取状态颜色
 */
export function getStatusColor(status) {
  return STATUS_COLORS[status] || '#6c757d';
}


