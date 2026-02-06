/**
 * projectFrequencyChangeController
 * - Orchestrates "change project frequency" flow for Board table cells.
 *
 * Responsibilities:
 * - Fetch frequency options (data access via service)
 * - Open UI modal (UI component)
 * - Return selected value (no write side-effects here)
 */
import { ProjectFrequencyService } from '../services/projectFrequencyService.js';
import { ProjectFrequencyChangeModal } from '../components/BoardView/ProjectFrequencyChangeModal.js';

/**
 * Open modal and let caller decide what to do with the chosen value.
 * Returns the modal instance so callers can close it on teardown (e.g. inline editor cancel).
 */
export async function openProjectFrequencyChangeFlow({ project, onSelected, onClosed } = {}) {
  const p = project || null;
  if (!p) return null;

  const options = await ProjectFrequencyService.fetchFrequencyOptions();

  const modal = new ProjectFrequencyChangeModal({
    project: p,
    frequencyOptions: options || [],
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


