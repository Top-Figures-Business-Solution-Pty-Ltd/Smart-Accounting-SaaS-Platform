/**
 * Smart Board - Header Component
 * 顶部工具栏组件
 */

import { STATUS_OPTIONS } from '../../utils/constants.js';

export class Header {
    constructor(container, options = {}) {
        this.container = container;
        this.options = options;
        this.currentView = options.currentView || 'ITR';
        this.onAction = options.onAction || (() => {});
        
        this.render();
        this.bindEvents();
    }
    
    render() {
        this.container.innerHTML = `
            <div class="header-wrapper">
                <!-- Left: View Title -->
                <div class="header-left">
                    <h2 class="view-title">${this.getViewTitle()}</h2>
                    <div class="view-subtitle">${this.getViewSubtitle()}</div>
                </div>
                
                <!-- Right: Actions -->
                <div class="header-right">
                    <!-- Search -->
                    <div class="header-search">
                        <input 
                            type="text" 
                            class="form-control search-input" 
                            placeholder="Search projects..."
                            id="headerSearchInput"
                        />
                    </div>
                    
                    <!-- Filter Button -->
                    <button class="btn btn-default btn-filter" id="btnFilter">
                        <svg class="icon icon-sm">
                            <use href="#icon-filter"></use>
                        </svg>
                        Filter
                    </button>
                    
                    <!-- Manage Columns -->
                    <button class="btn btn-default btn-columns" id="btnManageColumns">
                        <svg class="icon icon-sm">
                            <use href="#icon-columns"></use>
                        </svg>
                        Columns
                    </button>
                    
                    <!-- New Project Button -->
                    <button class="btn btn-primary btn-new-project" id="btnNewProject">
                        <svg class="icon icon-sm">
                            <use href="#icon-add"></use>
                        </svg>
                        New Project
                    </button>
                </div>
            </div>
        `;
    }
    
    bindEvents() {
        // New Project按钮
        const btnNewProject = this.container.querySelector('#btnNewProject');
        if (btnNewProject) {
            btnNewProject.addEventListener('click', () => {
                this.onAction('new_project');
            });
        }
        
        // Filter按钮
        const btnFilter = this.container.querySelector('#btnFilter');
        if (btnFilter) {
            btnFilter.addEventListener('click', () => {
                this.showFilterDialog();
            });
        }
        
        // Manage Columns按钮
        const btnManageColumns = this.container.querySelector('#btnManageColumns');
        if (btnManageColumns) {
            btnManageColumns.addEventListener('click', () => {
                this.onAction('manage_columns');
            });
        }
        
        // Search输入框
        const searchInput = this.container.querySelector('#headerSearchInput');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.onAction('search', e.target.value);
                }, 300);
            });
        }
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
        
        // 更新标题
        const titleElement = this.container.querySelector('.view-title');
        if (titleElement) {
            titleElement.textContent = this.getViewTitle();
        }
        
        // 更新subtitle
        const subtitleElement = this.container.querySelector('.view-subtitle');
        if (subtitleElement) {
            subtitleElement.textContent = this.getViewSubtitle();
        }
        
        // 清空搜索框
        const searchInput = this.container.querySelector('#headerSearchInput');
        if (searchInput) {
            searchInput.value = '';
        }
    }
    
    destroy() {
        this.container.innerHTML = '';
    }
}

