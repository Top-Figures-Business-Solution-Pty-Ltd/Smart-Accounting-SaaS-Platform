/**
 * Smart Board - Board Table Component
 * 类Monday.com的表格视图组件
 */

import { DEFAULT_COLUMNS } from '../../utils/constants.js';
import { renderHeaderCells, renderRows } from './boardTableRender.js';
import { initResizable } from './boardTableResize.js';
import { loadColumnWidths, saveColumnWidths } from './boardTableStorage.js';
import { shouldVirtualize, computeWindow, spacerRow } from './boardTableVirtualization.js';

export class BoardTable {
    constructor(container, options = {}) {
        this.container = container;
        this.options = options;
        this.viewType = options.viewType || 'ITR';
        this.store = options.store;
        this.onRowClick = options.onRowClick || (() => {});
        this._unsubscribe = null;
        
        this.projects = [];
        this.columns = this.getColumnsForView();
        this.rows = [];

        // Virtualization / performance
        this._raf = null;
        this._onScroll = null;
        this._rowHeight = 44; // fallback, will be refined after first render
        this._virtualThreshold = options.virtualThreshold || 200;
        this._overscan = options.overscan || 6;
        
        this.render();
        this.subscribeToStore();
    }
    
    getColumnsForView() {
        const base = (DEFAULT_COLUMNS[this.viewType] || DEFAULT_COLUMNS['DEFAULT']).map(c => ({ ...c }));
        const widths = loadColumnWidths(this.viewType) || {};
        base.forEach(col => {
            if (widths[col.field]) col.width = widths[col.field];
        });
        return base;
    }
    
    render() {
        this.container.innerHTML = `
            <div class="board-table-wrapper">
                <!-- Table Header -->
                <div class="board-table-header">
                    <table class="board-table">
                        <thead>
                            <tr>
                                ${renderHeaderCells(this.columns)}
                            </tr>
                        </thead>
                    </table>
                </div>
                
                <!-- Table Body (Scrollable) -->
                <div class="board-table-body" id="boardTableBody">
                    <table class="board-table">
                        <tbody id="tableBody">
                            ${this.renderRows()}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        this.bindEvents();
    }
    
    renderRows() {
        return renderRows(this.projects, this.columns, (p) => this.handleRowClick(p), this.rows);
    }
    
    bindEvents() {
        // Header排序
        const headers = this.container.querySelectorAll('th[data-field]');
        headers.forEach(header => {
            header.addEventListener('click', (e) => {
                if (!e.target.closest('.resize-handle')) {
                    this.handleSort(header.dataset.field);
                }
            });
        });
        
        // 列宽调整
        this.initResizable();
        
        // 行点击
        const tbody = this.container.querySelector('#tableBody');
        if (tbody) {
            tbody.addEventListener('click', (e) => {
                const row = e.target.closest('tr');
                if (row && row.dataset.projectName) {
                    const project = this.projects.find(p => p.name === row.dataset.projectName);
                    if (project) {
                        this.handleRowClick(project);
                    }
                }
            });
        }
        
        // 单元格编辑
        this.initCellEditing();

        // Virtual scroll
        this.bindScroll();
    }
    
    bindScroll() {
        const body = this.container.querySelector('#boardTableBody');
        if (!body) return;

        if (this._onScroll) {
            body.removeEventListener('scroll', this._onScroll);
            this._onScroll = null;
        }

        this._onScroll = () => {
            if (!this.isVirtual()) return;
            this.scheduleRowsUpdate();
        };
        body.addEventListener('scroll', this._onScroll, { passive: true });
    }

    initResizable() {
        initResizable(this.container, {
            onWidthChangeDone: () => this.saveColumnWidths()
        });
    }
    
    initCellEditing() {
        // 实现单元格行内编辑
        const tbody = this.container.querySelector('#tableBody');
        if (!tbody) return;
        
        tbody.addEventListener('dblclick', (e) => {
            const cell = e.target.closest('td[data-field]');
            if (cell && cell.classList.contains('editable')) {
                this.editCell(cell);
            }
        });
    }
    
    editCell(cell) {
        const field = cell.dataset.field;
        const projectName = cell.closest('tr').dataset.projectName;
        const project = this.projects.find(p => p.name === projectName);
        
        if (!project) return;
        
        // 根据字段类型显示不同的编辑器
        // TODO: 实现各种字段类型的编辑器
        console.log('Edit cell:', field, project);
    }
    
    handleSort(field) {
        console.log('Sort by:', field);
        // TODO: 实现排序逻辑
    }
    
    handleRowClick(project) {
        console.log('Row clicked:', project);
        this.onRowClick(project);
    }
    
    subscribeToStore() {
        if (!this.store) return;
        
        // 订阅store的projects变化
        // 先确保不会重复订阅
        if (this._unsubscribe) {
            try { this._unsubscribe(); } catch (e) {}
            this._unsubscribe = null;
        }

        this._unsubscribe = this.store.subscribe((state) => {
            this.projects = state.projects.items || [];
            this.scheduleRowsUpdate();
        });
    }
    
    scheduleRowsUpdate() {
        if (this._raf) return;
        this._raf = requestAnimationFrame(() => {
            this._raf = null;
            this.updateRows();
        });
    }

    isVirtual() {
        return shouldVirtualize((this.projects || []).length, this._virtualThreshold);
    }

    updateRows() {
        const tbody = this.container.querySelector('#tableBody');
        if (!tbody) return;

        // Clear row instances (only for visible rows in virtual mode)
        this.rows = [];

        if (!this.isVirtual()) {
            tbody.innerHTML = this.renderRows();
            this._maybeUpdateRowHeight();
            return;
        }

        const viewport = this.container.querySelector('#boardTableBody');
        const viewportHeight = viewport?.clientHeight || 600;
        const scrollTop = viewport?.scrollTop || 0;
        const total = (this.projects || []).length;

        const { start, end, topPad, bottomPad } = computeWindow({
            scrollTop,
            viewportHeight,
            rowHeight: this._rowHeight,
            total,
            overscan: this._overscan
        });

        const slice = this.projects.slice(start, end);
        const rowsHtml = renderRows(slice, this.columns, (p) => this.handleRowClick(p), this.rows);
        tbody.innerHTML = spacerRow(topPad) + rowsHtml + spacerRow(bottomPad);
        this._maybeUpdateRowHeight();
    }

    _maybeUpdateRowHeight() {
        // Try to refine row height for virtualization accuracy
        try {
            const tbody = this.container.querySelector('#tableBody');
            const firstRow = tbody?.querySelector('tr.board-table-row');
            if (firstRow) {
                const h = firstRow.getBoundingClientRect().height;
                if (h && h > 10 && h < 200) this._rowHeight = h;
            }
        } catch (e) {}
    }
    
    updateView(viewType) {
        this.viewType = viewType;
        this.columns = this.getColumnsForView();
        this.render();
    }
    
    saveColumnWidths() {
        const widths = {};
        const headers = this.container.querySelectorAll('th[data-field]');
        
        headers.forEach(th => {
            widths[th.dataset.field] = th.offsetWidth;
        });

        saveColumnWidths(this.viewType, widths);
    }
    
    handleResize() {
        // 处理窗口大小变化
        // TODO: 实现虚拟滚动或其他性能优化
    }
    
    destroy() {
        if (this._raf) {
            cancelAnimationFrame(this._raf);
            this._raf = null;
        }

        const body = this.container.querySelector('#boardTableBody');
        if (body && this._onScroll) {
            body.removeEventListener('scroll', this._onScroll);
            this._onScroll = null;
        }

        if (this._unsubscribe) {
            try { this._unsubscribe(); } catch (e) {}
            this._unsubscribe = null;
        }
        this.rows.forEach(row => row.destroy && row.destroy());
        this.rows = [];
        this.container.innerHTML = '';
    }
}

