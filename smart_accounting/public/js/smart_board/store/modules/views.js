/**
 * Smart Board - Views Module
 * Saved Views状态管理模块
 */

import { ViewService } from '../../services/viewService.js';

export const ViewsModule = {
    /**
     * 初始状态
     */
    state() {
        return {
            items: [],
            currentView: null,
            loading: false
        };
    },
    
    /**
     * Mutations
     */
    mutations: {
        setViews(state, views) {
            state.items = views;
        },
        
        setCurrentView(state, view) {
            state.currentView = view;
        },
        
        setLoading(state, loading) {
            state.loading = loading;
        },
        
        addView(state, view) {
            state.items.push(view);
        },
        
        updateView(state, updatedView) {
            const index = state.items.findIndex(v => v.name === updatedView.name);
            if (index > -1) {
                state.items[index] = { ...state.items[index], ...updatedView };
            }
        },
        
        removeView(state, viewName) {
            state.items = state.items.filter(v => v.name !== viewName);
        }
    },
    
    /**
     * Actions
     */
    actions: {
        async fetchViews(state, projectType, store) {
            store.commit('views/setLoading', true);
            
            try {
                const views = await ViewService.fetchViews(projectType);
                store.commit('views/setViews', views);
                
                // 设置默认视图
                const defaultView = views.find(v => v.is_default) || views[0];
                if (defaultView) {
                    store.commit('views/setCurrentView', defaultView);
                }
                
                return state;
            } catch (error) {
                console.error('Failed to fetch views:', error);
                return state;
            } finally {
                store.commit('views/setLoading', false);
            }
        },
        
        async saveView(state, viewData, store) {
            try {
                const savedView = await ViewService.saveView(viewData);
                if (savedView) {
                    store.commit('views/addView', savedView);
                }
                return state;
            } catch (error) {
                console.error('Failed to save view:', error);
                return state;
            }
        }
    }
};

