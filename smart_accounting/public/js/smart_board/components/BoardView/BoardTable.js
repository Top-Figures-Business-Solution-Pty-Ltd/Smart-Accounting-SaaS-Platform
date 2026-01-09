/**
 * Smart Board - Board Table Component
 * 类Monday.com的表格视图组件
 */

import { DEFAULT_COLUMNS, PROJECT_COLUMN_CATALOG } from '../../utils/constants.js';
import { renderHeaderCells, renderRows } from './boardTableRender.js';
import { initResizable } from './boardTableResize.js';
import { loadColumnWidths, saveColumnWidths } from './boardTableStorage.js';
import { shouldVirtualize, computeWindow, spacerRow } from './boardTableVirtualization.js';
import { ViewService } from '../../services/viewService.js';
import { ColumnManagerModal } from './ColumnManagerModal.js';
import { TeamRoleService } from '../../services/teamRoleService.js';
import { EditingManager } from './boardTableEditingManager.js';

export class BoardTable {
    constructor(container, options = {}) {
        this.container = container;
        this.options = options;
        this.viewType = options.viewType || 'ITR';
        this.store = options.store;
        this.isBoardView = options.isBoardView || (() => false);
        this.onRowClick = options.onRowClick || (() => {});
        this._unsubscribe = null;
        
        this.projects = [];
        this.columns = this.getColumnsForView();
        this.rows = [];
        this._savedView = null; // Saved View doc (team shared default)
        this._colMgr = null;
        this._teamRoles = null;
        this._openingColMgr = false;
        this._editing = null;

        // Virtualization / performance
        this._raf = null;
        this._onScroll = null;
        this._onBodyHScroll = null;
        this._syncingHScroll = false;
        this._rowHeight = 44; // fallback, will be refined after first render
        this._virtualThreshold = options.virtualThreshold || 200;
        this._overscan = options.overscan || 6;
        
        this.render();
        this.subscribeToStore();

        // Load shared default columns (Saved View) after first paint to keep UI responsive
        this.refreshColumnsFromSavedView();
    }
    
    getColumnsForView() {
        const base = (DEFAULT_COLUMNS[this.viewType] || DEFAULT_COLUMNS['DEFAULT']).map(c => ({ ...c }));
        const widths = loadColumnWidths(this.viewType) || {};
        base.forEach(col => {
            if (widths[col.field]) col.width = widths[col.field];
        });
        return base;
    }

    getAvailableColumnDefs() {
        // Available columns = global Project column catalog (not tied to project_type)
        const base = (PROJECT_COLUMN_CATALOG || []).map(c => ({ ...c }));

        // Derived role-based team columns: team:<Role>
        const roles = this._teamRoles || TeamRoleService.peekRoles() || [];
        const derived = roles.map((role) => ({
            field: `team:${role}`,
            // UI label: show role name directly (no "team" prefix)
            label: `${role}`,
            width: 180
        }));

        return base.concat(derived);
    }

    getDefaultColumnConfigForView() {
        // Default columns for initial Saved View creation (keep existing behavior)
        return (DEFAULT_COLUMNS[this.viewType] || DEFAULT_COLUMNS['DEFAULT'] || []).map(c => ({ ...c }));
    }

    _normalizeSavedColumns(raw) {
        // Saved View.columns could be a JSON string or an array.
        if (!raw) return [];
        if (Array.isArray(raw)) return raw;
        if (typeof raw === 'string') {
            try {
                const parsed = JSON.parse(raw);
                return Array.isArray(parsed) ? parsed : [];
            } catch (e) {
                return [];
            }
        }
        return [];
    }

    buildColumnsFromConfig(columnsConfig) {
        const widths = loadColumnWidths(this.viewType) || {};
        const defs = this.getAvailableColumnDefs();
        const map = new Map(defs.map(d => [d.field, d]));

        const cols = (columnsConfig || [])
            .map((c) => {
                const field = c?.field;
                if (!field) return null;
                const def = map.get(field);
                const base = def ? { ...def } : { field, label: field, width: 150 };
                if (c.label) base.label = c.label;
                if (widths[base.field]) base.width = widths[base.field];
                return base;
            })
            .filter(Boolean);

        // Ensure at least one column exists
        if (cols.length === 0) return this.getColumnsForView();
        return cols;
    }

    async refreshColumnsFromSavedView() {
        if (!this.viewType) return;
        // Only operate on real board views (system Project Type values)
        if (!this.isBoardView(this.viewType)) return;

        // Warm roles cache (cached) so derived columns have correct labels
        try {
            this._teamRoles = await TeamRoleService.getRoles();
        } catch (e) {}

        const fallbackCols = this.getDefaultColumnConfigForView().map(c => ({ field: c.field, label: c.label }));
        const view = await ViewService.getOrCreateDefaultView(this.viewType, {
            fallbackTitle: `${this.viewType} Board`,
            fallbackColumns: fallbackCols
        });

        if (!view) return;
        this._savedView = view;

        const cfg = this._normalizeSavedColumns(view.columns);
        if (!cfg || cfg.length === 0) return;

        this.columns = this.buildColumnsFromConfig(cfg);
        this.render();
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
                    // If user is clicking inside an editor, ignore row click.
                    if (e.target?.closest?.('.sb-inline-editor')) return;
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

        // Horizontal scroll sync (body drives, header follows)
        this.bindHorizontalScrollSync();
    }

    bindHorizontalScrollSync() {
        const header = this.container.querySelector('.board-table-header');
        const body = this.container.querySelector('#boardTableBody');
        if (!header || !body) return;

        // Remove existing listener to avoid leaks on re-render
        if (this._onBodyHScroll) {
            body.removeEventListener('scroll', this._onBodyHScroll);
            this._onBodyHScroll = null;
        }

        this._onBodyHScroll = () => {
            if (this._syncingHScroll) return;
            // If no horizontal overflow, do nothing
            const left = body.scrollLeft || 0;
            // Schedule in rAF to avoid layout thrash on fast scroll
            requestAnimationFrame(() => {
                this._syncingHScroll = true;
                header.scrollLeft = left;
                this._syncingHScroll = false;
            });
        };

        // Passive for perf
        body.addEventListener('scroll', this._onBodyHScroll, { passive: true });
        // Initial sync
        header.scrollLeft = body.scrollLeft || 0;
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
            // Requirement: click elsewhere saves; scrolling is a "leave cell" action too.
            // Commit and close to avoid editor being destroyed by virtualization rerender.
            if (this._editing?.isEditing?.()) {
                this._editing.commitAndClose?.('scroll');
            }
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
        // 实现单元格行内编辑（click -> edit）
        const tbody = this.container.querySelector('#tableBody');
        if (!tbody) return;

        if (!this._editing) {
            this._editing = new EditingManager({
                rootEl: this.container,
                store: this.store,
                getProjectByName: (name) => (this.projects || []).find((p) => p.name === name) || null
            });
        }
        this._editing.bindToTbody(tbody);
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
        // Do not rerender rows while editing; it would destroy the editor DOM.
        // EditingManager will commit+close on scroll/outside click.
        if (this._editing?.isEditing?.()) return;
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
            // Precompute team role map once per row for derived columns
            (this.projects || []).forEach((p) => this._prepareProjectDerivedCaches(p));
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
        slice.forEach((p) => this._prepareProjectDerivedCaches(p));
        const rowsHtml = renderRows(slice, this.columns, (p) => this.handleRowClick(p), this.rows);
        tbody.innerHTML = spacerRow(topPad) + rowsHtml + spacerRow(bottomPad);
        this._maybeUpdateRowHeight();
    }

    _prepareProjectDerivedCaches(project) {
        if (!project) return;
        const team = project.custom_team_members;

        // Use reference equality as a cheap invalidation
        if (project.__sb_team_ref === team && project.__sb_team_by_role) return;

        const byRole = {};
        if (Array.isArray(team)) {
            for (const m of team) {
                const role = (m?.role || 'Preparer');
                if (!byRole[role]) byRole[role] = [];
                byRole[role].push(m);
            }
        }
        project.__sb_team_ref = team;
        project.__sb_team_by_role = byRole;
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
        this.columns = this.getColumnsForView(); // immediate fallback
        this.render();
        this.refreshColumnsFromSavedView();
    }

    openColumnManager() {
        if (!this.isBoardView(this.viewType)) {
            alert('Columns 只在 Boards（Project Type）里可用。');
            return;
        }
        if (this._openingColMgr) return;
        this._openingColMgr = true;

        TeamRoleService.getRoles()
            .then((roles) => {
                this._teamRoles = roles || [];
                this._openingColMgr = false;
                this._openColumnManagerImpl();
            })
            .catch(() => {
                this._openingColMgr = false;
                this._openColumnManagerImpl();
            });
    }

    _openColumnManagerImpl() {
        const defs = this.getAvailableColumnDefs();
        const currentOrder = (this._normalizeSavedColumns(this._savedView?.columns) || [])
            .map(c => c?.field)
            .filter(Boolean);

        const currentSet = new Set((currentOrder.length ? currentOrder : this.columns.map(c => c.field)));

        const baseOrder = currentOrder.length ? currentOrder : this.columns.map(c => c.field);
        const rest = defs.map(d => d.field).filter(f => !baseOrder.includes(f));
        const allOrder = baseOrder.concat(rest);

        const byField = new Map(defs.map(d => [d.field, d]));
        const list = allOrder.map((field) => {
            const def = byField.get(field) || { field, label: field };
            return {
                field,
                label: def.label || field,
                enabled: currentSet.has(field),
            };
        });

        this._colMgr?.close?.();
        this._colMgr = new ColumnManagerModal({
            title: `Columns · ${this.viewType}`,
            columns: list,
            onSave: async (enabledList) => {
                const config = enabledList.map(c => ({ field: c.field, label: c.label }));

                const fallbackCols = this.getDefaultColumnConfigForView().map(c => ({ field: c.field, label: c.label }));
                const view = await ViewService.getOrCreateDefaultView(this.viewType, {
                    fallbackTitle: `${this.viewType} Board`,
                    fallbackColumns: fallbackCols
                });

                if (view?.name) {
                    await ViewService.updateView(view.name, { columns: config });
                    this._savedView = { ...view, columns: config };
                }

                this.columns = this.buildColumnsFromConfig(config);
                this.render();
            },
            onClose: () => {}
        });
        this._colMgr.open();
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
        if (body && this._onBodyHScroll) {
            body.removeEventListener('scroll', this._onBodyHScroll);
            this._onBodyHScroll = null;
        }

        if (this._unsubscribe) {
            try { this._unsubscribe(); } catch (e) {}
            this._unsubscribe = null;
        }
        this._editing?.destroy?.();
        this._editing = null;
        this._colMgr?.close?.();
        this._colMgr = null;
        this.rows.forEach(row => row.destroy && row.destroy());
        this.rows = [];
        this.container.innerHTML = '';
    }
}

