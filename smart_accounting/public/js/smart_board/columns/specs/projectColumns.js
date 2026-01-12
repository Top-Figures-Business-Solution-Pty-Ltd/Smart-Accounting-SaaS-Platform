/**
 * Project column specs (Step 5)
 * - Focus: editable flags + editor selection + special hooks (e.g. confirm).
 * - Rendering override is optional; by default we keep existing BoardCell.formatValue output.
 */
import { STATUS_OPTIONS, STATUS_COLORS } from '../../utils/constants.js';
import { InlineTextEditor, InlineTextareaEditor, InlineSelectEditor, InlineMenuSelectEditor, InlineDateEditor, InlineMoneyEditor } from '../../components/Common/editors/index.js';
import { LinkInput } from '../../components/Common/LinkInput.js';
import { MultiLinkPicker } from '../../components/Common/MultiLinkPicker.js';
import { uploadAttachmentToField } from '../../services/fileUploadService.js';
import { confirmDialog } from '../../services/uiAdapter.js';
import { escapeHtml } from '../../utils/dom.js';

function monthOptions() {
  return [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
}

function priorityOptions() {
  // Keep minimal for now; can be sourced from Doctype meta later.
  return ['Low', 'Medium', 'High', 'Urgent'];
}

function statusOptionsForProject(project) {
  const t = project?.project_type || 'DEFAULT';
  const base = STATUS_OPTIONS[t] || STATUS_OPTIONS.DEFAULT || [];
  // Compatibility: if current value isn't in options (e.g. ERPNext default "Open"),
  // include it to avoid rendering an empty editor and accidental blank commit.
  const cur = (project?.status || '').trim();
  if (cur && !base.includes(cur)) return [cur].concat(base);
  return base;
}

function mountEditorHelpers(manager, mountEl, editorInstance) {
  // Manager can bind Enter/blur/Esc based on inputEl.
  const inputEl = editorInstance?.getInputEl?.() || mountEl?.querySelector?.('.sb-inline-editor') || null;
  manager?.bindActiveEditor?.(inputEl, editorInstance);
  // Focus after mount
  setTimeout(() => {
    try { editorInstance?.focus?.({ select: true }); } catch (e) {}
  }, 0);
}

function linkEditor({ cellEl, project, field, manager, doctype, placeholder }) {
  const contentEl = cellEl.querySelector('.cell-content') || cellEl;
  contentEl.innerHTML = `<div class="sb-inline-editor sb-inline-editor--link"></div>`;
  const mountEl = contentEl.querySelector('.sb-inline-editor--link');
  if (!mountEl) return;

  const li = new LinkInput(mountEl, {
    doctype,
    placeholder: placeholder || 'Search...',
    initialValue: project?.[field] || null,
    onChange: () => {
      // On selection, commit immediately (still respects blur/outside click).
      manager?.commitAndClose?.('link-change');
    }
  });

  // Let manager bind lifecycle based on underlying input.
  manager?.bindActiveEditor?.(mountEl.querySelector('.sb-linkinput__input'), li);

  setTimeout(() => {
    try { mountEl.querySelector('.sb-linkinput__input')?.focus?.(); } catch (e) {}
  }, 0);
}

function multiLinkEditor({ cellEl, project, manager, doctype, placeholder, initialValues, defaultList, resolveMeta }) {
  const contentEl = cellEl.querySelector('.cell-content') || cellEl;
  contentEl.innerHTML = `<div class="sb-inline-editor sb-inline-editor--link"></div>`;
  const mountEl = contentEl.querySelector('.sb-inline-editor--link');
  if (!mountEl) return;

  const picker = new MultiLinkPicker(mountEl, {
    doctype,
    placeholder: placeholder || 'Search...',
    initialValues: Array.isArray(initialValues) ? initialValues : [],
    defaultList: defaultList || null,
    resolveMeta: resolveMeta || null,
    onChange: () => {
      // Do NOT auto-commit; user can pick multiple then click outside to save.
    }
  });

  // Bind manager lifecycle to the input element so Enter/blur/Esc works.
  manager?.bindActiveEditor?.(picker.getInputEl(), picker);

  setTimeout(() => {
    try { picker.focus?.(); } catch (e) {}
  }, 0);

  return picker;
}

async function defaultSoftwareList() {
  try {
    const r = await frappe.call({
      method: 'frappe.client.get_list',
      args: {
        doctype: 'Software',
        fields: ['name'],
        filters: { is_active: 1 },
        order_by: 'modified desc',
        limit_page_length: 20
      }
    });
    return (r?.message || []).map((x) => x?.name).filter(Boolean);
  } catch (e) {
    return [];
  }
}

async function defaultUserList() {
  try {
    const r = await frappe.call({
      method: 'frappe.client.get_list',
      args: {
        doctype: 'User',
        fields: ['name'],
        filters: { enabled: 1 },
        order_by: 'modified desc',
        limit_page_length: 20
      }
    });
    return (r?.message || []).map((x) => x?.name).filter(Boolean);
  } catch (e) {
    return [];
  }
}

async function resolveUserMeta(values) {
  try {
    const arr = Array.isArray(values) ? values.filter(Boolean) : [];
    if (!arr.length) return {};
    // Use website-safe backend API; if user meta isn't permitted, backend will return fallbacks.
    const r = await frappe.call({
      method: 'smart_accounting.api.project_board.get_user_meta',
      args: { users: arr }
    });
    return r?.message || {};
  } catch (e) {
    return {};
  }
}

function normalizeSoftwareInitial(project) {
  const rows = project?.custom_softwares;
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => (typeof r === 'string' ? r : (r?.software_name || r?.software || '')))
    .map((s) => String(s || '').trim())
    .filter(Boolean);
}

function normalizeTeamInitial(project, role) {
  const rows = project?.custom_team_members;
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((m) => String(m?.role || '').trim() === String(role || '').trim())
    .map((m) => String(m?.user || '').trim())
    .filter(Boolean);
}

function attachmentEditor({ cellEl, project, manager, field, label = 'Upload' }) {
  const contentEl = cellEl.querySelector('.cell-content') || cellEl;
  const current = project?.[field] || '';
  const safeUrl = current ? escapeHtml(String(current)) : '';

  contentEl.innerHTML = `
    <div class="sb-attach">
      ${safeUrl ? `<a class="sb-attach__link" href="${safeUrl}" target="_blank" rel="noopener noreferrer">📎 View</a>` : `<span class="text-muted">—</span>`}
      <button type="button" class="btn btn-sm btn-light sb-attach__btn">${escapeHtml(label)}</button>
      <input type="file" class="sb-attach__file" style="display:none;" />
      <span class="sb-attach__hint text-muted" style="display:none;">Uploading...</span>
    </div>
  `;

  const btn = contentEl.querySelector('.sb-attach__btn');
  const fileInput = contentEl.querySelector('.sb-attach__file');
  const hint = contentEl.querySelector('.sb-attach__hint');

  const editor = {
    _value: current || '',
    getValue() { return this._value || ''; },
    getInputEl() { return btn; }, // allow manager to bind outside/esc semantics
    focus() { try { btn?.focus?.(); } catch (e) {} },
    destroy() {}
  };

  // Prevent outside-click commit when interacting with file dialog
  btn?.addEventListener('mousedown', (e) => { e.preventDefault(); }, true);
  btn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    try { fileInput?.click?.(); } catch (e2) {}
  });

  fileInput?.addEventListener('change', async () => {
    const f = fileInput.files?.[0] || null;
    if (!f) return;
    try {
      if (hint) hint.style.display = 'inline';
      // Upload + attach using Frappe builtin
      const msg = await uploadAttachmentToField({
        doctype: 'Project',
        docname: project?.name,
        fieldname: field,
        file: f,
        is_private: 1
      });
      // Prefer file_url; if missing, keep current.
      const url = msg?.file_url || msg?.file_url_full || msg?.file_url_full_path || msg?.file_url_path || '';
      editor._value = url || editor._value || '';
      // Commit immediately once upload finishes (avoid relying on blur)
      manager?.commitAndClose?.('upload-file');
    } catch (err) {
      console.error(err);
      // keep editor open; user can retry
    } finally {
      if (hint) hint.style.display = 'none';
    }
  });

  manager?.bindActiveEditor?.(btn, editor);
  return editor;
}

export function makeProjectColumnSpecs() {
  return [
    // (1) Client Name - read-only for now, but keep interface (spec exists).
    {
      field: 'customer',
      isEditable: false,
      cellClass: 'sb-primary-col',
      renderCell: ({ project }) => {
        const text = escapeHtml(project?.customer || '—');
        const pn = escapeHtml(project?.name || '');
        return `
          <span class="sb-primary-text">${text}</span>
          <button type="button" class="sb-update-btn" data-project-name="${pn}" aria-label="Open updates" title="Updates">
            💬
          </button>
        `;
      }
    },

    // (2) Project Name - editable text
    {
      field: 'project_name',
      isEditable: true,
      renderEditor: ({ cellEl, project, manager, field }) => {
        const contentEl = cellEl.querySelector('.cell-content') || cellEl;
        const ed = new InlineTextEditor(contentEl, { initialValue: project?.[field] || '' });
        mountEditorHelpers(manager, contentEl, ed);
        return ed;
      }
    },

    // (3) Status - single select
    {
      field: 'status',
      isEditable: true,
      renderCell: ({ project }) => {
        const v = project?.status;
        if (!v) return '<span class="text-muted">—</span><span class="sb-afford sb-afford--select">▾</span>';
        const color = STATUS_COLORS[v] || '#6c757d';
        return `
          <span class="status-badge" style="background-color:${escapeHtml(color)};">${escapeHtml(v)}</span>
          <span class="sb-afford sb-afford--select">▾</span>
        `;
      },
      renderEditor: ({ cellEl, project, manager, field }) => {
        const contentEl = cellEl.querySelector('.cell-content') || cellEl;
        const opts = statusOptionsForProject(project).map((s) => ({
          value: s,
          label: s,
          color: STATUS_COLORS[s] || ''
        }));
        const ed = new InlineMenuSelectEditor(contentEl, {
          options: opts,
          initialValue: project?.[field] || ''
        });
        // When user selects, commit immediately (still consistent with click-elsewhere save)
        contentEl.addEventListener('sb:menu-select', (e) => {
          e.stopPropagation?.();
          manager?.commitAndClose?.('menu-select');
        }, { once: true });
        mountEditorHelpers(manager, contentEl, ed);
        return ed;
      }
    },

    // (4) End Date - date
    {
      field: 'expected_end_date',
      isEditable: true,
      renderEditor: ({ cellEl, project, manager, field }) => {
        const contentEl = cellEl.querySelector('.cell-content') || cellEl;
        const ed = new InlineDateEditor(contentEl, { initialValue: project?.[field] || '' });
        mountEditorHelpers(manager, contentEl, ed);
        return ed;
      }
    },

    // (14) Start Date - date
    {
      field: 'expected_start_date',
      isEditable: true,
      renderEditor: ({ cellEl, project, manager, field }) => {
        const contentEl = cellEl.querySelector('.cell-content') || cellEl;
        const ed = new InlineDateEditor(contentEl, { initialValue: project?.[field] || '' });
        mountEditorHelpers(manager, contentEl, ed);
        return ed;
      }
    },

    // (5) Notes - textarea expand
    {
      field: 'notes',
      isEditable: true,
      cellClass: 'sb-col-notes',
      renderEditor: ({ cellEl, project, manager, field }) => {
        const contentEl = cellEl.querySelector('.cell-content') || cellEl;
        const ed = new InlineTextareaEditor(contentEl, { initialValue: project?.[field] || '' });
        mountEditorHelpers(manager, contentEl, ed);
        return ed;
      }
    },

    // (7) Company - editable (Link to Company). Editor uses existing LinkInput.
    {
      field: 'company',
      isEditable: true,
      renderEditor: ({ cellEl, project, manager, field }) => linkEditor({
        cellEl,
        project,
        field,
        manager,
        doctype: 'Company',
        placeholder: 'Search Company...'
      })
    },

    // (8) Lodgement Due - date + confirm on save
    {
      field: 'custom_lodgement_due_date',
      isEditable: true,
      async confirmCommit({ project, value }) {
        const oldV = project?.custom_lodgement_due_date || '';
        if ((oldV || '') === (value || '')) return true;
        return await confirmDialog('Confirm update Lodgement Due Date?');
      },
      renderEditor: ({ cellEl, project, manager, field }) => {
        const contentEl = cellEl.querySelector('.cell-content') || cellEl;
        const ed = new InlineDateEditor(contentEl, { initialValue: project?.[field] || '' });
        mountEditorHelpers(manager, contentEl, ed);
        return ed;
      }
    },

    // (9) Target Month - select
    {
      field: 'custom_target_month',
      isEditable: true,
      renderEditor: ({ cellEl, project, manager, field }) => {
        const contentEl = cellEl.querySelector('.cell-content') || cellEl;
        const ed = new InlineSelectEditor(contentEl, {
          options: monthOptions(),
          initialValue: project?.[field] || ''
        });
        mountEditorHelpers(manager, contentEl, ed);
        return ed;
      }
    },

    // (13) Priority - select
    {
      field: 'priority',
      isEditable: true,
      renderEditor: ({ cellEl, project, manager, field }) => {
        const contentEl = cellEl.querySelector('.cell-content') || cellEl;
        const ed = new InlineSelectEditor(contentEl, {
          options: priorityOptions(),
          initialValue: project?.[field] || ''
        });
        mountEditorHelpers(manager, contentEl, ed);
        return ed;
      }
    },

    // (17) Budget - money
    {
      field: 'estimated_costing',
      isEditable: true,
      renderEditor: ({ cellEl, project, manager, field }) => {
        const contentEl = cellEl.querySelector('.cell-content') || cellEl;
        const ed = new InlineMoneyEditor(contentEl, { initialValue: project?.[field] || '' });
        mountEditorHelpers(manager, contentEl, ed);
        return ed;
      }
    },

    // (11) Entity - read-only
    { field: 'custom_entity_type', isEditable: false },

    // (12) Project Type - read-only
    { field: 'project_type', isEditable: false },

    // (15) Frequency - read-only for now (but spec exists)
    { field: 'custom_project_frequency', isEditable: false },

    // (16) Fiscal Year - read-only
    { field: 'custom_fiscal_year', isEditable: false },

    // (10) %Complete - not urgent; keep read-only for now (future interface)
    { field: 'percent_complete', isEditable: false },

    // (6) Software - complex (Table MultiSelect) => later spec will override editor+commit
    {
      field: 'custom_softwares',
      isEditable: true,
      renderEditor: ({ cellEl, project, manager }) => multiLinkEditor({
        cellEl,
        project,
        manager,
        doctype: 'Software',
        placeholder: 'Search software...',
        initialValues: normalizeSoftwareInitial(project),
        defaultList: defaultSoftwareList
      }),
      async commit({ projectName, value, store }) {
        const softwares = Array.isArray(value) ? value : [];
        const r = await frappe.call({
          method: 'smart_accounting.api.project_board.set_project_softwares',
          args: { project: projectName, softwares }
        });
        const msg = r?.message || {};
        const updated = msg?.custom_softwares || [];
        // Update store for UI refresh
        if (store?.commit) store.commit('projects/updateProject', { name: projectName, custom_softwares: updated });
      }
    },

    // (18) Engagement Letter - Attach (upload via Frappe builtin)
    {
      field: 'custom_engagement_letter',
      isEditable: true,
      renderCell: ({ project }) => {
        const v = project?.custom_engagement_letter;
        if (!v) return '<span class="text-muted">—</span><span class="sb-afford sb-afford--select">Upload</span>';
        const url = escapeHtml(String(v));
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">📎 Engagement Letter</a>`;
      },
      renderEditor: ({ cellEl, project, manager, field }) => attachmentEditor({ cellEl, project, manager, field, label: 'Upload' })
    },

    // (19) Team by role derived columns: team:<Role> => later editor
    {
      fieldPrefix: 'team:',
      isEditable: true,
      renderEditor: ({ cellEl, project, manager, field }) => {
        const role = String(field || '').slice('team:'.length);
        return multiLinkEditor({
          cellEl,
          project,
          manager,
          doctype: 'User',
          placeholder: `Search users...`,
          initialValues: normalizeTeamInitial(project, role),
          defaultList: defaultUserList,
          resolveMeta: resolveUserMeta
        });
      },
      async commit({ project, projectName, field, value, store }) {
        const role = String(field || '').slice('team:'.length);
        const selectedUsers = Array.isArray(value) ? value : [];

        const existing = Array.isArray(project?.custom_team_members) ? project.custom_team_members : [];
        const kept = existing
          .filter((m) => String(m?.role || '').trim() !== String(role || '').trim())
          .map((m) => ({ user: m?.user, role: m?.role }))
          .filter((m) => m?.user && m?.role);

        const next = kept.concat(selectedUsers.map((u) => ({ user: u, role })));

        const r = await frappe.call({
          method: 'smart_accounting.api.project_board.set_project_team_members',
          args: { project: projectName, members: next }
        });
        const msg = r?.message || {};
        const updated = msg?.custom_team_members || [];
        if (store?.commit) store.commit('projects/updateProject', { name: projectName, custom_team_members: updated });
      }
    },
  ];
}


