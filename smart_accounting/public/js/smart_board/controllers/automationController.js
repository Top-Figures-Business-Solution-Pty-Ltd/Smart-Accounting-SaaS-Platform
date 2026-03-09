/**
 * Automation Controller
 * - Orchestrates the Automation modal flow.
 */
import { AutomationService } from '../services/automationService.js';
import { AutomationModal } from '../components/BoardView/AutomationModal.js';
import { notify } from '../services/uiAdapter.js';

export async function openAutomationFlow() {
  // Load meta + existing rules in parallel
  const [meta, items] = await Promise.all([
    AutomationService.getMeta(),
    AutomationService.getAutomations(),
  ]);

  const modal = new AutomationModal({
    meta,
    items,
    onSave: async (rule) => {
      try {
        const result = await AutomationService.saveAutomation(rule);
        notify('Automation saved', 'green');
        return result;
      } catch (e) {
        notify('Failed to save automation', 'red');
        throw e;
      }
    },
    onToggle: async (name, enabled) => {
      try {
        await AutomationService.toggleAutomation(name, enabled);
      } catch (e) {
        notify('Failed to toggle automation', 'red');
        throw e;
      }
    },
    onDelete: async (name) => {
      try {
        await AutomationService.deleteAutomation(name);
        notify('Automation deleted', 'green');
      } catch (e) {
        notify('Failed to delete automation', 'red');
        throw e;
      }
    },
    onOpenProject: async (project) => {
      try {
        await window.smart_accounting?.smart_board_instance?.openBoardForProject?.(project);
      } catch (e) {}
    },
  });
  modal.open();
}

