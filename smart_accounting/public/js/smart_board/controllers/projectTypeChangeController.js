/**
 * projectTypeChangeController
 * - Orchestrates "change project type" flow for Board table cells.
 *
 * Responsibilities:
 * - Fetch Project Type options (data access via service)
 * - Open UI modal (UI component)
 * - Return selected value (no write side-effects here)
 */
import { ProjectTypeService } from '../services/projectTypeService.js';
import { ProjectTypeChangeModal } from '../components/BoardView/ProjectTypeChangeModal.js';

/**
 * Open modal and let caller decide what to do with the chosen value.
 * Returns the modal instance so callers can close it on teardown (e.g. inline editor cancel).
 */
export async function openProjectTypeChangeFlow({ project, onSelected, onClosed } = {}) {
  const p = project || null;
  if (!p) return null;

  const options = await ProjectTypeService.fetchProjectTypes();

  const modal = new ProjectTypeChangeModal({
    project: p,
    projectTypes: options || [],
    onConfirm: async ({ next }) => {
      try {
        await onSelected?.(String(next || '').trim() || '');
      } catch (e) {}
    },
    onClose: () => {
      try { onClosed?.(); } catch (e) {}
    },
  });
  await modal.open();
  return modal;
}


