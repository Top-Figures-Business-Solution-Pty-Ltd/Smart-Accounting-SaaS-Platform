/**
 * Filter columns builder
 * - Derives AdvancedFilterModal "Column" options from the current Saved View columns (Columns Manager selection).
 * - Keeps a small allowlist of field metadata for correct editors (link/select/date).
 * - Excludes non-filterable virtual/derived columns.
 */
import { ViewService } from '../services/viewService.js';
import { CompanyService } from '../services/companyService.js';
import { isDeprecatedProjectField, sanitizeProjectColumnsConfig } from './deprecatedColumns.js';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

function parseSavedViewColumns(raw) {
  if (!raw) return [];
  let v = raw;
  if (typeof v === 'string') {
    try { v = JSON.parse(v); } catch (e) { v = null; }
  }
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object') {
    // Support multiple historical schemas
    if (Array.isArray(v.project)) return v.project;
    if (Array.isArray(v.projectColumns)) return v.projectColumns;
  }
  return [];
}

function isFilterableField(field) {
  const f = String(field || '').trim();
  if (!f) return false;
  // Virtual/computed columns
  if (f.startsWith('__sb_')) return false;
  // Deprecated fields should never appear in Filters
  if (isDeprecatedProjectField(f)) return false;
  // Exclude fields that should never appear in Filters
  if (f === 'custom_engagement_letter') return false;
  if (f === 'notes') return false;
  // UX: "Last Updated" is not a practical filter in this product.
  if (f === 'modified') return false;
  return true;
}

function metaForField(field, { viewType, statusOptions, companyOptions }) {
  const f = String(field || '').trim();
  const base = { field: f, label: f, type: 'text' };

  // Derived team role columns: team:<Role>
  if (f.startsWith('team:')) {
    const role = f.slice('team:'.length).trim();
    return { ...base, label: role || f, type: 'user', placeholder: 'Search user...' };
  }

  // Known fields => proper editor type
  if (f === 'customer') return { ...base, label: 'Client Name', type: 'link', doctype: 'Customer', displayField: 'customer_name', placeholder: 'Search Client...' };
  if (f === 'project_name') return { ...base, label: 'Project Name', type: 'text' };
  if (f === 'project_type') return { ...base, label: 'Project Type', type: 'link', doctype: 'Project Type', placeholder: 'Search Project Type...' };
  if (f === 'status') return { ...base, label: 'Status', type: 'select', options: statusOptions || [] };
  if (f === 'company') {
    const opts = Array.isArray(companyOptions) ? companyOptions.filter(Boolean) : [];
    // Prefer select (prevents typos). If company list cannot be read, fall back to link search.
    if (opts.length) return { ...base, label: 'Company', type: 'select', options: opts };
    return { ...base, label: 'Company', type: 'link', doctype: 'Company', placeholder: 'Search Company...' };
  }
  if (f === 'custom_fiscal_year') return { ...base, label: 'Fiscal Year', type: 'link', doctype: 'Fiscal Year', placeholder: 'Search Fiscal Year...' };
  if (f === 'custom_target_month') return { ...base, label: 'Target Month', type: 'select', options: MONTHS };
  if (f === 'custom_lodgement_due_date') return { ...base, label: 'Lodgement Due', type: 'date' };
  if (f === 'expected_end_date') return { ...base, label: 'End Date', type: 'date' };

  // Default: treat as text
  return base;
}

/**
 * Build AdvancedFilterModal columns from current Saved View columns.
 * Fallback to a safe default list if anything goes wrong.
 */
export async function buildAdvancedFilterColumns({ viewType, statusOptions }) {
  let companyOptions = [];
  try {
    companyOptions = await CompanyService.fetchCompanies();
  } catch (e) {
    companyOptions = [];
  }

  const fallback = [
    metaForField('customer', { viewType, statusOptions, companyOptions }),
    metaForField('project_name', { viewType, statusOptions, companyOptions }),
    metaForField('status', { viewType, statusOptions, companyOptions }),
    metaForField('company', { viewType, statusOptions, companyOptions }),
    metaForField('custom_target_month', { viewType, statusOptions, companyOptions }),
    metaForField('custom_fiscal_year', { viewType, statusOptions, companyOptions }),
    metaForField('custom_lodgement_due_date', { viewType, statusOptions, companyOptions }),
    metaForField('expected_end_date', { viewType, statusOptions, companyOptions }),
  ];

  try {
    const view = await ViewService.getOrCreateDefaultView(viewType, {
      fallbackTitle: `${viewType} Board`,
      fallbackColumns: [],
    });
    const cols = sanitizeProjectColumnsConfig(parseSavedViewColumns(view?.columns));
    const seen = new Set();

    const out = [];

    for (const c of cols || []) {
      const f = String(c?.field || '').trim();
      if (!isFilterableField(f)) continue;
      if (seen.has(f)) continue;
      out.push({ ...metaForField(f, { viewType, statusOptions, companyOptions }), label: c?.label || undefined });
      seen.add(f);
    }

    return out.length ? out : fallback;
  } catch (e) {
    return fallback;
  }
}


