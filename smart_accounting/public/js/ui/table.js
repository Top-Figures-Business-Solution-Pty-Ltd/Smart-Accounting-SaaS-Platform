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
        
        // Handle window resize
        $(window).on('resize', () => {
            if (!this.isResizing) {
                this.updateTableWidth();
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
        
        // Save the new width
        if (this.currentColumn) {
            const newWidth = $(`.pm-header-cell[data-column="${this.currentColumn}"]`).outerWidth();
            this.columnWidths[this.currentColumn] = newWidth;
            this.saveColumnWidths();
            
            // Immediately update table width to maintain consistency
            this.updateTableWidth();
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
        // Ensure minimum width
        const minWidth = Math.max(width, 50);
        
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
            'note': 'pm-cell-note',
            'last-updated': 'pm-cell-last-updated',
            'priority': 'pm-cell-priority'
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
        
        // Update total table width
        this.updateTableWidth();
    }
    
    applyColumnWidths() {
        // Apply widths to all columns
        Object.keys(this.columnWidths).forEach(column => {
            this.setColumnWidth(column, this.columnWidths[column]);
        });
        
        // Update total table width after applying all column widths
        this.updateTableWidth();
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
        // Simplified default column widths (temporarily restore sync version)
        return {
            'select': 40,
            'client': 150,
            'task-name': 200,
            'entity': 100,
            'tf-tg': 80,
            'software': 120,
            'status': 120,
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
            'note': 150,
            'last-updated': 130,
            'priority': 100
        };
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
        // Calculate total width based on all column widths
        if (!this.columnWidths || typeof this.columnWidths !== 'object') {
            return;
        }
        
        const totalWidth = Object.values(this.columnWidths).reduce((sum, width) => sum + width, 0);
        const calculatedWidth = Math.max(totalWidth + 50, 1200); // Add padding and set minimum
        
        // Update all table elements to maintain consistency, preserving display property
        $('.pm-project-table-header, .pm-task-row, .pm-project-group, .pm-add-task-row').each(function() {
            const $element = $(this);
            const currentDisplay = $element.css('display');
            const isHidden = $element.hasClass('column-hidden') || currentDisplay === 'none';
            
            $element.css({
                'width': calculatedWidth + 'px',
                'min-width': calculatedWidth + 'px'
            });
            
            // Preserve the original display value
            if (isHidden) {
                $element.css('display', 'none');
            }
        });
        
        // Update table body container
        $('.pm-table-body').css({
            'width': calculatedWidth + 'px',
            'min-width': calculatedWidth + 'px'
        });
        
        // Force table container to accommodate new width
        $('.pm-table-container').css({
            'overflow-x': 'auto'
        });
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
                    if (window.ColumnManager) {
                        window.ColumnManager.showColumnManagementDialog();
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

    // Column visibility management
    hideUnwantedColumns(visibleColumns) {
        // All possible columns (excluding select which is always visible)
        const allColumns = [
            'client', 'task-name', 'entity', 'tf-tg', 'software', 'status', 'target-month', 
            'budget', 'actual', 'review-note', 'action-person', 'preparer', 
            'reviewer', 'partner', 'lodgment-due', 'engagement', 'group', 'year-end', 'note', 'last-updated', 'priority'
        ];
        
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
        
        // Recalculate table width after hiding columns
        this.updateTableWidth();
    }

    applyColumnConfiguration(config) {
        const visibleColumns = config.visible_columns || [];
        const columnConfig = config.column_config || {};
        
        // Apply column visibility
        this.hideUnwantedColumns(visibleColumns);
        
        // Apply column order if specified
        if (columnConfig.column_order && columnConfig.column_order.length > 0) {
            this.applyColumnOrder(columnConfig.column_order, visibleColumns);
        }
    }

    applyColumnOrder(columnOrder, visibleColumns) {
        // This is a more complex feature that would require reordering DOM elements
        // For now, we'll focus on visibility. Column order can be implemented later
        // when we have more time to handle the DOM manipulation complexity
        console.log('Column order configuration:', columnOrder);
        
        // TODO: Implement actual column reordering
        // This would involve:
        // 1. Reordering header cells in all project groups
        // 2. Reordering data cells in all task rows
        // 3. Maintaining the responsive table structure
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
