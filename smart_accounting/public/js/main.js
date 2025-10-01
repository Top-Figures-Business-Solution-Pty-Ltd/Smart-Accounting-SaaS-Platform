// Project Management - Main Entry Point
// Coordinates all modules and handles initialization

class ProjectManagement {
    constructor() {
        this.tooltipHideTimer = null;
        this.userCache = {}; // Initialize user cache for better display
        this.activeFilters = {
            person: null,
            client: null,
            status: null
        };
        
        // Initialize managers
        this.utils = window.PMUtils;
        this.tableManager = window.TableManager;
        this.filterManager = window.FilterManager;
        this.modalManager = window.ModalManager;
        this.reportsManager = window.ReportsManager;
        this.projectManager = window.ProjectManager;
        this.engagementManager = window.EngagementManager;
        this.editorsManager = window.EditorsManager;
        this.personSelectorManager = window.PersonSelectorManager;
        this.softwareSelectorManager = window.SoftwareSelectorManager;
        this.workspaceManager = window.WorkspaceManager;
        this.subtaskManager = window.SubtaskManager;
        this.multiSelectManager = window.MultiSelectManager;
        this.combinationViewManager = window.CombinationViewManager;
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.initializeFilters();
        this.setupSearch();
        this.initializeInlineEditing();
        this.initializeColumnResizing();
        this.initializeAdvancedFilter();
        this.loadSystemOptions();
        this.initializeWorkspaceSwitcher();
        this.refreshReviewNoteCounts();
        this.initializeSubtasks();
        this.initializeMultiSelect();
        this.initializeCombinationView();
        
        // Apply partition column configuration after DOM is ready
        // Remove the setTimeout to prevent interference with filters
        this.applyPartitionColumnConfig();
        this.addColumnManagementButton();
        this.bindMainDashboardEvents();
        this.initializeAutomateButton();
        this.setupDynamicResizing();
    }
    
    setupDynamicResizing() {
        // Add window resize listener for dynamic table adjustment
        $(window).on('resize', () => {
            if (this.tableManager && this.tableManager.updateTableWidth) {
                this.tableManager.updateTableWidth();
            }
        });
        
        // Initial table width adjustment
        setTimeout(() => {
            if (this.tableManager && this.tableManager.updateTableWidth) {
                this.tableManager.updateTableWidth();
            }
        }, 500);
    }

    initializeMultiSelect() {
        // Initialize multi-select functionality
        if (this.multiSelectManager && typeof this.multiSelectManager === 'function') {
            this.multiSelectInstance = new this.multiSelectManager();
        }
    }

    initializeCombinationView() {
        if (this.combinationViewManager) {
            this.combinationViewManager.init();
            
            // Check if we're in combination view mode
            const urlParams = new URLSearchParams(window.location.search);
            const view = urlParams.get('view');
            const boards = urlParams.get('boards');
            
            if (view === 'combination' && boards) {
                // URL decode the board names
                const boardIds = boards.split(',').map(id => decodeURIComponent(id.trim()));
                console.log('Decoded board IDs:', boardIds);
                this.combinationViewManager.initCombinationViewPage(boardIds);
            }
        }
    }

    bindEvents() {
        // Project expand/collapse
        $(document).on('click', '.pm-project-header', (e) => {
            this.projectManager.toggleProject(e.currentTarget);
        });

        // Tab switching
        $(document).on('click', '.pm-tab', (e) => {
            this.switchTab(e.currentTarget);
        });

        // Status badge click
        $(document).on('click', '.pm-status-badge', (e) => {
            this.projectManager.showStatusMenu(e.currentTarget);
        });

        // Priority badge click
        $(document).on('click', '.pm-priority-badge', (e) => {
            this.projectManager.showPriorityMenu(e.currentTarget);
        });

        // Task row click - Updated to handle editable fields
        $(document).on('click', '.pm-task-row', (e) => {
            // Don't open task details if clicking on editable fields or existing interactive elements
            if ($(e.target).hasClass('pm-status-badge') || 
                $(e.target).hasClass('pm-priority-badge') ||
                $(e.target).hasClass('editable-field') ||
                $(e.target).closest('[data-editable="true"]').length > 0 ||
                $(e.target).closest('.pm-comment-indicator').length > 0 ||
                $(e.target).closest('.pm-review-note-indicator').length > 0 ||
                $(e.target).closest('.pm-clickable-engagement').length > 0) {
                return;
            }
            this.projectManager.openTaskDetails(e.currentTarget);
        });

        // Add Task button click - Updated for simple button
        $(document).on('click', '.pm-add-task-btn', (e) => {
            e.stopPropagation();
            this.projectManager.addNewTask(e.currentTarget);
        });

        // Editable field click - Handle different field types
        // This handler is for text fields with .editable-field class
        $(document).on('click', '.editable-field', (e) => {
            e.stopPropagation();
            this.editorsManager.startFieldEditing(e.currentTarget);
        });
        
        // Note: Person selector and other special fields are handled by 
        // editors.js initializeInlineEditing() method with [data-editable="true"] selector
        
        // Person avatar hover events with delay
        $(document).on('mouseenter', '.pm-avatar[data-email]', (e) => {
            clearTimeout(this.tooltipHideTimer);
            this.filterManager.showPersonTooltip(e.currentTarget);
        });
        
        $(document).on('mouseleave', '.pm-avatar[data-email]', () => {
            this.tooltipHideTimer = setTimeout(() => {
                if (!$('.pm-person-tooltip:hover').length) {
                    this.filterManager.hidePersonTooltip();
                }
            }, 300);
        });
        
        // Keep tooltip open when hovering over it
        $(document).on('mouseenter', '.pm-person-tooltip', () => {
            clearTimeout(this.tooltipHideTimer);
        });
        
        $(document).on('mouseleave', '.pm-person-tooltip', () => {
            this.tooltipHideTimer = setTimeout(() => {
                this.filterManager.hidePersonTooltip();
            }, 200);
        });

        // Main table tab click - Navigate to current page
        $(document).on('click', '.pm-tab[data-url]', (e) => {
            const url = $(e.currentTarget).data('url');
            if (url) {
                window.location.href = url;
            }
        });

        // New Task dropdown toggle
        $(document).on('click', '.pm-new-task-btn', (e) => {
            e.stopPropagation();
            this.filterManager.toggleNewTaskMenu();
        });

        // Quick add task
        $(document).on('click', '.pm-quick-add-task', (e) => {
            e.stopPropagation();
            this.projectManager.quickAddTask();
        });

        // New project
        $(document).on('click', '.pm-new-project', (e) => {
            e.stopPropagation();
            this.projectManager.createNewProject();
        });

        // Person filter dropdown toggle
        $(document).on('click', '.pm-person-filter-btn', (e) => {
            e.stopPropagation();
            this.filterManager.togglePersonFilter();
        });

        // Person option click
        $(document).on('click', '.pm-person-option', (e) => {
            e.stopPropagation();
            this.reportsManager.selectPersonFilter(e.currentTarget);
        });

        // Person search input
        $(document).on('input', '.pm-person-search-input', (e) => {
            this.reportsManager.searchPeople(e.target.value);
        });

        // Client filter dropdown toggle
        $(document).on('click', '.pm-client-filter-btn', (e) => {
            e.stopPropagation();
            this.filterManager.toggleClientFilter();
        });

        // Client filter option click
        $(document).on('click', '.pm-client-filter-menu .pm-filter-option', (e) => {
            e.stopPropagation();
            this.reportsManager.selectClientFilter(e.currentTarget);
        });

        // Client search input
        $(document).on('input', '.pm-client-search-input', (e) => {
            this.reportsManager.searchClients(e.target.value);
        });

        // Status filter dropdown toggle
        $(document).on('click', '.pm-status-filter-btn', (e) => {
            e.stopPropagation();
            this.filterManager.toggleStatusFilter();
        });

        // Status filter option click
        $(document).on('click', '.pm-status-filter-menu .pm-filter-option', (e) => {
            e.stopPropagation();
            this.reportsManager.selectStatusFilter(e.currentTarget);
        });

        // Comment indicator click
        $(document).on('click', '.pm-comment-indicator', (e) => {
            e.stopPropagation();
            const taskId = $(e.currentTarget).data('task-id');
            this.modalManager.showCommentModal(taskId);
        });

        // Review Note indicator click
        $(document).on('click', '.pm-review-note-indicator', (e) => {
            e.stopPropagation();
            const taskId = $(e.currentTarget).data('task-id');
            if (taskId) {
                this.modalManager.showReviewNoteModal(taskId);
            }
        });

        // Comment modal events
        $(document).on('click', '.pm-comment-modal-close', () => {
            this.modalManager.closeCommentModal();
        });

        $(document).on('click', '.pm-comment-modal', (e) => {
            if (e.target === e.currentTarget) {
                this.modalManager.closeCommentModal();
            }
        });

        $(document).on('click', '.pm-comment-submit', (e) => {
            e.preventDefault();
            this.modalManager.submitComment();
        });

        // Comment actions
        $(document).on('click', '.pm-comment-action[data-action="edit"]', (e) => {
            e.stopPropagation();
            const commentId = $(e.currentTarget).data('comment-id');
            this.editComment(commentId);
        });

        $(document).on('click', '.pm-comment-action[data-action="delete"]', (e) => {
            e.stopPropagation();
            const commentId = $(e.currentTarget).data('comment-id');
            this.modalManager.deleteComment(commentId);
        });

        // Engagement indicator clicks
        $(document).on('click', '.pm-engagement-indicator', (e) => {
            e.stopPropagation();
            const taskId = $(e.currentTarget).data('task-id');
            this.engagementManager.openEngagementModal(taskId);
        });

        // Unified dropdown management - close all when clicking outside
        $(document).on('click', (e) => {
            // Check if click is outside any dropdown (exclude workspace menus)
            const isOutsideDropdown = !$(e.target).closest('.pm-dropdown-container, .pm-new-task-dropdown, .pm-person-filter-dropdown, .pm-client-filter-dropdown, .pm-status-filter-dropdown, .pm-advanced-filter-dropdown, .pm-workspace-menu, .pm-workspace-submenu').length;
            
            if (isOutsideDropdown) {
                this.filterManager.closeAllDropdowns();
            }
        });
    }

    switchTab(tab) {
        $('.pm-tab').removeClass('active');
        $(tab).addClass('active');
        
        const view = $(tab).data('view');
        this.switchView(view);
    }

    switchView(view) {
        switch(view) {
            case 'main':
                this.showMainTable();
                break;
            case 'gantt':
                this.showGanttView();
                break;
            case 'calendar':
                this.showCalendarView();
                break;
        }
    }

    showMainTable() {
        $('.pm-table-container').show();
        // Hide other views if they exist
    }

    showGanttView() {
        this.showComingSoon('Gantt View');
    }

    showCalendarView() {
        this.showComingSoon('Calendar View');
    }

    showComingSoon(viewName) {
        const message = `
            <div class="pm-coming-soon">
                <i class="fa fa-clock-o"></i>
                <h3>${viewName} Coming Soon</h3>
                <p>This feature is under development</p>
            </div>
        `;
        $('.pm-table-container').html(message);
    }

    initializeFilters() {
        // Modern filters are implemented via dropdown menus, not select elements
        // This method is kept for compatibility but the actual filtering
        // is handled by toggleClientFilter(), toggleStatusFilter(), etc.
        
        // Load client list for dropdown filter
        this.loadClientList();
    }

    loadClientList() {
        // Populate client filter dropdown
        const clients = new Set();
        $('.pm-task-row').each(function() {
            const client = $(this).find('.pm-cell-client .client-display').text().trim();
            if (client && client !== 'No Client' && client !== 'Unassigned') {
                clients.add(client);
            }
        });

        const $clientList = $('.pm-client-list');
        $clientList.empty();
        
        // Add client options
        clients.forEach(client => {
            $clientList.append(`
                <div class="pm-filter-option" data-client-name="${client}">
                    <div class="pm-filter-icon">
                        <i class="fa fa-building"></i>
                    </div>
                    <span>${client}</span>
                </div>
            `);
        });
    }

    setupSearch() {
        this.reportsManager.setupSearch();
    }

    initializeInlineEditing() {
        this.editorsManager.initializeInlineEditing();
    }

    initializeColumnResizing() {
        this.tableManager.initializeColumnResizing();
    }

    initializeAdvancedFilter() {
        this.reportsManager.initializeAdvancedFilter();
        this.filterManager.bindAdvancedFilterEvents();
    }

    loadSystemOptions() {
        this.projectManager.loadSystemOptions();
    }

    initializeWorkspaceSwitcher() {
        this.workspaceManager.initializeWorkspaceSwitcher();
    }

    refreshReviewNoteCounts() {
        this.modalManager.refreshReviewNoteCounts();
    }

    applyPartitionColumnConfig() {
        this.tableManager.applyPartitionColumnConfig();
    }

    addColumnManagementButton() {
        this.filterManager.addColumnManagementButton();
    }

    bindMainDashboardEvents() {
        this.workspaceManager.bindMainDashboardEvents();
    }

    initializeSubtasks() {
        this.subtaskManager.initializeSubtasks();
        this.subtaskManager.loadSubtaskCounts();
    }

    initializeAutomateButton() {
        // Load automation count
        this.loadAutomationCount();
        
        // Bind click event
        $(document).on('click', '.pm-automate-btn', (e) => {
            e.preventDefault();
            this.showAutomateDialog();
        });
    }

    loadAutomationCount() {
        frappe.call({
            method: 'smart_accounting.www.project_management.index.get_automation_count',
            callback: (r) => {
                if (r.message && r.message.success) {
                    const count = r.message.count || 0;
                    $('#pm-automate-count').text(count);
                } else {
                    $('#pm-automate-count').text('0');
                }
            }
        });
    }

    showAutomateDialog() {
        // Show "Under Development" dialog
        const dialogHtml = `
            <div class="pm-automate-dialog" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 10000; display: flex; align-items: center; justify-content: center;">
                <div class="pm-dialog-overlay" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.5); backdrop-filter: blur(2px);"></div>
                <div class="pm-dialog-content" style="position: relative; background: white; border-radius: 12px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2); width: 400px; max-width: 90vw; z-index: 1;">
                    <div class="pm-dialog-header" style="display: flex; align-items: center; justify-content: space-between; padding: 24px 24px 16px; border-bottom: 1px solid #e1e5e9;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <i class="fa fa-robot" style="font-size: 20px; color: #667eea;"></i>
                            <h3 style="margin: 0; color: #2c3e50; font-size: 18px;">Automation</h3>
                        </div>
                        <button class="pm-dialog-close" type="button" style="background: none; border: none; font-size: 18px; color: #999; cursor: pointer; padding: 4px;">
                            <i class="fa fa-times"></i>
                        </button>
                    </div>
                    <div class="pm-dialog-body" style="padding: 24px; text-align: center;">
                        <div style="font-size: 48px; color: #667eea; margin-bottom: 16px;">
                            <i class="fa fa-cogs"></i>
                        </div>
                        <h4 style="margin: 0 0 12px 0; color: #2c3e50; font-size: 20px;">Under Development</h4>
                        <p style="margin: 0; color: #666; line-height: 1.5;">
                            Automation features are currently being developed. 
                            Stay tuned for powerful workflow automation capabilities!
                        </p>
                    </div>
                    <div class="pm-dialog-footer" style="padding: 16px 24px 24px; text-align: center;">
                        <button class="pm-btn pm-btn-primary pm-dialog-close" style="padding: 10px 24px; border-radius: 6px; border: none; background: #667eea; color: white; cursor: pointer;">
                            Got it
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Remove existing dialog
        $('.pm-automate-dialog').remove();
        
        // Add dialog to body
        $('body').append(dialogHtml);

        // Bind close events
        $(document).on('click', '.pm-automate-dialog .pm-dialog-close, .pm-automate-dialog .pm-dialog-overlay', () => {
            $('.pm-automate-dialog').remove();
        });
    }

    // Legacy method for comment editing (placeholder)
    editComment(commentId) {
        frappe.show_alert({
            message: 'Comment editing feature coming soon',
            indicator: 'blue'
        });
    }
}

// Context Menu Styles
const contextMenuStyles = `
<style>
.pm-context-menu {
    background: white;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    border: 1px solid var(--monday-border);
    min-width: 120px;
    overflow: hidden;
}

.pm-menu-item {
    padding: 8px 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 14px;
    transition: background-color 0.2s ease;
}

.pm-menu-item:hover {
    background: var(--monday-hover);
}

.pm-menu-color {
    width: 12px;
    height: 12px;
    border-radius: 2px;
}

.pm-coming-soon {
    text-align: center;
    padding: 60px 20px;
    color: var(--monday-gray);
}

.pm-coming-soon i {
    font-size: 48px;
    margin-bottom: 16px;
    color: var(--monday-blue);
}

.pm-coming-soon h3 {
    margin: 0 0 8px 0;
    color: var(--monday-dark);
}
</style>
`;

// Initialize when DOM is ready
$(document).ready(function() {
    // Add context menu styles
    $('head').append(contextMenuStyles);
    
    // Initialize project management
    window.projectManagement = new ProjectManagement();
    
    console.log('Project Management interface initialized');
});

// Export for module systems if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProjectManagement;
}
