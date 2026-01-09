/**
 * RowModel (Step 8)
 * - A thin abstraction layer to keep BoardTable rendering decoupled from raw projects array.
 * - Today: flat rows (1 project -> 1 row).
 * - Future: group-by can insert group header rows / collapsed groups without rewriting BoardTable.
 */

export function buildRowModel(projects = [], { groupBy = null } = {}) {
  // groupBy is reserved for future use.
  const list = Array.isArray(projects) ? projects : [];

  return {
    groupBy,
    count() {
      return list.length;
    },
    getAt(index) {
      return list[index] || null;
    },
    slice(start, end) {
      return list.slice(start, end);
    },
    all() {
      return list;
    }
  };
}


