/**
 * AutomationService
 * - Data access layer for Board Automation CRUD.
 * - Website-safe (uses frappe.call).
 */

const API_BASE = 'smart_accounting.api.automation';

export class AutomationService {
  /**
   * Get metadata: available trigger types, action types, and their config schemas.
   */
  static async getMeta() {
    const r = await frappe.call({ method: `${API_BASE}.get_automation_meta`, quiet: true });
    return r?.message || { triggers: {}, actions: {} };
  }

  /**
   * List all automation rules.
   */
  static async getAutomations() {
    const r = await frappe.call({ method: `${API_BASE}.get_automations`, quiet: true });
    return r?.message?.items || [];
  }

  /**
   * Create or update an automation rule.
   * actions: array of { action_type, config }
   */
  static async saveAutomation({ name, enabled, automation_name, trigger_type, trigger_config, actions } = {}) {
    const r = await frappe.call({
      method: `${API_BASE}.save_automation`,
      quiet: true,
      args: {
        name: name || '',
        enabled: enabled ? 1 : 0,
        automation_name: String(automation_name || '').trim(),
        trigger_type,
        trigger_config: typeof trigger_config === 'string' ? trigger_config : JSON.stringify(trigger_config || {}),
        actions: typeof actions === 'string' ? actions : JSON.stringify(actions || []),
      },
    });
    return r?.message || {};
  }

  /**
   * Toggle automation enabled/disabled.
   */
  static async toggleAutomation(name, enabled) {
    const r = await frappe.call({
      method: `${API_BASE}.toggle_automation`,
      quiet: true,
      args: { name, enabled: enabled ? 1 : 0 },
    });
    return r?.message || {};
  }

  /**
   * Delete an automation rule.
   */
  static async deleteAutomation(name) {
    const r = await frappe.call({
      method: `${API_BASE}.delete_automation`,
      quiet: true,
      args: { name },
    });
    return r?.message || {};
  }
}
