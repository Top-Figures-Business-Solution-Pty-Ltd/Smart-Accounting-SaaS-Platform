/**
 * Smart Board - Projects Module
 * Projects状态管理模块
 */

import { ProjectService } from '../../services/projectService.js';

export const ProjectsModule = {
    /**
     * 初始状态
     */
    state() {
        return {
            items: [],
            loading: false,
            error: null,
            currentProject: null
        };
    },
    
    /**
     * Mutations（同步修改状态）
     */
    mutations: {
        setProjects(state, projects) {
            state.items = projects;
        },
        
        setLoading(state, loading) {
            state.loading = loading;
        },
        
        setError(state, error) {
            state.error = error;
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
                const projects = await ProjectService.fetchProjects(filters);
                store.commit('projects/setProjects', projects);
                return state;
            } catch (error) {
                store.commit('projects/setError', error.message);
                return state;
            } finally {
                store.commit('projects/setLoading', false);
            }
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

