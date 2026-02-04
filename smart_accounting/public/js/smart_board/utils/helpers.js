/**
 * Smart Board - Helpers (compat layer)
 * - 本文件仅作为历史兼容层（re-export）。
 * - 新代码请按域直接从对应 utils 模块导入（例如 storage/rateLimit/formatters）。
 */

export { formatDate, formatCurrency } from './formatters.js';
export { getStatusColor } from './statusColor.js';
export { getFromStorage, saveToStorage } from './storage.js';
export { debounce, throttle } from './rateLimit.js';
export { formatTeamMembers, groupTeamByRole } from './team.js';
export { deepClone, generateId, isEqual, getFieldValue, buildFilters } from './data.js';
export { hasPermission } from './permissions.js';
export { showNotification, showConfirmDialog } from './legacyFrappeUi.js';

