/**
 * Smart Board - Sidebar Component
 * 左侧导航栏组件
 */

export class Sidebar {
    constructor(container, options = {}) {
        this.container = container;
        this.options = options;
        this.projectTypes = options.projectTypes || [];
        this.currentView = options.currentView || 'ITR';
        this.onViewChange = options.onViewChange || (() => {});
        this.onBoardMenuAction = options.onBoardMenuAction || (() => {});
        this._onContainerClick = null;
        this._openBoardMenuFor = '';
        
        this.render();
        this.bindEvents();
    }
    
    render() {
        this.container.innerHTML = `
            <div class="sidebar-wrapper">
                <!-- Navigation -->
                <nav class="sidebar-nav">
                    <!-- Home -->
                    <div class="nav-section">
                        <a href="#" class="nav-item" data-view="dashboard">
                            <span class="nav-icon">🏠</span>
                            <span class="nav-label">Home</span>
                        </a>
                        <a href="#" class="nav-item" data-view="report">
                            <span class="nav-icon">📊</span>
                            <span class="nav-label">Report</span>
                        </a>
                    </div>
                    
                    <!-- Divider -->
                    <div class="nav-divider"></div>
                    
                    <!-- Project Types -->
                    <div class="nav-section">
                        <div class="nav-section-title sb-boards-title">
                            <span>Boards</span>
                            <button type="button" class="sb-boards-settings" id="sbBoardsSettings" title="Board settings">⚙️</button>
                        </div>
                        ${this.renderProjectTypes()}
                    </div>
                    
                    <!-- Divider -->
                    <div class="nav-divider"></div>
                    
                    <!-- Other Pages -->
                    <div class="nav-section">
                        <a href="#" class="nav-item" data-view="clients">
                            <span class="nav-icon">👥</span>
                            <span class="nav-label">Clients</span>
                        </a>
                        <a href="#" class="nav-item" data-view="archived-clients">
                            <span class="nav-icon">🗃️</span>
                            <span class="nav-label">Archived Clients</span>
                        </a>
                        <a href="#" class="nav-item" data-view="automation-logs">
                            <span class="nav-icon">🤖</span>
                            <span class="nav-label">Automation Logs</span>
                        </a>
                        <a href="#" class="nav-item" data-view="settings">
                            <span class="nav-icon">⚙️</span>
                            <span class="nav-label">Settings</span>
                        </a>
                    </div>
                </nav>
            </div>
        `;
        
        // 高亮当前视图
        this.highlightCurrentView();
    }
    
    renderProjectTypes() {
        if (!this.projectTypes || this.projectTypes.length === 0) {
            return `
                <div class="nav-empty">
                    <div class="text-muted" style="padding: 8px 20px; font-size: 13px;">
                        No Project Types yet
                    </div>
                    <a href="#" class="nav-item" data-view="__create_project_type__">
                        <span class="nav-icon">➕</span>
                        <span class="nav-label">Create Project Type</span>
                    </a>
                </div>
            `;
        }

        const dynamicRows = this.projectTypes.map(type => `
            <div class="sb-board-item ${this._openBoardMenuFor === type.value ? 'is-open' : ''}" data-board-item="${type.value}">
                <a href="#" class="nav-item" data-view="${type.value}">
                    <span class="nav-icon">${type.icon}</span>
                    <span class="nav-label">${type.label}</span>
                </a>
                <button type="button" class="sb-board-item__more" data-role="board-menu-trigger" data-view="${type.value}" aria-label="Board menu">⋯</button>
                <div class="sb-board-item__menu" data-role="board-menu" data-view="${type.value}">
                    <button type="button" data-role="board-menu-item" data-action="export_csv" data-view="${type.value}">
                        Export to Excel (CSV)
                    </button>
                </div>
            </div>
        `).join('');

        const archivedRow = `
            <div class="sb-board-item sb-board-item--archived" data-board-item="archived-projects">
                <a href="#" class="nav-item nav-item--archived" data-view="archived-projects">
                    <span class="nav-icon">🗄️</span>
                    <span class="nav-label">Archived Projects</span>
                </a>
            </div>
        `;

        return `${dynamicRows}${archivedRow}`;
    }
    
    bindEvents() {
        // 导航点击事件（事件委托）
        this._onContainerClick = (e) => {
            const settingsBtn = e.target?.closest?.('#sbBoardsSettings');
            if (settingsBtn) {
                e.preventDefault();
                e.stopPropagation();
                try { this.options?.onBoardSettings?.(); } catch (e2) {}
                return;
            }
            const boardMenuTrigger = e.target?.closest?.('[data-role="board-menu-trigger"]');
            if (boardMenuTrigger) {
                e.preventDefault();
                e.stopPropagation();
                const view = String(boardMenuTrigger.getAttribute('data-view') || '');
                const isSame = this._openBoardMenuFor === view;
                this._openBoardMenuFor = isSame ? '' : view;
                this.render();
                return;
            }
            const boardMenuItem = e.target?.closest?.('[data-role="board-menu-item"]');
            if (boardMenuItem) {
                e.preventDefault();
                e.stopPropagation();
                const action = String(boardMenuItem.getAttribute('data-action') || '');
                const view = String(boardMenuItem.getAttribute('data-view') || '');
                this._openBoardMenuFor = '';
                this.render();
                try { this.onBoardMenuAction(action, view); } catch (e2) {}
                return;
            }
            const navItem = e.target.closest('.nav-item');
            if (navItem) {
                e.preventDefault();
                const view = navItem.dataset.view;
                this._openBoardMenuFor = '';
                this.selectView(view);
                return;
            }
            this._openBoardMenuFor = '';
            this.render();
        };
        this.container.addEventListener('click', this._onContainerClick);
    }
    
    selectView(view) {
        const isReselect = view === this.currentView;
        
        // Special action: go to Project Type list
        if (view === '__create_project_type__') {
            // Lazy import to avoid circular deps and keep Sidebar lightweight
            import('../../services/navigationService.js').then(({ openProjectTypeList }) => openProjectTypeList());
            return;
        }

        if (!isReselect) {
            this.currentView = view;
            this.highlightCurrentView();
        }
        
        // 触发回调
        this.onViewChange(view, { reselect: isReselect });
    }
    
    highlightCurrentView() {
        // 移除所有active状态
        this.container.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const effectiveView = (this.currentView === 'client-projects') ? 'clients' : this.currentView;

        // 添加active到当前视图
        const currentItem = this.container.querySelector(
            `.nav-item[data-view="${effectiveView}"]`
        );
        if (currentItem) {
            currentItem.classList.add('active');
        }
    }
    
    updateView(view) {
        this.currentView = view;
        this.highlightCurrentView();
    }

    setProjectTypes(projectTypes) {
        this.projectTypes = projectTypes || [];
        this.render();
        // 事件是绑定在 container 上的（事件委托），render 后无需重复绑定
    }
    
    destroy() {
        if (this._onContainerClick) {
            this.container.removeEventListener('click', this._onContainerClick);
            this._onContainerClick = null;
        }
        this.container.innerHTML = '';
    }
}

