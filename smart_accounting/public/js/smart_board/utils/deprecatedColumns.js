/**
 * Deprecated columns / fields
 * Central place to remove legacy columns from Saved Views + queries safely.
 */

// Project fields that should never appear in Smart Board columns anymore.
export const DEPRECATED_PROJECT_FIELDS = new Set([
  // Replaced by Monthly Status system
  'percent_complete',
]);

export function isDeprecatedProjectField(field) {
  const f = String(field || '').trim();
  return !!f && DEPRECATED_PROJECT_FIELDS.has(f);
}

export function sanitizeProjectColumnsConfig(columnsConfig) {
  const cols = Array.isArray(columnsConfig) ? columnsConfig : [];
  return cols.filter((c) => !isDeprecatedProjectField(c?.field));
}


