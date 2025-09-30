// Project Management - Client Selector Modal
// Modal-based client selector with search and create functionality

class ClientSelectorModal {
    constructor() {
        this.utils = window.PMUtils;
        this.currentCell = null;
        this.currentTaskId = null;
    }

    // Show client selector modal
    showClientSelector($cell) {
        this.currentCell = $cell;
        this.currentTaskId = $cell.data('task-id');
        const currentClientName = $cell.data('current-client-name') || '';
        const currentClientId = $cell.data('current-client-id') || '';

        const modalHTML = `
            <div class="pm-client-selector-overlay">
                <div class="pm-client-selector-modal">
                    <div class="pm-client-selector-header">
                        <h3>Select Client</h3>
                        <button class="pm-client-selector-close">
                            <i class="fa fa-times"></i>
                        </button>
                    </div>
                    <div class="pm-client-selector-body">
                        <!-- Current Client Display -->
                        <div class="pm-current-client">
                            <label>Current Client:</label>
                            <span class="pm-current-client-name">${currentClientName === 'No Client' ? 'None' : currentClientName}</span>
                        </div>
                        
                        <!-- Confirmation Area (hidden by default) -->
                        <div class="pm-client-confirmation" style="display: none;">
                            <div class="pm-confirmation-content">
                                <i class="fa fa-question-circle"></i>
                                <span class="pm-confirmation-message"></span>
                            </div>
                            <div class="pm-confirmation-actions">
                                <button class="pm-btn pm-btn-secondary pm-cancel-confirmation">Cancel</button>
                                <button class="pm-btn pm-btn-primary pm-confirm-change">Confirm Change</button>
                            </div>
                        </div>
                        
                        <!-- Search Existing Clients -->
                        <div class="pm-client-search-section">
                            <h4><i class="fa fa-search"></i> Search Existing Clients</h4>
                            <div class="pm-search-container">
                                <input type="text" class="pm-client-search-input" placeholder="Type client name to search..." autocomplete="off">
                                <div class="pm-search-results" style="display: none;">
                                    <div class="pm-search-loading">
                                        <i class="fa fa-spinner fa-spin"></i> Searching...
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Create New Client -->
                        <div class="pm-client-create-section">
                            <h4><i class="fa fa-plus-circle"></i> Create New Client</h4>
                            <p class="pm-create-hint">
                                <i class="fa fa-info-circle"></i>
                                For additional details, use the "Manage Clients" button in the main toolbar after creation.
                            </p>
                            <form class="pm-client-create-form">
                                <div class="pm-form-group">
                                    <label>Client Name <span class="pm-required">*</span></label>
                                    <input type="text" class="pm-client-name-input" placeholder="Enter client name..." maxlength="140" required>
                                </div>
                                <div class="pm-form-row">
                                    <div class="pm-form-group pm-form-group-half">
                                        <label>Year End</label>
                                        <select class="pm-client-yearend-select">
                                            <option value="January">January</option>
                                            <option value="February">February</option>
                                            <option value="March">March</option>
                                            <option value="April">April</option>
                                            <option value="May">May</option>
                                            <option value="June" selected>June</option>
                                            <option value="July">July</option>
                                            <option value="August">August</option>
                                            <option value="September">September</option>
                                            <option value="October">October</option>
                                            <option value="November">November</option>
                                            <option value="December">December</option>
                                        </select>
                                    </div>
                                    <div class="pm-form-group pm-form-group-half">
                                        <label>Entity Type <span class="pm-required">*</span></label>
                                        <select class="pm-client-entitytype-select" required>
                                            <option value="Company" selected>Company</option>
                                            <option value="Individual">Individual</option>
                                            <option value="Partnership">Partnership</option>
                                            <option value="Trust">Trust</option>
                                            <option value="SMSF">SMSF</option>
                                        </select>
                                    </div>
                                </div>
                                <button type="submit" class="pm-btn pm-btn-primary pm-create-client-btn">
                                    <i class="fa fa-plus"></i>
                                    Create Client & Select
                                </button>
                            </form>
                        </div>
                    </div>
                    <div class="pm-client-selector-footer">
                        <button class="pm-btn pm-btn-secondary pm-cancel-selection">Cancel</button>
                        <button class="pm-btn pm-btn-danger pm-remove-client" ${!currentClientId ? 'style="display:none"' : ''}>
                            <i class="fa fa-unlink"></i>
                            Remove Client
                        </button>
                    </div>
                </div>
            </div>
        `;

        $('body').append(modalHTML);
        $('.pm-client-selector-overlay').fadeIn(200);

        // Focus on search input
        $('.pm-client-search-input').focus();

        this.bindModalEvents();
    }

    bindModalEvents() {
        const $modal = $('.pm-client-selector-modal');
        const $overlay = $('.pm-client-selector-overlay');

        // Close modal events
        $('.pm-client-selector-close, .pm-cancel-selection').on('click', () => {
            this.closeModal();
        });

        // Close on overlay click
        $overlay.on('click', (e) => {
            if (e.target === e.currentTarget) {
                this.closeModal();
            }
        });

        // ESC key to close
        $(document).on('keydown.client-selector', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });

        // Search functionality
        let searchTimeout;
        $('.pm-client-search-input').on('input', (e) => {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim();

            if (query.length < 1) {
                $('.pm-search-results').hide();
                return;
            }

            searchTimeout = setTimeout(() => {
                this.performClientSearch(query);
            }, 300);
        });

        // Create new client form
        $('.pm-client-create-form').on('submit', (e) => {
            e.preventDefault();
            this.createNewClient();
        });

        // Remove client button
        $('.pm-remove-client').on('click', () => {
            this.showRemoveConfirmation();
        });

        // Confirmation area events
        $('.pm-cancel-confirmation').on('click', () => {
            this.hideClientConfirmation();
        });

        $('.pm-confirm-change').on('click', () => {
            this.confirmClientChange();
        });
    }

    async performClientSearch(query) {
        const $results = $('.pm-search-results');
        $results.html('<div class="pm-search-loading"><i class="fa fa-spinner fa-spin"></i> Searching...</div>').show();

        try {
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.search_customers',
                args: { query: query }
            });

            if (response.message && response.message.success) {
                const customers = response.message.customers;
                let html = '';

                if (customers.length === 0) {
                    html = '<div class="pm-search-no-results"><i class="fa fa-search"></i> No clients found</div>';
                } else {
                    customers.forEach(customer => {
                        html += `
                            <div class="pm-client-result" data-customer-id="${customer.name}" data-customer-name="${customer.customer_name}">
                                <div class="pm-client-result-main">
                                    <i class="fa fa-building"></i>
                                    <span class="pm-client-result-name">${customer.customer_name}</span>
                                </div>
                                <div class="pm-client-result-meta">
                                    <span class="pm-client-result-type">${customer.customer_type}</span>
                                    ${customer.custom_year_end ? `<span class="pm-client-result-yearend">Year End: ${customer.custom_year_end}</span>` : ''}
                                </div>
                            </div>
                        `;
                    });
                }

                $results.html(html);

                // Handle client selection
                $('.pm-client-result').on('click', (e) => {
                    const $result = $(e.currentTarget);
                    const customerId = $result.data('customer-id');
                    const customerName = $result.data('customer-name');
                    this.showClientConfirmation(customerId, customerName);
                });
            } else {
                $results.html('<div class="pm-search-error"><i class="fa fa-exclamation-triangle"></i> Search failed</div>');
            }
        } catch (error) {
            console.error('Client search error:', error);
            $results.html('<div class="pm-search-error"><i class="fa fa-exclamation-triangle"></i> Search failed</div>');
        }
    }

    showClientConfirmation(customerId, customerName) {
        // Store the pending selection
        this.pendingCustomerId = customerId;
        this.pendingCustomerName = customerName;
        this.confirmationType = 'change';
        
        // Get current client name for comparison
        const currentClientName = this.currentCell.data('current-client-name') || 'No Client';
        
        // Show confirmation message
        const message = `Change client from "${currentClientName}" to "${customerName}"?`;
        $('.pm-confirmation-message').text(message);
        $('.pm-confirm-change').text('Confirm Change');
        $('.pm-client-confirmation').attr('data-type', 'change');
        
        // Hide search results and show confirmation
        $('.pm-search-results').hide();
        $('.pm-client-search-input').val('');
        $('.pm-client-confirmation').slideDown(200);
        
        // Scroll modal body to top to ensure confirmation is visible
        $('.pm-client-selector-body').animate({ scrollTop: 0 }, 300);
        
        // Hide other sections temporarily
        $('.pm-client-search-section h4, .pm-search-container input').css('opacity', '0.5');
        $('.pm-client-create-section').css('opacity', '0.5');
    }

    showRemoveConfirmation() {
        // Store the confirmation type
        this.confirmationType = 'remove';
        
        // Get current client name
        const currentClientName = this.currentCell.data('current-client-name') || 'No Client';
        
        // Show confirmation message
        const message = `Remove "${currentClientName}" from this task?`;
        $('.pm-confirmation-message').text(message);
        $('.pm-confirm-change').text('Remove Client');
        $('.pm-client-confirmation').attr('data-type', 'remove');
        
        // Show confirmation and scroll to top
        $('.pm-client-confirmation').slideDown(200);
        
        // Scroll modal body to top to ensure confirmation is visible
        $('.pm-client-selector-body').animate({ scrollTop: 0 }, 300);
        
        // Hide other sections temporarily
        $('.pm-client-search-section h4, .pm-search-container input').css('opacity', '0.5');
        $('.pm-client-create-section').css('opacity', '0.5');
    }

    hideClientConfirmation() {
        // Clear pending selection and confirmation type
        this.pendingCustomerId = null;
        this.pendingCustomerName = null;
        this.confirmationType = null;
        
        // Hide confirmation and restore other sections
        $('.pm-client-confirmation').slideUp(200).removeAttr('data-type');
        $('.pm-client-search-section h4, .pm-search-container input').css('opacity', '1');
        $('.pm-client-create-section').css('opacity', '1');
    }

    async confirmClientChange() {
        try {
            if (this.confirmationType === 'change') {
                if (!this.pendingCustomerId || !this.pendingCustomerName) return;
                await this.selectExistingClient(this.pendingCustomerId, this.pendingCustomerName);
            } else if (this.confirmationType === 'remove') {
                await this.removeClientFromTask();
            }
        } finally {
            this.hideClientConfirmation();
        }
    }

    async selectExistingClient(customerId, customerName) {
        try {
            // No need for external confirmation dialog anymore

            // Update backend
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.update_task_client',
                args: {
                    task_id: this.currentTaskId,
                    customer_id: customerId
                }
            });

            if (response.message && response.message.success) {
                this.updateClientDisplay(customerId, customerName);
                this.closeModal();
                
                frappe.show_alert({
                    message: 'Client linked successfully',
                    indicator: 'green'
                });
            } else {
                throw new Error(response.message?.error || 'Failed to link client');
            }
        } catch (error) {
            console.error('Client selection error:', error);
            frappe.show_alert({
                message: 'Failed to link client: ' + error.message,
                indicator: 'red'
            });
            // Don't close modal on error, let user try again or cancel manually
        }
    }

    async createNewClient() {
        const clientName = $('.pm-client-name-input').val().trim();
        const yearEnd = $('.pm-client-yearend-select').val();
        const entityType = $('.pm-client-entitytype-select').val();

        if (!clientName) {
            frappe.show_alert({
                message: 'Client name is required',
                indicator: 'red'
            });
            $('.pm-client-name-input').focus();
            return;
        }

        // Disable create button during creation
        const $createBtn = $('.pm-create-client-btn');
        const originalText = $createBtn.html();
        $createBtn.prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i> Creating...');

        try {
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.create_customer_and_link',
                args: {
                    task_id: this.currentTaskId,
                    customer_name: clientName,
                    year_end: yearEnd,
                    customer_type: entityType
                }
            });

            if (response.message && response.message.success) {
                const customerId = response.message.customer_id;
                this.updateClientDisplay(customerId, clientName);
                this.closeModal();
                
                frappe.show_alert({
                    message: 'Client created and linked successfully',
                    indicator: 'green'
                });
            } else {
                throw new Error(response.message?.error || 'Failed to create client');
            }
        } catch (error) {
            console.error('Client creation error:', error);
            frappe.show_alert({
                message: 'Failed to create client: ' + error.message,
                indicator: 'red'
            });
            // Don't close modal on error, let user try again or cancel manually
        } finally {
            $createBtn.prop('disabled', false).html(originalText);
        }
    }

    async removeClientFromTask() {
        try {
            // No need for external confirmation dialog anymore
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.update_task_client',
                args: {
                    task_id: this.currentTaskId,
                    customer_id: null
                }
            });

            if (response.message && response.message.success) {
                this.updateClientDisplay(null, 'No Client');
                this.closeModal();
                
                frappe.show_alert({
                    message: 'Client removed successfully',
                    indicator: 'green'
                });
            } else {
                throw new Error(response.message?.error || 'Failed to remove client');
            }
        } catch (error) {
            console.error('Client removal error:', error);
            frappe.show_alert({
                message: 'Failed to remove client: ' + error.message,
                indicator: 'red'
            });
            // Don't close modal on error, let user try again or cancel manually
        }
    }

    updateClientDisplay(customerId, customerName) {
        // Update cell data
        this.currentCell.data('current-client-id', customerId || '');
        this.currentCell.data('current-client-name', customerName);

        // Preserve comment indicator
        const currentCommentHtml = this.currentCell.find('.pm-client-comments').prop('outerHTML') || '';
        
        // Update cell HTML with new structure
        this.currentCell.html(`
            <div class="pm-client-content">
                <button class="pm-subtask-toggle" data-task-id="${this.currentTaskId}" title="Show/hide subtasks">
                    <i class="fa fa-chevron-right"></i>
                </button>
                <span class="pm-client-selector-trigger client-display" 
                      data-task-id="${this.currentTaskId}"
                      data-field="custom_client"
                      data-field-type="client_selector"
                      data-current-client-id="${customerId || ''}"
                      data-current-client-name="${customerName}"
                      title="Click to select client">${customerName}</span>
            </div>
            ${currentCommentHtml}
        `);

        // Update group display if needed
        if (window.ProjectManager) {
            window.ProjectManager.updateGroupDisplay(this.currentTaskId, customerId);
        }
    }

    closeModal() {
        // Clear editing state from the current cell
        if (this.currentCell) {
            this.currentCell.removeClass('editing');
        }
        
        $('.pm-client-selector-overlay').fadeOut(200, function() {
            $(this).remove();
        });
        $(document).off('keydown.client-selector');
        this.currentCell = null;
        this.currentTaskId = null;
    }
}

// Create global instance
window.ClientSelectorModal = new ClientSelectorModal();

// Export for module systems if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ClientSelectorModal;
}
