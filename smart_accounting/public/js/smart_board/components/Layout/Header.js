/**
 * Smart Board - Header Component
 * 顶部工具栏组件
 */

import { renderHeaderActions, bindHeaderActions } from './headerToolbars.js';
import { isProductView } from '../../utils/viewTypes.js';
import { AdvancedFilterModal } from '../BoardView/AdvancedFilterModal.js';
import { buildAdvancedFilterColumns } from '../../utils/filterColumns.js';
import { BoardStatusService } from '../../services/boardStatusService.js';

export class Header {
    constructor(container, options = {}) {
        this.container = container;
        this.options = options;
        this.currentView = options.currentView || 'ITR';
        this.onAction = options.onAction || (() => {});
        this._unsub = null;
        
        this.render();
        this.bindEvents();
        this.subscribeToStore();
    }
    
    isBoardView() {
        if (typeof this.options.isBoardView === 'function') {
            try {
                return !!this.options.isBoardView(this.currentView);
            } catch (e) {}
        }
        // Default fallback
        return !isProductView(this.currentView);
    }

    render() {
        const isBoard = this.isBoardView();
        this.container.innerHTML = `
            <div class="header-wrapper">
                <!-- Left: View Title -->
                <div class="header-left">
                    <h2 class="view-title">${this.getViewTitle()}</h2>
                    <div class="view-subtitle">${this.getViewSubtitle()}</div>
                </div>
                
                <!-- Right: Actions -->
                <div class="header-right">
                    ${renderHeaderActions(this.currentView, { isBoardView: isBoard })}
                </div>
            </div>
        `;
    }
    
    bindEvents() {
        bindHeaderActions(this.container, this.currentView, {
            isBoardView: this.isBoardView(),
            onAction: this.onAction,
            onShowFilter: () => this.showFilterDialog(),
        });
    }
    
    getViewTitle() {
        const viewTitles = {
            'dashboard': 'Dashboard',
            'ITR': 'Income Tax Returns',
            'BAS': 'Business Activity Statements',
            'Payroll': 'Payroll',
            'Bookkeeping': 'Bookkeeping',
            'R&D Grant': 'R&D Grants',
            'SMSF': 'SMSF',
            'Audit': 'Audit',
            'Financial Statements': 'Financial Statements',
            'clients': 'Clients',
            'activity': 'Activity Log',
            'settings': 'Settings',
            'client-projects': 'Client Projects',
        };
        
        return viewTitles[this.currentView] || this.currentView;
    }
    
    getViewSubtitle() {
        return '';
    }
    
    async showFilterDialog() {
        // Website-safe modal (Monday-like)
        const initial = this.options?.store?.getState?.()?.filters || {};
        const statusOptions = await BoardStatusService.getEffectiveOptions({
            projectType: this.currentView,
            currentValue: '',
        });
        const columns = await buildAdvancedFilterColumns({
            viewType: this.currentView,
            statusOptions,
        });

        const modal = new AdvancedFilterModal({
            title: `Filter · ${this.currentView}`,
            columns,
            initial,
            onApply: (values) => this.onAction('filter', {
                // Clear legacy simple filters to avoid confusing double-filtering.
                status: [],
                company: null,
                customer: null,
                fiscal_year: null,
                date_from: null,
                date_to: null,
                ...values
            }),
        });
        modal.open();
    }
    
    getStatusOptions() {
        // Deprecated: status options are now sourced from backend meta + board status config.
        return '';
    }
    
    updateView(view) {
        this.currentView = view;

        // Re-render to switch toolbars between board/page modes
        this.render();
        this.bindEvents();
        this._updateCountsSubtitle();
    }

    subscribeToStore() {
        const store = this.options?.store;
        if (!store?.subscribe) return;
        if (this._unsub) {
            try { this._unsub(); } catch (e) {}
            this._unsub = null;
        }
        this._unsub = store.subscribe(() => this._updateCountsSubtitle());
        this._updateCountsSubtitle();
    }

    _updateCountsSubtitle() {
        try {
            const el = this.container?.querySelector?.('.view-subtitle');
            if (!el) return;

            // Only show counts for board views (Project Type boards)
            if (!this.isBoardView()) {
                el.textContent = '';
                return;
            }

            const state = this.options?.store?.getState?.() || {};
            const p = state?.projects || {};
            const loaded = Array.isArray(p?.items) ? p.items.length : 0;
            const total = (p?.totalCount == null) ? null : Number(p.totalCount);
            const loading = !!p?.loading;
            const loadingMore = !!p?.loadingMore;
            const hasMore = p?.hasMore !== false;

            if (loading && loaded === 0) {
                el.textContent = 'Loading…';
                return;
            }

            if (total != null && Number.isFinite(total)) {
                const all = loaded >= total;
                el.textContent = all
                    ? `Loaded ${loaded} / ${total} · All loaded`
                    : `Loaded ${loaded} / ${total}${loadingMore ? ' · Loading…' : ''}`;
                return;
            }

            // Fallback when total is unknown
            if (!hasMore && !loadingMore) {
                el.textContent = `Loaded ${loaded} · All loaded`;
                return;
            }
            el.textContent = `Loaded ${loaded}${loadingMore ? ' · Loading…' : ''}`;
        } catch (e) {}
    }
    
    destroy() {
        try { this._unsub?.(); } catch (e) {}
        this._unsub = null;
        this.container.innerHTML = '';
    }
}

