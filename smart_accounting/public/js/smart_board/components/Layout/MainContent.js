/**
 * Smart Board - Main Content Component
 * 主内容区域组件
 */

import { BoardTable } from '../BoardView/BoardTable.js';
import { isPlaceholderView, renderPlaceholderHTML } from './placeholderPages.js';

export class MainContent {
    constructor(container, options = {}) {
        this.container = container;
        this.options = options;
        this.currentView = options.currentView || 'ITR';
        this.store = options.store;
        this.isBoardView = options.isBoardView || (() => false);
        this.onProjectClick = options.onProjectClick || (() => {});
        
        this.render();
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
        if (isPlaceholderView(view)) {
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
        import('../../services/navigationService.js').then(({ createProject }) => createProject(this.currentView));
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
        placeholder.innerHTML = renderPlaceholderHTML(view, this.store);
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
        this.container.innerHTML = '';
    }
}

