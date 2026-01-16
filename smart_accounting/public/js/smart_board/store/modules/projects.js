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
            // Used to reset pagination when filters change
            lastQueryKey: '',
            lastFilters: null
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
            store.commit('projects/setLoading', true);
            store.commit('projects/setError', null);
            
            try {
                const key = _stableQueryKey(filters);
                store.commit('projects/setLastQueryKey', key);
                store.commit('projects/setLastFilters', filters || {});
                store.commit('projects/setHasMore', true);
                store.commit('projects/setOffset', 0);
                const limit = Number.isFinite(Number(filters?.limit)) ? Number(filters.limit) : 100;
                const projects = await ProjectService.fetchProjects(filters);
                store.commit('projects/setProjects', projects);
                store.commit('projects/setHasMore', Array.isArray(projects) && projects.length >= limit);
                return state;
            } catch (error) {
                store.commit('projects/setError', error.message);
                return state;
            } finally {
                store.commit('projects/setLoading', false);
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
                const next = await ProjectService.fetchProjects({ ...(effectiveFilters || {}), limit_start: offset, limit });
                store.commit('projects/appendProjects', next);
                store.commit('projects/setHasMore', Array.isArray(next) && next.length >= limit);
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
                await ProjectService.updateProject(name, { [field]: value });
                store.commit('projects/updateProject', { name, [field]: value });
                
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

