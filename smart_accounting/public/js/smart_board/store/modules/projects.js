/**
 * Smart Board - Projects Module
 * Projects状态管理模块
 */

import { ProjectService } from '../../services/projectService.js';

function _stableQueryKey(filters) {
    // Stable-ish key to detect filter changes (excluding paging-only props)
    const f = { ...(filters || {}) };
    delete f.limit_start;
    const keys = Object.keys(f).sort();
    const out = {};
    for (const k of keys) {
        const v = f[k];
        // normalize arrays for stable key (e.g. fields)
        if (Array.isArray(v)) out[k] = v.slice();
        else out[k] = v;
    }
    // Common case: fields array order doesn't matter for query identity
    if (Array.isArray(out.fields)) {
        try { out.fields = out.fields.map(String).sort(); } catch (e) {}
    }
    try { return JSON.stringify(out); } catch (e) { return String(Date.now()); }
}

export const ProjectsModule = {
    /**
     * 初始状态
     */
    state() {
        return {
            items: [],
            loading: false,
            loadingMore: false,
            error: null,
            currentProject: null,
            offset: 0,
            hasMore: true,
            totalCount: null,
            // Used to reset pagination when filters change
            lastQueryKey: '',
            lastFilters: null,
            // Concurrency guard: prevent stale (slow) responses from older fetches
            // overriding the latest board switch result.
            requestSeq: 0,
            activeRequestSeq: 0,
        };
    },
    
    /**
     * Mutations（同步修改状态）
     */
    mutations: {
        setProjects(state, projects) {
            state.items = projects;
            state.offset = Array.isArray(projects) ? projects.length : 0;
        },
        
        setLoading(state, loading) {
            state.loading = loading;
        },

        setLoadingMore(state, loading) {
            state.loadingMore = loading;
        },
        
        setError(state, error) {
            state.error = error;
        },

        setHasMore(state, hasMore) {
            state.hasMore = !!hasMore;
        },

        setTotalCount(state, v) {
            const n = (v == null) ? null : Number(v);
            state.totalCount = (n == null || !Number.isFinite(n)) ? null : n;
        },

        setOffset(state, offset) {
            const n = Number(offset);
            state.offset = Number.isFinite(n) ? n : state.offset;
        },

        setLastQueryKey(state, key) {
            state.lastQueryKey = String(key || '');
        },

        setLastFilters(state, filters) {
            // Store the last used filters for infinite scroll "load more".
            // Do not mutate the caller object; keep a shallow clone.
            state.lastFilters = filters ? { ...(filters || {}) } : null;
        },

        setRequestSeq(state, seq) {
            const n = Number(seq);
            state.requestSeq = Number.isFinite(n) ? n : state.requestSeq;
        },

        setActiveRequestSeq(state, seq) {
            const n = Number(seq);
            state.activeRequestSeq = Number.isFinite(n) ? n : state.activeRequestSeq;
        },

        appendProjects(state, projects) {
            const list = Array.isArray(projects) ? projects : [];
            if (!list.length) return;
            const seen = new Set((state.items || []).map((p) => p?.name).filter(Boolean));
            for (const p of list) {
                const name = p?.name;
                if (!name || seen.has(name)) continue;
                state.items.push(p);
                seen.add(name);
            }
            state.offset = (state.items || []).length;
        },
        
        setCurrentProject(state, project) {
            state.currentProject = project;
        },
        
        updateProject(state, updatedProject) {
            const index = state.items.findIndex(p => p.name === updatedProject.name);
            if (index > -1) {
                state.items[index] = { ...state.items[index], ...updatedProject };
            }
        },
        
        addProject(state, project) {
            state.items.unshift(project);
        },
        
        removeProject(state, projectName) {
            state.items = state.items.filter(p => p.name !== projectName);
        }
    },
    
    /**
     * Actions（异步操作）
     */
    actions: {
        async fetchProjects(state, filters, store) {
            // Increment request seq and mark this call as the active (latest) fetch.
            const seq = Number(state.requestSeq || 0) + 1;
            store.commit('projects/setRequestSeq', seq);
            store.commit('projects/setActiveRequestSeq', seq);
            store.commit('projects/setLoading', true);
            store.commit('projects/setError', null);
            
            try {
                const key = _stableQueryKey(filters);
                store.commit('projects/setLastQueryKey', key);
                store.commit('projects/setLastFilters', filters || {});
                store.commit('projects/setHasMore', true);
                store.commit('projects/setOffset', 0);
                store.commit('projects/setTotalCount', null);
                const limit = Number.isFinite(Number(filters?.limit)) ? Number(filters.limit) : 100;
                const result = await ProjectService.fetchProjects(filters);
                const projects = Array.isArray(result?.items) ? result.items : (Array.isArray(result) ? result : []);
                const total = result?.meta?.total_count;
                // Drop stale results (e.g. user switched board again while this request was in-flight).
                if (Number(state.activeRequestSeq || 0) !== seq) return state;
                if (state.lastQueryKey !== key) return state;
                store.commit('projects/setProjects', projects);
                store.commit('projects/setTotalCount', total);
                if (total != null) store.commit('projects/setHasMore', (projects || []).length < Number(total));
                else store.commit('projects/setHasMore', Array.isArray(projects) && projects.length >= limit);
                return state;
            } catch (error) {
                // Only surface errors for the latest request.
                if (Number(state.activeRequestSeq || 0) === seq) {
                    store.commit('projects/setError', error.message);
                }
                return state;
            } finally {
                // Only stop the spinner for the latest request.
                if (Number(state.activeRequestSeq || 0) === seq) {
                    store.commit('projects/setLoading', false);
                }
            }
        },

        async fetchMoreProjects(state, filters, store) {
            if (state.loading || state.loadingMore) return state;
            if (!state.hasMore) return state;

            const effectiveFilters = filters || state.lastFilters || {};
            const key = _stableQueryKey(effectiveFilters);
            if (key !== state.lastQueryKey) {
                // Filters changed; caller should have triggered fetchProjects instead.
                return state;
            }

            store.commit('projects/setLoadingMore', true);
            try {
                const offset = Number(state.offset || 0);
                const limit = Number.isFinite(Number(effectiveFilters?.limit)) ? Number(effectiveFilters.limit) : 100;
                const result = await ProjectService.fetchProjects({ ...(effectiveFilters || {}), limit_start: offset, limit });
                const next = Array.isArray(result?.items) ? result.items : (Array.isArray(result) ? result : []);
                const total = result?.meta?.total_count;
                // If the query changed while loading more, drop the result.
                if (state.lastQueryKey !== key) return state;
                store.commit('projects/appendProjects', next);
                if (total != null) store.commit('projects/setTotalCount', total);
                const totalNow = (total != null) ? Number(total) : state.totalCount;
                if (totalNow != null) store.commit('projects/setHasMore', (state.items || []).length < Number(totalNow));
                else store.commit('projects/setHasMore', Array.isArray(next) && next.length >= limit);
            } catch (e) {
                // Do not hard-fail; just stop auto-loading for now.
                store.commit('projects/setHasMore', false);
            } finally {
                store.commit('projects/setLoadingMore', false);
            }
            return state;
        },
        
        async loadProject(state, projectName, store) {
            try {
                const project = await ProjectService.getProject(projectName);
                store.commit('projects/setCurrentProject', project);
                return state;
            } catch (error) {
                console.error('Failed to load project:', error);
                return state;
            }
        },
        
        async updateProjectField(state, { name, field, value }, store) {
            try {
                const updatedDoc = await ProjectService.updateProject(name, { [field]: value });

                // Merge ALL fields from the backend response into the store.
                // This ensures automation side-effects (e.g. due date roll + status reset)
                // are reflected immediately without a full reload.
                const patch = { name, [field]: value };
                if (updatedDoc && typeof updatedDoc === 'object') {
                    // Pick commonly-affected fields from the response
                    const syncFields = [
                        'status', 'custom_lodgement_due_date', 'expected_end_date',
                        'custom_project_frequency', 'modified',
                    ];
                    for (const f of syncFields) {
                        if (f in updatedDoc && updatedDoc[f] !== undefined) {
                            patch[f] = updatedDoc[f];
                        }
                    }
                }
                store.commit('projects/updateProject', patch);
                
                frappe.show_alert({
                    message: __('Updated successfully'),
                    indicator: 'green'
                });
                
                return state;
            } catch (error) {
                console.error('Failed to update project:', error);
                frappe.show_alert({
                    message: __('Update failed'),
                    indicator: 'red'
                });
                return state;
            }
        }
    }
};

