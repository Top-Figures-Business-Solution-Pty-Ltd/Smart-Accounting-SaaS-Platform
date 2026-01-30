/**
 * Smart Board - Clients Module
 * - Client list state for /smart shell
 */
import { ClientsService } from '../../services/clientsService.js';

function _stableQueryKey(filters) {
  const f = { ...(filters || {}) };
  delete f.limit_start;
  const keys = Object.keys(f).sort();
  const out = {};
  for (const k of keys) out[k] = f[k];
  try { return JSON.stringify(out); } catch (e) { return String(Date.now()); }
}

export const ClientsModule = {
  state() {
    return {
      items: [],
      loading: false,
      loadingMore: false,
      error: null,
      offset: 0,
      hasMore: true,
      totalCount: null,
      lastQueryKey: '',
      lastFilters: { search: '' },
      requestSeq: 0,
      activeRequestSeq: 0,
    };
  },

  mutations: {
    setClients(state, items) {
      state.items = Array.isArray(items) ? items : [];
      state.offset = (state.items || []).length;
    },
    appendClients(state, items) {
      const list = Array.isArray(items) ? items : [];
      if (!list.length) return;
      const seen = new Set((state.items || []).map((c) => c?.name).filter(Boolean));
      for (const c of list) {
        const name = c?.name;
        if (!name || seen.has(name)) continue;
        state.items.push(c);
        seen.add(name);
      }
      state.offset = (state.items || []).length;
    },
    setLoading(state, v) { state.loading = !!v; },
    setLoadingMore(state, v) { state.loadingMore = !!v; },
    setError(state, v) { state.error = v || null; },
    setHasMore(state, v) { state.hasMore = !!v; },
    setTotalCount(state, v) {
      const n = (v == null) ? null : Number(v);
      state.totalCount = (n == null || !Number.isFinite(n)) ? null : n;
    },
    setOffset(state, v) {
      const n = Number(v);
      if (Number.isFinite(n)) state.offset = n;
    },
    setLastQueryKey(state, k) { state.lastQueryKey = String(k || ''); },
    setLastFilters(state, f) { state.lastFilters = f ? { ...(f || {}) } : { search: '' }; },
    setRequestSeq(state, seq) { state.requestSeq = Number(seq) || 0; },
    setActiveRequestSeq(state, seq) { state.activeRequestSeq = Number(seq) || 0; },
    updateClient(state, { name, data } = {}) {
      const key = String(name || data?.name || '');
      if (!key || !Array.isArray(state.items)) return;
      const idx = state.items.findIndex((c) => String(c?.name) === key);
      if (idx < 0) return;
      const current = state.items[idx] || {};
      state.items[idx] = { ...current, ...(data || {}) };
    },
    removeClient(state, { name } = {}) {
      const key = String(name || '');
      if (!key || !Array.isArray(state.items)) return;
      state.items = state.items.filter((c) => String(c?.name) !== key);
      state.offset = (state.items || []).length;
    },
  },

  actions: {
    async fetchClients(state, filters, store) {
      const seq = Number(state.requestSeq || 0) + 1;
      store.commit('clients/setRequestSeq', seq);
      store.commit('clients/setActiveRequestSeq', seq);
      store.commit('clients/setLoading', true);
      store.commit('clients/setError', null);
      try {
        const key = _stableQueryKey(filters);
        store.commit('clients/setLastQueryKey', key);
        store.commit('clients/setLastFilters', filters || {});
        store.commit('clients/setHasMore', true);
        store.commit('clients/setOffset', 0);
        // Default page size. We will auto-load more as user scrolls (ClientsTable),
        // so we don't need to pull everything in one go.
        const limit = Number.isFinite(Number(filters?.limit)) ? Number(filters.limit) : 50;
        const r = await ClientsService.fetchClients({
          search: filters?.search || '',
          limitStart: 0,
          limit,
        });
        const items = r?.items || [];
        const total = r?.meta?.total_count;
        if (Number(state.activeRequestSeq || 0) !== seq) return state;
        if (state.lastQueryKey !== key) return state;
        store.commit('clients/setClients', items);
        store.commit('clients/setHasMore', Array.isArray(items) && items.length >= limit);
        store.commit('clients/setTotalCount', total);
        return state;
      } catch (e) {
        if (Number(state.activeRequestSeq || 0) === seq) store.commit('clients/setError', e?.message || String(e));
        return state;
      } finally {
        if (Number(state.activeRequestSeq || 0) === seq) store.commit('clients/setLoading', false);
      }
    },

    async fetchMoreClients(state, filters, store) {
      if (state.loading || state.loadingMore) return state;
      if (!state.hasMore) return state;
      const effective = filters || state.lastFilters || { search: '' };
      const key = _stableQueryKey(effective);
      if (key !== state.lastQueryKey) return state;
      store.commit('clients/setLoadingMore', true);
      try {
        const offset = Number(state.offset || 0);
        const limit = Number.isFinite(Number(effective?.limit)) ? Number(effective.limit) : 50;
        const r = await ClientsService.fetchClients({
          search: effective?.search || '',
          limitStart: offset,
          limit,
        });
        const items = r?.items || [];
        const total = r?.meta?.total_count;
        if (state.lastQueryKey !== key) return state;
        store.commit('clients/appendClients', items);
        store.commit('clients/setHasMore', Array.isArray(items) && items.length >= limit);
        if (total != null) store.commit('clients/setTotalCount', total);
      } catch (e) {
        store.commit('clients/setHasMore', false);
      } finally {
        store.commit('clients/setLoadingMore', false);
      }
      return state;
    }
  }
};


