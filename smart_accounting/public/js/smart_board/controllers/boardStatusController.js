/**
 * boardStatusController
 * - Orchestrates board-level status subset configuration modal.
 */
import { BoardStatusService } from '../services/boardStatusService.js';
import { BoardStatusModal } from '../components/BoardView/BoardStatusModal.js';
import { notify } from '../services/uiAdapter.js';

export async function openBoardStatusSettings({ projectType, onSaved } = {}) {
  const pt = String(projectType || '').trim();
  if (!pt) return null;

  const cfg = await BoardStatusService.getConfig(pt, { force: true });
  const pool = cfg?.pool || [];
  const selected = (cfg?.configured && Array.isArray(cfg?.allowed) && cfg.allowed.length)
    ? cfg.allowed
    : pool;

  const modal = new BoardStatusModal({
    title: `Status Settings · ${pt}`,
    pool,
    selected,
    onSave: async (statuses) => {
      await BoardStatusService.saveConfig(pt, statuses);
      notify('Saved board status settings', 'green');
      try { onSaved?.(statuses); } catch (e) {}
    }
  });
  modal.open();
  return modal;
}


