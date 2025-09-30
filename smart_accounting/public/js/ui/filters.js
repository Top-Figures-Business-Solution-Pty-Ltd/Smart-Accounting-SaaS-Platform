// Project Management - Filter Components
// UI components for filtering and dropdown management

class FilterManager {
    constructor() {
        this.utils = window.PMUtils;
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
    
    openDropdown(dropdownClass, menuClass) {
        const $dropdown = $(`.${dropdownClass}`);
        const $menu = $(`.${menuClass}`);
        const $btn = $dropdown.find('button').first();
        
        // If this dropdown is already open, close it
        if ($menu.is(':visible')) {
            this.closeAllDropdowns();
            return;
        }
        
        // Close all other dropdowns first
        this.closeAllDropdowns();
        
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
        });

        // Close filter panel
        $(document).on('click', '.pm-filter-close', () => {
            this.closeAllDropdowns();
        });

        // Column selection change
        $(document).on('change', '.pm-filter-column', (e) => {
            if (window.ReportsManager) {
                window.ReportsManager.updateValueOptions($(e.target));
            }
        });

        // Apply filters when condition changes (real-time filtering)
        $(document).on('change', '.pm-filter-column, .pm-filter-condition-type, .pm-filter-value', () => {
            if (window.ReportsManager) {
                window.ReportsManager.applyAdvancedFilters();
            }
        });

        // Remove filter condition
        $(document).on('click', '.pm-filter-remove', (e) => {
            $(e.target).closest('.pm-filter-condition').remove();
            if (window.ReportsManager) {
                window.ReportsManager.applyAdvancedFilters();
                window.ReportsManager.updateRemoveButtons();
            }
        });

        // Add new filter
        $(document).on('click', '.pm-add-filter', () => {
            if (window.ReportsManager) {
                window.ReportsManager.addNewFilterCondition();
            }
        });

        // Clear all filters
        $(document).on('click', '.pm-clear-all', () => {
            if (window.ReportsManager) {
                window.ReportsManager.clearAllFilters();
            }
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

        // Create dialog HTML
        const dialogHtml = `
            <div class="pm-column-management-dialog">
                <div class="pm-dialog-overlay"></div>
                <div class="pm-dialog-content">
                    <div class="pm-dialog-header">
                        <h3><i class="fa fa-columns"></i> Manage Columns</h3>
                        <button class="pm-dialog-close" type="button">
                            <i class="fa fa-times"></i>
                        </button>
                    </div>
                    <div class="pm-dialog-body">
                        <p class="pm-dialog-description">
                            Choose which columns to display and drag to reorder them.
                        </p>
                        <div class="pm-column-list" id="pm-sortable-columns">
                            ${currentColumnOrder.map((columnKey, index) => {
                                const displayName = window.ColumnConfigManager.getColumnDisplayName(columnKey);
                                const isVisible = visibleColumns.includes(columnKey);
                                const isRequired = window.ColumnConfigManager.isRequiredColumn(columnKey);
                                
                                return `
                                    <div class="pm-column-item ${isVisible ? 'visible' : 'hidden'}" 
                                         data-column="${columnKey}" 
                                         data-original-index="${index}">
                                        <div class="pm-column-drag-handle" title="Drag to reorder">
                                            <span style="font-size: 14px; color: #9ca3af;">☰</span>
                                        </div>
                                        <label class="pm-column-checkbox">
                                            <input type="checkbox" ${isVisible ? 'checked' : ''} data-column="${columnKey}" ${isRequired ? 'disabled' : ''}>
                                            <span class="checkmark"></span>
                                            <span class="pm-column-name">${displayName}${isRequired ? ' (Required)' : ''}</span>
                                        </label>
                                        <div class="pm-column-status">
                                            <i class="fa ${isVisible ? 'fa-eye' : 'fa-eye-slash'}"></i>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
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

        // 使用setTimeout确保DOM完全渲染后再初始化拖拽功能
        setTimeout(() => {
            console.log('🔍 Attempting to initialize drag functionality...');
            
            // 检查DOM元素是否存在
            const container = document.getElementById('pm-sortable-columns');
            const items = container ? container.querySelectorAll('.pm-column-item') : [];
            const handles = container ? container.querySelectorAll('.pm-column-drag-handle') : [];
            
            console.log('📊 DOM check:', {
                container: !!container,
                itemsCount: items.length,
                handlesCount: handles.length,
                DragManagerAvailable: !!window.DragManager
            });
            
            // 使用专门的DragManager来处理拖拽功能
            if (window.DragManager && container && items.length > 0) {
                const success = window.DragManager.initializeDragSort('pm-sortable-columns', () => {
                    this.updateColumnOrder();
                });
                console.log('🎯 Drag initialization result:', success);
            } else {
                console.error('❌ Drag initialization failed:', {
                    DragManager: !!window.DragManager,
                    container: !!container,
                    itemsCount: items.length
                });
            }
        }, 200); // 增加延迟时间

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

        // Checkbox change events - only update visual state, don't apply to table yet
        dialog.on('change', 'input[type="checkbox"]', (e) => {
            const checkbox = $(e.target);
            const columnKey = checkbox.data('column');
            const columnItem = checkbox.closest('.pm-column-item');
            const statusIcon = columnItem.find('.pm-column-status i');

            if (checkbox.is(':checked')) {
                columnItem.addClass('visible').removeClass('hidden');
                statusIcon.removeClass('fa-eye-slash').addClass('fa-eye');
            } else {
                columnItem.addClass('hidden').removeClass('visible');
                statusIcon.removeClass('fa-eye').addClass('fa-eye-slash');
            }
            
            // Note: Don't apply changes to table immediately - wait for save
        });

        // Save button
        dialog.on('click', '.pm-dialog-save', () => {
            this.saveColumnConfiguration(currentView);
        });

        // Escape key to close
        $(document).on('keydown.column-dialog', (e) => {
            if (e.keyCode === 27) { // ESC key
                this.closeColumnDialog();
            }
        });
    }

    updateColumnOrder() {
        // 提供拖拽排序的视觉反馈
        console.log('🔄 Column order updated');
        
        // 获取当前顺序
        const currentOrder = window.DragManager ? window.DragManager.getCurrentOrder() : [];
        console.log('📋 Current order:', currentOrder);
        
        // 显示保存提示
        const $saveBtn = $('.pm-dialog-save');
        if (!$saveBtn.hasClass('pm-changes-pending')) {
            $saveBtn.addClass('pm-changes-pending')
                .text('Save Changes *')
                .attr('title', 'Column order has been changed');
        }
        
        // 更新拖拽句柄的提示文本
        $('.pm-column-drag-handle').attr('title', 'Drag to reorder (changes will be saved when you click Save Changes)');
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
        
        console.log('💾 Saving column configuration:', {
            columnOrder: columnOrder,
            visibleColumns: visibleColumns,
            currentView: currentView
        });
        
        // 使用配置管理器规范化可见列（确保必需列包含在内）
        const normalizedVisibleColumns = window.ColumnConfigManager.normalizeVisibleColumns(visibleColumns);
        
        // 验证配置
        const validation = window.ColumnConfigManager.validateColumnConfig(normalizedVisibleColumns, columnOrder);
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
                    column_order: columnOrder
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
                        
                        window.TableManager.applyColumnConfiguration({
                            visible_columns: visibleColumns,
                            column_config: { column_order: columnOrder }
                        });
                    } else {
                        console.error('❌ TableManager not available');
                    }
                    
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
                    if (response.message && response.message.success) {
                        resolve(response.message);
                    } else {
                        reject(response.message?.error || 'Failed to load configuration');
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
        
        // Add Manage Clients button first (to the left)
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
        
        $('.pm-actions').prepend(columnBtn);
        $('.pm-actions').prepend(clientsBtn);
        
        // Bind events
        clientsBtn.on('click', (e) => {
            e.preventDefault();
            this.showClientsManagementDialog();
        });
        
        columnBtn.on('click', (e) => {
            e.preventDefault();
            this.showColumnManagementDialog();
        });
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
}

// Create global instance
window.FilterManager = new FilterManager();

// Export for module systems if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FilterManager;
}
