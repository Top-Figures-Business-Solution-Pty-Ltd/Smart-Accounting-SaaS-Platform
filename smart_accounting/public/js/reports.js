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
            // Get all people from tasks - simplified approach
            const people = new Map();
            
            // Find all avatars on the page, including hidden ones
            $('.pm-avatar, .pm-cell[data-field-type="person_selector"] .pm-avatar').each((index, avatar) => {
                try {
                    const $avatar = $(avatar);
                    const fullName = $avatar.attr('title');
                    const initials = $avatar.text();
                    
                    if (fullName && fullName !== '-' && fullName.trim() !== '') {
                        const email = fullName.includes('@') ? fullName : `${fullName.toLowerCase().replace(/\s+/g, '.')}@company.com`;
                        
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

    applyPersonFilter(personEmail, personName) {
        // Record active filter
        this.activeFilters.person = { email: personEmail, name: personName };
        this.activeFilters.client = null;
        this.activeFilters.status = null;
        
        let visibleTasks = 0;
        
        $('.pm-task-row').each((index, row) => {
            const $row = $(row);
            
            // Skip add task rows
            if ($row.hasClass('pm-add-task-row')) {
                return;
            }
            
            // Check if person is involved in this task
            const isInvolved = this.isPersonInvolvedInTask($row, personEmail, personName);
            const taskId = $row.data('task-id');
            
            if (isInvolved) {
                $row.show().css('display', '').addClass('filter-visible');
                visibleTasks++;
            } else {
                $row.hide().css('display', 'none !important').removeClass('filter-visible');
            }
        });
        
        // Mark body as filtering active
        $('body').addClass('filtering-active');
        
        // Update projects visibility
        this.updateProjectVisibility();
        
        frappe.show_alert({
            message: `Filtered by ${personName} - ${visibleTasks} tasks shown`,
            indicator: 'blue'
        });
    }

    isPersonInvolvedInTask($row, personEmail, personName) {
        try {
            // Check all people-related cells, including hidden ones
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
                    
                    // Check by both name and email (more precise matching)
                    if ((title && title.toLowerCase() === personName.toLowerCase()) ||
                        (email && email.toLowerCase() === personEmail.toLowerCase())) {
                        return true;
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
        
        frappe.show_alert({
            message: `Filtered by ${clientName} - ${visibleTasks} tasks shown`,
            indicator: 'blue'
        });
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
        
        frappe.show_alert({
            message: `Filtered by ${status} - ${visibleTasks} tasks shown`,
            indicator: 'blue'
        });
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
        
        // Clear existing options
        $valueSelect.empty().append('<option value="">Value</option>');
        
        if (!column) return;
        
        // Get unique values for selected column
        const values = new Set();
        $('.pm-task-row').each((i, row) => {
            const $row = $(row);
            let value = '';
            
            switch (column) {
                case 'client_name':
                    value = $row.find('.pm-cell-client .client-display').text().trim();
                    break;
                case 'entity':
                    value = $row.find('.pm-cell-entity .pm-entity-badge').text().trim();
                    break;
                case 'tf_tg':
                    value = $row.find('.pm-cell-tf-tg .pm-tf-tg-badge').text().trim();
                    break;
                case 'software':
                    value = $row.find('.pm-cell-software .pm-primary-software').text().trim();
                    break;
                case 'status':
                    value = $row.find('.pm-cell-status .pm-status-badge').text().trim();
                    break;
                case 'target_month':
                    value = $row.find('.pm-cell-target-month .editable-field').text().trim();
                    break;
            }
            
            if (value && value !== '-' && value !== 'No Client') {
                values.add(value);
            }
        });
        
        // Add options to select
        Array.from(values).sort().forEach(value => {
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
            
            if (column && conditionType && (value || conditionType === 'is_empty' || conditionType === 'is_not_empty')) {
                filters.push({ column, condition: conditionType, value });
            }
        });
        
        this.activeFilters = filters;
        this.filterTasks();
        this.updateTaskCount();
    }

    filterTasks() {
        $('.pm-task-row').each((i, row) => {
            const $row = $(row);
            let shouldShow = true;
            
            // Apply each filter
            this.activeFilters.forEach(filter => {
                const cellValue = this.getCellValue($row, filter.column);
                
                switch (filter.condition) {
                    case 'equals':
                        if (cellValue !== filter.value) shouldShow = false;
                        break;
                    case 'contains':
                        if (!cellValue.toLowerCase().includes(filter.value.toLowerCase())) shouldShow = false;
                        break;
                    case 'not_equals':
                        if (cellValue === filter.value) shouldShow = false;
                        break;
                    case 'is_empty':
                        if (cellValue && cellValue !== '-') shouldShow = false;
                        break;
                    case 'is_not_empty':
                        if (!cellValue || cellValue === '-') shouldShow = false;
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
                    <option value="client_name">Client Name</option>
                    <option value="entity">Entity</option>
                    <option value="tf_tg">TF/TG</option>
                    <option value="software">Software</option>
                    <option value="status">Status</option>
                    <option value="target_month">Target Month</option>
                    <option value="budget">Budget</option>
                    <option value="actual">Actual</option>
                </select>
                <select class="pm-filter-condition-type">
                    <option value="">Condition</option>
                    <option value="equals">equals</option>
                    <option value="not_equals">doesn't equal</option>
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
                    <option value="client_name">Client Name</option>
                    <option value="entity">Entity</option>
                    <option value="tf_tg">TF/TG</option>
                    <option value="software">Software</option>
                    <option value="status">Status</option>
                    <option value="target_month">Target Month</option>
                    <option value="budget">Budget</option>
                    <option value="actual">Actual</option>
                </select>
                <select class="pm-filter-condition-type">
                    <option value="">Condition</option>
                    <option value="equals">equals</option>
                    <option value="not_equals">doesn't equal</option>
                </select>
                <select class="pm-filter-value">
                    <option value="">Value</option>
                </select>
            </div>
        `);
        
        // Clear advanced filters (different from dropdown filters)
        this.advancedFilters = [];
        
        // Don't automatically show all tasks - respect dropdown filters
        this.reapplyActiveFilters();
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
}

// Create global instance
window.ReportsManager = new ReportsManager();

// Export for module systems if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReportsManager;
}
