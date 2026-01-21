/**
 * boardSettingsController
 * - Orchestrates the Board Settings modal (Project Type ordering).
 */
import { BoardSettingsModal } from '../components/BoardView/BoardSettingsModal.js';
import { BoardSettingsService } from '../services/boardSettingsService.js';
import { notify } from '../services/uiAdapter.js';

export async function openBoardSettingsFlow({ app } = {}) {
  const modalData = await BoardSettingsService.getProjectTypeOrder();
  const order = Array.isArray(modalData?.order) ? modalData.order : [];

  const modal = new BoardSettingsModal({
    title: 'Board Settings',
    projectTypes: order,
    onSave: async (nextOrder) => {
      await BoardSettingsService.setProjectTypeOrder(nextOrder);
      notify('Board settings saved', 'green');
      // Reload project types so sidebar order updates immediately
      try { await app?.loadProjectTypes?.(); } catch (e) {}
    },
  });

  await modal.open();
  return modal;
}


