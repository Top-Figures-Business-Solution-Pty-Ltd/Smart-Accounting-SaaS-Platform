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
        this.communicationMethodsSelectorManager = window.CommunicationMethodsSelectorManager;
        this.clientContactSelectorManager = window.ClientContactSelectorManager;
        this.workspaceManager = window.WorkspaceManager;
        this.subtaskManager = window.SubtaskManager;
        this.multiSelectManager = window.MultiSelectManager;
        this.combinationViewManager = window.CombinationViewManager;
        
        this.init();
    }

    async init() {
        
        // 启动增强加载系统
        if (window.EnhancedLoadingSystem) {
            window.EnhancedLoadingSystem.startLoading();
        }
        
        try {
            // 🚀 真实进度追踪：阶段1 - 初始化 (0-20%)
            this.updateLoadingProgress(10, "Initializing components...");
            
            // 等待布局预加载完成
            await this.waitForLayoutPreload();
            this.updateLoadingProgress(20, "Layout ready...");
            
            // 🚀 真实进度追踪：阶段2 - 配置加载 (20-40%)
            this.updateLoadingProgress(25, "Loading configuration...");
            this.bindEvents();
            this.initializeFilters();
            this.setupSearch();
            this.updateLoadingProgress(35, "Setting up interface...");
            
            this.initializeInlineEditing();
            this.initializeColumnResizing();
            this.initializeAdvancedFilter();
            this.updateLoadingProgress(40, "Configuring workspace...");
            
            // 🚀 真实进度追踪：阶段3 - 数据加载 (40-80%)
            this.updateLoadingProgress(45, "Loading workspace data...");
            // Load system options asynchronously - don't block main loading
            this.loadSystemOptionsAsync();
            this.initializeWorkspaceSwitcher();
            this.updateLoadingProgress(60, "Fetching task data...");
            
            // 🚀 真实进度追踪：阶段4 - 界面渲染 (60-90%)
            // Review Note counts are now loaded with main data - no separate API call needed
            this.initializeSubtasks();
            this.initializeMultiSelect();
            this.initializeCombinationView();
            this.initializePrimaryColumnManager();
            this.updateLoadingProgress(75, "Rendering interface...");
            
            // Apply partition column configuration after DOM is ready
            this.applyPartitionColumnConfig();
            this.addColumnManagementButton();
            this.initializeDisplayType();
            this.updateLoadingProgress(85, "Finalizing setup...");
            
            // 🚀 MONDAY.COM风格：立即显示页面，后台继续加载
            this.updateLoadingProgress(90, "Rendering interface...");
            
            // 立即显示页面框架，不等待所有数据
            this.updateLoadingProgress(100, "Ready!");
            this.finishLoading(); // 立即完成加载界面
            
            // 🚀 后台继续完成剩余任务（不阻塞用户界面）
            this.completeBackgroundTasks();
            
        } catch (error) {
            console.error('Loading error:', error);
            this.updateLoadingProgress(100, "Loading complete with errors");
            setTimeout(() => {
                this.finishLoading();
            }, 500);
        }
    }
    
    // 🚀 更新加载进度
    updateLoadingProgress(percentage, message) {
        if (window.EnhancedLoadingSystem) {
            window.EnhancedLoadingSystem.setProgress(percentage, message);
        }
    }
    
    // 🚀 等待数据真正加载完成 - 优化版本
    async waitForDataLoading() {
        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 10; // 减少到最多等待1秒 (10 * 100ms)
            
            const checkDataLoaded = () => {
                attempts++;
                
                // 多种方式检查数据是否加载完成
                const tableRows = document.querySelectorAll('.pm-table-row, .client-group, .pm-cell, tr[data-task-id]');
                const taskCells = document.querySelectorAll('[data-task-id], .task-name, .client-name');
                const hasVisibleData = tableRows.length > 0 || taskCells.length > 0;
                
                // 检查是否还有加载中的元素
                const loadingElements = document.querySelectorAll('.loading, .spinner, .pm-loading, .skeleton');
                const stillLoading = loadingElements.length > 0;
                
                // 检查表格容器是否存在且不为空
                const tableContainer = document.querySelector('.project-management-container, .pm-table-container');
                const containerReady = tableContainer && tableContainer.children.length > 0;
                
                if ((hasVisibleData || containerReady) && !stillLoading) {
                    // 数据已加载
                    resolve();
                } else if (attempts >= maxAttempts) {
                    // 超时强制完成 - 不能让用户等太久
                    console.log('Data loading timeout, forcing completion');
                    resolve();
                } else {
                    // 继续等待
                    setTimeout(checkDataLoaded, 100);
                }
            };
            
            // 立即开始检查
            checkDataLoaded();
        });
    }
    
    // 🚀 等待DOM完全渲染 - 优化版本
    async waitForDOMRender() {
        return new Promise((resolve) => {
            // 简化DOM渲染等待，减少不必要的延迟
            requestAnimationFrame(() => {
                resolve(); // 移除额外的延迟
            });
        });
    }
    
    // 等待布局预加载
    async waitForLayoutPreload() {
        return new Promise(async (resolve) => {
            if (window.LayoutPreloader && window.LayoutPreloader.isLoading()) {
                // 智能等待：根据数据量调整等待时间
                let waitTime = 500; // 默认500ms
                
                try {
                    const currentView = new URLSearchParams(window.location.search).get('view') || 'main';
                    const dataCount = await this.getDataCount(currentView);
                    
                    // 根据数据量调整骨架屏显示时间
                    if (dataCount > 1000) {
                        waitTime = 800; // 大数据集显示更久的骨架屏
                        this.enableLargeDataOptimizations();
                    } else if (dataCount < 50) {
                        waitTime = 200; // 小数据集快速切换
                    }
                } catch (error) {
                    // 使用默认时间
                }
                
                setTimeout(resolve, waitTime);
            } else {
                resolve();
            }
        });
    }
    
    // 智能数据加载（增强现有功能）
    async loadDataIntelligently(view) {
        try {
            // 使用增强的现有API
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.load_partition_data',
                args: { 
                    view: view, 
                    enable_adaptive_loading: true 
                }
            });
            
            if (response.message && response.message.success) {
                const data = response.message.data;
                const totalCount = response.message.total_count || 0;
                
                // 根据数据量自动启用优化
                if (totalCount > 1000) {
                    this.enableLargeDataOptimizations(totalCount);
                }
                
                return { data, totalCount, adaptiveUsed: response.message.adaptive_loading_used };
            }
        } catch (error) {
            // 智能加载失败，使用标准方法
        }
        
        return null;
    }
    
    // 启用大数据优化（增强现有功能，不破坏原有逻辑）
    enableLargeDataOptimizations(dataCount) {
        // 大数据集检测，启用优化组件
        
        // 增强现有的表格管理器
        if (this.tableManager) {
            this.tableManager.isLargeDataset = true;
            this.tableManager.dataCount = dataCount;
        }
        
        // 增强现有的缓存策略
        if (window.PersonSelectorManager) {
            window.PersonSelectorManager.cacheTimeout = 120000; // 2分钟缓存
        }
        
        // 启用现有的优化渲染器
        if (window.OptimizedTableRenderer) {
            const renderer = new OptimizedTableRenderer({
                container: '.pm-table-container',
                threshold: 500,
                bufferSize: 30,
                enableLazyLoading: true
            });
        }
        
        // 优化现有的组合视图
        if (this.combinationViewManager) {
            this.combinationViewManager.enableLargeDataMode = true;
        }
    }
    
    // 完成加载
    finishLoading() {
        // 🚀 通知Enhanced Loading System完成加载
        if (window.EnhancedLoadingSystem) {
            window.EnhancedLoadingSystem.forceComplete();
        }
        
        // 通知布局预加载器完成
        if (window.LayoutPreloader) {
            window.LayoutPreloader.finishLoading();
        }
        
        // 移除加载状态
        document.documentElement.classList.remove('pm-page-loading');
        document.body.classList.add('pm-loaded');
        
        // 触发自定义事件 - 这将通知增强加载系统完成
        const event = new CustomEvent('pm:loaded', {
            detail: { timestamp: Date.now() }
        });
        document.dispatchEvent(event);
        
        // 继续初始化其他功能
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
        // Multi-select functionality is already initialized in multiselect.js
        // Just reference the existing instance
        this.multiSelectInstance = window.multiSelectManager;
        
        if (!this.multiSelectInstance) {
            console.warn('MultiSelectManager instance not found');
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

    initializePrimaryColumnManager() {
        if (window.PrimaryColumnManager) {
            window.PrimaryColumnManager.initialize();
            // console.log Primary Column Manager initialized');
        } else {
            console.warn('⚠️ Primary Column Manager not available');
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
            
            // Check if this is a note field - use the new floating editor system
            const $cell = $(e.currentTarget).closest('.pm-cell');
            const fieldName = $cell.data('field');
            
            if (fieldName === 'custom_note') {
                // For note fields, trigger the cell-level editor instead
                this.editorsManager.makeEditable($cell[0]);
            } else {
                // For other fields, use the original system
                this.editorsManager.startFieldEditing(e.currentTarget);
            }
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

    // 🚀 异步加载系统选项 - 不阻塞主加载流程
    loadSystemOptionsAsync() {
        // 在后台异步加载，不影响主要加载流程
        setTimeout(() => {
            this.projectManager.loadSystemOptions();
        }, 100);
    }

    // 🚀 MONDAY.COM风格：后台完成剩余任务
    async completeBackgroundTasks() {
        try {
            // console.log Starting background tasks...');
            
            // 等待DOM完全渲染（但不阻塞用户界面）
            await this.waitForDOMRender();
            
            // 后台任务1：检查数据加载状态（非阻塞）
            setTimeout(() => {
                this.checkDataLoadingStatus();
            }, 500);
            
            // 后台任务2：延迟加载非关键功能
            setTimeout(() => {
                this.loadNonCriticalFeatures();
            }, 1000);
            
            // console.log Background tasks initiated');
        } catch (error) {
            console.warn('Background tasks error:', error);
        }
    }

    // 检查数据加载状态（非阻塞）
    checkDataLoadingStatus() {
        const tableRows = document.querySelectorAll('.pm-task-row[data-task-id]');
        console.log(`📊 Found ${tableRows.length} tasks in DOM`);
        
        if (tableRows.length === 0) {
            console.warn('⚠️ No task data found, page may need refresh');
        }
    }

    // 加载非关键功能
    loadNonCriticalFeatures() {
        console.log('🔧 Loading non-critical features...');
        // 这里可以加载Review Notes、额外的统计数据等
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

    initializeDisplayType() {
        this.tableManager.initializeDisplayType();
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
    
    // Project Management interface initialized
    
    // 开发者工具：仅在开发环境中启用
    if (frappe && frappe.user && typeof frappe.user.has_role === 'function') {
        try {
            if (frappe.user.has_role('System Manager') && frappe.boot.developer_mode) {
                // 开发者工具仅在开发模式下可用
                window.debugProcessDate = function() {
                    const headers = document.querySelectorAll('.pm-header-cell[data-column="process-date"]');
                    const cells = document.querySelectorAll('.pm-cell-process-date');
                    
                    headers.forEach(h => {
                        h.style.display = 'flex';
                        h.classList.remove('column-hidden');
                    });
                    cells.forEach(c => {
                        c.style.display = 'flex';
                        c.classList.remove('column-hidden');
                    });
                };
            }
        } catch (e) {
            // 权限检查失败，跳过开发者工具
        }
    }
});

// Export for module systems if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProjectManagement;
}
