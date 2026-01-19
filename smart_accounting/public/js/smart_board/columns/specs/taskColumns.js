/**
 * Task column specs (inline editing)
 * - Separate from project column registry to avoid field name collisions.
 */
import { InlineTextEditor } from '../../components/Common/editors/InlineTextEditor.js';
import { InlineSelectEditor } from '../../components/Common/editors/InlineSelectEditor.js';
import { InlineDateEditor } from '../../components/Common/editors/InlineDateEditor.js';
import { DoctypeMetaService } from '../../services/doctypeMetaService.js';
import { LinkInput } from '../../components/Common/LinkInput.js';
import { MultiLinkPicker } from '../../components/Common/MultiLinkPicker.js';
import { ProjectService } from '../../services/projectService.js';
import { notify } from '../../services/uiAdapter.js';

const TASK_STATUS_FALLBACK = ['Not Started', 'Working On It', 'Stuck', 'Done'];
const TASK_PRIORITY_FALLBACK = ['Low', 'Medium', 'High', 'Urgent'];

function mountEditorHelpers(manager, mountEl, editorInstance) {
  const inputEl = editorInstance?.getInputEl?.() || mountEl?.querySelector?.('.sb-inline-editor') || null;
  manager?.bindActiveEditor?.(inputEl, editorInstance);
  setTimeout(() => {
    try { editorInstance?.focus?.({ select: true }); } catch (e) {}
  }, 0);
}

async function getOptions(doctype, fieldname, fallback = []) {
  try {
    const opts = await DoctypeMetaService.getSelectOptions(doctype, fieldname);
    return Array.isArray(opts) && opts.length ? opts : fallback;
  } catch (e) {
    return fallback;
  }
}

function taskSelectEditor({ cellEl, task, manager, field, doctype, fieldname, fallback }) {
  const contentEl = cellEl.querySelector('.cell-content') || cellEl;
  const ed = new InlineSelectEditor(contentEl, {
    options: fallback || [],
    initialValue: task?.[field] || ''
  });
  // Async options from DocType meta (if available)
  getOptions(doctype, fieldname, fallback).then((opts) => {
    ed.options = opts;
    ed.render();
    mountEditorHelpers(manager, contentEl, ed);
  });
  mountEditorHelpers(manager, contentEl, ed);
  return ed;
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
    const r = await frappe.call({
      method: 'smart_accounting.api.project_board.get_user_meta',
      args: { users: arr }
    });
    return r?.message || {};
  } catch (e) {
    return {};
  }
}

function linkEditor({ cellEl, task, field, manager, doctype, placeholder }) {
  const contentEl = cellEl.querySelector('.cell-content') || cellEl;
  contentEl.innerHTML = `<div class="sb-inline-editor sb-inline-editor--link"></div>`;
  const mountEl = contentEl.querySelector('.sb-inline-editor--link');
  if (!mountEl) return;

  const li = new LinkInput(mountEl, {
    doctype,
    placeholder: placeholder || 'Search...',
    initialValue: task?.[field] || null,
    onChange: () => {
      manager?.commitAndClose?.('link-change');
    }
  });

  manager?.bindActiveEditor?.(mountEl.querySelector('.sb-linkinput__input'), li);
  setTimeout(() => {
    try { mountEl.querySelector('.sb-linkinput__input')?.focus?.(); } catch (e) {}
  }, 0);
}

function multiLinkEditor({ cellEl, task, manager, doctype, placeholder, initialValues, defaultList, resolveMeta, max = null }) {
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
    max: max == null ? null : Number(max),
    onChange: () => {
      manager?.commit?.('multilink-change');
    }
  });

  manager?.bindActiveEditor?.(picker.getInputEl(), picker);
  setTimeout(() => {
    try { picker.focus?.(); } catch (e) {}
  }, 0);
  return picker;
}

const TASK_COLUMN_SPECS = {
  subject: {
    isEditable: true,
    afford: 'edit',
    renderEditor: ({ cellEl, task, manager, field }) => {
      const contentEl = cellEl.querySelector('.cell-content') || cellEl;
      const ed = new InlineTextEditor(contentEl, { initialValue: task?.[field] || '' });
      mountEditorHelpers(manager, contentEl, ed);
      return ed;
    }
  },
  status: {
    isEditable: true,
    afford: 'select',
    renderEditor: ({ cellEl, task, manager, field }) => taskSelectEditor({
      cellEl,
      task,
      manager,
      field,
      doctype: 'Task',
      fieldname: 'status',
      fallback: TASK_STATUS_FALLBACK
    })
  },
  priority: {
    isEditable: true,
    afford: 'select',
    renderEditor: ({ cellEl, task, manager, field }) => taskSelectEditor({
      cellEl,
      task,
      manager,
      field,
      doctype: 'Task',
      fieldname: 'priority',
      fallback: TASK_PRIORITY_FALLBACK
    })
  },
  exp_end_date: {
    isEditable: true,
    afford: 'edit',
    renderEditor: ({ cellEl, task, manager, field }) => {
      const contentEl = cellEl.querySelector('.cell-content') || cellEl;
      const ed = new InlineDateEditor(contentEl, { initialValue: task?.[field] || '' });
      mountEditorHelpers(manager, contentEl, ed);
      return ed;
    }
  },
  custom_task_members: {
    isEditable: true,
    afford: 'select',
    renderEditor: ({ cellEl, task, manager, field }) => multiLinkEditor({
      cellEl,
      task,
      manager,
      doctype: 'User',
      placeholder: 'Search users...',
      initialValues: Array.isArray(task?.custom_task_members)
        ? task.custom_task_members.map((m) => m?.user).filter(Boolean)
        : (task?.owner ? [String(task.owner)] : []),
      defaultList: defaultUserList,
      resolveMeta: resolveUserMeta,
      max: null
    }),
    async commit({ task, taskName, field, value }) {
      const arr = Array.isArray(value) ? value : (value ? [value] : []);
      const r = await ProjectService.setTaskTeamMembers(taskName, arr, 'Assigned Person');
      if (r?.missing_field) {
        notify('Task missing team members field (Table → Project Team Member)', 'orange');
        return;
      }
      task.custom_task_members = r?.custom_task_members || r?.custom_team_members || [];
    }
  },
  owner: {
    // Legacy alias: keep column functional but back it by custom_team_members
    isEditable: true,
    afford: 'select',
    renderEditor: ({ cellEl, task, manager }) => TASK_COLUMN_SPECS.custom_task_members.renderEditor({ cellEl, task, manager, field: 'custom_task_members' }),
    async commit({ task, taskName, value }) {
      return TASK_COLUMN_SPECS.custom_task_members.commit({ task, taskName, field: 'custom_task_members', value });
    }
  },
};

export function getTaskColumnSpec(field) {
  const f = String(field || '');
  // Dynamic role-based team columns: team:<Role>
  if (f.startsWith('team:')) {
    const role = f.slice(5).trim();
    return {
      isEditable: true,
      afford: 'select',
      renderEditor: ({ cellEl, task, manager }) => multiLinkEditor({
        cellEl,
        task,
        manager,
        doctype: 'User',
        placeholder: `Select ${role || 'users'}...`,
        initialValues: (() => {
          const team = Array.isArray(task?.custom_task_members)
            ? task.custom_task_members
            : (Array.isArray(task?.custom_team_members) ? task.custom_team_members : []);
          const users = (team || []).filter((m) => String(m?.role || '').trim() === role).map((m) => m?.user).filter(Boolean);
          // legacy fallback for Assigned Person
          if ((!users || !users.length) && role === 'Assigned Person' && task?.owner) return [String(task.owner)];
          return users;
        })(),
        defaultList: defaultUserList,
        resolveMeta: resolveUserMeta,
        max: null
      }),
      async commit({ task, taskName, value }) {
        const arr = Array.isArray(value) ? value : (value ? [value] : []);
        const r = await ProjectService.setTaskTeamMembers(taskName, arr, role || 'Assigned Person');
        if (r?.missing_field) {
          notify('Task missing team members field (Table → Project Team Member)', 'orange');
          return;
        }
        task.custom_task_members = r?.custom_task_members || r?.custom_team_members || [];
      }
    };
  }
  return TASK_COLUMN_SPECS[f] || null;
}


