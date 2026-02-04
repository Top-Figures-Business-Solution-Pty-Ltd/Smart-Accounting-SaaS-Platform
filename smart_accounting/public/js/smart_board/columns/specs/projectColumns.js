/**
 * Project column specs (Step 5)
 * - Focus: editable flags + editor selection + special hooks (e.g. confirm).
 * - Rendering override is optional; by default we keep existing BoardCell.formatValue output.
 */
import { STATUS_COLORS } from '../../utils/constants.js';
import { InlineTextEditor, InlineTextareaEditor, InlineSelectEditor, InlineMenuSelectEditor, InlineDateEditor, InlineMoneyEditor } from '../../components/Common/editors/index.js';
import { LinkInput } from '../../components/Common/LinkInput.js';
import { MultiLinkPicker } from '../../components/Common/MultiLinkPicker.js';
import { uploadAttachmentToField } from '../../services/fileUploadService.js';
import { DoctypeMetaService } from '../../services/doctypeMetaService.js';
import { BoardStatusService } from '../../services/boardStatusService.js';
import { confirmDialog } from '../../services/uiAdapter.js';
import { escapeHtml } from '../../utils/dom.js';

function _fileNameFromUrl(url) {
  const s = String(url || '').trim();
  if (!s) return '';
  const clean = s.split('?')[0].split('#')[0];
  const parts = clean.split('/');
  const last = parts[parts.length - 1] || '';
  try {
    return decodeURIComponent(last);
  } catch (e) {
    return last;
  }
}

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

async function statusOptionsForProject(project) {
  const pt = String(project?.project_type || '').trim();
  const cur = String(project?.status || '').trim();
  // Source of truth:
  // - Pool comes from Project.status meta (Property Setter)
  // - Board can further restrict to a subset by Project Type
  const opts = await BoardStatusService.getEffectiveOptions({ projectType: pt, currentValue: cur });
  // Ensure current value is always present (even if not in allowed subset)
  if (cur && Array.isArray(opts) && !opts.includes(cur)) return [cur].concat(opts);
  return Array.isArray(opts) ? opts : (cur ? [cur] : []);
}

function statusMenuEditor({ cellEl, project, manager, field }) {
  const contentEl = cellEl.querySelector('.cell-content') || cellEl;
  const current = project?.[field] || '';

  // Render immediately with current value only (so UI responds instantly),
  // then replace options once meta is loaded.
  const ed = new InlineMenuSelectEditor(contentEl, {
    options: current ? [{ value: current, label: current, color: STATUS_COLORS[current] || '' }] : [],
    initialValue: current
  });

  // Commit on selection
  contentEl.addEventListener('sb:menu-select', (e) => {
    e.stopPropagation?.();
    manager?.commitAndClose?.('menu-select');
  }, { once: true });
  // Close on outside click
  contentEl.addEventListener('sb:menu-close', () => {
    manager?.commitAndClose?.('menu-close');
  }, { once: true });

  // Load true options from backend meta and re-render editor once.
  statusOptionsForProject(project).then((opts) => {
    if (!contentEl?.isConnected) return;
    const items = (opts || []).map((s) => ({
      value: s,
      label: s,
      color: STATUS_COLORS[s] || ''
    }));
    ed.options = items;
    ed.render();
    mountEditorHelpers(manager, contentEl, ed);
  });

  mountEditorHelpers(manager, contentEl, ed);
  return ed;
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

let _companyOptionsCache = null;
let _companyOptionsLoading = null;
async function getCompanyOptions() {
  if (Array.isArray(_companyOptionsCache)) return _companyOptionsCache;
  if (_companyOptionsLoading) return _companyOptionsLoading;
  _companyOptionsLoading = (async () => {
    try {
      const r = await frappe.call({
        method: 'frappe.client.get_list',
        type: 'POST',
        args: {
          doctype: 'Company',
          fields: ['name'],
          order_by: 'name asc',
          limit_page_length: 200
        }
      });
      const list = (r?.message || []).map((x) => x?.name).filter(Boolean);
      _companyOptionsCache = list;
      return list;
    } catch (e) {
      _companyOptionsCache = [];
      return [];
    } finally {
      _companyOptionsLoading = null;
    }
  })();
  return _companyOptionsLoading;
}

function companyMenuEditor({ cellEl, project, manager, field }) {
  const contentEl = cellEl.querySelector('.cell-content') || cellEl;

  // Create editor immediately (so manager lifecycle works), then populate options async.
  const ed = new InlineMenuSelectEditor(contentEl, {
    options: [{ value: project?.[field] || '', label: project?.[field] || '—' }].filter((x) => x.value),
    initialValue: project?.[field] || ''
  });

  // Commit on selection (menu-select is emitted by editor)
  contentEl.addEventListener('sb:menu-select', (e) => {
    e.stopPropagation?.();
    manager?.commitAndClose?.('menu-select');
  }, { once: true });

  // Close on outside click (portal menu emits sb:menu-close)
  contentEl.addEventListener('sb:menu-close', () => {
    manager?.commitAndClose?.('menu-close');
  }, { once: true });

  // Populate options from system (best-effort); if permission blocks, fall back to search-based LinkInput
  getCompanyOptions().then((opts) => {
    if (!contentEl?.isConnected) return;
    if (Array.isArray(opts) && opts.length) {
      ed.options = opts.map((c) => ({ value: c, label: c }));
      ed.render();
      // Re-bind lifecycle after re-render
      mountEditorHelpers(manager, contentEl, ed);
    } else {
      // fallback to old search input if company list can't be read
      try {
        ed.destroy?.();
      } catch (e2) {}
      linkEditor({ cellEl, project, field, manager, doctype: 'Company', placeholder: 'Search Company...' });
    }
  });

  mountEditorHelpers(manager, contentEl, ed);
  return ed;
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
      // Commit on each change but keep editor open for multi-select.
      manager?.commit?.('multilink-change');
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

function attachmentEditor({ cellEl, project, manager, field, label = 'Upload', autoOpen = false }) {
  const contentEl = cellEl.querySelector('.cell-content') || cellEl;
  const current = project?.[field] || '';
  const safeUrl = current ? escapeHtml(String(current)) : '';
  const displayName = current ? escapeHtml(_fileNameFromUrl(current) || 'Attachment') : '';

  contentEl.innerHTML = `
    <div class="sb-attach">
      ${safeUrl ? `<a class="sb-attach__link sb-attach__link--file" href="${safeUrl}" target="_blank" rel="noopener noreferrer">📎 ${displayName}</a>` : `<span class="text-muted">—</span>`}
      <button type="button" class="sb-attach__btn sb-inline-editor" aria-label="${escapeHtml(label)}">${escapeHtml(label)}</button>
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
      // Update editor UI immediately (so user sees success without waiting for re-render)
      try {
        const linkEl = contentEl.querySelector('.sb-attach__link--file');
        if (linkEl && editor._value) {
          linkEl.setAttribute('href', String(editor._value));
          linkEl.textContent = `📎 ${_fileNameFromUrl(editor._value) || 'Attachment'}`;
        }
      } catch (e) {}
      // Commit immediately once upload finishes (avoid relying on blur)
      manager?.commitAndClose?.('upload-file');
    } catch (err) {
      console.error(err);
      // keep editor open; user can retry
    } finally {
      if (hint) hint.style.display = 'none';
      // Allow picking the same file again (some browsers won't fire change if the same file is chosen).
      try { fileInput.value = ''; } catch (e) {}
    }
  });

  manager?.bindActiveEditor?.(btn, editor);
  // UX: open file picker immediately on first click-to-edit.
  if (autoOpen) {
    // Defer to next tick so the original click event delegation finishes,
    // and to avoid re-entering EditingManager.startEdit via the synthetic click.
    setTimeout(() => {
      try { fileInput?.click?.(); } catch (e) {}
    }, 0);
  }
  return editor;
}

export function makeProjectColumnSpecs() {
  return [
    // (1) Client Name - read-only for now, but keep interface (spec exists).
    {
      field: 'customer',
      isEditable: false,
      renderCell: ({ project }) => {
        const text = escapeHtml(project?.customer || '—');
        return `<span class="sb-primary-text">${text}</span>`;
      }
    },

    // (2) Project Name - editable text
    {
      field: 'project_name',
      isEditable: true,
      // Do NOT bulk-sync project_name; it is typically unique per row.
      bulkSync: false,
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
      renderEditor: ({ cellEl, project, manager, field }) => statusMenuEditor({ cellEl, project, manager, field })
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
      // Company should behave like a simple selector (monday-style labels), not a search box.
      renderEditor: ({ cellEl, project, manager, field }) => companyMenuEditor({ cellEl, project, manager, field })
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

    // (20) System/meta fields that should never be edited from the board
    // - They are either computed, managed by the system, or not part of the Smart Board editing UX yet.
    { field: 'modified', isEditable: false },
    { field: 'auto_repeat', isEditable: false },
    { field: 'is_active', isEditable: false },
    { field: 'custom_customer_entity', isEditable: false },
    { field: 'custom_team_members', isEditable: false },

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
      ,
      async commitBulk({ projects, value, store }) {
        const names = Array.isArray(projects) ? projects.filter(Boolean) : [];
        const softwares = Array.isArray(value) ? value : [];
        if (!names.length) return;
        const r = await frappe.call({
          method: 'smart_accounting.api.project_board.bulk_set_project_softwares',
          args: { projects: names, softwares }
        });
        const msg = r?.message || {};
        const map = msg?.softwares || {};
        for (const p of names) {
          const updated = map?.[p] || [];
          if (store?.commit) store.commit('projects/updateProject', { name: p, custom_softwares: updated });
        }
      }
    },

    // (18) Engagement Letter - Attach (upload via Frappe builtin)
    {
      field: 'custom_engagement_letter',
      isEditable: true,
      // Attach upload should not be bulk-synced by default (would copy the same file_url to many Projects).
      bulkSync: false,
      // IMPORTANT:
      // Upload is performed inside the editor (via /api/method/upload_file), but the Attach field
      // still must be written back to Project to persist in the form view.
      // We provide a custom commit so EditingManager will NOT short-circuit due to "unchanged"
      // (because we may update UI optimistically).
      async commit({ projectName, field, value, store }) {
        if (!projectName || !field) return;
        const v = String(value || '').trim();
        // Persist to backend (set_value) + update store
        if (store?.dispatch) {
          await store.dispatch('projects/updateProjectField', { name: projectName, field, value: v });
        } else if (store?.commit) {
          store.commit('projects/updateProject', { name: projectName, [field]: v });
        }
      },
      renderCell: ({ project }) => {
        const v = project?.custom_engagement_letter;
        if (!v) return '<span class="sb-attach-pill">Upload</span>';
        const url = escapeHtml(String(v));
        const name = escapeHtml(_fileNameFromUrl(v) || 'Engagement Letter');
        return `<a class="sb-attach__link sb-attach__link--file" href="${url}" target="_blank" rel="noopener noreferrer">📎 ${name}</a> <span class="sb-attach-pill sb-attach-pill--subtle">Replace</span>`;
      },
      renderEditor: ({ cellEl, project, manager, field }) => attachmentEditor({
        cellEl,
        project,
        manager,
        field,
        label: (project?.[field] ? 'Replace' : 'Upload'),
        autoOpen: true
      })
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
      ,
      async commitBulk({ projects, field, value, store }) {
        const role = String(field || '').slice('team:'.length);
        const names = Array.isArray(projects) ? projects.filter(Boolean) : [];
        const users = Array.isArray(value) ? value : [];
        if (!role || !names.length) return;
        const r = await frappe.call({
          method: 'smart_accounting.api.project_board.bulk_set_project_team_role',
          args: { projects: names, role, users }
        });
        const msg = r?.message || {};
        const map = msg?.team || {};
        for (const p of names) {
          const updated = map?.[p] || [];
          if (store?.commit) store.commit('projects/updateProject', { name: p, custom_team_members: updated });
        }
      }
    },
  ];
}


