// Project Management - Engagement Management
// Engagement-specific logic for linking tasks to engagements

class EngagementManager {
    constructor() {
        this.utils = window.PMUtils;
    }

    openEngagementModal(taskId) {
        // Get current engagement for this task
        const $taskRow = $(`.pm-task-row[data-task-id="${taskId}"]`);
        const currentEngagement = $taskRow.find('.pm-engagement-indicator').data('current-engagement') || '';
        
        if (currentEngagement) {
            // Has engagement - show info and options
            this.showEngagementInfo(taskId, currentEngagement);
        } else {
            // No engagement - show selector
            this.showEngagementSelector(taskId);
        }
    }

    showEngagementInfo(taskId, engagementId) {
        // Show loading modal first
        const loadingHtml = `
            <div class="pm-engagement-modal" style="display: block;">
                <div class="pm-modal-overlay"></div>
                <div class="pm-modal-container">
                    <div class="pm-modal-header">
                        <h3><i class="fa fa-handshake-o"></i> Engagement Details</h3>
                        <button class="pm-modal-close" type="button">
                            <i class="fa fa-times"></i>
                        </button>
                    </div>
                    <div class="pm-modal-body">
                        <div class="pm-loading">
                            <i class="fa fa-spinner fa-spin"></i>
                            Loading engagement information...
                        </div>
                    </div>
                </div>
            </div>
        `;

        $('.pm-engagement-modal').remove();
        $('body').append(loadingHtml);

        // Fetch engagement details from backend
        frappe.call({
            method: 'smart_accounting.www.project_management.index.get_engagement_info',
            args: {
                task_id: taskId,
                engagement_id: engagementId
            },
            callback: (response) => {
                if (response.message && response.message.success) {
                    this.renderEngagementDetails(taskId, response.message);
                } else {
                    this.showEngagementError(taskId, response.message.error || 'Failed to load engagement information');
                }
            },
            error: (error) => {
                console.error('Error fetching engagement info:', error);
                this.showEngagementError(taskId, 'Failed to load engagement information');
            }
        });

        // Bind close event
        this.bindEngagementModalEvents(taskId, engagementId);
    }

    renderEngagementDetails(taskId, data) {
        const { engagement_info, engagement_letters, el_count } = data;
        
        // Build engagement details HTML
        const modalHtml = `
            <div class="pm-engagement-modal" style="display: block;">
                <div class="pm-modal-overlay"></div>
                <div class="pm-modal-container">
                    <div class="pm-modal-header">
                        <h3><i class="fa fa-handshake-o"></i> Engagement Details</h3>
                        <div class="pm-el-badge">${el_count} EL${el_count !== 1 ? 's' : ''}</div>
                        <button class="pm-modal-close" type="button">
                            <i class="fa fa-times"></i>
                        </button>
                    </div>
                    <div class="pm-modal-body">
                        <div class="pm-engagement-details">
                            <div class="pm-detail-row">
                                <label>Customer:</label>
                                <span>${engagement_info.customer_name || 'Not specified'}</span>
                            </div>
                            <div class="pm-detail-row">
                                <label>Company:</label>
                                <span>${engagement_info.company_name || 'Not specified'}</span>
                            </div>
                            <div class="pm-detail-row">
                                <label>Service Line:</label>
                                <span>${engagement_info.service_line_name || 'Not specified'}</span>
                            </div>
                            <div class="pm-detail-row">
                                <label>Frequency:</label>
                                <span>${engagement_info.frequency || 'Not specified'}</span>
                            </div>
                            <div class="pm-detail-row">
                                <label>Fiscal Year:</label>
                                <span>${engagement_info.fiscal_year_name || 'Not specified'}</span>
                            </div>
                            <div class="pm-detail-row">
                                <label>Owner Partner:</label>
                                <span>${engagement_info.owner_partner_name || 'Not assigned'}</span>
                            </div>
                        </div>
                        
                        <div class="pm-engagement-files">
                            <h5><i class="fa fa-file-pdf-o"></i> Engagement Letters</h5>
                            ${this.renderEngagementFiles(engagement_letters)}
                        </div>
                        
                        <div class="pm-engagement-actions">
                            <button class="pm-btn pm-btn-primary pm-open-engagement" data-engagement-id="${engagement_info.name}">
                                <i class="fa fa-external-link"></i> Open Engagement
                            </button>
                            <button class="pm-btn pm-btn-secondary pm-upload-file" data-engagement-id="${engagement_info.name}">
                                <i class="fa fa-upload"></i> Upload File
                            </button>
                            <button class="pm-btn pm-btn-secondary pm-change-engagement">
                                <i class="fa fa-exchange"></i> Change Engagement
                            </button>
                            <button class="pm-btn pm-btn-danger pm-unlink-engagement">
                                <i class="fa fa-unlink"></i> Remove Link
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        $('.pm-engagement-modal').remove();
        $('body').append(modalHtml);
        this.bindEngagementModalEvents(taskId, engagement_info.name);
    }

    renderEngagementFiles(files) {
        if (!files || files.length === 0) {
            return '<div class="pm-no-files">No engagement letters uploaded yet.</div>';
        }

        return files.map(file => `
            <div class="pm-file-item">
                <i class="fa fa-file-pdf-o"></i>
                <a href="${file.file_url}" target="_blank">${file.file_name}</a>
                <button class="pm-btn pm-btn-sm pm-btn-danger pm-delete-file" 
                        data-file-name="${file.file_name}" 
                        style="margin-left: auto; padding: 4px 8px;">
                    <i class="fa fa-trash"></i>
                </button>
            </div>
        `).join('');
    }

    showEngagementError(taskId, errorMessage) {
        const errorHtml = `
            <div class="pm-engagement-modal" style="display: block;">
                <div class="pm-modal-overlay"></div>
                <div class="pm-modal-container">
                    <div class="pm-modal-header">
                        <h3><i class="fa fa-handshake-o"></i> Engagement</h3>
                        <button class="pm-modal-close" type="button">
                            <i class="fa fa-times"></i>
                        </button>
                    </div>
                    <div class="pm-modal-body">
                        <div class="pm-error">
                            <i class="fa fa-exclamation-triangle"></i>
                            <p>${errorMessage}</p>
                            <div class="pm-engagement-actions">
                                <button class="pm-btn pm-btn-secondary pm-change-engagement">
                                    <i class="fa fa-exchange"></i> Select Different Engagement
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        $('.pm-engagement-modal').remove();
        $('body').append(errorHtml);
        this.bindEngagementModalEvents(taskId, null);
    }

    showEngagementSelector(taskId) {
        // Show engagement selector dialog
        const modalHtml = `
            <div class="pm-engagement-modal" style="display: block;">
                <div class="pm-modal-overlay"></div>
                <div class="pm-modal-container">
                    <div class="pm-modal-header">
                        <h3><i class="fa fa-handshake-o"></i> Select Engagement</h3>
                        <button class="pm-modal-close" type="button">
                            <i class="fa fa-times"></i>
                        </button>
                    </div>
                    <div class="pm-modal-body">
                        <div class="pm-engagement-selector">
                            <div class="pm-search-box">
                                <input type="text" class="pm-engagement-search" placeholder="Search engagements..." />
                                <i class="fa fa-search"></i>
                            </div>
                            <div class="pm-engagement-list">
                                <div class="pm-loading">
                                    <i class="fa fa-spinner fa-spin"></i> Loading engagements...
                                </div>
                            </div>
                            <div class="pm-selector-actions">
                                <button class="pm-btn pm-btn-secondary pm-create-new-engagement">
                                    <i class="fa fa-plus"></i> Create New Engagement
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        $('.pm-engagement-modal').remove();
        $('body').append(modalHtml);
        this.bindEngagementSelectorEvents(taskId);
        this.loadEngagementOptions();
    }

    bindEngagementModalEvents(taskId, engagementId) {
        const modal = $('.pm-engagement-modal');

        // Remove any existing event handlers to prevent conflicts
        modal.off();

        // Close modal
        modal.on('click.engagement-modal', '.pm-modal-close, .pm-modal-overlay', (e) => {
            e.stopPropagation();
            this.closeEngagementModal();
        });

        // Prevent modal content clicks from closing
        modal.on('click.engagement-modal', '.pm-modal-container', (e) => {
            e.stopPropagation();
        });

        // Open engagement in new tab
        modal.on('click.engagement-modal', '.pm-open-engagement', (e) => {
            e.stopPropagation();
            const id = $(e.target).closest('.pm-open-engagement').data('engagement-id');
            if (id) {
                window.open(`/app/engagement/${id}`, '_blank');
            }
        });

        // Link/change engagement - show selector instead of opening new tab
        modal.on('click.engagement-modal', '.pm-link-engagement, .pm-change-engagement', (e) => {
            e.stopPropagation();
            this.closeEngagementModal();
            this.showEngagementSelector(taskId);
        });

        // Unlink engagement
        modal.on('click.engagement-modal', '.pm-unlink-engagement', (e) => {
            e.stopPropagation();
            this.unlinkEngagement(taskId);
        });

        // Upload file
        modal.on('click.engagement-modal', '.pm-upload-file', (e) => {
            e.stopPropagation();
            const id = $(e.target).closest('.pm-upload-file').data('engagement-id');
            this.showFileUploadDialog(taskId, id);
        });

        // Delete file
        modal.on('click.engagement-modal', '.pm-delete-file', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const fileName = $(e.target).closest('.pm-delete-file').data('file-name');
            this.deleteEngagementFile(taskId, engagementId, fileName);
        });

        // Create new engagement
        modal.on('click.engagement-modal', '.pm-create-engagement, .pm-create-new-engagement', (e) => {
            e.stopPropagation();
            window.open('/app/engagement/new', '_blank');
        });
    }

    bindEngagementSelectorEvents(taskId) {
        const modal = $('.pm-engagement-modal');

        // Close modal
        modal.on('click', '.pm-modal-close, .pm-modal-overlay', () => {
            this.closeEngagementModal();
        });

        // Search functionality
        modal.on('input', '.pm-engagement-search', (e) => {
            const query = $(e.target).val();
            this.filterEngagementList(query);
        });

        // Engagement selection
        modal.on('click', '.pm-engagement-option', (e) => {
            const engagementId = $(e.currentTarget).data('engagement-id');
            const engagementName = $(e.currentTarget).data('engagement-name');
            this.linkEngagement(taskId, engagementId, engagementName);
        });

        // Create new engagement
        modal.on('click', '.pm-create-new-engagement', () => {
            window.open('/app/engagement/new', '_blank');
        });
    }

    async loadEngagementOptions() {
        try {
            const response = await frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Engagement',
                    fields: ['name', 'customer', 'service_line'],
                    limit_page_length: 50,
                    order_by: 'modified desc'
                }
            });

            const engagements = response.message || [];
            let html = '';

            if (engagements.length === 0) {
                html = '<div class="pm-no-engagements">No engagements found</div>';
            } else {
                engagements.forEach(engagement => {
                    html += `
                        <div class="pm-engagement-option" data-engagement-id="${engagement.name}" data-engagement-name="${engagement.customer}">
                            <div class="pm-engagement-info">
                                <strong>${engagement.customer}</strong>
                                <small>${engagement.service_line || 'No service line'}</small>
                            </div>
                            <i class="fa fa-chevron-right"></i>
                        </div>
                    `;
                });
            }

            $('.pm-engagement-list').html(html);
        } catch (error) {
            console.error('Load engagements error:', error);
            $('.pm-engagement-list').html('<div class="pm-error">Failed to load engagements</div>');
        }
    }

    filterEngagementList(query) {
        const $options = $('.pm-engagement-option');
        $options.each(function() {
            const text = $(this).text().toLowerCase();
            if (text.includes(query.toLowerCase())) {
                $(this).show();
            } else {
                $(this).hide();
            }
        });
    }

    async linkEngagement(taskId, engagementId, engagementName) {
        try {
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.update_task_field',
                args: {
                    task_id: taskId,
                    field_name: 'custom_engagement',
                    new_value: engagementId
                }
            });

            if (response.message && response.message.success) {
                // Update UI
                this.updateEngagementDisplay(taskId, engagementId, engagementName);
                this.closeEngagementModal();
                
                frappe.show_alert({
                    message: 'Engagement linked successfully',
                    indicator: 'green'
                });
            }
        } catch (error) {
            console.error('Link engagement error:', error);
            frappe.show_alert({
                message: 'Failed to link engagement',
                indicator: 'red'
            });
        }
    }

    async unlinkEngagement(taskId) {
        try {
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.update_task_field',
                args: {
                    task_id: taskId,
                    field_name: 'custom_engagement',
                    new_value: ''
                }
            });

            if (response.message && response.message.success) {
                // Update UI
                this.updateEngagementDisplay(taskId, '', '');
                this.closeEngagementModal();
                
                frappe.show_alert({
                    message: 'Engagement unlinked successfully',
                    indicator: 'green'
                });
            }
        } catch (error) {
            console.error('Unlink engagement error:', error);
            frappe.show_alert({
                message: 'Failed to unlink engagement',
                indicator: 'red'
            });
        }
    }

    updateEngagementDisplay(taskId, engagementId, engagementName) {
        const $engagementCell = $(`.pm-task-row[data-task-id="${taskId}"] .pm-engagement-indicator`);
        $engagementCell.data('current-engagement', engagementId);
        
        if (engagementId) {
            // Get EL count for this engagement
            frappe.call({
                method: 'smart_accounting.www.project_management.index.get_engagement_info',
                args: {
                    task_id: taskId,
                    engagement_id: engagementId
                },
                callback: (response) => {
                    if (response.message && response.message.success) {
                        const elCount = response.message.el_count || 0;
                        $engagementCell.html(`
                            <div class="pm-engagement-content">
                                <span class="pm-engagement-display">${elCount} EL${elCount !== 1 ? 's' : ''}</span>
                            </div>
                        `);
                    } else {
                        // Fallback display
                        $engagementCell.html(`
                            <div class="pm-engagement-content">
                                <span class="pm-engagement-display">0 ELs</span>
                            </div>
                        `);
                    }
                }
            });
        } else {
            $engagementCell.html(`
                <div class="pm-engagement-content">
                    <span class="pm-engagement-display no-engagement">No engagement</span>
                </div>
            `);
        }
    }

    closeEngagementModal() {
        // Clean up events and remove modal
        $('.pm-engagement-modal').off('.engagement-modal').remove();
    }

    showFileUploadDialog(taskId, engagementId) {
        // Use ERPNext's native file upload dialog
        new frappe.ui.FileUploader({
            doctype: 'Engagement',
            docname: engagementId,
            folder: 'Home/Attachments',
            on_success: (file_doc) => {
                frappe.show_alert('File uploaded successfully', 'green');
                console.log('File uploaded:', file_doc);
                
                // Refresh the engagement modal to show the new file
                setTimeout(() => {
                    this.showEngagementInfo(taskId, engagementId);
                }, 1000);
            },
            restrictions: {
                allowed_file_types: ['.pdf', '.doc', '.docx', '.txt', '.xlsx', '.xls']
            }
        });
    }

    deleteEngagementFile(taskId, engagementId, fileName) {
        if (confirm(`Are you sure you want to delete "${fileName}"?`)) {
            frappe.call({
                method: 'smart_accounting.www.project_management.index.delete_engagement_file',
                args: {
                    file_name: fileName,
                    engagement_id: engagementId
                },
                callback: (response) => {
                    if (response.message && response.message.success) {
                        frappe.show_alert('File deleted successfully', 'green');
                        
                        // Refresh the engagement modal to reflect the change
                        this.showEngagementInfo(taskId, engagementId);
                    } else {
                        frappe.show_alert('Failed to delete file: ' + (response.message.error || 'Unknown error'), 'red');
                    }
                },
                error: (error) => {
                    console.error('Error deleting file:', error);
                    frappe.show_alert('Failed to delete file', 'red');
                }
            });
        }
    }
}

// Create global instance
window.EngagementManager = new EngagementManager();

// Export for module systems if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EngagementManager;
}
