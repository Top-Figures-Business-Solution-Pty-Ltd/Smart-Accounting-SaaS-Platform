// Project Management - Primary Column Manager
// Manages dynamic placement of functional buttons (subtask, comment) in the primary column

class PrimaryColumnManager {
    constructor() {
        this.utils = window.PMUtils;
        this.currentPrimaryColumn = 'client'; // Default primary column
    }

    /**
     * 初始化主列管理器
     */
    initialize() {
        // 监听列配置变化事件
        $(document).on('primary-column-changed', (e, data) => {
            this.handlePrimaryColumnChange(data.newPrimaryColumn, data.oldPrimaryColumn);
        });
        
        // 初始化当前主列样式
        this.initializePrimaryColumnStyles();
        
        console.log('✅ Primary Column Manager initialized');
    }

    /**
     * 初始化主列样式
     */
    initializePrimaryColumnStyles() {
        // 延迟执行，确保DOM已经加载完成
        setTimeout(() => {
            // 获取第一个可见列作为主列
            const $firstVisibleHeader = $('.pm-header-cell:visible').first();
            if ($firstVisibleHeader.length) {
                const primaryColumn = $firstVisibleHeader.data('column');
                if (primaryColumn) {
                    this.currentPrimaryColumn = primaryColumn;
                    
                    // 确保主列样式正确应用
                    this.ensurePrimaryColumnStyles();
                    
                    console.log(`🎨 Initialized primary column styles for: ${primaryColumn}`);
                }
            }
        }, 500);
    }

    /**
     * 设置当前主列
     * @param {string} primaryColumn - 主列键
     */
    setPrimaryColumn(primaryColumn) {
        // 防御性检查
        if (!primaryColumn || typeof primaryColumn !== 'string') {
            console.warn('⚠️ Invalid primary column provided:', primaryColumn);
            return;
        }
        
        const oldPrimaryColumn = this.currentPrimaryColumn;
        
        // 避免无意义的重复设置
        if (oldPrimaryColumn === primaryColumn) {
            console.log(`ℹ️ Primary column already set to: ${primaryColumn}`);
            return;
        }
        
        this.currentPrimaryColumn = primaryColumn;
        
        // 触发主列变化事件
        $(document).trigger('primary-column-changed', {
            newPrimaryColumn: primaryColumn,
            oldPrimaryColumn: oldPrimaryColumn
        });
        
        console.log(`🔄 Primary column changed from ${oldPrimaryColumn} to ${primaryColumn}`);
    }

    /**
     * 处理主列变化
     * @param {string} newPrimaryColumn - 新主列
     * @param {string} oldPrimaryColumn - 旧主列
     */
    handlePrimaryColumnChange(newPrimaryColumn, oldPrimaryColumn) {
        // 更新表头的主列样式
        this.updateHeaderPrimaryStyles(newPrimaryColumn, oldPrimaryColumn);
        
        // 移动所有任务行的功能按钮到新主列
        $('.pm-task-row').each((index, taskRow) => {
            const $taskRow = $(taskRow);
            const taskId = $taskRow.data('task-id');
            
            if (taskId) {
                this.moveFunctionalButtons(taskId, oldPrimaryColumn, newPrimaryColumn);
            }
        });
        
        // 更新新任务模板
        this.updateNewTaskTemplate(newPrimaryColumn);
    }

    /**
     * 更新表头的主列样式
     * @param {string} newPrimaryColumn - 新主列
     * @param {string} oldPrimaryColumn - 旧主列
     */
    updateHeaderPrimaryStyles(newPrimaryColumn, oldPrimaryColumn) {
        // 移除所有列的主列样式
        $('.pm-header-cell, .pm-cell').removeClass('pm-primary-column');
        
        // 为新主列添加样式类（任何列成为主列都获得原client的特殊样式）
        if (newPrimaryColumn) {
            $(`.pm-header-cell[data-column="${newPrimaryColumn}"]`).addClass('pm-primary-column');
            $(`.pm-cell-${newPrimaryColumn}`).addClass('pm-primary-column');
        }
        
        console.log(`🎨 Applied primary column styles to: ${newPrimaryColumn} (removed from: ${oldPrimaryColumn})`);
    }

    /**
     * 移动功能按钮从旧列到新列
     * @param {string} taskId - 任务ID
     * @param {string} fromColumn - 源列
     * @param {string} toColumn - 目标列
     */
    moveFunctionalButtons(taskId, fromColumn, toColumn) {
        const $taskRow = $(`.pm-task-row[data-task-id="${taskId}"]`);
        
        if (!$taskRow.length) {
            console.warn(`Task row not found for task ID: ${taskId}`);
            return;
        }

        // 获取源列和目标列的单元格
        const $fromCell = $taskRow.find(`.pm-cell-${fromColumn}`);
        const $toCell = $taskRow.find(`.pm-cell-${toColumn}`);
        
        if (!$fromCell.length || !$toCell.length) {
            console.warn(`Column cells not found for task ${taskId}: from=${fromColumn}, to=${toColumn}`);
            return;
        }

        // 提取功能按钮状态
        const $subtaskButton = $fromCell.find('.pm-subtask-toggle');
        const $commentIndicator = $fromCell.find('.pm-comment-indicator');
        
        // 提取子任务数量
        const subtaskCountText = $subtaskButton.find('.pm-subtask-count').text() || '0';
        const subtaskCount = parseInt(subtaskCountText) || 0;
        
        const buttonState = {
            subtaskState: $subtaskButton.hasClass('expanded') ? 'expanded' : 'collapsed',
            hasSubtasks: $subtaskButton.hasClass('has-subtasks'),
            subtaskCount: subtaskCount,
            commentCount: $commentIndicator.find('.pm-comment-count').text() || '0'
        };

        // 完全清理源列的功能按钮和相关结构
        this.cleanupFunctionalButtons($fromCell, fromColumn);
        
        // 在目标列创建新的功能按钮
        this.createFunctionalButtons(taskId, toColumn, buttonState);

        console.log(`🔄 Moved functional buttons for task ${taskId} from ${fromColumn} to ${toColumn}`);
    }

    /**
     * 清理列中的功能按钮和相关结构
     * @param {jQuery} $cell - 单元格jQuery对象
     * @param {string} columnKey - 列键
     */
    cleanupFunctionalButtons($cell, columnKey) {
        // 移除所有功能按钮相关元素
        $cell.find('.pm-subtask-toggle, .pm-comment-indicator, .pm-functional-buttons').remove();
        
        // 根据列类型恢复原始结构
        if (columnKey === 'client') {
            // 恢复client列的原始结构
            const clientName = this.extractClientName($cell.html());
            $cell.html(`
                <span class="pm-client-selector-trigger client-display" 
                      data-field="custom_client"
                      data-field-type="client_selector"
                      title="Click to select client">${clientName}</span>
            `);
        } else {
            // 其他列恢复为简单的可编辑内容
            const mainContent = this.extractMainContent($cell.html());
            $cell.html(mainContent);
        }
        
        // 移除主列相关的CSS类
        $cell.removeClass('pm-client-with-comments pm-primary-column');
    }

    /**
     * 在指定列中创建功能按钮
     * @param {string} taskId - 任务ID
     * @param {string} columnKey - 列键
     * @param {Object} state - 按钮状态
     */
    createFunctionalButtons(taskId, columnKey, state = {}) {
        const $taskRow = $(`.pm-task-row[data-task-id="${taskId}"]`);
        const $targetCell = $taskRow.find(`.pm-cell-${columnKey}`);
        
        if (!$targetCell.length) {
            console.warn(`Target cell not found for column: ${columnKey}`);
            return;
        }

        // 获取当前单元格的内容
        const currentContent = $targetCell.html();
        
        // 创建功能按钮HTML
        const functionalButtonsHtml = this.generateFunctionalButtonsHtml(taskId, state);
        
        // 为主列单元格添加样式类（获得sticky定位等特殊样式）
        $targetCell.addClass('pm-primary-column');
        
        // 根据列类型决定按钮放置方式
        if (columnKey === 'client') {
            // Client列使用原有的结构，但也添加主列样式
            $targetCell.addClass('pm-client-with-comments');
            $targetCell.html(`
                <div class="pm-client-content">
                    ${functionalButtonsHtml}
                    <span class="pm-client-selector-trigger client-display" 
                          data-task-id="${taskId}"
                          data-field="custom_client"
                          data-field-type="client_selector"
                          title="Click to select client">${this.extractClientName(currentContent)}</span>
                </div>
                <div class="pm-client-comments">
                    <div class="pm-comment-indicator" data-task-id="${taskId}" title="Click to view or add comments">
                        <i class="fa fa-comment-o"></i>
                        <span class="pm-comment-count">${state.commentCount || '0'}</span>
                    </div>
                </div>
            `);
        } else {
            // 其他列使用通用结构，同样获得主列样式
            $targetCell.html(`
                <div class="pm-primary-column-content">
                    ${functionalButtonsHtml}
                    <div class="pm-column-main-content">
                        ${this.extractMainContent(currentContent)}
                    </div>
                </div>
                <div class="pm-column-comments">
                    <div class="pm-comment-indicator" data-task-id="${taskId}" title="Click to view or add comments">
                        <i class="fa fa-comment-o"></i>
                        <span class="pm-comment-count">${state.commentCount || '0'}</span>
                    </div>
                </div>
            `);
        }

        // 应用状态
        if (state.subtaskState === 'expanded') {
            $targetCell.find('.pm-subtask-toggle').addClass('expanded');
        }
        if (state.hasSubtasks) {
            $targetCell.find('.pm-subtask-toggle').addClass('has-subtasks');
        }
        
        console.log(`✅ Created functional buttons for task ${taskId} in column ${columnKey}`);
    }

    /**
     * 生成功能按钮HTML
     * @param {string} taskId - 任务ID
     * @param {Object} state - 按钮状态
     * @returns {string} 按钮HTML
     */
    generateFunctionalButtonsHtml(taskId, state = {}) {
        const hasSubtasks = state.hasSubtasks;
        const subtaskCount = state.subtaskCount || 0;
        const isExpanded = state.subtaskState === 'expanded';
        
        let buttonText, title;
        
        if (hasSubtasks) {
            // 有子任务时显示数量 - 优化显示以适应固定宽度
            if (subtaskCount >= 100) {
                buttonText = `<span class="pm-subtask-count">99+</span>`;
            } else if (subtaskCount >= 10) {
                buttonText = `<span class="pm-subtask-count">${subtaskCount}</span>`;
            } else {
                buttonText = `<span class="pm-subtask-count">${subtaskCount}</span>Sub`;
            }
            
            if (isExpanded) {
                buttonText += '<span class="pm-expand-indicator">▼</span>';
                title = `Hide ${subtaskCount} subtask${subtaskCount !== 1 ? 's' : ''}`;
            } else {
                buttonText += '<span class="pm-expand-indicator">▶</span>';
                title = `Show ${subtaskCount} subtask${subtaskCount !== 1 ? 's' : ''}`;
            }
        } else {
            // 无子任务时显示添加提示
            buttonText = '+ Sub';
            title = 'Click to add subtask';
        }
        
        return `
            <div class="pm-subtask-button-container">
                <button class="pm-subtask-toggle ${isExpanded ? 'expanded' : ''} ${hasSubtasks ? 'has-subtasks' : ''}" 
                        data-task-id="${taskId}" 
                        title="${title}">
                    ${buttonText}
                </button>
            </div>
        `;
    }

    /**
     * 提取客户端名称
     * @param {string} html - HTML内容
     * @returns {string} 客户端名称
     */
    extractClientName(html) {
        const $temp = $('<div>').html(html);
        const clientName = $temp.find('.client-display').text() || 
                          $temp.find('.pm-client-selector-trigger').text() ||
                          'No Client';
        return clientName.trim();
    }

    /**
     * 提取主要内容
     * @param {string} html - HTML内容
     * @returns {string} 主要内容
     */
    extractMainContent(html) {
        const $temp = $('<div>').html(html);
        
        // 移除功能按钮相关的元素
        $temp.find('.pm-subtask-toggle, .pm-comment-indicator, .pm-functional-buttons, .pm-client-content, .pm-client-comments').remove();
        
        // 返回剩余内容，如果为空则返回占位符
        const content = $temp.html().trim();
        return content || '<span class="editable-field">-</span>';
    }

    /**
     * 更新新任务模板
     * @param {string} primaryColumn - 主列键
     */
    updateNewTaskTemplate(primaryColumn) {
        // 这个方法将在创建新任务时被调用
        // 确保新任务的功能按钮放在正确的列中
        this.currentPrimaryColumn = primaryColumn;
        console.log(`📝 Updated new task template for primary column: ${primaryColumn}`);
    }

    /**
     * 为新任务初始化功能按钮
     * @param {string} taskId - 任务ID
     * @param {string} clientName - 客户端名称
     */
    initializeFunctionalButtonsForNewTask(taskId, clientName = 'No Client') {
        // 延迟执行，确保DOM已经渲染
        setTimeout(() => {
            this.createFunctionalButtons(taskId, this.currentPrimaryColumn, {
                subtaskState: 'collapsed',
                hasSubtasks: false,
                commentCount: '0'
            });
        }, 100);
    }

    /**
     * 获取当前主列
     * @returns {string} 当前主列键
     */
    getCurrentPrimaryColumn() {
        return this.currentPrimaryColumn;
    }

    /**
     * 刷新所有任务的功能按钮位置和主列样式
     */
    refreshAllFunctionalButtons() {
        // 首先确保主列样式正确应用
        this.ensurePrimaryColumnStyles();
        
        $('.pm-task-row').each((index, taskRow) => {
            const $taskRow = $(taskRow);
            const taskId = $taskRow.data('task-id');
            
            if (taskId) {
                // 清理所有列的功能按钮
                this.cleanupAllFunctionalButtonsForTask(taskId);
                
                // 在当前主列中创建功能按钮
                this.createFunctionalButtons(taskId, this.currentPrimaryColumn);
            }
        });
        
        console.log('🔄 Refreshed all functional buttons and primary column styles');
    }

    /**
     * 确保主列样式正确应用
     */
    ensurePrimaryColumnStyles() {
        // 性能优化：只移除已有主列样式的元素
        $('.pm-primary-column').removeClass('pm-primary-column');
        
        // 为当前主列添加样式
        if (this.currentPrimaryColumn) {
            $(`.pm-header-cell[data-column="${this.currentPrimaryColumn}"]`).addClass('pm-primary-column');
            $(`.pm-cell-${this.currentPrimaryColumn}`).addClass('pm-primary-column');
            console.log(`🎨 Ensured primary column styles applied to: ${this.currentPrimaryColumn}`);
        }
    }

    /**
     * 清理任务行中所有列的功能按钮
     * @param {string} taskId - 任务ID
     */
    cleanupAllFunctionalButtonsForTask(taskId) {
        const $taskRow = $(`.pm-task-row[data-task-id="${taskId}"]`);
        
        // 动态获取所有可能的列，避免硬编码
        const allColumns = window.ColumnConfigManager ? 
            window.ColumnConfigManager.getAllColumnKeys() : 
            ['client', 'task-name', 'entity', 'status', 'note']; // 后备硬编码
        
        allColumns.forEach(columnKey => {
            const $cell = $taskRow.find(`.pm-cell-${columnKey}`);
            if ($cell.length && $cell.find('.pm-subtask-toggle, .pm-comment-indicator').length > 0) {
                this.cleanupFunctionalButtons($cell, columnKey);
            }
        });
    }
}

// 创建全局实例
window.PrimaryColumnManager = new PrimaryColumnManager();

// Export for module systems if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PrimaryColumnManager;
}
