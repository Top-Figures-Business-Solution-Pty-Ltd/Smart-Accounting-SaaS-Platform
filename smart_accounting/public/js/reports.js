// Project Management - Reports and Filtering
// Report generation and advanced filtering logic

class ReportsManager {
    constructor() {
        this.utils = window.PMUtils;
        this.activeFilters = {
            person: null,
            client: null,
            status: null
        };
        this.advancedFilters = [];
    }

    // Search functionality
    setupSearch() {
        let searchTimeout;
        $('#pm-search-input').on('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.performSearch(e.target.value);
            }, 300);
        });
    }

    performSearch(query) {
        const searchTerm = query.toLowerCase().trim();
        
        if (!searchTerm) {
            // Only show all tasks if no filters are active
            if (!this.activeFilters.person && !this.activeFilters.client && !this.activeFilters.status) {
                $('.pm-project-group, .pm-task-row').show().css('display', '');
            }
            return;
        }

        $('.pm-task-row:not(.pm-add-task-row)').each(function() {
            const $row = $(this);
            const taskName = $row.find('.pm-task-name').text().toLowerCase();
            const client = $row.find('.pm-cell-client .client-display').text().toLowerCase();
            
            if (taskName.includes(searchTerm) || client.includes(searchTerm)) {
                $row.show().css('display', '');
                $row.closest('.pm-project-group').show();
            } else {
                $row.hide().css('display', 'none');
            }
        });

        // Update project visibility
        this.updateProjectVisibility();
    }

    // Person Filter Methods
    async loadAllPeople() {
        const $personList = $('.pm-person-list');
        
        try {
            // Get all people from tasks - use real data from avatars
            const people = new Map();
            
            // Find all avatars on the page, including hidden ones
            $('.pm-avatar, .pm-cell[data-field-type="person_selector"] .pm-avatar').each((index, avatar) => {
                try {
                    const $avatar = $(avatar);
                    const fullName = $avatar.attr('title');
                    const email = $avatar.attr('data-email'); // Use real email from data attribute
                    const initials = $avatar.text();
                    
                    if (fullName && fullName !== '-' && fullName.trim() !== '' && email && email.trim() !== '') {
                        if (!people.has(email)) {
                            people.set(email, {
                                email: email,
                                name: fullName,
                                initials: initials
                            });
                        }
                    }
                } catch (e) {
                    // Silently skip invalid avatars
                }
            });
            
            // Convert to array and sort
            const peopleArray = Array.from(people.values()).sort((a, b) => a.name.localeCompare(b.name));
            
            // Generate HTML
            let html = '';
            if (peopleArray.length === 0) {
                html = '<div class="pm-person-option"><span>No people found</span></div>';
            } else {
                peopleArray.forEach(person => {
                    html += `
                        <div class="pm-person-option" data-person-email="${person.email}" data-person-name="${person.name}">
                            <div class="pm-person-avatar" style="background-color: ${this.utils.getPersonColor(person.email)}">
                                ${person.initials}
                            </div>
                            <span>${person.name}</span>
                        </div>
                    `;
                });
            }
            
            $personList.html(html);
            
        } catch (error) {
            console.error('Load people error:', error);
            $personList.html('<div class="pm-person-option"><span>Failed to load people</span></div>');
        }
    }

    selectPersonFilter(optionElement) {
        const $option = $(optionElement);  // Ensure it's a jQuery object
        const $btn = $('.pm-person-filter-btn');
        const personEmail = $option.data('person-email');
        const personName = $option.data('person-name');
        
        if ($option.hasClass('pm-clear-filter')) {
            // Clear filter
            this.clearPersonFilter();
        } else {
            // Apply filter
            this.applyPersonFilter(personEmail, personName);
            
            // Update button state
            $btn.addClass('has-filter');
            $btn.find('.pm-person-count').text('1').show();
            
            // Mark option as selected
            $('.pm-person-option').removeClass('selected');
            $option.addClass('selected');
        }
    }

    async applyPersonFilter(personEmail, personName) {
        // Record active filter
        this.activeFilters.person = { email: personEmail, name: personName };
        this.activeFilters.client = null;
        this.activeFilters.status = null;
        
        let visibleTasks = 0;
        
        // 移除loading通知 - 专业应用不需要为每个filter操作显示通知
        // 用户可以通过filter按钮状态和表格变化看到结果
        
        const $taskRows = $('.pm-task-row');
        const promises = [];
        
        $taskRows.each((index, row) => {
            const $row = $(row);
            
            // Skip add task rows
            if ($row.hasClass('pm-add-task-row')) {
                return;
            }
            
            // Create promise for each task check
            const promise = this.isPersonInvolvedInTask($row, personEmail, personName).then(isInvolved => {
                if (isInvolved) {
                    $row.show().css('display', '').addClass('filter-visible');
                    return 1; // Count this task
                } else {
                    $row.hide().css('display', 'none !important').removeClass('filter-visible');
                    return 0;
                }
            });
            
            promises.push(promise);
        });
        
        // Wait for all checks to complete
        const results = await Promise.all(promises);
        visibleTasks = results.reduce((sum, count) => sum + count, 0);
        
        // Mark body as filtering active
        $('body').addClass('filtering-active');
        
        // Update projects visibility
        this.updateProjectVisibility();
        
        // 使用静默方式更新filter状态，避免过度通知
        console.log(`✅ Person filter applied: ${personName} - ${visibleTasks} tasks shown`);
        
        // 更新filter按钮状态显示当前过滤信息
        $('.pm-person-filter-dropdown .pm-dropdown-text').text(`Person ${visibleTasks > 0 ? visibleTasks : ''}`).trim();
    }

    async isPersonInvolvedInTask($row, personEmail, personName) {
        try {
            const taskId = $row.data('task-id');
            if (!taskId) return false;
            
            // First check visible avatars (faster)
            const peopleCells = [
                '.pm-cell-action-person',
                '.pm-cell-preparer', 
                '.pm-cell-reviewer',
                '.pm-cell-partner'
            ];
            
            for (let cellSelector of peopleCells) {
                const $cell = $row.find(cellSelector);
                
                // Check avatar titles and emails
                const $avatars = $cell.find('.pm-avatar');
                for (let i = 0; i < $avatars.length; i++) {
                    const $avatar = $($avatars[i]);
                    const title = $avatar.attr('title');
                    const email = $avatar.attr('data-email');
                    
                    // Check by both name and email (more flexible matching)
                    if (email && email.toLowerCase() === personEmail.toLowerCase()) {
                        return true; // Email match is most reliable
                    }
                    
                    if (title && personName) {
                        // Also check if the person name is contained in the title (for partial matches)
                        if (title.toLowerCase() === personName.toLowerCase() ||
                            title.toLowerCase().includes(personName.toLowerCase()) ||
                            personName.toLowerCase().includes(title.toLowerCase())) {
                            return true;
                        }
                    }
                }
                
                // If there's a "+N" indicator, check backend data for hidden people
                const $moreIndicator = $cell.find('.pm-avatar-more');
                if ($moreIndicator.length > 0) {
                    // Get role filter from cell
                    const roleFilter = $cell.data('role-filter');
                    
                    try {
                        const response = await frappe.call({
                            method: 'smart_accounting.www.project_management.index.get_task_role_assignments',
                            args: { 
                                task_id: taskId,
                                role_filter: roleFilter 
                            }
                        });
                        
                        if (response.message && response.message.success) {
                            const assignments = response.message.role_assignments;
                            
                            // Check if person is in the assignments
                            for (let assignment of assignments) {
                                if ((assignment.email && assignment.email.toLowerCase() === personEmail.toLowerCase()) ||
                                    (assignment.full_name && assignment.full_name.toLowerCase() === personName.toLowerCase()) ||
                                    (assignment.user && assignment.user.toLowerCase() === personEmail.toLowerCase())) {
                                    return true;
                                }
                            }
                        }
                    } catch (error) {
                        console.warn('Could not check backend assignments for task', taskId, error);
                    }
                }
            }
            
            return false;
        } catch (error) {
            return false;
        }
    }

    clearPersonFilter() {
        // Clear active filter
        this.activeFilters.person = null;
        
        // Remove filtering active state
        $('body').removeClass('filtering-active');
        $('.pm-task-row').removeClass('filter-visible');
        
        const $btn = $('.pm-person-filter-btn');
        
        // Show all tasks with explicit display style
        $('.pm-task-row').show().css('display', '');
        $('.pm-project-group').show().css('display', '');
        
        // Reset button state
        $btn.removeClass('has-filter');
        $btn.find('.pm-person-count').hide();
        
        // Clear selection
        $('.pm-person-option').removeClass('selected');
        
        frappe.show_alert({
            message: 'Person filter cleared',
            indicator: 'green'
        });
    }

    searchPeople(query) {
        const $personList = $('.pm-person-list');
        
        if (!query || query.length < 2) {
            $personList.find('.pm-person-option').show();
            return;
        }
        
        // Filter people list
        $personList.find('.pm-person-option').each((index, option) => {
            const $option = $(option);
            const personName = $option.data('person-name') || '';
            
            if (personName.toLowerCase().includes(query.toLowerCase())) {
                $option.show();
            } else {
                $option.hide();
            }
        });
    }

    // Client Filter Methods
    loadAllClients() {
        const $clientList = $('.pm-client-list');
        
        try {
            // Get all unique clients from tasks
            const clients = new Set();
            
            $('.pm-task-row:not(.pm-add-task-row)').each((index, row) => {
                const $row = $(row);
                const clientName = $row.find('.pm-cell-client .client-display').text().trim();
                
                if (clientName && clientName !== 'No Client' && clientName !== '-') {
                    clients.add(clientName);
                }
            });
            
            // Convert to sorted array
            const clientArray = Array.from(clients).sort();
            
            // Generate HTML
            let html = '';
            clientArray.forEach(client => {
                html += `
                    <div class="pm-filter-option" data-client-name="${client}">
                        <div class="pm-filter-icon">
                            <i class="fa fa-building"></i>
                        </div>
                        <span>${client}</span>
                    </div>
                `;
            });
            
            $clientList.html(html);
            
        } catch (error) {
            console.error('Load clients error:', error);
            $clientList.html('<div class="pm-filter-option"><span>Failed to load clients</span></div>');
        }
    }

    selectClientFilter(optionElement) {
        const $option = $(optionElement);
        const $btn = $('.pm-client-filter-btn');
        const clientName = $option.data('client-name');
        
        if ($option.hasClass('pm-clear-client-filter')) {
            // Clear filter
            this.clearClientFilter();
        } else {
            // Apply filter
            this.applyClientFilter(clientName);
            
            // Update button state
            $btn.addClass('has-filter');
            $btn.find('span:first').text(clientName);
            
            // Mark option as selected
            $('.pm-client-filter-menu .pm-filter-option').removeClass('selected');
            $option.addClass('selected');
        }
    }

    applyClientFilter(clientName) {
        let visibleTasks = 0;
        
        $('.pm-task-row:not(.pm-add-task-row)').each((index, row) => {
            const $row = $(row);
            const rowClientName = $row.find('.pm-cell-client .client-display').text().trim();
            
            if (rowClientName === clientName) {
                $row.show().css('display', '');
                visibleTasks++;
            } else {
                $row.hide().css('display', 'none');
            }
        });
        
        // Update projects visibility
        this.updateProjectVisibility();
        
        // 静默更新client filter状态
        console.log(`✅ Client filter applied: ${clientName} - ${visibleTasks} tasks shown`);
        $('.pm-client-filter-dropdown .pm-dropdown-text').text(`${clientName}`).trim();
    }

    clearClientFilter() {
        const $btn = $('.pm-client-filter-btn');
        
        // Show all tasks with explicit display style
        $('.pm-task-row').show().css('display', '');
        $('.pm-project-group').show().css('display', '');
        
        // Reset button state
        $btn.removeClass('has-filter');
        $btn.find('span:first').text('All Clients');
        
        // Clear selection
        $('.pm-client-filter-menu .pm-filter-option').removeClass('selected');
        
        frappe.show_alert({
            message: 'Client filter cleared',
            indicator: 'green'
        });
    }

    searchClients(query) {
        const $clientList = $('.pm-client-list');
        
        if (!query || query.length < 2) {
            $clientList.find('.pm-filter-option').show();
            return;
        }
        
        // Filter client list
        $clientList.find('.pm-filter-option').each((index, option) => {
            const $option = $(option);
            const clientName = $option.data('client-name') || '';
            
            if (clientName.toLowerCase().includes(query.toLowerCase())) {
                $option.show();
            } else {
                $option.hide();
            }
        });
    }

    // Status Filter Methods
    selectStatusFilter(optionElement) {
        const $option = $(optionElement);
        const $btn = $('.pm-status-filter-btn');
        const status = $option.data('status');
        
        if ($option.hasClass('pm-clear-status-filter')) {
            // Clear filter
            this.clearStatusFilter();
        } else {
            // Apply filter
            this.applyStatusFilter(status);
            
            // Update button state
            $btn.addClass('has-filter');
            $btn.find('span:first').text(status);
            
            // Mark option as selected
            $('.pm-status-filter-menu .pm-filter-option').removeClass('selected');
            $option.addClass('selected');
        }
    }

    applyStatusFilter(status) {
        let visibleTasks = 0;
        
        $('.pm-task-row:not(.pm-add-task-row)').each((index, row) => {
            const $row = $(row);
            const rowStatus = $row.find('.pm-status-badge').text().trim();
            
            if (rowStatus.toLowerCase() === status.toLowerCase()) {
                $row.show().css('display', '');
                visibleTasks++;
            } else {
                $row.hide().css('display', 'none');
            }
        });
        
        // Update projects visibility
        this.updateProjectVisibility();
        
        // 静默更新status filter状态  
        console.log(`✅ Status filter applied: ${status} - ${visibleTasks} tasks shown`);
        $('.pm-status-filter-dropdown .pm-dropdown-text').text(`${status}`).trim();
    }

    clearStatusFilter() {
        const $btn = $('.pm-status-filter-btn');
        
        // Show all tasks with explicit display style
        $('.pm-task-row').show().css('display', '');
        $('.pm-project-group').show().css('display', '');
        
        // Reset button state
        $btn.removeClass('has-filter');
        $btn.find('span:first').text('All Status');
        
        // Clear selection
        $('.pm-status-filter-menu .pm-filter-option').removeClass('selected');
        
        frappe.show_alert({
            message: 'Status filter cleared',
            indicator: 'green'
        });
    }

    updateProjectVisibility() {
        // Hide projects that have no visible tasks
        $('.pm-project-group').each((index, group) => {
            const $group = $(group);
            const visibleTasks = $group.find('.pm-task-row:visible:not(.pm-add-task-row)').length;
            
            if (visibleTasks > 0) {
                $group.show();
            } else {
                $group.hide();
            }
        });
    }

    reapplyActiveFilters() {
        // If no active filters, show all tasks
        if (!this.activeFilters.person && !this.activeFilters.client && !this.activeFilters.status) {
            $('.pm-task-row').show().css('display', '');
            $('.pm-project-group').show().css('display', '');
            return;
        }

        // Reapply active filters (can have multiple active)
        if (this.activeFilters.person) {
            this.applyPersonFilter(this.activeFilters.person.email, this.activeFilters.person.name);
        }
        if (this.activeFilters.client) {
            this.applyClientFilter(this.activeFilters.client);
        }
        if (this.activeFilters.status) {
            this.applyStatusFilter(this.activeFilters.status);
        }
    }

    // Advanced Filter Functionality
    initializeAdvancedFilter() {
        this.advancedFilters = [];
        this.updateTaskCount();
    }

    updateValueOptions($columnSelect) {
        const column = $columnSelect.val();
        const $valueSelect = $columnSelect.closest('.pm-filter-condition').find('.pm-filter-value');
        const currentCondition = $columnSelect.closest('.pm-filter-condition');
        const conditionIndex = $('.pm-filter-condition').index(currentCondition);
        
        // Clear existing options
        $valueSelect.empty().append('<option value="">Value</option>');
        
        if (!column) return;
        
        // Get filtered rows based on previous conditions (cascade filtering)
        const $filteredRows = this.getFilteredRowsUpToIndex(conditionIndex);
        console.log(`🔗 Cascade filtering: Using ${$filteredRows.length} rows for condition ${conditionIndex + 1}`);
        
        // Get unique values for selected column from filtered rows only
        const values = new Set();
        $filteredRows.each((i, row) => {
            const $row = $(row);
            let value = '';
            
            switch (column) {
                case 'client_name':
                    value = $row.find('.pm-cell-client .client-display').text().trim();
                    break;
                case 'task_name':
                    value = $row.find('.pm-cell-task-name .task-name-display').text().trim();
                    break;
                case 'entity':
                    value = $row.find('.pm-cell-entity .pm-entity-badge').text().trim();
                    break;
                case 'tf_tg':
                    value = $row.find('.pm-cell-tf-tg .pm-tf-tg-badge').text().trim();
                    break;
                case 'software':
                    value = $row.find('.pm-cell-software .pm-primary-software').text().trim();
                    if (!value) {
                        // Try to get software from tags
                        const softwareTags = $row.find('.pm-cell-software .pm-software-badge').map(function() {
                            return $(this).text().trim();
                        }).get();
                        value = softwareTags.join(', ');
                    }
                    break;
                case 'status':
                    value = $row.find('.pm-cell-status .pm-status-badge').text().trim();
                    break;
                case 'target_month':
                    value = $row.find('.pm-cell-target-month .editable-field').text().trim();
                    break;
                case 'budget':
                    value = $row.find('.pm-cell-budget .editable-field').text().trim();
                    break;
                case 'actual':
                    value = $row.find('.pm-cell-actual .editable-field').text().trim();
                    break;
                case 'note':
                    value = $row.find('.pm-cell-note .editable-field').text().trim();
                    break;
                case 'review_note':
                    value = $row.find('.pm-cell-review-note .pm-review-note-indicator').text().trim();
                    break;
                case 'action_person':
                    value = $row.find('.pm-cell-action-person .pm-avatar').attr('title') || '';
                    break;
                case 'preparer':
                    value = $row.find('.pm-cell-preparer .pm-avatar').attr('title') || '';
                    break;
                case 'reviewer':
                    value = $row.find('.pm-cell-reviewer .pm-avatar').attr('title') || '';
                    break;
                case 'partner':
                    value = $row.find('.pm-cell-partner .pm-avatar').attr('title') || '';
                    break;
                case 'lodgment_due':
                    value = $row.find('.pm-cell-lodgment-due .editable-field').text().trim();
                    break;
                case 'engagement':
                    value = $row.find('.pm-cell-engagement .pm-engagement-display').text().trim();
                    break;
                case 'group':
                    value = $row.find('.pm-cell-group .pm-group-display').text().trim();
                    break;
                case 'year_end':
                    value = $row.find('.pm-cell-year-end .editable-field').text().trim();
                    break;
                case 'priority':
                    value = $row.find('.pm-cell-priority .pm-priority-badge').text().trim();
                    break;
                case 'frequency':
                    value = $row.find('.pm-cell-frequency .editable-field').text().trim();
                    break;
                case 'reset_date':
                    value = $row.find('.pm-cell-reset-date .editable-field').text().trim();
                    break;
                case 'last_updated':
                    value = $row.find('.pm-cell-last-updated .pm-last-updated').text().trim();
                    break;
            }
            
            if (value && value !== '-' && value !== 'No Client') {
                values.add(value);
            }
        });
        
        // Add options to select with smart sorting
        const sortedValues = this.smartSortValues(Array.from(values), column);
        sortedValues.forEach(value => {
            $valueSelect.append(`<option value="${value}">${value}</option>`);
        });
    }

    applyAdvancedFilters() {
        const filters = [];
        
        // Collect all filter conditions
        $('.pm-filter-condition').each((i, condition) => {
            const $condition = $(condition);
            const column = $condition.find('.pm-filter-column').val();
            const conditionType = $condition.find('.pm-filter-condition-type').val();
            const value = $condition.find('.pm-filter-value').val();
            
            // Enhanced validation for edge cases
            if (column && conditionType) {
                // For empty/not empty conditions, value is not required
                if (conditionType === 'is_empty' || conditionType === 'is_not_empty') {
                    filters.push({ column, condition: conditionType, value: null });
                }
                // For other conditions, value is required
                else if (value && value.trim() !== '') {
                    filters.push({ column, condition: conditionType, value: value.trim() });
                }
                // Skip incomplete conditions but don't log them as errors (too noisy)
            }
        });
        
        // Store previous filter state for comparison
        const previousFilterCount = this.activeFilters ? this.activeFilters.length : 0;
        this.activeFilters = filters;
        
        // Apply filters with enhanced logging for debugging
        console.log(`🔍 Applying ${filters.length} filter(s):`, filters);
        this.filterTasks();
        this.updateTaskCount();
        
        // Enhanced edge case handling
        const visibleTasks = $('.pm-task-row:not(.pm-add-task-row):visible').length;
        const totalTasks = $('.pm-task-row:not(.pm-add-task-row)').length;
        
        if (filters.length === 0 && previousFilterCount > 0) {
            console.log('✅ All filters cleared - showing all tasks');
            // Force show all tasks and project groups
            $('.pm-task-row').show();
            $('.pm-project-group').show();
        } else if (filters.length > 0) {
            if (visibleTasks === 0) {
                console.log('⚠️ No tasks match current filter criteria');
                // Show a subtle indication that no results were found
                if (typeof this.showNoResultsIndicator === 'function') {
                    this.showNoResultsIndicator();
                }
            } else {
                console.log(`✅ ${visibleTasks} task(s) match current filters`);
                if (typeof this.hideNoResultsIndicator === 'function') {
                    this.hideNoResultsIndicator();
                }
            }
        }
        
        // Force update project visibility in edge cases
        setTimeout(() => {
            this.updateProjectVisibility();
        }, 50);
    }

    filterTasks() {
        // If no active filters, show all tasks
        if (!this.activeFilters || this.activeFilters.length === 0) {
            $('.pm-task-row').show();
            $('.pm-project-group').show();
            this.updateProjectVisibility();
            return;
        }

        $('.pm-task-row').each((i, row) => {
            const $row = $(row);
            let shouldShow = true;
            
            // Apply each filter
            this.activeFilters.forEach(filter => {
                const cellValue = this.getCellValue($row, filter.column);
                
                switch (filter.condition) {
                    case 'is':
                    case 'equals':
                        if (cellValue !== filter.value) shouldShow = false;
                        break;
                    case 'is_not':
                    case 'not_equals':
                        if (cellValue === filter.value) shouldShow = false;
                        break;
                    case 'contains':
                        if (!cellValue.toLowerCase().includes(filter.value.toLowerCase())) shouldShow = false;
                        break;
                    case 'not_contains':
                        if (cellValue.toLowerCase().includes(filter.value.toLowerCase())) shouldShow = false;
                        break;
                    case 'is_empty':
                        if (cellValue && cellValue !== '-' && cellValue.trim() !== '') shouldShow = false;
                        break;
                    case 'is_not_empty':
                        if (!cellValue || cellValue === '-' || cellValue.trim() === '') shouldShow = false;
                        break;
                }
            });
            
            if (shouldShow) {
                $row.show();
            } else {
                $row.hide();
            }
        });
        
        // Hide/show project groups based on visible tasks
        this.updateProjectVisibility();
    }

    getCellValue($row, column) {
        switch (column) {
            case 'client_name':
                return $row.find('.pm-cell-client .client-display').text().trim();
            case 'entity':
                return $row.find('.pm-cell-entity .pm-entity-badge').text().trim();
            case 'tf_tg':
                return $row.find('.pm-cell-tf-tg .pm-tf-tg-badge').text().trim();
            case 'software':
                return $row.find('.pm-cell-software .pm-primary-software').text().trim();
            case 'status':
                return $row.find('.pm-cell-status .pm-status-badge').text().trim();
            case 'target_month':
                return $row.find('.pm-cell-target-month .editable-field').text().trim();
            default:
                return '';
        }
    }

    addNewFilterCondition() {
        const conditionIndex = $('.pm-filter-condition').length;
        const newCondition = `
            <div class="pm-filter-condition" data-index="${conditionIndex}">
                <div class="pm-filter-where">And</div>
                <select class="pm-filter-column">
                    <option value="">Column</option>
                    <!-- Options will be populated by FilterManager -->
                </select>
                <select class="pm-filter-condition-type">
                    <option value="is" selected>is</option>
                    <option value="is_not">is not</option>
                    <option value="equals">equals</option>
                    <option value="not_equals">doesn't equal</option>
                    <option value="contains">contains</option>
                    <option value="not_contains">doesn't contain</option>
                    <option value="is_empty">is empty</option>
                    <option value="is_not_empty">is not empty</option>
                </select>
                <select class="pm-filter-value">
                    <option value="">Value</option>
                </select>
                <button class="pm-filter-remove">
                    <i class="fa fa-times"></i>
                </button>
            </div>
        `;
        
        $('.pm-filter-conditions').append(newCondition);
        this.updateRemoveButtons();
        
        // Update column options for the new condition
        if (window.FilterManager && window.FilterManager.updateFilterColumnOptions) {
            window.FilterManager.updateFilterColumnOptions();
        }
        
        // Apply existing filters to maintain current filter state
        this.applyAdvancedFilters();
    }

    updateRemoveButtons() {
        const $conditions = $('.pm-filter-condition');
        
        if ($conditions.length > 1) {
            $conditions.find('.pm-filter-remove').show();
        } else {
            $conditions.find('.pm-filter-remove').hide();
        }
    }

    clearAllFilters() {
        $('.pm-filter-conditions').html(`
            <div class="pm-filter-condition">
                <div class="pm-filter-where">Where</div>
                <select class="pm-filter-column">
                    <option value="">Column</option>
                    <!-- Options will be populated by FilterManager -->
                </select>
                <select class="pm-filter-condition-type">
                    <option value="is" selected>is</option>
                    <option value="is_not">is not</option>
                    <option value="equals">equals</option>
                    <option value="not_equals">doesn't equal</option>
                    <option value="contains">contains</option>
                    <option value="not_contains">doesn't contain</option>
                    <option value="is_empty">is empty</option>
                    <option value="is_not_empty">is not empty</option>
                </select>
                <select class="pm-filter-value">
                    <option value="">Value</option>
                </select>
            </div>
        `);
        
        // Update column options for the cleared condition
        if (window.FilterManager && window.FilterManager.updateFilterColumnOptions) {
            window.FilterManager.updateFilterColumnOptions();
        }
        
        // Clear advanced filters and apply
        this.advancedFilters = [];
        this.applyAdvancedFilters();
        this.updateTaskCount();
    }

    updateTaskCount() {
        const totalTasks = $('.pm-task-row:not(.pm-add-task-row)').length;
        const visibleTasks = $('.pm-task-row:not(.pm-add-task-row):visible').length;
        
        $('#total-tasks').text(totalTasks);
        
        if (this.advancedFilters.length > 0) {
            $('.pm-filter-count').html(`Showing ${visibleTasks} of ${totalTasks} tasks`);
        } else {
            $('.pm-filter-count').html(`Showing all of ${totalTasks} tasks`);
        }
    }

    showNoResultsIndicator() {
        // Remove existing indicator
        $('.pm-no-results-indicator').remove();
        
        // Add no results message to the table
        const noResultsHtml = `
            <div class="pm-no-results-indicator">
                <div class="pm-no-results-content">
                    <i class="fa fa-search"></i>
                    <h4>No tasks match your filters</h4>
                    <p>Try adjusting your filter criteria or <button class="pm-btn pm-btn-link pm-clear-filters-inline">clear all filters</button></p>
                </div>
            </div>
        `;
        
        $('.pm-table-body').append(noResultsHtml);
        
        // Bind clear filters button
        $('.pm-clear-filters-inline').on('click', (e) => {
            e.preventDefault();
            this.clearAllFilters();
        });
    }

    hideNoResultsIndicator() {
        $('.pm-no-results-indicator').remove();
    }

    // Enhanced project visibility update with edge case handling
    updateProjectVisibility() {
        $('.pm-project-group').each((i, group) => {
            const $group = $(group);
            const visibleTasks = $group.find('.pm-task-row:visible').length;
            
            if (visibleTasks > 0) {
                $group.show();
            } else {
                $group.hide();
            }
        });
        
        // If no project groups are visible, ensure no results indicator is shown
        const visibleGroups = $('.pm-project-group:visible').length;
        if (visibleGroups === 0 && this.activeFilters && this.activeFilters.length > 0) {
            if (typeof this.showNoResultsIndicator === 'function') {
                this.showNoResultsIndicator();
            }
        } else {
            if (typeof this.hideNoResultsIndicator === 'function') {
                this.hideNoResultsIndicator();
            }
        }
    }

    /**
     * Smart sorting for different column types
     * @param {Array} values - Array of values to sort
     * @param {string} column - Column type for context-aware sorting
     * @returns {Array} Sorted values
     */
    smartSortValues(values, column) {
        if (!values || values.length === 0) return values;

        switch (column) {
            case 'target_month':
                // Sort months in chronological order
                const monthOrder = [
                    'January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'
                ];
                
                return values.sort((a, b) => {
                    const indexA = monthOrder.indexOf(a);
                    const indexB = monthOrder.indexOf(b);
                    
                    // If both are valid months, sort by month order
                    if (indexA !== -1 && indexB !== -1) {
                        return indexA - indexB;
                    }
                    // If only one is a valid month, put it first
                    if (indexA !== -1) return -1;
                    if (indexB !== -1) return 1;
                    // If neither is a valid month, sort alphabetically
                    return a.localeCompare(b);
                });

            case 'priority':
                // Sort priority in logical order
                const priorityOrder = ['Low', 'Medium', 'High', 'Urgent'];
                return values.sort((a, b) => {
                    const indexA = priorityOrder.indexOf(a);
                    const indexB = priorityOrder.indexOf(b);
                    
                    if (indexA !== -1 && indexB !== -1) {
                        return indexA - indexB;
                    }
                    if (indexA !== -1) return -1;
                    if (indexB !== -1) return 1;
                    return a.localeCompare(b);
                });

            case 'frequency':
                // Sort frequency in logical order
                const frequencyOrder = ['Daily', 'Weekly', 'Fortnightly', 'Monthly', 'Quarterly', 'Half Yearly', 'Annually', 'Ad-Hoc', 'Other'];
                return values.sort((a, b) => {
                    const indexA = frequencyOrder.indexOf(a);
                    const indexB = frequencyOrder.indexOf(b);
                    
                    if (indexA !== -1 && indexB !== -1) {
                        return indexA - indexB;
                    }
                    if (indexA !== -1) return -1;
                    if (indexB !== -1) return 1;
                    return a.localeCompare(b);
                });

            case 'status':
                // Sort status in logical workflow order
                const statusOrder = ['Not Started', 'Open', 'Working', 'Ready To Lodge', 'Completed', 'Done'];
                return values.sort((a, b) => {
                    const indexA = statusOrder.indexOf(a);
                    const indexB = statusOrder.indexOf(b);
                    
                    if (indexA !== -1 && indexB !== -1) {
                        return indexA - indexB;
                    }
                    if (indexA !== -1) return -1;
                    if (indexB !== -1) return 1;
                    return a.localeCompare(b);
                });

            case 'budget':
            case 'actual':
                // Sort numeric values
                return values.sort((a, b) => {
                    const numA = parseFloat(a.replace(/[^0-9.-]/g, '')) || 0;
                    const numB = parseFloat(b.replace(/[^0-9.-]/g, '')) || 0;
                    return numA - numB;
                });

            case 'lodgment_due':
            case 'reset_date':
            case 'last_updated':
                // Sort dates
                return values.sort((a, b) => {
                    const dateA = new Date(a);
                    const dateB = new Date(b);
                    if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
                        return a.localeCompare(b);
                    }
                    return dateA - dateB;
                });

            default:
                // Default alphabetical sorting
                return values.sort((a, b) => a.localeCompare(b));
        }
    }

    /**
     * Get filtered rows up to a specific condition index for cascade filtering
     * @param {number} upToIndex - Apply filters up to this index (exclusive)
     * @returns {jQuery} Filtered rows
     */
    getFilteredRowsUpToIndex(upToIndex) {
        if (upToIndex === 0) {
            // For the first condition, use all rows
            return $('.pm-task-row:not(.pm-add-task-row)');
        }

        // Apply filters from conditions 0 to upToIndex-1
        let $filteredRows = $('.pm-task-row:not(.pm-add-task-row)');
        
        for (let i = 0; i < upToIndex; i++) {
            const $condition = $(`.pm-filter-condition[data-index="${i}"], .pm-filter-condition:eq(${i})`);
            const column = $condition.find('.pm-filter-column').val();
            const conditionType = $condition.find('.pm-filter-condition-type').val();
            const value = $condition.find('.pm-filter-value').val();
            
            if (column && conditionType && (value || conditionType === 'is_empty' || conditionType === 'is_not_empty')) {
                $filteredRows = $filteredRows.filter((index, row) => {
                    const $row = $(row);
                    const cellValue = this.getCellValue($row, column);
                    
                    switch (conditionType) {
                        case 'is':
                        case 'equals':
                            return cellValue === value;
                        case 'is_not':
                        case 'not_equals':
                            return cellValue !== value;
                        case 'contains':
                            return cellValue.toLowerCase().includes(value.toLowerCase());
                        case 'not_contains':
                            return !cellValue.toLowerCase().includes(value.toLowerCase());
                        case 'is_empty':
                            return !cellValue || cellValue === '-' || cellValue.trim() === '';
                        case 'is_not_empty':
                            return cellValue && cellValue !== '-' && cellValue.trim() !== '';
                        default:
                            return true;
                    }
                });
            }
        }
        
        return $filteredRows;
    }
}

// Create global instance
window.ReportsManager = new ReportsManager();

// Export for module systems if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReportsManager;
}
