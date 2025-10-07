// Project Management - Combination View Manager
// Manages the combination view functionality for displaying multiple boards together

class CombinationViewManager {
    constructor() {
        this.utils = window.PMUtils;
        this.selectedBoards = [];
        this.availableBoards = [];
        this.currentCombinationView = null;
        
        // 大数据量支持 - 自然集成
        this.enableLargeDataMode = false;
        this.renderingStrategy = 'standard'; // standard | chunked | virtual
    }

    // Initialize combination view functionality
    init() {
        this.bindEvents();
    }

    // Bind event handlers
    bindEvents() {
        // Combination view button click
        $(document).on('click', '.pm-combination-view-btn', (e) => {
            e.preventDefault();
            
            // Show development notice
            frappe.show_alert({
                message: '🚧 Combination View is in Beta. Some display issues may occur. Thank you for your patience!',
                indicator: 'orange'
            });
            
            // Still allow access to the feature
            setTimeout(() => {
                this.showBoardSelector();
            }, 1500);
        });

        // Modal close events
        $(document).on('click', '.pm-combination-modal-close, .pm-combination-cancel', (e) => {
            e.preventDefault();
            this.closeBoardSelector();
        });

        // Click outside modal to close
        $(document).on('click', '.pm-combination-modal-overlay', (e) => {
            if (e.target === e.currentTarget) {
                this.closeBoardSelector();
            }
        });

        // Board item selection
        $(document).on('change', '.pm-combination-board-checkbox', (e) => {
            const boardId = $(e.target).data('board-id');
            const boardName = $(e.target).data('board-name');
            const isChecked = $(e.target).is(':checked');

            if (isChecked) {
                this.addBoardToSelection(boardId, boardName);
            } else {
                this.removeBoardFromSelection(boardId);
            }
        });

        // Remove selected board
        $(document).on('click', '.pm-combination-remove-btn', (e) => {
            e.preventDefault();
            const boardId = $(e.target).data('board-id');
            this.removeBoardFromSelection(boardId);
            // Uncheck the corresponding checkbox
            $(`.pm-combination-board-checkbox[data-board-id="${boardId}"]`).prop('checked', false);
        });

        // Create combination view
        $(document).on('click', '.pm-combination-create', (e) => {
            e.preventDefault();
            this.createCombinationView();
        });

        // Disable manage columns button in combination view
        $(document).on('click', '.pm-manage-columns-btn', (e) => {
            if (window.location.search.includes('view=combination')) {
                e.preventDefault();
                frappe.show_alert({
                    message: 'Column management is not available in combination view. Please go to the specific board to manage columns.',
                    indicator: 'orange'
                });
            }
        });

        // Go to board link
        $(document).on('click', '.pm-combination-goto-board', (e) => {
            // Let the default link behavior handle navigation
        });
        
        // Save combination view button
        $(document).on('click', '.pm-save-combination-btn', (e) => {
            e.preventDefault();
            this.showSaveCombinationModal();
        });
        
        // Save combination modal events
        $(document).on('click', '.pm-save-combination-modal-close, .pm-save-combination-cancel', (e) => {
            e.preventDefault();
            this.closeSaveCombinationModal();
        });
        
        $(document).on('click', '.pm-save-combination-confirm', (e) => {
            e.preventDefault();
            this.saveCombinationView();
        });
        
        // Load saved combination
        $(document).on('click', '.pm-load-combination', (e) => {
            e.preventDefault();
            const combinationId = $(e.target).closest('.pm-load-combination').data('combination-id');
            this.loadSavedCombination(combinationId);
        });
        
        // Delete saved combination
        $(document).on('click', '.pm-delete-combination', (e) => {
            e.preventDefault();
            const combinationId = $(e.target).closest('.pm-delete-combination').data('combination-id');
            const combinationName = $(e.target).closest('.pm-saved-combination-item').find('.pm-saved-combination-name').text();
            this.deleteSavedCombination(combinationId, combinationName);
        });
        
    }

    // Show board selector modal
    async showBoardSelector() {
        try {
            // Load available boards and saved combinations
            await Promise.all([
                this.loadAvailableBoards(),
                this.loadSavedCombinations()
            ]);
            
            // Reset selection
            this.selectedBoards = [];
            
            // Render boards and saved combinations
            this.renderAvailableBoards();
            this.renderSavedCombinations();
            this.updateSelectedBoardsList();
            
            // Show modal
            $('#pm-combination-modal').fadeIn(300);
            
        } catch (error) {
            console.error('Error showing board selector:', error);
            frappe.show_alert({
                message: 'Error loading boards',
                indicator: 'red'
            });
        }
    }

    // Close board selector modal
    closeBoardSelector() {
        $('#pm-combination-modal').fadeOut(300);
        this.selectedBoards = [];
    }

    // Load available boards from backend
    async loadAvailableBoards() {
        try {
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.get_available_boards_for_combination'
            });

            if (response.message && response.message.success) {
                this.availableBoards = response.message.boards || [];
            } else {
                throw new Error(response.message?.error || 'Failed to load boards');
            }
        } catch (error) {
            console.error('Error loading boards:', error);
            this.availableBoards = [];
            throw error;
        }
    }
    
    // Load saved combinations from backend
    async loadSavedCombinations() {
        try {
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.get_saved_combinations'
            });

            if (response.message && response.message.success) {
                this.savedCombinations = response.message.combinations || [];
            } else {
                this.savedCombinations = [];
            }
        } catch (error) {
            console.error('Error loading saved combinations:', error);
            this.savedCombinations = [];
        }
    }

    // Render available boards in the selector
    renderAvailableBoards() {
        const $container = $('#pm-combination-boards');
        
        if (this.availableBoards.length === 0) {
            $container.html(`
                <div class="pm-combination-selected-empty">
                    <i class="fa fa-info-circle"></i>
                    <p>No boards available for combination view.</p>
                </div>
            `);
            return;
        }

        const boardsHtml = this.availableBoards.map(board => `
            <div class="pm-combination-board-item" data-board-id="${board.name}">
                <input type="checkbox" 
                       class="pm-combination-board-checkbox" 
                       data-board-id="${board.name}"
                       data-board-name="${board.partition_name}">
                <div class="pm-combination-board-info">
                    <div class="pm-combination-board-name">${board.partition_name}</div>
                    <div class="pm-combination-board-stats">
                        <span><i class="fa fa-folder"></i> ${board.project_count || 0} Projects</span>
                        <span><i class="fa fa-tasks"></i> ${board.task_count || 0} Tasks</span>
                    </div>
                </div>
            </div>
        `).join('');

        $container.html(boardsHtml);
    }
    
    // Render saved combinations in the selector
    renderSavedCombinations() {
        // Check if saved combinations section exists, if not create it
        if (!$('#pm-saved-combinations-section').length) {
            // Insert saved combinations section before the available boards
            $('#pm-combination-boards').before(`
                <div id="pm-saved-combinations-section" class="pm-saved-combinations-section">
                    <h4><i class="fa fa-bookmark"></i> Saved Combinations</h4>
                    <div id="pm-saved-combinations-list" class="pm-saved-combinations-list"></div>
                </div>
            `);
        }
        
        const $container = $('#pm-saved-combinations-list');
        
        if (!this.savedCombinations || this.savedCombinations.length === 0) {
            $container.html(`
                <div class="pm-no-saved-combinations">
                    <i class="fa fa-info-circle"></i>
                    <p>No saved combinations yet. Create one by selecting boards below.</p>
                </div>
            `);
            return;
        }
        
        const combinationsHtml = this.savedCombinations.map(combination => {
            const lastUsed = combination.last_used ? 
                new Date(combination.last_used).toLocaleDateString() : 
                new Date(combination.creation).toLocaleDateString();
            
            return `
                <div class="pm-saved-combination-item" data-combination-id="${combination.name}">
                    <div class="pm-saved-combination-info">
                        <div class="pm-saved-combination-name">${combination.view_name}</div>
                        <div class="pm-saved-combination-details">
                            <span><i class="fa fa-table"></i> ${combination.board_count} Boards</span>
                            <span><i class="fa fa-eye"></i> Used ${combination.usage_count || 0} times</span>
                            <span><i class="fa fa-clock-o"></i> ${lastUsed}</span>
                        </div>
                        ${combination.description ? `<div class="pm-saved-combination-description">${combination.description}</div>` : ''}
                    </div>
                    <div class="pm-saved-combination-actions">
                        <button class="pm-load-combination pm-btn pm-btn-primary" data-combination-id="${combination.name}" title="Load this combination">
                            <i class="fa fa-play"></i>
                            Load
                        </button>
                        <button class="pm-delete-combination pm-btn pm-btn-danger" data-combination-id="${combination.name}" title="Delete this combination">
                            <i class="fa fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        $container.html(combinationsHtml);
    }

    // Add board to selection
    addBoardToSelection(boardId, boardName) {
        if (!this.selectedBoards.find(b => b.id === boardId)) {
            this.selectedBoards.push({
                id: boardId,
                name: boardName,
                order: this.selectedBoards.length + 1
            });
            this.updateSelectedBoardsList();
            this.updateCreateButton();
        }
    }

    // Remove board from selection
    removeBoardFromSelection(boardId) {
        this.selectedBoards = this.selectedBoards.filter(b => b.id !== boardId);
        // Reorder remaining boards
        this.selectedBoards.forEach((board, index) => {
            board.order = index + 1;
        });
        this.updateSelectedBoardsList();
        this.updateCreateButton();
    }

    // Update selected boards list display
    updateSelectedBoardsList() {
        const $container = $('#pm-combination-selected-list');
        const $count = $('#pm-selected-count');
        
        $count.text(this.selectedBoards.length);

        if (this.selectedBoards.length === 0) {
            $container.html(`
                <div class="pm-combination-selected-empty">
                    Select boards from the list above to create a combination view
                </div>
            `);
            return;
        }

        const selectedHtml = this.selectedBoards.map(board => `
            <div class="pm-combination-selected-item">
                <div class="pm-combination-selected-info">
                    <div class="pm-combination-selected-order">${board.order}</div>
                    <div class="pm-combination-selected-name">${board.name}</div>
                </div>
                <button class="pm-combination-remove-btn" data-board-id="${board.id}" title="Remove">
                    <i class="fa fa-times"></i>
                </button>
            </div>
        `).join('');

        $container.html(selectedHtml);
    }

    // Update create button state
    updateCreateButton() {
        const $createBtn = $('.pm-combination-create');
        if (this.selectedBoards.length > 0) {
            $createBtn.prop('disabled', false);
        } else {
            $createBtn.prop('disabled', true);
        }
    }

    // Create combination view
    async createCombinationView() {
        if (this.selectedBoards.length === 0) {
            frappe.show_alert({
                message: 'Please select at least one board',
                indicator: 'orange'
            });
            return;
        }

        try {
            // Show loading
            $('.pm-combination-create').prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i> Creating...');

            // Create combination view URL
            const boardIds = this.selectedBoards.map(b => b.id);
            // Properly encode board names for URL
            const encodedBoardIds = boardIds.map(id => encodeURIComponent(id));
            const combinationUrl = `/project_management?view=combination&boards=${encodedBoardIds.join(',')}`;
            
            console.log('DEBUG: Creating combination URL with boards:', boardIds);
            console.log('DEBUG: Encoded boards:', encodedBoardIds);
            console.log('DEBUG: Final URL:', combinationUrl);
            
            // Navigate to combination view
            window.location.href = combinationUrl;

        } catch (error) {
            console.error('Error creating combination view:', error);
            frappe.show_alert({
                message: 'Error creating combination view',
                indicator: 'red'
            });
            $('.pm-combination-create').prop('disabled', false).html('<i class="fa fa-eye"></i> Create Combination View');
        }
    }

    // Initialize combination view page (when viewing combination)
    initCombinationViewPage(boardIds) {
        this.currentCombinationView = boardIds;
        this.loadCombinationViewData(boardIds);
    }

    // Load combination view data
    async loadCombinationViewData(boardIds) {
        console.log('DEBUG: loadCombinationViewData called with:', boardIds);
        
        console.log('🚀 COMBINATION VIEW: Starting data load for boards:', boardIds);
        
        try {
            console.log('DEBUG: Making API call to get_combination_view_data');
            console.log('DEBUG: boardIds parameter type:', typeof boardIds);
            console.log('DEBUG: boardIds parameter value:', boardIds);
            console.log('DEBUG: boardIds parameter JSON:', JSON.stringify(boardIds));
            
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.get_combination_view_data',
                args: {
                    board_ids: boardIds
                }
            });

            console.log('DEBUG: API response:', response);
            console.log('DEBUG: API response type:', typeof response);
            console.log('DEBUG: API response.message:', response.message);

            if (response.message && response.message.success) {
                console.log('DEBUG: Success, boards_data:', response.message.boards_data);
                console.log('DEBUG: Debug info:', response.message.debug_info);
                
                // Show detailed debug info
                if (response.message.debug_info) {
                    console.log('DEBUG: Requested boards:', response.message.debug_info.requested_boards);
                    console.log('DEBUG: Found boards count:', response.message.debug_info.found_boards);
                    console.log('DEBUG: Board names found:', response.message.debug_info.board_names);
                    
                    // Show search details for each requested board
                    if (response.message.debug_info.search_details) {
                        console.log('🔍 SEARCH DETAILS:');
                        response.message.debug_info.search_details.forEach((detail, index) => {
                            console.log(`  ${index + 1}. Requested: "${detail.requested}" | Found: ${detail.found} | Method: ${detail.method || 'none'}`);
                        });
                    }
                    
                    // Show all partitions from database
                    if (response.message.debug_info.all_partitions) {
                        console.log('🗃️ ALL AVAILABLE BOARDS IN DATABASE:');
                        response.message.debug_info.all_partitions.forEach((p, index) => {
                            console.log(`  ${index + 1}. name: "${p.name}", display: "${p.partition_name}", workspace: ${p.is_workspace}, archived: ${p.is_archived}`);
                        });
                    }
                }
                
                this.renderCombinationView(response.message.boards_data);
            } else {
                console.error('DEBUG: API call failed:', response.message);
                if (response.message && response.message.debug_info) {
                    console.error('DEBUG: Error details:', response.message.debug_info);
                }
                throw new Error(response.message?.error || 'Failed to load combination view data');
            }
        } catch (error) {
            console.error('Error loading combination view data:', error);
            frappe.show_alert({
                message: 'Error loading combination view data: ' + error.message,
                indicator: 'red'
            });
        }
    }

    // Render combination view with multiple boards
    renderCombinationView(boardsData) {
        console.log('DEBUG: renderCombinationView called with:', boardsData);
        console.log('DEBUG: boardsData length:', boardsData ? boardsData.length : 'undefined');
        
        // Clean up any existing board-specific CSS
        $('#pm-board-specific-styles').remove();
        $('#pm-board-table-styles').remove();
        
        // Update the badge count with CLS protection
        const $badge = $('.pm-combination-board-badge');
        const newText = `${boardsData.length} Boards`;
        
        // 使用内容容器更新，保持尺寸稳定
        const $content = $badge.find('.pm-badge-content');
        if ($content.length) {
            $content.text(newText);
        } else {
            $badge.text(newText);
        }
        
        // 移除骨架屏类
        $badge.removeClass('pm-badge-skeleton');
        
        // Add save combination button if not exists
        if (!$('.pm-save-combination-btn').length) {
            $('.pm-combination-view-title').append(`
                <button class="pm-save-combination-btn pm-btn pm-btn-primary" style="margin-left: 15px;">
                    <i class="fa fa-bookmark"></i>
                    Save This View
                </button>
            `);
        }
        
        // Calculate total projects and tasks
        let totalProjects = 0;
        let totalTasks = 0;
        boardsData.forEach(board => {
            totalProjects += board.total_projects || 0;
            totalTasks += board.total_tasks || 0;
        });
        
        // Update header statistics
        $('.pm-view-stats').text(`(View: combination | Projects: ${totalProjects} | Tasks: ${totalTasks})`);
        
        
        // Update existing summary stats (不再动态创建，避免CLS)
        const $summary = $('.pm-summary');
        if ($summary.length) {
            // 平滑更新数字，避免布局跳跃
            const $projectsNum = $summary.find('.pm-stat:first-child .pm-stat-number');
            const $tasksNum = $summary.find('.pm-stat:last-child .pm-stat-number');
            
            if ($projectsNum.text() !== totalProjects.toString()) {
                $projectsNum.text(totalProjects);
            }
            if ($tasksNum.text() !== totalTasks.toString()) {
                $tasksNum.text(totalTasks);
            }
        }
        
        const $container = $('#pm-combination-boards-container');
        console.log('DEBUG: Container found:', $container.length > 0);
        
        // 隐藏骨架屏，准备显示真实内容
        const $skeleton = $container.find('.pm-combination-skeleton');
        if ($skeleton.length) {
            $skeleton.addClass('pm-hidden');
        }
        
        let boardsHtml = '';
        
        // Render each board section
        boardsData.forEach((boardData, index) => {
            console.log(`DEBUG: Rendering board ${index}:`, boardData);
            boardsHtml += this.renderBoardSection(boardData, index);
        });
        
        console.log('DEBUG: Generated HTML length:', boardsHtml.length);
        
        // CLS优化：零布局偏移的内容替换
        if ($skeleton.length) {
            // 测量骨架屏的精确尺寸
            const skeletonRect = $skeleton[0].getBoundingClientRect();
            const containerRect = $container[0].getBoundingClientRect();
            
            // 创建真实内容容器，确保尺寸完全一致
            const $realContent = $('<div class="pm-combination-real-content pm-cls-protected"></div>');
            
            // 设置与骨架屏完全相同的尺寸和位置
            $realContent.css({
                'position': 'absolute',
                'top': '0',
                'left': '0',
                'width': skeletonRect.width + 'px',
                'height': skeletonRect.height + 'px',
                'opacity': '0',
                'z-index': '1'
            });
            
            $realContent.html(boardsHtml);
            
            // 将容器设为相对定位
            $container.css('position', 'relative');
            
            // 先添加真实内容（完全隐藏）
            $container.append($realContent);
            
            // 等待真实内容完全渲染
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    // 同时进行透明度切换，确保无缝
                    $skeleton.css({
                        'opacity': '0',
                        'transition': 'opacity 0.2s ease-out'
                    });
                    $realContent.css({
                        'opacity': '1',
                        'transition': 'opacity 0.2s ease-in'
                    });
                    
                    // 切换完成后清理
                    setTimeout(() => {
                        $skeleton.remove();
                        $realContent.css({
                            'position': 'static',
                            'width': 'auto',
                            'height': 'auto',
                            'z-index': 'auto'
                        });
                        $realContent.addClass('pm-transition-complete');
                        $container.css('position', 'static');
                        
                        console.log('✅ Content transition completed without CLS');
                    }, 200);
                });
            });
        } else {
            // 如果没有骨架屏，直接设置内容
            $container.html(boardsHtml);
        }

        // 保存板块数量信息供下次预加载使用
        try {
            localStorage.setItem('board_count_combination', boardsData.length.toString());
        } catch (e) {
            console.warn('Could not save board count:', e);
        }
        
        // Initialize table functionality for each board
        this.initializeBoardTables(boardsData);
        
        // 立即应用列宽，避免延迟闪烁
        requestAnimationFrame(() => {
            this.forceColumnWidthApplication(boardsData);
            this.debugRenderedStructure(boardsData);
        });
    }

    // Render individual board section
    renderBoardSection(boardData, index) {
        const taskCount = this.calculateTaskCount(boardData.tasks);
        
        const boardHtml = `
            <div class="pm-combination-board-section" data-board-id="${boardData.board_id}">
                <div class="pm-combination-board-header">
                    <div class="pm-combination-board-title-row">
                        <div class="pm-combination-board-title-left">
                        <i class="fa fa-table"></i>
                        <h3>${boardData.board_name}</h3>
                        <span class="pm-combination-board-badge pm-badge-stable" style="min-width: 80px; height: 24px;">${taskCount} Tasks</span>
                        <a href="/project_management?view=${boardData.board_id}" 
                           class="pm-combination-goto-board" 
                           target="_blank">
                            Open Board
                        </a>
                        </div>
                    </div>
                </div>
                <div class="pm-combination-board-table" data-board-id="${boardData.board_id}">
                    ${this.renderBoardTable(boardData)}
                </div>
            </div>
        `;
        
        return boardHtml;
    }
    
    // Calculate total task count from organized data
    calculateTaskCount(organizedData) {
        let totalTasks = 0;
        if (organizedData && typeof organizedData === 'object') {
            Object.values(organizedData).forEach(projects => {
                if (projects && typeof projects === 'object') {
                    Object.values(projects).forEach(tasks => {
                        if (Array.isArray(tasks)) {
                            totalTasks += tasks.length;
                        }
                    });
                }
            });
        }
        return totalTasks;
    }

    // Render board table with full project management structure
    renderBoardTable(boardData) {
        console.log('🔍 DEBUG: renderBoardTable called for board:', boardData.board_id);
        console.log('🔍 DEBUG: boardData.tasks structure:', boardData.tasks);
        console.log('🔍 DEBUG: boardData.tasks keys:', Object.keys(boardData.tasks || {}));
        
        if (!boardData.tasks || Object.keys(boardData.tasks).length === 0) {
            console.log('❌ No tasks data found for board:', boardData.board_id);
            return `
                <div class="pm-empty-board">
                    <i class="fa fa-inbox"></i>
                    <p>No tasks found in this board</p>
                </div>
            `;
        }
        
        let tableHtml = '';
        let projectCount = 0;
        
        // Render each client's projects and tasks
        Object.entries(boardData.tasks).forEach(([clientName, projects]) => {
            console.log(`🔍 Processing client: ${clientName}`, projects);
            
            if (projects && typeof projects === 'object') {
                Object.entries(projects).forEach(([projectName, tasks]) => {
                    console.log(`🔍 Processing project: ${projectName}`, tasks);
                    
                    if (tasks && Array.isArray(tasks) && tasks.length > 0) {
                        console.log(`✅ Rendering project: ${projectName} with ${tasks.length} tasks`);
                        console.log(`🔍 Tasks data for ${projectName}:`, tasks.map(t => ({
                            name: t.name || t.subject,
                            client: t.client_name,
                            status: t.status
                        })));
                        tableHtml += this.renderProjectSection(clientName, projectName, tasks, boardData);
                        projectCount++;
                    } else {
                        console.log(`⚠️ Skipping project ${projectName}: no valid tasks`);
                        console.log(`🔍 Invalid tasks data:`, tasks);
                    }
                });
            } else {
                console.log(`⚠️ Skipping client ${clientName}: invalid projects structure`);
            }
        });
        
        console.log(`🔍 Total projects rendered: ${projectCount}`);
        console.log(`🔍 Generated HTML length: ${tableHtml.length}`);
        
        if (!tableHtml) {
            console.log('❌ No valid projects found to render');
            return `
                <div class="pm-empty-board">
                    <i class="fa fa-info-circle"></i>
                    <p>No tasks to display in this board</p>
                </div>
            `;
        }
        
        return tableHtml;
    }
    
    // Render project section for a board
    renderProjectSection(clientName, projectName, tasks, boardData) {
        console.log(`🏗️ Rendering project section: ${projectName} (${tasks.length} tasks) for board ${boardData.board_id}`);
        
        const taskRowsHtml = this.renderTaskRows(tasks, boardData);
        console.log(`🔍 Task rows HTML length: ${taskRowsHtml.length}`);
        
        const projectHtml = `
            <div class="pm-project-group pm-combination-project" data-client="${clientName}" data-project="${projectName}" data-board-id="${boardData.board_id}">
                <div class="pm-project-header">
                    <div class="pm-project-title">
                        <i class="fa fa-chevron-down pm-expand-icon"></i>
                        <div class="pm-project-color-bar project-color-${Math.abs(this.hashCode(projectName)) % 6}"></div>
                        <span class="pm-project-name">${projectName}</span>
                        <span class="pm-task-count">${tasks.length} Task${tasks.length !== 1 ? 's' : ''}</span>
                    </div>
                </div>
                
                <!-- Project Table Header -->
                <div class="pm-project-table-header pm-responsive-table pm-combination-table-header" data-board-id="${boardData.board_id}">
                    ${this.renderTableHeader(boardData)}
                </div>
                
                <!-- Project Tasks -->
                <div class="pm-task-group" style="display: block !important; width: 100% !important;">
                    ${taskRowsHtml}
                </div>
            </div>
        `;
        
        console.log(`✅ Project section rendered for: ${projectName}`);
        console.log(`🔍 First 500 chars of project HTML:`, projectHtml.substring(0, 500));
        return projectHtml;
    }
    
    // Render table header based on board's column configuration
    renderTableHeader(boardData) {
        const columnConfig = boardData.column_config || {};
        // Use board's visible columns or fallback to default set
        const visibleColumns = columnConfig.visible_columns || this.getDefaultVisibleColumns();
        
        let headerHtml = `
            <div class="pm-header-cell pm-cell-select" data-column="select">
                <input type="checkbox" class="pm-select-all-checkbox" title="Select all tasks in this project">
            </div>
        `;
        
        visibleColumns.forEach(column => {
            const columnName = this.getColumnDisplayName(column);
            headerHtml += `
                <div class="pm-header-cell pm-cell-${column}" data-column="${column}">
                    <span>${columnName}</span>
                    <div class="pm-column-resizer"></div>
                </div>
            `;
        });
        
        return headerHtml;
    }
    
    // Get default visible columns if none configured
    getDefaultVisibleColumns() {
        return [
            'client', 'task-name', 'entity', 'tf-tg', 'software', 'status', 
            'note', 'target-month', 'priority'
        ];
    }
    
    // Render task rows
    renderTaskRows(tasks, boardData) {
        console.log(`🔍 renderTaskRows called with ${tasks.length} tasks for board ${boardData.board_id}`);
        
        const columnConfig = boardData.column_config || {};
        const visibleColumns = columnConfig.visible_columns || this.getDefaultVisibleColumns();
        
        console.log(`🔍 Visible columns for board ${boardData.board_id}:`, visibleColumns);
        
        // Ensure tasks is always an array
        if (!Array.isArray(tasks)) {
            console.warn(`⚠️ Tasks is not an array for board ${boardData.board_id}:`, tasks);
            return '';
        }
        
        const taskRowsHtml = tasks.map((task, index) => {
            console.log(`🔍 Rendering task ${index + 1}/${tasks.length}: ${task.name || task.subject}`);
            
            // Ensure each task row is properly structured with explicit styling
            let rowHtml = `
                <div class="pm-task-row pm-combination-task-row" 
                     data-task-id="${task.name}" 
                     data-board-id="${boardData.board_id}"
                     style="display: flex !important; width: 100% !important; clear: both !important;">
                    <div class="pm-cell pm-cell-select" data-column="select">
                        <input type="checkbox" class="pm-task-checkbox" value="${task.name}">
                    </div>
            `;
            
            visibleColumns.forEach(column => {
                rowHtml += this.renderTaskCell(task, column, boardData);
            });
            
            rowHtml += '</div>';
            return rowHtml;
        }).join('\n'); // Use newlines to separate task rows for better debugging
        
        console.log(`✅ Generated ${tasks.length} task rows, HTML length: ${taskRowsHtml.length}`);
        console.log(`🔍 First 200 chars of HTML:`, taskRowsHtml.substring(0, 200));
        return taskRowsHtml;
    }
    
    // Render individual task cell - EXACT copy from table.html logic
    renderTaskCell(task, column, boardData) {
        const taskId = task.name;
        
        // Use the unified cell renderer to ensure 100% consistency with normal board view
        let cellHtml = this.renderUnifiedTaskCell(task, column, taskId);
        
        // Ensure data-column attribute is present for CSS column width targeting
        if (!cellHtml.includes('data-column=')) {
            cellHtml = cellHtml.replace('<div class="pm-cell', `<div class="pm-cell" data-column="${column}"`);
        }
        
        return cellHtml;
    }
    
    // Unified cell renderer that matches table.html exactly
    renderUnifiedTaskCell(task, column, taskId) {
        switch (column) {
            case 'select':
                return `
                    <div class="pm-cell pm-cell-select" data-column="select">
                        <input type="checkbox" class="pm-task-checkbox" data-task-id="${taskId}" title="Select this task">
                    </div>
                `;
    
            case 'client':
                return `
                    <div class="pm-cell pm-cell-client pm-client-with-comments"
                         data-field="custom_client"
                         data-task-id="${taskId}"
                         data-current-client-id="${task.custom_client || ''}"
                         data-current-client-name="${task.client_name || 'No Client'}">
                        <div class="pm-client-content">
                            <button class="pm-subtask-toggle" data-task-id="${taskId}" title="Show/hide subtasks">
                                <i class="fa fa-chevron-right"></i>
                            </button>
                            <span class="pm-client-selector-trigger client-display" 
                                  data-task-id="${taskId}"
                                  data-field="custom_client"
                                  data-field-type="client_selector"
                                  data-current-client-id="${task.custom_client || ''}"
                                  data-current-client-name="${task.client_name || 'No Client'}"
                                  title="Click to select client">${task.client_name || 'No Client'}</span>
                        </div>
                        <div class="pm-client-comments">
                            <div class="pm-comment-indicator" data-task-id="${taskId}" title="点击查看或添加评论">
                                <i class="fa fa-comment-o"></i>
                                <span class="pm-comment-count">${task.comment_count || 0}</span>
                            </div>
                        </div>
                    </div>
                `;
            
            case 'task-name':
                return `
                    <div class="pm-cell pm-cell-task-name pm-editable-task-name"
                         data-editable="true"
                         data-field="subject"
                         data-task-id="${taskId}"
                         data-field-type="task_name_editor"
                         data-current-task-name="${task.task_name || task.subject || ''}">
                        <div class="pm-task-name-content">
                            <span class="editable-field task-name-display">${task.task_name || task.subject || 'Untitled Task'}</span>
                            <i class="fa fa-edit pm-edit-icon"></i>
                        </div>
                    </div>
                `;
            
            case 'entity':
                const entityType = task.entity_type || 'Company';
                return `
                    <div class="pm-cell pm-cell-entity">
                        <span class="pm-entity-badge entity-${entityType.toLowerCase()}">
                            ${entityType}
                        </span>
                    </div>
                `;
            
            case 'tf-tg':
                return `
                    <div class="pm-cell pm-cell-tf-tg" 
                         data-editable="true" 
                         data-field="custom_tftg" 
                         data-task-id="${taskId}"
                         data-field-type="select"
                         data-options="TF,TG"
                         data-backend-options="Top Figures,Top Grants">
                        <span class="pm-tf-tg-badge editable-field">${task.custom_tftg || task.tf_tg || 'TF'}</span>
                    </div>
                `;
            
            case 'software':
                // Exact match with table.html logic
                if (task.software_info && task.software_info.length > 0) {
                    if (task.software_info.length === 1) {
                        return `
                            <div class="pm-cell pm-cell-software"
                                 data-editable="true"
                                 data-field="custom_softwares" 
                                 data-task-id="${taskId}"
                                 data-field-type="software_selector">
                                <div class="pm-software-tags">
                                    <span class="pm-software-badge pm-primary-software">${task.software_info[0].software}</span>
                                </div>
                            </div>
                        `;
                    } else {
                        const primarySoftware = task.software_info.find(s => s.is_primary) || task.software_info[0];
                        return `
                            <div class="pm-cell pm-cell-software"
                                 data-editable="true"
                                 data-field="custom_softwares" 
                                 data-task-id="${taskId}"
                                 data-field-type="software_selector">
                                <div class="pm-software-tags">
                                    <span class="pm-software-badge pm-primary-software">${primarySoftware.software}</span>
                                    <span class="pm-software-more">+${task.software_info.length - 1}</span>
                                </div>
                            </div>
                        `;
                    }
                } else {
                    return `
                        <div class="pm-cell pm-cell-software"
                             data-editable="true"
                             data-field="custom_softwares" 
                             data-task-id="${taskId}"
                             data-field-type="software_selector">
                            <div class="pm-software-tags pm-empty-software">
                                <span class="pm-software-badge pm-empty-badge">
                                    <i class="fa fa-plus"></i>
                                    Add software
                                </span>
                            </div>
                        </div>
                    `;
                }
            
            case 'status':
                // Exact match with table.html - no editable attributes, just display
                const status = task.status || 'Open';
                const statusClass = status ? status.toLowerCase().replace(/\s+/g, '-') : 'open';
                return `
                    <div class="pm-cell pm-cell-status">
                        <span class="pm-status-badge status-${statusClass}">${status}</span>
                    </div>
                `;
            
            case 'note':
                return `
                    <div class="pm-cell pm-cell-note"
                         data-editable="true"
                         data-field="custom_note"
                         data-task-id="${taskId}"
                         data-field-type="text">
                        <span class="editable-field">${task.custom_note || '-'}</span>
                    </div>
                `;
            
            case 'review-note':
                // Exact match with table.html
                if (task.review_notes && task.review_notes.length > 0) {
                    return `
                        <div class="pm-cell pm-cell-review-note">
                            <div class="pm-review-note-indicator has-notes" data-task-id="${taskId}" title="点击查看所有Review Notes">
                                <i class="fa fa-check-circle"></i>
                                <span>${task.review_notes.length} note${task.review_notes.length !== 1 ? 's' : ''}</span>
                            </div>
                        </div>
                    `;
                } else {
                    return `
                        <div class="pm-cell pm-cell-review-note">
                            <div class="pm-review-note-indicator no-notes" data-task-id="${taskId}">
                                <i class="fa fa-times-circle"></i>
                                <span>none</span>
                            </div>
                        </div>
                    `;
                }
            
            case 'action-person':
                // Exact match with table.html structure
                if (task.action_person_info && task.action_person_info.length > 0) {
                    if (task.action_person_info.length === 1) {
                        const person = task.action_person_info[0];
                        return `
                            <div class="pm-cell pm-cell-action-person" 
                                 data-editable="true" 
                                 data-field="custom_action_person" 
                                 data-task-id="${taskId}"
                                 data-field-type="person_selector"
                                 data-role-filter="${window.AppConfig?.mapFieldToRole('action_person') || 'Action Person'}">
                                <div class="pm-user-avatars">
                                    <div class="pm-avatar pm-primary-user" title="${person.full_name}" data-email="${person.email}">${person.initials}</div>
                                </div>
                            </div>
                        `;
                    } else {
                        const primaryPerson = task.action_person_info[0];
                        return `
                            <div class="pm-cell pm-cell-action-person" 
                                 data-editable="true" 
                                 data-field="custom_action_person" 
                                 data-task-id="${taskId}"
                                 data-field-type="person_selector"
                                 data-role-filter="${window.AppConfig?.mapFieldToRole('action_person') || 'Action Person'}">
                                <div class="pm-user-avatars">
                                    <div class="pm-avatar pm-primary-user" title="${primaryPerson.full_name}" data-email="${primaryPerson.email}">${primaryPerson.initials}</div>
                                    <div class="pm-avatar-more" title="Total ${task.action_person_info.length} people assigned">+${task.action_person_info.length - 1}</div>
                                </div>
                            </div>
                        `;
                    }
                } else {
                    return `
                        <div class="pm-cell pm-cell-action-person" 
                             data-editable="true" 
                             data-field="custom_action_person" 
                             data-task-id="${taskId}"
                             data-field-type="person_selector"
                             data-role-filter="Action Person">
                            <div class="pm-user-avatars pm-empty-person">
                                <div class="pm-avatar pm-empty-avatar">
                                    <i class="fa fa-user"></i>
                                </div>
                            </div>
                        </div>
                    `;
                }
            
            case 'preparer':
                // Exact match with table.html structure
                if (task.preparer_info && task.preparer_info.length > 0) {
                    if (task.preparer_info.length === 1) {
                        const person = task.preparer_info[0];
                        return `
                            <div class="pm-cell pm-cell-preparer" 
                                 data-editable="true" 
                                 data-field="custom_preparer" 
                                 data-task-id="${taskId}"
                                 data-field-type="person_selector"
                                 data-role-filter="${window.AppConfig?.mapFieldToRole('preparer') || 'Preparer'}">
                                <div class="pm-user-avatars">
                                    <div class="pm-avatar pm-primary-user" title="${person.full_name}" data-email="${person.email}">${person.initials}</div>
                                </div>
                            </div>
                        `;
                    } else {
                        const primaryPerson = task.preparer_info[0];
                        return `
                            <div class="pm-cell pm-cell-preparer" 
                                 data-editable="true" 
                                 data-field="custom_preparer" 
                                 data-task-id="${taskId}"
                                 data-field-type="person_selector"
                                 data-role-filter="${window.AppConfig?.mapFieldToRole('preparer') || 'Preparer'}">
                                <div class="pm-user-avatars">
                                    <div class="pm-avatar pm-primary-user" title="${primaryPerson.full_name}" data-email="${primaryPerson.email}">${primaryPerson.initials}</div>
                                    <div class="pm-avatar-more" title="Total ${task.preparer_info.length} people assigned">+${task.preparer_info.length - 1}</div>
                                </div>
                            </div>
                        `;
                    }
                } else {
                    return `
                        <div class="pm-cell pm-cell-preparer" 
                             data-editable="true" 
                             data-field="custom_preparer" 
                             data-task-id="${taskId}"
                             data-field-type="person_selector"
                             data-role-filter="Preparer">
                            <div class="pm-user-avatars pm-empty-person">
                                <div class="pm-avatar pm-empty-avatar">
                                    <i class="fa fa-user"></i>
                                </div>
                            </div>
                        </div>
                    `;
                }
            
            case 'reviewer':
                // Exact match with table.html structure
                if (task.reviewer_info && task.reviewer_info.length > 0) {
                    if (task.reviewer_info.length === 1) {
                        const person = task.reviewer_info[0];
                        return `
                            <div class="pm-cell pm-cell-reviewer" 
                                 data-editable="true" 
                                 data-field="custom_reviewer" 
                                 data-task-id="${taskId}"
                                 data-field-type="person_selector"
                                 data-role-filter="${window.AppConfig?.mapFieldToRole('reviewer') || 'Reviewer'}">
                                <div class="pm-user-avatars">
                                    <div class="pm-avatar pm-primary-user" title="${person.full_name}" data-email="${person.email}">${person.initials}</div>
                                </div>
                            </div>
                        `;
                    } else {
                        const primaryPerson = task.reviewer_info[0];
                        return `
                            <div class="pm-cell pm-cell-reviewer" 
                                 data-editable="true" 
                                 data-field="custom_reviewer" 
                                 data-task-id="${taskId}"
                                 data-field-type="person_selector"
                                 data-role-filter="${window.AppConfig?.mapFieldToRole('reviewer') || 'Reviewer'}">
                                <div class="pm-user-avatars">
                                    <div class="pm-avatar pm-primary-user" title="${primaryPerson.full_name}" data-email="${primaryPerson.email}">${primaryPerson.initials}</div>
                                    <div class="pm-avatar-more" title="Total ${task.reviewer_info.length} people assigned">+${task.reviewer_info.length - 1}</div>
                                </div>
                            </div>
                        `;
                    }
                } else {
                    return `
                        <div class="pm-cell pm-cell-reviewer" 
                             data-editable="true" 
                             data-field="custom_reviewer" 
                             data-task-id="${taskId}"
                             data-field-type="person_selector"
                             data-role-filter="Reviewer">
                            <div class="pm-user-avatars pm-empty-person">
                                <div class="pm-avatar pm-empty-avatar">
                                    <i class="fa fa-user"></i>
                                </div>
                            </div>
                        </div>
                    `;
                }
            
            case 'partner':
                // Exact match with table.html structure
                if (task.partner_info && task.partner_info.length > 0) {
                    if (task.partner_info.length === 1) {
                        const person = task.partner_info[0];
                        return `
                            <div class="pm-cell pm-cell-partner" 
                                 data-editable="true" 
                                 data-field="custom_partner" 
                                 data-task-id="${taskId}"
                                 data-field-type="person_selector"
                                 data-role-filter="${window.AppConfig?.mapFieldToRole('partner') || 'Partner'}">
                                <div class="pm-user-avatars">
                                    <div class="pm-avatar pm-primary-user" title="${person.full_name}" data-email="${person.email}">${person.initials}</div>
                                </div>
                            </div>
                        `;
                    } else {
                        const primaryPerson = task.partner_info[0];
                        return `
                            <div class="pm-cell pm-cell-partner" 
                                 data-editable="true" 
                                 data-field="custom_partner" 
                                 data-task-id="${taskId}"
                                 data-field-type="person_selector"
                                 data-role-filter="${window.AppConfig?.mapFieldToRole('partner') || 'Partner'}">
                                <div class="pm-user-avatars">
                                    <div class="pm-avatar pm-primary-user" title="${primaryPerson.full_name}" data-email="${primaryPerson.email}">${primaryPerson.initials}</div>
                                    <div class="pm-avatar-more" title="Total ${task.partner_info.length} people assigned">+${task.partner_info.length - 1}</div>
                                </div>
                            </div>
                        `;
                    }
                } else {
                    return `
                        <div class="pm-cell pm-cell-partner" 
                             data-editable="true" 
                             data-field="custom_partner" 
                             data-task-id="${taskId}"
                             data-field-type="person_selector"
                             data-role-filter="Partner">
                            <div class="pm-user-avatars pm-empty-person">
                                <div class="pm-avatar pm-empty-avatar">
                                    <i class="fa fa-user"></i>
                                </div>
                            </div>
                        </div>
                    `;
                }
            
            case 'target-month':
                // Exact match with table.html
                return `
                    <div class="pm-cell pm-cell-target-month"
                         data-editable="true"
                         data-field="custom_target_month"
                         data-task-id="${taskId}"
                         data-field-type="select"
                         data-options-source="dynamic">
                        <span class="editable-field">${task.target_month || '-'}</span>
                    </div>
                `;
            
            case 'budget':
                // Exact match with table.html
                if (task.budget_planning && task.budget_planning > 0) {
                    return `
                        <div class="pm-cell pm-cell-budget"
                             data-editable="true"
                             data-field="custom_budget_planning"
                             data-task-id="${taskId}"
                             data-field-type="currency">
                            <span class="pm-currency editable-field">$${parseFloat(task.budget_planning).toFixed(2)}</span>
                        </div>
                    `;
                } else {
                    return `
                        <div class="pm-cell pm-cell-budget"
                             data-editable="true"
                             data-field="custom_budget_planning"
                             data-task-id="${taskId}"
                             data-field-type="currency">
                            <span class="pm-no-amount editable-field">-</span>
                        </div>
                    `;
                }
            
            case 'actual':
                // Exact match with table.html
                if (task.actual_billing && task.actual_billing > 0) {
                    return `
                        <div class="pm-cell pm-cell-actual"
                             data-editable="true"
                             data-field="custom_actual_billing"
                             data-task-id="${taskId}"
                             data-field-type="currency">
                            <span class="pm-currency editable-field">$${parseFloat(task.actual_billing).toFixed(2)}</span>
                        </div>
                    `;
                } else {
                    return `
                        <div class="pm-cell pm-cell-actual"
                             data-editable="true"
                             data-field="custom_actual_billing"
                             data-task-id="${taskId}"
                             data-field-type="currency">
                            <span class="pm-no-amount editable-field">-</span>
                        </div>
                    `;
                }
            
            case 'engagement':
                // Exact match with table.html - engagement indicator with click functionality
                return `
                    <div class="pm-cell pm-cell-engagement pm-engagement-indicator"
                         data-task-id="${taskId}"
                         data-current-engagement="${task.custom_engagement || ''}">
                        <div class="pm-engagement-content">
                            ${task.custom_engagement ? 
                                `<span class="pm-engagement-display">${task.engagement_el_count || 0} EL${(task.engagement_el_count || 0) !== 1 ? 's' : ''}</span>` :
                                `<span class="pm-engagement-display no-engagement">No engagement</span>`
                            }
                        </div>
                    </div>
                `;
            
            case 'lodgment-due':
                // Exact match with table.html - uses custom_lodgement_due_date
                return `
                    <div class="pm-cell pm-cell-lodgment-due"
                         data-editable="true"
                         data-field="custom_lodgement_due_date"
                         data-task-id="${taskId}"
                         data-field-type="date">
                        <span class="editable-field">${task.lodgment_due_date || '-'}</span>
                    </div>
                `;
            
            case 'group':
                // Exact match with table.html - group display (not editable)
                return `
                    <div class="pm-cell pm-cell-group">
                        <div class="pm-group-content">
                            <span class="pm-group-display">${task.client_group || '-'}</span>
                        </div>
                    </div>
                `;
            
            case 'year-end':
                // Exact match with table.html
                return `
                    <div class="pm-cell pm-cell-year-end"
                         data-editable="true"
                         data-field="custom_year_end"
                         data-task-id="${taskId}"
                         data-field-type="select"
                         data-options-source="dynamic">
                        <span class="editable-field">${task.year_end || '-'}</span>
                    </div>
                `;
            
            case 'last-updated':
                // Exact match with table.html
                return `
                    <div class="pm-cell pm-cell-last-updated">
                        ${task.last_updated ? 
                            `<span class="pm-last-updated">${task.last_updated}</span>` :
                            `<span class="pm-no-date">-</span>`
                        }
                    </div>
                `;
            
            case 'priority':
                // Exact match with table.html - priority is NOT editable, just display
                const priority = task.priority || 'Medium';
                return `
                    <div class="pm-cell pm-cell-priority">
                        <span class="pm-priority-badge priority-${priority.toLowerCase()}">${priority}</span>
                    </div>
                `;
            
            case 'frequency':
                // Exact match with table.html - uses data-options-source
                return `
                    <div class="pm-cell pm-cell-frequency"
                         data-editable="true"
                         data-field="custom_frequency"
                         data-task-id="${taskId}"
                         data-field-type="select"
                         data-options-source="custom_frequency">
                        <span class="editable-field">${task.custom_frequency || '-'}</span>
                    </div>
                `;
            
            case 'reset-date':
                // Exact match with table.html
                return `
                    <div class="pm-cell pm-cell-reset-date"
                         data-editable="true"
                         data-field="custom_reset_date"
                         data-task-id="${taskId}"
                         data-field-type="date">
                        <span class="editable-field">${task.reset_date || '-'}</span>
                    </div>
                `;
            
            default:
                // For other columns, use simple editable field
                const defaultFieldName = this.getFieldName(column);
                const defaultFieldValue = task[defaultFieldName] || '-';
                const isDefaultEditable = this.isCellEditable(column);
                return `
                    <div class="pm-cell pm-cell-${column}" 
                         ${isDefaultEditable ? 'data-editable="true"' : ''}
                         data-field="${defaultFieldName}"
                         data-task-id="${taskId}"
                         data-field-type="text">
                        <span class="editable-field">${defaultFieldValue}</span>
                    </div>
                `;
        }
    }
    
    
    // Show save combination modal
    showSaveCombinationModal() {
        // Create modal if not exists
        if (!$('#pm-save-combination-modal').length) {
            const modalHtml = `
                <div class="pm-save-combination-modal-overlay" id="pm-save-combination-modal">
                    <div class="pm-save-combination-modal">
                        <div class="pm-save-combination-modal-header">
                            <h3>Save Combination View</h3>
                            <button class="pm-save-combination-modal-close">
                                <i class="fa fa-times"></i>
                            </button>
                        </div>
                        <div class="pm-save-combination-modal-body">
                            <div class="pm-form-group">
                                <label for="pm-combination-name">View Name *</label>
                                <input type="text" id="pm-combination-name" class="form-control" placeholder="Enter view name" required>
                            </div>
                            <div class="pm-form-group">
                                <label for="pm-combination-description">Description</label>
                                <textarea id="pm-combination-description" class="form-control" rows="3" placeholder="Optional description"></textarea>
                            </div>
                            <div class="pm-form-group">
                                <label class="pm-checkbox-label">
                                    <input type="checkbox" id="pm-combination-public"> Make this view public (visible to all users)
                                </label>
                            </div>
                            <div class="pm-current-boards">
                                <h4>Current Boards:</h4>
                                <div id="pm-current-boards-list"></div>
                            </div>
                        </div>
                        <div class="pm-save-combination-modal-footer">
                            <button class="pm-btn pm-btn-secondary pm-save-combination-cancel">Cancel</button>
                            <button class="pm-btn pm-btn-primary pm-save-combination-confirm">
                                <i class="fa fa-bookmark"></i>
                                Save View
                            </button>
                        </div>
                    </div>
                </div>
            `;
            $('body').append(modalHtml);
        }
        
        // Populate current boards
        const currentBoards = this.currentCombinationView || [];
        const boardsList = currentBoards.map(boardId => {
            // Try to get display name from rendered boards
            const $boardSection = $(`.pm-combination-board-section[data-board-id="${boardId}"]`);
            const boardName = $boardSection.find('h3').text() || boardId;
            return `<div class="pm-board-item"><i class="fa fa-table"></i> ${boardName}</div>`;
        }).join('');
        
        $('#pm-current-boards-list').html(boardsList || '<div class="pm-no-boards">No boards selected</div>');
        
        // Clear form
        $('#pm-combination-name').val('');
        $('#pm-combination-description').val('');
        $('#pm-combination-public').prop('checked', false);
        
        // Show modal
        $('#pm-save-combination-modal').fadeIn(300);
        $('#pm-combination-name').focus();
    }
    
    // Close save combination modal
    closeSaveCombinationModal() {
        $('#pm-save-combination-modal').fadeOut(300);
    }
    
    // Save combination view
    async saveCombinationView() {
        const viewName = $('#pm-combination-name').val().trim();
        const description = $('#pm-combination-description').val().trim();
        const isPublic = $('#pm-combination-public').is(':checked') ? 1 : 0;
        
        if (!viewName) {
            frappe.show_alert({
                message: 'Please enter a view name',
                indicator: 'red'
            });
            $('#pm-combination-name').focus();
            return;
        }
        
        if (!this.currentCombinationView || this.currentCombinationView.length === 0) {
            frappe.show_alert({
                message: 'No boards to save',
                indicator: 'red'
            });
            return;
        }
        
        try {
            // First test DocType configuration
            console.log('🧪 Testing DocType configuration...');
            const testResponse = await frappe.call({
                method: 'smart_accounting.www.project_management.index.test_combination_doctype'
            });
            
            console.log('🧪 DocType test result:', testResponse.message);
            
            if (!testResponse.message || !testResponse.message.success) {
                throw new Error(testResponse.message?.error || 'DocType configuration test failed');
            }
            
            // Show loading
            $('.pm-save-combination-confirm').prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i> Saving...');
            
            console.log('💾 Saving combination with data:', {
                view_name: viewName,
                description: description,
                board_ids: this.currentCombinationView,
                is_public: isPublic
            });
            
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.save_combination_view',
                args: {
                    view_name: viewName,
                    description: description,
                    board_ids: JSON.stringify(this.currentCombinationView),
                    is_public: isPublic
                }
            });
            
            console.log('💾 Save response:', response.message);
            
            if (response.message && response.message.success) {
                frappe.show_alert({
                    message: response.message.message,
                    indicator: 'green'
                });
                this.closeSaveCombinationModal();
            } else {
                throw new Error(response.message?.error || 'Failed to save combination view');
            }
            
        } catch (error) {
            console.error('❌ Error saving combination view:', error);
            frappe.show_alert({
                message: 'Error saving combination view: ' + error.message,
                indicator: 'red'
            });
        } finally {
            $('.pm-save-combination-confirm').prop('disabled', false).html('<i class="fa fa-bookmark"></i> Save View');
        }
    }
    
    // Load saved combination
    async loadSavedCombination(combinationId) {
        try {
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.load_combination_view',
                args: {
                    combination_id: combinationId
                }
            });
            
            if (response.message && response.message.success) {
                const boardIds = response.message.board_ids;
                const combinationName = response.message.combination_name;
                
                // Navigate to combination view with these boards
                const encodedBoardIds = boardIds.map(id => encodeURIComponent(id));
                const combinationUrl = `/project_management?view=combination&boards=${encodedBoardIds.join(',')}`;
                
                frappe.show_alert({
                    message: `Loading "${combinationName}"...`,
                    indicator: 'blue'
                });
                
                window.location.href = combinationUrl;
                
            } else {
                throw new Error(response.message?.error || 'Failed to load combination view');
            }
            
        } catch (error) {
            console.error('Error loading combination view:', error);
            frappe.show_alert({
                message: 'Error loading combination view: ' + error.message,
                indicator: 'red'
            });
        }
    }
    
    // Helper methods
    getColumnDisplayName(column) {
        const columnNames = {
            'client': 'Client Name',
            'task-name': 'Task Name',
            'entity': 'Entity',
            'tf-tg': 'TF/TG',
            'software': 'Software',
            'status': 'Status',
            'note': 'Note',
            'review-note': 'Review Note',
            'target-month': 'Target Month',
            'budget': 'Budget',
            'actual': 'Actual',
            'action-person': window.AppConfig?.mapFieldToRole('action_person') || 'Action Person',
            'preparer': window.AppConfig?.mapFieldToRole('preparer') || 'Preparer',
            'reviewer': window.AppConfig?.mapFieldToRole('reviewer') || 'Reviewer',
            'partner': window.AppConfig?.mapFieldToRole('partner') || 'Partner',
            'lodgment-due': 'Lodgment Due',
            'engagement': 'Engagement',
            'group': 'Group',
            'year-end': 'Year End',
            'last-updated': 'Last Updated',
            'priority': 'Priority',
            'frequency': 'Frequency',
            'reset-date': 'Reset Date'
        };
        return columnNames[column] || column.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    
    getFieldName(column) {
        const fieldNames = {
            'client': 'custom_client',
            'task-name': 'subject',
            'entity': 'entity_type',
            'tf-tg': 'custom_tftg',
            'software': 'custom_softwares',
            'status': 'status',
            'note': 'custom_note',
            'review-note': 'custom_review_note',
            'target-month': 'custom_target_month',
            'budget': 'custom_budget',
            'actual': 'custom_actual',
            'action-person': 'custom_action_person',
            'preparer': 'custom_preparer',
            'reviewer': 'custom_reviewer',
            'partner': 'custom_partner',
            'lodgment-due': 'custom_lodgment_due',
            'engagement': 'custom_engagement',
            'group': 'custom_group',
            'year-end': 'custom_year_end',
            'priority': 'priority',
            'frequency': 'custom_frequency',
            'reset-date': 'custom_reset_date'
        };
        return fieldNames[column] || `custom_${column.replace(/-/g, '_')}`;
    }
    
    isCellEditable(column) {
        const editableColumns = [
            'client', 'task-name', 'status', 'entity', 'tf-tg', 'software', 'note', 
            'target-month', 'budget', 'actual', 'action-person', 'preparer', 
            'reviewer', 'partner', 'lodgment-due', 'engagement', 'group', 
            'year-end', 'priority', 'frequency', 'reset-date'
        ];
        return editableColumns.includes(column);
    }
    
    getStatusClass(status) {
        if (!status) return 'open';
        return status.toLowerCase().replace(/\s+/g, '-');
    }
    
    hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash;
    }

    // Initialize table functionality for each board
    initializeBoardTables(boardsData) {
        // Initialize table managers for each board
        boardsData.forEach(boardData => {
            const boardId = boardData.board_id;
            
            // Apply board-specific column widths
            this.applyBoardColumnWidths(boardId, boardData.column_config);
            
            // DON'T initialize column resizing in combination view
            // this.initializeBoardColumnResizing(boardId);
            
            // Initialize project expand/collapse for this board
            this.initializeBoardProjectToggle(boardId);
        });
        
        // Enable cell editing for all boards (but restrict column management)
        this.initializeCombinationCellEditing();
        
        // Hide column resizers in combination view
        $('.pm-combination-board-section .pm-column-resizer').hide();
        
        // 立即同步列宽，避免延迟
        requestAnimationFrame(() => {
            boardsData.forEach(boardData => {
                this.ensureColumnWidthSync(boardData.board_id);
            });
            
            // Debug output after initialization
            console.log('🎯 Combination view initialized with perfect header-body alignment');
            console.log('💡 Tip: Use debugCombinationColumnWidths() in console to see alignment details');
            this.debugColumnWidths();
            
            // Make debug function available globally
            window.debugCombinationColumnWidths = () => this.debugColumnWidths();
            
            // Also call the global table manager sync if available
            if (window.TableManager && window.TableManager.forceColumnWidthSync) {
                window.TableManager.forceColumnWidthSync();
            }
        });
    }
    
    // Apply column widths specific to each board with complete independence
    applyBoardColumnWidths(boardId, columnConfig) {
        console.log(`🔧 Applying independent column widths for board: ${boardId}`, columnConfig);
        
        // Get visible columns for this specific board
        const visibleColumns = columnConfig?.visible_columns || this.getDefaultVisibleColumns();
        
        // Calculate total table width for this board
        let totalBoardWidth = 0;
        
        // Apply column widths if available
        if (columnConfig && columnConfig.column_widths) {
            const columnWidths = columnConfig.column_widths;
            console.log(`📏 Found saved column widths for ${boardId}:`, columnWidths);
            
            // Apply saved widths to visible columns only
            visibleColumns.forEach(column => {
                const width = columnWidths[column] || this.getDefaultColumnWidth(column);
                this.setColumnWidth(boardId, column, width);
                totalBoardWidth += width;
            });
        } else {
            console.log(`📏 No saved widths for ${boardId}, using optimized defaults`);
            // Apply optimized default widths based on visible columns count
            visibleColumns.forEach(column => {
                const width = this.getOptimizedColumnWidth(column, visibleColumns.length);
                this.setColumnWidth(boardId, column, width);
                totalBoardWidth += width;
            });
        }
        
        // 立即应用列宽设置，保持项目结构
        requestAnimationFrame(() => {
            this.applyGentleColumnWidths(boardId, visibleColumns, totalBoardWidth);
        });
    }
    
    // Get optimized column width based on total columns count
    getOptimizedColumnWidth(column, totalColumns) {
        const baseWidths = this.getDefaultColumnWidth(column);
        
        // If board has fewer columns, allow wider columns
        if (totalColumns <= 6) {
            return Math.max(baseWidths, baseWidths * 1.2);
        } else if (totalColumns <= 10) {
            return baseWidths;
        } else {
            // Many columns, use slightly smaller widths
            return Math.max(80, baseWidths * 0.9);
        }
    }
    
    // Apply gentle column widths that don't break project structure
    applyGentleColumnWidths(boardId, visibleColumns, totalBoardWidth) {
        const $boardSection = $(`.pm-combination-board-section[data-board-id="${boardId}"]`);
        
        console.log(`🕊️ Applying gentle column widths for board: ${boardId}`);
        
        // Only apply column widths to cells, not to containers
        visibleColumns.forEach(column => {
            const width = this.getOptimizedColumnWidth(column, visibleColumns.length);
            this.applyGentleColumnWidth(boardId, column, width);
        });
        
        console.log(`✅ Gentle column widths applied to board: ${boardId}`);
    }
    
    // Apply column width gently without breaking structure
    applyGentleColumnWidth(boardId, column, width) {
        const widthPx = width + 'px';
        
        // Use specific selectors that don't interfere with project structure
        const headerCells = $(`.pm-combination-board-section[data-board-id="${boardId}"] .pm-project-table-header .pm-header-cell[data-column="${column}"]`);
        const bodyCells = $(`.pm-combination-board-section[data-board-id="${boardId}"] .pm-task-group .pm-cell[data-column="${column}"]`);
        
        // Apply width only to cells, not containers
        headerCells.css({
            'width': widthPx,
            'min-width': widthPx,
            'flex': `0 0 ${widthPx}`
        });
        
        bodyCells.css({
            'width': widthPx,
            'min-width': widthPx,
            'flex': `0 0 ${widthPx}`
        });
        
        console.log(`🎯 Gentle width applied: ${column} = ${widthPx} (${headerCells.length} headers, ${bodyCells.length} cells)`);
    }
    
    // Set board-specific table width while preserving project structure
    setBoardTableWidth(boardId, totalWidth) {
        const $boardSection = $(`.pm-combination-board-section[data-board-id="${boardId}"]`);
        
        const tableWidthPx = totalWidth + 'px';
        console.log(`📐 Setting table width for board ${boardId}: ${tableWidthPx} (preserving project structure)`);
        
        // Create board-specific table width CSS class
        const boardTableClass = `pm-board-${boardId.replace(/[^a-zA-Z0-9]/g, '_')}-table`;
        
        // Apply to each project's table elements individually to preserve structure
        $boardSection.find('.pm-project-group').each((index, projectGroup) => {
            const $projectGroup = $(projectGroup);
            const $projectTableHeader = $projectGroup.find('.pm-project-table-header');
            const $projectTasks = $projectGroup.find('.pm-task-group');
            const $projectTaskRows = $projectGroup.find('.pm-combination-task-row');
            
            // Add class to project-specific table elements
            $projectTableHeader.addClass(boardTableClass);
            $projectTasks.addClass(boardTableClass);
            $projectTaskRows.addClass(boardTableClass);
            
            // Apply inline styles to each project's table elements
            const tableCSS = {
                'width': tableWidthPx + ' !important',
                'min-width': tableWidthPx + ' !important',
                'max-width': tableWidthPx + ' !important'
            };
            
            $projectTableHeader.css(tableCSS);
            $projectTasks.css(tableCSS);
            $projectTaskRows.css(tableCSS);
            
            // Ensure project group structure is preserved
            $projectGroup.css({
                'margin-bottom': '1rem',
                'display': 'block',
                'clear': 'both',
                'width': '100%'
            });
        });
        
        // Create CSS rule for perfect synchronization
        this.createBoardTableWidthCSS(boardTableClass, tableWidthPx);
        
        console.log(`✅ Table width applied to ${$boardSection.find('.pm-project-group').length} projects in board ${boardId}`);
    }
    
    // Create board-specific table width CSS rules
    createBoardTableWidthCSS(className, widthPx) {
        // Check if style element exists, create if not
        let $styleElement = $('#pm-board-table-styles');
        if ($styleElement.length === 0) {
            $styleElement = $('<style id="pm-board-table-styles"></style>');
            $('head').append($styleElement);
        }
        
        // Get current CSS content
        let cssContent = $styleElement.html();
        
        // Remove existing rule for this class if it exists
        const classRegex = new RegExp(`\\.${className}\\s*\\{[^}]*\\}`, 'g');
        cssContent = cssContent.replace(classRegex, '');
        
        // Add new rule with maximum specificity for perfect alignment
        const newRule = `
            .pm-combination-board-section .${className} {
                width: ${widthPx} !important;
                min-width: ${widthPx} !important;
                max-width: ${widthPx} !important;
                display: flex !important;
            }
        `;
        
        cssContent += newRule;
        $styleElement.html(cssContent);
        
        console.log(`📝 Created table width CSS rule for ${className}: ${widthPx}`);
    }
    
    // Set column width for both header and content cells with complete board independence
    setColumnWidth(boardId, column, width) {
        const widthPx = width + 'px';
        console.log(`🎯 Setting independent width for board ${boardId}, column ${column}: ${widthPx}`);
        
        // Create board-specific CSS class name to ensure complete independence
        const boardSpecificClass = `pm-board-${boardId.replace(/[^a-zA-Z0-9]/g, '_')}-col-${column.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        // Use highly specific selectors to ensure board independence
        const headerSelector = `.pm-combination-board-section[data-board-id="${boardId}"] .pm-combination-table-header .pm-header-cell[data-column="${column}"]`;
        const cellSelector = `.pm-combination-board-section[data-board-id="${boardId}"] .pm-task-group .pm-cell[data-column="${column}"]`;
        
        // Add board-specific class to elements
        $(headerSelector).addClass(boardSpecificClass);
        $(cellSelector).addClass(boardSpecificClass);
        
        // Create or update board-specific CSS rule with highest specificity
        this.createBoardSpecificCSS(boardSpecificClass, widthPx);
        
        // Apply inline styles with !important to ensure independence
        const cssProps = {
            'width': widthPx + ' !important',
            'min-width': widthPx + ' !important',
            'max-width': widthPx + ' !important',
            'flex': `0 0 ${widthPx} !important`,
            'box-sizing': 'border-box !important'
        };
        
        $(headerSelector).css(cssProps);
        $(cellSelector).css(cssProps);
        
        console.log(`✅ Applied independent width to ${$(headerSelector).length} headers and ${$(cellSelector).length} cells with class ${boardSpecificClass}`);
    }
    
    // Create board-specific CSS rules dynamically
    createBoardSpecificCSS(className, widthPx) {
        // Check if style element exists, create if not
        let $styleElement = $('#pm-board-specific-styles');
        if ($styleElement.length === 0) {
            $styleElement = $('<style id="pm-board-specific-styles"></style>');
            $('head').append($styleElement);
        }
        
        // Get current CSS content
        let cssContent = $styleElement.html();
        
        // Remove existing rule for this class if it exists
        const classRegex = new RegExp(`\\.${className}\\s*\\{[^}]*\\}`, 'g');
        cssContent = cssContent.replace(classRegex, '');
        
        // Add new rule with maximum specificity
        const newRule = `
            .pm-combination-board-section .${className} {
                width: ${widthPx} !important;
                min-width: ${widthPx} !important;
                max-width: ${widthPx} !important;
                flex: 0 0 ${widthPx} !important;
                box-sizing: border-box !important;
            }
        `;
        
        cssContent += newRule;
        $styleElement.html(cssContent);
        
        console.log(`📝 Created CSS rule for ${className}: ${widthPx}`);
    }
    
    // Clean up board-specific CSS when boards are removed
    cleanupBoardSpecificCSS(boardId) {
        const $styleElement = $('#pm-board-specific-styles');
        if ($styleElement.length === 0) return;
        
        const boardPrefix = `pm-board-${boardId.replace(/[^a-zA-Z0-9]/g, '_')}`;
        let cssContent = $styleElement.html();
        
        // Remove all CSS rules for this board
        const boardRegex = new RegExp(`\\.${boardPrefix}-[^\\s{]*\\s*\\{[^}]*\\}`, 'g');
        cssContent = cssContent.replace(boardRegex, '');
        
        $styleElement.html(cssContent);
        console.log(`🧹 Cleaned up CSS rules for board: ${boardId}`);
    }
    
    // Debug method to show current column widths and table widths for all boards
    debugColumnWidths() {
        console.log('🔍 DEBUG: Independent column and table widths for all boards:');
        
        $('.pm-combination-board-section').each((index, boardSection) => {
            const $boardSection = $(boardSection);
            const boardId = $boardSection.data('board-id');
            const boardName = $boardSection.find('h3').text();
            
            // Get table dimensions
            const $tableHeader = $boardSection.find('.pm-combination-table-header');
            const tableWidth = $tableHeader.outerWidth();
            const visibleColumns = $boardSection.find('.pm-combination-table-header .pm-header-cell').length;
            
            console.log(`\n📋 Board: ${boardName} (ID: ${boardId})`);
            console.log(`📐 Table Width: ${tableWidth}px | Visible Columns: ${visibleColumns}`);
            
            let totalCalculatedWidth = 0;
            $boardSection.find('.pm-combination-table-header .pm-header-cell').each((cellIndex, headerCell) => {
                const $headerCell = $(headerCell);
                const column = $headerCell.data('column');
                const headerWidth = $headerCell.outerWidth();
                
                if (column) {
                    // Check corresponding body cell width
                    const $bodyCell = $boardSection.find(`.pm-task-group .pm-cell[data-column="${column}"]`).first();
                    const bodyWidth = $bodyCell.length ? $bodyCell.outerWidth() : 0;
                    const isAligned = Math.abs(headerWidth - bodyWidth) <= 1;
                    
                    console.log(`  📏 ${column}: Header ${headerWidth}px | Body ${bodyWidth}px ${isAligned ? '✅' : '❌'}`);
                    totalCalculatedWidth += headerWidth;
                }
            });
            
            console.log(`📊 Total Width: ${totalCalculatedWidth}px | Table Width: ${tableWidth}px`);
        });
        
        // Also show the CSS rules
        const $styleElement = $('#pm-board-specific-styles');
        if ($styleElement.length > 0) {
            console.log('\n📝 Board-specific CSS rules:');
            console.log($styleElement.html());
        }
    }
    
    // Ensure perfect column width synchronization between header and content for specific board
    ensureColumnWidthSync(boardId) {
        const $boardSection = $(`.pm-combination-board-section[data-board-id="${boardId}"]`);
        const $headerCells = $boardSection.find('.pm-combination-table-header .pm-header-cell');
        
        console.log(`🔄 Ensuring perfect header-body sync for board: ${boardId}`);
        
        // Force immediate layout calculation
        $boardSection[0].offsetHeight; // Trigger reflow
        
        let totalSyncedWidth = 0;
        $headerCells.each((index, headerCell) => {
            const $headerCell = $(headerCell);
            const column = $headerCell.data('column');
            
            if (!column) return;
            
            // Get the actual rendered width of the header cell
            let actualWidth = $headerCell.outerWidth();
            
            // If no width is set, use a reasonable default based on column type
            if (!actualWidth || actualWidth < 50) {
                actualWidth = this.getDefaultColumnWidth(column);
            }
            
            console.log(`📐 Board ${boardId}, Column ${column}: ${actualWidth}px`);
            
            // Apply this width with perfect synchronization
            this.setColumnWidth(boardId, column, actualWidth);
            totalSyncedWidth += actualWidth;
        });
        
        // Re-sync table width after column sync
        this.setBoardTableWidth(boardId, totalSyncedWidth);
        
        // Force final layout recalculation with staggered timing
        setTimeout(() => {
            // First, hide and show to trigger reflow
            $boardSection.find('.pm-combination-table-header, .pm-task-group').each(function() {
                this.style.display = 'none';
                this.offsetHeight; // Trigger reflow
                this.style.display = this.classList.contains('pm-task-group') ? 'block' : 'flex';
            });
            
            // Then ensure all cells are perfectly aligned
            setTimeout(() => {
                this.forceHeaderBodyAlignment(boardId);
            }, 50);
        }, 10);
    }
    
    // Force perfect header-body alignment for a specific board
    forceHeaderBodyAlignment(boardId) {
        const $boardSection = $(`.pm-combination-board-section[data-board-id="${boardId}"]`);
        const $headerCells = $boardSection.find('.pm-combination-table-header .pm-header-cell');
        
        console.log(`🎯 Forcing perfect alignment for board: ${boardId}`);
        
        $headerCells.each((index, headerCell) => {
            const $headerCell = $(headerCell);
            const column = $headerCell.data('column');
            
            if (!column) return;
            
            // Get header width
            const headerWidth = $headerCell.outerWidth();
            
            // Find corresponding body cells and ensure they match exactly
            const $bodyCells = $boardSection.find(`.pm-task-group .pm-cell[data-column="${column}"]`);
            
            $bodyCells.each((cellIndex, bodyCell) => {
                const $bodyCell = $(bodyCell);
                const bodyWidth = $bodyCell.outerWidth();
                
                if (Math.abs(headerWidth - bodyWidth) > 1) {
                    console.log(`🔧 Adjusting body cell ${column}: ${bodyWidth}px → ${headerWidth}px`);
                    $bodyCell.css({
                        'width': headerWidth + 'px !important',
                        'min-width': headerWidth + 'px !important',
                        'max-width': headerWidth + 'px !important'
                    });
                }
            });
        });
        
        console.log(`✅ Perfect alignment achieved for board: ${boardId}`);
    }
    
    // Force column width application for all boards using their own saved widths
    forceColumnWidthApplication(boardsData) {
        console.log('🔧 Force applying board-specific column widths for all boards');
        
        boardsData.forEach(boardData => {
            const boardId = boardData.board_id;
            const columnConfig = boardData.column_config || {};
            const visibleColumns = columnConfig.visible_columns || this.getDefaultVisibleColumns();
            const savedColumnWidths = columnConfig.column_widths || {};
            
            console.log(`🔧 Applying board-specific column widths for board: ${boardId}`);
            console.log(`🔧 Saved column widths:`, savedColumnWidths);
            
            visibleColumns.forEach(column => {
                // Use board's saved width or fall back to default
                const width = savedColumnWidths[column] || this.getDefaultColumnWidth(column);
                
                // Apply width to both header and body cells with maximum specificity
                const headerSelector = `.pm-combination-board-section[data-board-id="${boardId}"] .pm-combination-table-header .pm-header-cell[data-column="${column}"]`;
                const cellSelector = `.pm-combination-board-section[data-board-id="${boardId}"] .pm-task-group .pm-cell[data-column="${column}"]`;
                
                const cssProps = {
                    'width': width + 'px !important',
                    'min-width': width + 'px !important',
                    'max-width': width + 'px !important',
                    'flex': `0 0 ${width}px !important`,
                    'box-sizing': 'border-box !important'
                };
                
                $(headerSelector).css(cssProps);
                $(cellSelector).css(cssProps);
                
                console.log(`✅ Applied board-specific ${width}px to column ${column} in board ${boardId}`);
            });
        });
        
        console.log('✅ Board-specific column width application completed');
    }
    
    // Debug rendered HTML structure to identify display issues
    debugRenderedStructure(boardsData) {
        console.log('🔍 DEBUG: Analyzing rendered HTML structure');
        
        boardsData.forEach(boardData => {
            const boardId = boardData.board_id;
            const $boardSection = $(`.pm-combination-board-section[data-board-id="${boardId}"]`);
            
            console.log(`\n📋 Board: ${boardData.board_name} (${boardId})`);
            
            // Check project groups
            const $projectGroups = $boardSection.find('.pm-project-group');
            console.log(`📁 Project groups found: ${$projectGroups.length}`);
            
            $projectGroups.each((index, projectGroup) => {
                const $projectGroup = $(projectGroup);
                const projectName = $projectGroup.find('.pm-project-name').text();
                const taskCount = $projectGroup.find('.pm-task-count').text();
                
                console.log(`  📁 Project ${index + 1}: ${projectName} (${taskCount})`);
                
                // Check task rows
                const $taskRows = $projectGroup.find('.pm-combination-task-row');
                console.log(`    📝 Task rows found: ${$taskRows.length}`);
                
                $taskRows.each((taskIndex, taskRow) => {
                    const $taskRow = $(taskRow);
                    const taskId = $taskRow.data('task-id');
                    const cellCount = $taskRow.find('.pm-cell').length;
                    const rowDisplay = $taskRow.css('display');
                    const rowWidth = $taskRow.outerWidth();
                    
                    console.log(`      📝 Task ${taskIndex + 1}: ID=${taskId}, Cells=${cellCount}, Display=${rowDisplay}, Width=${rowWidth}px`);
                    
                    // Check if cells are properly sized
                    $taskRow.find('.pm-cell').each((cellIndex, cell) => {
                        const $cell = $(cell);
                        const column = $cell.data('column');
                        const cellWidth = $cell.outerWidth();
                        const cellDisplay = $cell.css('display');
                        
                        if (cellIndex < 5) { // Only log first 5 cells to avoid spam
                            console.log(`        📊 Cell ${cellIndex + 1}: ${column}=${cellWidth}px (${cellDisplay})`);
                        }
                    });
                });
            });
        });
    }
    
    // Get default column width based on column type
    getDefaultColumnWidth(column) {
        const defaultWidths = {
            'select': 50,
            'client': 180,
            'task-name': 250,
            'entity': 100,
            'tf-tg': 70,
            'software': 120,
            'status': 120,
            'note': 150,
            'target-month': 100,
            'budget': 100,
            'actual': 100,
            'review-note': 120,
            'action-person': 120,
            'preparer': 100,
            'reviewer': 100,
            'partner': 100,
            'lodgment-due': 120,
            'engagement': 100,
            'group': 120,
            'year-end': 100,
            'last-updated': 120,
            'priority': 80,
            'frequency': 100,
            'reset-date': 120
        };
        
        return defaultWidths[column] || 120;
    }
    
    // Initialize column resizing for a specific board
    initializeBoardColumnResizing(boardId) {
        const $boardContainer = $(`.pm-combination-board-section[data-board-id="${boardId}"]`);
        
        $boardContainer.find('.pm-column-resizer').off('mousedown').on('mousedown', (e) => {
            e.preventDefault();
            
            const $resizer = $(e.target);
            const $headerCell = $resizer.closest('.pm-header-cell');
            const column = $headerCell.data('column');
            const startX = e.clientX;
            const startWidth = $headerCell.outerWidth();
            
            const handleMouseMove = (e) => {
                const newWidth = Math.max(50, startWidth + (e.clientX - startX));
                
                // Update header cell width for this board only
                $(`.pm-combination-table-header[data-board-id="${boardId}"] .pm-header-cell[data-column="${column}"]`).css('width', newWidth + 'px');
                
                // Update task cell widths for this board only
                $(`.pm-combination-board-section[data-board-id="${boardId}"] .pm-task-group .pm-cell-${column}`).css('width', newWidth + 'px');
            };
            
            const handleMouseUp = () => {
                $(document).off('mousemove', handleMouseMove);
                $(document).off('mouseup', handleMouseUp);
                
                // Save the new width for this board
                this.saveBoardColumnWidth(boardId, column, $headerCell.outerWidth());
            };
            
            $(document).on('mousemove', handleMouseMove);
            $(document).on('mouseup', handleMouseUp);
        });
    }
    
    // Initialize project expand/collapse for a specific board
    initializeBoardProjectToggle(boardId) {
        const $boardContainer = $(`.pm-combination-board-section[data-board-id="${boardId}"]`);
        
        $boardContainer.find('.pm-project-header').off('click').on('click', (e) => {
            if ($(e.target).closest('.pm-task-checkbox, .pm-select-all-checkbox').length) return;
            
            const $projectGroup = $(e.currentTarget).closest('.pm-project-group');
            const $tasks = $projectGroup.find('.pm-project-tasks');
            const $icon = $projectGroup.find('.pm-expand-icon');
            
            if ($tasks.is(':visible')) {
                $tasks.slideUp(200);
                $icon.removeClass('fa-chevron-down').addClass('fa-chevron-right');
                $projectGroup.addClass('collapsed');
            } else {
                $tasks.slideDown(200);
                $icon.removeClass('fa-chevron-right').addClass('fa-chevron-down');
                $projectGroup.removeClass('collapsed');
            }
        });
    }
    
    // Initialize cell editing for combination view
    initializeCombinationCellEditing() {
        // Priority order: Special selectors first, then general editable cells
        
        // 1. Client selector (highest priority - specific trigger)
        $(document).off('click.combination-client').on('click.combination-client', '.pm-combination-task-row .pm-client-selector-trigger', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const $trigger = $(e.currentTarget);
            const $cell = $trigger.closest('.pm-cell-client');
            
            if (window.ClientSelectorModal) {
                window.ClientSelectorModal.showClientSelector($cell);
            }
        });
        
        // 2. Comment indicator clicks
        $(document).off('click.combination-comments').on('click.combination-comments', '.pm-combination-task-row .pm-comment-indicator', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const taskId = $(e.currentTarget).data('task-id');
            
            if (window.CommentsModal) {
                window.CommentsModal.showCommentsModal(taskId);
            }
        });
        
        // 3. Review note indicator clicks
        $(document).off('click.combination-review').on('click.combination-review', '.pm-combination-task-row .pm-review-note-indicator', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const taskId = $(e.currentTarget).data('task-id');
            
            if (window.ReviewNotesModal) {
                window.ReviewNotesModal.showReviewNotesModal(taskId);
            }
        });
        
        // 3.5. Engagement indicator clicks
        $(document).off('click.combination-engagement').on('click.combination-engagement', '.pm-combination-task-row .pm-engagement-indicator', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const taskId = $(e.currentTarget).data('task-id');
            
            if (window.EngagementManager) {
                window.EngagementManager.openEngagementModal(taskId);
            }
        });
        
        // 4. Subtask toggle
        $(document).off('click.combination-subtask').on('click.combination-subtask', '.pm-combination-task-row .pm-subtask-toggle', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const taskId = $(e.currentTarget).data('task-id');
            
            if (window.SubtaskManager) {
                window.SubtaskManager.toggleSubtasks(taskId);
            }
        });
        
        // 5. General editable cells (exactly like normal board view)
        $(document).off('click.combination-edit').on('click.combination-edit', '.pm-combination-task-row [data-editable="true"]', (e) => {
            e.stopPropagation();
            
            // Don't trigger editing if clicking on subtask toggle
            if ($(e.target).closest('.pm-subtask-toggle').length > 0) {
                return;
            }
            
            const $cell = $(e.currentTarget);
            const fieldType = $cell.data('field-type');
            const taskId = $cell.data('task-id');
            const fieldName = $cell.data('field');
            
            // Handle different field types exactly like normal board view
            if (fieldType === 'person_selector') {
                if (window.PersonSelectorManager) {
                    window.PersonSelectorManager.showMultiPersonSelector($cell, taskId, fieldName);
                }
            } else if (fieldType === 'software_selector') {
                if (window.SoftwareSelectorManager) {
                    window.SoftwareSelectorManager.showSoftwareSelector($cell, taskId, fieldName);
                }
            } else if (fieldType === 'date') {
                // Date fields directly show date picker, never text editor
                console.log('📅 Opening date picker for:', fieldName);
                if (window.EditorsManager) {
                    window.EditorsManager.showDatePicker($cell, taskId, fieldName);
                }
                return; // Prevent any other editing behavior
            } else if (fieldType === 'task_name_editor') {
                if (window.EditorsManager) {
                    window.EditorsManager.showTaskNameEditor($cell);
                }
            } else {
                // For text, select, currency fields
                if (window.EditorsManager) {
                    window.EditorsManager.makeEditable($cell[0]);
                }
            }
        });
    }
    
    // Save column width for a specific board
    async saveBoardColumnWidth(boardId, column, width) {
        try {
            await frappe.call({
                method: 'smart_accounting.www.project_management.index.save_partition_column_width',
                args: {
                    partition_id: boardId,
                    column_name: column,
                    width: width
                }
            });
        } catch (error) {
            console.warn('Failed to save column width for board:', boardId, error);
        }
    }
    // Delete saved combination
    async deleteSavedCombination(combinationId, combinationName) {
        const confirmed = await new Promise((resolve) => {
            frappe.confirm(
                `Are you sure you want to delete "${combinationName}"?`,
                () => resolve(true),
                () => resolve(false)
            );
        });
        
        if (!confirmed) return;
        
        try {
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.delete_combination_view',
                args: {
                    combination_id: combinationId
                }
            });
            
            if (response.message && response.message.success) {
                frappe.show_alert({
                    message: response.message.message,
                    indicator: 'green'
                });
                
                // Refresh saved combinations list
                await this.loadSavedCombinations();
                this.renderSavedCombinations();
                
            } else {
                throw new Error(response.message?.error || 'Failed to delete combination view');
            }
            
        } catch (error) {
            console.error('Error deleting combination view:', error);
            frappe.show_alert({
                message: 'Error deleting combination view: ' + error.message,
                indicator: 'red'
            });
        }
    }
}

// Initialize combination view manager
window.CombinationViewManager = new CombinationViewManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CombinationViewManager;
}
