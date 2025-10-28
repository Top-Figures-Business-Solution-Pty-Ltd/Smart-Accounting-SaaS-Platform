// Project Management - Client Contact Selector
// Client contact selection and management functionality

class ClientContactSelectorManager {
    constructor() {
        this.utils = window.PMUtils;
    }

    async showClientContactSelector($cell, taskId, fieldName) {
        try {
            console.log('showClientContactSelector called with:', taskId, fieldName);
            
            // Get client ID from the cell data or task
            const clientId = $cell.data('client-id') || await this.getTaskClientId(taskId);
            
            if (!clientId) {
                frappe.show_alert({
                    message: 'Please select a client first before choosing contacts',
                    indicator: 'orange'
                });
                return;
            }
            
            // Get client contacts from server
            const contactsResponse = await frappe.call({
                method: 'smart_accounting.www.project_management.index.get_client_contacts',
                args: { client_id: clientId }
            });
            
            const clientContacts = contactsResponse.message?.contacts || [];
            const clientName = contactsResponse.message?.client_name || 'Client';
            
            console.log('Client contacts loaded:', clientContacts);
            
            // Get current contact assignments
            const currentContacts = await this.getCurrentTaskContacts(taskId);
            console.log('Current contacts:', currentContacts);
        
        // Create contact selector modal
        const selectorHTML = `
            <div class="pm-client-contact-selector-modal" id="pm-client-contact-selector-${taskId}">
                <div class="pm-client-contact-selector-content">
                    <div class="pm-client-contact-selector-header">
                        <h4>Select Contacts for ${clientName}</h4>
                        <button class="pm-client-contact-selector-close">
                            <i class="fa fa-times"></i>
                        </button>
                    </div>
                    <div class="pm-client-contact-selector-body">
                        ${clientContacts.length > 0 ? `
                            <div class="pm-client-contacts-list">
                                ${clientContacts.map(contact => {
                                    const isSelected = currentContacts.some(c => c.contact === contact.name);
                                    return `
                                        <div class="pm-contact-option ${isSelected ? 'selected' : ''}" data-contact-id="${contact.name}">
                                            <div class="pm-contact-checkbox">
                                                <i class="fa fa-${isSelected ? 'check-' : ''}square-o"></i>
                                            </div>
                                            <div class="pm-contact-info">
                                                <div class="pm-contact-name">${contact.first_name || ''} ${contact.last_name || ''}</div>
                                                <div class="pm-contact-details">
                                                    ${contact.email_id ? `<span class="pm-contact-email"><i class="fa fa-envelope"></i> ${contact.email_id}</span>` : ''}
                                                    ${contact.phone ? `<span class="pm-contact-phone"><i class="fa fa-phone"></i> ${contact.phone}</span>` : ''}
                                                </div>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        ` : `
                            <div class="pm-no-contacts">
                                <i class="fa fa-users"></i>
                                <p>No contacts found for this client</p>
                            </div>
                        `}
                        <div class="pm-client-contact-selector-footer">
                            <button class="pm-btn pm-btn-secondary pm-add-new-contact">
                                <i class="fa fa-user-plus"></i>
                                Add New Contact
                            </button>
                            <div class="pm-footer-actions">
                                <button class="pm-btn pm-btn-secondary pm-clear-all-contacts">Clear all</button>
                                <button class="pm-btn pm-btn-primary pm-save-contacts">
                                    <i class="fa fa-check"></i>
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing selector
        $('.pm-client-contact-selector-modal').remove();
        
        // Add to body
        $('body').append(selectorHTML);
        
        // 🔧 修复大数据量下的DOM时序问题：使用requestAnimationFrame确保DOM操作完成
        requestAnimationFrame(() => {
            const $selector = $(`#pm-client-contact-selector-${taskId}`);
            
            if ($selector.length === 0) {
                console.error('❌ Client contact selector not found after append!');
                // 🔧 添加降级处理：再次尝试查找
                setTimeout(() => {
                    const $fallbackSelector = $(`#pm-client-contact-selector-${taskId}`);
                    if ($fallbackSelector.length > 0) {
                        console.log('✅ Fallback client contact selector found:', $fallbackSelector.length);
                        this.initializeClientContactSelectorAfterAppend($fallbackSelector, $cell, taskId, clientId);
                    } else {
                        console.error('❌ Fallback client contact selector also failed');
                    }
                }, 50);
                return;
            }
            
            this.initializeClientContactSelectorAfterAppend($selector, $cell, taskId, clientId);
        });
            
        } catch (error) {
            console.error('Error in showClientContactSelector:', error);
            frappe.show_alert({
                message: 'Error opening contact selector: ' + error.message,
                indicator: 'red'
            });
        }
    }

    // 🔧 新增方法：在DOM确认存在后初始化客户联系人选择器
    initializeClientContactSelectorAfterAppend($selector, $cell, taskId, clientId) {
        // Position above the cell using viewport coordinates
        const cellRect = $cell[0].getBoundingClientRect();
        
        $selector.css({
            position: 'fixed',
            left: Math.max(10, cellRect.left - 100) + 'px',
            top: Math.max(10, cellRect.top - 400) + 'px',
            zIndex: 9999,
            width: '400px',
            maxHeight: '500px'
        });
        
        // Show with animation
        $selector.fadeIn(200);
        
        // Bind events
        this.bindClientContactSelectorEvents($selector, $cell, taskId, clientId);
    }

    bindClientContactSelectorEvents($selector, $cell, taskId, clientId) {
        // Toggle contact selection
        $selector.on('click', '.pm-contact-option', (e) => {
            const $option = $(e.currentTarget);
            const contactId = $option.data('contact-id');
            
            if ($option.hasClass('selected')) {
                // Deselect
                $option.removeClass('selected');
                $option.find('.pm-contact-checkbox i').removeClass('fa-check-square-o').addClass('fa-square-o');
            } else {
                // Select
                $option.addClass('selected');
                $option.find('.pm-contact-checkbox i').removeClass('fa-square-o').addClass('fa-check-square-o');
            }
        });
        
        // Clear all
        $selector.on('click', '.pm-clear-all-contacts', () => {
            $selector.find('.pm-contact-option').removeClass('selected');
            $selector.find('.pm-contact-checkbox i').removeClass('fa-check-square-o').addClass('fa-square-o');
        });
        
        // Add new contact
        $selector.on('click', '.pm-add-new-contact', () => {
            this.showAddContactDialog(clientId, $selector, $cell, taskId);
        });
        
        // Save contacts
        $selector.on('click', '.pm-save-contacts', async () => {
            await this.saveClientContacts($selector, $cell, taskId);
        });
        
        // Close selector
        $selector.on('click', '.pm-client-contact-selector-close', () => {
            $selector.fadeOut(200, () => $selector.remove());
        });
        
        // Close on outside click
        $(document).on('click.client-contact-selector', (e) => {
            if (!$(e.target).closest('.pm-client-contact-selector-modal, .pm-add-contact-dialog').length) {
                $selector.fadeOut(200, () => $selector.remove());
                $(document).off('click.client-contact-selector');
            }
        });
    }

    async getTaskClientId(taskId) {
        try {
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.get_task_client',
                args: { task_id: taskId }
            });
            
            return response.message?.client_id || null;
        } catch (error) {
            console.error('Error getting task client:', error);
            return null;
        }
    }

    async getCurrentTaskContacts(taskId) {
        try {
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.get_task_contacts',
                args: { task_id: taskId }
            });
            
            return response.message?.contacts || [];
        } catch (error) {
            console.error('Error getting current contacts:', error);
            return [];
        }
    }

    async saveClientContacts($selector, $cell, taskId) {
        try {
            // Collect selected contacts
            const selectedContacts = [];
            
            $selector.find('.pm-contact-option.selected').each(function() {
                const $option = $(this);
                const contactId = $option.data('contact-id');
                const contactName = $option.find('.pm-contact-name').text().trim();
                
                selectedContacts.push({
                    contact: contactId,
                    contact_name: contactName
                });
            });
            
            console.log('Saving client contacts:', selectedContacts);
            
            // Save to server
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.update_task_contacts',
                args: {
                    task_id: taskId,
                    contacts: selectedContacts
                }
            });
            
            if (response.message?.success) {
                // Update cell display
                this.updateCellDisplay($cell, selectedContacts);
                
                // Close selector
                $selector.fadeOut(200, () => $selector.remove());
                
                frappe.show_alert({
                    message: 'Client contacts updated successfully',
                    indicator: 'green'
                });
            } else {
                throw new Error(response.message?.error || 'Failed to update client contacts');
            }
            
        } catch (error) {
            console.error('Error saving client contacts:', error);
            frappe.show_alert({
                message: 'Error saving client contacts: ' + error.message,
                indicator: 'red'
            });
        }
    }

    updateCellDisplay($cell, contacts) {
        let displayHTML;
        
        if (!contacts || contacts.length === 0) {
            // Empty state
            displayHTML = `
                <div class="pm-client-contacts-display pm-empty-contacts">
                    <span class="pm-contact-empty">
                        <i class="fa fa-user-plus"></i>
                        Select contact
                    </span>
                </div>
            `;
        } else if (contacts.length === 1) {
            // Single contact
            displayHTML = `
                <div class="pm-client-contacts-display">
                    <span class="pm-contact-name">${contacts[0].contact_name}</span>
                </div>
            `;
        } else {
            // Multiple contacts
            displayHTML = `
                <div class="pm-client-contacts-display">
                    <span class="pm-contact-name">${contacts[0].contact_name}</span>
                    <span class="pm-contact-more">+${contacts.length - 1}</span>
                </div>
            `;
        }
        
        $cell.html(displayHTML);
    }

    showAddContactDialog(clientId, $parentSelector, $cell, taskId) {
        try {
            // Create add contact dialog HTML
            const addContactHTML = `
                <div class="pm-add-contact-dialog" id="pm-add-contact-dialog">
                    <div class="pm-add-contact-content">
                        <div class="pm-add-contact-header">
                            <h4>Add New Contact</h4>
                            <button class="pm-add-contact-close">
                                <i class="fa fa-times"></i>
                            </button>
                        </div>
                        <div class="pm-add-contact-body">
                            <form class="pm-contact-form">
                                <div class="pm-form-row">
                                    <div class="pm-form-group">
                                        <label for="contact-first-name">First Name *</label>
                                        <input type="text" id="contact-first-name" name="first_name" required>
                                    </div>
                                    <div class="pm-form-group">
                                        <label for="contact-last-name">Last Name</label>
                                        <input type="text" id="contact-last-name" name="last_name">
                                    </div>
                                </div>
                                <div class="pm-form-row">
                                    <div class="pm-form-group">
                                        <label for="contact-email">Email *</label>
                                        <input type="email" id="contact-email" name="email_id" required>
                                    </div>
                                </div>
                                <div class="pm-form-row">
                                    <div class="pm-form-group">
                                        <label for="contact-phone">Phone</label>
                                        <input type="tel" id="contact-phone" name="phone">
                                    </div>
                                    <div class="pm-form-group">
                                        <label for="contact-mobile">Mobile</label>
                                        <input type="tel" id="contact-mobile" name="mobile_no">
                                    </div>
                                </div>
                                <div class="pm-form-row">
                                    <div class="pm-form-group full-width">
                                        <label for="contact-designation">Designation</label>
                                        <input type="text" id="contact-designation" name="designation">
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div class="pm-add-contact-footer">
                            <button type="button" class="pm-btn pm-btn-secondary pm-cancel-contact">Cancel</button>
                            <button type="button" class="pm-btn pm-btn-primary pm-save-contact">
                                <i class="fa fa-user-plus"></i>
                                Create Contact
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            // Remove existing dialog
            $('.pm-add-contact-dialog').remove();
            
            // Add to body
            $('body').append(addContactHTML);
            const $dialog = $('#pm-add-contact-dialog');
            
            // Position dialog in center
            $dialog.css({
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 10000,
                width: '500px',
                maxWidth: '90vw'
            });
            
            // Show with animation
            $dialog.fadeIn(200);
            
            // Focus on first input
            $dialog.find('#contact-first-name').focus();
            
            // Bind events
            this.bindAddContactEvents($dialog, clientId, $parentSelector, $cell, taskId);
            
        } catch (error) {
            console.error('Error showing add contact dialog:', error);
            frappe.show_alert({
                message: 'Error opening add contact dialog: ' + error.message,
                indicator: 'red'
            });
        }
    }

    bindAddContactEvents($dialog, clientId, $parentSelector, $cell, taskId) {
        // Save contact
        $dialog.on('click', '.pm-save-contact', async () => {
            await this.saveNewContact($dialog, clientId, $parentSelector, $cell, taskId);
        });
        
        // Cancel/Close
        $dialog.on('click', '.pm-cancel-contact, .pm-add-contact-close', () => {
            $dialog.fadeOut(200, () => $dialog.remove());
        });
        
        // Form validation on input
        $dialog.on('input', 'input[required]', function() {
            const $input = $(this);
            if ($input.val().trim()) {
                $input.removeClass('error');
            }
        });
        
        // Submit on Enter
        $dialog.on('keypress', 'input', (e) => {
            if (e.which === 13) { // Enter key
                e.preventDefault();
                $dialog.find('.pm-save-contact').click();
            }
        });
        
        // Close on Escape
        $(document).on('keydown.add-contact', (e) => {
            if (e.which === 27) { // Escape key
                $dialog.find('.pm-add-contact-close').click();
                $(document).off('keydown.add-contact');
            }
        });
    }

    async saveNewContact($dialog, clientId, $parentSelector, $cell, taskId) {
        try {
            // Collect form data
            const formData = {};
            let hasErrors = false;
            
            $dialog.find('input').each(function() {
                const $input = $(this);
                const name = $input.attr('name');
                const value = $input.val().trim();
                
                // Validate required fields
                if ($input.prop('required') && !value) {
                    $input.addClass('error');
                    hasErrors = true;
                } else {
                    $input.removeClass('error');
                }
                
                if (value) {
                    formData[name] = value;
                }
            });
            
            if (hasErrors) {
                frappe.show_alert({
                    message: 'Please fill in all required fields',
                    indicator: 'red'
                });
                return;
            }
            
            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (formData.email_id && !emailRegex.test(formData.email_id)) {
                $dialog.find('#contact-email').addClass('error');
                frappe.show_alert({
                    message: 'Please enter a valid email address',
                    indicator: 'red'
                });
                return;
            }
            
            // Show loading state
            const $saveBtn = $dialog.find('.pm-save-contact');
            const originalText = $saveBtn.html();
            $saveBtn.html('<i class="fa fa-spinner fa-spin"></i> Creating...').prop('disabled', true);
            
            // Save to server
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.create_client_contact',
                args: {
                    client_id: clientId,
                    contact_data: formData
                }
            });
            
            if (response.message?.success) {
                // Close dialog
                $dialog.fadeOut(200, () => $dialog.remove());
                
                // Refresh the parent selector to show new contact
                await this.refreshContactSelector($parentSelector, clientId, $cell, taskId);
                
                frappe.show_alert({
                    message: 'Contact created successfully',
                    indicator: 'green'
                });
            } else {
                throw new Error(response.message?.error || 'Failed to create contact');
            }
            
        } catch (error) {
            console.error('Error saving new contact:', error);
            
            // Restore button state
            const $saveBtn = $dialog.find('.pm-save-contact');
            $saveBtn.html('<i class="fa fa-user-plus"></i> Create Contact').prop('disabled', false);
            
            frappe.show_alert({
                message: 'Error creating contact: ' + error.message,
                indicator: 'red'
            });
        }
    }

    async refreshContactSelector($parentSelector, clientId, $cell, taskId) {
        try {
            // Close parent selector
            $parentSelector.fadeOut(200, () => $parentSelector.remove());
            
            // Reopen with fresh data
            setTimeout(() => {
                this.showClientContactSelector($cell, taskId, 'custom_client_contacts');
            }, 300);
            
        } catch (error) {
            console.error('Error refreshing contact selector:', error);
        }
    }
}

// Create global instance
window.ClientContactSelectorManager = new ClientContactSelectorManager();

// Export for module systems if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ClientContactSelectorManager;
}
