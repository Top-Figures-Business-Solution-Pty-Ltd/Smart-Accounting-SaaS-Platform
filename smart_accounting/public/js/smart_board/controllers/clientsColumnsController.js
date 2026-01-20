/**
 * Clients Columns Controller
 * - Uses shared ColumnsManagerModal to configure which client columns are visible.
 */
import { ColumnsManagerModal } from '../components/BoardView/ColumnsManagerModal.js';
import { CLIENT_COLUMNS, getDefaultClientColumns, loadClientColumns, saveClientColumns } from '../utils/clientsColumns.js';

export function openClientsColumnsManager({ onSaved } = {}) {
  const defs = CLIENT_COLUMNS || [];
  const saved = loadClientColumns() || getDefaultClientColumns();
  const enabledSet = new Set(saved);

  const list = defs.map((d) => ({
    field: d.field,
    label: d.label || d.field,
    enabled: enabledSet.has(d.field),
  }));

  const modal = new ColumnsManagerModal({
    title: 'Client Columns',
    activeKey: 'clients',
    sections: [
      {
        key: 'clients',
        label: 'Client Columns',
        hint: '选择要显示的客户列，拖拽调整顺序（个人偏好，本地保存）。',
        columns: list,
      }
    ],
    onSave: (out) => {
      const cols = out?.clients || [];
      const fields = cols.map((c) => c.field).filter(Boolean);
      saveClientColumns(fields);
      try { onSaved?.(fields); } catch (e) {}
    },
  });
  modal.open();
  return modal;
}


