/**
 * Smart Board - Filters Module
 * 筛选器状态管理模块
 */

import { createFilterState } from '../../utils/filterState.js';

export const FiltersModule = {
    /**
     * 初始状态
     */
    state() {
        return createFilterState();
    },
    
    /**
     * Mutations
     */
    mutations: {
        setFilters(state, filters) {
            Object.assign(state, filters);
        },
        
        setStatus(state, status) {
            state.status = status;
        },
        
        setCompany(state, company) {
            state.company = company;
        },
        
        setCustomer(state, customer) {
            state.customer = customer;
        },
        
        setFiscalYear(state, fiscalYear) {
            state.fiscal_year = fiscalYear;
        },
        
        setDateRange(state, { from, to }) {
            state.date_from = from;
            state.date_to = to;
        },
        
        setSearch(state, search) {
            state.search = search;
        },

        setSort(state, { field, order } = {}) {
            state.sort_field = field ? String(field).trim() : null;
            state.sort_order = order ? String(order).trim().toLowerCase() : null;
        },
        
        clearFilters(state) {
            Object.assign(state, createFilterState());
        }
    },
    
    /**
     * Actions
     */
    actions: {
        setFilters(state, filters, store) {
            store.commit('filters/setFilters', filters);
            return state;
        },
        
        setSearch(state, search, store) {
            store.commit('filters/setSearch', search);
            return state;
        },

        setSort(state, payload, store) {
            store.commit('filters/setSort', payload || {});
            return state;
        },
        
        clearAll(state, payload, store) {
            store.commit('filters/clearFilters');
            return state;
        }
    }
};

