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

        // Create new engagement - 使用自定义模态框而不是跳转
        modal.on('click.engagement-modal', '.pm-create-engagement, .pm-create-new-engagement', (e) => {
            e.stopPropagation();
            // 关闭当前选择器模态框
            $('.pm-engagement-modal').remove();
            // 打开自定义创建模态框
            this.showCustomEngagementCreator(taskId);
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

        // Create new engagement - 使用自定义模态框
        modal.on('click', '.pm-create-new-engagement', () => {
            // 关闭当前选择器模态框
            $('.pm-engagement-modal').remove();
            // 打开自定义创建模态框
            this.showCustomEngagementCreator(taskId);
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
        // Validate service line consistency before linking
        this.validateServiceLineConsistency(taskId, engagementId, engagementName);
    }

    // Validate service line consistency using frontend data
    async validateServiceLineConsistency(taskId, engagementId, engagementName) {
        try {
            // Get task data
            const taskResponse = await frappe.call({
                method: 'frappe.client.get',
                args: {
                    doctype: 'Task',
                    name: taskId
                }
            });

            // Get engagement data
            const engagementResponse = await frappe.call({
                method: 'frappe.client.get',
                args: {
                    doctype: 'Engagement',
                    name: engagementId
                }
            });

            if (!taskResponse.message || !engagementResponse.message) {
                // If we can't get data, proceed with linking
                this.performEngagementLink(taskId, engagementId, engagementName);
                return;
            }

            const task = taskResponse.message;
            const engagement = engagementResponse.message;

            // Get project data if task has a project
            let project = null;
            if (task.project) {
                const projectResponse = await frappe.call({
                    method: 'frappe.client.get',
                    args: {
                        doctype: 'Project',
                        name: task.project
                    }
                });
                project = projectResponse.message;
            }

            // Compare service lines
            const taskServiceLine = task.custom_service_line || '';
            const engagementServiceLine = engagement.service_line || '';
            const projectServiceLine = project ? (project.custom_service_line || '') : '';

            // Check if there's a mismatch
            let hasMismatch = false;
            let mismatchDetails = [];

            // If project has service line and engagement has service line, they should match
            if (projectServiceLine && engagementServiceLine && projectServiceLine !== engagementServiceLine) {
                hasMismatch = true;
                mismatchDetails.push('Project and Engagement service lines do not match');
            }

            // If task has service line and engagement has service line, they should match
            if (taskServiceLine && engagementServiceLine && taskServiceLine !== engagementServiceLine) {
                hasMismatch = true;
                mismatchDetails.push('Task and Engagement service lines do not match');
            }

            if (hasMismatch) {
                // Show confirmation dialog
                this.showServiceLineConfirmation(taskId, engagementId, engagementName, {
                    project_service_line: projectServiceLine,
                    task_service_line: taskServiceLine,
                    engagement_service_line: engagementServiceLine,
                    mismatch_details: mismatchDetails
                });
            } else {
                // No mismatch, proceed with linking
                this.performEngagementLink(taskId, engagementId, engagementName);
            }

        } catch (error) {
            console.warn('Service line validation failed, proceeding with link:', error);
            // If validation fails, still allow linking
            this.performEngagementLink(taskId, engagementId, engagementName);
        }
    }

    // Show service line mismatch confirmation dialog
    showServiceLineConfirmation(taskId, engagementId, engagementName, validation) {
        const confirmHtml = `
            <div class="pm-service-line-confirm-modal" style="display: block;">
                <div class="pm-modal-overlay"></div>
                <div class="pm-modal-container">
                    <div class="pm-modal-header">
                        <h3><i class="fa fa-exclamation-triangle" style="color: #ff9800;"></i> Service Line Mismatch</h3>
                    </div>
                    <div class="pm-modal-body">
                        <div class="pm-warning-content">
                            <p><strong>We detected a service line mismatch:</strong></p>
                            <div class="pm-service-line-comparison">
                                <div class="pm-comparison-row">
                                    <label>Project Service Line:</label>
                                    <span class="pm-service-value">${validation.project_service_line || 'Not set'}</span>
                                </div>
                                <div class="pm-comparison-row">
                                    <label>Engagement Service Line:</label>
                                    <span class="pm-service-value">${validation.engagement_service_line || 'Not set'}</span>
                                </div>
                                <div class="pm-comparison-row">
                                    <label>Task Service Line:</label>
                                    <span class="pm-service-value">${validation.task_service_line || 'Will inherit from project'}</span>
                                </div>
                            </div>
                            <div class="pm-mismatch-details">
                                ${validation.mismatch_details.map(detail => `<div class="pm-mismatch-item">• ${detail}</div>`).join('')}
                            </div>
                            <p class="pm-warning-text">
                                <i class="fa fa-info-circle"></i>
                                This might be a special case. Do you want to proceed with linking this engagement?
                            </p>
                        </div>
                    </div>
                    <div class="pm-modal-footer">
                        <button type="button" class="pm-btn pm-btn-secondary pm-cancel-link">Cancel</button>
                        <button type="button" class="pm-btn pm-btn-warning pm-confirm-link" 
                                data-task-id="${taskId}" 
                                data-engagement-id="${engagementId}" 
                                data-engagement-name="${engagementName}">
                            <i class="fa fa-link"></i> Link Anyway
                        </button>
                    </div>
                </div>
            </div>
        `;

        $('.pm-service-line-confirm-modal').remove();
        $('body').append(confirmHtml);

        // Bind confirmation events
        $(document).on('click', '.pm-confirm-link', (e) => {
            const $btn = $(e.target);
            const taskId = $btn.data('task-id');
            const engagementId = $btn.data('engagement-id');
            const engagementName = $btn.data('engagement-name');
            
            $('.pm-service-line-confirm-modal').remove();
            this.performEngagementLink(taskId, engagementId, engagementName);
        });

        // Bind cancel events
        $(document).on('click', '.pm-cancel-link, .pm-service-line-confirm-modal .pm-modal-overlay', () => {
            $('.pm-service-line-confirm-modal').remove();
        });
    }

    // Execute actual engagement linking
    async performEngagementLink(taskId, engagementId, engagementName) {
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

    // Custom Engagement creation modal
    showCustomEngagementCreator(taskId) {
        // Get current task info for pre-filling
        const $taskRow = $(`.pm-task-row[data-task-id="${taskId}"]`);
        const clientName = $taskRow.find('.pm-cell-client-name').text().trim();
        
        const modalHtml = `
            <div class="pm-engagement-creator-modal" style="display: block;">
                <div class="pm-modal-overlay"></div>
                <div class="pm-modal-container pm-large-modal">
                    <div class="pm-modal-header">
                        <h3><i class="fa fa-handshake-o"></i> Create New Engagement</h3>
                        <button class="pm-modal-close" type="button">
                            <i class="fa fa-times"></i>
                        </button>
                    </div>
                    <div class="pm-modal-body">
                        <form class="pm-engagement-form" data-current-client="${clientName}">
                            <div class="pm-form-row">
                                <div class="pm-form-group">
                                    <label>Customer <span class="pm-required">*</span></label>
                                    <div class="pm-customer-search-container">
                                        <input type="text" name="customer" class="pm-form-control pm-customer-search" 
                                               placeholder="Type to search customers..." 
                                               value="${clientName}" 
                                               autocomplete="off" required>
                                        <div class="pm-customer-dropdown" style="display: none;">
                                            <div class="pm-customer-loading">Loading customers...</div>
                                        </div>
                                    </div>
                                </div>
                                <div class="pm-form-group">
                                    <label>Company</label>
                                    <select name="company" class="pm-form-control">
                                        <option value="">Select Company</option>
                                        <option value="Top Figures">Top Figures</option>
                                        <option value="Top Grants">Top Grants</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div class="pm-form-row">
                                <div class="pm-form-group">
                                    <label>Service Line <span class="pm-required">*</span></label>
                                    <select name="service_line" class="pm-form-control" required>
                                        <option value="">Select Service Line</option>
                                    </select>
                                </div>
                                <div class="pm-form-group">
                                    <label>Frequency</label>
                                    <select name="frequency" class="pm-form-control">
                                        <option value="">Select Frequency</option>
                                        <option value="Annually">Annually</option>
                                        <option value="Quarterly">Quarterly</option>
                                        <option value="Monthly">Monthly</option>
                                        <option value="One-time">One-time</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div class="pm-form-row">
                                <div class="pm-form-group">
                                    <label>Fiscal Year <span class="pm-required">*</span></label>
                                    <select name="fiscal_year" class="pm-form-control" required>
                                        <option value="">Select Fiscal Year</option>
                                    </select>
                                </div>
                                <div class="pm-form-group">
                                    <label>Owner Partner</label>
                                    <select name="owner_partner" class="pm-form-control">
                                        <option value="">Select Partner</option>
                                    </select>
                                </div>
                            </div>
                        </form>
                    </div>
                    <div class="pm-modal-footer">
                        <button type="button" class="pm-btn pm-btn-secondary pm-modal-close">Cancel</button>
                        <button type="button" class="pm-btn pm-btn-primary pm-save-engagement" data-task-id="${taskId}">
                            <i class="fa fa-save"></i> Create Engagement
                        </button>
                    </div>
                </div>
            </div>
        `;

        $('.pm-engagement-creator-modal').remove();
        $('body').append(modalHtml);
        
        // Load dropdown options
        this.loadEngagementFormOptions();
        
        // Bind events
        this.bindEngagementCreatorEvents(taskId);
    }

    // Load form options
    loadEngagementFormOptions() {
        // Initialize customer search functionality
        this.initCustomerSearch();
        
        // Load all customers for search (cache them)
        this.loadCustomerCache();

        // Load Service Lines
        frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'Service Line',
                fields: ['name', 'service_name'],
                filters: { is_active: 1 }
            },
            callback: (response) => {
                if (response.message) {
                    const $select = $('select[name="service_line"]');
                    response.message.forEach(item => {
                        $select.append(`<option value="${item.name}">${item.service_name}</option>`);
                    });
                }
            }
        });

        // Load Fiscal Years
        frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'Fiscal Year',
                fields: ['name', 'year'],
                order_by: 'year_start_date desc'
            },
            callback: (response) => {
                if (response.message) {
                    const $select = $('select[name="fiscal_year"]');
                    response.message.forEach(item => {
                        $select.append(`<option value="${item.name}">${item.year}</option>`);
                    });
                }
            }
        });

        // Load Users (Partners)
        frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'User',
                fields: ['name', 'full_name'],
                filters: { enabled: 1, user_type: 'System User' }
            },
            callback: (response) => {
                if (response.message) {
                    const $select = $('select[name="owner_partner"]');
                    response.message.forEach(item => {
                        $select.append(`<option value="${item.name}">${item.full_name}</option>`);
                    });
                }
            }
        });
    }

    // Bind creation form events
    bindEngagementCreatorEvents(taskId) {
        // Save Engagement
        $(document).on('click', '.pm-save-engagement', (e) => {
            const $btn = $(e.target);
            const $form = $('.pm-engagement-form');
            
            // Collect form data
            const $customerInput = $form.find('[name="customer"]');
            const customerId = $customerInput.data('customer-id') || $customerInput.val();
            
            const formData = {
                customer: customerId,
                company: $form.find('[name="company"]').val(),
                service_line: $form.find('[name="service_line"]').val(),
                frequency: $form.find('[name="frequency"]').val(),
                fiscal_year: $form.find('[name="fiscal_year"]').val(),
                owner_partner: $form.find('[name="owner_partner"]').val()
            };

            // Validate required fields (Company is optional)
            if (!formData.customer || !formData.service_line || !formData.fiscal_year) {
                frappe.show_alert({
                    message: 'Please fill all required fields (Customer, Service Line, Fiscal Year)',
                    indicator: 'red'
                });
                return;
            }

            // Show loading state
            $btn.prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i> Creating...');

            // Create Engagement
            frappe.call({
                method: 'frappe.client.insert',
                args: {
                    doc: {
                        doctype: 'Engagement',
                        customer: formData.customer,
                        company: formData.company || '',
                        service_line: formData.service_line,
                        frequency: formData.frequency || '',
                        fiscal_year: formData.fiscal_year,
                        owner_partner: formData.owner_partner || ''
                    }
                },
                callback: (response) => {
                    if (response.message && response.message.name) {
                        // Successfully created engagement
                        const engagementId = response.message.name;
                        
                        frappe.show_alert({
                            message: 'Engagement created successfully',
                            indicator: 'green'
                        });
                        
                        // Close modal
                        $('.pm-engagement-creator-modal').remove();
                        
                        // Automatically link the new engagement to the task
                        this.performEngagementLink(taskId, engagementId, formData.customer);
                    } else {
                        frappe.show_alert({
                            message: 'Failed to create engagement',
                            indicator: 'red'
                        });
                        $btn.prop('disabled', false).html('<i class="fa fa-save"></i> Create Engagement');
                    }
                },
                error: (error) => {
                    console.error('Error creating engagement:', error);
                    frappe.show_alert({
                        message: 'Failed to create engagement',
                        indicator: 'red'
                    });
                    $btn.prop('disabled', false).html('<i class="fa fa-save"></i> Create Engagement');
                }
            });
        });

        // Close modal
        $(document).on('click', '.pm-engagement-creator-modal .pm-modal-close, .pm-engagement-creator-modal .pm-modal-overlay', () => {
            $('.pm-engagement-creator-modal').remove();
        });
    }

    // Initialize customer search functionality
    initCustomerSearch() {
        let searchTimeout;
        
        // Input event for search
        $(document).on('input', '.pm-customer-search', (e) => {
            const $input = $(e.target);
            const searchTerm = $input.val().toLowerCase();
            const $dropdown = $input.siblings('.pm-customer-dropdown');
            
            clearTimeout(searchTimeout);
            
            if (searchTerm.length < 1) {
                $dropdown.hide();
                return;
            }
            
            searchTimeout = setTimeout(() => {
                this.searchCustomers(searchTerm, $dropdown);
            }, 300);
        });

        // Focus event to show dropdown
        $(document).on('focus', '.pm-customer-search', (e) => {
            const $input = $(e.target);
            const $dropdown = $input.siblings('.pm-customer-dropdown');
            
            if ($input.val().length > 0) {
                this.searchCustomers($input.val().toLowerCase(), $dropdown);
            }
        });

        // Click outside to hide dropdown
        $(document).on('click', (e) => {
            if (!$(e.target).closest('.pm-customer-search-container').length) {
                $('.pm-customer-dropdown').hide();
            }
        });

        // Customer selection
        $(document).on('click', '.pm-customer-option', (e) => {
            const $option = $(e.target);
            const customerName = $option.data('customer-name');
            const customerDisplayName = $option.text();
            
            const $input = $option.closest('.pm-customer-search-container').find('.pm-customer-search');
            $input.val(customerDisplayName);
            $input.data('customer-id', customerName);
            
            $('.pm-customer-dropdown').hide();
        });
    }

    // Load customer cache
    loadCustomerCache() {
        if (!this.customerCache) {
            frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Customer',
                    fields: ['name', 'customer_name'],
                    limit_page_length: 0, // Get all customers
                    order_by: 'customer_name asc'
                },
                callback: (response) => {
                    if (response.message) {
                        this.customerCache = response.message;
                    }
                }
            });
        }
    }

    // Search customers in cache
    searchCustomers(searchTerm, $dropdown) {
        if (!this.customerCache) {
            $dropdown.html('<div class="pm-customer-loading">Loading customers...</div>').show();
            this.loadCustomerCache();
            return;
        }

        const filteredCustomers = this.customerCache.filter(customer => {
            const name = (customer.customer_name || customer.name).toLowerCase();
            return name.includes(searchTerm);
        });

        if (filteredCustomers.length === 0) {
            $dropdown.html('<div class="pm-customer-no-results">No customers found</div>').show();
            return;
        }

        const optionsHtml = filteredCustomers.slice(0, 10).map(customer => `
            <div class="pm-customer-option" data-customer-name="${customer.name}">
                ${customer.customer_name || customer.name}
            </div>
        `).join('');

        $dropdown.html(optionsHtml).show();
    }
}

// Create global instance
window.EngagementManager = new EngagementManager();

// Export for module systems if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EngagementManager;
}
