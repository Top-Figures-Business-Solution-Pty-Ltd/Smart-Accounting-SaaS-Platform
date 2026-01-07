/**
 * Smart Board - Header Component
 * 顶部工具栏组件
 */

import { STATUS_OPTIONS } from '../../utils/constants.js';
import { renderHeaderActions, bindHeaderActions } from './headerToolbars.js';
import { isProductView } from '../../utils/viewTypes.js';

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
            'settings': 'Settings'
        };
        
        return viewTitles[this.currentView] || this.currentView;
    }
    
    getViewSubtitle() {
        // 可以显示统计信息，如"12 active projects"
        return '';
    }
    
    showFilterDialog() {
        if (!frappe?.ui?.Dialog) {
            alert('Filter dialog is not available in this view yet.');
            return;
        }
        // 创建筛选对话框
        const dialog = new frappe.ui.Dialog({
            title: 'Filter Projects',
            fields: [
                {
                    fieldname: 'status',
                    label: 'Status',
                    fieldtype: 'MultiSelect',
                    options: this.getStatusOptions()
                },
                {
                    fieldname: 'company',
                    label: 'Company',
                    fieldtype: 'Link',
                    options: 'Company'
                },
                {
                    fieldname: 'customer',
                    label: 'Customer',
                    fieldtype: 'Link',
                    options: 'Customer'
                },
                {
                    fieldname: 'fiscal_year',
                    label: 'Fiscal Year',
                    fieldtype: 'Link',
                    options: 'Fiscal Year'
                },
                {
                    fieldname: 'date_range',
                    label: 'Due Date Range',
                    fieldtype: 'DateRange'
                }
            ],
            primary_action_label: 'Apply',
            primary_action: (values) => {
                this.onAction('filter', values);
                dialog.hide();
            }
        });
        
        dialog.show();
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

