/**
 * projectEntityChangeController
 * - Orchestrates "change project entity" flow for Board table cells.
 *
 * Responsibilities:
 * - Fetch entities (data access via service)
 * - Open UI modal (UI component)
 * - Return selected value (no write side-effects here)
 */
import { ProjectEntityService } from '../services/projectEntityService.js';
import { ProjectEntityChangeModal } from '../components/BoardView/ProjectEntityChangeModal.js';

/**
 * Open modal and let caller decide what to do with the chosen value.
 * Returns the modal instance so callers can close it on teardown (e.g. inline editor cancel).
 */
export async function openProjectEntityChangeFlow({ project, onSelected, onClosed } = {}) {
  const p = project || null;
  if (!p?.name) return null;

  const payload = await ProjectEntityService.fetchEntitiesForProject(p.name);
  const entities = Array.isArray(payload?.items) ? payload.items : [];

  const modal = new ProjectEntityChangeModal({
    project: p,
    entities,
    currentEntityName: String(p?.custom_customer_entity || '').trim(),
    onConfirm: async ({ next, nextRow }) => {
      try {
        await onSelected?.({
          entityName: String(next || '').trim(),
          entityRow: nextRow || null,
        });
      } catch (e) {}
    },
    onClose: () => {
      try { onClosed?.(); } catch (e) {}
    },
  });
  await modal.open();
  return modal;
}


