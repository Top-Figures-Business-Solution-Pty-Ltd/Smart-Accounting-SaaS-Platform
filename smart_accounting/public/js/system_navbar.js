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
            
            // Call backend to verify password and grant access
            if (window.frappe && frappe.call) {
                frappe.call({
                    method: 'smart_accounting.www.project_management.index.grant_dev_access',
                    args: {
                        password: password
                    },
                    callback: (response) => {
                        if (response.message && response.message.success) {
                            this.showMessage('Developer access granted. Redirecting to ERPNext system...', 'success');
                            setTimeout(() => {
                                window.location.href = response.message.redirect_url || '/app';
                            }, 1500);
                        } else {
                            this.showMessage(response.message?.message || 'Invalid password', 'error');
                        }
                    },
                    error: (error) => {
                        console.error('Dev access error:', error);
                        this.showMessage('Error requesting developer access', 'error');
                    }
                });
            } else {
                // Fallback for when frappe is not available
                fetch('/api/method/smart_accounting.www.project_management.index.grant_dev_access', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Frappe-CSRF-Token': window.frappe?.csrf_token || ''
                    },
                    body: JSON.stringify({
                        password: password
                    })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.message && data.message.success) {
                        this.showMessage('Developer access granted. Redirecting to ERPNext system...', 'success');
                        setTimeout(() => {
                            window.location.href = data.message.redirect_url || '/app';
                        }, 1500);
                    } else {
                        this.showMessage(data.message?.message || 'Invalid password', 'error');
                    }
                })
                .catch(error => {
                    console.error('Dev access error:', error);
                    this.showMessage('Error requesting developer access', 'error');
                });
            }
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
                if (this.isOpen && profileDropdown && !profileDropdown.contains(e.target)) {
                    this.close();
                }
            });
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
            // Load user roles and permissions together
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
                            rolesElement.textContent = 'Unable to load roles';
                            if (permissionsElement) {
                                permissionsElement.textContent = 'Unable to load permissions';
                            }
                        }
                    },
                    error: () => {
                        rolesElement.textContent = 'Error loading roles';
                        if (permissionsElement) {
                            permissionsElement.textContent = 'Error loading permissions';
                        }
                    }
                });
            } else {
                // Fallback for when frappe is not available
                fetch('/api/method/smart_accounting.www.project_management.index.get_current_user_info', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Frappe-CSRF-Token': window.frappe?.csrf_token || ''
                    }
                })
                .then(response => response.json())
                .then(data => {
                    if (data.message && data.message.success) {
                        const userInfo = data.message;
                        rolesElement.textContent = userInfo.roles.length > 0 ? userInfo.roles.join(', ') : 'No roles assigned';
                        if (permissionsElement) {
                            permissionsElement.textContent = userInfo.permissions;
                        }
                    } else {
                        rolesElement.textContent = 'Unable to load roles';
                        if (permissionsElement) {
                            permissionsElement.textContent = 'Unable to load permissions';
                        }
                    }
                })
                .catch(() => {
                    rolesElement.textContent = 'Error loading roles';
                    if (permissionsElement) {
                        permissionsElement.textContent = 'Error loading permissions';
                    }
                });
            }
        },
        
        // loadUserPermissions method removed - now handled in loadUserRoles
        
        editProfile: function() {
            this.close();
            // For now, show a placeholder message
            this.showMessage('My Account page will be available in a future update.', 'info');
        },
        
        changePassword: function() {
            this.close();
            // For now, show a placeholder message
            this.showMessage('Password change will be available in a future update.', 'info');
        },
        
        viewSettings: function() {
            this.close();
            // For now, show a placeholder message
            this.showMessage('User settings will be available in a future update.', 'info');
        },
        
        logout: function() {
            this.close();
            
            // Confirm logout
            if (confirm('Are you sure you want to logout?')) {
                // Use frappe logout if available, otherwise fallback to direct logout
                if (window.frappe && frappe.call) {
                    frappe.call({
                        method: 'logout',
                        callback: () => {
                            window.location.href = '/login';
                        },
                        error: () => {
                            // Fallback to direct logout
                            window.location.href = '/api/method/logout';
                        }
                    });
                } else {
                    // Direct logout
                    window.location.href = '/api/method/logout';
                }
            }
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
