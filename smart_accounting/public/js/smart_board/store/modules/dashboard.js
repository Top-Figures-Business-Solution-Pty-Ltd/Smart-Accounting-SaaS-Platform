/**
 * Dashboard state module
 * - My Projects list (related via team roles)
 */
import { ProjectService } from '../../services/projectService.js';

export const DashboardModule = {
  state() {
    return {
      loading: false,
      myProjects: [],
      error: null,
      lastUpdatedAt: null,
    };
  },

  actions: {
    async fetchMyProjects(state, _payload, store) {
      store.commit('dashboard/setLoading', true);
      store.commit('dashboard/setError', null);
      try {
        const rows = await ProjectService.getMyProjectsWithRoles();
        store.commit('dashboard/setMyProjects', rows || []);
        store.commit('dashboard/setLastUpdatedAt', Date.now());
      } catch (e) {
        store.commit('dashboard/setError', String(e?.message || e));
      } finally {
        store.commit('dashboard/setLoading', false);
      }
    }
  },

  mutations: {
    setLoading(state, v) {
      state.loading = !!v;
    },
    setMyProjects(state, rows) {
      state.myProjects = Array.isArray(rows) ? rows : [];
    },
    setError(state, msg) {
      state.error = msg || null;
    },
    setLastUpdatedAt(state, ts) {
      state.lastUpdatedAt = ts || null;
    }
  }
};


