// Project Management - Subtask Management
// Subtask creation and management functionality

class SubtaskManager {
    constructor() {
        this.utils = window.PMUtils;
        this.expandedTasks = new Set(); // Track which tasks have subtasks expanded
        this.columnWidths = {}; // Subtask column widths
        this.saveTimeout = null;
    }

    // Initialize subtask functionality
    initializeSubtasks() {
        // Load subtask column widths first
        this.loadSubtaskColumnWidths().then(() => {
            // Initialize column resizing after widths are loaded
            this.initializeSubtaskColumnResizing();
        });
        
        // Bind subtask toggle events
        $(document).on('click', '.pm-subtask-toggle', (e) => {
            e.stopPropagation();
            const taskId = $(e.currentTarget).data('task-id');
            this.toggleSubtasks(taskId);
        });

        // Prevent subtask toggle from triggering client editing
        $(document).on('click', '.pm-subtask-toggle', (e) => {
            e.stopPropagation();
        });
    }

    async toggleSubtasks(taskId) {
        const $toggleBtn = $(`.pm-subtask-toggle[data-task-id="${taskId}"]`);
        const $taskRow = $(`.pm-task-row[data-task-id="${taskId}"]`);
        const $icon = $toggleBtn.find('i');

        if (this.expandedTasks.has(taskId)) {
            // Collapse subtasks
            this.collapseSubtasks(taskId);
        } else {
            // Expand subtasks
            this.expandSubtasks(taskId);
        }
    }

    async expandSubtasks(taskId) {
        const $toggleBtn = $(`.pm-subtask-toggle[data-task-id="${taskId}"]`);
        const $taskRow = $(`.pm-task-row[data-task-id="${taskId}"]`);

        try {
            // Show loading state
            const originalText = $toggleBtn.html();
            $toggleBtn.html('Loading...');

            // Load subtasks from backend
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.get_subtasks',
                args: { parent_task_id: taskId }
            });

            if (response.message && response.message.success) {
                const subtasks = response.message.subtasks || [];
                
                // Create subtask container
                this.renderSubtasks(taskId, subtasks);
                
                // Update toggle state
                this.expandedTasks.add(taskId);
                $toggleBtn.addClass('expanded');
                $taskRow.addClass('has-expanded-subtasks');
                
                // Update button indicator using the centralized method
                const count = subtasks.length;
                this.updateSubtaskIndicator(taskId, count);

            } else {
                throw new Error(response.message?.error || 'Failed to load subtasks');
            }

        } catch (error) {
            console.error('Error loading subtasks:', error);
            
            // Restore button state using centralized method
            const count = parseInt($toggleBtn.find('.pm-subtask-count').text()) || 0;
            this.updateSubtaskIndicator(taskId, count);
            
            frappe.show_alert({
                message: 'Failed to load subtasks',
                indicator: 'red'
            });
        }
    }

    collapseSubtasks(taskId) {
        const $toggleBtn = $(`.pm-subtask-toggle[data-task-id="${taskId}"]`);
        const $taskRow = $(`.pm-task-row[data-task-id="${taskId}"]`);

        // Remove subtask container
        $(`.pm-subtask-container[data-parent-task="${taskId}"]`).slideUp(300, function() {
            $(this).remove();
        });

        // Update toggle state
        this.expandedTasks.delete(taskId);
        $toggleBtn.removeClass('expanded');
        $taskRow.removeClass('has-expanded-subtasks');
        
        // Get current count and update button indicator using the centralized method
        const count = parseInt($toggleBtn.find('.pm-subtask-count').text()) || 0;
        this.updateSubtaskIndicator(taskId, count);
    }

    async renderSubtasks(parentTaskId, subtasks) {
        const $parentRow = $(`.pm-task-row[data-task-id="${parentTaskId}"]`);
        
        // Remove existing subtask container
        $(`.pm-subtask-container[data-parent-task="${parentTaskId}"]`).remove();

        // Get current view to load subtask column configuration
        // 修复：从URL参数中获取当前视图，而不是依赖可能未设置的window.PM_CONFIG
        const urlParams = new URLSearchParams(window.location.search);
        const currentView = urlParams.get('view') || 'main';
        
        try {
            // Get subtask column configuration with enhanced debugging
            console.log(`🔍 Loading subtask column config for view: ${currentView}`);
            
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.get_subtask_column_config',
                args: {
                    partition_name: currentView
                }
            });
            
            console.log('🔍 Subtask column config response:', response);
            
            let visibleColumns;
            
            // 关键修复：优先使用服务器返回的配置，确保持久化生效
            if (response.message && response.message.success && response.message.visible_columns) {
                visibleColumns = response.message.visible_columns;
                console.log(`✅ Using saved subtask columns for ${currentView}:`, visibleColumns);
            } else {
                // 只有在服务器没有返回配置时才使用默认配置
                visibleColumns = window.ColumnConfigManager.getDefaultVisibleSubtaskColumns();
                console.warn(`⚠️ No saved subtask config found for ${currentView}, using defaults:`, visibleColumns);
                
                // 如果配置加载失败，尝试初始化配置
                if (currentView !== 'main') {
                    console.log(`🔧 Attempting to initialize subtask config for ${currentView}`);
                    try {
                        const initResponse = await frappe.call({
                            method: 'smart_accounting.www.project_management.index.initialize_single_partition_subtask_config',
                            args: {
                                partition_name: currentView
                            }
                        });
                        
                        if (initResponse.message && initResponse.message.success) {
                            console.log(`✅ Subtask config initialized for ${currentView}`);
                            // 重新获取初始化后的配置
                            const retryResponse = await frappe.call({
                                method: 'smart_accounting.www.project_management.index.get_subtask_column_config',
                                args: {
                                    partition_name: currentView
                                }
                            });
                            
                            if (retryResponse.message && retryResponse.message.success && retryResponse.message.visible_columns) {
                                visibleColumns = retryResponse.message.visible_columns;
                                console.log(`✅ Using initialized subtask columns for ${currentView}:`, visibleColumns);
                            }
                        }
                    } catch (initError) {
                        console.error(`❌ Failed to initialize subtask config for ${currentView}:`, initError);
                    }
                }
            }
            
            // 关键修复：只渲染用户在manage columns里选择的可见列
            const headerColumns = visibleColumns.map(columnKey => {
                const displayName = window.ColumnConfigManager.getColumnDisplayName(columnKey);
                return `
                    <div class="pm-subtask-header-cell pm-subtask-cell-${columnKey}" data-column="${columnKey}">
                        ${displayName}
                        <div class="pm-subtask-col-resizer"></div>
                    </div>
                `;
            }).join('');

            // Create Monday.com style subtask container with dynamic columns
            const subtaskHTML = `
                <div class="pm-subtask-container" data-parent-task="${parentTaskId}">
                    <div class="pm-subtask-header">
                        <div class="pm-subtask-title">
                            <i class="fa fa-tasks"></i>
                            Subtasks (${subtasks.length})
                        </div>
                    </div>
                    <div class="pm-subtask-table">
                        <div class="pm-subtask-table-header">
                            <div class="pm-subtask-header-cell pm-subtask-cell-select" data-column="select">
                                <input type="checkbox" class="pm-subtask-select-all-checkbox" title="Select all subtasks">
                                <div class="pm-subtask-col-resizer"></div>
                            </div>
                            ${headerColumns}
                        </div>
                        <div class="pm-subtask-list">
                            ${this.renderSubtaskList(subtasks, parentTaskId, visibleColumns)}
                            ${this.renderAddSubtaskRow(parentTaskId, visibleColumns)}
                        </div>
                    </div>
                </div>
            `;

            // Insert after parent row
            $parentRow.after(subtaskHTML);

            // Bind events for new subtask container
            this.bindSubtaskEvents(parentTaskId);

            // Apply column widths to the new subtask table
            this.applySubtaskColumnWidths();

            // 注意：由于我们只渲染可见列，不需要额外的可见性逻辑

            // Animate in
            $(`.pm-subtask-container[data-parent-task="${parentTaskId}"]`).hide().slideDown(300);
            
        } catch (error) {
            console.error('Error loading subtask column config:', error);
            // 使用默认配置作为后备
            this.renderSubtasksWithDefaults(parentTaskId, subtasks, $parentRow);
        }
    }

    // 后备方法：使用默认配置渲染subtask
    renderSubtasksWithDefaults(parentTaskId, subtasks, $parentRow) {
        const defaultVisibleColumns = window.ColumnConfigManager.getDefaultVisibleSubtaskColumns();
        
        // 只渲染默认可见列
        const headerColumns = defaultVisibleColumns.map(columnKey => {
            const displayName = window.ColumnConfigManager.getColumnDisplayName(columnKey);
            return `
                <div class="pm-subtask-col pm-subtask-col-${columnKey}" data-column="${columnKey}">
                    ${displayName}
                    <div class="pm-subtask-col-resizer"></div>
                </div>
            `;
        }).join('');

        const subtaskHTML = `
            <div class="pm-subtask-container" data-parent-task="${parentTaskId}">
                <div class="pm-subtask-header">
                    <div class="pm-subtask-title">
                        <i class="fa fa-tasks"></i>
                        Subtasks (${subtasks.length})
                    </div>
                </div>
                <div class="pm-subtask-table">
                    <div class="pm-subtask-table-header">
                        <div class="pm-subtask-col pm-subtask-col-select" data-column="select">
                            <input type="checkbox" class="pm-subtask-select-all-checkbox" title="Select all subtasks">
                            <div class="pm-subtask-col-resizer"></div>
                        </div>
                        ${headerColumns}
                    </div>
                    <div class="pm-subtask-list">
                        ${this.renderSubtaskList(subtasks, parentTaskId, defaultVisibleColumns)}
                        ${this.renderAddSubtaskRow(parentTaskId, defaultVisibleColumns)}
                    </div>
                </div>
            </div>
        `;

        $parentRow.after(subtaskHTML);
        this.bindSubtaskEvents(parentTaskId);
        this.applySubtaskColumnWidths();
        
        // 注意：由于我们只渲染可见列，不需要额外的可见性逻辑
        
        $(`.pm-subtask-container[data-parent-task="${parentTaskId}"]`).hide().slideDown(300);
    }

    renderSubtaskList(subtasks, parentTaskId, visibleColumns = null) {
        // 如果没有传入列配置，使用默认可见列
        if (!visibleColumns) {
            visibleColumns = window.ColumnConfigManager.getDefaultVisibleSubtaskColumns();
        }
        if (!subtasks || subtasks.length === 0) {
            return `
                <div class="pm-subtask-empty">
                    <i class="fa fa-tasks"></i>
                    <span>No subtasks yet. Click "Add subtask" to create one.</span>
                </div>
            `;
        }

        return subtasks.map(subtask => {
            // 使用subtask专用的CSS类名，避免和task冲突
            let rowHTML = `
                <div class="pm-subtask-item pm-subtask-row" data-subtask-id="${subtask.name}">
                    <div class="pm-subtask-cell-select">
                        <div class="pm-subtask-select-cell">
                            <input type="checkbox" class="pm-subtask-multiselect-checkbox" data-subtask-id="${subtask.name}">
                        </div>
                    </div>
            `;

            // 只根据用户选择的可见列渲染
            visibleColumns.forEach(columnKey => {
                rowHTML += this.renderSubtaskCell(subtask, columnKey);
            });

            rowHTML += `</div>`;
            return rowHTML;
        }).join('');
    }

    // 渲染单个subtask单元格
    renderSubtaskCell(subtask, columnKey) {
        switch (columnKey) {
            case 'task-name':
                return `
                    <div class="pm-subtask-cell-task-name">
                        <div class="pm-subtask-name-content">
                            <span class="editable-field subtask-name-display" 
                                  data-editable="true"
                                  data-field="subject"
                                  data-task-id="${subtask.name}"
                                  data-field-type="text">${subtask.subject || 'Untitled Subtask'}</span>
                        </div>
                    </div>
                `;
            
            case 'status':
                return `
                    <div class="pm-subtask-cell-status">
                        <div class="pm-subtask-status-cell"
                             data-editable="true"
                             data-field="custom_task_status"
                             data-task-id="${subtask.name}"
                             data-field-type="select"
                             data-options-source="custom_task_status">
                            <span class="pm-status-badge status-${(subtask.custom_task_status || subtask.status || 'Not Started').toLowerCase().replace(/\s+/g, '-')}">${subtask.custom_task_status || subtask.status || 'Not Started'}</span>
                        </div>
                    </div>
                `;
            
            case 'note':
                return `
                    <div class="pm-subtask-cell-note">
                        <div class="pm-subtask-note-cell"
                             data-editable="true"
                             data-field="custom_note"
                             data-task-id="${subtask.name}"
                             data-field-type="text">
                            <span class="editable-field">${subtask.custom_note || subtask.note || '-'}</span>
                        </div>
                    </div>
                `;
            
            case 'action-person':
                return `
                    <div class="pm-subtask-cell-action-person">
                        <div class="pm-subtask-action-person-cell"
                             data-editable="true"
                             data-field="custom_roles"
                             data-task-id="${subtask.name}"
                             data-field-type="person_selector"
                             data-role-filter="Action Person">
                            ${this.renderRoleCell(subtask, 'Action Person')}
                        </div>
                    </div>
                `;
            
            case 'priority':
                return `
                    <div class="pm-subtask-cell-priority">
                        <div class="pm-subtask-priority-cell"
                             data-editable="true"
                             data-field="priority"
                             data-task-id="${subtask.name}"
                             data-field-type="select"
                             data-options-source="priority">
                            <span class="pm-priority-badge priority-${(subtask.priority || 'Medium').toLowerCase()}">${subtask.priority || 'Medium'}</span>
                        </div>
                    </div>
                `;
            
            case 'target-month':
                return `
                    <div class="pm-subtask-cell-target-month">
                        <div class="pm-subtask-cell-content"
                             data-editable="true"
                             data-field="custom_target_month"
                             data-task-id="${subtask.name}"
                             data-field-type="text">
                            <span class="editable-field">${subtask.custom_target_month || '-'}</span>
                        </div>
                    </div>
                `;
            
            case 'budget':
                return `
                    <div class="pm-subtask-cell-budget">
                        <div class="pm-subtask-cell-content"
                             data-editable="true"
                             data-field="custom_budget_planning"
                             data-task-id="${subtask.name}"
                             data-field-type="number">
                            <span class="editable-field">${subtask.custom_budget_planning || '-'}</span>
                        </div>
                    </div>
                `;
            
            case 'actual':
                return `
                    <div class="pm-subtask-cell-actual">
                        <div class="pm-subtask-cell-content"
                             data-editable="true"
                             data-field="custom_actual_billing"
                             data-task-id="${subtask.name}"
                             data-field-type="number">
                            <span class="editable-field">${subtask.custom_actual_billing || '-'}</span>
                        </div>
                    </div>
                `;
            
            case 'preparer':
                return `
                    <div class="pm-subtask-cell-preparer">
                        <div class="pm-subtask-cell-content"
                             data-editable="true"
                             data-field="custom_roles"
                             data-task-id="${subtask.name}"
                             data-field-type="person_selector"
                             data-role-filter="Preparer">
                            ${this.renderRoleCell(subtask, 'Preparer')}
                        </div>
                    </div>
                `;
            
            case 'reviewer':
                return `
                    <div class="pm-subtask-cell-reviewer">
                        <div class="pm-subtask-cell-content"
                             data-editable="true"
                             data-field="custom_roles"
                             data-task-id="${subtask.name}"
                             data-field-type="person_selector"
                             data-role-filter="Reviewer">
                            ${this.renderRoleCell(subtask, 'Reviewer')}
                        </div>
                    </div>
                `;
            
            case 'partner':
                return `
                    <div class="pm-subtask-cell-partner">
                        <div class="pm-subtask-cell-content"
                             data-editable="true"
                             data-field="custom_roles"
                             data-task-id="${subtask.name}"
                             data-field-type="person_selector"
                             data-role-filter="Partner">
                            ${this.renderRoleCell(subtask, 'Partner')}
                        </div>
                    </div>
                `;
            
            case 'process-date':
                return `
                    <div class="pm-subtask-cell-process-date">
                        <div class="pm-subtask-cell-content"
                             data-editable="true"
                             data-field="custom_process_date"
                             data-task-id="${subtask.name}"
                             data-field-type="date">
                            <span class="editable-field">${subtask.custom_process_date || '-'}</span>
                        </div>
                    </div>
                `;
            
            case 'lodgment-due':
                return `
                    <div class="pm-subtask-cell-lodgment-due">
                        <div class="pm-subtask-cell-content"
                             data-editable="true"
                             data-field="custom_lodgement_due_date"
                             data-task-id="${subtask.name}"
                             data-field-type="date">
                            <span class="editable-field">${subtask.custom_lodgement_due_date || '-'}</span>
                        </div>
                    </div>
                `;
            
            case 'engagement':
                return `
                    <div class="pm-subtask-cell-engagement">
                        <div class="pm-subtask-cell-content"
                             data-editable="true"
                             data-field="custom_engagement"
                             data-task-id="${subtask.name}"
                             data-field-type="link">
                            <span class="editable-field">${subtask.custom_engagement || '-'}</span>
                        </div>
                    </div>
                `;
            
            case 'year-end':
                return `
                    <div class="pm-subtask-cell-year-end">
                        <div class="pm-subtask-cell-content"
                             data-editable="true"
                             data-field="custom_year_end"
                             data-task-id="${subtask.name}"
                             data-field-type="select">
                            <span class="editable-field">${subtask.custom_year_end || '-'}</span>
                        </div>
                    </div>
                `;
            
            case 'last-updated':
                return `
                    <div class="pm-subtask-cell-last-updated">
                        <div class="pm-subtask-cell-content">
                            <span class="pm-date-display">${subtask.last_updated || '-'}</span>
                        </div>
                    </div>
                `;
            
            case 'frequency':
                return `
                    <div class="pm-subtask-cell-frequency">
                        <div class="pm-subtask-cell-content"
                             data-editable="true"
                             data-field="custom_frequency"
                             data-task-id="${subtask.name}"
                             data-field-type="text">
                            <span class="editable-field">${subtask.custom_frequency || '-'}</span>
                        </div>
                    </div>
                `;
            
            case 'reset-date':
                return `
                    <div class="pm-subtask-cell-reset-date">
                        <div class="pm-subtask-cell-content"
                             data-editable="true"
                             data-field="custom_reset_date"
                             data-task-id="${subtask.name}"
                             data-field-type="date">
                            <span class="editable-field">${subtask.custom_reset_date || '-'}</span>
                        </div>
                    </div>
                `;
            
            // 默认处理不支持的列
            default:
                return `
                    <div class="pm-subtask-cell-${columnKey}">
                        <div class="pm-subtask-cell-content">
                            <span class="editable-field"
                                  data-editable="true"
                                  data-field="custom_${columnKey.replace('-', '_')}"
                                  data-task-id="${subtask.name}"
                                  data-field-type="text">-</span>
                        </div>
                    </div>
                `;
        }
    }

    // 渲染角色单元格（通用方法）
    renderRoleCell(subtask, roleName) {
        if (subtask.role_assignments && subtask.role_assignments.length > 0) {
            const roleUsers = subtask.role_assignments.filter(assignment => assignment.role === roleName);
            
            if (roleUsers.length === 1) {
                const user = roleUsers[0];
                return `
                    <div class="pm-user-avatars">
                        <div class="pm-avatar pm-primary-user" title="${user.full_name}" data-email="${user.email}">
                            ${user.initials}
                        </div>
                    </div>
                `;
            } else if (roleUsers.length > 1) {
                const primaryUser = roleUsers[0];
                return `
                    <div class="pm-user-avatars">
                        <div class="pm-avatar pm-primary-user" title="${primaryUser.full_name}" data-email="${primaryUser.email}">
                            ${primaryUser.initials}
                        </div>
                        <div class="pm-avatar-more" title="Total ${roleUsers.length} users">
                            +${roleUsers.length - 1}
                        </div>
                    </div>
                `;
            }
        }
        
        return `
            <div class="pm-user-avatars pm-empty-person">
                <div class="pm-avatar pm-empty-avatar">
                    <i class="fa fa-user"></i>
                </div>
            </div>
        `;
    }

    // Render owner cell based on Task Role Assignment with Owner role
    renderOwnerCell(subtask) {
        // Look for users with "Owner" role in role assignments
        if (subtask.role_assignments && subtask.role_assignments.length > 0) {
            const owners = subtask.role_assignments.filter(assignment => assignment.role === 'Owner');
            
            if (owners.length === 1) {
                const owner = owners[0];
                return `
                    <div class="pm-user-avatars">
                        <div class="pm-avatar pm-primary-user" title="${owner.full_name}" data-email="${owner.email}">
                            ${owner.initials}
                        </div>
                    </div>
                `;
            } else if (owners.length > 1) {
                const primaryOwner = owners[0];
                return `
                    <div class="pm-user-avatars">
                        <div class="pm-avatar pm-primary-user" title="${primaryOwner.full_name}" data-email="${primaryOwner.email}">
                            ${primaryOwner.initials}
                        </div>
                        <div class="pm-avatar-more" title="Total ${owners.length} owners">
                            +${owners.length - 1}
                        </div>
                    </div>
                `;
            }
        }
        
        return `
            <div class="pm-user-avatars pm-empty-person">
                <div class="pm-avatar pm-empty-avatar">
                    <i class="fa fa-user"></i>
                </div>
            </div>
        `;
    }

    // Render inline add subtask row (similar to main task add row)
    renderAddSubtaskRow(parentTaskId, visibleColumns = null) {
        // 如果没有传入列配置，使用默认可见列
        if (!visibleColumns) {
            visibleColumns = window.ColumnConfigManager.getDefaultVisibleSubtaskColumns();
        }
        let rowHTML = `
            <div class="pm-subtask-item pm-add-subtask-item pm-subtask-row" data-parent-task="${parentTaskId}">
                <div class="pm-subtask-cell-select">
                    <!-- Empty for alignment -->
                </div>
        `;

        // 只根据用户选择的可见列生成，第一列包含添加按钮
        visibleColumns.forEach((columnKey, index) => {
            if (index === 0) {
                // 第一列包含添加按钮
                rowHTML += `
                    <div class="pm-subtask-cell-${columnKey}">
                        <div class="pm-subtask-cell-content">
                            <div class="pm-add-subtask-content">
                                <button class="pm-add-subtask-btn-inline" data-parent-task="${parentTaskId}">
                                    <i class="fa fa-plus"></i>
                                    <span>Add subtask</span>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                // 其他列为空，用于对齐
                rowHTML += `
                    <div class="pm-subtask-cell-${columnKey}">
                        <!-- Empty for alignment -->
                    </div>
                `;
            }
        });

        rowHTML += `</div>`;
        return rowHTML;
    }

    bindSubtaskEvents(parentTaskId) {
        const $container = $(`.pm-subtask-container[data-parent-task="${parentTaskId}"]`);

        // Inline add subtask button
        $container.find('.pm-add-subtask-btn-inline').on('click', (e) => {
            e.stopPropagation();
            this.showInlineSubtaskEditor(parentTaskId);
        });

        // 移除了状态checkbox，现在状态通过status列的编辑来管理

        // 关键修复：使用和task完全相同的编辑事件绑定逻辑
        $container.on('click', '[data-editable="true"]', (e) => {
            e.stopPropagation();
            const $cell = $(e.currentTarget);
            const fieldType = $cell.data('field-type');
            const taskId = $cell.data('task-id');
            const fieldName = $cell.data('field');
            
            console.log('🔧 Subtask cell edit triggered:', {fieldType, taskId, fieldName});
            
            // 使用和task完全相同的字段类型处理逻辑
            if (fieldType === 'person_selector') {
                if (window.PersonSelectorManager) {
                    window.PersonSelectorManager.showMultiPersonSelector($cell, taskId, fieldName);
                }
            } else if (fieldType === 'software_selector') {
                if (window.SoftwareSelectorManager) {
                    window.SoftwareSelectorManager.showSoftwareSelector($cell, taskId, fieldName);
                }
            } else if (fieldType === 'date') {
                // Date fields directly show date picker
                console.log('📅 Opening date picker for subtask field:', fieldName);
                if (window.EditorsManager) {
                    window.EditorsManager.showDatePicker($cell, taskId, fieldName);
                }
            } else if (fieldType === 'select') {
                // Status and other select fields
                if (fieldName === 'custom_task_status' || fieldName === 'status') {
                    this.showStatusSelector($cell, taskId, fieldName);
                } else if (window.EditorsManager) {
                    window.EditorsManager.makeEditable($cell[0]);
                }
            } else if (fieldType === 'text' || fieldType === 'number' || fieldType === 'currency') {
                // Text, number, currency fields
                if (window.EditorsManager) {
                    window.EditorsManager.makeEditable($cell[0]);
                }
            } else {
                // Fallback to general editing system
                if (window.EditorsManager && window.EditorsManager.startFieldEditing) {
                    window.EditorsManager.startFieldEditing($cell[0]);
                } else {
                    console.error('EditorsManager not available');
                    frappe.show_alert({
                        message: 'Editor not available',
                        indicator: 'red'
                    });
                }
            }
        });

        // Subtask actions (if we add them back later)
        $container.on('click', '.pm-subtask-action', (e) => {
            e.stopPropagation();
            const action = $(e.currentTarget).data('action');
            const subtaskId = $(e.currentTarget).data('subtask-id');
            
            if (action === 'edit') {
                this.editSubtask(subtaskId);
            } else if (action === 'delete') {
                this.deleteSubtask(subtaskId, parentTaskId);
            }
        });
    }

    // Show inline subtask editor (similar to main task inline editing)
    showInlineSubtaskEditor(parentTaskId) {
        const $addRow = $(`.pm-add-subtask-item[data-parent-task="${parentTaskId}"]`);
        const $addContent = $addRow.find('.pm-add-subtask-content');
        
        // Create inline editor
        const editorHTML = `
            <div class="pm-subtask-inline-editor">
                <input type="text" class="pm-subtask-name-input" placeholder="Enter subtask name..." maxlength="140">
                <div class="pm-subtask-editor-actions">
                    <button class="pm-subtask-save-btn" title="Save subtask">
                        <i class="fa fa-check"></i>
                    </button>
                    <button class="pm-subtask-cancel-btn" title="Cancel">
                        <i class="fa fa-times"></i>
                    </button>
                </div>
            </div>
        `;
        
        // Replace add button with editor
        $addContent.html(editorHTML);
        
        // Focus on input
        const $input = $addContent.find('.pm-subtask-name-input');
        $input.focus();
        
        // Bind editor events
        this.bindInlineEditorEvents(parentTaskId, $addContent);
    }

    bindInlineEditorEvents(parentTaskId, $editorContainer) {
        const $input = $editorContainer.find('.pm-subtask-name-input');
        const $saveBtn = $editorContainer.find('.pm-subtask-save-btn');
        const $cancelBtn = $editorContainer.find('.pm-subtask-cancel-btn');
        
        // Save on Enter key
        $input.on('keypress', (e) => {
            if (e.which === 13) { // Enter key
                e.preventDefault();
                this.saveInlineSubtask(parentTaskId, $input.val().trim());
            }
        });
        
        // Cancel on Escape key
        $input.on('keydown', (e) => {
            if (e.which === 27) { // Escape key
                e.preventDefault();
                this.cancelInlineSubtaskEditor(parentTaskId);
            }
        });
        
        // Save button click
        $saveBtn.on('click', (e) => {
            e.stopPropagation();
            this.saveInlineSubtask(parentTaskId, $input.val().trim());
        });
        
        // Cancel button click
        $cancelBtn.on('click', (e) => {
            e.stopPropagation();
            this.cancelInlineSubtaskEditor(parentTaskId);
        });
        
        // Cancel on blur (click outside)
        $input.on('blur', (e) => {
            // Small delay to allow button clicks to register
            setTimeout(() => {
                if (!$editorContainer.find(':focus').length) {
                    this.cancelInlineSubtaskEditor(parentTaskId);
                }
            }, 150);
        });
    }

    async saveInlineSubtask(parentTaskId, subtaskName) {
        if (!subtaskName) {
            this.cancelInlineSubtaskEditor(parentTaskId);
            return;
        }

        try {
            // Show loading state
            const $addRow = $(`.pm-add-subtask-item[data-parent-task="${parentTaskId}"]`);
            $addRow.find('.pm-subtask-inline-editor').html(`
                <div class="pm-subtask-saving">
                    <i class="fa fa-spinner fa-spin"></i>
                    <span>Creating subtask...</span>
                </div>
            `);

            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.create_subtask',
                args: { 
                    parent_task_id: parentTaskId,
                    subtask_name: subtaskName
                }
            });

            if (response.message && response.message.success) {
                // Refresh subtasks display
                await this.refreshSubtasks(parentTaskId);
                
                frappe.show_alert({
                    message: 'Subtask created successfully',
                    indicator: 'green'
                });

                // Update subtask count indicator
                this.updateSubtaskCount(parentTaskId);

            } else {
                throw new Error(response.message?.error || 'Failed to create subtask');
            }

        } catch (error) {
            console.error('Error creating subtask:', error);
            frappe.show_alert({
                message: 'Failed to create subtask: ' + error.message,
                indicator: 'red'
            });
            
            // Restore add button
            this.cancelInlineSubtaskEditor(parentTaskId);
        }
    }

    cancelInlineSubtaskEditor(parentTaskId) {
        const $addRow = $(`.pm-add-subtask-item[data-parent-task="${parentTaskId}"]`);
        const $addContent = $addRow.find('.pm-add-subtask-content');
        
        // Restore original add button
        $addContent.html(`
            <button class="pm-add-subtask-btn-inline" data-parent-task="${parentTaskId}">
                <i class="fa fa-plus"></i>
                <span>Add subtask</span>
            </button>
        `);
        
        // Re-bind click event
        $addContent.find('.pm-add-subtask-btn-inline').on('click', (e) => {
            e.stopPropagation();
            this.showInlineSubtaskEditor(parentTaskId);
        });
    }

    // Status selector for subtasks
    async showStatusSelector($cell, taskId, field) {
        // Prevent multiple editing
        if ($cell.hasClass('editing')) return;
        
        const currentStatus = $cell.find('.pm-status-badge').text().trim();
        
        // Mark as editing
        $cell.addClass('editing');
        $cell.closest('.pm-subtask-item').addClass('editing');
        
        // Get status options from backend (same as main tasks)
        let statusOptions = [];
        try {
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.get_task_status_options'
            });
            
            if (response.message && response.message.success) {
                statusOptions = response.message.status_options.map(status => ({
                    value: status,
                    label: status,
                    class: `status-${status.toLowerCase().replace(/\s+/g, '-')}`
                }));
            }
        } catch (error) {
            console.warn('Failed to load status options, using fallback');
        }
        
        // Fallback options if API fails - use minimal fallback
        if (statusOptions.length === 0) {
            console.warn('No status options available from API, using minimal fallback');
            statusOptions = [
                { value: 'Open', label: 'Open', class: 'status-open' },
                { value: 'Completed', label: 'Completed', class: 'status-completed' }
            ];
        }
        
        // Create status selector
        const selectHTML = `
            <select class="pm-status-select">
                ${statusOptions.map(option => `
                    <option value="${option.value}" ${option.value === currentStatus ? 'selected' : ''}>
                        ${option.label}
                    </option>
                `).join('')}
            </select>
        `;
        
        // Replace content with selector
        $cell.html(selectHTML);
        
        const $select = $cell.find('.pm-status-select');
        $select.focus();
        
        // Handle selection
        $select.on('change blur', async (e) => {
            const newStatus = $select.val();
            
            try {
                // Save the change
                await this.saveFieldChange(taskId, field, newStatus);
                
                // Update display
                const statusOption = statusOptions.find(opt => opt.value === newStatus);
                $cell.html(`<span class="pm-status-badge ${statusOption.class}">${statusOption.label}</span>`);
                
                frappe.show_alert({
                    message: 'Status updated successfully',
                    indicator: 'green'
                });
                
            } catch (error) {
                console.error('Error updating status:', error);
                frappe.show_alert({
                    message: 'Failed to update status',
                    indicator: 'red'
                });
                
                // Restore original
                $cell.html(`<span class="pm-status-badge status-${currentStatus.toLowerCase()}">${currentStatus}</span>`);
            }
            
            // Remove editing state
            $cell.removeClass('editing');
            $cell.closest('.pm-subtask-item').removeClass('editing');
        });
        
        // Handle escape key
        $select.on('keydown', (e) => {
            if (e.which === 27) { // Escape
                // Restore original
                $cell.html(`<span class="pm-status-badge status-${currentStatus.toLowerCase()}">${currentStatus}</span>`);
                $cell.removeClass('editing');
                $cell.closest('.pm-subtask-item').removeClass('editing');
            }
        });
    }

    // Generic field save method for subtasks
    async saveFieldChange(taskId, field, newValue) {
        const response = await frappe.call({
            method: 'smart_accounting.www.project_management.index.update_task_field',
            args: {
                task_id: taskId,
                field_name: field,
                new_value: newValue
            }
        });

        if (!response.message || !response.message.success) {
            throw new Error(response.message?.error || 'Failed to save field change');
        }

        return response.message;
    }

    async addSubtask(parentTaskId) {
        try {
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.create_subtask',
                args: { parent_task_id: parentTaskId }
            });

            if (response.message && response.message.success) {
                // Refresh subtasks display
                await this.refreshSubtasks(parentTaskId);
                
                frappe.show_alert({
                    message: 'Subtask created successfully',
                    indicator: 'green'
                });

                // Update subtask count indicator
                this.updateSubtaskCount(parentTaskId);

            } else {
                throw new Error(response.message?.error || 'Failed to create subtask');
            }

        } catch (error) {
            console.error('Error creating subtask:', error);
            frappe.show_alert({
                message: 'Failed to create subtask: ' + error.message,
                indicator: 'red'
            });
        }
    }

    async refreshSubtasks(parentTaskId) {
        try {
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.get_subtasks',
                args: { parent_task_id: parentTaskId }
            });

            if (response.message && response.message.success) {
                const subtasks = response.message.subtasks || [];
                
                // Update subtask list - include both subtasks and add row
                const $container = $(`.pm-subtask-container[data-parent-task="${parentTaskId}"]`);
                const $list = $container.find('.pm-subtask-list');
                
                // 关键修复：获取当前用户选择的可见列配置
                // 修复：从URL参数中获取当前视图，而不是依赖可能未设置的window.PM_CONFIG
                const urlParams = new URLSearchParams(window.location.search);
                const currentView = urlParams.get('view') || 'main';
                let visibleColumns = window.ColumnConfigManager.getDefaultVisibleSubtaskColumns();
                
                try {
                    const configResponse = await frappe.call({
                        method: 'smart_accounting.www.project_management.index.get_subtask_column_config',
                        args: { partition_name: currentView }
                    });
                    
                    if (configResponse.message && configResponse.message.success && configResponse.message.visible_columns) {
                        visibleColumns = configResponse.message.visible_columns;
                        console.log(`🔄 Using saved visible columns for refresh: ${visibleColumns}`);
                    }
                } catch (error) {
                    console.warn('Failed to get column config for refresh, using defaults:', error);
                }
                
                $list.html(this.renderSubtaskList(subtasks, parentTaskId, visibleColumns) + this.renderAddSubtaskRow(parentTaskId, visibleColumns));

                // Update header count
                $container.find('.pm-subtask-title').html(`
                    <i class="fa fa-tasks"></i>
                    Subtasks (${subtasks.length})
                `);
                
                // Update the parent task's subtask button indicator
                this.updateSubtaskIndicator(parentTaskId, subtasks.length);
                
                // Re-bind events for new content
                this.bindSubtaskEvents(parentTaskId);
                
                // Re-apply column widths
                this.applySubtaskColumnWidths();
                
                // 注意：由于我们在渲染时已经只渲染了用户选择的可见列，不需要额外的可见性逻辑
                console.log(`✅ Subtask refresh completed for ${parentTaskId} with user-selected visible columns`);
            }

        } catch (error) {
            console.error('Error refreshing subtasks:', error);
        }
    }

    async updateSubtaskStatus(subtaskId, newStatus) {
        try {
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.update_task_status',
                args: {
                    task_id: subtaskId,
                    new_status: newStatus
                }
            });

            if (response.message && response.message.success) {
                // Update status display
                const $item = $(`.pm-subtask-item[data-subtask-id="${subtaskId}"]`);
                const $status = $item.find('.pm-subtask-status');
                $status.removeClass().addClass(`pm-subtask-status status-${newStatus.toLowerCase()}`).text(newStatus);

                frappe.show_alert({
                    message: 'Subtask status updated',
                    indicator: 'green'
                });
            }

        } catch (error) {
            console.error('Error updating subtask status:', error);
            frappe.show_alert({
                message: 'Failed to update subtask status',
                indicator: 'red'
            });
        }
    }

    editSubtask(subtaskId) {
        // For now, just open the task in ERPNext
        window.open(`/app/task/${subtaskId}`, '_blank');
    }

    async deleteSubtask(subtaskId, parentTaskId) {
        const confirmed = await this.utils.showConfirmDialog(
            'Delete Subtask',
            'Are you sure you want to delete this subtask? This action cannot be undone.'
        );

        if (!confirmed) return;

        try {
            const response = await frappe.call({
                method: 'frappe.client.delete',
                args: {
                    doctype: 'Task',
                    name: subtaskId
                }
            });

            // Refresh subtasks display
            await this.refreshSubtasks(parentTaskId);
            
            frappe.show_alert({
                message: 'Subtask deleted',
                indicator: 'orange'
            });

            // Update subtask count
            this.updateSubtaskCount(parentTaskId);

        } catch (error) {
            console.error('Error deleting subtask:', error);
            frappe.show_alert({
                message: 'Failed to delete subtask',
                indicator: 'red'
            });
        }
    }

    async updateSubtaskCount(parentTaskId) {
        // Get the actual current subtask count from the backend
        try {
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.get_subtask_count',
                args: { parent_task_id: parentTaskId }
            });

            if (response.message && response.message.success) {
                const count = response.message.count || 0;
                this.updateSubtaskIndicator(parentTaskId, count);
            } else {
                // Fallback: count from DOM if API fails
                this.updateSubtaskCountFromDOM(parentTaskId);
            }
        } catch (error) {
            console.warn('Failed to get subtask count from backend, using DOM fallback:', error);
            // Fallback: count from DOM
            this.updateSubtaskCountFromDOM(parentTaskId);
        }
    }

    updateSubtaskCountFromDOM(parentTaskId) {
        // Fallback method: count subtasks from the DOM
        const $container = $(`.pm-subtask-container[data-parent-task="${parentTaskId}"]`);
        const count = $container.find('.pm-subtask-item[data-subtask-id]').length;
        this.updateSubtaskIndicator(parentTaskId, count);
    }

    // Load subtask counts for all tasks on page load
    async loadSubtaskCounts() {
        const taskIds = [];
        $('.pm-task-row[data-task-id]').each(function() {
            const taskId = $(this).data('task-id');
            if (taskId) {
                taskIds.push(taskId);
            }
        });

        if (taskIds.length === 0) return;

        try {
            // Get subtask counts for all tasks
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.get_bulk_subtask_counts',
                args: { task_ids: taskIds }
            });

            if (response.message && response.message.success) {
                const subtaskCounts = response.message.subtask_counts;
                
                // Update each task's subtask indicator
                Object.keys(subtaskCounts).forEach(taskId => {
                    const count = subtaskCounts[taskId];
                    this.updateSubtaskIndicator(taskId, count);
                });
            }
        } catch (error) {
            console.warn('Could not load subtask counts:', error);
        }
    }

    updateSubtaskIndicator(taskId, count) {
        const $toggleBtn = $(`.pm-subtask-toggle[data-task-id="${taskId}"]`);
        const isExpanded = $toggleBtn.hasClass('expanded');
        
        if (count > 0) {
            $toggleBtn.addClass('has-subtasks');
            
            // 更新按钮文本 - 优化显示以适应固定宽度
            let buttonText;
            if (count >= 100) {
                buttonText = `<span class="pm-subtask-count">99+</span>`;
            } else if (count >= 10) {
                buttonText = `<span class="pm-subtask-count">${count}</span>`;
            } else {
                buttonText = `<span class="pm-subtask-count">${count}</span>Sub`;
            }
            
            if (isExpanded) {
                buttonText += '<span class="pm-expand-indicator">▼</span>';
                $toggleBtn.attr('title', `Hide ${count} subtask${count !== 1 ? 's' : ''}`);
            } else {
                buttonText += '<span class="pm-expand-indicator">▶</span>';
                $toggleBtn.attr('title', `Show ${count} subtask${count !== 1 ? 's' : ''}`);
            }
            $toggleBtn.html(buttonText);
        } else {
            $toggleBtn.removeClass('has-subtasks');
            $toggleBtn.html('+ Sub');
            $toggleBtn.attr('title', 'Click to add subtask');
        }
    }

    // ===== DEBUG AND TESTING FUNCTIONS =====
    
    // Debug function to test subtask button state updates
    debugSubtaskButtonState(taskId) {
        const $toggleBtn = $(`.pm-subtask-toggle[data-task-id="${taskId}"]`);
        console.log(`🔍 Debug Subtask Button State for task ${taskId}:`);
        console.log(`  - Button exists: ${$toggleBtn.length > 0}`);
        console.log(`  - Button HTML: ${$toggleBtn.html()}`);
        console.log(`  - Has 'expanded' class: ${$toggleBtn.hasClass('expanded')}`);
        console.log(`  - Has 'has-subtasks' class: ${$toggleBtn.hasClass('has-subtasks')}`);
        console.log(`  - Current count from DOM: ${parseInt($toggleBtn.find('.pm-subtask-count').text()) || 0}`);
        console.log(`  - Is in expandedTasks set: ${this.expandedTasks.has(taskId)}`);
        
        // Test updating the indicator
        this.updateSubtaskCount(taskId);
    }

    // ===== SUBTASK COLUMN MANAGEMENT =====

    // Apply column visibility to subtask table - 模仿task的列管理逻辑
    applySubtaskColumnVisibility(parentTaskId, visibleColumns) {
        const $container = $(`.pm-subtask-container[data-parent-task="${parentTaskId}"]`);
        
        // 获取所有可能的subtask列
        const allSubtaskColumns = window.ColumnConfigManager.getAllSubtaskColumnKeys();
        
        console.log('🔧 Applying subtask column visibility:', {
            parentTaskId,
            visibleColumns,
            allSubtaskColumns
        });
        
        // 调试：检查实际的DOM结构
        console.log('🔍 Subtask DOM structure debug:');
        console.log('Container exists:', $container.length);
        console.log('Header exists:', $container.find('.pm-subtask-table-header').length);
        console.log('All header columns:', $container.find('.pm-subtask-table-header .pm-subtask-col').length);
        console.log('All data rows:', $container.find('.pm-subtask-row').length);
        
        // 使用和task完全相同的列隐藏逻辑
        allSubtaskColumns.forEach(column => {
            const shouldShow = visibleColumns.includes(column);
            
            // 使用subtask专用的选择器，避免影响task
            const $headerCells = $container.find(`.pm-subtask-header-cell[data-column="${column}"]`);
            const $dataCells = $container.find(`.pm-subtask-cell-${column}`);
            
            console.log(`🔧 Column ${column}: shouldShow=${shouldShow}, headerCells=${$headerCells.length}, dataCells=${$dataCells.length}`);
            
            if (shouldShow) {
                // 显示列 - 和task相同的逻辑
                $headerCells.removeClass('column-hidden').css('display', 'flex').show();
                $dataCells.removeClass('column-hidden').css('display', 'flex').show();
            } else {
                // 隐藏列 - 和task相同的逻辑
                $headerCells.addClass('column-hidden').css('display', 'none !important').hide();
                $dataCells.addClass('column-hidden').css('display', 'none !important').hide();
            }
        });
        
        // 重新计算subtask表格宽度
        setTimeout(() => {
            this.updateSubtaskTableWidth(parentTaskId);
        }, 50);
    }

    // Update subtask table width after column visibility changes
    updateSubtaskTableWidth(parentTaskId) {
        const $container = $(`.pm-subtask-container[data-parent-task="${parentTaskId}"]`);
        const $table = $container.find('.pm-subtask-table');
        
        // Calculate total width of visible columns
        let totalWidth = 0;
        $container.find('.pm-subtask-col:visible').each(function() {
            totalWidth += $(this).outerWidth() || 100;
        });
        
        // Apply minimum width to ensure proper layout
        const minWidth = Math.max(totalWidth, 800);
        $table.css('min-width', `${minWidth}px`);
        
        console.log(`📏 Updated subtask table width for ${parentTaskId}: ${minWidth}px`);
    }

    // Refresh all expanded subtasks with new column configuration
    async refreshAllExpandedSubtasks() {
        const expandedTaskIds = Array.from(this.expandedTasks);
        console.log('🔄 Refreshing expanded subtasks:', expandedTaskIds);
        
        for (const taskId of expandedTaskIds) {
            try {
                // Get fresh subtask data
                const response = await frappe.call({
                    method: 'smart_accounting.www.project_management.index.get_subtasks',
                    args: { parent_task_id: taskId }
                });

                if (response.message && response.message.success) {
                    const subtasks = response.message.subtasks || [];
                    // Re-render with new configuration
                    await this.renderSubtasks(taskId, subtasks);
                    console.log(`✅ Refreshed subtasks for task ${taskId}`);
                }
            } catch (error) {
                console.error(`❌ Failed to refresh subtasks for task ${taskId}:`, error);
            }
        }
    }

    // Load subtask column widths from server
    async loadSubtaskColumnWidths() {
        return new Promise((resolve) => {
            frappe.call({
                method: 'smart_accounting.www.project_management.index.load_user_column_widths',
                args: { column_type: 'subtasks' },
                callback: (r) => {
                    if (r.message && r.message.success) {
                        this.columnWidths = r.message.column_widths;
                        // console.log Loaded subtask column widths:', this.columnWidths);
                    } else {
                        // Use default widths
                        this.columnWidths = this.getDefaultSubtaskColumnWidths();
                        // console.log Using default subtask column widths:', this.columnWidths);
                    }
                    resolve();
                },
                error: () => {
                    this.columnWidths = this.getDefaultSubtaskColumnWidths();
                    resolve();
                }
            });
        });
    }

    // Get default subtask column widths
    getDefaultSubtaskColumnWidths() {
        return {
            'name': 250,      // Task Name column
            'owner': 120,     // Owner column
            'status': 100,    // Status column  
            'due': 120,       // Due Date column
            'note': 180       // Note column
        };
    }

    // Apply subtask column widths to all subtask tables
    applySubtaskColumnWidths() {
        Object.keys(this.columnWidths).forEach(column => {
            this.setSubtaskColumnWidth(column, this.columnWidths[column]);
        });
    }

    // Set width for a specific subtask column - 独立于task的列宽系统
    setSubtaskColumnWidth(column, width) {
        const minWidth = Math.max(width, 50);
        
        // 只更新subtask的列宽，使用subtask专用的选择器
        $(`.pm-subtask-header-cell.pm-subtask-cell-${column}`).css({
            'width': `${minWidth}px`,
            'min-width': `${minWidth}px`,
            'max-width': `${minWidth}px`
        });
        
        $(`.pm-subtask-cell-${column}`).css({
            'width': `${minWidth}px`,
            'min-width': `${minWidth}px`,
            'max-width': `${minWidth}px`
        });
        
        // Store the new width
        this.columnWidths[column] = minWidth;
    }

    // Save subtask column widths to server
    saveSubtaskColumnWidths() {
        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => {
            frappe.call({
                method: 'smart_accounting.www.project_management.index.save_user_column_widths',
                args: {
                    column_widths: this.columnWidths,
                    column_type: 'subtasks'
                },
                callback: (r) => {
                    if (r.message && r.message.success) {
                        // console.log Subtask column widths saved to server');
                    } else {
                        console.warn('Failed to save subtask column widths to server');
                    }
                }
            });
        }, 300);
    }

    // Initialize subtask column resizing
    initializeSubtaskColumnResizing() {
        // Apply initial widths
        this.applySubtaskColumnWidths();
        
        // Add resize handles to subtask headers (will be added when subtasks are rendered)
        $(document).on('mousedown', '.pm-subtask-col-resizer', (e) => {
            e.preventDefault();
            this.startSubtaskColumnResize(e);
        });
    }

    // Start subtask column resize
    startSubtaskColumnResize(e) {
        const $resizer = $(e.currentTarget);
        const $column = $resizer.parent();
        const columnType = $column.data('column');
        const startX = e.pageX;
        const startWidth = $column.width();
        
        // Add resizing class
        $('body').addClass('pm-resizing-subtask-column');
        
        // Mouse move handler
        const mouseMoveHandler = (e) => {
            const diff = e.pageX - startX;
            const newWidth = Math.max(startWidth + diff, 50);
            this.setSubtaskColumnWidth(columnType, newWidth);
        };
        
        // Mouse up handler
        const mouseUpHandler = () => {
            $('body').removeClass('pm-resizing-subtask-column');
            $(document).off('mousemove', mouseMoveHandler);
            $(document).off('mouseup', mouseUpHandler);
            
            // Save the new widths
            this.saveSubtaskColumnWidths();
        };
        
        // Bind events
        $(document).on('mousemove', mouseMoveHandler);
        $(document).on('mouseup', mouseUpHandler);
    }
}

// Create global instance - avoid duplicate declaration
if (!window.SubtaskManager) {
    window.SubtaskManager = new SubtaskManager();
}

// Export for module systems if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SubtaskManager;
}
