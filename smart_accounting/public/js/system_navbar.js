// Smart Accounting System Navbar JavaScript
(function() {
    'use strict';
    
    // Dev System Access Manager
    window.saDevAccess = {
        requestAccess: function() {
            const password = prompt('Enter developer password to access ERPNext system:');
            
            if (!password) {
                return;
            }
            
            // console.log('Dev access request - Password entered:', password, 'Length:', password.length);
            
            // Use direct fetch method for more reliable parameter passing
            fetch('/api/method/smart_accounting.www.project_management.index.grant_dev_access', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-Frappe-CSRF-Token': window.frappe?.csrf_token || ''
                },
                body: `password=${encodeURIComponent(password)}`
            })
            .then(response => response.json())
            .then(data => {
                // console.log('Backend response:', data);
                if (data.message && data.message.success) {
                    this.showMessage('Developer access granted! Redirecting to ERPNext system...', 'success');
                    // Redirect to ERPNext after short delay
                    setTimeout(() => {
                        window.location.href = '/app';
                    }, 1500);
                } else {
                    this.showMessage(data.message?.message || 'Invalid password', 'error');
                    // console.log('Access denied:', data.message);
                }
            })
            .catch(error => {
                console.error('Dev access error:', error);
                this.showMessage('Error requesting developer access', 'error');
            });
        },
        
        showMessage: function(message, type = 'info') {
            // Create a simple message display
            const messageDiv = document.createElement('div');
            messageDiv.style.cssText = `
                position: fixed;
                top: 80px;
                right: 20px;
                background: ${type === 'error' ? '#f8d7da' : type === 'success' ? '#d4edda' : '#d1ecf1'};
                color: ${type === 'error' ? '#721c24' : type === 'success' ? '#155724' : '#0c5460'};
                padding: 12px 16px;
                border-radius: 6px;
                border: 1px solid ${type === 'error' ? '#f5c6cb' : type === 'success' ? '#c3e6cb' : '#bee5eb'};
                z-index: 1002;
                max-width: 300px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                font-size: 14px;
            `;
            messageDiv.textContent = message;
            
            document.body.appendChild(messageDiv);
            
            // Auto remove after 3 seconds
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.parentNode.removeChild(messageDiv);
                }
            }, 3000);
        }
    };
    
    // User Profile Management
    window.saUserProfile = {
        isOpen: false,
        overlay: null,
        
        init: function() {
            this.createOverlay();
            this.loadUserInfo();
            this.bindEvents();
            this.bindButtonEvents(); // Add explicit button event binding
        },
        
        createOverlay: function() {
            this.overlay = document.createElement('div');
            this.overlay.className = 'sa-profile-overlay';
            this.overlay.addEventListener('click', () => this.close());
            document.body.appendChild(this.overlay);
        },
        
        bindEvents: function() {
            // Close on escape key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isOpen) {
                    this.close();
                }
            });
            
            // Close when clicking outside
            document.addEventListener('click', (e) => {
                const profileDropdown = document.querySelector('.sa-user-profile-dropdown');
                const profileMenu = document.querySelector('.sa-profile-menu');
                
                // Don't close if clicking inside the profile dropdown or menu
                if (this.isOpen && profileDropdown && profileMenu) {
                    const isInsideDropdown = profileDropdown.contains(e.target);
                    const isInsideMenu = profileMenu.contains(e.target);
                    const isProfileButton = e.target.closest('.sa-profile-action, .sa-profile-logout');
                    
                    // Only close if clicking completely outside, not on buttons inside the menu
                    if (!isInsideDropdown && !isInsideMenu && !isProfileButton) {
                        this.close();
                    }
                }
            });
        },
        
        bindButtonEvents: function() {
            // Add event listeners directly to buttons to ensure they work
            setTimeout(() => {
                // Wait for DOM to be ready
                const editBtn = document.querySelector('.sa-profile-action[onclick*="editProfile"]');
                const passwordBtn = document.querySelector('.sa-profile-action[onclick*="changePassword"]');
                const settingsBtn = document.querySelector('.sa-profile-action[onclick*="viewSettings"]');
                const logoutBtn = document.querySelector('.sa-profile-logout[onclick*="logout"]');
                
                if (editBtn) {
                    editBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        // console.log('Edit Profile button clicked via event listener');
                        this.editProfile();
                    });
                }
                
                if (passwordBtn) {
                    passwordBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        // console.log('Change Password button clicked via event listener');
                        this.changePassword();
                    });
                }
                
                if (settingsBtn) {
                    settingsBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        // console.log('Settings button clicked via event listener');
                        this.viewSettings();
                    });
                }
                
                if (logoutBtn) {
                    logoutBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        // console.log('Logout button clicked via event listener');
                        this.logout();
                    });
                }
            }, 100);
        },
        
        toggle: function() {
            if (this.isOpen) {
                this.close();
            } else {
                this.open();
            }
        },
        
        open: function() {
            const menu = document.getElementById('sa-profile-menu');
            if (menu) {
                menu.style.display = 'block';
                menu.classList.add('show');
                this.overlay.classList.add('show');
                this.isOpen = true;
                
                // Load fresh user info when opening
                this.loadUserInfo();
            }
        },
        
        close: function() {
            const menu = document.getElementById('sa-profile-menu');
            if (menu) {
                menu.classList.remove('show');
                this.overlay.classList.remove('show');
                setTimeout(() => {
                    menu.style.display = 'none';
                }, 200);
                this.isOpen = false;
            }
        },
        
        loadUserInfo: function() {
            // In development mode, keep it lightweight - only load when really needed
            // Don't automatically load roles and permissions on every page load
            this.setDefaultUserInfo();
        },
        
        setDefaultUserInfo: function() {
            // Set friendly default information without API calls
            const rolesElement = document.getElementById('sa-user-roles');
            const permissionsElement = document.getElementById('sa-user-permissions');
            
            if (rolesElement) {
                rolesElement.textContent = 'Click to load roles';
                rolesElement.style.cursor = 'pointer';
                rolesElement.style.color = '#666';
                rolesElement.onclick = () => this.loadUserRolesOnDemand();
            }
            
            if (permissionsElement) {
                permissionsElement.textContent = 'Click to load permissions';
                permissionsElement.style.cursor = 'pointer';
                permissionsElement.style.color = '#666';
                permissionsElement.onclick = () => this.loadUserRolesOnDemand();
            }
        },
        
        loadUserRolesOnDemand: function() {
            // Only load when user explicitly requests it
            this.loadUserRoles();
        },
        
        loadUserRoles: function() {
            const rolesElement = document.getElementById('sa-user-roles');
            const permissionsElement = document.getElementById('sa-user-permissions');
            if (!rolesElement) return;
            
            // Use our custom API method
            if (window.frappe && frappe.call) {
                frappe.call({
                    method: 'smart_accounting.www.project_management.index.get_current_user_info',
                    callback: (r) => {
                        if (r.message && r.message.success) {
                            const userInfo = r.message;
                            rolesElement.textContent = userInfo.roles.length > 0 ? userInfo.roles.join(', ') : 'No roles assigned';
                            if (permissionsElement) {
                                permissionsElement.textContent = userInfo.permissions;
                            }
                        } else {
                            rolesElement.textContent = 'Standard User';
                            if (permissionsElement) {
                                permissionsElement.textContent = 'Basic Access';
                            }
                        }
                    },
                    error: () => {
                        rolesElement.textContent = 'Standard User';
                        if (permissionsElement) {
                            permissionsElement.textContent = 'Basic Access';
                        }
                    }
                });
            } else {
                // Fallback: wait for frappe to be ready, then retry with delay
                setTimeout(() => {
                    if (window.frappe && frappe.call && frappe.csrf_token) {
                        frappe.call({
                            method: 'smart_accounting.www.project_management.index.get_current_user_info',
                            callback: (r) => {
                                if (r.message && r.message.success) {
                                    const userInfo = r.message;
                                    rolesElement.textContent = userInfo.roles.length > 0 ? userInfo.roles.join(', ') : 'No roles assigned';
                                    if (permissionsElement) {
                                        permissionsElement.textContent = userInfo.permissions;
                                    }
                                }
                            }
                        });
                    } else {
                        // Frappe still not ready, use default values
                        rolesElement.textContent = 'Standard User';
                        if (permissionsElement) {
                            permissionsElement.textContent = 'Basic Access';
                        }
                    }
                }, 500);
            }
        },
        
        // loadUserPermissions method removed - now handled in loadUserRoles
        
        toggleAdvancedInfo: function() {
            const advancedInfo = document.getElementById('sa-advanced-info');
            const toggleBtn = document.querySelector('.sa-profile-toggle-advanced');
            
            if (advancedInfo && toggleBtn) {
                const isHidden = advancedInfo.style.display === 'none';
                
                if (isHidden) {
                    advancedInfo.style.display = 'block';
                    toggleBtn.innerHTML = '<i class="fa fa-chevron-up"></i> Hide Advanced Info';
                    // Load the roles only when user requests it
                    this.loadUserRolesOnDemand();
                } else {
                    advancedInfo.style.display = 'none';
                    toggleBtn.innerHTML = '<i class="fa fa-chevron-down"></i> Show Advanced Info';
                }
            }
        },
        
        editProfile: function() {
            // console.log('Edit Profile clicked');
            this.close();
            // For now, show a placeholder message
            this.showMessage('My Account page will be available in a future update.', 'info');
        },
        
        changePassword: function() {
            // console.log('Change Password clicked');
            this.close();
            // For now, show a placeholder message
            this.showMessage('Password change will be available in a future update.', 'info');
        },
        
        viewSettings: function() {
            // console.log('View Settings clicked');
            this.close();
            // For now, show a placeholder message
            this.showMessage('User settings will be available in a future update.', 'info');
        },
        
        logout: function() {
            // console.log('Logout function called');
            this.close();
            
            // Direct logout without additional confirmation
            // (Frappe may show its own confirmation)
            // console.log('Performing logout');
            this.performLogout();
        },
        
        performLogout: function() {
            // Show loading message
            this.showMessage('Logging out...', 'info');
            
            // Use the most reliable logout method - direct API call
            this.tryDirectLogout();
        },
        
        tryDirectLogout: function() {
            // Direct API call to logout - most reliable method
            fetch('/api/method/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Frappe-CSRF-Token': window.frappe?.csrf_token || ''
                },
                credentials: 'same-origin' // Include cookies for session
            })
            .then(response => {
                // console.log('Logout response status:', response.status);
                // Logout API typically returns a redirect or success
                // Don't wait for JSON parsing, just redirect
                this.redirectToLogin();
            })
            .catch(error => {
                // console.log('Direct logout failed, using force logout:', error);
                this.forceLogout();
            });
        },
        
        forceLogout: function() {
            // Force logout by clearing session and redirecting
            try {
                // console.log('Force logout initiated');
                
                // Clear any stored session data
                if (window.frappe && frappe.session) {
                    frappe.session.user = 'Guest';
                }
                
                // Clear browser storage
                try {
                    localStorage.clear();
                    sessionStorage.clear();
                } catch (e) {
                    // console.log('Could not clear storage:', e);
                }
                
                // Direct redirect to logout endpoint with fallback
                window.location.href = '/api/method/logout';
            } catch (error) {
                console.error('Force logout error:', error);
                // Last resort - direct redirect to login
                window.location.href = '/login';
            }
        },
        
        redirectToLogin: function() {
            // Clear any cached data
            if (window.frappe) {
                window.frappe.session = { user: 'Guest' };
            }
            
            // Redirect to our custom login page
            setTimeout(() => {
                window.location.href = '/login';
            }, 500);
        },
        
        showMessage: function(message, type = 'info') {
            // Create a simple message display
            const messageDiv = document.createElement('div');
            messageDiv.style.cssText = `
                position: fixed;
                top: 80px;
                right: 20px;
                background: ${type === 'error' ? '#f8d7da' : '#d1ecf1'};
                color: ${type === 'error' ? '#721c24' : '#0c5460'};
                padding: 12px 16px;
                border-radius: 6px;
                border: 1px solid ${type === 'error' ? '#f5c6cb' : '#bee5eb'};
                z-index: 1002;
                max-width: 300px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                font-size: 14px;
            `;
            messageDiv.textContent = message;
            
            document.body.appendChild(messageDiv);
            
            // Auto remove after 3 seconds
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.parentNode.removeChild(messageDiv);
                }
            }, 3000);
        }
    };
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            saUserProfile.init();
        });
    } else {
        saUserProfile.init();
    }
    
})();

// ==================== NOTIFICATIONS SYSTEM ====================

window.saNotifications = {
    isOpen: false,
    currentTab: 'notifications',
    
    init() {
        this.bindEvents();
        this.loadNotifications();
    },
    
    bindEvents() {
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.sa-notifications-dropdown')) {
                this.close();
            }
        });
        
        // Prevent dropdown from closing when clicking inside
        const menu = document.getElementById('sa-notifications-menu');
        if (menu) {
            menu.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
    },
    
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    },
    
    open() {
        const menu = document.getElementById('sa-notifications-menu');
        if (menu) {
            menu.style.display = 'block';
            this.isOpen = true;
            
            // Load fresh data when opening
            this.loadNotifications();
        }
    },
    
    close() {
        const menu = document.getElementById('sa-notifications-menu');
        if (menu) {
            menu.style.display = 'none';
            this.isOpen = false;
        }
    },
    
    switchTab(tabName) {
        // Update active tab button
        document.querySelectorAll('.sa-tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        // Update active tab content
        document.querySelectorAll('.sa-tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');
        
        this.currentTab = tabName;
        
        // Load content for the selected tab
        switch(tabName) {
            case 'notifications':
                this.loadNotifications();
                break;
            case 'events':
                this.loadEvents();
                break;
            case 'whats-new':
                this.loadWhatsNew();
                break;
        }
    },
    
    loadNotifications() {
        // Use ERPNext's actual notification API (same as the built-in system)
        if (window.frappe && frappe.call) {
            frappe.call({
                method: 'frappe.desk.doctype.notification_log.notification_log.get_notification_logs',
                args: {
                    limit: 20  // Same as ERPNext default
                },
                callback: (r) => {
                    try {
                        if (r && r.message && Array.isArray(r.message)) {
                            // console.log('Loaded notifications:', r.message.length);
                            this.renderNotifications(r.message);
                        } else {
                            // console.log('No notifications found or invalid format');
                            this.showEmptyState('notifications');
                        }
                    } catch (error) {
                        console.error('Error processing notifications:', error);
                        this.showEmptyState('notifications');
                    }
                },
                error: (error) => {
                    console.error('Error loading notifications:', error);
                    this.showEmptyState('notifications');
                }
            });
        } else {
            // console.log('Frappe not available, showing empty state');
            this.showEmptyState('notifications');
        }
    },
    
    loadEvents() {
        // Try to use ERPNext's event system if available
        if (window.frappe && frappe.call && frappe.datetime) {
            try {
                frappe.call({
                    method: 'frappe.desk.calendar.get_events',
                    args: {
                        start: frappe.datetime.get_today(),
                        end: frappe.datetime.add_days(frappe.datetime.get_today(), 7)
                    },
                    callback: (r) => {
                        try {
                            if (r && r.message && Array.isArray(r.message) && r.message.length > 0) {
                                this.renderEvents(r.message);
                            } else {
                                // console.log('No events found or invalid format');
                                this.showEmptyState('events');
                            }
                        } catch (error) {
                            console.error('Error processing events:', error);
                            this.showEmptyState('events');
                        }
                    },
                    error: (error) => {
                        console.error('Error loading events:', error);
                        this.showEmptyState('events');
                    }
                });
            } catch (error) {
                console.error('Error calling events API:', error);
                this.showEmptyState('events');
            }
        } else {
            // console.log('Frappe datetime not available, showing empty state');
            this.showEmptyState('events');
        }
    },
    
    loadWhatsNew() {
        // For now, show empty state since ERPNext doesn't have a standard "What's New" API
        // In the future, we can implement our own Smart Accounting updates system
        this.showEmptyState('whats-new');
        
        // Alternative: Try to get recent system updates or changelog
        // if (window.frappe && frappe.call) {
        //     frappe.call({
        //         method: 'frappe.desk.notifications.get_system_updates',
        //         callback: (r) => {
        //             if (r.message && r.message.length > 0) {
        //                 this.renderWhatsNew(r.message);
        //             } else {
        //                 this.showEmptyState('whats-new');
        //             }
        //         },
        //         error: () => {
        //             this.showEmptyState('whats-new');
        //         }
        //     });
        // } else {
        //     this.showEmptyState('whats-new');
        // }
    },
    
    renderNotifications(notifications) {
        const container = document.getElementById('sa-notification-list');
        if (!container) return;
        
        // Ensure notifications is an array
        if (!notifications || !Array.isArray(notifications) || notifications.length === 0) {
            this.showEmptyState('notifications');
            return;
        }
        
        try {
            // Use ERPNext's exact notification rendering logic
            container.innerHTML = notifications.map(notification_log => {
                const doc_link = this.getItemLink(notification_log);
                const read_class = notification_log.read ? '' : 'unread';
                let message = notification_log.subject || '';
                
                // Process message same as ERPNext
                const title = message.match(/<b class="subject-title">(.*?)<\/b>/);
                if (title && window.frappe && frappe.ellipsis && window.strip_html) {
                    message = message.replace(title[1], frappe.ellipsis(strip_html(title[1]), 100));
                }
                
                const timestamp = this.formatTime(notification_log.creation);
                const user = notification_log.from_user || '';
                const user_avatar = this.getUserAvatar(user);
                
                return `
                    <a class="sa-notification-item recent-item notification-item ${read_class}"
                       href="${doc_link}"
                       data-name="${notification_log.name || ''}"
                       onclick="saNotifications.handleNotificationClick(event, '${notification_log.name || ''}')">
                        <div class="notification-body">
                            ${user_avatar}
                            <div class="message">
                                <div>${message}</div>
                                <div class="notification-timestamp text-muted">
                                    ${timestamp}
                                </div>
                            </div>
                        </div>
                        ${!notification_log.read ? '<div class="mark-as-read" title="Mark as Read"></div>' : ''}
                    </a>
                `;
            }).join('');
            
            // Update notification count
            this.updateNotificationCount(notifications.filter(n => !n.read).length);
        } catch (error) {
            console.error('Error rendering notifications:', error);
            this.showEmptyState('notifications');
        }
    },
    
    renderEvents(events) {
        const container = document.getElementById('sa-event-list');
        if (!container) return;
        
        // Ensure events is an array
        if (!events || !Array.isArray(events) || events.length === 0) {
            this.showEmptyState('events');
            return;
        }
        
        try {
            container.innerHTML = events.map(event => `
                <div class="sa-notification-item">
                    <div class="sa-notification-title">${this.escapeHtml(event.title || event.subject || 'Event')}</div>
                    <div class="sa-notification-message">${this.escapeHtml(event.description || '')}</div>
                    <div class="sa-notification-time">${this.formatTime(event.start)}</div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error rendering events:', error);
            this.showEmptyState('events');
        }
    },
    
    renderWhatsNew(updates) {
        const container = document.getElementById('sa-whats-new-list');
        if (!container) return;
        
        // Ensure updates is an array
        if (!updates || !Array.isArray(updates) || updates.length === 0) {
            this.showEmptyState('whats-new');
            return;
        }
        
        try {
            container.innerHTML = updates.map(update => `
                <div class="sa-notification-item">
                    <div class="sa-notification-title">${this.escapeHtml(update.title || 'Update')}</div>
                    <div class="sa-notification-message">${this.escapeHtml(update.content || '')}</div>
                    <div class="sa-notification-time">${this.formatTime(update.creation)}</div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error rendering what\'s new:', error);
            this.showEmptyState('whats-new');
        }
    },
    
    showEmptyState(type) {
        const containers = {
            'notifications': 'sa-notification-list',
            'events': 'sa-event-list', 
            'whats-new': 'sa-whats-new-list'
        };
        
        const container = document.getElementById(containers[type]);
        if (!container) return;
        
        const emptyStates = {
            'notifications': '<div class="sa-no-notifications"><i class="fa fa-bell-slash"></i><p>No notifications</p></div>',
            'events': '<div class="sa-no-events"><i class="fa fa-calendar-o"></i><p>No upcoming events</p></div>',
            'whats-new': '<div class="sa-no-updates"><i class="fa fa-star-o"></i><p>Nothing new to show</p></div>'
        };
        
        container.innerHTML = emptyStates[type];
        
        if (type === 'notifications') {
            this.updateNotificationCount(0);
        }
    },
    
    updateNotificationCount(count) {
        const badge = document.getElementById('sa-notification-count');
        if (!badge) return;
        
        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    },
    
    markAsRead(notificationId) {
        if (window.frappe && frappe.call) {
            frappe.call({
                method: 'frappe.desk.doctype.notification_log.notification_log.mark_as_read',
                args: { notification_log: notificationId },
                callback: () => {
                    // Update the UI immediately
                    const notificationElement = document.querySelector(`[data-name="${notificationId}"]`);
                    if (notificationElement) {
                        notificationElement.classList.remove('unread');
                        const markButton = notificationElement.querySelector('.mark-as-read');
                        if (markButton) {
                            markButton.remove();
                        }
                    }
                    // Reload notifications to get updated count
                    this.loadNotifications();
                }
            });
        }
    },
    
    viewAll() {
        // Navigate to full notifications page if available
        if (window.frappe) {
            frappe.set_route('List', 'Notification Log');
        }
        this.close();
    },
    
    formatTime(timestamp) {
        if (!timestamp) return '';
        
        try {
            const date = new Date(timestamp);
            const now = new Date();
            const diff = now - date;
            
            const minutes = Math.floor(diff / 60000);
            const hours = Math.floor(diff / 3600000);
            const days = Math.floor(diff / 86400000);
            
            if (minutes < 1) return 'Just now';
            if (minutes < 60) return `${minutes}m ago`;
            if (hours < 24) return `${hours}h ago`;
            if (days < 7) return `${days}d ago`;
            
            return date.toLocaleDateString();
        } catch (e) {
            return '';
        }
    },
    
    escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    },
    
    getItemLink(notification_doc) {
        // Same logic as ERPNext
        if (notification_doc.link) {
            return notification_doc.link;
        }
        const link_doctype = notification_doc.document_type 
            ? notification_doc.document_type 
            : "Notification Log";
        const link_docname = notification_doc.document_name 
            ? notification_doc.document_name 
            : notification_doc.name;
        
        // Use frappe's form link if available, otherwise construct manually
        if (window.frappe && frappe.utils && frappe.utils.get_form_link) {
            return frappe.utils.get_form_link(link_doctype, link_docname);
        } else {
            return `/app/${link_doctype.replace(' ', '%20')}/${link_docname}`;
        }
    },
    
    getUserAvatar(user) {
        // Use frappe's avatar if available, otherwise create simple avatar
        if (window.frappe && frappe.avatar) {
            return frappe.avatar(user, "avatar-medium user-avatar");
        } else {
            // Fallback simple avatar
            const initial = user ? user.charAt(0).toUpperCase() : '?';
            return `<div class="avatar avatar-medium user-avatar" title="${user}">
                        <div class="avatar-frame standard-image" style="background-color: #667eea; color: white;">
                            ${initial}
                        </div>
                    </div>`;
        }
    },
    
    handleNotificationClick(event, notificationId) {
        // Handle notification click - mark as read and navigate
        event.preventDefault();
        if (notificationId) {
            this.markAsRead(notificationId);
        }
        // Let the link navigate normally after marking as read
        setTimeout(() => {
            window.location.href = event.currentTarget.href;
        }, 100);
    }
};

// ==================== SETTINGS SYSTEM ====================

window.saSettings = {
    showUnderDevelopment() {
        if (window.frappe && frappe.show_alert) {
            frappe.show_alert({
                message: 'Settings feature is under development',
                indicator: 'blue'
            });
        } else {
            alert('Settings feature is under development');
        }
    }
};

// Initialize notifications when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (window.saNotifications) {
        saNotifications.init();
    }
});
