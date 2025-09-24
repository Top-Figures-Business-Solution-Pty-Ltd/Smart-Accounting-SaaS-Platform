// Project Management - Utility Functions
// Common helper functions for date, API, formatting, etc.

class PMUtils {
    constructor() {
        this.userCache = {};
    }

    // Time and date utilities
    formatTimeAgo(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return date.toLocaleDateString();
    }

    // Text utilities
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getInitials(name) {
        if (!name) return '?';
        const parts = name.split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }

    // Color utilities
    getAvatarColor(name) {
        const colors = [
            '#0073ea', '#00c875', '#ff5ac4', '#ffcb00', '#a25ddc',
            '#ff642e', '#66ccff', '#bb3354', '#9cd326', '#784bd1'
        ];
        let hash = 0;
        for (let i = 0; i < (name || '').length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    }

    getPersonColor(email) {
        // Generate consistent color based on email
        const colors = ['#0073ea', '#00c875', '#fdab3d', '#e2445c', '#a25ddc', '#ff5ac4'];
        let hash = 0;
        for (let i = 0; i < email.length; i++) {
            hash = email.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    }

    // Status utilities
    getStatusClass(status) {
        // Convert status to CSS-friendly class name
        return status.toLowerCase().replace(/[^a-z0-9]/g, '-');
    }

    applyStatusColor($badge, status) {
        const colors = [
            'var(--monday-orange)',
            'var(--monday-blue)', 
            'var(--monday-green)',
            'var(--monday-red)',
            'var(--monday-purple)',
            'var(--monday-pink)',
            '#9333ea', '#059669', '#dc2626', '#ea580c', '#7c3aed', '#0891b2'
        ];
        
        const statusOptions = window.projectManagement?.statusOptions || ['Open', 'Working', 'Completed', 'Cancelled'];
        const statusIndex = statusOptions.indexOf(status);
        const color = colors[statusIndex % colors.length];
        
        $badge.css('background-color', color);
    }

    // User utilities
    async getRealUserInfo(email) {
        try {
            // Initialize user cache if not exists
            if (!this.userCache) {
                this.userCache = {};
            }
            
            // Return cached info if available
            if (this.userCache[email]) {
                return this.userCache[email];
            }
            
            // Fetch real user info from server
            const response = await frappe.call({
                method: 'frappe.client.get',
                args: {
                    doctype: 'User',
                    name: email
                }
            });
            
            if (response.message) {
                const userInfo = {
                    full_name: response.message.full_name || email,
                    email: email,
                    user_image: response.message.user_image
                };
                
                // Cache the result
                this.userCache[email] = userInfo;
                return userInfo;
            }
            
            // Fallback to email-based name
            return this.getUserInfoSync(email);
            
        } catch (error) {
            console.warn('Could not fetch user info for', email, error);
            return this.getUserInfoSync(email);
        }
    }

    getUserInfoSync(email) {
        // Try to get real user info from cache or generate from email
        try {
            // Check if we have user info in our cache
            if (this.userCache && this.userCache[email]) {
                return this.userCache[email];
            }
            
            // Generate from email as fallback
            return {
                full_name: email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                email: email
            };
        } catch (error) {
            return {
                full_name: email,
                email: email
            };
        }
    }

    getUserRole(email) {
        const roleMap = {
            'admin': 'Administrator',
            'manager': 'Manager', 
            'partner': 'Partner',
            'senior': 'Senior',
            'junior': 'Junior'
        };
        
        const emailLower = email.toLowerCase();
        for (const [key, role] of Object.entries(roleMap)) {
            if (emailLower.includes(key)) {
                return role;
            }
        }
        return 'Team Member';
    }

    // URL utilities
    getCurrentView() {
        // Get current view from URL parameters or default to 'main'
        const urlParams = new URLSearchParams(window.location.search);
        const view = urlParams.get('view') || 'main';
        
        // Decode URL-encoded partition names
        try {
            return decodeURIComponent(view);
        } catch (e) {
            console.warn('Error decoding view parameter:', e);
            return view;
        }
    }

    // Dialog utilities
    showConfirmDialog(title, message) {
        return new Promise((resolve) => {
            frappe.confirm(
                message,
                () => resolve(true),
                () => resolve(false),
                title
            );
        });
    }

    closeConfirmDialog() {
        // Close any open confirmation dialogs
        $('.modal.fade.in, .modal.show').modal('hide');
        $('.modal-backdrop').remove();
        $('body').removeClass('modal-open');
        
        // Also try Frappe's dialog close methods
        if (frappe.cur_dialog) {
            frappe.cur_dialog.hide();
        }
    }

    // Field label utilities
    getFieldLabel(fieldName) {
        const fieldLabels = {
            'status': 'Status',
            'priority': 'Priority',
            'custom_client': 'Client',
            'custom_tftg': 'TF/TG',
            'custom_softwares': 'Software',
            'custom_target_month': 'Target Month',
            'custom_budget_planning': 'Budget',
            'custom_actual_billing': 'Actual',
            'custom_action_person': 'Action Person',
            'custom_preparer': 'Preparer',
            'custom_reviewer': 'Reviewer',
            'custom_partner': 'Partner',
            'subject': 'Task Name',
            'description': 'Description'
        };
        
        return fieldLabels[fieldName] || fieldName;
    }

    formatActivityDescription(activity) {
        const data = activity.data ? JSON.parse(activity.data) : {};
        
        if (data.changed && data.changed.length > 0) {
            const changes = data.changed.map(change => {
                const fieldLabel = this.getFieldLabel(change[0]);
                const oldValue = change[1] || 'Empty';
                const newValue = change[2] || 'Empty';
                return `Changed <strong>${fieldLabel}</strong> from "${oldValue}" to "${newValue}"`;
            });
            return changes.join('<br>');
        }
        
        return 'Task updated';
    }

    // Contact action utilities
    handleContactAction(action, contact) {
        switch(action) {
            case 'email':
                window.open(`mailto:${contact}`);
                break;
            case 'phone':
                window.open(`tel:${contact}`);
                break;
            default:
                frappe.show_alert({message: 'Contact action completed', indicator: 'blue'});
        }
    }

    // Task info utilities
    async getTaskInfo(taskId) {
        try {
            const response = await frappe.call({
                method: 'frappe.client.get',
                args: {
                    doctype: 'Task',
                    name: taskId
                }
            });
            return response.message;
        } catch (error) {
            console.error('Error fetching task info:', error);
            return null;
        }
    }

    // People extraction utilities
    extractPeopleFromCell($cell, peopleMap, role) {
        try {
            // Extract people from avatar cells
            $cell.find('.pm-avatar').each((index, avatar) => {
                try {
                    const $avatar = $(avatar);
                    const fullName = $avatar.attr('title') || '';
                    const initials = $avatar.text() || '';
                    
                    if (fullName && fullName !== '-' && fullName.trim() !== '') {
                        const email = fullName.includes('@') ? fullName : `${fullName.toLowerCase().replace(/\s+/g, '.')}@company.com`;
                        
                        if (!peopleMap.has(email)) {
                            peopleMap.set(email, {
                                email: email,
                                name: fullName,
                                initials: initials,
                                roles: [role]
                            });
                        } else {
                            const existing = peopleMap.get(email);
                            if (existing.roles && !existing.roles.includes(role)) {
                                existing.roles.push(role);
                            }
                        }
                    }
                } catch (avatarError) {
                    console.log('Error processing avatar:', avatarError);
                }
            });
        } catch (cellError) {
            console.log('Error processing cell:', cellError);
        }
    }
}

// Create global instance
window.PMUtils = new PMUtils();

// Export for module systems if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PMUtils;
}