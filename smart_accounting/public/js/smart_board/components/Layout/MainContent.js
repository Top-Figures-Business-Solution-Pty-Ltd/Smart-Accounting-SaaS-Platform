/**
 * Smart Board - Main Content Component
 * 主内容区域组件
 */

import { BoardTable } from '../BoardView/BoardTable.js';
import { isPlaceholderView, renderPlaceholderHTML } from './placeholderPages.js';
import { ClientsApp } from '../ClientsView/ClientsApp.js';
import { ClientProjectsApp } from '../ClientsView/ClientProjectsApp.js';
import { SettingsApp } from '../SettingsView/SettingsApp.js';

export class MainContent {
    constructor(container, options = {}) {
        this.container = container;
        this.options = options;
        this.currentView = options.currentView || 'ITR';
        this.store = options.store;
        this.isBoardView = options.isBoardView || (() => false);
        this.onProjectClick = options.onProjectClick || (() => {});
        this._unsub = null;
        this._clientsApp = null;
        this._clientProjectsApp = null;
        this._settingsApp = null;
        
        this.render();

        // Keep placeholder pages (Dashboard / Clients / Settings) reactive to store updates
        if (this.store?.subscribe) {
            this._unsub = this.store.subscribe(() => {
                if (isPlaceholderView(this.currentView)) {
                    const placeholder = this.container.querySelector('#pagePlaceholder');
                    if (placeholder && placeholder.style.display !== 'none') {
                        placeholder.innerHTML = renderPlaceholderHTML(this.currentView, this.store);
                    }
                }
            });
        }
    }
    
    render() {
        this.container.innerHTML = `
            <div class="main-content-wrapper">
                <!-- Board Table Container -->
                <div class="board-table-container" id="boardTableContainer"></div>

                <!-- Placeholder Pages (Dashboard / Clients / Settings) -->
                <div class="page-placeholder" id="pagePlaceholder" style="display: none;"></div>
                
                <!-- Empty State -->
                <div class="empty-state" id="emptyState" style="display: none;">
                    <div class="empty-state-content">
                        <div class="empty-state-icon">📋</div>
                        <h3>No projects found</h3>
                        <p>Create your first project to get started</p>
                        <button class="btn btn-primary" id="btnCreateFirst">
                            Create Project
                        </button>
                    </div>
                </div>
                
                <!-- Loading State -->
                <div class="loading-state" id="loadingState" style="display: none;">
                    <div class="spinner"></div>
                    <p>Loading projects...</p>
                </div>
            </div>
        `;
        
        // 初始化BoardTable
        this.initBoardTable();
        
        // 绑定事件
        this.bindEvents();
    }
    
    initBoardTable() {
        const container = this.container.querySelector('#boardTableContainer');
        if (!container) return;
        
        this.boardTable = new BoardTable(container, {
            viewType: this.currentView,
            store: this.store,
            isBoardView: (viewType) => this.isBoardView(viewType),
            onRowClick: (project) => this.onProjectClick(project)
        });
    }
    
    bindEvents() {
        // Empty state按钮
        const btnCreateFirst = this.container.querySelector('#btnCreateFirst');
        if (btnCreateFirst) {
            btnCreateFirst.addEventListener('click', () => {
                this.createNewProject();
            });
        }
    }
    
    updateView(view) {
        this.currentView = view;

        // Non-board views should not show the projects table
        if (view === 'clients' || view === 'client-projects' || isPlaceholderView(view)) {
            this.showPlaceholder(view);
            return;
        }

        this.hidePlaceholder();

        if (this.boardTable) this.boardTable.updateView(view);
    }
    
    showLoading(show) {
        const loadingState = this.container.querySelector('#loadingState');
        const boardTableContainer = this.container.querySelector('#boardTableContainer');
        const emptyState = this.container.querySelector('#emptyState');
        const placeholder = this.container.querySelector('#pagePlaceholder');

        // When placeholder pages are active, ignore loading UI from projects store
        if (placeholder && placeholder.style.display !== 'none') {
            if (loadingState) loadingState.style.display = 'none';
            if (emptyState) emptyState.style.display = 'none';
            if (boardTableContainer) boardTableContainer.style.display = 'none';
            return;
        }
        
        if (show) {
            if (loadingState) loadingState.style.display = 'flex';
            if (boardTableContainer) boardTableContainer.style.display = 'none';
            if (emptyState) emptyState.style.display = 'none';
        } else {
            if (loadingState) loadingState.style.display = 'none';
            if (boardTableContainer) boardTableContainer.style.display = 'block';
        }
    }
    
    showEmptyState(show) {
        const emptyState = this.container.querySelector('#emptyState');
        const boardTableContainer = this.container.querySelector('#boardTableContainer');
        const placeholder = this.container.querySelector('#pagePlaceholder');

        // When placeholder pages are active, ignore empty UI from projects store
        if (placeholder && placeholder.style.display !== 'none') {
            if (emptyState) emptyState.style.display = 'none';
            if (boardTableContainer) boardTableContainer.style.display = 'none';
            return;
        }
        
        if (show) {
            if (emptyState) emptyState.style.display = 'flex';
            if (boardTableContainer) boardTableContainer.style.display = 'none';
        } else {
            if (emptyState) emptyState.style.display = 'none';
            if (boardTableContainer) boardTableContainer.style.display = 'block';
        }
    }
    
    createNewProject() {
        // Website shell: use website-safe modal flow
        import('../../controllers/newProjectController.js')
            .then(({ openNewProjectFlow }) => openNewProjectFlow({ app: this.options?.app, viewType: this.currentView }))
            .catch(() => {
                // Fallback: call app if available
                try { this.options?.app?.createNewProject?.(); } catch (e) {}
            });
    }

    hidePlaceholder() {
        const placeholder = this.container.querySelector('#pagePlaceholder');
        const boardTableContainer = this.container.querySelector('#boardTableContainer');
        if (placeholder) placeholder.style.display = 'none';
        if (boardTableContainer) boardTableContainer.style.display = 'block';
    }

    showPlaceholder(view) {
        const placeholder = this.container.querySelector('#pagePlaceholder');
        const boardTableContainer = this.container.querySelector('#boardTableContainer');
        const emptyState = this.container.querySelector('#emptyState');
        const loadingState = this.container.querySelector('#loadingState');

        if (boardTableContainer) boardTableContainer.style.display = 'none';
        if (emptyState) emptyState.style.display = 'none';
        if (loadingState) loadingState.style.display = 'none';
        if (!placeholder) return;

        placeholder.style.display = 'block';
        // Clients is now a real module, not a static placeholder.
        if (view === 'clients') {
            placeholder.innerHTML = `<div id="sbClientsMount"></div>`;
            const mount = placeholder.querySelector('#sbClientsMount');
            // Recreate app on each entry to keep lifecycle clean
            try { this._clientsApp?.destroy?.(); } catch (e) {}
            try { this._clientProjectsApp?.destroy?.(); } catch (e) {}
            this._clientProjectsApp = null;
            this._clientsApp = new ClientsApp(mount, {
                store: this.store,
                onOpenProjects: (client) => {
                    try { this.options?.app?.openCustomerProjects?.(client); } catch (e) {}
                }
            });
            this._clientsApp.init();
        } else if (view === 'client-projects') {
            placeholder.innerHTML = `<div id="sbClientProjectsMount"></div>`;
            const mount = placeholder.querySelector('#sbClientProjectsMount');
            try { this._clientsApp?.destroy?.(); } catch (e) {}
            this._clientsApp = null;
            try { this._clientProjectsApp?.destroy?.(); } catch (e) {}
            this._clientProjectsApp = new ClientProjectsApp(mount, {
                store: this.store,
                onOpenBoard: (project) => {
                    try { this.options?.app?.openBoardForProject?.(project); } catch (e) {}
                }
            });
            this._clientProjectsApp.init();
        } else if (view === 'settings') {
            placeholder.innerHTML = `<div id="sbSettingsMount"></div>`;
            const mount = placeholder.querySelector('#sbSettingsMount');
            try { this._clientsApp?.destroy?.(); } catch (e) {}
            this._clientsApp = null;
            try { this._clientProjectsApp?.destroy?.(); } catch (e) {}
            this._clientProjectsApp = null;
            try { this._settingsApp?.destroy?.(); } catch (e) {}
            this._settingsApp = new SettingsApp(mount);
            this._settingsApp.init();
        } else {
            // Dashboard / Settings placeholders remain static-html based for now
            try { this._clientsApp?.destroy?.(); } catch (e) {}
            this._clientsApp = null;
            try { this._clientProjectsApp?.destroy?.(); } catch (e) {}
            this._clientProjectsApp = null;
            try { this._settingsApp?.destroy?.(); } catch (e) {}
            this._settingsApp = null;
            placeholder.innerHTML = renderPlaceholderHTML(view, this.store);
        }
    }

    setClientsSearch(q) {
        try { return this._clientsApp?.search?.(q); } catch (e) {}
    }

    openClientsColumnsManager() {
        try { return this._clientsApp?.openColumnsManager?.(); } catch (e) {}
    }
    
    handleResize() {
        if (this.boardTable) {
            this.boardTable.handleResize();
        }
    }
    
    destroy() {
        if (this.boardTable) {
            this.boardTable.destroy();
        }
        try { this._clientsApp?.destroy?.(); } catch (e) {}
        this._clientsApp = null;
        try { this._clientProjectsApp?.destroy?.(); } catch (e) {}
        this._clientProjectsApp = null;
        try { this._settingsApp?.destroy?.(); } catch (e) {}
        this._settingsApp = null;
        try { this._unsub?.(); } catch (e) {}
        this._unsub = null;
        this.container.innerHTML = '';
    }
}

