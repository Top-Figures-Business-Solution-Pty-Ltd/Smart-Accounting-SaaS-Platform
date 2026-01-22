/**
 * newProjectController
 * - Orchestrates the New Project modal for website shell (/smart).
 * - Keeps SmartBoardApp and services clean by centralizing workflow here.
 */
import { NewProjectModal } from '../components/BoardView/NewProjectModal.js';
import { ProjectCreateService } from '../services/projectCreateService.js';
import { notify } from '../services/uiAdapter.js';
import { isDesk } from '../utils/env.js';

export async function openNewProjectFlow({ app, viewType } = {}) {
  // Desk keeps the existing behavior (open ERPNext form).
  if (isDesk()) {
    // Caller should use navigationService.createProject in Desk
    return null;
  }

  const currentView = String(viewType || app?.currentView || '').trim();
  const store = app?.store || null;
  const stateFilters = store?.getState?.()?.filters || {};

  const modal = new NewProjectModal({
    title: 'New Project',
    initial: {
      project_type: currentView || null,
      // If user has an active fiscal_year filter, reuse it for creation.
      fiscal_year: stateFilters?.fiscal_year || null,
    },
    onSubmit: async (payload) => {
      const doc = await ProjectCreateService.createProject(payload);
      notify('Project created', 'green');
      // Refresh current board list so newly created row appears and columns/hydration are consistent.
      const last = store?.getState?.()?.projects?.lastFilters || null;
      const base = { ...(last || {}), project_type: payload.project_type };
      try {
        await store?.dispatch?.('projects/fetchProjects', base);
      } catch (e) {
        // fallback: optimistic insert if fetch fails
        if (doc?.name) store?.commit?.('projects/addProject', doc);
      }
      return doc;
    },
  });

  await modal.open();
  return modal;
}


