/**
 * Column Registry
 * - Central place to define per-column rendering / editing / behaviors.
 * - Step 1: provide non-invasive skeleton. Callers can opt-in per field.
 *
 * Design notes:
 * - Spec lookup supports:
 *   1) exact field match (e.g. "status")
 *   2) prefix match via `fieldPrefix` (e.g. "team:" for derived columns)
 */
export class ColumnRegistry {
  constructor() {
    /** @type {Map<string, any>} */
    this._byField = new Map();
    /** @type {Array<{ fieldPrefix: string, spec: any }>} */
    this._byPrefix = [];
  }

  /**
   * Register a spec for an exact field name.
   * @param {string} field
   * @param {any} spec
   */
  register(field, spec) {
    if (!field) return;
    this._byField.set(String(field), spec || {});
  }

  /**
   * Register a spec for fields with a given prefix (e.g. "team:").
   * @param {string} fieldPrefix
   * @param {any} spec
   */
  registerPrefix(fieldPrefix, spec) {
    const prefix = String(fieldPrefix || '');
    if (!prefix) return;
    // latest wins
    this._byPrefix = this._byPrefix.filter((x) => x.fieldPrefix !== prefix);
    this._byPrefix.push({ fieldPrefix: prefix, spec: spec || {} });
  }

  /**
   * Resolve spec for a column field (exact match first, then prefix match).
   * @param {string} field
   */
  getSpec(field) {
    const f = String(field || '');
    if (!f) return null;
    if (this._byField.has(f)) return this._byField.get(f);

    for (let i = this._byPrefix.length - 1; i >= 0; i--) {
      const { fieldPrefix, spec } = this._byPrefix[i];
      if (f.startsWith(fieldPrefix)) return spec;
    }
    return null;
  }

  /**
   * Render cell inner HTML. Returning null/undefined means "no override".
   * @param {{ project: any, column: any, ctx?: any }} args
   * @returns {string|null}
   */
  renderCell(args) {
    const field = args?.column?.field;
    const spec = this.getSpec(field);
    const fn = spec?.renderCell;
    if (typeof fn !== 'function') return null;
    const out = fn(args);
    return (out === undefined || out === null) ? null : String(out);
  }

  /**
   * Additional class(es) for <td>. Returning falsy means no extra class.
   * @param {{ project: any, column: any, ctx?: any }} args
   * @returns {string}
   */
  getCellClass(args) {
    const field = args?.column?.field;
    const spec = this.getSpec(field);
    const fn = spec?.cellClass;
    if (typeof fn === 'function') return String(fn(args) || '').trim();
    if (typeof spec?.cellClass === 'string') return spec.cellClass.trim();
    return '';
  }

  /**
   * Additional class(es) for <th>. Returning falsy means no extra class.
   * @param {{ column: any, ctx?: any }} args
   * @returns {string}
   */
  getHeaderClass(args) {
    const field = args?.column?.field;
    const spec = this.getSpec(field);
    const fn = spec?.headerClass;
    if (typeof fn === 'function') return String(fn(args) || '').trim();
    if (typeof spec?.headerClass === 'string') return spec.headerClass.trim();
    return '';
  }
}

// Singleton for now (simple, website-safe)
export const columnRegistry = new ColumnRegistry();


