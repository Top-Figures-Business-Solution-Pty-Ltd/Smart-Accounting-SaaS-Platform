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
        this._onContainerClick = null;
        
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
                    </div>
                    
                    <!-- Divider -->
                    <div class="nav-divider"></div>
                    
                    <!-- Project Types -->
                    <div class="nav-section">
                        <div class="nav-section-title">Boards</div>
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

        return this.projectTypes.map(type => `
            <a href="#" class="nav-item" data-view="${type.value}">
                <span class="nav-icon">${type.icon}</span>
                <span class="nav-label">${type.label}</span>
            </a>
        `).join('');
    }
    
    bindEvents() {
        // 导航点击事件（事件委托）
        this._onContainerClick = (e) => {
            const navItem = e.target.closest('.nav-item');
            if (navItem) {
                e.preventDefault();
                const view = navItem.dataset.view;
                this.selectView(view);
            }
        };
        this.container.addEventListener('click', this._onContainerClick);
    }
    
    selectView(view) {
        if (view === this.currentView) return;
        
        // Special action: go to Project Type list
        if (view === '__create_project_type__') {
            // Lazy import to avoid circular deps and keep Sidebar lightweight
            import('../../services/navigationService.js').then(({ openProjectTypeList }) => openProjectTypeList());
            return;
        }

        this.currentView = view;
        this.highlightCurrentView();
        
        // 触发回调
        this.onViewChange(view);
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
    
    getUserName() {
        return frappe.session.user_fullname || frappe.session.user;
    }
    
    getUserInitial() {
        const name = this.getUserName();
        return name.charAt(0).toUpperCase();
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

