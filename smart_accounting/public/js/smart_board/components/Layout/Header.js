/**
 * Smart Board - Header Component
 * 顶部工具栏组件
 */

import { STATUS_OPTIONS } from '../../utils/constants.js';
import { renderHeaderActions, bindHeaderActions } from './headerToolbars.js';
import { isProductView } from '../../utils/viewTypes.js';
import { AdvancedFilterModal } from '../BoardView/AdvancedFilterModal.js';
import { buildAdvancedFilterColumns } from '../../utils/filterColumns.js';

export class Header {
    constructor(container, options = {}) {
        this.container = container;
        this.options = options;
        this.currentView = options.currentView || 'ITR';
        this.onAction = options.onAction || (() => {});
        
        this.render();
        this.bindEvents();
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
        // 可以显示统计信息，如"12 active projects"
        return '';
    }
    
    async showFilterDialog() {
        // Website-safe modal (Monday-like)
        const initial = this.options?.store?.getState?.()?.filters || {};
        const statusOptions = STATUS_OPTIONS[this.currentView] || STATUS_OPTIONS['DEFAULT'] || [];
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
        // 从constants获取当前视图的status选项
        const options = STATUS_OPTIONS[this.currentView] || STATUS_OPTIONS['DEFAULT'];
        return options.join('\n');
    }
    
    updateView(view) {
        this.currentView = view;

        // Re-render to switch toolbars between board/page modes
        this.render();
        this.bindEvents();
    }
    
    destroy() {
        this.container.innerHTML = '';
    }
}

