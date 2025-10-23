// Project Management - Filter Components
// UI components for filtering and dropdown management

class FilterManager {
    constructor() {
        this.utils = window.PMUtils;
        this.filterChangeTimeout = null;
        // Display type manager removed - simplified to task-centric only
        
        // Listen for display type changes
        $(document).on('displayTypeChanged', (event, data) => {
            this.currentDisplayType = data.displayType;
            this.updateFiltersForDisplayType(data.config);
        });
    }

    // Unified Dropdown Management
    closeAllDropdowns() {
        // Close all dropdown menus
        $('.pm-new-task-menu').hide();
        $('.pm-person-filter-menu').hide();
        $('.pm-client-filter-menu').hide();
        $('.pm-status-filter-menu').hide();
        $('.pm-advanced-filter-panel').hide();
        
        // Remove active states
        $('.pm-new-task-dropdown').removeClass('active');
        $('.pm-person-filter-dropdown').removeClass('active');
        $('.pm-client-filter-dropdown').removeClass('active');
        $('.pm-status-filter-dropdown').removeClass('active');
        $('.pm-advanced-filter-dropdown').removeClass('active');
    }

    // Close only other dropdowns (not the advanced filter panel)
    closeOtherDropdowns() {
        // Close all dropdown menus except advanced filter
        $('.pm-new-task-menu').hide();
        $('.pm-person-filter-menu').hide();
        $('.pm-client-filter-menu').hide();
        $('.pm-status-filter-menu').hide();
        
        // Remove active states for other dropdowns
        $('.pm-new-task-dropdown').removeClass('active');
        $('.pm-person-filter-dropdown').removeClass('active');
        $('.pm-client-filter-dropdown').removeClass('active');
        $('.pm-status-filter-dropdown').removeClass('active');
    }
    
    openDropdown(dropdownClass, menuClass) {
        const $dropdown = $(`.${dropdownClass}`);
        const $menu = $(`.${menuClass}`);
        const $btn = $dropdown.find('button').first();
        
        // If this dropdown is already open, close it
        if ($menu.is(':visible')) {
            this.closeAllDropdowns();
            return;
        }
        
        // Close other dropdowns (but keep advanced filter open if it's the one being opened)
        if (dropdownClass === 'pm-advanced-filter-dropdown') {
            this.closeOtherDropdowns();
        } else {
            this.closeAllDropdowns();
        }
        
        // Position the dropdown menu properly
        this.positionDropdownMenu($btn, $menu);
        
        // Show the menu and add active state
        $menu.show();
        $dropdown.addClass('active');
    }
    
    positionDropdownMenu($button, $menu) {
        // Get button position and dimensions
        const btnOffset = $button.offset();
        const btnHeight = $button.outerHeight();
        const btnWidth = $button.outerWidth();
        const menuWidth = $menu.outerWidth();
        const menuHeight = $menu.outerHeight();
        const windowWidth = $(window).width();
        const windowHeight = $(window).height();
        const scrollTop = $(window).scrollTop();
        
        // Calculate initial position below button
        let left = btnOffset.left;
        let top = btnOffset.top + btnHeight + 5; // 5px gap
        
        // Adjust horizontal position if menu goes beyond screen edges
        if (left + menuWidth > windowWidth - 20) {
            left = btnOffset.left + btnWidth - menuWidth;
        }
        if (left < 20) {
            left = 20;
        }
        
        // Adjust vertical position if menu goes beyond bottom of screen
        if (top + menuHeight > scrollTop + windowHeight - 20) {
            top = btnOffset.top - menuHeight - 5; // Show above button
        }
        
        // Ensure menu doesn't go above viewport
        if (top < scrollTop + 20) {
            top = scrollTop + 20;
        }
        
        // Set position with higher z-index for modals
        const zIndex = $menu.hasClass('pm-person-selector-modal') ? 1001 : 1000;
        
        $menu.css({
            position: 'fixed',
            top: top + 'px',
            left: left + 'px',
            zIndex: zIndex
        });
    }

    // New Task Menu
    toggleNewTaskMenu() {
        this.openDropdown('pm-new-task-dropdown', 'pm-new-task-menu');
    }

    closeNewTaskMenu() {
        const $dropdown = $('.pm-new-task-dropdown');
        const $menu = $('.pm-new-task-menu');
        
        $dropdown.removeClass('active');
        $menu.slideUp(200);
    }

    // Person Filter
    togglePersonFilter() {
        this.openDropdown('pm-person-filter-dropdown', 'pm-person-filter-menu');
        // Load people data when opening
        if ($('.pm-person-filter-menu').is(':visible')) {
            if (window.ReportsManager) {
                window.ReportsManager.loadAllPeople();
            }
        }
    }

    closePersonFilter() {
        const $dropdown = $('.pm-person-filter-dropdown');
        const $menu = $('.pm-person-filter-menu');
        
        $dropdown.removeClass('active');
        $menu.slideUp(200);
    }

    // Client Filter
    toggleClientFilter() {
        this.openDropdown('pm-client-filter-dropdown', 'pm-client-filter-menu');
        // Load clients data when opening
        if ($('.pm-client-filter-menu').is(':visible')) {
            if (window.ReportsManager) {
                window.ReportsManager.loadAllClients();
            }
        }
    }

    closeClientFilter() {
        const $dropdown = $('.pm-client-filter-dropdown');
        const $menu = $('.pm-client-filter-menu');
        
        $dropdown.removeClass('active');
        $menu.slideUp(200);
    }

    // Status Filter
    toggleStatusFilter() {
        this.openDropdown('pm-status-filter-dropdown', 'pm-status-filter-menu');
    }

    closeStatusFilter() {
        const $dropdown = $('.pm-status-filter-dropdown');
        const $menu = $('.pm-status-filter-menu');
        
        $dropdown.removeClass('active');
        $menu.slideUp(200);
    }

    // Advanced Filter Panel
    bindAdvancedFilterEvents() {
        // Toggle filter panel
        $(document).on('click', '.pm-advanced-filter-btn', (e) => {
            e.stopPropagation();
            this.openDropdown('pm-advanced-filter-dropdown', 'pm-advanced-filter-panel');
            // 重置面板位置到屏幕中央
            this.centerFilterPanel();
            // Initialize filter column options based on visible columns (only if not already initialized)
            setTimeout(() => {
                if ($('.pm-filter-column option').length <= 1) {
                    this.initializeFilterColumnOptions();
                }
            }, 100);
        });

        // Close filter panel
        $(document).on('click', '.pm-filter-close', () => {
            this.closeAllDropdowns();
        });

        // 添加拖动功能
        this.initFilterPanelDrag();

        // Column selection change
        $(document).on('change', '.pm-filter-column', (e) => {
            if (window.ReportsManager) {
                window.ReportsManager.updateValueOptions($(e.target));
                // Apply filters immediately after column change to handle edge cases
                setTimeout(() => {
                    window.ReportsManager.applyAdvancedFilters();
                }, 50);
            }
        });

        // Apply filters when condition changes (real-time filtering with debouncing)
        $(document).on('change', '.pm-filter-column, .pm-filter-condition-type, .pm-filter-value', (e) => {
            if (window.ReportsManager) {
                // Clear previous timeout to debounce rapid changes
                clearTimeout(window.FilterManager.filterChangeTimeout);
                window.FilterManager.filterChangeTimeout = setTimeout(() => {
                    window.ReportsManager.applyAdvancedFilters();
                    console.log('🔄 Filters applied due to condition change:', e.target.className, e.target.value);
                }, 50); // Reduced timeout for more responsive filtering
            }
        });

        // Additional edge case handlers
        // Handle when user types in value fields (for future text input support)
        $(document).on('input', '.pm-filter-value', (e) => {
            if (window.ReportsManager) {
                clearTimeout(window.FilterManager.filterChangeTimeout);
                window.FilterManager.filterChangeTimeout = setTimeout(() => {
                    window.ReportsManager.applyAdvancedFilters();
                    console.log('🔄 Filters applied due to value input:', e.target.value);
                }, 200); // Shorter delay for input events
            }
        });

        // Handle focus events to ensure proper state
        $(document).on('focus', '.pm-filter-column, .pm-filter-condition-type, .pm-filter-value', (e) => {
            // Ensure the filter panel stays open when interacting with controls
            e.stopPropagation();
        });

        // Special handling for value dropdown changes - immediate response
        $(document).on('change', '.pm-filter-value', (e) => {
            if (window.ReportsManager) {
                // Immediate application for value changes (no debouncing)
                window.ReportsManager.applyAdvancedFilters();
                console.log('🎯 Immediate filter application due to value change:', e.target.value);
            }
        });

        // Listen for column visibility changes to update filter options
        $(document).on('pm:columns:updated', () => {
            this.updateFilterColumnOptions();
        });

        // Remove filter condition
        $(document).on('click', '.pm-filter-remove', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const $condition = $(e.target).closest('.pm-filter-condition');
            
            // Immediate feedback - don't wait for animation
            if (window.ReportsManager) {
                // Apply filters immediately to handle edge cases
                setTimeout(() => {
                    window.ReportsManager.applyAdvancedFilters();
                    window.ReportsManager.updateRemoveButtons();
                }, 10);
            }
            
            // Then animate removal
            $condition.fadeOut(200, function() {
                $(this).remove();
                // Apply filters again after removal to ensure consistency
                if (window.ReportsManager) {
                    window.ReportsManager.applyAdvancedFilters();
                    window.ReportsManager.updateRemoveButtons();
                }
            });
        });

        // Add new filter
        $(document).on('click', '.pm-add-filter', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (window.ReportsManager) {
                window.ReportsManager.addNewFilterCondition();
            }
        });

        // Add new group (placeholder for future functionality)
        $(document).on('click', '.pm-add-group', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            frappe.show_alert({
                message: 'Filter groups functionality coming soon',
                indicator: 'blue'
            });
        });

        // Clear all filters
        $(document).on('click', '.pm-clear-all', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Add visual feedback
            const $btn = $(e.currentTarget);
            const originalText = $btn.html();
            $btn.html('<i class="fa fa-spinner fa-spin"></i> Clearing...').prop('disabled', true);
            
            setTimeout(() => {
                if (window.ReportsManager) {
                    window.ReportsManager.clearAllFilters();
                }
                
                // Restore button
                $btn.html(originalText).prop('disabled', false);
                
                // Show success message
                frappe.show_alert({
                    message: 'All filters cleared',
                    indicator: 'blue'
                });
            }, 200);
        });
    }

    // Person Tooltip Management
    showPersonTooltip(avatarElement) {
        const $avatar = $(avatarElement);
        const email = $avatar.data('email');
        const name = $avatar.attr('title') || email;
        
        if (!email) return;
        
        // Create tooltip
        const tooltipHTML = `
            <div class="pm-person-tooltip">
                <div class="pm-person-tooltip-header">
                    <div class="pm-person-tooltip-avatar" style="background: ${this.utils.getAvatarColor(name)}">
                        ${this.utils.getInitials(name)}
                    </div>
                    <div class="pm-person-tooltip-info">
                        <h4>${name}</h4>
                        <p>Team Member</p>
                        <p>9:32 AM, Sydney</p>
                    </div>
                </div>
                <div class="pm-person-tooltip-actions">
                    <button class="pm-person-tooltip-action pm-contact-details-btn" data-email="${email}">
                        Contact Details <i class="fa fa-chevron-down"></i>
                    </button>
                    <button class="pm-person-tooltip-action">Ask for an update</button>
                </div>
            </div>
        `;
        
        // Remove existing tooltip
        $('.pm-person-tooltip').remove();
        
        // Add to body
        $('body').append(tooltipHTML);
        
        // Position tooltip
        const $tooltip = $('.pm-person-tooltip');
        const avatarOffset = $avatar.offset();
        const avatarHeight = $avatar.outerHeight();
        
        // Use unified positioning for tooltip
        this.positionDropdownMenu($avatar, $tooltip);
        $tooltip.show();
        
        // Bind contact details click in tooltip
        $tooltip.on('click', '.pm-contact-details-btn', (e) => {
            e.stopPropagation();
            const email = $(e.currentTarget).data('email');
            this.showContactDropdown(e.currentTarget, email);
        });
    }
    
    hidePersonTooltip() {
        $('.pm-person-tooltip').remove();
    }

    async showContactDropdown(button, email) {
        $('.pm-contact-dropdown').remove();
        
        // Get user details for contact info
        let contactItems = [];
        
        // Always show email
        contactItems.push(`
            <div class="pm-contact-item" data-action="email" data-contact="${email}">
                <i class="fa fa-envelope"></i>
                <span>Email: ${email}</span>
            </div>
        `);
        
        // Try to get phone from user profile
        try {
            const userResponse = await frappe.call({
                method: 'frappe.client.get',
                args: {
                    doctype: 'User',
                    name: email,
                    fields: ['phone', 'mobile_no']
                }
            });
            
            if (userResponse.message) {
                const phone = userResponse.message.phone || userResponse.message.mobile_no;
                if (phone) {
                    contactItems.push(`
                        <div class="pm-contact-item" data-action="phone" data-contact="${phone}">
                            <i class="fa fa-phone"></i>
                            <span>Phone: ${phone}</span>
                        </div>
                    `);
                }
            }
        } catch (error) {
            console.log('Could not load phone number');
        }
        
        const dropdownHTML = `
            <div class="pm-contact-dropdown">
                ${contactItems.join('')}
            </div>
        `;
        
        $('body').append(dropdownHTML);
        const $dropdown = $('.pm-contact-dropdown');
        const btnOffset = $(button).offset();
        
        // Use unified positioning for contact dropdown
        this.positionDropdownMenu($(button), $dropdown);
        $dropdown.show();
        
        $dropdown.on('click', '.pm-contact-item', (e) => {
            const action = $(e.currentTarget).data('action');
            const contact = $(e.currentTarget).data('contact');
            this.utils.handleContactAction(action, contact);
            $dropdown.remove();
        });
        
        setTimeout(() => {
            $(document).on('click.contact-dropdown', (e) => {
                if (!$(e.target).closest('.pm-contact-dropdown').length) {
                    $dropdown.remove();
                    $(document).off('click.contact-dropdown');
                }
            });
        }, 100);
    }

    // Column Management Dialog
    showColumnManagementDialog() {
        // Get current view
        const currentView = this.utils.getCurrentView();
        
        // Get current column configuration
        this.getPartitionColumnConfig(currentView).then((config) => {
            this.createColumnManagementDialog(config, currentView);
        }).catch((error) => {
            console.error('Error loading column config:', error);
            frappe.msgprint('Error loading column configuration');
        });
    }

    createColumnManagementDialog(config, currentView) {
        // 使用统一的列配置管理器
        const allColumns = window.ColumnConfigManager.getAllColumns();
        const visibleColumns = config.visible_columns || window.ColumnConfigManager.getDefaultVisibleColumns();
        
        // 获取当前的列顺序，如果没有则使用默认顺序
        const currentColumnOrder = config.column_config?.column_order || window.ColumnConfigManager.getDefaultColumnOrder();

        // Separate visible and hidden columns
        const hiddenColumns = currentColumnOrder.filter(col => !visibleColumns.includes(col));
        const sortedVisibleColumns = currentColumnOrder.filter(col => visibleColumns.includes(col));

        // Create dual-column dialog HTML
        const dialogHtml = `
            <div class="pm-column-management-dialog">
                <div class="pm-dialog-overlay"></div>
                <div class="pm-dialog-content pm-dual-column-dialog">
                    <div class="pm-dialog-header">
                        <h3><i class="fa fa-columns"></i> Manage Columns</h3>
                        <button class="pm-btn pm-btn-ghost pm-btn-sm pm-update-columns-btn" title="Sync Latest Columns">
                            <i class="fa fa-refresh"></i>
                        </button>
                        <button class="pm-dialog-close" type="button">
                            <i class="fa fa-times"></i>
                        </button>
                    </div>
                    <div class="pm-dialog-body">
                        <div class="pm-dialog-description">
                            <p>Select columns from the left panel to add them to the visible columns on the right. Drag to reorder visible columns.</p>
                        </div>
                        
                        <div class="pm-dual-column-container">
                            <!-- Left Panel: Available Columns -->
                            <div class="pm-column-panel pm-available-panel">
                                <div class="pm-panel-header">
                                    <h4><i class="fa fa-list"></i> Available Columns</h4>
                                    <span class="pm-panel-count">${hiddenColumns.length}</span>
                                </div>
                                <div class="pm-column-list" id="pm-available-columns">
                                    ${hiddenColumns.map(columnKey => {
                                        const displayName = window.ColumnConfigManager.getColumnDisplayName(columnKey);
                                        const isRequired = window.ColumnConfigManager.isRequiredColumn(columnKey);
                                        
                                        return `
                                            <div class="pm-column-item pm-available-item" data-column="${columnKey}">
                                                <span class="pm-column-name">${displayName}${isRequired ? ' (Required)' : ''}</span>
                                                <button class="pm-btn pm-btn-sm pm-btn-primary pm-add-column-btn" data-column="${columnKey}" title="Add to visible columns">
                                                    Add
                                                </button>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                            
                            <!-- Center Controls -->
                            <div class="pm-transfer-controls">
                                <button class="pm-btn pm-btn-outline pm-add-all-btn" title="Add all columns">
                                    Add All
                                </button>
                                <button class="pm-btn pm-btn-outline pm-remove-all-btn" title="Remove all non-required columns">
                                    Remove All
                                </button>
                            </div>
                            
                            <!-- Right Panel: Visible Columns -->
                            <div class="pm-column-panel pm-visible-panel">
                                <div class="pm-panel-header">
                                    <h4><i class="fa fa-eye"></i> Visible Columns</h4>
                                    <span class="pm-panel-count">${sortedVisibleColumns.length}</span>
                                    <small class="pm-primary-note">First column is primary</small>
                                </div>
                                <div class="pm-column-list" id="pm-visible-columns">
                                    ${sortedVisibleColumns.map((columnKey, index) => {
                                        const displayName = window.ColumnConfigManager.getColumnDisplayName(columnKey);
                                        const isRequired = window.ColumnConfigManager.isRequiredColumn(columnKey);
                                        const isPrimary = index === 0;
                                        
                                        return `
                                            <div class="pm-column-item pm-visible-item ${isPrimary ? 'pm-primary-column' : ''}" data-column="${columnKey}">
                                                <div class="pm-column-drag-handle" title="Drag to reorder">
                                                    <i class="fa fa-bars"></i>
                                                </div>
                                                <span class="pm-column-name">${displayName}${isRequired ? ' (Required)' : ''}${isPrimary ? ' (Primary)' : ''}</span>
                                                <div class="pm-column-actions">
                                                    <button class="pm-btn pm-btn-xs pm-btn-ghost pm-move-up-btn" data-column="${columnKey}" title="Move up" ${index === 0 ? 'disabled' : ''}>
                                                        Up
                                                    </button>
                                                    <button class="pm-btn pm-btn-xs pm-btn-ghost pm-move-down-btn" data-column="${columnKey}" title="Move down" ${index === sortedVisibleColumns.length - 1 ? 'disabled' : ''}>
                                                        Down
                                                    </button>
                                                    <button class="pm-btn pm-btn-xs pm-btn-danger pm-remove-column-btn" data-column="${columnKey}" title="Remove from visible columns" ${isRequired ? 'disabled' : ''}>
                                                        Remove
                                                    </button>
                                                </div>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="pm-dialog-footer">
                        <button class="pm-btn pm-btn-secondary pm-dialog-cancel">Cancel</button>
                        <button class="pm-btn pm-btn-primary pm-dialog-save">Save Changes</button>
                    </div>
                </div>
            </div>
        `;

        // Remove existing dialog
        $('.pm-column-management-dialog').remove();
        
        // Add dialog to body
        $('body').append(dialogHtml);

        // Initialize drag functionality for visible columns only
        setTimeout(() => {
            console.log('🔍 Initializing dual-column drag functionality...');
            
            const visibleContainer = document.getElementById('pm-visible-columns');
            if (window.DragManager && visibleContainer) {
                const success = window.DragManager.initializeDragSort('pm-visible-columns', () => {
                    this.updateVisibleColumnOrder();
                });
                console.log('🎯 Visible columns drag initialization result:', success);
            }
        }, 200);

        // Bind dialog events
        this.bindColumnDialogEvents(currentView);
    }


    bindColumnDialogEvents(currentView) {
        const dialog = $('.pm-column-management-dialog');

        // Close dialog events
        dialog.on('click', '.pm-dialog-close, .pm-dialog-cancel, .pm-dialog-overlay', () => {
            this.closeColumnDialog();
        });

        // Prevent dialog content clicks from closing dialog
        dialog.on('click', '.pm-dialog-content', (e) => {
            e.stopPropagation();
        });

        // Add column to visible list
        dialog.on('click', '.pm-add-column-btn', (e) => {
            const columnKey = $(e.currentTarget).data('column');
            this.moveColumnToVisible(columnKey);
        });

        // Remove column from visible list
        dialog.on('click', '.pm-remove-column-btn', (e) => {
            const columnKey = $(e.currentTarget).data('column');
            this.moveColumnToAvailable(columnKey);
        });

        // Add all columns
        dialog.on('click', '.pm-add-all-btn', () => {
            this.addAllColumns();
        });

        // Remove all non-required columns
        dialog.on('click', '.pm-remove-all-btn', () => {
            this.removeAllNonRequiredColumns();
        });

        // Move up/down buttons
        dialog.on('click', '.pm-move-up-btn', (e) => {
            const columnKey = $(e.currentTarget).data('column');
            this.moveVisibleColumnUp(columnKey);
        });

        dialog.on('click', '.pm-move-down-btn', (e) => {
            const columnKey = $(e.currentTarget).data('column');
            this.moveVisibleColumnDown(columnKey);
        });

        // Update columns button
        dialog.on('click', '.pm-update-columns-btn', () => {
            this.updatePartitionWithLatestColumns(currentView);
        });

        // Save button
        dialog.on('click', '.pm-dialog-save', () => {
            this.saveDualColumnConfiguration(currentView);
        });

        // Escape key to close
        $(document).on('keydown.column-dialog', (e) => {
            if (e.keyCode === 27) { // ESC key
                this.closeColumnDialog();
            }
        });
    }

    updateVisibleColumnOrder() {
        // Update primary column highlighting and save button state
        this.updatePrimaryColumnHighlight();
        this.markChangesAsPending();
        console.log('🔄 Visible column order updated');
    }

    // Dual Column Management Methods
    moveColumnToVisible(columnKey) {
        const $availableItem = $(`.pm-available-item[data-column="${columnKey}"]`);
        const $visibleContainer = $('#pm-visible-columns');
        
        if ($availableItem.length) {
            // Remove from available
            $availableItem.remove();
            
            // Add to visible at the end
            const displayName = window.ColumnConfigManager.getColumnDisplayName(columnKey);
            const isRequired = window.ColumnConfigManager.isRequiredColumn(columnKey);
            const visibleCount = $visibleContainer.find('.pm-visible-item').length;
            
            const newItem = `
                <div class="pm-column-item pm-visible-item" data-column="${columnKey}">
                    <div class="pm-column-drag-handle" title="Drag to reorder">
                        <i class="fa fa-bars"></i>
                    </div>
                    <span class="pm-column-name">${displayName}${isRequired ? ' (Required)' : ''}</span>
                    <div class="pm-column-actions">
                        <button class="pm-btn pm-btn-xs pm-btn-ghost pm-move-up-btn" data-column="${columnKey}" title="Move up" ${visibleCount === 0 ? 'disabled' : ''}>
                            Up
                        </button>
                        <button class="pm-btn pm-btn-xs pm-btn-ghost pm-move-down-btn" data-column="${columnKey}" title="Move down">
                            Down
                        </button>
                        <button class="pm-btn pm-btn-xs pm-btn-danger pm-remove-column-btn" data-column="${columnKey}" title="Remove from visible columns" ${isRequired ? 'disabled' : ''}>
                            Remove
                        </button>
                    </div>
                </div>
            `;
            
            $visibleContainer.append(newItem);
            this.updatePanelCounts();
            this.updatePrimaryColumnHighlight();
            this.updateMoveButtons();
            this.markChangesAsPending();
        }
    }

    moveColumnToAvailable(columnKey) {
        const $visibleItem = $(`.pm-visible-item[data-column="${columnKey}"]`);
        const $availableContainer = $('#pm-available-columns');
        
        if ($visibleItem.length) {
            // Remove from visible
            $visibleItem.remove();
            
            // Add to available
            const displayName = window.ColumnConfigManager.getColumnDisplayName(columnKey);
            const isRequired = window.ColumnConfigManager.isRequiredColumn(columnKey);
            
            const newItem = `
                <div class="pm-column-item pm-available-item" data-column="${columnKey}">
                    <span class="pm-column-name">${displayName}${isRequired ? ' (Required)' : ''}</span>
                    <button class="pm-btn pm-btn-sm pm-btn-primary pm-add-column-btn" data-column="${columnKey}" title="Add to visible columns">
                        Add
                    </button>
                </div>
            `;
            
            $availableContainer.append(newItem);
            this.updatePanelCounts();
            this.updatePrimaryColumnHighlight();
            this.updateMoveButtons();
            this.markChangesAsPending();
        }
    }

    addAllColumns() {
        $('.pm-add-column-btn').each((index, btn) => {
            const columnKey = $(btn).data('column');
            this.moveColumnToVisible(columnKey);
        });
    }

    removeAllNonRequiredColumns() {
        $('.pm-remove-column-btn:not(:disabled)').each((index, btn) => {
            const columnKey = $(btn).data('column');
            this.moveColumnToAvailable(columnKey);
        });
    }

    moveVisibleColumnUp(columnKey) {
        const $item = $(`.pm-visible-item[data-column="${columnKey}"]`);
        const $prev = $item.prev('.pm-visible-item');
        
        if ($prev.length) {
            $item.detach().insertBefore($prev);
            this.updatePrimaryColumnHighlight();
            this.updateMoveButtons();
            this.markChangesAsPending();
        }
    }

    moveVisibleColumnDown(columnKey) {
        const $item = $(`.pm-visible-item[data-column="${columnKey}"]`);
        const $next = $item.next('.pm-visible-item');
        
        if ($next.length) {
            $item.detach().insertAfter($next);
            this.updatePrimaryColumnHighlight();
            this.updateMoveButtons();
            this.markChangesAsPending();
        }
    }

    updatePanelCounts() {
        const availableCount = $('#pm-available-columns .pm-available-item').length;
        const visibleCount = $('#pm-visible-columns .pm-visible-item').length;
        
        $('.pm-available-panel .pm-panel-count').text(availableCount);
        $('.pm-visible-panel .pm-panel-count').text(visibleCount);
    }

    updatePrimaryColumnHighlight() {
        // Remove existing primary highlighting
        $('.pm-visible-item').removeClass('pm-primary-column');
        $('.pm-visible-item .pm-column-name').each(function() {
            $(this).text($(this).text().replace(' (Primary)', ''));
        });
        
        // Add primary highlighting to first item
        const $firstItem = $('#pm-visible-columns .pm-visible-item').first();
        if ($firstItem.length) {
            $firstItem.addClass('pm-primary-column');
            const $name = $firstItem.find('.pm-column-name');
            if (!$name.text().includes('(Primary)')) {
                $name.text($name.text() + ' (Primary)');
            }
        }
    }

    updateMoveButtons() {
        // Update up/down button states
        $('#pm-visible-columns .pm-visible-item').each(function(index, item) {
            const $item = $(item);
            const $upBtn = $item.find('.pm-move-up-btn');
            const $downBtn = $item.find('.pm-move-down-btn');
            const totalItems = $('#pm-visible-columns .pm-visible-item').length;
            
            $upBtn.prop('disabled', index === 0);
            $downBtn.prop('disabled', index === totalItems - 1);
        });
    }

    markChangesAsPending() {
        const $saveBtn = $('.pm-dialog-save');
        if (!$saveBtn.hasClass('pm-changes-pending')) {
            $saveBtn.addClass('pm-changes-pending')
                .text('Save Changes *')
                .attr('title', 'Changes have been made');
        }
    }

    saveDualColumnConfiguration(currentView) {
        // Get visible columns in order
        const visibleColumns = [];
        const columnOrder = [];
        
        $('#pm-visible-columns .pm-visible-item').each(function() {
            const columnKey = $(this).data('column');
            visibleColumns.push(columnKey);
            columnOrder.push(columnKey);
        });
        
        // Add hidden columns to maintain complete order
        $('#pm-available-columns .pm-available-item').each(function() {
            const columnKey = $(this).data('column');
            columnOrder.push(columnKey);
        });
        
        // Validate configuration
        const validation = window.ColumnConfigManager.validateColumnConfig(visibleColumns, columnOrder);
        if (!validation.isValid) {
            frappe.show_alert({
                message: `❌ Configuration error: ${validation.errors.join(', ')}`,
                indicator: 'red'
            }, 8);
            return;
        }
        
        // Save configuration
        frappe.call({
            method: 'smart_accounting.www.project_management.index.save_partition_column_config',
            args: {
                partition_name: currentView,
                visible_columns: visibleColumns,
                column_config: {
                    column_order: columnOrder,
                    primary_column: visibleColumns[0] || 'client'
                }
            },
            callback: (response) => {
                if (response && response.message && response.message.success) {
                    frappe.show_alert({
                        message: '✅ Column configuration saved successfully',
                        indicator: 'green'
                    }, 3);
                    
                    // Apply configuration to current table
                    if (window.TableManager) {
                        window.TableManager.applyColumnConfiguration({
                            visible_columns: visibleColumns,
                            column_config: {
                                column_order: columnOrder,
                                primary_column: visibleColumns[0] || 'client'
                            }
                        });
                    }
                    
                    this.closeColumnDialog();
                } else {
                    const errorMsg = response.message?.error || 'Save failed';
                    frappe.show_alert({
                        message: `❌ Save failed: ${errorMsg}`,
                        indicator: 'red'
                    }, 8);
                }
            },
            error: (error) => {
                console.error('Save error:', error);
                frappe.show_alert({
                    message: '❌ Network error or server error',
                    indicator: 'red'
                }, 8);
            }
        });
    }

    saveColumnConfiguration(currentView) {
        // Get the current order and visibility from the dialog
        const columnOrder = [];
        const visibleColumns = [];

        $('#pm-sortable-columns .pm-column-item').each(function() {
            const columnKey = $(this).data('column');
            const isVisible = $(this).find('input[type="checkbox"]').is(':checked');
            
            columnOrder.push(columnKey);
            if (isVisible || window.ColumnConfigManager.isRequiredColumn(columnKey)) {
                visibleColumns.push(columnKey);
            }
        });
        
        // 主列就是第一个可见列，不需要额外处理
        const adjustedColumnOrder = columnOrder;
        
        // 获取第一个可见列作为主列
        const primaryColumn = visibleColumns[0] || 'client';
        
        console.log('💾 Saving column configuration:', {
            columnOrder: adjustedColumnOrder,
            visibleColumns: visibleColumns,
            primaryColumn: primaryColumn,
            currentView: currentView
        });
        
        // 使用配置管理器规范化可见列（确保必需列包含在内）
        const normalizedVisibleColumns = window.ColumnConfigManager.normalizeVisibleColumns(visibleColumns);
        
        // 验证配置
        const validation = window.ColumnConfigManager.validateColumnConfig(normalizedVisibleColumns, adjustedColumnOrder);
        if (!validation.isValid) {
            console.error('Column configuration validation failed:', validation.errors);
            frappe.msgprint('Invalid column configuration: ' + validation.errors.join(', '));
            return;
        }

        // Save to backend
        frappe.call({
            method: 'smart_accounting.www.project_management.index.save_partition_column_config',
            args: {
                partition_name: currentView,
                visible_columns: JSON.stringify(normalizedVisibleColumns),
                column_config: JSON.stringify({
                    column_order: adjustedColumnOrder,
                    primary_column: primaryColumn
                })
            },
            callback: (response) => {
                if (response.message && response.message.success) {
                    frappe.show_alert({
                        message: 'Column configuration saved successfully',
                        indicator: 'green'
                    });
                    
                    // Apply the new configuration
                    if (window.TableManager) {
                        console.log('🔄 Applying column configuration to table:', {
                            visible_columns: visibleColumns,
                            column_order: columnOrder
                        });
                        
                        // 关闭对话框
                        $('.pm-column-management-dialog').remove();
                        
                        // 刷新页面以确保所有功能按钮正确放置
                        setTimeout(() => {
                            window.location.reload();
                        }, 500);
                    } else {
                        console.error('❌ TableManager not available');
                    }
                    
                    // Trigger event to update filter column options
                    $(document).trigger('pm:columns:updated');
                    
                    this.closeColumnDialog();
                } else {
                    frappe.msgprint('Error saving column configuration: ' + (response.message?.error || 'Unknown error'));
                }
            },
            error: (error) => {
                console.error('Error saving column config:', error);
                frappe.msgprint('Error saving column configuration');
            }
        });
    }

    updatePartitionWithLatestColumns(currentView) {
        // Create custom confirmation dialog with proper z-index
        const confirmDialog = $(`
            <div class="pm-custom-confirm-overlay" style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                z-index: 10001;
                display: flex;
                align-items: center;
                justify-content: center;
            ">
                <div class="pm-custom-confirm-dialog" style="
                    background: white;
                    border-radius: 8px;
                    padding: 24px;
                    max-width: 480px;
                    width: 90%;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                ">
                    <div style="margin-bottom: 16px;">
                        <h4 style="margin: 0 0 8px 0; color: #333;">Sync Latest Columns</h4>
                        <p style="margin: 0; color: #666; line-height: 1.5;">
                            This will automatically add newly available columns to the current partition configuration. 
                            New columns will be hidden by default and can be enabled through column management.
                        </p>
                    </div>
                    <div style="text-align: right; margin-top: 20px;">
                        <button class="pm-btn pm-btn-secondary pm-confirm-cancel" style="margin-right: 8px;">
                            Cancel
                        </button>
                        <button class="pm-btn pm-btn-primary pm-confirm-sync">
                            <i class="fa fa-refresh"></i> Sync Columns
                        </button>
                    </div>
                </div>
            </div>
        `);
        
        $('body').append(confirmDialog);
        
        // Bind events
        confirmDialog.on('click', '.pm-confirm-cancel, .pm-custom-confirm-overlay', (e) => {
            if (e.target === e.currentTarget) {
                confirmDialog.remove();
            }
        });
        
        confirmDialog.on('click', '.pm-confirm-sync', () => {
            confirmDialog.remove();
            this.executePartitionUpdate(currentView);
        });
        
        // Prevent dialog content clicks from closing
        confirmDialog.on('click', '.pm-custom-confirm-dialog', (e) => {
            e.stopPropagation();
        });
    }

    executePartitionUpdate(currentView) {
        // Show loading state
        const updateBtn = $('.pm-update-columns-btn');
        const originalText = updateBtn.html();
        updateBtn.html('<i class="fa fa-spinner fa-spin"></i> Syncing...').prop('disabled', true);

        frappe.call({
            method: 'smart_accounting.www.project_management.index.update_single_partition_columns',
            args: {
                partition_name: currentView
            },
            callback: (response) => {
                // Restore button state
                updateBtn.html(originalText).prop('disabled', false);

                if (response.message && response.message.success) {
                    const result = response.message;
                    
                    if (result.updated) {
                        // Show success message
                        frappe.show_alert({
                            message: `✅ Successfully added ${result.added_columns.length} new column(s): ${result.added_columns.join(', ')}`,
                            indicator: 'green'
                        }, 5);

                        // Close current dialog and reopen to show updated configuration
                        this.closeColumnDialog();
                        setTimeout(() => {
                            this.showColumnManagementDialog();
                        }, 500);

                    } else {
                        frappe.show_alert({
                            message: '✅ Configuration is already up to date',
                            indicator: 'blue'
                        }, 3);
                    }

                } else {
                    const errorMsg = response.message?.error || 'Update failed';
                    frappe.show_alert({
                        message: `❌ Sync failed: ${errorMsg}`,
                        indicator: 'red'
                    }, 8);
                }
            },
            error: (error) => {
                // Restore button state
                updateBtn.html(originalText).prop('disabled', false);
                
                console.error('Update error:', error);
                frappe.show_alert({
                    message: '❌ Network error or server error',
                    indicator: 'red'
                }, 8);
            }
        });
    }


    closeColumnDialog() {
        // 只清理当前拖拽状态，不销毁整个DragManager
        if (window.DragManager) {
            window.DragManager.cleanup();
        }
        
        $('.pm-column-management-dialog').remove();
        $(document).off('keydown.column-dialog');
    }

    getPartitionColumnConfig(partitionName) {
        return new Promise((resolve, reject) => {
            frappe.call({
                method: 'smart_accounting.www.project_management.index.get_partition_column_config',
                args: {
                    partition_name: partitionName
                },
                callback: (response) => {
                    console.log('API Response:', response);
                    if (response && response.message) {
                        if (response.message.success) {
                            resolve(response.message);
                        } else {
                            reject(response.message.error || 'Failed to load configuration');
                        }
                    } else {
                        reject('Invalid response format');
                    }
                },
                error: (error) => {
                    reject(error);
                }
            });
        });
    }

    addColumnManagementButton() {
        // Add column management button to the header actions
        if ($('.pm-column-management-btn').length > 0) return; // Already added
        
        // Add CSV Export/Import buttons
        const csvExportBtn = $(`
            <button class="pm-btn pm-btn-secondary csv-export-btn" style="margin-right: 10px;">
                <i class="fa fa-download"></i>
                Export CSV
            </button>
        `);
        
        const csvImportBtn = $(`
            <button class="pm-btn pm-btn-secondary csv-import-btn" style="margin-right: 10px;">
                <i class="fa fa-upload"></i>
                Import CSV
            </button>
        `);
        
        // Add Manage Clients button
        const clientsBtn = $(`
            <button class="pm-btn pm-btn-secondary pm-clients-management-btn" style="margin-right: 10px;">
                <i class="fa fa-users"></i>
                Manage Clients
            </button>
        `);
        
        const columnBtn = $(`
            <button class="pm-btn pm-btn-secondary pm-column-management-btn" style="margin-right: 10px;">
                <i class="fa fa-columns"></i>
                Manage Columns
            </button>
        `);
        
        // Add buttons to the actions area (in reverse order since we're prepending)
        $('.pm-actions').prepend(columnBtn);
        $('.pm-actions').prepend(clientsBtn);
        $('.pm-actions').prepend(csvImportBtn);
        $('.pm-actions').prepend(csvExportBtn);
        
        // Bind events
        csvExportBtn.on('click', (e) => {
            e.preventDefault();
            this.showCSVExportDialog();
        });
        
        csvImportBtn.on('click', (e) => {
            e.preventDefault();
            this.showCSVImportDialog();
        });
        
        clientsBtn.on('click', (e) => {
            e.preventDefault();
            this.showClientsManagementDialog();
        });
        
        columnBtn.on('click', (e) => {
            e.preventDefault();
            this.showColumnManagementDialog();
        });
    }

    showCSVExportDialog() {
        // Show CSV export dialog using CSVManager with enhanced error handling
        try {
            if (!window.CSVManager) {
                console.error('CSVManager not loaded');
                frappe.show_alert({
                    message: 'CSV export feature is loading, please try again in a moment',
                    indicator: 'orange'
                });
                return;
            }

            if (typeof window.CSVManager.showExportDialog !== 'function') {
                console.error('CSVManager.showExportDialog is not a function');
                frappe.show_alert({
                    message: 'CSV export feature is not properly initialized, please refresh the page',
                    indicator: 'red'
                });
                return;
            }

            window.CSVManager.showExportDialog();
            
        } catch (error) {
            console.error('Error showing CSV export dialog:', error);
            frappe.show_alert({
                message: 'Error opening CSV export dialog. Please refresh the page and try again.',
                indicator: 'red'
            });
        }
    }

    showCSVImportDialog() {
        // Show CSV import dialog using CSVManager with enhanced error handling
        try {
            if (!window.CSVManager) {
                console.error('CSVManager not loaded');
                frappe.show_alert({
                    message: 'CSV import feature is loading, please try again in a moment',
                    indicator: 'orange'
                });
                return;
            }

            if (typeof window.CSVManager.showImportDialog !== 'function') {
                console.error('CSVManager.showImportDialog is not a function');
                frappe.show_alert({
                    message: 'CSV import feature is not properly initialized, please refresh the page',
                    indicator: 'red'
                });
                return;
            }

            window.CSVManager.showImportDialog();
            
        } catch (error) {
            console.error('Error showing CSV import dialog:', error);
            frappe.show_alert({
                message: 'Error opening CSV import dialog. Please refresh the page and try again.',
                indicator: 'red'
            });
        }
    }

    showClientsManagementDialog() {
        // Initialize and show the comprehensive client management system
        if (!window.ClientManagementSystem) {
            console.error('ClientManagementSystem not loaded');
            frappe.show_alert({
                message: 'Client management system not available',
                indicator: 'red'
            });
            return;
        }

        const clientManager = new window.ClientManagementSystem();
        clientManager.showClientManagementDialog();
    }

    // 居中显示过滤器面板
    centerFilterPanel() {
        const $panel = $('.pm-advanced-filter-panel');
        if ($panel.length) {
            // 重置transform，确保居中
            $panel.css({
                'top': '50%',
                'left': '50%',
                'transform': 'translate(-50%, -50%)'
            });
        }
    }

    // 初始化拖动功能
    initFilterPanelDrag() {
        let isDragging = false;
        let startX, startY, startLeft, startTop;

        // 鼠标按下事件（仅在头部区域）
        $(document).on('mousedown', '.pm-filter-header', (e) => {
            // 不要在关闭按钮上触发拖动
            if ($(e.target).closest('.pm-filter-close').length) {
                return;
            }

            isDragging = true;
            const $panel = $('.pm-advanced-filter-panel');
            
            // 获取当前位置
            const rect = $panel[0].getBoundingClientRect();
            startX = e.clientX;
            startY = e.clientY;
            startLeft = rect.left;
            startTop = rect.top;

            // 添加拖动样式
            $panel.addClass('dragging');
            
            // 阻止文本选择
            e.preventDefault();
        });

        // 鼠标移动事件
        $(document).on('mousemove', (e) => {
            if (!isDragging) return;

            const $panel = $('.pm-advanced-filter-panel');
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            const newLeft = startLeft + deltaX;
            const newTop = startTop + deltaY;

            // 确保面板不会移出屏幕
            const windowWidth = $(window).width();
            const windowHeight = $(window).height();
            const panelWidth = $panel.outerWidth();
            const panelHeight = $panel.outerHeight();

            const constrainedLeft = Math.max(0, Math.min(newLeft, windowWidth - panelWidth));
            const constrainedTop = Math.max(0, Math.min(newTop, windowHeight - panelHeight));

            // 设置新位置（不使用transform，直接设置left和top）
            $panel.css({
                'left': constrainedLeft + 'px',
                'top': constrainedTop + 'px',
                'transform': 'none'
            });
        });

        // 鼠标释放事件
        $(document).on('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                $('.pm-advanced-filter-panel').removeClass('dragging');
            }
        });

        // 防止拖动时选择文本
        $(document).on('selectstart', '.pm-advanced-filter-panel', (e) => {
            if (isDragging) {
                e.preventDefault();
            }
        });
    }

    /**
     * Get currently visible columns from the table
     * @returns {Array} Array of visible column keys
     */
    getCurrentVisibleColumns() {
        const visibleColumns = [];
        
        // Check which header cells are currently visible
        $('.pm-header-cell').each(function() {
            const $header = $(this);
            const columnKey = $header.data('column');
            
            // Check if the column is visible (not hidden by CSS or display:none)
            if (columnKey && $header.is(':visible') && $header.css('display') !== 'none') {
                visibleColumns.push(columnKey);
            }
        });
        
        return visibleColumns;
    }

    /**
     * Update filter column options based on currently visible columns
     */
    updateFilterColumnOptions() {
        const visibleColumns = this.getCurrentVisibleColumns();
        const allColumns = window.ColumnConfigManager ? 
            window.ColumnConfigManager.getAllColumns() : 
            {
                'client': 'Client Name',
                'task-name': 'Task Name',
                'entity': 'Entity',
                'tf-tg': 'TF/TG',
                'software': 'Software',
                'communication-methods': 'Communication Methods',
                'client-contact': 'Client Contact',
                'status': 'Status',
                'target-month': 'Target Month',
                'budget': 'Budget',
                'actual': 'Actual',
                'review-note': 'Review Note',
                'action-person': 'Action Person',
                'preparer': 'Preparer',
                'reviewer': 'Reviewer',
                'partner': 'Partner',
                'process-date': 'Process Date',
                'lodgment-due': 'Lodgement Due',
                'engagement': 'Engagement',
                'group': 'Group',
                'year-end': 'Year End',
                'last-updated': 'Last Updated',
                'priority': 'Priority',
                'frequency': 'Frequency',
                'reset-date': 'Reset Date'
            };

        // Map column keys to filter-compatible names
        const columnKeyMapping = {
            'client': 'client_name',
            'task-name': 'task_name',
            'entity': 'entity',
            'tf-tg': 'tf_tg',
            'software': 'software',
            'status': 'status',
            'target-month': 'target_month',
            'budget': 'budget',
            'actual': 'actual',
            'review-note': 'review_note',
            'action-person': 'action_person',
            'preparer': 'preparer',
            'reviewer': 'reviewer',
            'partner': 'partner',
            'process-date': 'process_date',
            'lodgment-due': 'lodgment_due',
            'engagement': 'engagement',
            'group': 'group',
            'year-end': 'year_end',
            'last-updated': 'last_updated',
            'priority': 'priority',
            'frequency': 'frequency',
            'reset-date': 'reset_date'
        };

        // Update all filter column dropdowns
        $('.pm-filter-column').each(function() {
            const $select = $(this);
            const currentValue = $select.val();
            
            // Clear all options except the placeholder
            $select.empty().append('<option value="">Column</option>');
            
            // Remove duplicates from visible columns
            const uniqueVisibleColumns = [...new Set(visibleColumns)];
            
            // Add options for visible columns only
            uniqueVisibleColumns.forEach(columnKey => {
                const displayName = allColumns[columnKey] || columnKey;
                const filterValue = columnKeyMapping[columnKey] || columnKey;
                const isSelected = currentValue === filterValue ? 'selected' : '';
                $select.append(`<option value="${filterValue}" ${isSelected}>${displayName}</option>`);
            });
            
            // If current value is no longer visible, reset to empty
            const currentColumnKey = Object.keys(columnKeyMapping).find(key => columnKeyMapping[key] === currentValue);
            if (currentValue && currentColumnKey && !uniqueVisibleColumns.includes(currentColumnKey)) {
                $select.val('');
                // Also clear the value dropdown for this condition
                $select.closest('.pm-filter-condition').find('.pm-filter-value').html('<option value="">Value</option>');
            }
        });

        console.log('🔄 Filter column options updated based on visible columns:', visibleColumns);
    }

    /**
     * Initialize filter column options when the filter panel is opened
     */
    initializeFilterColumnOptions() {
        // Update column options when filter panel is first opened
        this.updateFilterColumnOptions();
    }

    /**
     * Update filters based on display type
     */
    updateFiltersForDisplayType(config) {
        if (!config || !config.filters) return;
        
        // Update filter options based on display type
        this.updateFilterColumnOptions();
        
        // Update filter labels and options
        this.updateFilterLabels(config);
        
        // Reset current filters if they're not applicable to new display type
        this.resetIncompatibleFilters(config);
    }

    updateFilterLabels(config) {
        // Update filter dropdown labels based on display type
        const $personFilter = $('.pm-person-filter-dropdown .pm-filter-label');
        const $clientFilter = $('.pm-client-filter-dropdown .pm-filter-label');
        const $statusFilter = $('.pm-status-filter-dropdown .pm-filter-label');
        
        switch (config.name) {
            case 'Contact-Centric':
                $personFilter.text('Company');
                $clientFilter.text('Contact Status');
                $statusFilter.text('Contact Type');
                break;
            case 'Client-Centric':
                $personFilter.text('Accountant');
                $clientFilter.text('Customer Group');
                $statusFilter.text('Priority Level');
                break;
            default: // Task-Centric
                $personFilter.text('Person');
                $clientFilter.text('Client');
                $statusFilter.text('Status');
                break;
        }
    }

    resetIncompatibleFilters(config) {
        // Reset filters that don't apply to the new display type
        const currentFilters = this.getCurrentFilters();
        const validFilterKeys = config.filters.map(f => f.key);
        
        // Clear filters that are not valid for the new display type
        Object.keys(currentFilters).forEach(filterKey => {
            if (!validFilterKeys.includes(filterKey)) {
                this.clearFilter(filterKey);
            }
        });
    }

    getCurrentFilters() {
        // Return current active filters
        return {
            person: $('.pm-person-filter-dropdown').data('selected-value'),
            client: $('.pm-client-filter-dropdown').data('selected-value'),
            status: $('.pm-status-filter-dropdown').data('selected-value')
        };
    }

    clearFilter(filterKey) {
        // Clear specific filter
        switch (filterKey) {
            case 'person':
                $('.pm-person-filter-dropdown').removeData('selected-value');
                $('.pm-person-filter-dropdown .pm-filter-text').text('All People');
                break;
            case 'client':
                $('.pm-client-filter-dropdown').removeData('selected-value');
                $('.pm-client-filter-dropdown .pm-filter-text').text('All Clients');
                break;
            case 'status':
                $('.pm-status-filter-dropdown').removeData('selected-value');
                $('.pm-status-filter-dropdown .pm-filter-text').text('All Status');
                break;
        }
    }

    // Check if current display type supports a specific filter - simplified
    supportsFilter(filterType) {
        // Simplified: always support all filters for task-centric view
        return true;
        
        return config.filters.some(filter => filter.key === filterType);
    }
}

// Create global instance
window.FilterManager = new FilterManager();

// Export for module systems if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FilterManager;
}
