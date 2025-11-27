// Project Management - Modal Dialogs
// Modal dialog management for comments, reviews, and other interactions

class ModalManager {
    constructor() {
        this.utils = window.PMUtils;
    }

    // Comment System Methods
    async showCommentModal(taskId) {
        try {
            // Get task info first
            const taskResponse = await frappe.call({
                method: 'frappe.client.get',
                args: {
                    doctype: 'Task',
                    name: taskId,
                    fields: ['subject']
                }
            });

            const taskSubject = taskResponse.message ? taskResponse.message.subject : `Task ${taskId}`;
            
            // Get client name from the task row for a more professional title
            const $taskRow = $(`.pm-task-row[data-task-id="${taskId}"]`);
            const clientName = $taskRow.find('.pm-cell-client .client-display').text().trim() || 'No Client';
            
            // Create professional title: "Updates - [Client Name] - [Project Name]"
            const titleParts = taskSubject.split(' - ');
            const projectName = titleParts.length > 1 ? titleParts.slice(1).join(' - ') : taskSubject;
            const professionalTitle = `Updates - ${clientName} - ${projectName}`;
            
            // Create modal HTML
            const modalHTML = `
                <div class="pm-comment-modal" id="pm-comment-modal-${taskId}">
                    <div class="pm-comment-modal-content">
                        <div class="pm-comment-modal-header">
                            <h3 class="pm-comment-modal-title">${professionalTitle}</h3>
                            <div class="pm-comment-modal-tabs">
                                <button class="pm-comment-tab active" data-tab="comments">
                                    <i class="fa fa-comment"></i> Comments
                                </button>
                                <button class="pm-comment-tab" data-tab="activity">
                                    <i class="fa fa-history"></i> Activity Log
                                </button>
                            </div>
                            <button class="pm-comment-modal-close">
                                <i class="fa fa-times"></i>
                            </button>
                        </div>
                        <div class="pm-comment-modal-body">
                            <div class="pm-tab-content">
                                <div class="pm-comment-list pm-tab-panel active" id="pm-comment-list-${taskId}" data-tab="comments">
                                    <div class="pm-comment-loading">
                                        <i class="fa fa-spinner fa-spin"></i> Loading comments...
                                    </div>
                                </div>
                                <div class="pm-activity-list pm-tab-panel" id="pm-activity-list-${taskId}" data-tab="activity" style="display: none;">
                                    <div class="pm-activity-loading">
                                        <i class="fa fa-spinner fa-spin"></i> Loading activity...
                                    </div>
                                </div>
                            </div>
                            <div class="pm-comment-input-area">
                                <div class="pm-comment-input-container">
                                    <textarea class="pm-comment-input" placeholder="Write a comment... (Type @ to mention someone)" data-task-id="${taskId}"></textarea>
                                    <div class="pm-mention-dropdown" id="pm-mention-dropdown-${taskId}" style="display: none;">
                                        <!-- Mention suggestions will appear here -->
                                    </div>
                                </div>
                                <div class="pm-comment-input-footer">
                                    <div class="pm-comment-input-info">
                                        Press Ctrl+Enter to send • Type @ to mention
                                    </div>
                                    <button class="pm-comment-submit" data-task-id="${taskId}">
                                        Send Comment
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Remove existing modal
            $('.pm-comment-modal').remove();
            
            // Add modal to body
            $('body').append(modalHTML);
            
            // 🔧 修复大数据量下的DOM时序问题：使用requestAnimationFrame确保DOM操作完成
            requestAnimationFrame(async () => {
                const $modal = $(`#pm-comment-modal-${taskId}`);
                
                if ($modal.length === 0) {
                    console.error('❌ Comment modal not found after append!');
                    // 🔧 添加降级处理：再次尝试查找
                    setTimeout(async () => {
                        const $fallbackModal = $(`#pm-comment-modal-${taskId}`);
                        if ($fallbackModal.length > 0) {
                            console.log('✅ Fallback comment modal found:', $fallbackModal.length);
                            await this.initializeCommentModalAfterAppend($fallbackModal, taskId);
                        } else {
                            console.error('❌ Fallback comment modal also failed');
                        }
                    }, 50);
                    return;
                }
                
                await this.initializeCommentModalAfterAppend($modal, taskId);
            });
        } catch (error) {
            console.error('Error showing comment modal:', error);
        }
    }

    // 🔧 新增方法：在DOM确认存在后初始化评论模态框
    async initializeCommentModalAfterAppend($modal, taskId) {
        // Show modal
        $modal.fadeIn(200);
        
        // Load comments
        await this.loadComments(taskId);
        
        // Focus on input
        $('.pm-comment-input').focus();
        
        // Handle Ctrl+Enter and @ mentions
        $('.pm-comment-input').on('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                this.submitComment();
            } else if (e.key === 'Escape') {
                this.hideMentionDropdown(taskId);
            } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                if ($(`#pm-mention-dropdown-${taskId}`).is(':visible')) {
                    e.preventDefault();
                    this.navigateMentions(taskId, e.key === 'ArrowDown' ? 1 : -1);
                }
            } else if (e.key === 'Enter' && $(`#pm-mention-dropdown-${taskId}`).is(':visible')) {
                e.preventDefault();
                this.selectCurrentMention(taskId);
            }
        });
        
        // Handle @ mention typing
        $('.pm-comment-input').on('input', (e) => {
            this.handleMentionInput(e.target, taskId);
        });
        
        // Handle tab switching
        $('.pm-comment-tab').on('click', (e) => {
            const tab = $(e.currentTarget).data('tab');
            this.switchCommentTab(taskId, tab);
        });
    }
    
    async loadComments(taskId) {
        if (!taskId) {
            console.error('Task ID is required to load comments');
            return;
        }
        
        const $commentList = $(`#pm-comment-list-${taskId}`);
        
        // 确保元素存在
        if ($commentList.length === 0) {
            console.error(`Comment list element not found for task: ${taskId}`);
            return;
        }
        
        try {
            // 确保frappe可用
            if (!window.frappe || !frappe.call || !frappe.csrf_token) {
                console.warn('Frappe not ready, retrying in 500ms...');
                setTimeout(() => this.loadComments(taskId), 500);
                return;
            }
            
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.get_task_comments',
                args: {
                    task_id: taskId
                }
            });
            
            if (response.message && response.message.success) {
                const comments = response.message.comments || [];
                this.renderComments(taskId, comments);
                
                // Update comment count in the table
                const commentCount = response.message.count || comments.length;
                this.updateCommentCount(taskId, commentCount);
            } else {
                throw new Error(response.message?.error || 'Failed to load comments');
            }
        } catch (error) {
            console.error('Error loading comments:', error);
            $commentList.html(`
                <div class="pm-comment-empty">
                    <i class="fa fa-exclamation-triangle"></i>
                    <h4>Failed to load comments</h4>
                    <p>${error.message || 'Please try again later'}</p>
                    <button class="pm-btn pm-btn-secondary" onclick="window.ModalManager.loadComments('${taskId}')">
                        <i class="fa fa-refresh"></i> Retry
                    </button>
                </div>
            `);
        }
    }
    
    renderComments(taskId, comments) {
        const $commentList = $(`#pm-comment-list-${taskId}`);
        
        // 确保元素存在
        if ($commentList.length === 0) {
            console.error(`Comment list element not found for task: ${taskId}`);
            return;
        }
        
        if (!comments || comments.length === 0) {
            $commentList.html(`
                <div class="pm-comment-empty">
                    <i class="fa fa-comment-o"></i>
                    <h4>No comments yet</h4>
                    <p>Be the first to add a comment!</p>
                </div>
            `);
            return;
        }
        
        let html = '';
        comments.forEach(comment => {
            const timeAgo = this.utils.formatTimeAgo(comment.creation);
            const initials = this.utils.getInitials(comment.comment_by);
            const avatarColor = this.utils.getAvatarColor(comment.comment_by);
            
            html += `
                <div class="pm-comment-item" data-comment-id="${comment.name}">
                    <div class="pm-comment-avatar" style="background: ${avatarColor}">
                        ${initials}
                    </div>
                    <div class="pm-comment-content">
                        <div class="pm-comment-header">
                            <span class="pm-comment-author">${comment.comment_by}</span>
                            <span class="pm-comment-time">${timeAgo}</span>
                        </div>
                        <div class="pm-comment-text">${this.utils.escapeHtml(comment.content)}</div>
                        <div class="pm-comment-actions">
                            <button class="pm-comment-action" data-action="reply" data-comment-id="${comment.name}">
                                Reply
                            </button>
                            ${comment.can_edit ? `
                                <button class="pm-comment-action" data-action="edit" data-comment-id="${comment.name}">
                                    Edit
                                </button>
                            ` : ''}
                            ${comment.can_delete ? `
                                <button class="pm-comment-action" data-action="delete" data-comment-id="${comment.name}">
                                    Delete
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        });
        
        $commentList.html(html);
    }
    
    async submitComment() {
        const $input = $('.pm-comment-input');
        const taskId = $input.data('task-id');
        const content = $input.val().trim();
        
        if (!content) {
            frappe.show_alert({
                message: 'Please enter a comment',
                indicator: 'orange'
            });
            return;
        }
        
        try {
            // Disable submit button
            const $submitBtn = $('.pm-comment-submit');
            $submitBtn.prop('disabled', true).text('Sending...');
            
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.add_task_comment',
                args: {
                    task_id: taskId,
                    comment_content: content
                }
            });
            
            if (response.message && response.message.success) {
                // Clear input
                $input.val('');
                
                // Reload comments
                await this.loadComments(taskId);
                
                // Update comment count in table
                this.updateCommentCount(taskId, response.message.comment_count);
                
                frappe.show_alert({
                    message: 'Comment added successfully',
                    indicator: 'green'
                });
            } else {
                throw new Error(response.message?.error || 'Failed to add comment');
            }
        } catch (error) {
            console.error('Error submitting comment:', error);
            frappe.show_alert({
                message: 'Failed to add comment: ' + error.message,
                indicator: 'red'
            });
        } finally {
            // Re-enable submit button
            $('.pm-comment-submit').prop('disabled', false).text('Send Comment');
        }
    }
    
    async deleteComment(commentId) {
        const confirmed = await this.utils.showConfirmDialog(
            'Delete Comment',
            'Are you sure you want to delete this comment? This action cannot be undone.'
        );
        
        if (!confirmed) return;
        
        try {
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.delete_task_comment',
                args: {
                    comment_id: commentId
                }
            });
            
            if (response.message && response.message.success) {
                // Remove comment from UI
                $(`.pm-comment-item[data-comment-id="${commentId}"]`).fadeOut(300, function() {
                    $(this).remove();
                });
                
                // Update comment count
                const taskId = $('.pm-comment-input').data('task-id');
                this.updateCommentCount(taskId, response.message.comment_count);
                
                frappe.show_alert({
                    message: 'Comment deleted',
                    indicator: 'orange'
                });
            } else {
                throw new Error(response.message?.error || 'Failed to delete comment');
            }
        } catch (error) {
            console.error('Error deleting comment:', error);
            frappe.show_alert({
                message: 'Failed to delete comment',
                indicator: 'red'
            });
        }
    }
    
    closeCommentModal() {
        $('.pm-comment-modal').fadeOut(200, function() {
            $(this).remove();
        });
    }

    // Review Note Modal
    showReviewNoteModal(taskId) {
        if (!taskId) {
            frappe.show_alert({message: 'Task ID not found', indicator: 'red'});
            return;
        }

        const professionalTitle = `Review Notes - Task ${taskId}`;
        
        const modalHTML = `
            <div class="pm-review-modal-overlay">
                <div class="pm-review-modal" id="pm-review-modal-${taskId}">
                    <div class="pm-review-modal-content">
                        <div class="pm-review-modal-header">
                            <h3 class="pm-review-modal-title">${professionalTitle}</h3>
                            <div class="pm-review-modal-tabs">
                                <button class="pm-review-tab active" data-tab="reviews">
                                    <i class="fa fa-clipboard"></i> Review Notes
                                </button>
                                <button class="pm-review-tab" data-tab="activity">
                                    <i class="fa fa-history"></i> Activity Log
                                </button>
                            </div>
                            <button class="pm-review-modal-close">
                                <i class="fa fa-times"></i>
                            </button>
                        </div>
                        <div class="pm-review-modal-body">
                            <div class="pm-tab-content">
                                <div class="pm-review-list pm-tab-panel active" id="pm-review-list-${taskId}" data-tab="reviews">
                                    <div class="pm-review-loading">
                                        <i class="fa fa-spinner fa-spin"></i> Loading review notes...
                                    </div>
                                </div>
                                <div class="pm-activity-log pm-tab-panel" id="pm-activity-log-${taskId}" data-tab="activity">
                                    <div class="pm-activity-loading">
                                        <i class="fa fa-spinner fa-spin"></i> Loading activity log...
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="pm-review-input-section" id="pm-review-input-${taskId}">
                            <div class="pm-review-input-area">
                                <div class="pm-review-input-container">
                                    <textarea class="pm-review-input" placeholder="Add a review note..." data-task-id="${taskId}"></textarea>
                                </div>
                                <div class="pm-review-input-footer">
                                    <div class="pm-review-input-info">
                                        Press Ctrl+Enter to send
                                    </div>
                                    <button class="pm-review-submit" data-task-id="${taskId}">
                                        Add Review Note
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modals
        $('.pm-review-modal-overlay').remove();
        
        // Add modal to body
        $('body').append(modalHTML);

        // 🔧 修复大数据量下的DOM时序问题：使用requestAnimationFrame确保DOM操作完成
        requestAnimationFrame(() => {
            const $modal = $(`#pm-review-modal-${taskId}`);
            
            if ($modal.length === 0) {
                console.error('❌ Review modal not found after append!');
                // 🔧 添加降级处理：再次尝试查找
                setTimeout(() => {
                    const $fallbackModal = $(`#pm-review-modal-${taskId}`);
                    if ($fallbackModal.length > 0) {
                        console.log('✅ Fallback review modal found:', $fallbackModal.length);
                        this.initializeReviewModalAfterAppend($fallbackModal, taskId);
                    } else {
                        console.error('❌ Fallback review modal also failed');
                    }
                }, 50);
                return;
            }
            
            this.initializeReviewModalAfterAppend($modal, taskId);
        });
        
        // Bind events
        this.bindReviewModalEvents(taskId);
    }

    // 🔧 新增方法：在DOM确认存在后初始化审核模态框
    initializeReviewModalAfterAppend($modal, taskId) {
        // Show modal
        $modal.fadeIn(200);
        
        // Load review notes and check permissions
        this.loadReviewNotes(taskId);
        this.checkReviewPermissions(taskId);
        
        // Focus on input
        $('.pm-review-input').focus();
    }

    async loadReviewNotes(taskId) {
        try {
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.get_review_notes',
                args: { task_id: taskId }
            });

            if (response.message && response.message.success) {
                this.displayReviewNotes(taskId, response.message.review_notes);
            } else {
                this.showReviewNotesError(taskId, response.message?.error || 'Failed to load review notes');
            }
        } catch (error) {
            console.error('Error loading review notes:', error);
            this.showReviewNotesError(taskId, 'Network error occurred');
        }
    }

    displayReviewNotes(taskId, reviewNotes) {
        const $reviewList = $(`#pm-review-list-${taskId}`);
        
        if (!reviewNotes || reviewNotes.length === 0) {
            $reviewList.html(`
                <div class="pm-review-empty">
                    <i class="fa fa-clipboard"></i>
                    <h4>No review notes yet</h4>
                    <p>Add the first review note below!</p>
                </div>
            `);
            return;
        }

        const reviewsHTML = reviewNotes.map(review => {
            const timeAgo = this.utils.formatTimeAgo(review.creation);
            const avatarColor = this.utils.getAvatarColor(review.owner);
            const initials = this.utils.getInitials(review.created_by || review.owner);
            
            return `
                <div class="pm-review-item" data-review-id="${review.name}">
                    <div class="pm-review-avatar" style="background: ${avatarColor}">
                        ${initials}
                    </div>
                    <div class="pm-review-content">
                        <div class="pm-review-header">
                            <span class="pm-review-author">${review.created_by || review.owner}</span>
                            <span class="pm-review-time">${timeAgo}</span>
                        </div>
                        <div class="pm-review-text">${this.utils.escapeHtml(review.note)}</div>
                    </div>
                </div>
            `;
        }).join('');

        $reviewList.html(reviewsHTML);
    }

    showReviewNotesError(taskId, error) {
        const $reviewList = $(`#pm-review-list-${taskId}`);
        $reviewList.html(`
            <div class="pm-review-empty">
                <i class="fa fa-exclamation-triangle"></i>
                <h4>Failed to load review notes</h4>
                <p>${error}</p>
            </div>
        `);
    }

    async checkReviewPermissions(taskId) {
        try {
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.check_review_permissions',
                args: { task_id: taskId }
            });

            const canAddReview = response.message && response.message.can_add_review;
            const $inputSection = $(`#pm-review-input-${taskId}`);
            
            if (!canAddReview) {
                $inputSection.hide();
            } else {
                $inputSection.show();
            }
        } catch (error) {
            console.error('Error checking permissions:', error);
            // Default to hiding input section if error
            $(`#pm-review-input-${taskId}`).hide();
        }
    }

    bindReviewModalEvents(taskId) {
        // Close modal events
        $('.pm-review-modal-close').on('click', () => {
            this.closeReviewModal();
        });

        $('.pm-review-modal-overlay').on('click', (e) => {
            if (e.target === e.currentTarget) {
                this.closeReviewModal();
            }
        });

        // Tab switching
        $('.pm-review-tab').on('click', (e) => {
            const tab = $(e.currentTarget).data('tab');
            this.switchReviewTab(taskId, tab);
        });

        // Submit review note
        $('.pm-review-submit').on('click', () => {
            this.submitReviewNote(taskId);
        });

        // Ctrl+Enter to submit
        $('.pm-review-input').on('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                this.submitReviewNote(taskId);
            }
        });
    }

    closeReviewModal() {
        $('.pm-review-modal-overlay').fadeOut(200, function() {
            $(this).remove();
        });
    }

    switchReviewTab(taskId, tab) {
        // Update tab buttons
        $('.pm-review-tab').removeClass('active');
        $(`.pm-review-tab[data-tab="${tab}"]`).addClass('active');
        
        // Update tab panels
        $('.pm-tab-panel').removeClass('active');
        $(`#pm-${tab === 'reviews' ? 'review-list' : 'activity-log'}-${taskId}`).addClass('active');
        
        // Load activity log if needed
        if (tab === 'activity' && !$(`#pm-activity-log-${taskId}`).hasClass('loaded')) {
            this.loadActivityLog(taskId);
        }
    }

    async submitReviewNote(taskId) {
        const $input = $('.pm-review-input');
        const content = $input.val().trim();
        
        if (!content) {
            frappe.show_alert({
                message: 'Please enter a review note',
                indicator: 'red'
            });
            return;
        }

        try {
            const $submitBtn = $('.pm-review-submit');
            $submitBtn.prop('disabled', true).text('Adding...');
            
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.add_review_note',
                args: {
                    task_id: taskId,
                    note: content
                }
            });

            if (response.message && response.message.success) {
                // Clear input
                $input.val('');
                
                // Reload review notes
                await this.loadReviewNotes(taskId);
                
                // Update review count in table
                this.updateReviewCount(taskId, response.message.review_count);
                
                frappe.show_alert({
                    message: 'Review note added successfully',
                    indicator: 'green'
                });
            } else {
                throw new Error(response.message?.error || 'Failed to add review note');
            }
        } catch (error) {
            console.error('Error submitting review note:', error);
            frappe.show_alert({
                message: 'Error: ' + error.message,
                indicator: 'red'
            });
        } finally {
            $('.pm-review-submit').prop('disabled', false).text('Add Review Note');
        }
    }

    updateReviewCount(taskId, count) {
        // Find all review note indicators for this task (both in HTML template and dynamic rows)
        const $indicators = $(`.pm-review-note-indicator[data-task-id="${taskId}"]`);
        
        console.log(`Updating review count for task ${taskId}: ${count} notes, found ${$indicators.length} indicators`);
        
        $indicators.each(function() {
            const $indicator = $(this);
            if (count > 0) {
                $indicator.removeClass('no-notes').addClass('has-notes');
                $indicator.find('i').removeClass('fa-times-circle').addClass('fa-check-circle');
                $indicator.find('span').text(`${count} note${count !== 1 ? 's' : ''}`);
                $indicator.attr('title', 'Click to view all Review Notes');
            } else {
                $indicator.removeClass('has-notes').addClass('no-notes');
                $indicator.find('i').removeClass('fa-check-circle').addClass('fa-times-circle');
                $indicator.find('span').text('none');
                $indicator.attr('title', 'Click to add Review Note');
            }
        });
    }

    async refreshReviewNoteCounts() {
        // Get all task IDs from the page
        const taskIds = [];
        $('.pm-task-row[data-task-id]').each(function() {
            const taskId = $(this).data('task-id');
            if (taskId) {
                taskIds.push(taskId);
            }
        });

        if (taskIds.length === 0) return;

        try {
            // Get review counts for all tasks at once
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.get_bulk_review_counts',
                args: { task_ids: taskIds }
            });

            if (response.message && response.message.success) {
                const reviewCounts = response.message.review_counts;
                
                // Update each task's review note display
                Object.keys(reviewCounts).forEach(taskId => {
                    this.updateReviewCount(taskId, reviewCounts[taskId]);
                });
                
                console.log('Review note counts refreshed for', Object.keys(reviewCounts).length, 'tasks');
            }
        } catch (error) {
            console.warn('Could not refresh review note counts:', error);
        }
    }
    
    updateCommentCount(taskId, count) {
        const $indicator = $(`.pm-comment-indicator[data-task-id="${taskId}"]`);
        
        if ($indicator.length === 0) {
            console.warn(`Comment indicator not found for task ${taskId}`);
            return;
        }
        
        const $countSpan = $indicator.find('.pm-comment-count');
        const validCount = Math.max(0, parseInt(count) || 0); // Ensure non-negative integer
        
        $countSpan.text(validCount);
        
        if (validCount > 0) {
            $indicator.addClass('has-comments');
            $indicator.find('i').removeClass('fa-comment-o').addClass('fa-comment');
        } else {
            $indicator.removeClass('has-comments');
            $indicator.find('i').removeClass('fa-comment').addClass('fa-comment-o');
        }
    }

    // Tab Switching and Activity Log
    switchCommentTab(taskId, tab) {
        // Update tab buttons
        $('.pm-comment-tab').removeClass('active');
        $(`.pm-comment-tab[data-tab="${tab}"]`).addClass('active');
        
        // Update tab panels - 使用正确的选择器
        $('.pm-tab-panel').removeClass('active').hide();
        
        if (tab === 'comments') {
            $(`#pm-comment-list-${taskId}`).addClass('active').show();
            $('.pm-comment-input-area').show();
        } else if (tab === 'activity') {
            $(`#pm-activity-list-${taskId}`).addClass('active').show();
            $('.pm-comment-input-area').hide();
            // Load activity log if needed
            this.loadActivityLog(taskId);
        }
    }
    
    async loadActivityLog(taskId) {
        const $activityList = $(`#pm-activity-list-${taskId}`);
        
        try {
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.get_task_activity_log',
                args: {
                    task_id: taskId
                }
            });
            
            if (response.message && response.message.success) {
                const activities = response.message.activities || [];
                this.renderActivityLog(taskId, activities);
            } else {
                throw new Error(response.message?.error || 'Failed to load activity log');
            }
        } catch (error) {
            console.error('Error loading activity log:', error);
            $activityList.html(`
                <div class="pm-comment-empty">
                    <i class="fa fa-exclamation-triangle"></i>
                    <h4>Failed to load activity log</h4>
                    <p>Please try again later</p>
                </div>
            `);
        }
    }
    
    renderActivityLog(taskId, activities) {
        const $activityList = $(`#pm-activity-list-${taskId}`);
        
        if (!activities || activities.length === 0) {
            $activityList.html(`
                <div class="pm-comment-empty">
                    <i class="fa fa-history"></i>
                    <h4>No activity yet</h4>
                    <p>Task activity will appear here</p>
                </div>
            `);
            return;
        }
        
        let html = '';
        activities.forEach(activity => {
            const timeAgo = this.utils.formatTimeAgo(activity.creation);
            const initials = this.utils.getInitials(activity.owner);
            const avatarColor = this.utils.getAvatarColor(activity.owner);
            
            html += `
                <div class="pm-activity-item">
                    <div class="pm-comment-avatar" style="background: ${avatarColor}">
                        ${initials}
                    </div>
                    <div class="pm-comment-content">
                        <div class="pm-comment-header">
                            <span class="pm-comment-author">${activity.owner}</span>
                            <span class="pm-comment-time">${timeAgo}</span>
                        </div>
                        <div class="pm-activity-description">
                            <i class="fa fa-edit"></i>
                            ${this.utils.formatActivityDescription(activity)}
                        </div>
                    </div>
                </div>
            `;
        });
        
        $activityList.html(html);
    }

    // @ Mention System
    handleMentionInput(textarea, taskId) {
        const text = textarea.value;
        const cursorPosition = textarea.selectionStart;
        
        // Find @ symbol before cursor
        const textBeforeCursor = text.substring(0, cursorPosition);
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');
        
        if (lastAtIndex === -1) {
            this.hideMentionDropdown(taskId);
            return;
        }
        
        // Check if @ is at start or after whitespace
        const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' ';
        if (charBeforeAt !== ' ' && charBeforeAt !== '\n') {
            this.hideMentionDropdown(taskId);
            return;
        }
        
        // Get text after @
        const mentionText = textBeforeCursor.substring(lastAtIndex + 1);
        
        // Check if there's a space after @ (which would end the mention)
        if (mentionText.includes(' ') || mentionText.includes('\n')) {
            this.hideMentionDropdown(taskId);
            return;
        }
        
        // Show mention suggestions
        this.showMentionSuggestions(taskId, mentionText, lastAtIndex);
    }
    
    async showMentionSuggestions(taskId, query, atPosition) {
        const $dropdown = $(`#pm-mention-dropdown-${taskId}`);
        
        try {
            // Get users for mentions
            const response = await frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'User',
                    fields: ['name', 'email', 'full_name'],
                    filters: [
                        ['enabled', '=', 1],
                        ['user_type', '=', 'System User'],
                        ['name', '!=', 'Guest']
                    ],
                    limit_page_length: 10,
                    order_by: 'full_name asc'
                }
            });
            
            if (response.message) {
                let users = response.message;
                
                // Filter by query if provided
                if (query) {
                    users = users.filter(user => 
                        (user.full_name || '').toLowerCase().includes(query.toLowerCase()) ||
                        user.email.toLowerCase().includes(query.toLowerCase())
                    );
                }
                
                this.renderMentionSuggestions(taskId, users, atPosition);
            }
        } catch (error) {
            console.error('Error loading mention suggestions:', error);
        }
    }
    
    renderMentionSuggestions(taskId, users, atPosition) {
        const $dropdown = $(`#pm-mention-dropdown-${taskId}`);
        
        if (!users || users.length === 0) {
            $dropdown.hide();
            return;
        }
        
        let html = '';
        users.forEach((user, index) => {
            const displayName = user.full_name || user.email;
            const initials = this.utils.getInitials(displayName);
            const avatarColor = this.utils.getAvatarColor(displayName);
            
            html += `
                <div class="pm-mention-item ${index === 0 ? 'selected' : ''}" 
                     data-email="${user.email}" 
                     data-name="${displayName}"
                     data-index="${index}">
                    <div class="pm-mention-avatar" style="background: ${avatarColor}">
                        ${initials}
                    </div>
                    <div class="pm-mention-info">
                        <div class="pm-mention-name">${displayName}</div>
                        <div class="pm-mention-email">${user.email}</div>
                    </div>
                </div>
            `;
        });
        
        $dropdown.html(html).show();
        
        // Store position for insertion
        $dropdown.data('at-position', atPosition);
        
        // Handle clicks
        $dropdown.off('click').on('click', '.pm-mention-item', (e) => {
            const $item = $(e.currentTarget);
            this.insertMention(taskId, $item.data('email'), $item.data('name'));
        });
    }
    
    navigateMentions(taskId, direction) {
        const $dropdown = $(`#pm-mention-dropdown-${taskId}`);
        const $items = $dropdown.find('.pm-mention-item');
        const $selected = $items.filter('.selected');
        
        if ($items.length === 0) return;
        
        let newIndex = 0;
        if ($selected.length > 0) {
            const currentIndex = $selected.data('index');
            newIndex = currentIndex + direction;
            
            // Wrap around
            if (newIndex < 0) newIndex = $items.length - 1;
            if (newIndex >= $items.length) newIndex = 0;
        }
        
        $items.removeClass('selected');
        $items.eq(newIndex).addClass('selected');
    }
    
    selectCurrentMention(taskId) {
        const $dropdown = $(`#pm-mention-dropdown-${taskId}`);
        const $selected = $dropdown.find('.pm-mention-item.selected');
        
        if ($selected.length > 0) {
            this.insertMention(taskId, $selected.data('email'), $selected.data('name'));
        }
    }
    
    insertMention(taskId, email, name) {
        const $textarea = $('.pm-comment-input');
        const text = $textarea.val();
        const cursorPosition = $textarea[0].selectionStart;
        const $dropdown = $(`#pm-mention-dropdown-${taskId}`);
        const atPosition = $dropdown.data('at-position');
        
        // Replace from @ to cursor with mention
        const beforeAt = text.substring(0, atPosition);
        const afterCursor = text.substring(cursorPosition);
        const mention = `@${name} `;
        
        const newText = beforeAt + mention + afterCursor;
        const newCursorPos = beforeAt.length + mention.length;
        
        $textarea.val(newText);
        $textarea[0].setSelectionRange(newCursorPos, newCursorPos);
        $textarea.focus();
        
        this.hideMentionDropdown(taskId);
    }
    
    hideMentionDropdown(taskId) {
        $(`#pm-mention-dropdown-${taskId}`).hide();
    }
}

// Create global instance
window.ModalManager = new ModalManager();

// Export for module systems if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModalManager;
}
