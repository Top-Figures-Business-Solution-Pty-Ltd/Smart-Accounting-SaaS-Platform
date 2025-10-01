// Project Management - Combination View Manager
// Manages the combination view functionality for displaying multiple boards together

class CombinationViewManager {
    constructor() {
        this.utils = window.PMUtils;
        this.selectedBoards = [];
        this.availableBoards = [];
        this.currentCombinationView = null;
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
            this.showBoardSelector();
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

        // Column management restriction in combination view
        $(document).on('click', '.pm-combination-column-mgmt-disabled', (e) => {
            e.preventDefault();
            frappe.show_alert({
                message: '列管理在组合视图中不可用。请前往具体的board进行列管理设置。',
                indicator: 'orange'
            });
        });
        
        // Disable manage columns button in combination view
        $(document).on('click', '.pm-manage-columns-btn', (e) => {
            if (window.location.search.includes('view=combination')) {
                e.preventDefault();
                frappe.show_alert({
                    message: 'Due to this being a combination view, if you want to use this feature, please return to the respective board.',
                    indicator: 'orange'
                });
            }
        });

        // Go to board link
        $(document).on('click', '.pm-combination-goto-board', (e) => {
            // Let the default link behavior handle navigation
        });
        
    }

    // Show board selector modal
    async showBoardSelector() {
        try {
            // Load available boards
            await this.loadAvailableBoards();
            
            // Reset selection
            this.selectedBoards = [];
            
            // Render boards
            this.renderAvailableBoards();
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
        
        // Update the badge count
        $('.pm-combination-board-badge').text(`${boardsData.length} Boards`);
        
        // Calculate total projects and tasks
        let totalProjects = 0;
        let totalTasks = 0;
        boardsData.forEach(board => {
            totalProjects += board.total_projects || 0;
            totalTasks += board.total_tasks || 0;
        });
        
        // Update header statistics
        $('.pm-view-stats').text(`(View: combination | Projects: ${totalProjects} | Tasks: ${totalTasks})`);
        
        
        // Update or create bottom statistics using the correct footer structure
        if (!$('.pm-summary').length) {
            $('.project-management-container').append(`
                <div class="pm-summary">
                    <div class="pm-stat">
                        <span class="pm-stat-number">${totalProjects}</span>
                        <span class="pm-stat-label">Projects</span>
                    </div>
                    <div class="pm-stat">
                        <span class="pm-stat-number">${totalTasks}</span>
                        <span class="pm-stat-label">Tasks</span>
                    </div>
                </div>
            `);
        } else {
            $('.pm-summary .pm-stat:first-child .pm-stat-number').text(totalProjects);
            $('.pm-summary .pm-stat:last-child .pm-stat-number').text(totalTasks);
        }
        
        const $container = $('#pm-combination-boards-container');
        console.log('DEBUG: Container found:', $container.length > 0);
        
        let boardsHtml = '';
        
        // Render each board section
        boardsData.forEach((boardData, index) => {
            console.log(`DEBUG: Rendering board ${index}:`, boardData);
            boardsHtml += this.renderBoardSection(boardData, index);
        });
        
        console.log('DEBUG: Generated HTML length:', boardsHtml.length);
        $container.html(boardsHtml);

        // Initialize table functionality for each board
        this.initializeBoardTables(boardsData);
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
                            <span class="pm-combination-board-badge">${taskCount} Tasks</span>
                            <a href="/project_management?view=${boardData.board_id}" 
                               class="pm-combination-goto-board" 
                               target="_blank">
                                Open Board
                            </a>
                            <button class="pm-combination-column-mgmt-disabled" 
                                    title="Due to this being a combination view, if you want to use this feature, please return to the respective board">
                                Columns (Disabled)
                            </button>
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
        console.log('DEBUG: renderBoardTable called for board:', boardData.board_id);
        console.log('DEBUG: boardData.tasks:', boardData.tasks);
        
        if (!boardData.tasks || Object.keys(boardData.tasks).length === 0) {
            return `
                <div class="pm-empty-board">
                    <i class="fa fa-inbox"></i>
                    <p>No tasks found in this board</p>
                </div>
            `;
        }
        
        let tableHtml = '';
        
        // Render each client's projects and tasks
        Object.entries(boardData.tasks).forEach(([clientName, projects]) => {
            if (projects && typeof projects === 'object') {
                Object.entries(projects).forEach(([projectName, tasks]) => {
                    if (tasks && Array.isArray(tasks) && tasks.length > 0) {
                        tableHtml += this.renderProjectSection(clientName, projectName, tasks, boardData);
                    }
                });
            }
        });
        
        if (!tableHtml) {
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
                <div class="pm-project-tasks pm-combination-tasks" data-board-id="${boardData.board_id}">
                    ${this.renderTaskRows(tasks, boardData)}
                </div>
            </div>
        `;
        
        return projectHtml;
    }
    
    // Render table header based on board's column configuration
    renderTableHeader(boardData) {
        const columnConfig = boardData.column_config || {};
        const visibleColumns = columnConfig.visible_columns || ['client', 'task-name', 'status'];
        
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
    
    // Render task rows
    renderTaskRows(tasks, boardData) {
        const columnConfig = boardData.column_config || {};
        const visibleColumns = columnConfig.visible_columns || ['client', 'task-name', 'status'];
        
        return tasks.map(task => {
            let rowHtml = `
                <div class="pm-task-row pm-combination-task-row" data-task-id="${task.name}" data-board-id="${boardData.board_id}">
                    <div class="pm-cell pm-cell-select" data-column="select">
                        <input type="checkbox" class="pm-task-checkbox" value="${task.name}">
                    </div>
            `;
            
            visibleColumns.forEach(column => {
                rowHtml += this.renderTaskCell(task, column, boardData);
            });
            
            rowHtml += '</div>';
            return rowHtml;
        }).join('');
    }
    
    // Render individual task cell - EXACT copy from table.html logic
    renderTaskCell(task, column, boardData) {
        const taskId = task.name;
        const isEditable = this.isCellEditable(column);
        const editableAttr = isEditable ? 'data-editable="true"' : '';
        
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
                        <span class="pm-tf-tg-badge editable-field">${task.tf_tg || 'TF'}</span>
                    </div>
                `;
            
            case 'software':
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
                const status = task.status || 'Open';
                return `
                    <div class="pm-cell pm-cell-status">
                        <span class="pm-status-badge status-${status.toLowerCase()}">${status}</span>
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
            
            default:
                // For other columns, use simple editable field
                const fieldName = this.getFieldName(column);
                const fieldValue = task[fieldName] || task[`custom_${fieldName}`] || '-';
                return `
                    <div class="pm-cell pm-cell-${column}" 
                         ${editableAttr}
                         data-field="${fieldName}"
                         data-task-id="${taskId}"
                         data-field-type="text">
                        <span class="editable-field">${fieldValue}</span>
                    </div>
                `;
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
            'target-month': 'Target Month',
            'budget': 'Budget',
            'actual': 'Actual'
        };
        return columnNames[column] || column;
    }
    
    getFieldName(column) {
        const fieldNames = {
            'client': 'custom_client',
            'task-name': 'subject',
            'entity': 'entity',
            'tf-tg': 'tf_tg',
            'software': 'software',
            'status': 'status',
            'note': 'description',
            'target-month': 'target_month',
            'budget': 'budget',
            'actual': 'actual'
        };
        return fieldNames[column] || column;
    }
    
    isCellEditable(column) {
        const editableColumns = ['task-name', 'status', 'entity', 'tf-tg', 'software', 'note', 'target-month', 'budget', 'actual'];
        return editableColumns.includes(column);
    }
    
    getStatusClass(status) {
        if (!status) return 'open';
        return status.toLowerCase().replace(/\s+/g, '-');
yi  }
    
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
        
        // Force column width synchronization for all boards
        setTimeout(() => {
            boardsData.forEach(boardData => {
                this.ensureColumnWidthSync(boardData.board_id);
            });
            
            // Also call the global table manager sync if available
            if (window.TableManager && window.TableManager.forceColumnWidthSync) {
                window.TableManager.forceColumnWidthSync();
            }
        }, 100);
    }
    
    // Apply column widths specific to each board with enhanced synchronization
    applyBoardColumnWidths(boardId, columnConfig) {
        console.log(`🔧 Applying column widths for board: ${boardId}`, columnConfig);
        
        // First, ensure we have the visible columns
        const visibleColumns = columnConfig?.visible_columns || ['client', 'task-name', 'status', 'target-month'];
        
        // Apply column widths if available
        if (columnConfig && columnConfig.column_widths) {
            const columnWidths = columnConfig.column_widths;
            console.log(`📏 Found saved column widths for ${boardId}:`, columnWidths);
            
            // Apply saved widths to visible columns only
            visibleColumns.forEach(column => {
                const width = columnWidths[column] || this.getDefaultColumnWidth(column);
                this.setColumnWidth(boardId, column, width);
            });
        } else {
            console.log(`📏 No saved widths for ${boardId}, using defaults`);
            // Apply default widths to all visible columns
            visibleColumns.forEach(column => {
                const width = this.getDefaultColumnWidth(column);
                this.setColumnWidth(boardId, column, width);
            });
        }
        
        // Force synchronization after a short delay to ensure DOM is ready
        setTimeout(() => {
            this.ensureColumnWidthSync(boardId);
        }, 100);
    }
    
    // Set column width for both header and content cells with board-specific precision
    setColumnWidth(boardId, column, width) {
        const widthPx = width + 'px';
        console.log(`🎯 Setting width for board ${boardId}, column ${column}: ${widthPx}`);
        
        // Use highly specific selectors to ensure board independence
        const headerSelector = `.pm-combination-board-section[data-board-id="${boardId}"] .pm-combination-table-header .pm-header-cell[data-column="${column}"]`;
        const cellSelector = `.pm-combination-board-section[data-board-id="${boardId}"] .pm-combination-tasks .pm-cell[data-column="${column}"]`;
        
        // Apply to header cells with exact styling
        $(headerSelector).css({
            'width': widthPx,
            'min-width': widthPx,
            'max-width': widthPx,
            'flex': `0 0 ${widthPx}`,
            'box-sizing': 'border-box'
        });
        
        // Apply to content cells with matching styling  
        $(cellSelector).css({
            'width': widthPx,
            'min-width': widthPx,
            'max-width': widthPx,
            'flex': `0 0 ${widthPx}`,
            'box-sizing': 'border-box'
        });
        
        console.log(`✅ Applied width to ${$(headerSelector).length} headers and ${$(cellSelector).length} cells`);
    }
    
    // Ensure column width synchronization between header and content
    ensureColumnWidthSync(boardId) {
        const $boardSection = $(`.pm-combination-board-section[data-board-id="${boardId}"]`);
        const $headerCells = $boardSection.find('.pm-combination-table-header .pm-header-cell');
        
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
            
            // Apply this width to ensure sync
            this.setColumnWidth(boardId, column, actualWidth);
        });
        
        // Force layout recalculation
        setTimeout(() => {
            $boardSection.find('.pm-combination-table-header, .pm-combination-tasks').each(function() {
                this.style.display = 'none';
                this.offsetHeight; // Trigger reflow
                this.style.display = '';
            });
        }, 10);
    }
    
    // Get default column width based on column type
    getDefaultColumnWidth(column) {
        const defaultWidths = {
            'select': 50,
            'client': 150,
            'task-name': 200,
            'entity': 120,
            'tf-tg': 80,
            'software': 100,
            'status': 100,
            'note': 150,
            'target-month': 120,
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
                $(`.pm-combination-tasks[data-board-id="${boardId}"] .pm-cell-${column}`).css('width', newWidth + 'px');
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
        // Enable inline editing for editable cells
        $(document).off('click.combination-edit').on('click.combination-edit', '.pm-combination-task-row [data-editable="true"]', (e) => {
            const $cell = $(e.currentTarget);
            const taskId = $cell.data('task-id');
            const boardId = $cell.data('board-id');
            const column = $cell.data('column');
            const fieldName = $cell.data('field');
            
            // Use existing editors manager for inline editing
            if (window.EditorsManager) {
                window.EditorsManager.startInlineEdit($cell);
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
}

// Initialize combination view manager
window.CombinationViewManager = new CombinationViewManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CombinationViewManager;
}
