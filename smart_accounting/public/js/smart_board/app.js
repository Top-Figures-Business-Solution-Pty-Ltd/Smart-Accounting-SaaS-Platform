/**
 * Smart Board - Main Application
 * 主应用组件
 */

import { Sidebar } from './components/Layout/Sidebar.js';
import { Header } from './components/Layout/Header.js';
import { MainContent } from './components/Layout/MainContent.js';
import { PROJECT_TYPE_ICONS, DEFAULT_PROJECT_TYPE_ICON, DEFAULT_COLUMNS } from './utils/constants.js';
import { Store } from './store/store.js';
import { ProjectTypeService } from './services/projectTypeService.js';
import { isBoardView as isBoardViewFn, isProductView } from './utils/viewTypes.js';
import { handleHeaderAction } from './controllers/headerActionHandler.js';
import { openProject, createProject } from './services/navigationService.js';
import { msgprint } from './services/uiAdapter.js';
import { ViewService } from './services/viewService.js';
import './columns/registerDefaultSpecs.js';
import { isDesk } from './utils/env.js';
import { getUrlState, setUrlState } from './utils/urlState.js';

export class SmartBoardApp {
    constructor(container) {
        this.container = container;
        this.store = new Store();
        const urlState = getUrlState();
        // 默认先落在 dashboard，避免系统还没加载 Project Type 时误用不存在的 type（例如 ITR）
        this.currentView = urlState?.view || 'dashboard';
        // Only treat URL customer param as meaningful for client-projects view
        this._initialUrlCustomer = (this.currentView === 'client-projects') ? String(urlState?.customer || '').trim() : '';
        this.projectTypes = [];   // 运行时从系统获取
        this._unsubscribers = [];
        this._onWindowResize = null;
        this._clientProjects = null;
        this._scopedCustomer = '';
        
        this.init();
    }
    
    init() {
        // 清空容器
        this.container.innerHTML = '';
        
        // 创建主布局
        this.createLayout();
        
        // 初始化组件
        this.initComponents();
        
        // 绑定事件
        this.bindEvents();
        
        // 加载初始数据
        this.loadInitialData();
    }
    
    createLayout() {
        this.container.innerHTML = `
            <div class="smart-board-app">
                <div class="smart-board-sidebar" id="smartBoardSidebar"></div>
                <div class="smart-board-main">
                    <div class="smart-board-header" id="smartBoardHeader"></div>
                    <div class="smart-board-content" id="smartBoardContent"></div>
                </div>
            </div>
        `;
    }
    
    initComponents() {
        // 初始化侧边栏
        const sidebarContainer = this.container.querySelector('#smartBoardSidebar');
        this.sidebar = new Sidebar(sidebarContainer, {
            projectTypes: this.projectTypes,
            currentView: this.currentView,
            onViewChange: (viewType) => this.handleViewChange(viewType),
            onBoardSettings: () => this.handleHeaderAction('board_settings')
        });
        
        // 初始化头部
        const headerContainer = this.container.querySelector('#smartBoardHeader');
        this.header = new Header(headerContainer, {
            currentView: this.currentView,
            isBoardView: (viewType) => this.isBoardView(viewType),
            store: this.store,
            onAction: (action, data) => this.handleHeaderAction(action, data)
        });
        
        // 初始化主内容区
        const contentContainer = this.container.querySelector('#smartBoardContent');
        this.mainContent = new MainContent(contentContainer, {
            currentView: this.currentView,
            store: this.store,
            app: this,
            isBoardView: (viewType) => this.isBoardView(viewType),
            onProjectClick: (project) => this.handleProjectClick(project)
        });
    }
    
    bindEvents() {
        // 监听 store 变化：只更新 loading/empty 状态，避免反复 render 导致订阅泄漏
        const unsubStore = this.store.subscribe((state) => {
            const loading = !!state.projects?.loading;
            const items = state.projects?.items || [];

            if (this.mainContent) {
                this.mainContent.showLoading(loading);
                this.mainContent.showEmptyState(!loading && items.length === 0);
            }
        });
        this._unsubscribers.push(unsubStore);
        
        // 监听窗口resize
        this._onWindowResize = () => this.handleWindowResize();
        window.addEventListener('resize', this._onWindowResize);
    }
    
    async loadInitialData() {
        try {
            // 显示加载状态
            this.showLoading(true);

            // 先加载系统 Project Type（让左侧导航实时反映系统配置）
            await this.loadProjectTypes();
            
            // 加载当前视图的数据
            // If URL points to client-projects, seed customer filter before the initial fetch.
            if (this.currentView === 'client-projects' && this._initialUrlCustomer) {
                this.store.dispatch('filters/setFilters', {
                    status: [],
                    company: null,
                    fiscal_year: null,
                    date_from: null,
                    date_to: null,
                    search: '',
                    advanced_rules: [],
                    advanced_groups: [],
                    customer: this._initialUrlCustomer,
                });
                this._clientProjects = { customer: this._initialUrlCustomer, customer_name: this._initialUrlCustomer };
            }
            await this.loadViewData(this.currentView);
            
            this.showLoading(false);
        } catch (error) {
            console.error('Failed to load initial data:', error);
            frappe.show_alert({
                message: __('Failed to load data'),
                indicator: 'red'
            });
            this.showLoading(false);
        }
    }
    
    async loadViewData(viewType) {
        // Dashboard uses its own lightweight API (avoid loading all Projects)
        if (viewType === 'dashboard') {
            await this.store.dispatch('dashboard/fetchMyProjects');
            return;
        }
        // Clients uses its own module/state
        if (viewType === 'clients') {
            await this.store.dispatch('clients/fetchClients', { search: '', limit: 200 });
            return;
        }
        // Client Projects: a cross-project-type view, still backed by Projects module
        if (viewType === 'client-projects') {
            const stateFilters = this.store?.getState?.()?.filters || {};
            const merged = { ...stateFilters };
            // Keep payload minimal; this view is read-only.
            merged.fields = ['name', 'project_name', 'customer', 'project_type', 'status', 'modified'];
            await this.store.dispatch('projects/fetchProjects', merged);
            return;
        }
        // 从store加载数据：合并 filters（含 advanced filter rules/groups + search）
        const projectTypeValues = new Set(this.projectTypes.map(t => t.value));

        // v2: board view 默认仍按 project_type 过滤（Saved View.filters 只是“默认配置来源”，不会阻塞删除 Project Type）
        const base = projectTypeValues.has(viewType) ? { project_type: viewType } : {};

        const stateFilters = this.store?.getState?.()?.filters || {};
        // base 覆盖 stateFilters 里的 project_type（避免旧视图残留）
        const merged = { ...stateFilters, ...base };

        // PERF (SaaS-ready):
        // Derive Project query fields from the current Saved View (visible columns).
        // This prevents pulling a giant payload for every board, and scales much better.
        if (this.isBoardView(viewType)) {
            try {
                const fallbackCols = (DEFAULT_COLUMNS[viewType] || DEFAULT_COLUMNS['DEFAULT'] || []).map((c) => ({ field: c.field, label: c.label }));
                const view = await ViewService.getOrCreateDefaultView(viewType, {
                    fallbackTitle: `${viewType} Board`,
                    fallbackColumns: fallbackCols
                });

                const parseColumns = (raw) => {
                    if (!raw) return [];
                    let v = raw;
                    if (typeof v === 'string') {
                        try { v = JSON.parse(v); } catch (e) { v = null; }
                    }
                    if (Array.isArray(v)) return v;
                    if (v && typeof v === 'object') {
                        return Array.isArray(v.project) ? v.project : (Array.isArray(v.projectColumns) ? v.projectColumns : []);
                    }
                    return [];
                };

                const cols = parseColumns(view?.columns);
                // Base fields are always fetched even if not visible in Columns Manager.
                // IMPORTANT: `custom_fiscal_year` is required for Task Monthly Status interactions
                // (cells need a fiscal year to call setMonthlyStatus), so never omit it.
                const baseFields = [
                    'name',
                    'project_name',
                    'customer',
                    'project_type',
                    'status',
                    'company',
                    'is_active',
                    'modified',
                    'custom_fiscal_year',
                ];
                const fields = new Set(baseFields);
                for (const c of (cols || [])) {
                    const f = String(c?.field || '').trim();
                    if (!f) continue;
                    // Skip virtual/computed columns
                    if (f.startsWith('__sb_')) continue;
                    // Derived column: team:<Role> needs custom_team_members
                    if (f.startsWith('team:')) {
                        fields.add('custom_team_members');
                        continue;
                    }
                    fields.add(f);
                }
                merged.fields = Array.from(fields);
            } catch (e) {
                // Fail-safe: if Saved View fetch fails, fall back to legacy behavior.
            }
        }

        await this.store.dispatch('projects/fetchProjects', merged);
    }

    isBoardView(viewType) {
        return isBoardViewFn(viewType, this.projectTypes);
    }

    async loadProjectTypes() {
        const names = await ProjectTypeService.fetchProjectTypes();
        this.projectTypes = names.map((name) => ({
            value: name,
            label: name,
            icon: PROJECT_TYPE_ICONS[name] || DEFAULT_PROJECT_TYPE_ICON
        }));

        // 如果系统里有 Project Type：仅当 currentView 不是产品页且不是合法 board 时，才切到第一个
        if (
            this.projectTypes.length &&
            !isProductView(this.currentView) &&
            !this.projectTypes.find(t => t.value === this.currentView)
        ) {
            this.currentView = this.projectTypes[0].value;
        }

        // 刷新 Sidebar + Header 标题
        this.sidebar?.setProjectTypes(this.projectTypes);
        this.sidebar?.updateView(this.currentView);
        this.header?.updateView(this.currentView);
        this.mainContent?.updateView(this.currentView);
    }
    
    handleViewChange(viewType) {
        console.log('View changed to:', viewType);
        // Leaving a client-scoped view: clear the transient customer filter so it doesn't "stick" everywhere.
        // This matches user expectation: customer filter added from Clients navigation should not persist when switching boards/pages.
        if (this._scopedCustomer) {
            try {
                const st = this.store?.getState?.()?.filters || {};
                this.store?.dispatch?.('filters/setFilters', { ...st, customer: null });
            } catch (e) {}
            this._scopedCustomer = '';
            this._clientProjects = null;
        }
        this.currentView = viewType;
        
        // 更新各组件状态
        this.header.updateView(viewType);
        this.mainContent.updateView(viewType);
        
        // 加载新视图的数据：Boards（Project Type）/ Dashboard / Clients / Client Projects
        if (this.isBoardView(viewType) || viewType === 'dashboard' || viewType === 'clients' || viewType === 'client-projects') {
            this.loadViewData(viewType);
        }

        try { this._syncUrl?.(); } catch (e) {}
    }
    
    handleHeaderAction(action, data) {
        console.log('Header action:', action, data);
        return handleHeaderAction(this, action, data);
    }
    
    handleProjectClick(project) {
        console.log('Project clicked:', project);
        return openProject(project.name);
    }

    /**
     * Website shell helper: open a Project's Updates modal by name.
     * Used by in-app notifications (bell).
     */
    async openProjectUpdatesByName(projectName) {
        const name = String(projectName || '').trim();
        if (!name) return;

        const state = this.store?.getState?.() || {};
        const list = state?.projects?.items || [];
        let project = (list || []).find((p) => p?.name === name) || null;

        // If not in current list (different board / filtered out), fetch minimal doc to determine project_type.
        if (!project) {
            try {
                const r = await frappe.call({
                    method: 'frappe.client.get',
                    args: { doctype: 'Project', name }
                });
                project = r?.message || null;
            } catch (e) {
                return;
            }
        }

        const pt = String(project?.project_type || '').trim();
        if (pt && this.currentView !== pt) {
            // Switch view + load its data so BoardTable has the row model ready.
            this.currentView = pt;
            this.header?.updateView?.(pt);
            this.mainContent?.updateView?.(pt);
            try { await this.loadViewData(pt); } catch (e) {}
        }

        // Re-resolve from store after load
        const nextState = this.store?.getState?.() || {};
        const nextList = nextState?.projects?.items || [];
        const resolved = (nextList || []).find((p) => p?.name === name) || project;
        try { this.mainContent?.boardTable?.openUpdates?.(resolved); } catch (e) {}
    }
    
    // handleStoreUpdate 已废弃：交给 BoardTable 自己订阅 store 并更新行
    
    handleWindowResize() {
        // 处理窗口大小变化
        if (this.mainContent) {
            this.mainContent.handleResize();
        }
    }
    
    createNewProject() {
        // Desk: keep native ERPNext behavior (open form)
        if (isDesk()) return createProject(this.currentView);
        // Website shell: enable modal flow (minimal required fields).
        return this.mainContent?.createNewProject?.();
    }
    
    applyFilters(filters) {
        this.store.dispatch('filters/setFilters', filters);
        this.loadViewData(this.currentView);
        try { this._syncUrl?.(); } catch (e) {}
    }
    
    performSearch(searchTerm) {
        this.store.dispatch('filters/setSearch', searchTerm);
        this.loadViewData(this.currentView);
        try { this._syncUrl?.(); } catch (e) {}
    }

    goBackToClients() {
        this.currentView = 'clients';
        this.header?.updateView?.(this.currentView);
        this.mainContent?.updateView?.(this.currentView);
        this.sidebar?.updateView?.(this.currentView);
        try { this._syncUrl?.(); } catch (e) {}
        // Clients view fetch
        return this.loadViewData(this.currentView);
    }
    
    showColumnManager() {
        // Delegate to BoardTable (only meaningful for board views)
        const table = this.mainContent?.boardTable;
        if (table?.openColumnManager) {
            return table.openColumnManager();
        }
        msgprint('Column Manager is not available in this view.');
    }

    setClientsSearch(q) {
        // Delegate to ClientsApp mounted inside MainContent
        return this.mainContent?.setClientsSearch?.(q);
    }

    showClientsColumnManager() {
        return this.mainContent?.openClientsColumnsManager?.();
    }

    openBoardForProject(project) {
        const pt = String(project?.project_type || '').trim();
        if (!pt) return;

        // Switch to the board view
        this.currentView = pt;
        this.header?.updateView?.(pt);
        this.mainContent?.updateView?.(pt);
        this.sidebar?.updateView?.(pt);

        // Keep the customer filter so the board is scoped to the same client (transient).
        const customer = String(project?.customer || '').trim();
        const stateFilters = this.store?.getState?.()?.filters || {};
        this.applyFilters({
            ...stateFilters,
            customer: customer || stateFilters.customer || '',
            search: '',
        });
        if (customer) this._scopedCustomer = customer;
    }

    /**
     * Navigate from Clients -> Projects (board) filtered by customer.
     * Strategy (MVP):
     * - Switch to the customer's most recent project_type (if any)
     * - Apply filters.customer and load that board
     */
    async openCustomerProjects(client) {
        const customer = String(client?.name || '').trim();
        if (!customer) return;
        // Navigate to a dedicated cross-project-type view
        this.currentView = 'client-projects';
        this._clientProjects = { customer, customer_name: client?.customer_name || customer };
        this.header?.updateView?.(this.currentView);
        this.mainContent?.updateView?.(this.currentView);
        this.sidebar?.updateView?.(this.currentView); // Sidebar will map highlight to Clients

        // Apply customer filter; do NOT set project_type so all project types are included
        this.applyFilters({
            status: [],
            company: null,
            fiscal_year: null,
            date_from: null,
            date_to: null,
            search: '',
            advanced_rules: [],
            advanced_groups: [],
            customer,
        });
        this._scopedCustomer = customer;

        try { this._syncUrl?.(); } catch (e) {}
    }

    _syncUrl() {
        const state = this.store?.getState?.() || {};
        const customer = String(state?.filters?.customer || this._clientProjects?.customer || '').trim();
        // Only keep `customer` in URL for client-projects view to avoid confusing sticky filters on other pages.
        setUrlState({ view: this.currentView, customer: (this.currentView === 'client-projects') ? (customer || '') : '' });
    }
    
    showLoading(show) {
        if (show) {
            this.container.classList.add('loading');
        } else {
            this.container.classList.remove('loading');
        }
    }
    
    destroy() {
        // 取消订阅 / 解绑全局事件（避免多次进入页面后越来越卡）
        try {
            this._unsubscribers.forEach((fn) => {
                try { fn && fn(); } catch (e) {}
            });
        } finally {
            this._unsubscribers = [];
        }

        if (this._onWindowResize) {
            window.removeEventListener('resize', this._onWindowResize);
            this._onWindowResize = null;
        }

        // 清理资源
        if (this.sidebar) this.sidebar.destroy();
        if (this.header) this.header.destroy();
        if (this.mainContent) this.mainContent.destroy();
    }
}

