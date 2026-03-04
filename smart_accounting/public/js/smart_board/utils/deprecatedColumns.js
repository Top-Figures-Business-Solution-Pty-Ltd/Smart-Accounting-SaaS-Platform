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
  return cols
    .filter((c) => !isDeprecatedProjectField(c?.field))
    .map((c) => {
      const field = String(c?.field || '').trim();
      if (field === 'team:Reviewer') {
        return { ...c, field: 'team:Manager', label: c?.label || 'Manager' };
      }
      if (field === 'custom_xero_qb_status') {
        return { ...c, field: 'custom_xeroquickbooks_status', label: c?.label || 'Xero/QuickBooks Status' };
      }
      return c;
    });
}


