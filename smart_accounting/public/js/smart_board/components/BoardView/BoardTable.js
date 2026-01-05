/**
 * Smart Board - Board Table Component
 * 类Monday.com的表格视图组件
 */

import { BoardRow } from './BoardRow.js';
import { DEFAULT_COLUMNS } from '../../utils/constants.js';

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
        
        this.render();
        this.subscribeToStore();
    }
    
    getColumnsForView() {
        return DEFAULT_COLUMNS[this.viewType] || DEFAULT_COLUMNS['DEFAULT'];
    }
    
    render() {
        this.container.innerHTML = `
            <div class="board-table-wrapper">
                <!-- Table Header -->
                <div class="board-table-header">
                    <table class="board-table">
                        <thead>
                            <tr>
                                ${this.renderHeaderCells()}
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
    
    renderHeaderCells() {
        return this.columns.map(col => `
            <th 
                class="board-table-cell ${col.frozen ? 'frozen' : ''}"
                style="width: ${col.width}px;"
                data-field="${col.field}"
            >
                <div class="cell-content">
                    <span class="cell-label">${col.label}</span>
                    ${col.sortable !== false ? '<span class="sort-icon"></span>' : ''}
                </div>
                <div class="resize-handle"></div>
            </th>
        `).join('');
    }
    
    renderRows() {
        if (!this.projects || this.projects.length === 0) {
            return '<tr><td colspan="100"><div class="no-data">No projects found</div></td></tr>';
        }
        
        return this.projects.map((project, index) => {
            return this.renderRow(project, index);
        }).join('');
    }
    
    renderRow(project, index) {
        const row = new BoardRow(project, {
            columns: this.columns,
            index: index,
            onClick: () => this.handleRowClick(project)
        });
        
        this.rows.push(row);
        return row.getHTML();
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
    }
    
    initResizable() {
        // 实现列宽调整功能
        const resizeHandles = this.container.querySelectorAll('.resize-handle');
        
        resizeHandles.forEach(handle => {
            let startX, startWidth, th;
            
            handle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                th = handle.closest('th');
                startX = e.clientX;
                startWidth = th.offsetWidth;
                
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
            
            const onMouseMove = (e) => {
                if (!th) return;
                const diff = e.clientX - startX;
                th.style.width = `${startWidth + diff}px`;
            };
            
            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                
                // 保存列宽到localStorage
                this.saveColumnWidths();
            };
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
            this.updateRows();
        });
    }
    
    updateRows() {
        const tbody = this.container.querySelector('#tableBody');
        if (!tbody) return;
        
        // 清空现有行
        this.rows = [];
        tbody.innerHTML = this.renderRows();
    }
    
    updateView(viewType) {
        this.viewType = viewType;
        this.columns = this.getColumnsForView();
        this.render();
    }
    
    saveColumnWidths() {
        // 保存列宽到localStorage
        const widths = {};
        const headers = this.container.querySelectorAll('th[data-field]');
        
        headers.forEach(th => {
            widths[th.dataset.field] = th.offsetWidth;
        });
        
        localStorage.setItem(
            `column_widths_${this.viewType}`,
            JSON.stringify(widths)
        );
    }
    
    loadColumnWidths() {
        // 从localStorage加载列宽
        const saved = localStorage.getItem(`column_widths_${this.viewType}`);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error('Failed to parse saved column widths:', e);
            }
        }
        return null;
    }
    
    handleResize() {
        // 处理窗口大小变化
        // TODO: 实现虚拟滚动或其他性能优化
    }
    
    destroy() {
        if (this._unsubscribe) {
            try { this._unsubscribe(); } catch (e) {}
            this._unsubscribe = null;
        }
        this.rows.forEach(row => row.destroy && row.destroy());
        this.rows = [];
        this.container.innerHTML = '';
    }
}

