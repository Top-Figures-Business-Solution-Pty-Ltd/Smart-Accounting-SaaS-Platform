// Project Management - Client Management System
// Comprehensive client management with CRUD operations

class ClientManagementSystem {
    constructor() {
        this.utils = window.PMUtils;
        this.currentClient = null;
        this.clients = [];
        this.filteredClients = [];
        this.searchQuery = '';
        this.currentPage = 1;
        this.itemsPerPage = 20;
        this.isLoading = false;
        this.isEditMode = false; // Track if detail panel is in edit mode
        
        // Debug mode
        this.debug = true;
        if (this.debug) {
            console.log('ClientManagementSystem initialized');
        }
    }
    
    debugLog(message, data = null) {
        if (this.debug) {
            console.log(`[ClientMgmt] ${message}`, data || '');
        }
    }

    // Generate Year End options HTML
    generateYearEndOptions(selectedValue = 'June') {
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        
        return months.map(month => 
            `<option value="${month}" ${month === selectedValue ? 'selected' : ''}>${month}</option>`
        ).join('');
    }

    // Main entry point - show client management dialog
    showClientManagementDialog() {
        const dialogHTML = this.generateDialogHTML();
        
        // Remove existing dialog
        $('.pm-client-management-dialog').remove();
        
        // Add to body
        $('body').append(dialogHTML);
        
        // Initialize components
        this.initializeDialog();
        this.loadClients();
        
        // Show dialog with animation
        const $dialog = $('.pm-client-management-dialog');
        $dialog.fadeIn(200);
    }

    generateDialogHTML() {
        return `
            <div class="pm-client-management-dialog">
                <div class="pm-dialog-overlay"></div>
                <div class="pm-client-management-container">
                    <!-- Header -->
                    <div class="pm-client-mgmt-header">
                        <div class="pm-header-left">
                            <h2><i class="fa fa-users"></i> Manage Clients</h2>
                            <span class="pm-client-count">Loading...</span>
                        </div>
                        <div class="pm-header-right">
                            <button class="pm-btn pm-btn-secondary pm-manage-groups-btn" title="Manage Client Groups">
                                <i class="fa fa-cog"></i> Manage Groups
                            </button>
                            <button class="pm-btn pm-btn-primary pm-new-client-btn">
                                <i class="fa fa-plus"></i> New Client
                            </button>
                            <button class="pm-btn pm-btn-secondary pm-close-dialog" title="Close dialog">
                                <i class="fa fa-times"></i>
                                <span>Close</span>
                            </button>
                        </div>
                    </div>

                    <!-- Main Content -->
                    <div class="pm-client-mgmt-content">
                        <!-- Left Panel - Client List -->
                        <div class="pm-client-list-panel">
                            <div class="pm-client-list-header">
                                <div class="pm-search-container">
                                    <i class="fa fa-search pm-search-icon"></i>
                                    <input type="text" class="pm-client-search" placeholder="Search clients..." autocomplete="off">
                                    <button class="pm-search-clear" style="display: none;" title="Clear search">
                                        <i class="fa fa-times"></i>
                                    </button>
                                </div>
                                <div class="pm-client-filters">
                                    <button class="pm-filter-btn active" data-filter="all">All</button>
                                    <button class="pm-filter-btn" data-filter="active">Active</button>
                                    <button class="pm-filter-btn" data-filter="inactive">Inactive</button>
                                </div>
                            </div>
                            
                            <div class="pm-client-list-container">
                                <div class="pm-client-list">
                                    <div class="pm-client-loading">
                                        <i class="fa fa-spinner fa-spin"></i>
                                        <span>Loading clients...</span>
                                    </div>
                                </div>
                                <div class="pm-client-list-footer">
                                    <div class="pm-pagination">
                                        <!-- Pagination will be generated dynamically -->
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Right Panel - Client Details -->
                        <div class="pm-client-detail-panel">
                            <div class="pm-client-detail-placeholder">
                                <div class="pm-placeholder-content">
                                    <i class="fa fa-user-o"></i>
                                    <h3>Select a client</h3>
                                    <p>Choose a client from the list to view and edit details</p>
                                </div>
                            </div>
                            
                            <div class="pm-client-detail-content" style="display: none;">
                                <!-- Client details form will be generated dynamically -->
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    initializeDialog() {
        const $dialog = $('.pm-client-management-dialog');
        
        // Close dialog events - multiple approaches
        $dialog.off('.close-events'); // Remove existing events
        
        // Direct close button binding
        $dialog.on('click.close-events', '.pm-close-dialog', (e) => {
            console.log('Main dialog close clicked!'); // Debug log
            e.preventDefault();
            e.stopImmediatePropagation();
            this.closeDialog();
            return false;
        });
        
        // Overlay click to close
        $dialog.on('click.close-events', '.pm-dialog-overlay', (e) => {
            if (e.target === e.currentTarget) {
                console.log('Main dialog overlay clicked!'); // Debug log
                this.closeDialog();
            }
        });
        
        // Direct DOM binding as failsafe
        setTimeout(() => {
            const closeBtn = document.querySelector('.pm-close-dialog');
            if (closeBtn) {
                closeBtn.addEventListener('click', (e) => {
                    console.log('Direct DOM main close clicked!'); // Debug log
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    this.closeDialog();
                }, true);
            }
        }, 100);

        // Search functionality
        $dialog.on('input', '.pm-client-search', (e) => {
            this.handleSearch(e.target.value);
        });

        // Clear search
        $dialog.on('click', '.pm-search-clear', () => {
            $('.pm-client-search').val('').trigger('input');
        });

        // Filter buttons
        $dialog.on('click', '.pm-filter-btn', (e) => {
            this.handleFilter($(e.currentTarget));
        });

        // Client selection
        $dialog.on('click', '.pm-client-item', (e) => {
            // Don't trigger if clicking on the edit button
            if (!$(e.target).closest('.pm-edit-client-btn').length) {
                this.selectClient($(e.currentTarget));
            }
        });

        // Edit client button
        $dialog.on('click', '.pm-edit-client-btn', (e) => {
            e.stopPropagation(); // Prevent row selection
            const clientId = $(e.currentTarget).data('client-id');
            this.editClientFromList(clientId);
        });

        // New client button
        $dialog.on('click', '.pm-new-client-btn', () => {
            this.showNewClientForm();
        });

        // Manage groups button
        $dialog.on('click', '.pm-manage-groups-btn', () => {
            this.showManageGroupsDialog();
        });

        // Prevent dialog content clicks from closing
        $dialog.on('click', '.pm-client-management-container', (e) => {
            e.stopPropagation();
        });

        // Keyboard shortcuts
        $(document).on('keydown.client-mgmt', (e) => {
            if (e.key === 'Escape') {
                this.closeDialog();
            }
        });
    }

    async loadClients() {
        this.isLoading = true;
        this.updateLoadingState(true);

        try {
            const response = await this.apiCall('get_all_clients', {});
            
            if (response && response.success) {
                this.clients = response.clients || [];
                this.filteredClients = [...this.clients];
                this.renderClientList();
                this.updateClientCount();
            } else {
                this.showError('Failed to load clients: ' + (response?.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Load clients error:', error);
            this.showError('Failed to load clients. Please try again.');
        } finally {
            this.isLoading = false;
            this.updateLoadingState(false);
        }
    }

    renderClientList() {
        const $container = $('.pm-client-list');
        
        if (this.filteredClients.length === 0) {
            $container.html(this.generateEmptyState());
            return;
        }

        // Calculate pagination
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageClients = this.filteredClients.slice(startIndex, endIndex);

        // Generate client items
        const clientsHTML = pageClients.map(client => this.generateClientItem(client)).join('');
        $container.html(clientsHTML);

        // Update pagination
        this.updatePagination();
    }

    generateClientItem(client) {
        const isActive = client.disabled !== 1;
        const projectCount = client.project_count || 0;
        const taskCount = client.task_count || 0;
        
        return `
            <div class="pm-client-item ${!isActive ? 'inactive' : ''}" data-client-id="${client.name}">
                <div class="pm-client-avatar">
                    <i class="fa fa-building"></i>
                </div>
                <div class="pm-client-info">
                    <div class="pm-client-name">${client.customer_name || client.name}</div>
                    <div class="pm-client-meta">
                        <span class="pm-client-group">${client.client_group || 'No Group'}</span>
                        ${!isActive ? '<span class="pm-inactive-badge">Inactive</span>' : ''}
                    </div>
                    <div class="pm-client-stats">
                        <span class="pm-stat">
                            <i class="fa fa-folder-o"></i> ${projectCount} projects
                        </span>
                        <span class="pm-stat">
                            <i class="fa fa-tasks"></i> ${taskCount} tasks
                        </span>
                    </div>
                </div>
                <div class="pm-client-actions">
                    <button class="pm-btn pm-btn-secondary pm-edit-client-btn" title="Edit client details" data-client-id="${client.name}">
                        <i class="fa fa-edit"></i>
                        <span>Edit</span>
                    </button>
                </div>
            </div>
        `;
    }

    generateEmptyState() {
        const hasSearch = this.searchQuery.trim().length > 0;
        
        if (hasSearch) {
            return `
                <div class="pm-empty-state">
                    <i class="fa fa-search"></i>
                    <h3>No clients found</h3>
                    <p>No clients match your search criteria</p>
                    <button class="pm-btn pm-btn-secondary pm-clear-search">Clear search</button>
                </div>
            `;
        }

        return `
            <div class="pm-empty-state">
                <i class="fa fa-users"></i>
                <h3>No clients yet</h3>
                <p>Create your first client to get started</p>
                <button class="pm-btn pm-btn-primary pm-create-first-client">
                    <i class="fa fa-plus"></i> Create Client
                </button>
            </div>
        `;
    }

    handleSearch(query) {
        this.searchQuery = query;
        
        // Show/hide clear button
        const $clearBtn = $('.pm-search-clear');
        if (query.trim()) {
            $clearBtn.show();
        } else {
            $clearBtn.hide();
        }

        // Filter clients
        this.filterClients();
    }

    handleFilter($button) {
        // Update active filter button
        $('.pm-filter-btn').removeClass('active');
        $button.addClass('active');
        
        // Filter clients
        this.filterClients();
    }

    filterClients() {
        const activeFilter = $('.pm-filter-btn.active').data('filter');
        const query = this.searchQuery.toLowerCase().trim();

        this.filteredClients = this.clients.filter(client => {
            // Text search
            if (query) {
                const searchText = `${client.customer_name || client.name} ${client.client_group || ''}`.toLowerCase();
                if (!searchText.includes(query)) {
                    return false;
                }
            }

            // Status filter
            if (activeFilter === 'active' && client.disabled === 1) return false;
            if (activeFilter === 'inactive' && client.disabled !== 1) return false;

            return true;
        });

        // Reset to first page
        this.currentPage = 1;
        
        // Re-render
        this.renderClientList();
        this.updateClientCount();
    }

    selectClient($clientItem) {
        const clientId = $clientItem.data('client-id');
        
        // Update selection state
        $('.pm-client-item').removeClass('selected');
        $clientItem.addClass('selected');
        
        // Reset edit mode when selecting a client
        this.isEditMode = false;
        
        // Load client details
        this.loadClientDetails(clientId);
    }

    async loadClientDetails(clientId) {
        try {
            $('.pm-client-detail-placeholder').hide();
            $('.pm-client-detail-content').show().html(`
                <div class="pm-detail-loading">
                    <i class="fa fa-spinner fa-spin"></i>
                    <span>Loading client details...</span>
                </div>
            `);

            const response = await this.apiCall('get_client_details', { client_id: clientId });
            
            if (response && response.success) {
                this.currentClient = response.client;
                this.renderClientDetails(response.client);
            } else {
                this.showDetailError('Failed to load client details');
            }
        } catch (error) {
            console.error('Load client details error:', error);
            this.showDetailError('Failed to load client details');
        }
    }

    renderClientDetails(client) {
        const detailHTML = `
            <div class="pm-client-detail-header">
                <div class="pm-client-title">
                    <div class="pm-client-avatar-large">
                        <i class="fa fa-building"></i>
                    </div>
                    <div class="pm-client-title-info">
                        <h3>${client.customer_name || client.name}</h3>
                        <span class="pm-client-id">ID: ${client.name}</span>
                        ${client.disabled === 1 ? '<span class="pm-status-badge inactive">Inactive</span>' : '<span class="pm-status-badge active">Active</span>'}
                    </div>
                </div>
                <div class="pm-client-actions">
                    <button class="pm-btn pm-btn-secondary pm-edit-client">
                        <i class="fa fa-edit"></i> Edit
                    </button>
                    <button class="pm-btn pm-btn-danger pm-delete-client">
                        <i class="fa fa-trash"></i> Delete
                    </button>
                </div>
            </div>

            <div class="pm-client-detail-body">
                <div class="pm-detail-section">
                    <h4>Basic Information</h4>
                    <div class="pm-detail-grid">
                        <div class="pm-detail-item">
                            <label>Client Name</label>
                            <span>${client.customer_name || client.name}</span>
                        </div>
                        <div class="pm-detail-item">
                            <label>Client Group</label>
                            <span>${client.client_group || 'No Group'}</span>
                        </div>
                        <div class="pm-detail-item">
                            <label>Year End</label>
                            <span>${client.custom_year_end || client.year_end || 'June'}</span>
                        </div>
                        <div class="pm-detail-item">
                            <label>Customer Type</label>
                            <span>${client.customer_type || '-'}</span>
                        </div>
                    </div>
                </div>

                <div class="pm-detail-section">
                    <h4>Contact Information</h4>
                    <div class="pm-detail-grid">
                        <div class="pm-detail-item">
                            <label>Primary Contact</label>
                            <span>${client.customer_primary_contact || '-'}</span>
                        </div>
                        <div class="pm-detail-item">
                            <label>Primary Address</label>
                            <span>${client.customer_primary_address || '-'}</span>
                        </div>
                        <div class="pm-detail-item">
                            <label>Website</label>
                            <span>${client.website ? `<a href="${client.website}" target="_blank">${client.website}</a>` : '-'}</span>
                        </div>
                    </div>
                </div>

                <div class="pm-detail-section">
                    <h4>Project Statistics</h4>
                    <div class="pm-stats-grid">
                        <div class="pm-stat-card">
                            <div class="pm-stat-number">${client.project_count || 0}</div>
                            <div class="pm-stat-label">Total Projects</div>
                        </div>
                        <div class="pm-stat-card">
                            <div class="pm-stat-number">${client.task_count || 0}</div>
                            <div class="pm-stat-label">Total Tasks</div>
                        </div>
                        <div class="pm-stat-card">
                            <div class="pm-stat-number">${client.active_tasks || 0}</div>
                            <div class="pm-stat-label">Active Tasks</div>
                        </div>
                    </div>
                </div>

                ${client.recent_projects && client.recent_projects.length > 0 ? `
                <div class="pm-detail-section">
                    <h4>Recent Projects</h4>
                    <div class="pm-recent-projects">
                        ${client.recent_projects.map(project => `
                            <div class="pm-project-item">
                                <div class="pm-project-info">
                                    <span class="pm-project-name">${project.name}</span>
                                    <span class="pm-project-status">${project.status}</span>
                                </div>
                                <span class="pm-project-date">${project.creation || ''}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
            </div>
        `;

        $('.pm-client-detail-content').html(detailHTML);
        
        // Ensure we're in view mode
        this.isEditMode = false;
        
        // Bind detail events
        this.bindDetailEvents();
    }

    bindDetailEvents() {
        // Clear existing events to prevent duplicate bindings
        $('.pm-edit-client').off('click.detail-events');
        $('.pm-delete-client').off('click.detail-events');
        
        // Bind new events with namespace
        $('.pm-edit-client').on('click.detail-events', (e) => {
            e.preventDefault();
            this.debugLog('Edit button clicked from detail view');
            this.switchToEditMode();
        });

        $('.pm-delete-client').on('click.detail-events', (e) => {
            e.preventDefault();
            this.confirmDeleteClient();
        });
    }

    showEditClientForm() {
        if (!this.currentClient) return;
        this.showClientForm(this.currentClient);
    }

    async editClientFromList(clientId) {
        try {
            // Load client details first if not already loaded
            if (!this.currentClient || this.currentClient.name !== clientId) {
                const response = await this.apiCall('get_client_details', { client_id: clientId });
                
                if (response && response.success) {
                    this.currentClient = response.client;
                    this.renderClientDetails(response.client);
                } else {
                    this.showError('Failed to load client details for editing');
                    return;
                }
            }
            
            // Switch to edit mode
            this.switchToEditMode();
        } catch (error) {
            console.error('Edit client from list error:', error);
            this.showError('Failed to load client details. Please try again.');
        }
    }

    showNewClientForm() {
        // Show new client form directly
        this.showClientForm();
    }

    switchToEditMode() {
        this.debugLog('switchToEditMode called', {
            hasCurrentClient: !!this.currentClient,
            isEditMode: this.isEditMode
        });
        
        if (!this.currentClient) {
            this.debugLog('No current client, cannot switch to edit mode');
            return;
        }
        
        if (this.isEditMode) {
            this.debugLog('Already in edit mode, skipping');
            return;
        }
        
        this.isEditMode = true;
        this.debugLog('Switching to edit mode');
        this.renderClientEditForm();
    }

    switchToViewMode() {
        this.debugLog('switchToViewMode called', {
            hasCurrentClient: !!this.currentClient,
            isEditMode: this.isEditMode
        });
        
        if (!this.currentClient) {
            this.debugLog('No current client, cannot switch to view mode');
            return;
        }
        
        if (!this.isEditMode) {
            this.debugLog('Not in edit mode, skipping');
            return;
        }
        
        this.isEditMode = false;
        this.debugLog('Switching to view mode');
        this.renderClientDetails(this.currentClient);
    }

    renderClientEditForm() {
        const client = this.currentClient;
        
        const editHTML = `
            <div class="pm-client-detail-header">
                <div class="pm-client-title">
                    <div class="pm-client-avatar-large">
                        <i class="fa fa-building"></i>
                    </div>
                    <div class="pm-client-title-info">
                        <h3>Edit Client</h3>
                        <span class="pm-client-id">ID: ${client.name}</span>
                        ${client.disabled === 1 ? '<span class="pm-status-badge inactive">Inactive</span>' : '<span class="pm-status-badge active">Active</span>'}
                    </div>
                </div>
                <div class="pm-client-actions">
                    <button class="pm-btn pm-btn-secondary pm-cancel-edit">
                        <i class="fa fa-times"></i> Cancel
                    </button>
                    <button class="pm-btn pm-btn-primary pm-save-edit">
                        <i class="fa fa-save"></i> Save Changes
                    </button>
                </div>
            </div>

            <div class="pm-client-detail-body">
                <form class="pm-inline-edit-form">
                    <div class="pm-detail-section">
                        <h4>Basic Information</h4>
                        <div class="pm-edit-grid">
                            <div class="pm-edit-item">
                                <label>Client Name <span class="required">*</span></label>
                                <input type="text" name="customer_name" value="${client.customer_name || client.name}" required>
                            </div>
                            <div class="pm-edit-item">
                                <label>Client Group</label>
                                <select name="client_group">
                                    <option value="">Select Group...</option>
                                    <!-- Will be populated by loadClientGroups -->
                                </select>
                            </div>
                            <div class="pm-edit-item">
                                <label>Year End</label>
                                <select name="custom_year_end">
                                    ${this.generateYearEndOptions(client.custom_year_end || client.year_end || 'June')}
                                </select>
                            </div>
                            <div class="pm-edit-item">
                                <label>Customer Type</label>
                                <select name="customer_type">
                                    <option value="Company" ${client.customer_type === 'Company' ? 'selected' : ''}>Company</option>
                                    <option value="Individual" ${client.customer_type === 'Individual' ? 'selected' : ''}>Individual</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div class="pm-detail-section">
                        <h4>Contact Information</h4>
                        <div class="pm-edit-grid">
                            <div class="pm-edit-item">
                                <label>Website</label>
                                <input type="url" name="website" value="${client.website || ''}" placeholder="https://example.com">
                            </div>
                            <div class="pm-edit-item">
                                <label>Status</label>
                                <select name="disabled">
                                    <option value="0" ${client.disabled !== 1 ? 'selected' : ''}>Active</option>
                                    <option value="1" ${client.disabled === 1 ? 'selected' : ''}>Inactive</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        `;

        $('.pm-client-detail-content').html(editHTML);
        
        // Load client groups for dropdown
        this.loadInlineClientGroups();
        
        // Bind edit form events
        this.bindInlineEditEvents();
    }

    bindInlineEditEvents() {
        // Clear existing events
        $('.pm-cancel-edit').off('click.inline-edit');
        $('.pm-save-edit').off('click.inline-edit');
        
        // Bind new events with namespace
        $('.pm-cancel-edit').on('click.inline-edit', (e) => {
            e.preventDefault();
            this.debugLog('Cancel edit clicked');
            this.switchToViewMode();
        });

        $('.pm-save-edit').on('click.inline-edit', (e) => {
            e.preventDefault();
            this.debugLog('Save edit clicked');
            this.saveInlineEdit();
        });
    }

    async loadInlineClientGroups() {
        try {
            const response = await this.apiCall('get_client_groups', {});
            
            if (response && response.success) {
                const groups = response.client_groups || [];
                const $select = $('select[name="client_group"]');
                
                groups.forEach(group => {
                    const displayName = group.group_name || group.name;
                    const isSelected = this.currentClient.client_group === group.name ? 'selected' : '';
                    $select.append(`<option value="${group.name}" ${isSelected}>${displayName}</option>`);
                });
            }
        } catch (error) {
            console.error('Load inline client groups error:', error);
        }
    }

    async saveInlineEdit() {
        const formData = this.getInlineFormData();
        
        if (!this.validateInlineForm(formData)) {
            return;
        }

        try {
            $('.pm-save-edit').prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i> Saving...');

            const response = await this.apiCall('update_client', {
                client_id: this.currentClient.name,
                ...formData
            });

            if (response && response.success) {
                this.showSuccess('Client updated successfully');
                
                // Reload client details
                const detailResponse = await this.apiCall('get_client_details', { 
                    client_id: this.currentClient.name 
                });
                
                if (detailResponse && detailResponse.success) {
                    this.currentClient = detailResponse.client;
                }
                
                // Refresh client list
                this.loadClients();
                
                // Switch back to view mode
                this.switchToViewMode();
            } else {
                this.showInlineError(response?.error || 'Failed to update client');
            }
        } catch (error) {
            console.error('Save inline edit error:', error);
            this.showInlineError('Failed to update client. Please try again.');
        } finally {
            $('.pm-save-edit').prop('disabled', false).html('<i class="fa fa-save"></i> Save Changes');
        }
    }

    getInlineFormData() {
        const form = $('.pm-inline-edit-form')[0];
        const formData = new FormData(form);
        const data = {};
        
        for (let [key, value] of formData.entries()) {
            data[key] = value;
        }
        
        return data;
    }

    validateInlineForm(data) {
        if (!data.customer_name?.trim()) {
            this.showInlineError('Client name is required');
            return false;
        }
        
        return true;
    }

    showInlineError(message) {
        // Remove existing error
        $('.pm-inline-error').remove();
        
        // Add error message
        $('.pm-inline-edit-form').prepend(`
            <div class="pm-inline-error">
                <i class="fa fa-exclamation-circle"></i>
                ${message}
            </div>
        `);
        
        setTimeout(() => {
            $('.pm-inline-error').fadeOut();
        }, 5000);
    }

    showManageGroupsDialog() {
        const groupsDialogHTML = `
            <div class="pm-groups-management-overlay">
                <div class="pm-groups-management-dialog">
                    <div class="pm-groups-header">
                        <h3><i class="fa fa-cog"></i> Manage Client Groups</h3>
                        <button class="pm-close-groups-dialog" title="Close">
                            <i class="fa fa-times"></i>
                        </button>
                    </div>
                    <div class="pm-groups-body">
                        <div class="pm-under-development">
                            <i class="fa fa-wrench" style="font-size: 48px; margin-bottom: 16px; color: var(--monday-blue);"></i>
                            <h3 style="margin: 0 0 8px 0; color: var(--monday-dark);">Under Development</h3>
                            <p style="color: var(--monday-gray); margin: 0;">Client Groups management feature is coming soon!</p>
                            <p style="color: var(--monday-gray); margin: 16px 0 0 0; font-size: 14px;">
                                This will allow you to create, edit, and organize client groups for better client management.
                            </p>
                        </div>
                    </div>
                    <div class="pm-groups-footer">
                        <button class="pm-btn pm-btn-secondary pm-close-groups">Close</button>
                    </div>
                </div>
            </div>
        `;

        $('body').append(groupsDialogHTML);

        // Bind events with multiple approaches
        $('.pm-groups-management-overlay').off(); // Clear existing events
        
        // Direct button binding
        $('.pm-close-groups-dialog, .pm-close-groups').off().on('click', function(e) {
            console.log('Groups dialog close clicked!'); // Debug log
            e.preventDefault();
            e.stopImmediatePropagation();
            $('.pm-groups-management-overlay').remove();
            return false;
        });

        // Overlay click to close
        $('.pm-groups-management-overlay').on('click', function(e) {
            if (e.target === this) {
                console.log('Groups overlay clicked!'); // Debug log
                $('.pm-groups-management-overlay').remove();
            }
        });

        // Prevent dialog clicks from closing
        $('.pm-groups-management-dialog').on('click', function(e) {
            e.stopPropagation();
        });
        
        // Direct DOM binding as failsafe
        setTimeout(() => {
            const closeBtns = document.querySelectorAll('.pm-close-groups-dialog, .pm-close-groups');
            closeBtns.forEach(btn => {
                btn.addEventListener('click', function(e) {
                    console.log('Direct DOM groups close clicked!'); // Debug log
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    const overlay = document.querySelector('.pm-groups-management-overlay');
                    if (overlay) {
                        overlay.remove();
                    }
                }, true);
            });
        }, 100);
    }

    showClientForm(client = null) {
        const isEdit = !!client;
        const title = isEdit ? 'Edit Client' : 'New Client';
        
        const formHTML = `
            <div class="pm-client-form-overlay">
                <div class="pm-client-form-dialog">
                    <div class="pm-form-header">
                        <h3>${title}</h3>
                        <button class="pm-close-form"><i class="fa fa-times"></i></button>
                    </div>
                    <div class="pm-form-body">
                        <form class="pm-client-form">
                            <div class="pm-form-row">
                                <div class="pm-form-group">
                                    <label>Client Name <span class="required">*</span></label>
                                    <input type="text" name="customer_name" value="${client?.customer_name || ''}" required>
                                </div>
                            </div>
                            <div class="pm-form-row">
                                <div class="pm-form-group">
                                    <label>Client Group</label>
                                    <select name="client_group">
                                        <option value="">Select Group...</option>
                                        <!-- Options will be loaded dynamically -->
                                    </select>
                                </div>
                                <div class="pm-form-group">
                                    <label>Year End</label>
                                    <select name="custom_year_end">
                                        ${this.generateYearEndOptions(client?.custom_year_end || client?.year_end || 'June')}
                                    </select>
                                </div>
                            </div>
                            <div class="pm-form-row">
                                <div class="pm-form-group">
                                    <label>Customer Type</label>
                                    <select name="customer_type">
                                        <option value="Company">Company</option>
                                        <option value="Individual">Individual</option>
                                    </select>
                                </div>
                                <div class="pm-form-group">
                                    <label>Status</label>
                                    <select name="disabled">
                                        <option value="0">Active</option>
                                        <option value="1">Inactive</option>
                                    </select>
                                </div>
                            </div>
                            <div class="pm-form-row">
                                <div class="pm-form-group full-width">
                                    <label>Website</label>
                                    <input type="url" name="website" value="${client?.website || ''}">
                                </div>
                            </div>
                        </form>
                    </div>
                    <div class="pm-form-footer">
                        <button class="pm-btn pm-btn-secondary pm-cancel-form">Cancel</button>
                        <button class="pm-btn pm-btn-primary pm-save-client">
                            <i class="fa fa-save"></i> ${isEdit ? 'Update' : 'Create'} Client
                        </button>
                    </div>
                </div>
            </div>
        `;

        $('body').append(formHTML);
        this.bindFormEvents(isEdit);
        
        // Load client groups for dropdown
        this.loadClientGroups();
    }

    bindFormEvents(isEdit) {
        const self = this;
        
        // Force remove any existing events first
        $('.pm-client-form-overlay').off();
        $('.pm-cancel-form').off();
        $('.pm-close-form').off();
        
        // Direct binding to cancel button with immediate action
        $('.pm-cancel-form').on('click', function(e) {
            console.log('Cancel button clicked!'); // Debug log
            e.preventDefault();
            e.stopImmediatePropagation();
            $('.pm-client-form-overlay').remove();
            return false;
        });

        // Direct binding to close button
        $('.pm-close-form').on('click', function(e) {
            console.log('Close button clicked!'); // Debug log
            e.preventDefault();
            e.stopImmediatePropagation();
            $('.pm-client-form-overlay').remove();
            return false;
        });

        // Overlay click to close
        $('.pm-client-form-overlay').on('click', function(e) {
            if (e.target === this) {
                console.log('Overlay clicked!'); // Debug log
                $('.pm-client-form-overlay').remove();
            }
        });

        // Save button
        $('.pm-save-client').on('click', function(e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            self.saveClient(isEdit);
            return false;
        });

        // Prevent dialog content clicks from closing
        $('.pm-client-form-dialog').on('click', function(e) {
            e.stopPropagation();
        });

        // Keyboard ESC to close
        $(document).off('keydown.client-form').on('keydown.client-form', function(e) {
            if (e.key === 'Escape') {
                console.log('ESC pressed!'); // Debug log
                $('.pm-client-form-overlay').remove();
                $(document).off('keydown.client-form');
            }
        });
        
        // Additional failsafe - direct DOM event listener
        const cancelBtn = document.querySelector('.pm-cancel-form');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function(e) {
                console.log('Direct DOM cancel clicked!'); // Debug log
                e.preventDefault();
                e.stopImmediatePropagation();
                const overlay = document.querySelector('.pm-client-form-overlay');
                if (overlay) {
                    overlay.remove();
                }
            }, true); // Use capture phase
        }
    }

    async saveClient(isEdit) {
        const formData = this.getFormData();
        
        if (!this.validateForm(formData)) {
            return;
        }

        try {
            $('.pm-save-client').prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i> Saving...');

            const method = isEdit ? 'update_client' : 'create_client';
            const args = isEdit ? { client_id: this.currentClient.name, ...formData } : formData;

            const response = await this.apiCall(method, args);

            if (response && response.success) {
                $('.pm-client-form-overlay').remove();
                this.showSuccess(isEdit ? 'Client updated successfully' : 'Client created successfully');
                this.loadClients(); // Refresh list
                
                if (isEdit) {
                    this.loadClientDetails(this.currentClient.name); // Refresh details
                }
            } else {
                this.showFormError(response?.error || 'Failed to save client');
            }
        } catch (error) {
            console.error('Save client error:', error);
            this.showFormError('Failed to save client. Please try again.');
        } finally {
            $('.pm-save-client').prop('disabled', false).html('<i class="fa fa-save"></i> Save Client');
        }
    }

    getFormData() {
        const form = $('.pm-client-form')[0];
        const formData = new FormData(form);
        const data = {};
        
        for (let [key, value] of formData.entries()) {
            data[key] = value;
        }
        
        return data;
    }

    validateForm(data) {
        if (!data.customer_name?.trim()) {
            this.showFormError('Client name is required');
            return false;
        }
        
        return true;
    }

    async confirmDeleteClient() {
        if (!this.currentClient) return;

        const confirmHTML = `
            <div class="pm-confirm-overlay">
                <div class="pm-confirm-dialog">
                    <div class="pm-confirm-header">
                        <i class="fa fa-exclamation-triangle" style="color: #ff6b35;"></i>
                        <h3>Delete Client</h3>
                    </div>
                    <div class="pm-confirm-body">
                        <p>Are you sure you want to delete <strong>${this.currentClient.customer_name || this.currentClient.name}</strong>?</p>
                        <p class="pm-warning">This action cannot be undone. All associated data will be removed.</p>
                    </div>
                    <div class="pm-confirm-footer">
                        <button class="pm-btn pm-btn-secondary pm-cancel-delete">Cancel</button>
                        <button class="pm-btn pm-btn-danger pm-confirm-delete">
                            <i class="fa fa-trash"></i> Delete Client
                        </button>
                    </div>
                </div>
            </div>
        `;

        $('body').append(confirmHTML);

        // Force binding with multiple approaches
        $('.pm-cancel-delete').off().on('click', function(e) {
            console.log('Delete cancel clicked!'); // Debug log
            e.preventDefault();
            e.stopImmediatePropagation();
            $('.pm-confirm-overlay').remove();
            return false;
        });

        $('.pm-confirm-delete').off().on('click', (e) => {
            e.preventDefault();
            e.stopImmediatePropagation();
            this.deleteClient();
            return false;
        });

        // Overlay click to close
        $('.pm-confirm-overlay').on('click', function(e) {
            if (e.target === this) {
                $('.pm-confirm-overlay').remove();
            }
        });

        // Prevent dialog clicks from closing
        $('.pm-confirm-dialog').on('click', function(e) {
            e.stopPropagation();
        });

        // Direct DOM binding as failsafe
        setTimeout(() => {
            const cancelBtn = document.querySelector('.pm-cancel-delete');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', function(e) {
                    console.log('Direct DOM delete cancel clicked!'); // Debug log
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    const overlay = document.querySelector('.pm-confirm-overlay');
                    if (overlay) {
                        overlay.remove();
                    }
                }, true);
            }
        }, 100);
    }

    async deleteClient() {
        try {
            $('.pm-confirm-delete').prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i> Deleting...');

            const response = await this.apiCall('delete_client', { client_id: this.currentClient.name });

            if (response && response.success) {
                $('.pm-confirm-overlay').remove();
                this.showSuccess('Client deleted successfully');
                this.loadClients(); // Refresh list
                
                // Clear details panel
                $('.pm-client-detail-content').hide();
                $('.pm-client-detail-placeholder').show();
                this.currentClient = null;
            } else {
                this.showError(response?.error || 'Failed to delete client');
            }
        } catch (error) {
            console.error('Delete client error:', error);
            this.showError('Failed to delete client. Please try again.');
        } finally {
            $('.pm-confirm-delete').prop('disabled', false).html('<i class="fa fa-trash"></i> Delete Client');
        }
    }

    // Utility methods
    updateLoadingState(loading) {
        if (loading) {
            $('.pm-client-list').html(`
                <div class="pm-client-loading">
                    <i class="fa fa-spinner fa-spin"></i>
                    <span>Loading clients...</span>
                </div>
            `);
        }
    }

    updateClientCount() {
        const total = this.clients.length;
        const filtered = this.filteredClients.length;
        
        if (filtered === total) {
            $('.pm-client-count').text(`${total} clients`);
        } else {
            $('.pm-client-count').text(`${filtered} of ${total} clients`);
        }
    }

    updatePagination() {
        const totalPages = Math.ceil(this.filteredClients.length / this.itemsPerPage);
        
        if (totalPages <= 1) {
            $('.pm-pagination').empty();
            return;
        }

        let paginationHTML = '';
        
        // Previous button
        if (this.currentPage > 1) {
            paginationHTML += `<button class="pm-page-btn pm-prev-page" data-page="${this.currentPage - 1}"><i class="fa fa-chevron-left"></i></button>`;
        }

        // Page numbers
        for (let i = 1; i <= totalPages; i++) {
            if (i === this.currentPage) {
                paginationHTML += `<button class="pm-page-btn active">${i}</button>`;
            } else {
                paginationHTML += `<button class="pm-page-btn" data-page="${i}">${i}</button>`;
            }
        }

        // Next button
        if (this.currentPage < totalPages) {
            paginationHTML += `<button class="pm-page-btn pm-next-page" data-page="${this.currentPage + 1}"><i class="fa fa-chevron-right"></i></button>`;
        }

        $('.pm-pagination').html(paginationHTML);

        // Bind pagination events
        $('.pm-page-btn[data-page]').on('click', (e) => {
            this.currentPage = parseInt($(e.currentTarget).data('page'));
            this.renderClientList();
        });
    }

    async loadClientGroups() {
        try {
            const response = await this.apiCall('get_client_groups', {});
            
            if (response && response.success) {
                const groups = response.client_groups || [];
                const $select = $('select[name="client_group"]');
                
                groups.forEach(group => {
                    // Use group_name for display, name for value
                    const displayName = group.group_name || group.name;
                    $select.append(`<option value="${group.name}">${displayName}</option>`);
                });
                
                // If editing existing client, set selected value
                if (this.currentClient && this.currentClient.client_group) {
                    $select.val(this.currentClient.client_group);
                }
            }
        } catch (error) {
            console.error('Load client groups error:', error);
        }
    }

    closeDialog() {
        $('.pm-client-management-dialog').fadeOut(200, () => {
            $('.pm-client-management-dialog').remove();
        });
        
        // Clean up
        $(document).off('keydown.client-mgmt');
        this.currentClient = null;
    }

    // API helper
    async apiCall(method, args) {
        return new Promise((resolve, reject) => {
            frappe.call({
                method: `smart_accounting.www.project_management.index.${method}`,
                args: args,
                callback: (response) => {
                    resolve(response.message);
                },
                error: (error) => {
                    reject(error);
                }
            });
        });
    }

    // UI feedback methods
    showSuccess(message) {
        frappe.show_alert({
            message: message,
            indicator: 'green'
        });
    }

    showError(message) {
        frappe.show_alert({
            message: message,
            indicator: 'red'
        });
    }

    showFormError(message) {
        // Show error in form context
        $('.pm-form-body').prepend(`
            <div class="pm-form-error">
                <i class="fa fa-exclamation-circle"></i>
                ${message}
            </div>
        `);
        
        setTimeout(() => {
            $('.pm-form-error').fadeOut();
        }, 5000);
    }

    showDetailError(message) {
        $('.pm-client-detail-content').html(`
            <div class="pm-detail-error">
                <i class="fa fa-exclamation-triangle"></i>
                <h3>Error</h3>
                <p>${message}</p>
                <button class="pm-btn pm-btn-secondary pm-retry-load">Try Again</button>
            </div>
        `);

        $('.pm-retry-load').on('click', () => {
            if (this.currentClient) {
                this.loadClientDetails(this.currentClient.name);
            }
        });
    }
    
    // Debug function to test cancel buttons
    testCancelButtons() {
        console.log('Testing cancel buttons...');
        
        // Test if buttons exist
        const buttons = {
            'pm-cancel-form': document.querySelector('.pm-cancel-form'),
            'pm-close-form': document.querySelector('.pm-close-form'),
            'pm-cancel-delete': document.querySelector('.pm-cancel-delete'),
            'pm-close-dialog': document.querySelector('.pm-close-dialog')
        };
        
        Object.entries(buttons).forEach(([name, btn]) => {
            if (btn) {
                console.log(`✓ ${name} button found`, btn);
                console.log(`  - Computed style:`, window.getComputedStyle(btn));
                console.log(`  - Event listeners:`, getEventListeners ? getEventListeners(btn) : 'DevTools required');
            } else {
                console.log(`✗ ${name} button NOT found`);
            }
        });
    }
}

// Create global instance
window.ClientManagementSystem = ClientManagementSystem;

// Export for module systems if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ClientManagementSystem;
}

