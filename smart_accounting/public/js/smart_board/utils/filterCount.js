/**
 * Filter Count Utility
 * Counts the number of active (non-empty) filters from the store's filter state.
 * Used to display a badge on the Filter button.
 */

/**
 * Count active filters from the filter state.
 * @param {Object} filterState - The filters module state from the store
 * @returns {number} Number of active filter conditions
 */
export function countActiveFilters(filterState) {
  if (!filterState) return 0;

  let count = 0;

  // --- Advanced groups (Monday-like rules) ---
  const groups = filterState.advanced_groups;
  if (Array.isArray(groups)) {
    for (const g of groups) {
      const rules = g?.rules;
      if (!Array.isArray(rules)) continue;
      for (const r of rules) {
        if (!r) continue;
        const field = String(r.field || '').trim();
        const condition = String(r.condition || '').trim();
        if (!field || !condition) continue;
        // is_empty / is_not_empty don't require a value
        const noValue = ['is_empty', 'is_not_empty'].includes(condition);
        if (noValue) {
          count++;
        } else {
          const val = r.value;
          if (val != null && String(val).trim().length > 0) {
            count++;
          }
        }
      }
    }
  }

  // --- Legacy simple filters (may coexist with advanced) ---
  if (Array.isArray(filterState.status) && filterState.status.length > 0) count++;
  if (filterState.company && String(filterState.company).trim()) count++;
  if (filterState.customer && String(filterState.customer).trim()) count++;
  if (filterState.fiscal_year && String(filterState.fiscal_year).trim()) count++;
  // date_from / date_to count as one filter group
  const hasDateFrom = filterState.date_from && String(filterState.date_from).trim();
  const hasDateTo = filterState.date_to && String(filterState.date_to).trim();
  if (hasDateFrom || hasDateTo) count++;

  return count;
}

