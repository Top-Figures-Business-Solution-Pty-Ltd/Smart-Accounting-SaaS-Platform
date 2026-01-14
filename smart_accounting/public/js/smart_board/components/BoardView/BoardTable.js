/**
 * Smart Board - Board Table Component
 * 类Monday.com的表格视图组件
 */

import { DEFAULT_COLUMNS, PROJECT_COLUMN_CATALOG } from '../../utils/constants.js';
import { renderColGroup, renderHeaderCells, renderRows } from './boardTableRender.js';
import { initResizable } from './boardTableResize.js';
import { loadColumnWidths, saveColumnWidths } from './boardTableStorage.js';
import { shouldVirtualize, computeWindow, spacerRow } from './boardTableVirtualization.js';
import { ViewService } from '../../services/viewService.js';
import { ColumnsManagerModal } from './ColumnsManagerModal.js';
import { TeamRoleService } from '../../services/teamRoleService.js';
import { EditingManager } from './boardTableEditingManager.js';
import { columnRegistry } from '../../columns/registry.js';
import { UpdatesModal } from './UpdatesModal.js';
import { buildRowModel } from './rowModel.js';
import { ProjectService } from '../../services/projectService.js';
import { confirmDialog, notify } from '../../services/uiAdapter.js';
import { escapeHtml } from '../../utils/dom.js';

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
        this._bulkWorking = false;
        this._onBulkBarClick = null;

        // Bulk selection (system column)
        this._selected = new Set(); // project.name
        this._projectByName = new Map();
        this._rowModel = buildRowModel([]);
        this._groupBy = null; // reserved for future group-by

        // Expand -> Tasks
        this._expanded = new Set(); // project.name
        this._taskCounts = new Map(); // project.name -> count
        this._tasksByProject = new Map(); // project.name -> tasks[]
        this._tasksLoading = new Set(); // project.name
        // Monthly Status (matrix + summary) caches
        this._msStartMonth = null; // 1-12 (board-level)
        this._msStartMonthCounts = {};
        this._msStartMonthByProject = {};
        this._msSummaryByProject = new Map(); // project.name -> { month_index: {done,total,percent} }
        this._msMatrixByTask = new Map(); // task.name -> { month_index: status }
        this._msLoadedProjects = new Set();
        this._msLoadingProjects = new Set();
        this._msLastFetchAt = 0;
        this._taskCols = [
            { field: 'subject', label: 'Task', width: 320 },
            { field: 'status', label: 'Status', width: 140 },
            { field: 'exp_end_date', label: 'Due', width: 140 },
            { field: 'priority', label: 'Priority', width: 120 },
        ];

        // Editing finished hook: while editing we freeze row rerenders; once done we schedule a safe refresh.
        this._onEditFinished = () => this.scheduleRowsUpdate();
        this.container?.addEventListener?.('sb:edit-finished', this._onEditFinished);

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

    getAvailableColumnDefs(includeHidden = true) {
        // Available columns = global Project column catalog (not tied to project_type)
        // includeHidden:
        // - true: include defs that are not shown in Columns Manager (for Saved View compatibility)
        // - false: exclude hidden defs from selection UI
        const base = (PROJECT_COLUMN_CATALOG || [])
            .filter((c) => includeHidden ? true : !c?.hidden)
            .map(c => ({ ...c }));

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

    _monthName(i) {
        const names = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        const idx = Number(i) - 1;
        return names[idx] || '';
    }

    _getBoardMonthLabels() {
        // Board-level month order (scheme 1): derived from primary year_end (mode across projects)
        const start = Number(this._msStartMonth || 7); // fallback July
        const out = [];
        for (let k = 0; k < 12; k++) {
            const m = ((start - 1 + k) % 12) + 1;
            out.push(this._monthName(m));
        }
        return out;
    }

    _hasProjectMonthlyCompletion() {
        return !!(this.columns || []).find((c) => c?.field === '__sb_project_monthly_completion');
    }

    _hasTaskMonthlyStatus() {
        return !!(this._taskCols || []).find((c) => c?.field === '__sb_task_monthly_status');
    }

    _expandProjectColumnsForRender(columns) {
        const cols = Array.isArray(columns) ? columns : [];
        const labels = this._getBoardMonthLabels();
        const expanded = [];
        for (const c of cols) {
            if (c?.field === '__sb_project_monthly_completion') {
                for (let mi = 1; mi <= 12; mi++) {
                    expanded.push({
                        field: `__sb_pc_m${String(mi).padStart(2, '0')}`,
                        label: labels[mi - 1] || `M${mi}`,
                        width: 110,
                        sortable: false,
                        __msKind: 'project_completion',
                        __monthIndex: mi
                    });
                }
                continue;
            }
            expanded.push(c);
        }
        return expanded;
    }

    _expandTaskColumnsForRender(columns) {
        const cols = Array.isArray(columns) ? columns : [];
        const labels = this._getBoardMonthLabels();
        const expanded = [];
        for (const c of cols) {
            if (c?.field === '__sb_task_monthly_status') {
                for (let mi = 1; mi <= 12; mi++) {
                    expanded.push({
                        field: `__sb_ts_m${String(mi).padStart(2, '0')}`,
                        label: labels[mi - 1] || `M${mi}`,
                        width: 110,
                        __msKind: 'task_status',
                        __monthIndex: mi
                    });
                }
                continue;
            }
            expanded.push(c);
        }
        return expanded;
    }

    async _ensureMonthlyBundle(projectNames, { includeTasks = false } = {}) {
        const names = Array.isArray(projectNames) ? projectNames.filter(Boolean) : [];
        const missing = names.filter((n) => !this._msLoadedProjects.has(n) && !this._msLoadingProjects.has(n));
        if (!missing.length) return;

        missing.forEach((n) => this._msLoadingProjects.add(n));
        this.scheduleRowsUpdate();
        try {
            const taskFields = includeTasks
                ? (this._taskCols || [])
                    .map((c) => c?.field)
                    .filter((f) => f && !String(f).startsWith('__sb_ts_m') && f !== '__sb_task_monthly_status')
                : [];
            const bundle = await ProjectService.getMonthlyStatusBundle(missing, {
                includeTasks,
                includeMatrix: includeTasks,
                includeSummary: true,
                limitPerProject: 500,
                taskFields
            });
            const startMonth = Number(bundle?.start_month || 0) || null;
            const wasNull = !this._msStartMonth;
            if (startMonth && wasNull) {
                this._msStartMonth = startMonth;
                this._msStartMonthCounts = bundle?.start_month_counts || {};
                this._msStartMonthByProject = bundle?.start_month_by_project || {};
                // Month labels affect header; re-render once to apply correct month names.
                if (this._hasProjectMonthlyCompletion?.() || this._hasTaskMonthlyStatus?.()) {
                    this.render();
                }
            }

            // Summary -> annotate project objects for fast cell rendering
            const summary = bundle?.summary || {};
            for (const [p, months] of Object.entries(summary)) {
                this._msSummaryByProject.set(p, months || {});
                const proj = this._projectByName.get(p);
                if (proj) proj.__sb_monthly_completion = months || {};
            }

            // Tasks+Matrix (optional)
            if (includeTasks) {
                const tasks = bundle?.tasks || {};
                for (const [p, list] of Object.entries(tasks)) {
                    this._tasksByProject.set(p, Array.isArray(list) ? list : []);
                }
                const matrix = bundle?.matrix || {};
                for (const [t, m] of Object.entries(matrix)) {
                    const mm = {};
                    for (const [k, v] of Object.entries(m || {})) mm[Number(k)] = v;
                    this._msMatrixByTask.set(t, mm);
                }
            }

            missing.forEach((n) => this._msLoadedProjects.add(n));
            this._msLastFetchAt = Date.now();
        } catch (e) {
            console.error(e);
        } finally {
            missing.forEach((n) => this._msLoadingProjects.delete(n));
            this.scheduleRowsUpdate();
        }
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

    _normalizeSavedViewColumns(raw) {
        // Backward compat:
        // - legacy: columns = array (project columns)
        // - new: columns = { project: [...], tasks: [...] }
        if (!raw) return { project: [], tasks: [] };
        let v = raw;
        if (typeof v === 'string') {
            try { v = JSON.parse(v); } catch (e) { v = null; }
        }
        if (Array.isArray(v)) return { project: v, tasks: [] };
        if (v && typeof v === 'object') {
            const project = Array.isArray(v.project) ? v.project : (Array.isArray(v.projectColumns) ? v.projectColumns : []);
            const tasks = Array.isArray(v.tasks) ? v.tasks : (Array.isArray(v.taskColumns) ? v.taskColumns : []);
            return { project, tasks };
        }
        return { project: [], tasks: [] };
    }

    _setSavedViewColumnsInMemory(next) {
        if (!this._savedView) return;
        this._savedView = { ...this._savedView, columns: next };
    }

    buildColumnsFromConfig(columnsConfig) {
        const widths = loadColumnWidths(this.viewType) || {};
        // Include hidden defs so Saved View columns still render with proper labels.
        const defs = this.getAvailableColumnDefs(true);
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

        const both = this._normalizeSavedViewColumns(view.columns);
        const cfg = both.project || [];
        const taskCfg = both.tasks || [];
        if (Array.isArray(taskCfg) && taskCfg.length) {
            this._taskCols = taskCfg.map((c) => ({ field: c.field, label: c.label || c.field, width: c.width || 140 }));
        }
        if (!cfg || cfg.length === 0) return;

        this.columns = this.buildColumnsFromConfig(cfg);
        this.render();
    }
    
    render() {
        // Build render columns (inject system columns, compute sticky offsets, apply header classes)
        this._renderColumns = this.buildRenderColumns();
        const colWidth = (c) => {
            const n = Number(c?.width || 0);
            if (Number.isFinite(n) && n > 0) return n;
            if (c?.field === '__sb_select') return 52;
            return 140;
        };
        const tableWidth = (this._renderColumns || []).reduce((sum, c) => sum + colWidth(c), 0);
        this._tableWidthPx = tableWidth;

        this.container.innerHTML = `
            <div class="board-table-wrapper">
                <!-- Table Header -->
                <div class="board-table-header">
                    <table class="board-table" style="width:${tableWidth}px">
                        ${renderColGroup(this._renderColumns)}
                        <thead>
                            <tr>
                                ${renderHeaderCells(this._renderColumns)}
                            </tr>
                        </thead>
                    </table>
                </div>
                
                <!-- Table Body (Scrollable) -->
                <div class="board-table-body" id="boardTableBody">
                    <table class="board-table" style="width:${tableWidth}px">
                        ${renderColGroup(this._renderColumns)}
                        <tbody id="tableBody">
                            ${this.renderRows()}
                        </tbody>
                    </table>
                </div>
            </div>
            <div class="sb-bulkbar" id="sbBulkBar" style="display:none;">
              <div class="sb-bulkbar__inner">
                <div class="sb-bulkbar__left">
                  <span class="sb-bulkbar__count"><span id="sbBulkCount">0</span> selected</span>
                </div>
                <div class="sb-bulkbar__actions">
                  <button type="button" class="btn btn-default btn-sm" data-action="bulk-archive">Archive</button>
                  <button type="button" class="btn btn-danger btn-sm" data-action="bulk-delete">Delete</button>
                  <button type="button" class="btn btn-light btn-sm" data-action="bulk-clear">Clear</button>
                </div>
              </div>
            </div>
        `;
        
        this.bindEvents();
    }
    
    renderRows() {
        return renderRows(
            this._rowModel?.all?.() || this.projects,
            this._renderColumns || this.columns,
            (p) => this.handleRowClick(p),
            this.rows,
            {
                isSelected: (p) => this._selected?.has?.(p?.name),
                isExpanded: (p) => this._expanded?.has?.(p?.name),
                expandedRowHTML: (p, cols) => this._renderExpandedTasksRow(p, cols),
            }
        );
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
                const msCell = e.target?.closest?.('.sb-ms-cell');
                if (msCell) {
                    e.preventDefault();
                    e.stopPropagation();
                    this._openTaskMonthlyStatusMenu(msCell);
                    return;
                }
                const addTaskBtn = e.target?.closest?.('.sb-add-task-btn');
                if (addTaskBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    const projectName = addTaskBtn.dataset.projectName;
                    if (projectName) this._handleAddTask(projectName);
                    return;
                }
                const taskColsBtn = e.target?.closest?.('button[data-action="task-columns"]');
                if (taskColsBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.openTaskColumnManager();
                    return;
                }
                const expBtn = e.target?.closest?.('.sb-expand-btn');
                if (expBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    const projectName = expBtn.dataset.projectName;
                    if (projectName) this.toggleExpand(projectName);
                    return;
                }
                // Updates entrypoint (primary column)
                const updBtn = e.target?.closest?.('.sb-update-btn');
                if (updBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    const projectName = updBtn.dataset.projectName;
                    const project = this.projects.find(p => p.name === projectName);
                    if (project) {
                        this.openUpdates(project);
                    }
                    return;
                }
                const row = e.target.closest('tr');
                if (row && row.dataset.projectName) {
                    // If user is clicking inside an editor, ignore row click.
                    if (e.target?.closest?.('.sb-inline-editor')) return;
                    // If user is clicking an editable cell, it should enter edit, not open details.
                    if (e.target?.closest?.('td.editable')) return;
                    // Clicking selection checkbox should not trigger row open.
                    if (e.target?.closest?.('.sb-row-select') || e.target?.closest?.('.sb-select-col')) return;
                    const project = this.projects.find(p => p.name === row.dataset.projectName);
                    if (project) {
                        this.handleRowClick(project);
                    }
                }
            });
        }
        
        // 单元格编辑
        this.initCellEditing();

        // Bulk select events
        this.bindBulkSelect();
        this.bindBulkBar();

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
            onWidthChange: (field, width) => {
                // Keep in-memory columns config in sync so future renders keep the new width.
                const w = Number(width) || 0;
                if (!field || !w) return;

                const updateList = (list) => {
                    if (!Array.isArray(list)) return;
                    const col = list.find((c) => c?.field === field);
                    if (col) col.width = w;
                };

                updateList(this.columns);
                updateList(this._renderColumns);
            },
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
                getProjectByName: (name) => this._projectByName.get(name) || null,
                // Inline bulk sync: default apply to ALL editable fields unless explicitly opted-out by spec.bulkSync === false
                getSelectedProjectNames: () => Array.from(this._selected || []),
                bulkEditableFields: [],
            });
        }
        this._editing.bindToTbody(tbody);
    }

    buildRenderColumns() {
        // Inject system select column at the very left (not persisted in Saved View)
        const selectCol = {
            field: '__sb_select',
            label: '',
            width: 52,
            frozen: true,
            sortable: false
        };

        // Clone columns to avoid mutating Saved View config objects
        const base = (this.columns || []).map((c) => ({ ...c }));
        const expandedProjectCols = this._expandProjectColumnsForRender(base);
        const cols = [selectCol].concat(expandedProjectCols);

        // Primary column = first user-selected project column (like Monday's "Name" column)
        const primaryField = cols.find((c) => c?.field && c.field !== '__sb_select' && !String(c.field).startsWith('__sb_pc_m'))?.field || null;

        // Apply header class hooks + compute sticky left offsets for frozen columns
        let left = 0;
        for (const col of cols) {
            col.__isPrimary = !!(primaryField && col.field === primaryField);
            const baseHeaderClass = columnRegistry.getHeaderClass({ column: col }) || '';
            col.__headerClass = `${baseHeaderClass} ${col.__isPrimary ? 'sb-primary-col' : ''}`.trim();
            col.__cellClass = col.__isPrimary ? 'sb-primary-col' : '';
            if (col.frozen) {
                col._stickyLeft = left;
                left += Number(col.width || 0);
            } else {
                col._stickyLeft = null;
            }
        }
        return cols;
    }

    bindBulkSelect() {
        const headerCb = this.container.querySelector('.sb-select-all');
        const tbody = this.container.querySelector('#tableBody');

        if (headerCb) {
            headerCb.addEventListener('change', (e) => {
                const checked = !!e.target.checked;
                this._setAllSelected(checked);
                this.updateSelectAllCheckbox();
                this.updateBulkBar();
                this.scheduleRowsUpdate();
            });
        }

        if (tbody) {
            tbody.addEventListener('change', (e) => {
                const cb = e.target?.closest?.('.sb-row-select');
                if (!cb) return;
                const name = cb.dataset.projectName;
                if (!name) return;
                if (cb.checked) this._selected.add(name);
                else this._selected.delete(name);
                this.updateSelectAllCheckbox();
                this.updateBulkBar();
                // Update row highlight without full rerender
                const row = cb.closest('tr');
                if (row) row.classList.toggle('selected', cb.checked);
            });
        }

        // Initial state
        this.updateSelectAllCheckbox();
        this.updateBulkBar();
    }

    _setAllSelected(checked) {
        if (!checked) {
            this._selected.clear();
            return;
        }
        (this.projects || []).forEach((p) => {
            if (p?.name) this._selected.add(p.name);
        });
    }

    updateSelectAllCheckbox() {
        const headerCb = this.container.querySelector('.sb-select-all');
        if (!headerCb) return;
        const total = (this.projects || []).length;
        const selectedCount = (this.projects || []).reduce((acc, p) => acc + (this._selected.has(p?.name) ? 1 : 0), 0);
        headerCb.indeterminate = selectedCount > 0 && selectedCount < total;
        headerCb.checked = total > 0 && selectedCount === total;
    }

    updateBulkBar() {
        const bar = this.container.querySelector('#sbBulkBar');
        const countEl = this.container.querySelector('#sbBulkCount');
        if (!bar || !countEl) return;
        const n = this._selected?.size || 0;
        countEl.textContent = String(n);
        bar.style.display = n > 0 ? 'block' : 'none';

        // Disable buttons while a bulk action is running
        bar.querySelectorAll('button[data-action]')?.forEach?.((btn) => {
            btn.disabled = !!this._bulkWorking;
        });
    }

    bindBulkBar() {
        const bar = this.container.querySelector('#sbBulkBar');
        if (!bar) return;

        if (this._onBulkBarClick) {
            bar.removeEventListener('click', this._onBulkBarClick);
            this._onBulkBarClick = null;
        }

        this._onBulkBarClick = (e) => {
            const btn = e.target?.closest?.('button[data-action]');
            const action = btn?.dataset?.action;
            if (!action) return;
            e.preventDefault();
            e.stopPropagation();
            this._handleBulkAction(action);
        };
        bar.addEventListener('click', this._onBulkBarClick);
        this.updateBulkBar();
    }

    _getSelectedNames() {
        return Array.from(this._selected || []).filter(Boolean);
    }

    _clearSelection() {
        this._selected.clear();
        this.updateSelectAllCheckbox();
        this.updateBulkBar();
        this.scheduleRowsUpdate();
    }

    async _handleBulkAction(action) {
        if (this._bulkWorking) return;
        const names = this._getSelectedNames();
        if (!names.length) return;

        if (action === 'bulk-clear') {
            this._clearSelection();
            return;
        }

        if (action === 'bulk-archive') {
            const ok = await confirmDialog(`Archive ${names.length} projects? (Set is_active = No)`);
            if (!ok) return;
            await this._bulkUpdateField({ field: 'is_active', value: 'No', removeFromListIfFiltered: true });
            return;
        }

        if (action === 'bulk-delete') {
            const ok = await confirmDialog(`Delete ${names.length} projects? This cannot be undone.`);
            if (!ok) return;
            await this._bulkDelete();
            return;
        }
    }

    async _bulkUpdateField({ field, value, removeFromListIfFiltered } = {}) {
        const names = this._getSelectedNames();
        if (!names.length) return;
        this._bulkWorking = true;
        this.updateBulkBar();
        try {
            // Update backend
            for (const name of names) {
                await ProjectService.updateProject(name, { [field]: value });
            }

            // Update store/UI immediately
            const isActiveFiltered = this.store?.getState?.()?.filters?.is_active !== false;
            for (const name of names) {
                if (field === 'is_active' && removeFromListIfFiltered && isActiveFiltered && String(value) !== 'Yes') {
                    this.store?.commit?.('projects/removeProject', name);
                } else {
                    this.store?.commit?.('projects/updateProject', { name, [field]: value });
                }
            }

            // Keep selection for now (user may want more actions). If rows were removed, clear selection.
            if (field === 'is_active' && removeFromListIfFiltered && this.store?.getState?.()?.filters?.is_active !== false && String(value) !== 'Yes') {
                this._clearSelection();
            } else {
                this.scheduleRowsUpdate();
            }
        } catch (e) {
            console.error(e);
            notify('Bulk update failed', 'red');
        } finally {
            this._bulkWorking = false;
            this.updateBulkBar();
        }
    }

    async _bulkDelete() {
        const names = this._getSelectedNames();
        if (!names.length) return;
        this._bulkWorking = true;
        this.updateBulkBar();
        try {
            for (const name of names) {
                await ProjectService.deleteProject(name);
                this.store?.commit?.('projects/removeProject', name);
            }
            this._clearSelection();
        } catch (e) {
            console.error(e);
            notify('Bulk delete failed', 'red');
        } finally {
            this._bulkWorking = false;
            this.updateBulkBar();
        }
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

    openUpdates(project) {
        // Step 7: website-safe modal placeholder (no persistence yet)
        this._updatesModal?.close?.();
        this._updatesModal = new UpdatesModal({
            project,
            onClose: () => { this._updatesModal = null; }
        });
        this._updatesModal.open();
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
            // Fast lookup map for editors & actions
            this._projectByName = new Map((this.projects || []).map((p) => [p?.name, p]));
            // Row model (future group-by extension point)
            this._rowModel = buildRowModel(this.projects || [], { groupBy: this._groupBy });
            // Task counts are used to render expand toggles (async best-effort).
            this._prefetchTaskCounts?.();
            // Monthly completion needs summary data; load in the background (batched).
            if (this._hasProjectMonthlyCompletion?.() && (this.projects || []).length) {
                const names = (this._rowModel?.all?.() || this.projects || []).map((p) => p?.name).filter(Boolean).slice(0, 300);
                this._ensureMonthlyBundle?.(names, { includeTasks: false });
            }
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
        // Expanded rows break fixed row height assumptions; disable virtualization while expanded.
        if (this._expanded && this._expanded.size > 0) return false;
        const total = this._rowModel?.count?.() ?? (this.projects || []).length;
        return shouldVirtualize(total, this._virtualThreshold);
    }

    updateRows() {
        const tbody = this.container.querySelector('#tableBody');
        if (!tbody) return;

        // Clear row instances (only for visible rows in virtual mode)
        this.rows = [];

        if (!this.isVirtual()) {
            // If project monthly completion is enabled, prefetch summary for all rows (small table => acceptable)
            if (this._hasProjectMonthlyCompletion?.()) {
                const names = (this._rowModel?.all?.() || this.projects || []).map((p) => p?.name).filter(Boolean);
                this._ensureMonthlyBundle(names, { includeTasks: false });
            }
            // Precompute team role map once per row for derived columns
            (this._rowModel?.all?.() || this.projects || []).forEach((p) => this._prepareProjectDerivedCaches(p));
            tbody.innerHTML = this.renderRows();
            this.updateSelectAllCheckbox();
            this.updateBulkBar();
            this._maybeUpdateRowHeight();
            return;
        }

        const viewport = this.container.querySelector('#boardTableBody');
        const viewportHeight = viewport?.clientHeight || 600;
        const scrollTop = viewport?.scrollTop || 0;
        const total = this._rowModel?.count?.() ?? (this.projects || []).length;

        const { start, end, topPad, bottomPad } = computeWindow({
            scrollTop,
            viewportHeight,
            rowHeight: this._rowHeight,
            total,
            overscan: this._overscan
        });

        const slice = this._rowModel?.slice?.(start, end) || this.projects.slice(start, end);
        // In virtual mode, prefetch monthly completion only for visible rows (perf)
        if (this._hasProjectMonthlyCompletion?.()) {
            const names = (slice || []).map((p) => p?.name).filter(Boolean);
            this._ensureMonthlyBundle(names, { includeTasks: false });
        }
        slice.forEach((p) => this._prepareProjectDerivedCaches(p));
        const rowsHtml = renderRows(
            slice,
            this._renderColumns || this.columns,
            (p) => this.handleRowClick(p),
            this.rows,
            {
                isSelected: (p) => this._selected?.has?.(p?.name),
                isExpanded: (p) => this._expanded?.has?.(p?.name),
                expandedRowHTML: (p, cols) => this._renderExpandedTasksRow(p, cols),
            }
        );
        tbody.innerHTML = spacerRow(topPad) + rowsHtml + spacerRow(bottomPad);
        this.updateSelectAllCheckbox();
        this.updateBulkBar();
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

    async _prefetchTaskCounts() {
        const names = (this.projects || []).map((p) => p?.name).filter(Boolean);
        const missing = names.filter((n) => !this._taskCounts.has(n));
        if (!missing.length) {
            // still keep expanded flag in sync for rendering
            for (const p of (this.projects || [])) {
                if (!p?.name) continue;
                p.__sb_expanded = this._expanded.has(p.name);
            }
            return;
        }
        try {
            const counts = await ProjectService.getTaskCounts(missing);
            for (const n of missing) {
                const c = Number(counts?.[n] || 0);
                this._taskCounts.set(n, c);
            }
            // annotate project objects (used by BoardRow)
            for (const p of (this.projects || [])) {
                if (!p?.name) continue;
                const c = this._taskCounts.get(p.name);
                if (c != null) p.__sb_task_count = c;
                p.__sb_expanded = this._expanded.has(p.name);
            }
        } catch (e) {
            // ignore
        } finally {
            this.scheduleRowsUpdate();
        }
    }

    async ensureTasksLoaded(projectName) {
        if (!projectName) return;
        if (this._tasksByProject.has(projectName)) return;
        if (this._tasksLoading.has(projectName)) return;
        this._tasksLoading.add(projectName);
        this.scheduleRowsUpdate();
        try {
            const fields = this._taskCols.map((c) => c.field);
            const map = await ProjectService.getTasksForProjects([projectName], fields, 200);
            const tasks = map?.[projectName] || [];
            this._tasksByProject.set(projectName, tasks);
        } finally {
            this._tasksLoading.delete(projectName);
            this.scheduleRowsUpdate();
        }
    }

    async toggleExpand(projectName) {
        if (this._expanded.has(projectName)) {
            this._expanded.delete(projectName);
        } else {
            this._expanded.add(projectName);
            // If monthly component is enabled, load tasks+matrix+summary in one request for best perf.
            if (this._hasTaskMonthlyStatus() || this._hasProjectMonthlyCompletion()) {
                await this._ensureMonthlyBundle([projectName], { includeTasks: this._hasTaskMonthlyStatus() });
            }
            await this.ensureTasksLoaded(projectName);
        }
        const p = this._projectByName.get(projectName);
        if (p) p.__sb_expanded = this._expanded.has(projectName);
        this.scheduleRowsUpdate();
    }

    _renderExpandedTasksRow(project, columns) {
        const cols = Array.isArray(columns) ? columns : [];
        const colspan = cols.length || 1;
        const name = project?.name || '';
        const loading = name && this._tasksLoading.has(name);
        const tasks = name ? (this._tasksByProject.get(name) || []) : [];
        const taskCols = this._expandTaskColumnsForRender((this._taskCols || []).slice());

        const head = `
          <div class="sb-task-head">
            <div class="sb-task-title">Tasks</div>
          </div>
        `;

        const table = (() => {
            const widths = taskCols.map((c) => Math.max(60, Number(c.width) || 120));
            const baseWidth = widths.reduce((a, b) => a + b, 0);

            // Fill remaining width so the expanded area doesn't look like a "small table in a huge blank area".
            // We do NOT stretch existing columns (would break your earlier requirement); instead add one trailing filler column.
            const leftPad = 12 + 52;  // matches CSS indent (12px + select col 52px)
            const rightPad = 12;
            const avail = Math.max(0, Number(this._tableWidthPx || 0) - leftPad - rightPad);
            const filler = Math.max(0, avail - baseWidth);
            const allWidths = filler > 0 ? widths.concat([filler]) : widths;

            const totalWidth = allWidths.reduce((a, b) => a + b, 0);
            const colgroup = `<colgroup>${allWidths.map((w) => `<col style="width:${w}px" />`).join('')}</colgroup>`;
            const ths = taskCols.map((c) => `<th>${escapeHtml(c.label || c.field)}</th>`).join('');
            const rows = [];

            if (loading) {
                const tds = taskCols.map((c, idx) => idx === 0
                    ? `<td><span class="sb-task-muted">Loading…</span></td>`
                    : `<td></td>`
                ).join('');
                rows.push(`<tr>${tds}${filler > 0 ? '<td></td>' : ''}</tr>`);
            } else if (tasks && tasks.length) {
                for (const t of tasks) {
                    const tn = String(t?.name || '').trim();
                    const tds = taskCols.map((c) => {
                        if (c?.__msKind === 'task_status') {
                            const mi = Number(c.__monthIndex || 0);
                            const st = (tn && this._msMatrixByTask.get(tn)) ? (this._msMatrixByTask.get(tn)[mi] || '') : '';
                            const slug = st ? String(st).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '';
                            const cls = st ? `sb-ms-cell sb-ms-cell--${slug}` : 'sb-ms-cell sb-ms-cell--empty';
                            const fy = escapeHtml(project?.custom_fiscal_year || project?.custom_fiscal_year?.name || '');
                            return `<td class="${cls}" data-task="${escapeHtml(tn)}" data-month-index="${mi}" data-fiscal-year="${fy}" data-project="${escapeHtml(name)}">${st ? escapeHtml(st) : ''}</td>`;
                        }
                        const v = t?.[c.field];
                        return `<td>${escapeHtml(v ?? '—')}</td>`;
                    }).join('');
                    rows.push(`<tr>${tds}${filler > 0 ? '<td></td>' : ''}</tr>`);
                }
            } else {
                const tds = taskCols.map((c, idx) => idx === 0
                    ? `<td><span class="sb-task-muted">No tasks yet</span></td>`
                    : `<td></td>`
                ).join('');
                rows.push(`<tr>${tds}${filler > 0 ? '<td></td>' : ''}</tr>`);
            }

            // Always show an add row (Monday-like)
            const addTds = taskCols.map((c, idx) => {
                if (idx === 0) {
                    return `<td>
                      <button type="button" class="sb-add-task-btn" data-project-name="${escapeHtml(name)}">＋ Add New Task</button>
                    </td>`;
                }
                return `<td></td>`;
            }).join('');
            rows.push(`<tr class="sb-task-add-row">${addTds}${filler > 0 ? '<td></td>' : ''}</tr>`);

            return `
              <div class="sb-task-grid">
                <table class="sb-task-table" style="width:${totalWidth}px">
                  ${colgroup}
                  <thead><tr>${ths}${filler > 0 ? '<th></th>' : ''}</tr></thead>
                  <tbody>${rows.join('')}</tbody>
                </table>
              </div>
            `;
        })();

        return `
          <tr class="sb-task-row" data-project-name="${escapeHtml(name)}">
            <td colspan="${colspan}">
              <div class="sb-task-wrap">
                ${head}
                ${table}
              </div>
            </td>
          </tr>
        `;
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
        // Exclude hidden defs from Columns Manager UI
        const defs = this.getAvailableColumnDefs(false);
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

        const taskData = this._buildTaskColumnManagerData();
        this._openUnifiedColumnsManager({
            initialTab: 'project',
            projectDefs: defs,
            projectList: list,
            projectByField: byField,
            taskDefs: taskData.defs,
            taskList: taskData.list,
            taskByField: taskData.byField,
        });
    }

    openTaskColumnManager() {
        if (!this.isBoardView(this.viewType)) return;

        const taskData = this._buildTaskColumnManagerData();
        this._openUnifiedColumnsManager({
            initialTab: 'tasks',
            taskDefs: taskData.defs,
            taskList: taskData.list,
            taskByField: taskData.byField,
        });
    }

    _buildTaskColumnManagerData() {
        const defs = [
            { field: 'subject', label: 'Task', width: 320 },
            { field: 'status', label: 'Status', width: 140 },
            { field: 'exp_end_date', label: 'Due', width: 140 },
            { field: 'priority', label: 'Priority', width: 120 },
            { field: 'exp_start_date', label: 'Start', width: 140 },
            { field: 'owner', label: 'Owner', width: 160 },
            { field: 'modified', label: 'Updated', width: 160 },
            // Component: expands to 12 months (board fiscal order)
            { field: '__sb_task_monthly_status', label: 'Monthly Task Status (12M)', width: 110 },
        ];

        const currentSet = new Set((this._taskCols || []).map((c) => c.field));
        const baseOrder = (this._taskCols || []).map((c) => c.field);
        const rest = defs.map((d) => d.field).filter((f) => !baseOrder.includes(f));
        const allOrder = baseOrder.concat(rest);
        const byField = new Map(defs.map((d) => [d.field, d]));
        const list = allOrder.map((field) => {
            const def = byField.get(field) || { field, label: field, width: 140 };
            return { field, label: def.label || field, enabled: currentSet.has(field) };
        });
        return { defs, byField, list };
    }

    _openUnifiedColumnsManager({ initialTab = 'project', projectList, projectByField, taskList, taskByField } = {}) {
        const projList = Array.isArray(projectList) ? projectList : [];
        const tList = Array.isArray(taskList) ? taskList : [];
        const byT = taskByField instanceof Map ? taskByField : new Map();

        this._colMgr?.close?.();
        this._colMgr = new ColumnsManagerModal({
            title: `Columns · ${this.viewType}`,
            activeKey: initialTab,
            sections: [
                {
                    key: 'project',
                    label: 'Project Columns',
                    hint: '默认在 Project Columns。勾选显示列，拖拽改变顺序（团队共享默认列）。',
                    columns: projList,
                },
                {
                    key: 'tasks',
                    label: 'Task Columns',
                    hint: 'Task Columns 仅影响展开后的 Tasks 子表。',
                    columns: tList,
                },
            ],
            onSave: async (out) => {
                const enabledProject = (out?.project || []);
                const enabledTasks = (out?.tasks || []);

                const config = enabledProject.map((c) => ({ field: c.field, label: c.label }));
                const nextTask = enabledTasks.map((c) => {
                    const d = byT.get(c.field) || { width: 140 };
                    return { field: c.field, label: c.label, width: d.width || 140 };
                });
                this._taskCols = nextTask;

                const fallbackCols = this.getDefaultColumnConfigForView().map((c) => ({ field: c.field, label: c.label }));
                const view = await ViewService.getOrCreateDefaultView(this.viewType, {
                    fallbackTitle: `${this.viewType} Board`,
                    fallbackColumns: fallbackCols
                });

                if (view?.name) {
                    const next = { project: config, tasks: nextTask };
                    await ViewService.updateView(view.name, { columns: next });
                    this._setSavedViewColumnsInMemory(next);
                }

                this.columns = this.buildColumnsFromConfig(config);
                this.render();
            },
            onClose: () => {}
        });
        this._colMgr.open();
    }

    async _handleAddTask(projectName) {
        const name = String(projectName || '').trim();
        if (!name) return;
        const ok = await confirmDialog(`Add a new task to ${name}?`);
        if (!ok) return;
        try {
            await ProjectService.createTask(name, { subject: 'New Task' });
            const next = Number(this._taskCounts.get(name) || 0) + 1;
            this._taskCounts.set(name, next);
            const p = this._projectByName.get(name);
            if (p) p.__sb_task_count = next;
            this._tasksByProject.delete(name);
            await this.ensureTasksLoaded(name);
            notify('Task created', 'green');
        } catch (e) {
            console.error(e);
            notify('Failed to create task', 'red');
        }
    }

    _openTaskMonthlyStatusMenu(cellEl) {
        const td = cellEl?.closest?.('td') || cellEl;
        if (!td) return;
        const taskName = td.dataset.task;
        const projectName = td.dataset.project;
        const fy = td.dataset.fiscalYear || '';
        const mi = Number(td.dataset.monthIndex || 0);
        if (!taskName || !fy || !mi) return;

        // Simple inline popover (website-safe)
        const existing = document.querySelector('.sb-ms-menu');
        if (existing) existing.remove();

        const menu = document.createElement('div');
        menu.className = 'sb-ms-menu';
        menu.innerHTML = `
          <button type="button" data-v="Not Started">Not Started</button>
          <button type="button" data-v="Working On It">Working On It</button>
          <button type="button" data-v="Stuck">Stuck</button>
          <button type="button" data-v="Done">Done</button>
        `;
        document.body.appendChild(menu);

        const r = td.getBoundingClientRect();
        menu.style.left = `${Math.round(r.left + window.scrollX)}px`;
        menu.style.top = `${Math.round(r.bottom + window.scrollY + 6)}px`;

        const close = () => { try { menu.remove(); } catch (e) {} };
        const onDoc = (ev) => {
            if (ev.target?.closest?.('.sb-ms-menu')) return;
            close();
            document.removeEventListener('mousedown', onDoc);
        };
        document.addEventListener('mousedown', onDoc);

        menu.addEventListener('click', async (ev) => {
            const btn = ev.target?.closest?.('button[data-v]');
            if (!btn) return;
            const v = btn.dataset.v;
            close();
            try {
                await ProjectService.setMonthlyStatus({
                    referenceDoctype: 'Task',
                    referenceName: taskName,
                    fiscalYear: fy,
                    monthIndex: mi,
                    status: v
                });
                // Update local cache
                const cur = this._msMatrixByTask.get(taskName) || {};
                cur[mi] = v;
                this._msMatrixByTask.set(taskName, cur);

                // Recompute summary for that project (only for this month)
                const proj = projectName ? this._projectByName.get(projectName) : null;
                const tasks = projectName ? (this._tasksByProject.get(projectName) || []) : [];
                const total = tasks.length;
                let done = 0;
                for (const t of tasks) {
                    const tn = String(t?.name || '').trim();
                    if (!tn) continue;
                    if ((this._msMatrixByTask.get(tn) || {})[mi] === 'Done') done += 1;
                }
                const percent = total ? (done / total * 100) : 0;
                const months = (proj?.__sb_monthly_completion) || (projectName ? (this._msSummaryByProject.get(projectName) || {}) : {});
                months[mi] = { done, total, percent };
                if (projectName) this._msSummaryByProject.set(projectName, months);
                if (proj) proj.__sb_monthly_completion = months;

                this.scheduleRowsUpdate();
            } catch (e) {
                console.error(e);
                notify('Failed to update monthly status', 'red');
            }
        });
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
        if (this._onEditFinished) {
            try { this.container?.removeEventListener?.('sb:edit-finished', this._onEditFinished); } catch (e) {}
            this._onEditFinished = null;
        }
        this._updatesModal?.close?.();
        this._updatesModal = null;
        this._colMgr?.close?.();
        this._colMgr = null;
        this.rows.forEach(row => row.destroy && row.destroy());
        this.rows = [];
        this.container.innerHTML = '';
    }
}

