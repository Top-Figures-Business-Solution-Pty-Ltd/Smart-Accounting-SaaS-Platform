// Project Management - Workspace Management
// Workspace and partition management functionality

class WorkspaceManager {
    constructor() {
        this.utils = window.PMUtils;
    }

    // Workspace Switcher - Monday.com style hierarchical
    initializeWorkspaceSwitcher() {
        // Toggle workspace menu
        $(document).on('click', '.pm-workspace-btn', (e) => {
            e.stopPropagation();
            $('.pm-workspace-menu').toggle();
        });
        
        // 点击遮罩关闭菜单
        $(document).on('click', '.pm-workspace-menu', (e) => {
            // 只有点击遮罩背景时才关闭，点击菜单内容不关闭
            if (e.target === e.currentTarget) {
                $('.pm-workspace-menu').hide();
                $('.pm-workspace-submenu').remove();
            }
        });
        
        // 点击关闭按钮关闭菜单
        $(document).on('click', '.pm-workspace-menu-close', (e) => {
            e.stopPropagation();
            $('.pm-workspace-menu').hide();
            $('.pm-workspace-submenu').remove();
        });
        
        // Handle create workspace button (top-level or in submenu)
        $(document).on('click', '.pm-create-workspace', (e) => {
            e.stopPropagation();
            const parentPartition = $(e.currentTarget).data('parent');
            this.showCreateWorkspaceDialog(parentPartition);
        });
        
        // Handle create board button (can be top-level or under workspace)
        $(document).on('click', '.pm-create-board', (e) => {
            e.stopPropagation();
            const parentPartition = $(e.currentTarget).data('parent');
            this.showCreateBoardDialog(parentPartition);
        });
        
        // Handle workspace item clicks (exclude create buttons)
        $(document).on('click', '.pm-workspace-item:not(.pm-create-workspace):not(.pm-create-board)', (e) => {
            e.stopPropagation();
            const $item = $(e.currentTarget);
            const view = $item.data('view');
            const isWorkspace = $item.find('i').hasClass('fa-sitemap') || $item.find('i').hasClass('fa-folder');
            
            if (view) {
                // Check if this item represents a workspace (should show submenu)
                // or a board (should navigate directly)
                frappe.call({
                    method: 'smart_accounting.www.project_management.index.get_partition_info',
                    args: { partition_name: view },
                    callback: (r) => {
                        if (r.message && r.message.is_workspace) {
                            // Always show submenu for workspaces
                            this.showChildPartitions($item, view);
                        } else {
                            // Navigate directly for boards
                            console.log('Switching to partition:', view);
                            const currentUrl = new URL(window.location);
                            currentUrl.searchParams.set('view', view);
                            currentUrl.searchParams.set('_t', Date.now());
                            window.location.href = currentUrl.toString();
                        }
                    }
                });
            }
        });
        
        // 点击子菜单遮罩关闭子菜单
        $(document).on('click', '.pm-workspace-submenu', (e) => {
            // 只有点击遮罩背景时才关闭，确保不干扰按钮点击
            if (e.target === e.currentTarget) {
                $('.pm-workspace-submenu').remove();
                $('.pm-workspace-menu').show(); // 回到主菜单
            }
        });
        
        // ESC键关闭菜单
        $(document).on('keydown', (e) => {
            if (e.key === 'Escape') {
                if ($('.pm-workspace-submenu').length) {
                    $('.pm-workspace-submenu').remove();
                    $('.pm-workspace-menu').show();
                } else if ($('.pm-workspace-menu').is(':visible')) {
                    $('.pm-workspace-menu').hide();
                }
            }
        });

        // Handle breadcrumb navigation
        $(document).on('click', '.pm-breadcrumb-item', (e) => {
            e.preventDefault();
            const targetView = $(e.currentTarget).data('view');
            if (targetView) {
                const currentUrl = new URL(window.location);
                currentUrl.searchParams.set('view', targetView);
                currentUrl.searchParams.set('_t', Date.now());
                window.location.href = currentUrl.toString();
            }
        });

        // Handle empty state back button
        $(document).on('click', '.pm-back-to-parent', (e) => {
            e.preventDefault();
            const targetView = $(e.currentTarget).data('view');
            if (targetView) {
                const currentUrl = new URL(window.location);
                currentUrl.searchParams.set('view', targetView);
                currentUrl.searchParams.set('_t', Date.now());
                window.location.href = currentUrl.toString();
            }
        });
    }

    showChildPartitions($parentItem, parentPartition) {
        // Check if we're already in a submenu (going deeper)
        const isGoingDeeper = $('.pm-workspace-submenu').length > 0;
        
        // Remove existing submenus
        $('.pm-workspace-submenu').remove();
        
        // Always show submenu for consistent UX, even if empty
        frappe.call({
            method: 'smart_accounting.www.project_management.index.get_child_partitions',
            args: { parent_partition: parentPartition },
            callback: (r) => {
                const childPartitions = r.message || [];
                this.createSubmenu($parentItem, childPartitions, parentPartition, isGoingDeeper);
            }
        });
    }
    
    createSubmenu($parentItem, childPartitions, parentPartition, isGoingDeeper = false) {
        const parentName = $parentItem.find('span').text();
        const isEmpty = childPartitions.length === 0;
        
        // Determine if we should show parent menu or main menu based on depth
        const backTarget = isGoingDeeper ? 'parent' : 'main';
        
        const submenuHtml = `
            <div class="pm-workspace-submenu" data-parent="${parentPartition}" data-back-target="${backTarget}">
                <div class="pm-workspace-submenu-content">
                    <div class="pm-submenu-header">
                        <button class="pm-back-btn" title="返回上级菜单" data-back-target="${backTarget}">
                            <i class="fa fa-arrow-left"></i>
                            <span>Back</span>
                        </button>
                        <span class="pm-submenu-title">Currently in: ${parentName}</span>
                    </div>
                    ${isEmpty ? `
                        <div class="pm-empty-workspace">
                            <i class="fa fa-folder-open"></i>
                            <h4>Empty Workspace</h4>
                            <p>No boards created yet. Create your first board below.</p>
                            <div class="pm-empty-workspace-actions">
                                <button class="pm-btn-secondary pm-back-to-main" onclick="this.closest('.pm-workspace-submenu').querySelector('.pm-back-btn').click()">
                                    <i class="fa fa-arrow-left"></i>
                                    ${backTarget === 'main' ? 'Back to Main Menu' : 'Back to Parent'}
                                </button>
                            </div>
                        </div>
                    ` : childPartitions.map(child => `
                        <div class="pm-workspace-item" data-view="${child.name}" data-has-children="${child.has_children || false}">
                            <i class="fa fa-${child.is_workspace ? 'sitemap' : 'folder'}"></i>
                            <span class="pm-item-name">${child.partition_name}</span>
                            <span class="pm-item-type">(${child.is_workspace ? 'workspace' : 'board'})</span>
                            ${child.has_children ? '<i class="fa fa-chevron-right pm-workspace-arrow"></i>' : ''}
                        </div>
                    `).join('')}
                    <div class="pm-workspace-divider"></div>
                    <div class="pm-workspace-item pm-create-workspace" data-parent="${parentPartition}">
                        <i class="fa fa-plus-circle"></i>
                        <span>Create new workspace</span>
                    </div>
                    <div class="pm-workspace-item pm-create-board" data-parent="${parentPartition}">
                        <i class="fa fa-folder-plus"></i>
                        <span>Create new board</span>
                    </div>
                </div>
            </div>
        `;
        
        $('.pm-workspace-menu').after(submenuHtml);
        
        // Handle back button
        $('.pm-back-btn').on('click', (e) => {
            e.stopPropagation();
            const backTarget = $(e.currentTarget).data('back-target');
            const parentPartition = $(e.currentTarget).closest('.pm-workspace-submenu').data('parent');
            
            console.log('Back button clicked - target:', backTarget, 'parent:', parentPartition);
            
            if (backTarget === 'main') {
                // Return to main menu
                this.showMainMenu();
            } else {
                // Return to parent submenu
                this.showParentSubmenu(parentPartition);
            }
        });
    }
    
    showMainMenu() {
        console.log('Showing main menu - removing submenu');
        // Remove submenu and show main menu
        $('.pm-workspace-submenu').remove();
        $('.pm-workspace-menu').show();
        console.log('Main menu should now be visible');
    }

    showParentSubmenu(currentPartition) {
        console.log('Showing parent submenu for:', currentPartition);
        
        // Get parent partition info
        frappe.call({
            method: 'smart_accounting.www.project_management.index.get_partition_info',
            args: { partition_name: currentPartition },
            callback: (r) => {
                if (r.message && r.message.parent_partition) {
                    const parentPartition = r.message.parent_partition;
                    console.log('Found parent partition:', parentPartition);
                    
                    // First try to find parent in main menu
                    let $parentItem = $(`.pm-workspace-menu .pm-workspace-item[data-view="${parentPartition}"]`);
                    
                    if ($parentItem.length) {
                        // Parent is in main menu, hide main menu and show parent's submenu
                        $('.pm-workspace-menu').hide();
                        this.showChildPartitions($parentItem, parentPartition);
                    } else {
                        // Parent might be in a deeper level, need to reconstruct the path
                        this.reconstructParentPath(parentPartition);
                    }
                } else {
                    // No parent, show main menu
                    console.log('No parent found, showing main menu');
                    this.showMainMenu();
                }
            }
        });
    }

    reconstructParentPath(parentPartition) {
        console.log('Reconstructing path for:', parentPartition);
        
        // Get parent info to build the correct menu hierarchy
        frappe.call({
            method: 'smart_accounting.www.project_management.index.get_partition_info',
            args: { partition_name: parentPartition },
            callback: (r) => {
                if (r.message) {
                    // Create a virtual parent item for the submenu
                    const $virtualParentItem = $(`
                        <div class="pm-workspace-item" data-view="${r.message.name}">
                            <span>${r.message.partition_name}</span>
                        </div>
                    `);
                    
                    // Show the parent's submenu
                    this.showChildPartitions($virtualParentItem, parentPartition);
                } else {
                    // Fallback to main menu
                    this.showMainMenu();
                }
            }
        });
    }

    showCreateWorkspaceDialog(parentPartition = null) {
        const currentView = parentPartition || new URLSearchParams(window.location.search).get('view');
        const contextText = currentView ? `Creating workspace in: ${currentView}` : 'Creating top-level workspace';
        
        const dialogHTML = `
            <div class="pm-create-dialog-overlay">
                <div class="pm-create-dialog">
                    <div class="pm-create-dialog-header">
                        <h3>Create New Workspace</h3>
                        <button class="pm-create-dialog-close">
                            <i class="fa fa-times"></i>
                        </button>
                    </div>
                    <div class="pm-create-dialog-body">
                        <div class="pm-context-indicator">
                            <i class="fa fa-info-circle"></i>
                            <span>${contextText}</span>
                        </div>
                        <div class="pm-form-group">
                            <label>Workspace Name</label>
                            <input type="text" class="pm-workspace-name-input" placeholder="Enter workspace name..." maxlength="50">
                        </div>
                        ${!parentPartition ? `
                        <div class="pm-form-group">
                            <label>Parent Workspace (Optional)</label>
                            <select class="pm-parent-workspace-select">
                                <option value="">No parent (top-level workspace)</option>
                            </select>
                        </div>
                        ` : ''}
                        <div class="pm-form-group">
                            <label>Description (Optional)</label>
                            <textarea class="pm-workspace-description-input" placeholder="Brief description..." rows="2" maxlength="140"></textarea>
                            <small class="pm-field-hint">Maximum 140 characters</small>
                        </div>
                        ${parentPartition ? `<input type="hidden" class="pm-parent-partition" value="${parentPartition}">` : ''}
                    </div>
                    <div class="pm-create-dialog-footer">
                        <button class="pm-btn pm-btn-secondary pm-cancel-create">Cancel</button>
                        <button class="pm-btn pm-btn-primary pm-confirm-create">
                            <i class="fa fa-plus"></i>
                            Create Workspace
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        $('body').append(dialogHTML);
        $('.pm-create-dialog-overlay').fadeIn(200);
        $('.pm-workspace-name-input').focus();
        
        // Load available workspaces if creating standalone workspace
        if (!parentPartition) {
            this.loadAvailableWorkspaces();
        }
        
        this.bindCreateDialogEvents(true, parentPartition); // true = workspace
    }

    showCreateBoardDialog(parentPartition) {
        const isUnderWorkspace = !!parentPartition;
        const dialogTitle = isUnderWorkspace ? `Create New Board` : `Create New Board`;
        const contextText = parentPartition ? `Creating board in workspace: ${parentPartition}` : 'Creating standalone board';
        
        const dialogHTML = `
            <div class="pm-create-dialog-overlay">
                <div class="pm-create-dialog">
                    <div class="pm-create-dialog-header">
                        <h3>${dialogTitle}</h3>
                        <button class="pm-create-dialog-close">
                            <i class="fa fa-times"></i>
                        </button>
                    </div>
                    <div class="pm-create-dialog-body">
                        <div class="pm-context-indicator">
                            <i class="fa fa-info-circle"></i>
                            <span>${contextText}</span>
                        </div>
                        <div class="pm-form-group">
                            <label>Board Name</label>
                            <input type="text" class="pm-workspace-name-input" placeholder="Enter board name..." maxlength="50">
                        </div>
                        ${!parentPartition ? `
                        <div class="pm-form-group">
                            <label>Parent Workspace (Optional)</label>
                            <select class="pm-parent-workspace-select">
                                <option value="">No parent (standalone board)</option>
                            </select>
                        </div>
                        ` : ''}
                        <div class="pm-form-group">
                            <label>Board Display Type</label>
                            <div class="pm-display-type-selector">
                                <div class="pm-display-type-option" data-type="Task-Centric">
                                    <div class="pm-display-type-icon">
                                        <i class="fa fa-tasks"></i>
                                    </div>
                                    <div class="pm-display-type-content">
                                        <h4>Task-Centric</h4>
                                        <p>Traditional project management focused on tasks and deliverables</p>
                                    </div>
                                    <div class="pm-display-type-radio">
                                        <input type="radio" name="display_type" value="Task-Centric" checked>
                                    </div>
                                </div>
                                <div class="pm-display-type-option" data-type="Contact-Centric">
                                    <div class="pm-display-type-icon">
                                        <i class="fa fa-users"></i>
                                    </div>
                                    <div class="pm-display-type-content">
                                        <h4>Contact-Centric</h4>
                                        <p>Manage relationships and communications with contacts</p>
                                    </div>
                                    <div class="pm-display-type-radio">
                                        <input type="radio" name="display_type" value="Contact-Centric">
                                    </div>
                                </div>
                                <div class="pm-display-type-option" data-type="Client-Centric">
                                    <div class="pm-display-type-icon">
                                        <i class="fa fa-building"></i>
                                    </div>
                                    <div class="pm-display-type-content">
                                        <h4>Client-Centric</h4>
                                        <p>Focus on client projects, referrals, and business development</p>
                                    </div>
                                    <div class="pm-display-type-radio">
                                        <input type="radio" name="display_type" value="Client-Centric">
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="pm-form-group">
                            <label>Description (Optional)</label>
                            <textarea class="pm-workspace-description-input" placeholder="Brief description..." rows="2" maxlength="140"></textarea>
                            <small class="pm-field-hint">Maximum 140 characters</small>
                        </div>
                        ${parentPartition ? `<input type="hidden" class="pm-parent-partition" value="${parentPartition}">` : ''}
                    </div>
                    <div class="pm-create-dialog-footer">
                        <button class="pm-btn pm-btn-secondary pm-cancel-create">Cancel</button>
                        <button class="pm-btn pm-btn-primary pm-confirm-create">
                            <i class="fa fa-plus"></i>
                            Create Board
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        $('body').append(dialogHTML);
        $('.pm-create-dialog-overlay').fadeIn(200);
        $('.pm-workspace-name-input').focus();
        
        // Load available workspaces if creating standalone board
        if (!parentPartition) {
            this.loadAvailableWorkspaces();
        }
        
        this.bindCreateDialogEvents(false, parentPartition); // false = board, not workspace
    }

    async loadAvailableWorkspaces() {
        try {
            // Get all workspaces (is_workspace = 1)
            const response = await frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Partition',
                    fields: ['name', 'partition_name'],
                    filters: [
                        ['is_workspace', '=', 1],
                        ['is_archived', '!=', 1]
                    ],
                    order_by: 'partition_name'
                }
            });
            
            if (response.message && response.message.length > 0) {
                const $select = $('.pm-parent-workspace-select');
                response.message.forEach(workspace => {
                    $select.append(`<option value="${workspace.name}">${workspace.partition_name}</option>`);
                });
            }
        } catch (error) {
            // If loading fails, just keep the default "No parent" option
        }
    }

    bindCreateDialogEvents(isWorkspace, parentPartition = null) {
        // Close dialog
        $('.pm-create-dialog-close, .pm-cancel-create').on('click', () => {
            $('.pm-create-dialog-overlay').fadeOut(200, function() {
                $(this).remove();
            });
        });
        
        // Close on overlay click
        $('.pm-create-dialog-overlay').on('click', (e) => {
            if (e.target === e.currentTarget) {
                $('.pm-create-dialog-overlay').fadeOut(200, function() {
                    $(this).remove();
                });
            }
        });
        
        // Handle enter key
        $('.pm-workspace-name-input').on('keypress', (e) => {
            if (e.which === 13) {
                $('.pm-confirm-create').click();
            }
        });
        
        // Handle display type selection (only for boards)
        if (!isWorkspace) {
            $('.pm-display-type-option').on('click', function() {
                // Remove selected class from all options
                $('.pm-display-type-option').removeClass('selected');
                // Add selected class to clicked option
                $(this).addClass('selected');
                // Check the radio button
                $(this).find('input[type="radio"]').prop('checked', true);
            });
            
            // Handle radio button clicks
            $('.pm-display-type-radio input[type="radio"]').on('click', function(e) {
                e.stopPropagation();
                // Remove selected class from all options
                $('.pm-display-type-option').removeClass('selected');
                // Add selected class to parent option
                $(this).closest('.pm-display-type-option').addClass('selected');
            });
        }
        
        // Create button
        $('.pm-confirm-create').on('click', async () => {
            const name = $('.pm-workspace-name-input').val().trim();
            const description = $('.pm-workspace-description-input').val().trim();
            const parent = $('.pm-parent-partition').val() || $('.pm-parent-workspace-select').val() || parentPartition;
            const displayType = !isWorkspace ? $('input[name="display_type"]:checked').val() : null;
            
            
            if (!name) {
                frappe.show_alert({
                    message: 'Name is required',
                    indicator: 'red'
                });
                return;
            }
            
            // Disable button during creation
            $('.pm-confirm-create').prop('disabled', true).text('Creating...');
            
            try {
                const response = await frappe.call({
                    method: 'smart_accounting.www.project_management.index.create_partition',
                    args: {
                        partition_name: name,
                        is_workspace: isWorkspace ? 1 : 0,  // Ensure proper boolean conversion
                        parent_partition: parent,
                        description: description,
                        board_display_type: displayType  // Add display type for boards
                    }
                });
                
                if (response.message && response.message.success) {
                    frappe.show_alert({
                        message: response.message.message,
                        indicator: 'green'
                    });
                    
                    // Close dialog
                    $('.pm-create-dialog-overlay').remove();
                    
                    // Navigate to new partition
                    const currentUrl = new URL(window.location);
                    currentUrl.searchParams.set('view', response.message.name);
                    currentUrl.searchParams.set('_t', Date.now());
                    window.location.href = currentUrl.toString();
                    
                } else {
                    throw new Error(response.message?.error || 'Creation failed');
                }
                
            } catch (error) {
                frappe.show_alert({
                    message: 'Error: ' + error.message,
                    indicator: 'red'
                });
                $('.pm-confirm-create').prop('disabled', false).html('<i class="fa fa-plus"></i> Create ' + (isWorkspace ? 'Workspace' : 'Board'));
            }
        });
    }

    bindMainDashboardEvents() {
        // Set body class for main dashboard styling - don't remove it for workspace views
        const currentView = this.utils.getCurrentView();
        if (currentView === 'main') {
            $('body').addClass('main-dashboard-view');
        }
        // Note: Don't remove main-dashboard-view class for workspace overview pages
        
        // Handle workspace/board card clicks
        $(document).on('click', '.pm-workspace-card, .pm-board-card', (e) => {
            const view = $(e.currentTarget).data('view');
            if (view) {
                window.location.href = `/project_management?view=${view}`;
            }
        });
    }
}

// Create global instance
window.WorkspaceManager = new WorkspaceManager();

// Export for module systems if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WorkspaceManager;
}
