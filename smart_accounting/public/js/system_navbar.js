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
            
            console.log('Dev access request - Password entered:', password, 'Length:', password.length);
            
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
                console.log('Backend response:', data);
                if (data.message && data.message.success) {
                    this.showMessage('Developer access granted! Redirecting to ERPNext system...', 'success');
                    // Redirect to ERPNext after short delay
                    setTimeout(() => {
                        window.location.href = '/app';
                    }, 1500);
                } else {
                    this.showMessage(data.message?.message || 'Invalid password', 'error');
                    console.log('Access denied:', data.message);
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
                        console.log('Edit Profile button clicked via event listener');
                        this.editProfile();
                    });
                }
                
                if (passwordBtn) {
                    passwordBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('Change Password button clicked via event listener');
                        this.changePassword();
                    });
                }
                
                if (settingsBtn) {
                    settingsBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('Settings button clicked via event listener');
                        this.viewSettings();
                    });
                }
                
                if (logoutBtn) {
                    logoutBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('Logout button clicked via event listener');
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
                        rolesElement.textContent = 'Standard User';
                        if (permissionsElement) {
                            permissionsElement.textContent = 'Basic Access';
                        }
                    }
                })
                .catch(() => {
                    rolesElement.textContent = 'Standard User';
                    if (permissionsElement) {
                        permissionsElement.textContent = 'Basic Access';
                    }
                });
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
            console.log('Edit Profile clicked');
            this.close();
            // For now, show a placeholder message
            this.showMessage('My Account page will be available in a future update.', 'info');
        },
        
        changePassword: function() {
            console.log('Change Password clicked');
            this.close();
            // For now, show a placeholder message
            this.showMessage('Password change will be available in a future update.', 'info');
        },
        
        viewSettings: function() {
            console.log('View Settings clicked');
            this.close();
            // For now, show a placeholder message
            this.showMessage('User settings will be available in a future update.', 'info');
        },
        
        logout: function() {
            console.log('Logout function called');
            this.close();
            
            // Direct logout without additional confirmation
            // (Frappe may show its own confirmation)
            console.log('Performing logout');
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
                console.log('Logout response status:', response.status);
                // Logout API typically returns a redirect or success
                // Don't wait for JSON parsing, just redirect
                this.redirectToLogin();
            })
            .catch(error => {
                console.log('Direct logout failed, using force logout:', error);
                this.forceLogout();
            });
        },
        
        forceLogout: function() {
            // Force logout by clearing session and redirecting
            try {
                console.log('Force logout initiated');
                
                // Clear any stored session data
                if (window.frappe && frappe.session) {
                    frappe.session.user = 'Guest';
                }
                
                // Clear browser storage
                try {
                    localStorage.clear();
                    sessionStorage.clear();
                } catch (e) {
                    console.log('Could not clear storage:', e);
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
