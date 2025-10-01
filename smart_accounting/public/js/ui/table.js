// Project Management - Table Management
// Table rendering, column resizing, and inline editing logic

class TableManager {
    constructor() {
        this.utils = window.PMUtils;
        this.isResizing = false;
        this.currentColumn = null;
        this.startX = 0;
        this.startWidth = 0;
        this.columnWidths = this.getDefaultColumnWidths();
        this.saveTimeout = null;
        this.updateTimeout = null; // Prevent multiple simultaneous updates
        this.lastUpdateTime = 0; // Track last update to prevent rapid calls
    }

    // Column Resizing Functionality
    initializeColumnResizing() {
        // Load column widths and initialize after loading
        this.loadColumnWidthsAsync().then(() => {
            // Bind resize events after column widths are loaded
            this.bindResizeEvents();
        });
    }
    
    bindResizeEvents() {
        // Mouse events
        $(document).on('mousedown', '.pm-column-resizer', (e) => {
            e.preventDefault();
            this.startResize(e);
        });
        
        $(document).on('mousemove', (e) => {
            if (this.isResizing) {
                this.doResize(e);
            }
        });
        
        $(document).on('mouseup', () => {
            if (this.isResizing) {
                this.endResize();
            }
        });
        
        // Touch events for mobile support
        $(document).on('touchstart', '.pm-column-resizer', (e) => {
            e.preventDefault();
            const touch = e.originalEvent.touches[0];
            this.startResize({
                clientX: touch.clientX,
                target: e.target
            });
        });
        
        $(document).on('touchmove', (e) => {
            if (this.isResizing) {
                e.preventDefault();
                const touch = e.originalEvent.touches[0];
                this.doResize({
                    clientX: touch.clientX
                });
            }
        });
        
        $(document).on('touchend', () => {
            if (this.isResizing) {
                this.endResize();
            }
        });
        
        // Prevent text selection during resize
        $(document).on('selectstart', () => {
            if (this.isResizing) {
                return false;
            }
        });
        
        // Handle window resize with debouncing
        let resizeTimeout;
        $(window).on('resize', () => {
            if (!this.isResizing) {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(() => {
                    this.updateTableWidth();
                }, 250); // Debounce window resize events
            }
        });
        
        // Right-click context menu for column headers
        $(document).on('contextmenu', '.pm-header-cell', (e) => {
            e.preventDefault();
            this.showColumnContextMenu(e);
        });
    }
    
    startResize(e) {
        this.isResizing = true;
        this.currentColumn = $(e.target).closest('.pm-header-cell').data('column');
        this.startX = e.clientX;
        this.startWidth = $(e.target).closest('.pm-header-cell').outerWidth();
        
        // Add visual feedback
        $('.pm-table-container').addClass('resizing');
        $(e.target).addClass('resizing');
        
        // Prevent default behavior
        e.preventDefault();
    }
    
    doResize(e) {
        if (!this.isResizing || !this.currentColumn) return;
        
        const diff = e.clientX - this.startX;
        const newWidth = Math.max(50, this.startWidth + diff); // Minimum width of 50px
        
        // Apply new width to all cells in this column
        this.setColumnWidth(this.currentColumn, newWidth);
        
        // Add visual feedback
        this.showResizeGuide(e.clientX);
    }
    
    endResize() {
        if (!this.isResizing) return;
        
        // Save the new width - user's manual resize should always be respected
        if (this.currentColumn) {
            const newWidth = $(`.pm-header-cell[data-column="${this.currentColumn}"]`).outerWidth();
            this.columnWidths[this.currentColumn] = newWidth;
            
            // Update table width to match new column widths (table adapts to columns)
            this.updateTableWidth();
            
            // Save user's preference immediately
            this.saveColumnWidths();
        }
        
        // Clean up
        this.isResizing = false;
        this.currentColumn = null;
        $('.pm-table-container').removeClass('resizing');
        $('.pm-column-resizer').removeClass('resizing');
        this.hideResizeGuide();
    }
    
    showResizeGuide(clientX) {
        let guide = $('.pm-resize-guide');
        if (guide.length === 0) {
            guide = $('<div class="pm-resize-guide"></div>');
            $('body').append(guide);
        }
        
        const tableContainer = $('.pm-table-container');
        const containerRect = tableContainer[0].getBoundingClientRect();
        
        guide.css({
            left: clientX + 'px',
            top: containerRect.top + 'px',
            height: containerRect.height + 'px',
            display: 'block'
        });
    }
    
    hideResizeGuide() {
        $('.pm-resize-guide').hide();
    }
    
    setColumnWidth(column, width) {
        // Define specific minimum widths for different column types
        const columnMinWidths = {
            'action-person': 100,
            'preparer': 100,
            'reviewer': 100,
            'partner': 100
        };
        
        // Get the minimum width for this column type, fallback to 50px
        const specificMinWidth = columnMinWidths[column] || 50;
        const minWidth = Math.max(width, specificMinWidth);
        
        // Set width for header cells
        $(`.pm-header-cell[data-column="${column}"]`).css({
            'width': minWidth + 'px',
            'min-width': minWidth + 'px',
            'max-width': minWidth + 'px',
            'flex': `0 0 ${minWidth}px`
        });
        
        // Set width for corresponding data cells - map column names to CSS classes
        const columnClassMap = {
            'select': 'pm-cell-select',  // Fixed width column, not user-resizable
            'client': 'pm-cell-client',
            'task-name': 'pm-cell-task-name',
            'entity': 'pm-cell-entity',
            'tf-tg': 'pm-cell-tf-tg',
            'software': 'pm-cell-software',
            'status': 'pm-cell-status',
            'note': 'pm-cell-note',
            'target-month': 'pm-cell-target-month',
            'budget': 'pm-cell-budget',
            'actual': 'pm-cell-actual',
            'review-note': 'pm-cell-review-note',
            'action-person': 'pm-cell-action-person',
            'preparer': 'pm-cell-preparer',
            'reviewer': 'pm-cell-reviewer',
            'partner': 'pm-cell-partner',
            'lodgment-due': 'pm-cell-lodgment-due',
            'engagement': 'pm-cell-engagement',
            'group': 'pm-cell-group',
            'year-end': 'pm-cell-year-end',
            'last-updated': 'pm-cell-last-updated',
            'priority': 'pm-cell-priority',
            'frequency': 'pm-cell-frequency',
            'reset-date': 'pm-cell-reset-date'
        };
        
        const cellClass = `.${columnClassMap[column]}`;
        if (cellClass !== '.undefined') {
            // Special handling for select column - always fixed width
            if (column === 'select') {
                $(cellClass).css({
                    'width': '40px',
                    'min-width': '40px',
                    'max-width': '40px',
                    'flex': '0 0 40px'
                });
            } else {
                $(cellClass).css({
                    'width': minWidth + 'px',
                    'min-width': minWidth + 'px',
                    'max-width': minWidth + 'px',
                    'flex': `0 0 ${minWidth}px`
                });
            }
        }
        
        // Don't automatically update table width from setColumnWidth to prevent recursion
        // Table width will be updated by the calling function
    }
    
    applyColumnWidths() {
        // Apply widths to all columns
        Object.keys(this.columnWidths).forEach(column => {
            this.setColumnWidth(column, this.columnWidths[column]);
        });
        
        // Update total table width after applying all column widths
        this.updateTableWidth();
        
        // Force synchronization after applying widths
        this.forceColumnWidthSync();
    }
    
    // Force synchronization between header and content columns
    forceColumnWidthSync() {
        setTimeout(() => {
            $('.pm-header-cell').each((index, headerCell) => {
                const $headerCell = $(headerCell);
                const column = $headerCell.data('column');
                
                if (!column) return;
                
                const headerWidth = $headerCell.outerWidth();
                if (headerWidth && headerWidth > 0) {
                    // Apply the actual header width to content cells
                    $(`.pm-cell-${column}`).css({
                        'width': headerWidth + 'px',
                        'min-width': headerWidth + 'px',
                        'max-width': headerWidth + 'px',
                        'flex': 'none'
                    });
                }
            });
            
            // Force layout recalculation
            $('.pm-responsive-table, .pm-project-tasks').each(function() {
                this.style.display = 'none';
                this.offsetHeight; // Trigger reflow
                this.style.display = '';
            });
        }, 50);
    }
    
    loadColumnWidthsAsync() {
        // Load user-specific column widths from server (User Preferences DocType)
        return new Promise((resolve) => {
            frappe.call({
                method: 'smart_accounting.www.project_management.index.load_user_column_widths',
                callback: (r) => {
                    if (r.message && r.message.success) {
                        this.columnWidths = r.message.column_widths;
                        console.log('✅ Loaded user column widths for:', frappe.session.user, this.columnWidths);
                    } else {
                        // If server fails, try localStorage as fallback
                        const userKey = `pm-column-widths-${frappe.session.user}`;
                        const saved = localStorage.getItem(userKey);
                        if (saved) {
                            try {
                                this.columnWidths = JSON.parse(saved);
                                console.log('✅ Loaded from localStorage fallback:', this.columnWidths);
                            } catch (e) {
                                this.columnWidths = this.getDefaultColumnWidths();
                                console.log('❌ localStorage parse failed, using defaults');
                            }
                        } else {
                            this.columnWidths = this.getDefaultColumnWidths();
                            console.log('⚠️ No saved widths found, using defaults');
                        }
                    }
                    // Apply widths immediately after loading
                    this.applyColumnWidths();
                    resolve();
                }
            });
        });
    }
    
    // Keep old method for compatibility
    loadColumnWidths() {
        return this.loadColumnWidthsAsync();
    }
    
    getDefaultColumnWidths() {
        // Static default widths to avoid DOM queries during initialization
        return {
            'select': 40,
            'client': 150,
            'task-name': 200,
            'entity': 100,
            'tf-tg': 80,
            'software': 120,
            'status': 120,
            'note': 150,
            'target-month': 120,
            'budget': 100,
            'actual': 100,
            'review-note': 120,
            'action-person': 130,
            'preparer': 120,
            'reviewer': 120,
            'partner': 120,
            'lodgment-due': 130,
            'engagement': 120,
            'group': 100,
            'year-end': 100,
            'last-updated': 130,
            'priority': 100,
            'frequency': 120,
            'reset-date': 120
        };
    }
    
    // Get default width for a specific column (used for dynamic columns)
    getColumnDefaultWidth(columnName) {
        const defaults = this.getDefaultColumnWidths();
        return defaults[columnName] || 120; // Default 120px for unknown columns
    }
    
    saveColumnWidths() {
        // Save user-specific column widths with dual storage (server + localStorage)
        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => {
            // Save to localStorage immediately for instant fallback
            const userKey = `pm-column-widths-${frappe.session.user}`;
            try {
                localStorage.setItem(userKey, JSON.stringify(this.columnWidths));
                console.log('✅ Column widths saved to localStorage for user:', frappe.session.user);
            } catch (e) {
                console.warn('Failed to save to localStorage:', e);
            }
            
            // Also try to save to server
            frappe.call({
                method: 'smart_accounting.www.project_management.index.save_user_column_widths',
                args: {
                    column_widths: this.columnWidths
                },
                callback: (r) => {
                    if (r.message && r.message.success) {
                        console.log('✅ Column widths saved to server for user:', frappe.session.user);
                    } else {
                        console.warn('⚠️ Failed to save to server, localStorage fallback active:', r.message?.error);
                    }
                }
            });
        }, 300); // Reduced debounce for better responsiveness
    }
    
    updateTableWidth() {
        // Prevent rapid successive calls for better performance
        const now = Date.now();
        if (now - this.lastUpdateTime < 50) { // Throttle to max 20 calls per second
            clearTimeout(this.updateTimeout);
            this.updateTimeout = setTimeout(() => {
                this._doUpdateTableWidth();
            }, 50);
            return;
        }
        
        this.lastUpdateTime = now;
        this._doUpdateTableWidth();
    }
    
    _doUpdateTableWidth() {
        // Dynamic width calculation - ensures perfect fit with no extra space
        if (!this.columnWidths || typeof this.columnWidths !== 'object') {
            return;
        }
        
        // Get container width (available space for table)
        const $tableContainer = $('.pm-table-container');
        if (!$tableContainer.length) return;
        
        // Prevent infinite recursion by checking if we're already in a CSS calculation
        if ($tableContainer.data('updating-width')) {
            return;
        }
        $tableContainer.data('updating-width', true);
        
        let containerWidth;
        try {
            containerWidth = $tableContainer.width() || window.innerWidth - 100;
        } catch (e) {
            console.warn('Error getting container width:', e);
            containerWidth = window.innerWidth - 100; // Fallback
        }
        
        const scrollbarWidth = 17; // Standard scrollbar width
        const availableWidth = Math.max(600, containerWidth - scrollbarWidth); // Minimum 600px
        
        // Get all visible columns and their current widths
        const visibleColumns = [];
        const allColumns = this.getAllAvailableColumns();
        
        allColumns.forEach(column => {
            const $headerCell = $(`.pm-header-cell[data-column="${column}"]`).first();
            if ($headerCell.length && $headerCell.is(':visible') && $headerCell.css('display') !== 'none') {
                visibleColumns.push({
                    name: column,
                    width: this.columnWidths[column] || this.getColumnDefaultWidth(column),
                    isFixed: column === 'select' // Select column is always fixed width
                });
            }
        });
        
        if (visibleColumns.length === 0) return;
        
        // Calculate total width based on user's saved column widths
        // NEVER modify user's saved column widths - table should adapt to columns, not vice versa
        let totalColumnsWidth = visibleColumns.reduce((sum, col) => sum + col.width, 0);
        
        // Table width should always match the sum of visible column widths
        // No adjustment of column widths - respect user's preferences
        const finalWidth = totalColumnsWidth;
        
        console.log(`📐 Table width calculation: ${finalWidth}px (sum of ${visibleColumns.length} visible columns)`);
        
        // Update all table elements with the calculated width
        $('.pm-project-table-header, .pm-task-row, .pm-project-group, .pm-add-task-row').each(function() {
            const $element = $(this);
            const currentDisplay = $element.css('display');
            const isHidden = $element.hasClass('column-hidden') || currentDisplay === 'none';
            
            // Set exact width to match available space
            $element.css({
                'width': finalWidth + 'px',
                'min-width': finalWidth + 'px',
                'max-width': finalWidth + 'px'
            });
            
            // Preserve the original display value
            if (isHidden) {
                $element.css('display', 'none');
            }
        });
        
        // Update table body container
        $('.pm-table-body').css({
            'width': finalWidth + 'px',
            'min-width': finalWidth + 'px',
            'max-width': finalWidth + 'px'
        });
        
        console.log(`✅ Table width updated: ${finalWidth}px (respecting user's column widths, no forced adjustments)`);
        
        // 列宽度变化后，重新渲染所有用户头像以适应新宽度
        this.refreshAllUserAvatars();
        
        // Clear the updating flag to allow future updates
        setTimeout(() => {
            $('.pm-table-container').removeData('updating-width');
        }, 10);
    }
    
    resetColumnWidths() {
        // Reset to default widths
        this.columnWidths = this.getDefaultColumnWidths();
        this.applyColumnWidths();
        
        // Clear saved widths on server
        frappe.call({
            method: 'smart_accounting.www.project_management.index.save_user_column_widths',
            args: {
                column_widths: {} // Empty object to clear saved preferences
            },
            callback: (r) => {
                if (r.message && r.message.success) {
                    frappe.show_alert({
                        message: 'Column widths reset to default',
                        indicator: 'blue'
                    });
                }
            }
        });
    }
    
    showColumnContextMenu(e) {
        // Remove existing menu
        $('.pm-column-context-menu').remove();
        
        const menu = $(`
            <div class="pm-column-context-menu">
                <div class="pm-context-menu-item" data-action="manage-columns">
                    <i class="fa fa-columns"></i>
                    Manage columns...
                </div>
                <div class="pm-context-menu-divider"></div>
                <div class="pm-context-menu-item" data-action="reset-widths">
                    <i class="fa fa-refresh"></i>
                    Reset all column widths
                </div>
                <div class="pm-context-menu-item" data-action="auto-fit">
                    <i class="fa fa-arrows-h"></i>
                    Auto-fit columns
                </div>
            </div>
        `);
        
        // Position menu
        menu.css({
            position: 'fixed',
            left: e.clientX + 'px',
            top: e.clientY + 'px',
            zIndex: 10000
        });
        
        $('body').append(menu);
        
        // Bind menu actions
        menu.on('click', '.pm-context-menu-item', (event) => {
            const action = $(event.currentTarget).data('action');
            
            switch(action) {
                case 'manage-columns':
                    if (window.FilterManager) {
                        window.FilterManager.showColumnManagementDialog();
                    }
                    break;
                case 'reset-widths':
                    this.resetColumnWidths();
                    break;
                case 'auto-fit':
                    this.autoFitColumns();
                    break;
            }
            
            menu.remove();
        });
        
        // Close menu on outside click
        $(document).one('click', () => {
            menu.remove();
        });
    }
    
    autoFitColumns() {
        // Auto-fit columns based on content
        Object.keys(this.columnWidths).forEach(column => {
            const headerCell = $(`.pm-header-cell[data-column="${column}"]`);
            const headerText = headerCell.find('span').text();
            
            // Calculate width based on content
            const tempElement = $('<span>').text(headerText).css({
                'font-size': '11px',
                'font-weight': '600',
                'visibility': 'hidden',
                'position': 'absolute'
            });
            
            $('body').append(tempElement);
            const textWidth = tempElement.outerWidth();
            tempElement.remove();
            
            // Set minimum width based on content + padding
            const newWidth = Math.max(textWidth + 40, 80);
            this.setColumnWidth(column, newWidth);
            this.columnWidths[column] = newWidth;
        });
        
        this.saveColumnWidths();
        
        frappe.show_alert({
            message: 'Columns auto-fitted',
            indicator: 'green'
        });
    }
    
    getCurrentColumnWidths() {
        // Get current column widths (either from stored widths or actual DOM)
        const currentWidths = {};
        
        Object.keys(this.columnWidths).forEach(column => {
            const headerCell = $(`.pm-header-cell[data-column="${column}"]`);
            if (headerCell.length > 0) {
                // Get actual width from DOM
                currentWidths[column] = headerCell.outerWidth() || this.columnWidths[column];
            } else {
                // Fallback to stored width
                currentWidths[column] = this.columnWidths[column];
            }
        });
        
        return currentWidths;
    }

    // Get all available columns dynamically from DOM
    getAllAvailableColumns() {
        const columns = [];
        try {
            $('.pm-header-cell[data-column]').each(function() {
                const columnName = $(this).data('column');
                if (columnName && !columns.includes(columnName)) {
                    columns.push(columnName);
                }
            });
        } catch (e) {
            console.warn('Error getting available columns:', e);
            // Fallback to basic columns if DOM query fails
            return ['select', 'client', 'task-name', 'status'];
        }
        
        // If no columns found, return basic set
        if (columns.length === 0) {
            return ['select', 'client', 'task-name', 'status'];
        }
        
        return columns;
    }

    // Column visibility management
    hideUnwantedColumns(visibleColumns) {
        // Get all possible columns dynamically (excluding select which is always visible)
        const allColumns = this.getAllAvailableColumns().filter(col => col !== 'select');
        
        // Always ensure select column is visible (it's not user-configurable)
        $(`.pm-header-cell[data-column="select"]`).show().css('display', '').removeClass('column-hidden');
        $(`.pm-cell-select`).show().css('display', '').removeClass('column-hidden');
        
        // Hide columns not in visible list
        allColumns.forEach(column => {
            const shouldShow = visibleColumns.includes(column);
            
            if (shouldShow) {
                // Show header cells
                $(`.pm-header-cell[data-column="${column}"]`).show().css('display', '').removeClass('column-hidden');
                // Show data cells
                $(`.pm-cell-${column}`).show().css('display', '').removeClass('column-hidden');
            } else {
                // Hide header cells with strong CSS
                $(`.pm-header-cell[data-column="${column}"]`).hide().css('display', 'none !important').addClass('column-hidden');
                // Hide data cells with strong CSS
                $(`.pm-cell-${column}`).hide().css('display', 'none !important').addClass('column-hidden');
            }
        });
        
        // Recalculate table width after hiding/showing columns
        // Add small delay to ensure DOM updates are complete
        setTimeout(() => {
            this.updateTableWidth();
        }, 150); // Slightly longer delay for better stability
    }

    applyColumnConfiguration(config) {
        const visibleColumns = config.visible_columns || [];
        const columnConfig = config.column_config || {};
        
        // Apply column visibility (this will trigger updateTableWidth internally)
        this.hideUnwantedColumns(visibleColumns);
        
        // Apply column order if specified
        if (columnConfig.column_order && columnConfig.column_order.length > 0) {
            this.applyColumnOrder(columnConfig.column_order, visibleColumns);
        }
        
        // Ensure width is recalculated after all configuration changes
        setTimeout(() => {
            this.updateTableWidth();
        }, 150);
    }

    applyColumnOrder(columnOrder, visibleColumns) {
        console.log('🔄 Applying column order:', columnOrder);
        
        if (!columnOrder || columnOrder.length === 0) {
            console.warn('⚠️ No column order provided');
            return;
        }
        
        // 检查是否需要重排序（避免不必要的DOM操作）
        if (!this.needsReordering(columnOrder)) {
            console.log('ℹ️ Column order unchanged, skipping reorder');
            return;
        }
        
        // 使用CSS方式重排序，完全避免DOM操作，确保事件绑定不受影响
        this.reorderColumnsWithCSS(columnOrder);
        
        console.log('✅ Column order applied via CSS, DOM structure and events preserved');
    }
    
    needsReordering(newColumnOrder) {
        // 获取当前列顺序
        const currentOrder = [];
        $('.pm-project-table-header').first().find('.pm-header-cell[data-column]').each(function() {
            const columnName = $(this).data('column');
            if (columnName) {
                currentOrder.push(columnName);
            }
        });
        
        // 确保select列在最前面进行比较
        const normalizedCurrentOrder = ['select', ...currentOrder.filter(col => col !== 'select')];
        const normalizedNewOrder = ['select', ...newColumnOrder.filter(col => col !== 'select')];
        
        // 比较顺序是否相同
        if (normalizedCurrentOrder.length !== normalizedNewOrder.length) {
            return true;
        }
        
        for (let i = 0; i < normalizedCurrentOrder.length; i++) {
            if (normalizedCurrentOrder[i] !== normalizedNewOrder[i]) {
                return true;
            }
        }
        
        console.log('📋 Current order matches new order, no reordering needed');
        return false;
    }
    
    reorderColumnsWithCSS(columnOrder) {
        console.log('🎨 Applying column order via CSS flexbox order...');
        
        // 确保select列始终在最前面
        const orderedColumns = ['select', ...columnOrder.filter(col => col !== 'select')];
        
        // 为每个列设置CSS order属性
        orderedColumns.forEach((columnName, index) => {
            const order = index + 1; // CSS order从1开始
            
            // 设置表头单元格的order
            $(`.pm-header-cell[data-column="${columnName}"]`).css('order', order);
            
            // 设置对应数据单元格的order
            const columnClassMap = {
                'select': 'pm-cell-select',
                'client': 'pm-cell-client',
                'task-name': 'pm-cell-task-name',
                'entity': 'pm-cell-entity',
                'tf-tg': 'pm-cell-tf-tg',
                'software': 'pm-cell-software',
                'status': 'pm-cell-status',
                'note': 'pm-cell-note',
                'target-month': 'pm-cell-target-month',
                'budget': 'pm-cell-budget',
                'actual': 'pm-cell-actual',
                'review-note': 'pm-cell-review-note',
                'action-person': 'pm-cell-action-person',
                'preparer': 'pm-cell-preparer',
                'reviewer': 'pm-cell-reviewer',
                'partner': 'pm-cell-partner',
                'lodgment-due': 'pm-cell-lodgment-due',
                'engagement': 'pm-cell-engagement',
                'group': 'pm-cell-group',
                'year-end': 'pm-cell-year-end',
                'last-updated': 'pm-cell-last-updated',
                'priority': 'pm-cell-priority',
                'frequency': 'pm-cell-frequency',
                'reset-date': 'pm-cell-reset-date'
            };
            
            const cellClass = columnClassMap[columnName];
            if (cellClass) {
                $(`.${cellClass}`).css('order', order);
            }
        });
        
        console.log('✅ CSS-based column reordering applied, DOM structure preserved');
    }
    
    // 旧的DOM操作方法已移除，现在完全使用CSS方式进行列重排序
    // 这确保了事件绑定不会被破坏，功能之间完全隔离
    
    refreshAllUserAvatars() {
        console.log('👥 Refreshing all user avatars to adapt to column widths...');
        
        // 查找所有用户相关的单元格
        const userCellSelectors = [
            '.pm-cell-action-person',
            '.pm-cell-preparer', 
            '.pm-cell-reviewer',
            '.pm-cell-partner'
        ];
        
        let refreshedCount = 0;
        
        userCellSelectors.forEach(selector => {
            $(selector).each(async function() {
                const $cell = $(this);
                const taskId = $cell.data('task-id');
                const fieldName = $cell.data('field');
                
                // 只刷新有数据的单元格
                if (taskId && fieldName && !$cell.hasClass('pm-empty-person')) {
                    try {
                        // 获取当前角色类型
                        const roleType = fieldName.replace('custom_', '');
                        const roleMapping = {
                            'action_person': 'Action Person',
                            'preparer': 'Preparer',
                            'reviewer': 'Reviewer',
                            'partner': 'Partner'
                        };
                        const mappedRoleType = roleMapping[roleType] || roleType;
                        
                        // 重新渲染这个单元格的头像
                        if (window.PersonSelectorManager) {
                            await window.PersonSelectorManager.updatePersonCellDisplay($cell, taskId, mappedRoleType);
                            refreshedCount++;
                        }
                    } catch (error) {
                        console.warn('Error refreshing avatar for cell:', error);
                    }
                }
            });
        });
        
        console.log(`✅ Refreshed ${refreshedCount} user avatar cells`);
    }

    // Force immediate table width recalculation (public method)
    forceUpdateTableWidth() {
        this.lastUpdateTime = 0; // Reset throttling
        clearTimeout(this.updateTimeout);
        this._doUpdateTableWidth();
    }

    // Apply partition-specific column configuration
    applyPartitionColumnConfig() {
        // Get current partition from URL (properly decoded)
        const currentView = this.utils.getCurrentView();
        
        // Load column configuration for current partition
        frappe.call({
            method: 'smart_accounting.www.project_management.index.get_partition_column_config',
            args: { partition_name: currentView },
            callback: (r) => {
                if (r.message && r.message.success) {
                    this.applyColumnConfiguration(r.message);
                }
            },
        });
    }
}

// Create global instance
window.TableManager = new TableManager();

// Export for module systems if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TableManager;
}
