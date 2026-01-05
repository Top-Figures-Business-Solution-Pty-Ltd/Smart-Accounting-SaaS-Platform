/**
 * Smart Board - Filters Module
 * 筛选器状态管理模块
 */

export const FiltersModule = {
    /**
     * 初始状态
     */
    state() {
        return {
            status: [],
            company: null,
            customer: null,
            fiscal_year: null,
            date_from: null,
            date_to: null,
            search: ''
        };
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
        
        clearFilters(state) {
            state.status = [];
            state.company = null;
            state.customer = null;
            state.fiscal_year = null;
            state.date_from = null;
            state.date_to = null;
            state.search = '';
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
        
        clearAll(state, payload, store) {
            store.commit('filters/clearFilters');
            return state;
        }
    }
};

