// Client Management System - Main Controller
// Handles client, contact, and company management with tab-based interface

class ClientManagementSystem {
    constructor() {
        this.currentTab = 'clients';
        this.currentPage = {
            clients: 1,
            contacts: 1,
            companies: 1
        };
        this.itemsPerPage = 50;
        this.searchTimeout = null;
        this.filterOptions = {};
        
        this.init();
    }

    async init() {
        console.log('🚀 Initializing Client Management System...');
        
        try {
            // Bind events
            this.bindEvents();
            
            // Load filter options
            await this.loadFilterOptions();
            
            // Load initial data
            await this.loadTabData('clients');
            
            console.log('✅ Client Management System initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing Client Management System:', error);
            this.showError('Failed to initialize client management');
        }
    }

    bindEvents() {
        // Tab switching
        $(document).on('click', '.cm-tab', (e) => {
            const tab = $(e.currentTarget).data('tab');
            this.switchTab(tab);
        });

        // Breadcrumb navigation
        $(document).on('click', '.pm-breadcrumb-item[data-view="dashboard"]', (e) => {
            e.preventDefault();
            this.navigateToManagementDashboard();
        });

        // Search functionality
        $(document).on('input', '.cm-search-input', (e) => {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => {
                this.handleSearch(e.target.value);
            }, 300);
        });

        // Filter changes
        $(document).on('change', '.cm-filter-select', () => {
            this.applyFilters();
        });

        // Clear filters
        $(document).on('click', '.cm-clear-filters', () => {
            this.clearFilters();
        });

        // New client button
        $(document).on('click', '.cm-new-client-btn', () => {
            this.createNewClient();
        });

        // Refresh button
        $(document).on('click', '.cm-refresh-btn', () => {
            this.refreshCurrentTab();
        });

        // Client Groups management button
        $(document).on('click', '.cm-manage-groups-btn', () => {
            this.showClientGroupsManagement();
        });

        // Client name click (view details)
        $(document).on('click', '.cm-client-name', (e) => {
            const clientId = $(e.currentTarget).data('client-id');
            this.showClientDetails(clientId);
        });

        // Action buttons
        $(document).on('click', '.cm-action-btn-view', (e) => {
            const clientId = $(e.currentTarget).data('client-id');
            this.showClientDetails(clientId);
        });

        $(document).on('click', '.cm-action-btn-edit', (e) => {
            const clientId = $(e.currentTarget).data('client-id');
            this.editClient(clientId);
        });

        // Modal close
        $(document).on('click', '.cm-modal-close, .cm-modal', (e) => {
            if (e.target === e.currentTarget) {
                this.closeModal();
            }
        });

        // Pagination
        $(document).on('click', '.cm-prev-btn', () => {
            this.previousPage();
        });

        $(document).on('click', '.cm-next-btn', () => {
            this.nextPage();
        });

        // Escape key to close modal
        $(document).on('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });
    }

    async switchTab(tab) {
        if (this.currentTab === tab) return;

        // Update tab UI
        $('.cm-tab').removeClass('active');
        $(`.cm-tab[data-tab="${tab}"]`).addClass('active');

        $('.cm-tab-content').removeClass('active');
        $(`#${tab}-tab`).addClass('active');

        // Update current tab
        this.currentTab = tab;

        // Load tab data
        await this.loadTabData(tab);
    }

    async loadTabData(tab) {
        try {
            switch (tab) {
                case 'clients':
                    await this.loadClients();
                    break;
                case 'contacts':
                    await this.loadContacts();
                    break;
                case 'companies':
                    await this.loadCompanies();
                    break;
            }
        } catch (error) {
            console.error(`Error loading ${tab} data:`, error);
            this.showError(`Failed to load ${tab} data`);
        }
    }

    async loadClients() {
        this.showLoading('clients');

        try {
            const searchTerm = $('#cm-search-input').val();
            const filters = this.getCurrentFilters();
            const offset = (this.currentPage.clients - 1) * this.itemsPerPage;

            const response = await frappe.call({
                method: 'smart_accounting.www.client_management.index.get_clients',
                args: {
                    search_term: searchTerm,
                    filters: JSON.stringify(filters),
                    limit: this.itemsPerPage,
                    offset: offset
                }
            });

            if (response.message && response.message.success) {
                this.renderClientsTable(response.message.clients);
                this.updatePagination('clients', response.message.total_count, response.message.has_more);
                this.updateTabCount('clients', response.message.total_count);
            } else {
                throw new Error(response.message?.error || 'Failed to load clients');
            }
        } catch (error) {
            console.error('Error loading clients:', error);
            this.showNoData('clients');
            this.showError('Failed to load clients');
        }
    }

    async loadContacts() {
        this.showLoading('contacts');

        try {
            const searchTerm = $('#cm-search-input').val();
            const clientFilter = $('#cm-client-filter').val();
            const offset = (this.currentPage.contacts - 1) * this.itemsPerPage;

            const response = await frappe.call({
                method: 'smart_accounting.www.client_management.index.get_business_contacts',
                args: {
                    search_term: searchTerm,
                    client_filter: clientFilter,
                    limit: this.itemsPerPage,
                    offset: offset
                }
            });

            if (response.message && response.message.success) {
                this.renderContactsTable(response.message.contacts);
                this.updatePagination('contacts', response.message.total_count, response.message.has_more);
                this.updateTabCount('contacts', response.message.total_count);
            } else {
                throw new Error(response.message?.error || 'Failed to load contacts');
            }
        } catch (error) {
            console.error('Error loading contacts:', error);
            this.showNoData('contacts');
            this.showError('Failed to load contacts');
        }
    }

    async loadCompanies() {
        this.showLoading('companies');

        try {
            const searchTerm = $('#cm-search-input').val();
            const offset = (this.currentPage.companies - 1) * this.itemsPerPage;

            const response = await frappe.call({
                method: 'smart_accounting.www.client_management.index.get_companies',
                args: {
                    search_term: searchTerm,
                    limit: this.itemsPerPage,
                    offset: offset
                }
            });

            if (response.message && response.message.success) {
                this.renderCompaniesTable(response.message.companies);
                this.updatePagination('companies', response.message.total_count, response.message.has_more);
                this.updateTabCount('companies', response.message.total_count);
            } else {
                throw new Error(response.message?.error || 'Failed to load companies');
            }
        } catch (error) {
            console.error('Error loading companies:', error);
            this.showNoData('companies');
            this.showError('Failed to load companies');
        }
    }

    renderClientsTable(clients) {
        const tbody = $('#clients-table-body');
        tbody.empty();

        if (clients.length === 0) {
            this.showNoData('clients');
            return;
        }

        clients.forEach(client => {
            const row = $(`
                <tr>
                    <td>
                        <span class="cm-client-name" data-client-id="${client.name}">
                            ${this.escapeHtml(client.customer_name)}
                        </span>
                    </td>
                    <td>
                        <span class="cm-company-name">
                            ${client.company_name || '-'}
                        </span>
                    </td>
                    <td>
                        <div class="cm-contact-names">
                            ${client.contact_names ? 
                                `<span class="cm-contact-list">${this.escapeHtml(client.contact_names)}</span>` : 
                                `<span class="cm-no-contacts">No contacts</span>`
                            }
                            <span class="cm-count-badge ${client.contact_count === 0 ? 'zero' : ''}">
                                ${client.contact_count}
                            </span>
                        </div>
                    </td>
                    <td>
                        <span class="cm-count-badge ${client.task_count === 0 ? 'zero' : ''}">
                            ${client.task_count}
                        </span>
                    </td>
                    <td>
                        <span class="cm-referral-name">
                            ${client.referral_name || '-'}
                        </span>
                    </td>
                    <td>
                        <div class="cm-action-buttons">
                            <button class="cm-action-btn cm-action-btn-view" data-client-id="${client.name}" title="View Details">
                                <i class="fa fa-eye"></i>
                                View
                            </button>
                            <button class="cm-action-btn cm-action-btn-edit" data-client-id="${client.name}" title="Edit Client">
                                <i class="fa fa-edit"></i>
                                Edit
                            </button>
                        </div>
                    </td>
                </tr>
            `);
            tbody.append(row);
        });

        this.hideLoading('clients');
    }

    renderContactsTable(contacts) {
        const tbody = $('#contacts-table-body');
        tbody.empty();

        if (contacts.length === 0) {
            this.showNoData('contacts');
            return;
        }

        contacts.forEach(contact => {
            const row = $(`
                <tr>
                    <td>
                        <strong>${this.escapeHtml(contact.full_name || 'Unnamed Contact')}</strong>
                        ${contact.is_system_user ? '<small class="cm-system-user-badge">System User</small>' : ''}
                    </td>
                    <td>
                        <span class="cm-client-name">
                            ${contact.client_name || 'No Client'}
                        </span>
                    </td>
                    <td>
                        ${contact.custom_contact_role ? 
                            `<span class="cm-contact-role">${contact.custom_contact_role}</span>` : 
                            '-'
                        }
                    </td>
                    <td>${contact.email_id || '-'}</td>
                    <td>${contact.phone || '-'}</td>
                    <td>
                        <div class="cm-action-buttons">
                            <button class="cm-action-btn cm-action-btn-edit" data-contact-id="${contact.name}" title="Edit Contact">
                                <i class="fa fa-edit"></i>
                                Edit
                            </button>
                        </div>
                    </td>
                </tr>
            `);
            tbody.append(row);
        });

        this.hideLoading('contacts');
    }

    renderCompaniesTable(companies) {
        const tbody = $('#companies-table-body');
        tbody.empty();

        if (companies.length === 0) {
            this.showNoData('companies');
            return;
        }

        companies.forEach(company => {
            const row = $(`
                <tr>
                    <td>
                        <strong>${this.escapeHtml(company.company_name)}</strong>
                    </td>
                    <td>${company.domain || '-'}</td>
                    <td>
                        <span class="cm-count-badge ${company.client_count === 0 ? 'zero' : ''}">
                            ${company.client_count}
                        </span>
                    </td>
                    <td>
                        <span class="cm-last-updated">
                            ${company.creation_formatted}
                        </span>
                    </td>
                    <td>
                        <div class="cm-action-buttons">
                            <button class="cm-action-btn cm-action-btn-edit" data-company-id="${company.name}" title="Edit Company">
                                <i class="fa fa-edit"></i>
                                Edit
                            </button>
                        </div>
                    </td>
                </tr>
            `);
            tbody.append(row);
        });

        this.hideLoading('companies');
    }

    async showClientDetails(clientId) {
        try {
            const response = await frappe.call({
                method: 'smart_accounting.www.client_management.index.get_client_details',
                args: { client_id: clientId }
            });

            if (response.message && response.message.success) {
                this.renderClientDetailsModal(response.message);
                $('#client-details-modal').fadeIn(200);
            } else {
                throw new Error(response.message?.error || 'Failed to load client details');
            }
        } catch (error) {
            console.error('Error loading client details:', error);
            this.showError('Failed to load client details');
        }
    }

    renderClientDetailsModal(data) {
        const { client, contacts, projects } = data;
        
        $('#client-details-title').text(`${client.customer_name} - Details`);
        
        const modalBody = $('#client-details-body');
        modalBody.html(`
            <div class="cm-client-info">
                <div class="cm-info-card">
                    <h4>Basic Information</h4>
                    <div class="cm-info-item">
                        <span class="cm-info-label">Client Name:</span>
                        <span class="cm-info-value">${client.customer_name}</span>
                    </div>
                    <div class="cm-info-item">
                        <span class="cm-info-label">Entity Type:</span>
                        <span class="cm-info-value">${client.custom_entity_type || '-'}</span>
                    </div>
                    <div class="cm-info-item">
                        <span class="cm-info-label">Year End:</span>
                        <span class="cm-info-value">${client.custom_year_end || '-'}</span>
                    </div>
                    <div class="cm-info-item">
                        <span class="cm-info-label">Client Group:</span>
                        <span class="cm-info-value">${client.custom_client_group || '-'}</span>
                    </div>
                </div>
                
                <div class="cm-info-card">
                    <h4>Business Relationships</h4>
                    <div class="cm-info-item">
                        <span class="cm-info-label">Company:</span>
                        <span class="cm-info-value">${client.custom_company || '-'}</span>
                    </div>
                    <div class="cm-info-item">
                        <span class="cm-info-label">Referred By:</span>
                        <span class="cm-info-value">${client.custom_referred_by || '-'}</span>
                    </div>
                    <div class="cm-info-item">
                        <span class="cm-info-label">Territory:</span>
                        <span class="cm-info-value">${client.territory || '-'}</span>
                    </div>
                </div>
                
                <div class="cm-info-card">
                    <h4>Statistics</h4>
                    <div class="cm-info-item">
                        <span class="cm-info-label">Contacts:</span>
                        <span class="cm-info-value">${contacts.length}</span>
                    </div>
                    <div class="cm-info-item">
                        <span class="cm-info-label">Tasks:</span>
                        <span class="cm-info-value">${projects.length}</span>
                    </div>
                    <div class="cm-info-item">
                        <span class="cm-info-label">Created:</span>
                        <span class="cm-info-value">${this.formatDate(client.creation)}</span>
                    </div>
                </div>
                
                <div class="cm-modal-actions">
                    <button class="pm-btn pm-btn-primary" onclick="window.open('/app/customer/${client.name}', '_blank')">
                        <i class="fa fa-edit"></i>
                        Edit in ERPNext
                    </button>
                </div>
            </div>
            
            ${contacts.length > 0 ? `
                <div class="cm-section-title">
                    <i class="fa fa-address-book"></i>
                    Contacts (${contacts.length})
                </div>
                <div class="cm-table-container">
                    <table class="cm-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Role</th>
                                <th>Email</th>
                                <th>Phone</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${contacts.map(contact => `
                                <tr>
                                    <td><strong>${contact.full_name}</strong></td>
                                    <td>${contact.custom_contact_role ? 
                                        `<span class="cm-contact-role">${contact.custom_contact_role}</span>` : 
                                        '-'
                                    }</td>
                                    <td>${contact.email_id || '-'}</td>
                                    <td>${contact.phone || '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            ` : ''}
            
            ${projects.length > 0 ? `
                <div class="cm-section-title">
                    <i class="fa fa-tasks"></i>
                    Tasks (${projects.length})
                </div>
                <div class="cm-table-container">
                    <table class="cm-table">
                        <thead>
                            <tr>
                                <th>Task Name</th>
                                <th>Status</th>
                                <th>Created</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${projects.map(task => `
                                <tr>
                                    <td><strong>${task.subject || task.name}</strong></td>
                                    <td>${task.status || '-'}</td>
                                    <td>${task.creation_formatted}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            ` : ''}
        `);
    }

    async loadFilterOptions() {
        try {
            const response = await frappe.call({
                method: 'smart_accounting.www.client_management.index.get_filter_options'
            });

            if (response.message && response.message.success) {
                this.filterOptions = response.message;
                this.populateFilterDropdowns();
            }
        } catch (error) {
            console.error('Error loading filter options:', error);
        }
    }

    populateFilterDropdowns() {
        // Populate company filter
        const companySelect = $('#cm-company-filter');
        companySelect.empty().append('<option value="">All Companies</option>');
        this.filterOptions.companies.forEach(company => {
            companySelect.append(`<option value="${company.name}">${company.company_name}</option>`);
        });

        // Populate referral filter
        const referralSelect = $('#cm-referral-filter');
        referralSelect.empty().append('<option value="">All Referrals</option>');
        this.filterOptions.referrals.forEach(referral => {
            referralSelect.append(`<option value="${referral.name}">${referral.referral_person_name}</option>`);
        });
    }

    getCurrentFilters() {
        return {
            company: $('#cm-company-filter').val(),
            referred_by: $('#cm-referral-filter').val()
        };
    }

    clearFilters() {
        $('.cm-filter-select').val('');
        $('#cm-search-input').val('');
        this.applyFilters();
    }

    applyFilters() {
        this.currentPage[this.currentTab] = 1;
        this.loadTabData(this.currentTab);
    }

    handleSearch(searchTerm) {
        this.currentPage[this.currentTab] = 1;
        this.loadTabData(this.currentTab);
    }

    refreshCurrentTab() {
        this.loadTabData(this.currentTab);
    }

    createNewClient() {
        // Navigate to ERPNext Customer creation
        window.open('/app/customer/new-customer-1', '_blank');
    }

    showClientGroupsManagement() {
        frappe.show_alert({
            message: 'Client Groups management feature coming soon!',
            indicator: 'blue'
        });
        
        // TODO: Implement Client Groups management
        // This will allow users to create, edit, and delete client groups
        // Should show a modal with Client Group list and CRUD operations
    }

    editClient(clientId) {
        // Navigate to ERPNext Customer edit form
        window.open(`/app/customer/${clientId}`, '_blank');
    }

    navigateToManagementDashboard() {
        window.location.href = '/management_dashboard';
    }

    closeModal() {
        $('.cm-modal').fadeOut(200);
    }

    // Utility methods
    showLoading(tab) {
        $(`#${tab}-loading`).show();
        $(`#${tab}-table-body`).empty();
        $(`#${tab}-no-data`).hide();
        $(`#${tab}-pagination`).hide();
    }

    hideLoading(tab) {
        $(`#${tab}-loading`).hide();
    }

    showNoData(tab) {
        $(`#${tab}-loading`).hide();
        $(`#${tab}-no-data`).show();
        $(`#${tab}-pagination`).hide();
    }

    updateTabCount(tab, count) {
        $(`#${tab}-count`).text(count);
    }

    updatePagination(tab, totalCount, hasMore) {
        const pagination = $(`#${tab}-pagination`);
        const currentPage = this.currentPage[tab];
        const totalPages = Math.ceil(totalCount / this.itemsPerPage);

        if (totalPages <= 1) {
            pagination.hide();
            return;
        }

        pagination.show();
        pagination.find('.cm-page-info').text(`Page ${currentPage} of ${totalPages}`);
        pagination.find('.cm-prev-btn').prop('disabled', currentPage === 1);
        pagination.find('.cm-next-btn').prop('disabled', !hasMore);
    }

    previousPage() {
        if (this.currentPage[this.currentTab] > 1) {
            this.currentPage[this.currentTab]--;
            this.loadTabData(this.currentTab);
        }
    }

    nextPage() {
        this.currentPage[this.currentTab]++;
        this.loadTabData(this.currentTab);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatDate(dateString) {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-AU', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch {
            return dateString || '-';
        }
    }

    showError(message) {
        frappe.show_alert({
            message: message,
            indicator: 'red'
        });
    }

    showSuccess(message) {
        frappe.show_alert({
            message: message,
            indicator: 'green'
        });
    }
}

// Initialize when DOM is ready
$(document).ready(function() {
    // Initialize Client Management System
    window.clientManagementSystem = new ClientManagementSystem();
    
    console.log('🏢 Client Management System interface initialized');
});
