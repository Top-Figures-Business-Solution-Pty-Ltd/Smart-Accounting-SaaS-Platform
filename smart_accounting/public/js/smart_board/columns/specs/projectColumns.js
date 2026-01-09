/**
 * Project column specs (Step 5)
 * - Focus: editable flags + editor selection + special hooks (e.g. confirm).
 * - Rendering override is optional; by default we keep existing BoardCell.formatValue output.
 */
import { STATUS_OPTIONS } from '../../utils/constants.js';
import { InlineTextEditor, InlineTextareaEditor, InlineSelectEditor, InlineDateEditor, InlineMoneyEditor } from '../../components/Common/editors/index.js';
import { LinkInput } from '../../components/Common/LinkInput.js';
import { confirmDialog } from '../../services/uiAdapter.js';

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
  return STATUS_OPTIONS[t] || STATUS_OPTIONS.DEFAULT || [];
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

export function makeProjectColumnSpecs() {
  return [
    // (1) Client Name - read-only for now, but keep interface (spec exists).
    { field: 'customer', isEditable: false },

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
      renderEditor: ({ cellEl, project, manager, field }) => {
        const contentEl = cellEl.querySelector('.cell-content') || cellEl;
        const ed = new InlineSelectEditor(contentEl, {
          options: statusOptionsForProject(project),
          initialValue: project?.[field] || ''
        });
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
    { field: 'custom_softwares', isEditable: true, editorType: 'multi-software' },

    // (19) Team by role derived columns: team:<Role> => later editor
    { fieldPrefix: 'team:', isEditable: true, editorType: 'team-role' },
  ];
}


