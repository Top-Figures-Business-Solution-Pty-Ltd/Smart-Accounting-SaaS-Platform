// Project Management - Person Selector
// Person selection and role assignment functionality

class PersonSelectorManager {
    constructor() {
        this.utils = window.PMUtils;
        // 添加缓存来避免重复的API调用
        this.roleCache = new Map();
        this.cacheTimeout = 30000; // 30秒缓存过期时间
        
        // 大数据量环境检测
        this.isLargeDataset = false;
        this.checkDatasetSize();
    }

    // 🔧 检测数据集大小，调整策略
    checkDatasetSize() {
        const taskCount = document.querySelectorAll('.pm-task-row').length;
        this.isLargeDataset = taskCount > 100;
        
        if (this.isLargeDataset) {
            console.log(`🔧 Large dataset detected (${taskCount} tasks), using enhanced DOM timing for person selector`);
        }
    }

    // 🔧 增强的DOM元素确认机制
    async ensureDOMElementAndInitialize(selector, $cell, taskId, fieldName) {
        const maxAttempts = this.isLargeDataset ? 15 : 8; // 增加尝试次数
        const baseDelay = this.isLargeDataset ? 50 : 25;  // 增加基础延迟
        const maxDelay = this.isLargeDataset ? 500 : 300; // 增加最大延迟
        
        console.log(`🔧 Starting DOM element search for ${selector}, max attempts: ${maxAttempts}`);
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            // 多重检查策略
            await new Promise(resolve => requestAnimationFrame(resolve));
            
            // 方法1: 标准jQuery选择器
            let $selector = $(selector);
            console.log(`🔧 Attempt ${attempt + 1}: jQuery selector result: ${$selector.length} elements`);
            
            // 方法2: 如果jQuery失败，尝试原生DOM查询
            if ($selector.length === 0) {
                const nativeElement = document.querySelector(selector);
                console.log(`🔧 Attempt ${attempt + 1}: Native DOM query result: ${nativeElement ? 'found' : 'not found'}`);
                if (nativeElement) {
                    $selector = $(nativeElement);
                    console.log(`🔧 Found element using native DOM query on attempt ${attempt + 1}`);
                }
            }
            
            // 方法3: 强制DOM刷新后再次尝试
            if ($selector.length === 0 && attempt > 2) {
                console.log(`🔧 Attempt ${attempt + 1}: Forcing DOM refresh...`);
                // 强制浏览器重新计算DOM
                document.body.offsetHeight;
                $selector = $(selector);
                console.log(`🔧 Attempt ${attempt + 1}: After DOM refresh: ${$selector.length} elements`);
            }
            
            // 方法4: 检查元素是否真的在DOM中
            if ($selector.length === 0 && attempt > 4) {
                console.log(`🔧 Attempt ${attempt + 1}: Checking all elements with similar IDs...`);
                const allModals = document.querySelectorAll('[id*="pm-person-selector"]');
                console.log(`🔧 Found ${allModals.length} elements with similar IDs:`, Array.from(allModals).map(el => el.id));
            }
            
            if ($selector.length > 0) {
                console.log(`✅ Person selector found on attempt ${attempt + 1} (method: ${$selector.length > 0 ? 'success' : 'unknown'})`);
                this.initializeSelectorAfterAppend($selector, $cell, taskId, fieldName);
                return;
            }
            
            // 指数退避延迟，但有最大限制
            if (attempt < maxAttempts - 1) {
                const delay = Math.min(baseDelay * Math.pow(1.2, attempt), maxDelay);
                console.log(`🔧 Attempt ${attempt + 1} failed, waiting ${delay}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        // 最终降级处理
        console.error(`❌ Person selector ${selector} not found after ${maxAttempts} attempts`);
        this.handleSelectorNotFound($cell, taskId, fieldName);
    }

    // 🔧 选择器未找到的降级处理
    handleSelectorNotFound($cell, taskId, fieldName) {
        $cell.removeClass('editing selector-opening');
        frappe.show_alert({
            message: 'Unable to open person selector. Please try again.',
            indicator: 'orange'
        });
        
        // 记录错误用于调试
        console.warn('Person selector failed to initialize:', {
            taskId: taskId,
            fieldName: fieldName,
            cellHtml: $cell[0]?.outerHTML?.substring(0, 100),
            taskCount: document.querySelectorAll('.pm-task-row').length
        });
    }
    
    // 清除特定任务的缓存
    clearTaskRoleCache(taskId) {
        const cacheKey = `task_roles_${taskId}`;
        this.roleCache.delete(cacheKey);
    }
    
    // 清除所有缓存
    clearAllRoleCache() {
        this.roleCache.clear();
    }
    
    // 批量获取多个任务的角色信息，减少API调用
    async getBulkTaskRoles(taskIds) {
        try {
            // 检查哪些任务需要从服务器获取
            const uncachedTaskIds = [];
            const cachedResults = {};
            
            taskIds.forEach(taskId => {
                const cacheKey = `task_roles_${taskId}`;
                const cached = this.roleCache.get(cacheKey);
                
                if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
                    cachedResults[taskId] = cached.data;
                } else {
                    uncachedTaskIds.push(taskId);
                }
            });
            
            // 如果所有数据都在缓存中，直接返回
            if (uncachedTaskIds.length === 0) {
                return cachedResults;
            }
            
            // 批量获取未缓存的数据
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.get_bulk_task_roles',
                args: { task_ids: JSON.stringify(uncachedTaskIds) }
            });
            
            if (response.message && response.message.success) {
                const bulkData = response.message.task_roles || {};
                
                // 缓存新获取的数据
                Object.entries(bulkData).forEach(([taskId, roles]) => {
                    const cacheKey = `task_roles_${taskId}`;
                    this.roleCache.set(cacheKey, {
                        data: roles,
                        timestamp: Date.now()
                    });
                    cachedResults[taskId] = roles;
                });
            }
            
            return cachedResults;
        } catch (error) {
            console.error('Error getting bulk task roles:', error);
            return {};
        }
    }

    // Multi-Person Selector
    async showMultiPersonSelector($cell, taskId, fieldName) {
        // 🔧 防抖机制：防止重复点击
        if ($cell.hasClass('editing') || $cell.hasClass('selector-opening')) {
            console.log('Person selector already opening/open for task:', taskId, fieldName);
            return;
        }
        
        // 标记为正在打开
        $cell.addClass('editing selector-opening');
        
        console.log('🎭 PersonSelectorManager.showMultiPersonSelector called with:', {
            $cell: $cell.length,
            taskId: taskId,
            fieldName: fieldName,
            cellHtml: $cell[0]?.outerHTML?.substring(0, 200) + '...'
        });
        
        try {
            // 立即显示空选择器，不等待数据加载
            this.showEmptyPersonSelector($cell, taskId, fieldName);
            
            // 异步加载数据，不阻塞UI
            this.loadPersonDataAsync($cell, taskId, fieldName);
        } catch (error) {
            console.error('Error in showMultiPersonSelector:', error);
            $cell.removeClass('editing selector-opening');
            frappe.show_alert({
                message: 'Error opening person selector: ' + error.message,
                indicator: 'red'
            });
        }
    }

    showEmptyPersonSelector($cell, taskId, fieldName) {
        // 从UI快速获取当前选择作为初始状态
        let currentEmails = [];
        $cell.find('.pm-avatar[data-email]').each(function() {
            const email = $(this).data('email');
            if (email) currentEmails.push(email);
        });
        
        // Create person selector dropdown outside the table
        const selectorHTML = `
            <div class="pm-person-selector-modal" id="pm-person-selector-${taskId}-${fieldName}">
                <div class="pm-person-selector-content">
                    <div class="pm-person-selector-header">
                        <input type="text" class="pm-person-search" placeholder="Search names, roles or teams" value="">
                        <button class="pm-person-selector-close">
                            <i class="fa fa-times"></i>
                        </button>
                    </div>
                    <div class="pm-person-selector-body">
                        <div class="pm-person-loading" style="text-align: center; padding: 20px; color: #666;">
                            <i class="fa fa-spinner fa-spin"></i>
                            <span style="margin-left: 8px;">Loading assignments...</span>
                        </div>
                        ${currentEmails.length > 0 ? `
                        <div class="pm-current-people" style="display: none;">
                            <div class="pm-current-person-list" id="current-person-list-${taskId}-${fieldName}">
                                <!-- Will be populated by loadCurrentPeople method -->
                            </div>
                        </div>
                        ` : ''}
                        <h4 style="display: none;">Suggested people</h4>
                        <div class="pm-person-options" style="display: none;">
                            <div class="pm-person-option pm-clear-person" data-email="">
                                <div class="pm-avatar pm-empty-avatar">
                                    <i class="fa fa-user"></i>
                                </div>
                                <div class="pm-person-info">
                                    <div class="pm-person-name">No assignment</div>
                                    <div class="pm-person-email">Clear current assignment</div>
                                </div>
                            </div>
                        </div>
                        <div class="pm-person-list" style="display: none;">
                            <!-- People will be loaded dynamically -->
                        </div>
                        <div class="pm-person-selector-footer">
                            <button class="pm-btn pm-btn-primary pm-done-selecting">
                                <i class="fa fa-check"></i>
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing selector
        $('.pm-person-selector-modal').remove();
        console.log('🗑️ Removed existing selectors');
        
        // Add to body
        $('body').append(selectorHTML);
        
        // 🔧 立即验证DOM添加是否成功
        const expectedId = `pm-person-selector-${taskId}-${fieldName}`;
        console.log(`📎 Appended selector with ID: ${expectedId}`);
        console.log(`🔧 Body children count after append: ${document.body.children.length}`);
        
        // 🔧 增强DOM时序保证机制：确保在大数据量环境下也能正常工作
        this.ensureDOMElementAndInitialize(`#${expectedId}`, $cell, taskId, fieldName);
    }

    // 🔧 新增方法：在DOM确认存在后初始化选择器
    initializeSelectorAfterAppend($selector, $cell, taskId, fieldName) {
        try {
            console.log('🔧 Starting person selector initialization:', {
                selectorId: $selector.attr('id'),
                selectorLength: $selector.length,
                taskId: taskId,
                fieldName: fieldName
            });
            
            // 清理状态标记
            $cell.removeClass('selector-opening');
            
            // Position the modal properly relative to cell
            console.log('📍 Step 1: Positioning modal relative to cell...');
            try {
                this.positionModalRelativeToCell($cell, $selector);
                console.log('📍 Positioned modal relative to cell');
            } catch (positionError) {
                console.warn('⚠️ Error in positionModalRelativeToCell:', positionError);
                // 使用简单定位作为降级
                $selector.css({
                    position: 'fixed',
                    top: '100px',
                    left: '100px',
                    zIndex: 9999,
                    width: '320px'
                });
            }
            
            // 智能定位弹窗
            console.log('📍 Step 2: Smart positioning modal...');
            try {
                this.positionModalSmart($cell, $selector);
                console.log('📍 Smart positioning completed');
            } catch (smartPositionError) {
                console.warn('⚠️ Error in positionModalSmart:', smartPositionError);
                // 智能定位失败，使用基本定位
                const cellOffset = $cell.offset();
                $selector.css({
                    position: 'fixed',
                    top: (cellOffset.top + 30) + 'px',
                    left: cellOffset.left + 'px',
                    zIndex: 9999,
                    width: '320px'
                });
            }
            
            // 显示弹窗
            console.log('📍 Step 3: Showing modal...');
            $selector.show();
            console.log('🔧 Selector visibility after show():', $selector.is(':visible'));
            
            $selector.fadeIn(200, function() {
                console.log('🔧 Person selector fadeIn completed, visible:', $(this).is(':visible'));
            });
            
            // Focus search input
            console.log('📍 Step 4: Focusing search input...');
            const $searchInput = $selector.find('.pm-person-search');
            if ($searchInput.length > 0) {
                $searchInput.focus();
                console.log('✅ Search input focused');
            } else {
                console.warn('⚠️ Search input not found');
            }
            
            // Load all people
            console.log('📍 Step 5: Loading people...');
            const $personList = $selector.find('.pm-person-list');
            if ($personList.length > 0) {
                this.loadPeopleForSelector($personList);
                console.log('✅ People loading initiated');
            } else {
                console.warn('⚠️ Person list container not found');
            }
            
            // 绑定所有事件
            console.log('📍 Step 6: Binding events...');
            this.bindSelectorEvents($selector, $cell, taskId, fieldName);
            console.log('✅ Events bound');
            
            // Load current people into the selector
            console.log('📍 Step 7: Loading current people...');
            const currentEmails = [];
            $cell.find('.pm-avatar[data-email]').each(function() {
                const email = $(this).data('email');
                if (email) currentEmails.push(email);
            });
            
            if (currentEmails.length > 0) {
                this.loadCurrentPeopleIntoSelector($selector, currentEmails, taskId, fieldName);
                console.log('✅ Current people loaded:', currentEmails);
            } else {
                console.log('ℹ️ No current people to load');
            }
            
            console.log('✅ Person selector initialization completed successfully');
            
        } catch (error) {
            console.error('❌ Error in person selector initialization:', error);
            $cell.removeClass('editing selector-opening');
            frappe.show_alert({
                message: 'Error initializing person selector: ' + error.message,
                indicator: 'red'
            });
        }
    }

    // 🔧 新增方法：绑定选择器事件
    bindSelectorEvents($selector, $cell, taskId, fieldName) {
        const $searchInput = $selector.find('.pm-person-search');
        
        // 搜索事件
        $searchInput.on('input', (e) => {
            this.searchPeopleForSelector(e.target.value, $selector.find('.pm-person-list'));
        });
        
        // 选择人员事件
        $selector.on('click', '.pm-person-option', (e) => {
            e.stopPropagation();
            const email = $(e.currentTarget).data('email');
            const name = $(e.currentTarget).data('name') || '';
            
            if (email === '') {
                // Clear all people for this role
                this.clearRolePeople($cell, taskId, fieldName);
                $selector.remove();
            } else {
                // Add person to role (multi-select)
                this.addPersonToRole($cell, taskId, fieldName, email, name);
                // Don't close selector - allow multiple selections
                // Update current people display in selector
                this.updateCurrentPeopleInSelector($selector, $cell);
            }
        });
        
        // 关闭按钮事件
        $selector.find('.pm-person-selector-close').on('click', () => {
            // Just close without clearing data
            $selector.remove();
            $cell.removeClass('editing');
        });
        
        // 完成按钮事件
        $selector.find('.pm-done-selecting').on('click', () => {
            // Get current role assignments for this field
            const currentRoles = this.getCurrentRoleAssignments($cell, fieldName);
            
            // Trigger bulk update event if there are selected tasks
            const multiSelectManager = window.multiSelectManager || window.MultiSelectManager;
            if (multiSelectManager && multiSelectManager.selectedTasks && multiSelectManager.selectedTasks.has(taskId) && multiSelectManager.selectedTasks.size > 1) {
                // Trigger bulk update with current role data
                $(document).trigger('pm:cell:changed', {
                    taskId: taskId,
                    field: fieldName,
                    newValue: currentRoles,
                    oldValue: null
                });
            }
            
            $selector.remove();
            $cell.removeClass('editing');
        });
        
        // 移除人员按钮事件
        $selector.on('click', '.pm-remove-person', (e) => {
            e.stopPropagation();
            const emailToRemove = $(e.currentTarget).data('email');
            this.removePersonFromRole($cell, taskId, fieldName, emailToRemove);
            // Don't close selector - allow continued editing
            this.updateCurrentPeopleInSelector($selector, $cell);
        });
        
        // 外部点击关闭事件
        setTimeout(() => {
            $(document).on('click.person-selector', (e) => {
                if (!$(e.target).closest('.pm-person-selector-modal').length) {
                    // Just close the selector, don't clear data
                    $('.pm-person-selector-modal').remove();
                    $cell.removeClass('editing');
                    $(document).off('click.person-selector');
                }
            });
        }, 100);
    }

    positionModalRelativeToCell($cell, $modal) {
        const cellOffset = $cell.offset();
        const cellHeight = $cell.outerHeight();
        const cellWidth = $cell.outerWidth();
        const modalWidth = 320;
        const modalHeight = 400;
        const windowWidth = $(window).width();
        const windowHeight = $(window).height();
        const scrollTop = $(window).scrollTop();
        const scrollLeft = $(window).scrollLeft();
        
        // Calculate position - prefer right side of cell
        let left = cellOffset.left + cellWidth + 10;
        let top = cellOffset.top;
        
        // If modal would go off right edge, position on left side
        if (left + modalWidth > scrollLeft + windowWidth - 20) {
            left = cellOffset.left - modalWidth - 10;
        }
        
        // If still off left edge, center horizontally
        if (left < scrollLeft + 20) {
            left = cellOffset.left - (modalWidth / 2) + (cellWidth / 2);
            // Position below cell if centered
            top = cellOffset.top + cellHeight + 10;
        }
        
        // Adjust vertical position if modal goes off bottom
        if (top + modalHeight > scrollTop + windowHeight - 20) {
            top = cellOffset.top - modalHeight + cellHeight;
        }
        
        // Ensure modal stays within viewport
        if (top < scrollTop + 20) {
            top = scrollTop + 20;
        }
        if (left < scrollLeft + 20) {
            left = scrollLeft + 20;
        }
        
        $modal.css({
            position: 'fixed',
            left: left + 'px',
            top: top + 'px',
            zIndex: 1001
        });
    }
    
    async loadPeopleForSelector($container) {
        try {
            // Get all enabled users with roles (exclude system users)
            const response = await frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'User',
                    fields: ['name', 'email', 'full_name', 'user_image', 'role_profile_name'],
                    filters: [
                        ['enabled', '=', 1],
                        ['user_type', '=', 'System User'],
                        ['name', '!=', 'Guest'],
                        ['name', '!=', 'Administrator'],
                        ['email', '!=', 'admin@example.com']
                    ],
                    limit_page_length: 50,
                    order_by: 'full_name asc'
                }
            });
            
            if (response.message && response.message.length > 0) {
                // Build user cache while generating HTML
                const peopleHTML = response.message.map(user => {
                    const displayName = user.full_name || user.email;
                    const role = user.role_profile_name || 'System User';
                    
                    // Cache user info
                    this.utils.userCache[user.email] = {
                        full_name: displayName,
                        email: user.email,
                        user_image: user.user_image
                    };
                    
                    return `
                        <div class="pm-person-option" data-email="${user.email}" data-name="${displayName}">
                            <div class="pm-avatar" style="background: ${this.utils.getAvatarColor(displayName)}">
                                ${this.utils.getInitials(displayName)}
                            </div>
                            <div class="pm-person-info">
                                <div class="pm-person-name">${displayName}</div>
                                <div class="pm-person-role">${role}</div>
                            </div>
                        </div>
                    `;
                }).join('');
                
                $container.html(peopleHTML);
            } else {
                $container.html('<div class="pm-no-people">No users found</div>');
            }
        } catch (error) {
            console.error('Error loading people:', error);
            $container.html('<div class="pm-no-people">Error loading users</div>');
        }
    }
    
    searchPeopleForSelector(query, $container) {
        if (!query) {
            this.loadPeopleForSelector($container);
            return;
        }
        
        // Filter existing options
        $container.find('.pm-person-option').each(function() {
            const name = $(this).data('name') || '';
            const email = $(this).data('email') || '';
            const visible = name.toLowerCase().includes(query.toLowerCase()) || 
                           email.toLowerCase().includes(query.toLowerCase());
            $(this).toggle(visible);
        });
    }

    async addPersonToRole($cell, taskId, fieldName, email, name) {
        try {
            // Direct sub-table approach (no fallback needed after cleanup)
            
            // Get current roles for this task
            const currentRoles = await this.getCurrentTaskRoles(taskId);
            
            // Get role type - use role filter if specified, otherwise derive from field name
            let roleType;
            const roleFilter = $cell.data('role-filter');
            if (roleFilter) {
                roleType = roleFilter;
            } else {
                // 使用配置管理器映射角色，避免硬编码
                roleType = window.AppConfig ? 
                    window.AppConfig.mapFieldToRole(fieldName) : 
                    fieldName.replace('custom_', '');
            }
            
            // Check if person already assigned to this role
            const existingRole = currentRoles.find(r => r.role === roleType && r.user === email);
            if (existingRole) {
                frappe.show_alert({
                    message: 'Person already assigned to this role',
                    indicator: 'orange'
                });
                return;
            }
            
            // Add new role assignment
            currentRoles.push({
                role: roleType,
                user: email,
                is_primary: currentRoles.filter(r => r.role === roleType).length === 0 // First person is primary
            });
            
            // Save roles
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.set_task_roles',
                args: {
                    task_id: taskId,
                    roles_data: JSON.stringify(currentRoles)
                }
            });
            
            if (response.message && response.message.success) {
                // 清除缓存以确保数据一致性
                this.clearTaskRoleCache(taskId);
                
                // Update cell display
                await this.updatePersonCellDisplay($cell, taskId, roleType);
                
                frappe.show_alert({
                    message: `${name} added as ${roleType}`,
                    indicator: 'green'
                });
                
                // Trigger bulk update event with role data format
                $(document).trigger('pm:cell:changed', {
                    taskId: taskId,
                    field: this.roleTypeToField(roleType),
                    newValue: [{
                        role: roleType,
                        user: email,
                        is_primary: true
                    }],
                    oldValue: null
                });
            }
        } catch (error) {
            console.error('Error adding person to role:', error);
            frappe.show_alert({
                message: 'Error adding person',
                indicator: 'red'
            });
        }
    }

    async clearRolePeople($cell, taskId, fieldName) {
        try {
            // Get current roles for this task
            const currentRoles = await this.getCurrentTaskRoles(taskId);
            
            // Get role type - use role filter if specified, otherwise derive from field name
            let roleType;
            const roleFilter = $cell.data('role-filter');
            if (roleFilter) {
                roleType = roleFilter;
            } else {
                // 使用配置管理器映射角色，避免硬编码
                roleType = window.AppConfig ? 
                    window.AppConfig.mapFieldToRole(fieldName) : 
                    fieldName.replace('custom_', '');
            }
            
            // Remove all assignments for this role
            const filteredRoles = currentRoles.filter(r => r.role !== roleType);
            
            // Save roles
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.set_task_roles',
                args: {
                    task_id: taskId,
                    roles_data: JSON.stringify(filteredRoles)
                }
            });
            
            if (response.message && response.message.success) {
                // Update cell display to empty
                $cell.html(`
                    <div class="pm-user-avatars pm-empty-person">
                        <div class="pm-avatar pm-empty-avatar">
                            <i class="fa fa-user"></i>
                        </div>
                    </div>
                `);
                
                frappe.show_alert({
                    message: 'All people removed from role',
                    indicator: 'orange'
                });
            }
        } catch (error) {
            console.error('Error clearing role people:', error);
            frappe.show_alert({
                message: 'Error clearing people',
                indicator: 'red'
            });
        }
    }

    async getCurrentTaskRoles(taskId) {
        try {
            // 检查缓存
            const cacheKey = `task_roles_${taskId}`;
            const cached = this.roleCache.get(cacheKey);
            
            if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
                return cached.data;
            }
            
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.get_task_roles',
                args: { task_id: taskId }
            });
            
            if (response.message && response.message.success) {
                const roles = response.message.roles || [];
                // 缓存结果
                this.roleCache.set(cacheKey, {
                    data: roles,
                    timestamp: Date.now()
                });
                return roles;
            }
            return [];
        } catch (error) {
            console.error('Error getting current task roles:', error);
            return [];
        }
    }

    async updatePersonCellDisplay($cell, taskId, roleType) {
        try {
            const roles = await this.getCurrentTaskRoles(taskId);
            // roleType is already mapped to sub-table format (e.g., "Action Person")
            const roleUsers = roles.filter(r => r.role === roleType);
            
            if (roleUsers.length === 0) {
                $cell.html(`
                    <div class="pm-user-avatars pm-empty-person">
                        <div class="pm-avatar pm-empty-avatar">
                            <i class="fa fa-user"></i>
                        </div>
                    </div>
                `);
                return;
            }
            
            // 动态生成头像 - 根据列宽度智能调整显示数量
            const { avatarsHTML, moreHTML } = await this.generateDynamicAvatars($cell, roleUsers);
            
            $cell.html(`
                <div class="pm-user-avatars">
                    ${avatarsHTML}
                    ${moreHTML}
                </div>
            `);
            
        } catch (error) {
            console.error('Error updating person cell display:', error);
        }
    }

    async removePersonFromRole($cell, taskId, fieldName, emailToRemove) {
        try {
            // Get current roles for this task
            const currentRoles = await this.getCurrentTaskRoles(taskId);
            
            // Get role type - use role filter if specified, otherwise derive from field name
            let roleType;
            const roleFilter = $cell.data('role-filter');
            if (roleFilter) {
                roleType = roleFilter;
            } else {
                // 使用配置管理器映射角色，避免硬编码
                roleType = window.AppConfig ? 
                    window.AppConfig.mapFieldToRole(fieldName) : 
                    fieldName.replace('custom_', '');
            }
            
            // Remove this specific person from this role
            const filteredRoles = currentRoles.filter(r => !(r.role === roleType && r.user === emailToRemove));
            
            // If we removed the primary person, make the next person primary
            const remainingInRole = filteredRoles.filter(r => r.role === roleType);
            if (remainingInRole.length > 0 && !remainingInRole.some(r => r.is_primary)) {
                remainingInRole[0].is_primary = true;
            }
            
            // Save roles
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.set_task_roles',
                args: {
                    task_id: taskId,
                    roles_data: JSON.stringify(filteredRoles)
                }
            });
            
            if (response.message && response.message.success) {
                // 清除缓存以确保数据一致性
                this.clearTaskRoleCache(taskId);
                
                // Update cell display
                await this.updatePersonCellDisplay($cell, taskId, roleType);
                
                // 刷新弹窗内容 - 重新加载当前人员列表
                const $currentModal = $(`.pm-person-selector-modal`);
                if ($currentModal.length > 0) {
                    // console.log Refreshing modal content after person removal...');
                    // 获取更新后的人员列表
                    const updatedEmails = await this.getCurrentTaskRoleEmails(taskId, roleType);
                    // 更新弹窗中的当前人员显示
                    this.loadCurrentPeopleIntoSelector($currentModal, updatedEmails, taskId, fieldName);
                    // console.log Modal content refreshed');
                }
                
                frappe.show_alert({
                    message: 'Person removed from role',
                    indicator: 'orange'
                });
            }
        } catch (error) {
            console.error('Error removing person from role:', error);
            frappe.show_alert({
                message: 'Error removing person',
                indicator: 'red'
            });
        }
    }

    async loadCurrentPeopleIntoSelector($selector, currentEmails, taskId, fieldName) {
        const $currentList = $selector.find(`#current-person-list-${taskId}-${fieldName}`);
        
        if (currentEmails.length === 0) {
            $currentList.parent().hide();
            return;
        }
        
        // Get full user info for each email
        const currentPeopleHTML = await Promise.all(currentEmails.map(async (email) => {
            try {
                const userInfo = await this.utils.getRealUserInfo(email);
                const name = userInfo?.full_name || email;
                return `
                    <div class="pm-current-person" data-email="${email}">
                        <div class="pm-avatar" style="background: ${this.utils.getAvatarColor(name)}">
                            ${this.utils.getInitials(name)}
                        </div>
                        <span class="pm-person-name">${name}</span>
                        <button class="pm-remove-person" data-email="${email}">
                            <i class="fa fa-times"></i>
                        </button>
                    </div>
                `;
            } catch (error) {
                console.warn('Could not get user info for', email);
                return `
                    <div class="pm-current-person" data-email="${email}">
                        <div class="pm-avatar" style="background: ${this.utils.getAvatarColor(email)}">
                            ${this.utils.getInitials(email)}
                        </div>
                        <span class="pm-person-name">${email}</span>
                        <button class="pm-remove-person" data-email="${email}">
                            <i class="fa fa-times"></i>
                        </button>
                    </div>
                `;
            }
        }));
        
        $currentList.html(currentPeopleHTML.join(''));
        $currentList.parent().show();
    }

    updateCurrentPeopleInSelector($selector, $cell) {
        // This method is now simplified - just refresh the cell display
        // The selector will be closed and reopened if needed
        console.log('Current people updated in selector');
    }

    // Legacy single person assignment - DEPRECATED, use set_task_roles instead
    async selectPerson($cell, taskId, fieldName, email, name) {
        try {
            // Convert field name to role type
            const roleType = this.fieldToRoleType(fieldName);
            
            // Use the modern roles API
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.set_task_roles',
                args: {
                    task_id: taskId,
                    roles_data: JSON.stringify([{
                        role: roleType,
                        user: email,
                        is_primary: true
                    }])
                }
            });
            
            if (response.message && response.message.success) {
                // Update UI
                this.updatePersonFieldDisplay($cell, email, name);
                
                frappe.show_alert({
                    message: 'Person assignment updated',
                    indicator: 'green'
                });
                
                // Trigger bulk update event
                $(document).trigger('pm:cell:changed', {
                    taskId: taskId,
                    field: fieldName,
                    newValue: email,
                    oldValue: null
                });
            } else {
                throw new Error(response.message?.error || 'Update failed');
            }
        } catch (error) {
            console.error('Error updating person:', error);
            frappe.show_alert({
                message: 'Failed to update assignment',
                indicator: 'red'
            });
            this.cancelPersonSelection($cell);
        }
        
        // Clean up
        $(document).off('click.person-selector');
    }
    
    updatePersonFieldDisplay($cell, email, name) {
        if (!email) {
            // Show empty state
            $cell.html(`
                <div class="pm-user-avatars editable-field pm-empty-person">
                    <div class="pm-avatar pm-empty-avatar">
                        <i class="fa fa-user"></i>
                    </div>
                </div>
            `);
        } else {
            // Show person
            const initials = this.utils.getInitials(name);
            const color = this.utils.getAvatarColor(name);
            $cell.html(`
                <div class="pm-user-avatars editable-field">
                    <div class="pm-avatar" title="${name}" data-email="${email}" style="background: ${color}">
                        ${initials}
                    </div>
                </div>
            `);
        }
        $cell.removeClass('editing');
    }

    cancelPersonSelection($cell) {
        // Get original content from data attributes or restore from server
        const taskId = $cell.data('task-id');
        const fieldName = $cell.data('field');
        
        // Restore from current data without making server call
        this.restorePersonFieldFromData($cell, taskId, fieldName);
        
        $cell.removeClass('editing');
        $(document).off('click.person-selector');
    }
    
    async restorePersonFieldFromData($cell, taskId, fieldName) {
        try {
            // Get fresh data from server to restore accurate state
            const response = await frappe.call({
                method: 'frappe.client.get',
                args: {
                    doctype: 'Task',
                    name: taskId,
                    fields: [fieldName]
                }
            });
            
            if (response.message) {
                const currentValue = response.message[fieldName];
                if (currentValue) {
                    // Get user info and restore display
                    const userResponse = await frappe.call({
                        method: 'frappe.client.get',
                        args: {
                            doctype: 'User',
                            name: currentValue,
                            fields: ['full_name', 'email']
                        }
                    });
                    
                    if (userResponse.message) {
                        const user = userResponse.message;
                        const displayName = user.full_name || user.email;
                        this.updatePersonFieldDisplay($cell, user.email, displayName);
                        return;
                    }
                }
            }
            
            // If no data, show empty state
            this.updatePersonFieldDisplay($cell, '', '');
            
        } catch (error) {
            console.error('Error restoring field data:', error);
            // Show empty state on error
            this.updatePersonFieldDisplay($cell, '', '');
        }
    }
    positionModalSmart($cell, $modal) {
        console.log('🎯 Smart positioning modal...');
        
        // 获取单元格位置信息
        const cellRect = $cell[0].getBoundingClientRect();
        const modalHeight = 400; // 弹窗预估高度
        const modalWidth = 320;  // 弹窗宽度
        const padding = 8;       // 边距
        
        // 获取视窗信息
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        console.log('📐 Positioning data:', {
            cellRect: {
                top: cellRect.top,
                bottom: cellRect.bottom,
                left: cellRect.left,
                right: cellRect.right,
                width: cellRect.width,
                height: cellRect.height
            },
            viewport: {
                width: viewportWidth,
                height: viewportHeight,
                scrollTop: scrollTop
            }
        });
        
        // 计算最佳位置
        let position = this.calculateOptimalPosition(cellRect, modalWidth, modalHeight, padding, viewportWidth, viewportHeight);
        
        // 应用位置样式
        $modal.css({
            position: 'fixed',
            top: position.top + 'px',
            left: position.left + 'px',
            zIndex: 9999,
            width: modalWidth + 'px',
            maxHeight: modalHeight + 'px'
        });
        
        // console.log Modal positioned at:', position);
    }
    
    calculateOptimalPosition(cellRect, modalWidth, modalHeight, padding, viewportWidth, viewportHeight) {
        let top, left;
        let placement = 'bottom-left'; // 默认位置
        
        // 水平位置计算
        // 优先尝试在单元格左侧对齐
        left = cellRect.left;
        
        // 检查右边界是否超出视窗
        if (left + modalWidth > viewportWidth - padding) {
            // 右对齐到单元格右边
            left = cellRect.right - modalWidth;
            placement = placement.replace('left', 'right');
        }
        
        // 确保不超出左边界
        if (left < padding) {
            left = padding;
        }
        
        // 垂直位置计算
        // 优先尝试在单元格下方
        top = cellRect.bottom + padding;
        
        // 检查下边界是否超出视窗
        if (top + modalHeight > viewportHeight - padding) {
            // 显示在单元格上方
            top = cellRect.top - modalHeight - padding;
            placement = placement.replace('bottom', 'top');
            
            // 如果上方也不够空间，则显示在视窗顶部
            if (top < padding) {
                top = padding;
                placement = 'viewport-top';
            }
        }
        
        console.log('📍 Calculated position:', { top, left, placement });
        
        return { top, left, placement };
    }
    
    async getCurrentTaskRoleEmails(taskId, roleType) {
        try {
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.get_task_role_assignments',
                args: { 
                    task_id: taskId,
                    role_filter: roleType 
                }
            });
            
            if (response.message && response.message.success) {
                return response.message.role_assignments.map(assignment => assignment.user);
            }
        } catch (error) {
            console.warn('Error getting current task role emails:', error);
        }
        return [];
    }
    
    async generateDynamicAvatars($cell, roleUsers) {
        console.log('🎨 Generating dynamic avatars for', roleUsers.length, 'users');
        
        // 计算列可用宽度和容量
        const capacity = this.calculateAvatarCapacity($cell);
        console.log('📏 Avatar capacity for this cell:', capacity);
        
        let avatarsHTML = '';
        let moreHTML = '';
        
        if (roleUsers.length === 0) {
            return { avatarsHTML: '', moreHTML: '' };
        }
        
        // 优化显示策略：
        // - 1-2个人：显示所有profile
        // - 3个及以上：显示1个profile + +N指示器
        let displayCount, hasMore;
        
        if (roleUsers.length <= 2) {
            displayCount = roleUsers.length;
            hasMore = false;
        } else {
            displayCount = 1; // 3个及以上只显示1个profile
            hasMore = true;
        }
        
        // 生成可见的头像
        for (let i = 0; i < displayCount; i++) {
            const user = roleUsers[i];
            const userInfo = await this.utils.getRealUserInfo(user.user);
            const initials = this.utils.getInitials(userInfo?.full_name || user.user);
            const isPrimary = user.is_primary ? ' pm-primary-user' : '';
            
            avatarsHTML += `<div class="pm-avatar${isPrimary}" title="${userInfo?.full_name || user.user}" data-email="${user.user}">${initials}</div>`;
        }
        
        // 生成+N按钮（如果需要）
        if (hasMore) {
            const remainingCount = roleUsers.length - displayCount;
            const allNames = roleUsers.slice(displayCount).map(u => u.user).join(', ');
            moreHTML = `<div class="pm-avatar-more" title="Total ${roleUsers.length} people: ${allNames}">+${remainingCount}</div>`;
        }
        
        // console.log Generated ${displayCount} avatars + ${hasMore ? '1 more indicator' : 'no more indicator'}`);
        
        return { avatarsHTML, moreHTML };
    }
    
    calculateAvatarCapacity($cell) {
        // 优化显示策略：最多显示2个头像，3个及以上显示1个 + +N指示器
        // 这样既保持良好的UX，又减少DOM复杂度和内存占用
        const fixedCapacity = 2;
        
        console.log('📐 Optimized capacity strategy: Show max 2 avatars, then 1 avatar + more indicator');
        
        return fixedCapacity;
    }
    
    fieldToRoleType(fieldName) {
        // Convert field name to role type for the roles API
        const fieldToRoleMap = {
            'custom_action_person': 'action_person',
            'custom_preparer': 'preparer',
            'custom_reviewer': 'reviewer',
            'custom_partner': 'partner'
        };
        return fieldToRoleMap[fieldName] || fieldName;
    }
    
    roleTypeToField(roleType) {
        // Convert role type back to field name (handle both formats)
        const roleToFieldMap = {
            // Title case format (backend format)
            'Action Person': 'custom_action_person',
            'Preparer': 'custom_preparer',
            'Reviewer': 'custom_reviewer',
            'Partner': 'custom_partner',
            // Legacy lowercase format (for backward compatibility)
            'action_person': 'custom_action_person',
            'preparer': 'custom_preparer',
            'reviewer': 'custom_reviewer',
            'partner': 'custom_partner'
        };
        return roleToFieldMap[roleType] || roleType;
    }
    
    getCurrentRoleAssignments($cell, fieldName) {
        // Get current role assignments from the cell's UI
        const roleType = this.fieldToRoleType(fieldName);
        const assignments = [];
        
        // Find all person avatars in the cell
        $cell.find('.pm-avatar').each((index, avatar) => {
            const $avatar = $(avatar);
            const email = $avatar.data('email') || $avatar.attr('title');
            
            if (email && !$avatar.hasClass('pm-empty-avatar')) {
                assignments.push({
                    role: roleType,
                    user: email,
                    is_primary: index === 0 // First person is primary
                });
            }
        });
        
        return assignments;
    }
    
    fieldToRoleType(fieldName) {
        // Map field names to role types (backend expects title case format)
        const mapping = {
            'custom_action_person': 'Action Person',
            'custom_preparer': 'Preparer',
            'custom_reviewer': 'Reviewer',
            'custom_partner': 'Partner'
        };
        return mapping[fieldName] || fieldName.replace('custom_', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    async loadPersonDataAsync($cell, taskId, fieldName) {
        const $selector = $(`#pm-person-selector-${taskId}-${fieldName}`);
        if ($selector.length === 0) return;

        const roleFilter = $cell.data('role-filter');

        try {
            // 加载当前分配，使用超时机制
            let currentEmails = [];
            try {
                currentEmails = await this.getCurrentAssignmentsWithTimeout(taskId, roleFilter);
                // console.log Current assignments loaded:', currentEmails);
            } catch (error) {
                console.warn('⚠️ Could not load current assignments, using UI fallback:', error);
                // 降级到UI方法
                $cell.find('.pm-avatar[data-email]').each(function() {
                    const email = $(this).data('email');
                    if (email) currentEmails.push(email);
                });
            }

            // 隐藏加载状态，显示内容
            $selector.find('.pm-person-loading').hide();
            $selector.find('h4').show();
            $selector.find('.pm-person-options').show();
            $selector.find('.pm-person-list').show();
            if (currentEmails.length > 0) {
                $selector.find('.pm-current-people').show();
            }

            // 加载当前人员和可用人员
            this.loadCurrentPeopleIntoSelector($selector, currentEmails, taskId, fieldName);
            this.loadPeopleForSelector($selector.find('.pm-person-list'));

        } catch (error) {
            console.error('❌ Error loading person data:', error);
            this.showPersonLoadError($selector, $cell, taskId, fieldName);
        }
    }

    async getCurrentAssignmentsWithTimeout(taskId, roleFilter, timeout = 5000) {
        return Promise.race([
            frappe.call({
                method: 'smart_accounting.www.project_management.index.get_task_role_assignments',
                args: { 
                    task_id: taskId,
                    role_filter: roleFilter 
                }
            }).then(response => {
                if (response.message && response.message.success) {
                    return response.message.role_assignments.map(assignment => assignment.user);
                }
                return [];
            }),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), timeout)
            )
        ]);
    }

    async getAvailablePeopleWithTimeout(timeout = 5000) {
        // 简化：直接返回空数组，让现有的 loadPeopleForSelector 处理
        return Promise.resolve([]);
    }

    showPersonLoadError($selector, $cell, taskId, fieldName) {
        $selector.find('.pm-person-loading').html(`
            <div style="text-align: center; padding: 20px; color: #e74c3c;">
                <i class="fa fa-exclamation-triangle"></i>
                <div style="margin-top: 8px;">Failed to load assignments</div>
                <button class="pm-btn pm-btn-secondary pm-retry-person-load" style="margin-top: 8px; font-size: 12px;">Retry</button>
            </div>
        `);
        
        // 显示基本功能
        $selector.find('h4').show();
        $selector.find('.pm-person-options').show();
        $selector.find('.pm-person-list').show();
        
        // 绑定重试事件
        $selector.find('.pm-retry-person-load').on('click', (e) => {
            e.stopPropagation();
            $selector.find('.pm-person-loading').html(`
                <i class="fa fa-spinner fa-spin"></i>
                <span style="margin-left: 8px;">Retrying...</span>
            `);
            this.loadPersonDataAsync($cell, taskId, fieldName);
        });
    }
}

// Create global instance
window.PersonSelectorManager = new PersonSelectorManager();

// Export for module systems if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PersonSelectorManager;
}
