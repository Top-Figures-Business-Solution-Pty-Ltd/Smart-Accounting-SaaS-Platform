/**
 * Smart Board - Main Application
 * 主应用组件
 */

import { Sidebar } from './components/Layout/Sidebar.js';
import { Header } from './components/Layout/Header.js';
import { MainContent } from './components/Layout/MainContent.js';
import { PROJECT_TYPE_ICONS, DEFAULT_PROJECT_TYPE_ICON } from './utils/constants.js';
import { Store } from './store/store.js';
import { ProjectTypeService } from './services/projectTypeService.js';

export class SmartBoardApp {
    constructor(container) {
        this.container = container;
        this.store = new Store();
        this.currentView = 'ITR'; // 默认视图（若系统有 Project Type，会在 init 时替换为第一个）
        this.projectTypes = [];   // 运行时从系统获取
        this._unsubscribers = [];
        this._onWindowResize = null;
        
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
            onViewChange: (viewType) => this.handleViewChange(viewType)
        });
        
        // 初始化头部
        const headerContainer = this.container.querySelector('#smartBoardHeader');
        this.header = new Header(headerContainer, {
            currentView: this.currentView,
            onAction: (action, data) => this.handleHeaderAction(action, data)
        });
        
        // 初始化主内容区
        const contentContainer = this.container.querySelector('#smartBoardContent');
        this.mainContent = new MainContent(contentContainer, {
            currentView: this.currentView,
            store: this.store,
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
        // 从store加载数据
        const projectTypeValues = new Set(this.projectTypes.map(t => t.value));

        // 如果是系统存在的 project_type，则按类型过滤；否则默认拉全部（如 Dashboard 可用）
        const filters = projectTypeValues.has(viewType)
            ? { project_type: viewType }
            : {};

        await this.store.dispatch('projects/fetchProjects', filters);
    }

    async loadProjectTypes() {
        const names = await ProjectTypeService.fetchProjectTypes();
        this.projectTypes = names.map((name) => ({
            value: name,
            label: name,
            icon: PROJECT_TYPE_ICONS[name] || DEFAULT_PROJECT_TYPE_ICON
        }));

        // 如果系统里有 Project Type，就把默认视图切到第一个（避免写死 ITR）
        if (this.projectTypes.length && !this.projectTypes.find(t => t.value === this.currentView)) {
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
        this.currentView = viewType;
        
        // 更新各组件状态
        this.header.updateView(viewType);
        this.mainContent.updateView(viewType);
        
        // 加载新视图的数据
        this.loadViewData(viewType);
    }
    
    handleHeaderAction(action, data) {
        console.log('Header action:', action, data);
        
        switch (action) {
            case 'new_project':
                this.createNewProject();
                break;
            case 'filter':
                this.applyFilters(data);
                break;
            case 'search':
                this.performSearch(data);
                break;
            case 'manage_columns':
                this.showColumnManager();
                break;
            default:
                console.warn('Unknown action:', action);
        }
    }
    
    handleProjectClick(project) {
        console.log('Project clicked:', project);
        // 打开详情面板或导航到Project表单
        frappe.set_route('Form', 'Project', project.name);
    }
    
    // handleStoreUpdate 已废弃：交给 BoardTable 自己订阅 store 并更新行
    
    handleWindowResize() {
        // 处理窗口大小变化
        if (this.mainContent) {
            this.mainContent.handleResize();
        }
    }
    
    createNewProject() {
        // 创建新Project
        frappe.new_doc('Project', {
            project_type: this.currentView
        });
    }
    
    applyFilters(filters) {
        this.store.dispatch('filters/setFilters', filters);
        this.loadViewData(this.currentView);
    }
    
    performSearch(searchTerm) {
        this.store.dispatch('filters/setSearch', searchTerm);
        this.loadViewData(this.currentView);
    }
    
    showColumnManager() {
        // 显示列管理对话框
        frappe.msgprint('Column Manager - Coming soon!');
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

