/**
 * Filter columns builder
 * - Derives AdvancedFilterModal "Column" options from the current Saved View columns (Columns Manager selection).
 * - Keeps a small allowlist of field metadata for correct editors (link/select/date).
 * - Excludes non-filterable virtual/derived columns.
 */
import { ViewService } from '../services/viewService.js';
import { CompanyService } from '../services/companyService.js';
import { DoctypeMetaService } from '../services/doctypeMetaService.js';
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

function metaForField(field, { viewType, statusOptions, companyOptions, projectMeta }) {
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
  if (f === 'custom_reset_date') return { ...base, label: 'Reset Date', type: 'date' };
  if (f === 'expected_end_date') return { ...base, label: 'End Date', type: 'date' };

  // Dynamic inference from Project meta: all Select fields should use select editor in filter.
  const df = Array.isArray(projectMeta?.fields)
    ? projectMeta.fields.find((x) => String(x?.fieldname || '').trim() === f)
    : null;
  const ft = String(df?.fieldtype || '').trim();
  if (ft === 'Select') {
    const opts = String(df?.options || '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    if (opts.length) return { ...base, label: String(df?.label || f), type: 'select', options: opts };
  }
  if (ft === 'Date' || ft === 'Datetime') return { ...base, label: String(df?.label || f), type: 'date' };
  if (ft === 'Link') return { ...base, label: String(df?.label || f), type: 'link', doctype: String(df?.options || ''), placeholder: `Search ${String(df?.label || f)}...` };

  // Default: text
  return base;
}

/**
 * Build AdvancedFilterModal columns from current Saved View columns.
 * Fallback to a safe default list if anything goes wrong.
 */
export async function buildAdvancedFilterColumns({ viewType, statusOptions }) {
  let companyOptions = [];
  let entityTypeOptions = [];
  let projectMeta = null;
  try {
    companyOptions = await CompanyService.fetchCompanies();
  } catch (e) {
    companyOptions = [];
  }
  try {
    entityTypeOptions = await DoctypeMetaService.getSelectOptions('Customer Entity', 'entity_type', { force: true });
  } catch (e) {
    entityTypeOptions = [];
  }
  try {
    projectMeta = await DoctypeMetaService.getMeta('Project', { force: true });
  } catch (e) {
    projectMeta = null;
  }

  const fallback = [
    metaForField('customer', { viewType, statusOptions, companyOptions, projectMeta }),
    metaForField('project_name', { viewType, statusOptions, companyOptions, projectMeta }),
    metaForField('status', { viewType, statusOptions, companyOptions, projectMeta }),
    metaForField('company', { viewType, statusOptions, companyOptions, projectMeta }),
    metaForField('custom_target_month', { viewType, statusOptions, companyOptions, projectMeta }),
    metaForField('custom_fiscal_year', { viewType, statusOptions, companyOptions, projectMeta }),
    metaForField('custom_year_end', { viewType, statusOptions, companyOptions, projectMeta }),
    metaForField('custom_ato_status', { viewType, statusOptions, companyOptions, projectMeta }),
    metaForField('custom_lodgeit_status', { viewType, statusOptions, companyOptions, projectMeta }),
    metaForField('custom_company_agent_status', { viewType, statusOptions, companyOptions, projectMeta }),
    metaForField('custom_xeroquickbooks_status', { viewType, statusOptions, companyOptions, projectMeta }),
    metaForField('custom_lodgement_due_date', { viewType, statusOptions, companyOptions, projectMeta }),
    metaForField('custom_reset_date', { viewType, statusOptions, companyOptions, projectMeta }),
    metaForField('expected_end_date', { viewType, statusOptions, companyOptions, projectMeta }),
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
      const byField = (() => {
        if (f === 'custom_entity_type') {
          const opts = Array.isArray(entityTypeOptions) ? entityTypeOptions.filter(Boolean) : [];
          return { field: f, label: 'Entity', type: opts.length ? 'select' : 'text', options: opts };
        }
        return metaForField(f, { viewType, statusOptions, companyOptions, projectMeta });
      })();
      out.push({ ...byField, label: c?.label || byField.label || undefined });
      seen.add(f);
    }

    return out.length ? out : fallback;
  } catch (e) {
    return fallback;
  }
}


