/**
 * Navigation / Actions adapter
 * - Centralizes Desk-only actions so components don't sprinkle frappe.* checks.
 */

import { isDesk } from '../utils/env.js';
import { msgprint } from './uiAdapter.js';

export function openProject(projectName) {
  if (isDesk() && typeof frappe?.set_route === 'function') {
    frappe.set_route('Form', 'Project', projectName);
    return;
  }
  msgprint('Project details - coming soon.');
}

export function createProject(projectType) {
  if (isDesk() && typeof frappe?.new_doc === 'function') {
    frappe.new_doc('Project', { project_type: projectType });
    return;
  }
  msgprint('Create Project is not available in this view yet.');
}

export function openProjectTypeList() {
  if (isDesk() && typeof frappe?.set_route === 'function') {
    frappe.set_route('List', 'Project Type');
    return;
  }
  msgprint('Not available in this view. Please contact an administrator.');
}


