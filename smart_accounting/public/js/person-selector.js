// Project Management - Person Selector
// Person selection and role assignment functionality

class PersonSelectorManager {
    constructor() {
        this.utils = window.PMUtils;
    }

    // Multi-Person Selector
    showMultiPersonSelector($cell, taskId, fieldName) {
        // Check if there's a role filter specified
        const roleFilter = $cell.data('role-filter');
        
        // Get current person emails
        const currentEmails = [];
        $cell.find('.pm-avatar[data-email]').each(function() {
            const email = $(this).data('email');
            if (email) currentEmails.push(email);
        });
        
        // Create person selector dropdown outside the table
        const selectorHTML = `
            <div class="pm-person-selector-modal" id="pm-person-selector-${taskId}-${fieldName}">
                <div class="pm-person-selector-content">
                    <div class="pm-person-selector-header">
                        <input type="text" class="pm-person-search" placeholder="Search names, roles or teams" value="">
                        <button class="pm-person-selector-close">
                            <i class="fa fa-times"></i>
                        </button>
                    </div>
                    <div class="pm-person-selector-body">
                        ${currentEmails.length > 0 ? `
                            <div class="pm-current-people">
                                <div class="pm-current-person-list">
                                    ${currentEmails.map(email => {
                                        const avatar = $cell.find(`[data-email="${email}"]`);
                                        const name = avatar.attr('title') || email;
                                        return `
                                            <div class="pm-current-person" data-email="${email}">
                                                <div class="pm-avatar" style="background: ${this.utils.getAvatarColor(name)}">
                                                    ${this.utils.getInitials(name)}
                                                </div>
                                                <span class="pm-person-name">${name.split(' ')[0]}</span>
                                                <button class="pm-remove-person" data-email="${email}">
                                                    <i class="fa fa-times"></i>
                                                </button>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                        ` : ''}
                        <h4>Suggested people</h4>
                        <div class="pm-person-options">
                            <div class="pm-person-option pm-clear-person" data-email="">
                                <div class="pm-avatar pm-empty-avatar">
                                    <i class="fa fa-user"></i>
                                </div>
                                <div class="pm-person-info">
                                    <div class="pm-person-name">No assignment</div>
                                    <div class="pm-person-email">Clear current assignment</div>
                                </div>
                            </div>
                        </div>
                        <div class="pm-person-list">
                            <!-- People will be loaded dynamically -->
                        </div>
                        <div class="pm-person-selector-footer">
                            <button class="pm-btn pm-btn-primary pm-done-selecting">
                                <i class="fa fa-check"></i>
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing selector
        $('.pm-person-selector-modal').remove();
        
        // Add to body
        $('body').append(selectorHTML);
        const $selector = $(`#pm-person-selector-${taskId}-${fieldName}`);
        
        // Position the modal properly relative to cell
        this.positionModalRelativeToCell($cell, $selector);
        
        // Show with animation
        $selector.fadeIn(200);
        
        // Focus search input
        const $searchInput = $selector.find('.pm-person-search');
        $searchInput.focus();
        
        // Load all people
        this.loadPeopleForSelector($selector.find('.pm-person-list'));
        
        // Bind events
        $searchInput.on('input', (e) => {
            this.searchPeopleForSelector(e.target.value, $selector.find('.pm-person-list'));
        });
        
        $selector.on('click', '.pm-person-option', (e) => {
            e.stopPropagation();
            const email = $(e.currentTarget).data('email');
            const name = $(e.currentTarget).data('name') || '';
            
            if (email === '') {
                // Clear all people for this role
                this.clearRolePeople($cell, taskId, fieldName);
                $selector.remove();
            } else {
                // Add person to role (multi-select)
                this.addPersonToRole($cell, taskId, fieldName, email, name);
                // Don't close selector - allow multiple selections
                // Update current people display in selector
                this.updateCurrentPeopleInSelector($selector, $cell);
            }
        });
        
        $selector.find('.pm-person-selector-close').on('click', () => {
            // Just close without clearing data
            $selector.remove();
            $cell.removeClass('editing');
        });
        
        // Done button to close selector
        $selector.find('.pm-done-selecting').on('click', () => {
            $selector.remove();
            $cell.removeClass('editing');
        });
        
        // Remove person button
        $selector.on('click', '.pm-remove-person', (e) => {
            e.stopPropagation();
            const emailToRemove = $(e.currentTarget).data('email');
            this.removePersonFromRole($cell, taskId, fieldName, emailToRemove);
            // Don't close selector - allow continued editing
            this.updateCurrentPeopleInSelector($selector, $cell);
        });
        
        // Close on outside click (without clearing data)
        setTimeout(() => {
            $(document).on('click.person-selector', (e) => {
                if (!$(e.target).closest('.pm-person-selector-modal').length) {
                    // Just close the selector, don't clear data
                    $('.pm-person-selector-modal').remove();
                    $cell.removeClass('editing');
                    $(document).off('click.person-selector');
                }
            });
        }, 100);
    }

    positionModalRelativeToCell($cell, $modal) {
        const cellOffset = $cell.offset();
        const cellHeight = $cell.outerHeight();
        const cellWidth = $cell.outerWidth();
        const modalWidth = 320;
        const modalHeight = 400;
        const windowWidth = $(window).width();
        const windowHeight = $(window).height();
        const scrollTop = $(window).scrollTop();
        const scrollLeft = $(window).scrollLeft();
        
        // Calculate position - prefer right side of cell
        let left = cellOffset.left + cellWidth + 10;
        let top = cellOffset.top;
        
        // If modal would go off right edge, position on left side
        if (left + modalWidth > scrollLeft + windowWidth - 20) {
            left = cellOffset.left - modalWidth - 10;
        }
        
        // If still off left edge, center horizontally
        if (left < scrollLeft + 20) {
            left = cellOffset.left - (modalWidth / 2) + (cellWidth / 2);
            // Position below cell if centered
            top = cellOffset.top + cellHeight + 10;
        }
        
        // Adjust vertical position if modal goes off bottom
        if (top + modalHeight > scrollTop + windowHeight - 20) {
            top = cellOffset.top - modalHeight + cellHeight;
        }
        
        // Ensure modal stays within viewport
        if (top < scrollTop + 20) {
            top = scrollTop + 20;
        }
        if (left < scrollLeft + 20) {
            left = scrollLeft + 20;
        }
        
        $modal.css({
            position: 'fixed',
            left: left + 'px',
            top: top + 'px',
            zIndex: 1001
        });
    }
    
    async loadPeopleForSelector($container) {
        try {
            // Get all enabled users with roles (exclude system users)
            const response = await frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'User',
                    fields: ['name', 'email', 'full_name', 'user_image', 'role_profile_name'],
                    filters: [
                        ['enabled', '=', 1],
                        ['user_type', '=', 'System User'],
                        ['name', '!=', 'Guest'],
                        ['name', '!=', 'Administrator'],
                        ['email', '!=', 'admin@example.com']
                    ],
                    limit_page_length: 50,
                    order_by: 'full_name asc'
                }
            });
            
            if (response.message && response.message.length > 0) {
                // Build user cache while generating HTML
                const peopleHTML = response.message.map(user => {
                    const displayName = user.full_name || user.email;
                    const role = user.role_profile_name || 'System User';
                    
                    // Cache user info
                    this.utils.userCache[user.email] = {
                        full_name: displayName,
                        email: user.email,
                        user_image: user.user_image
                    };
                    
                    return `
                        <div class="pm-person-option" data-email="${user.email}" data-name="${displayName}">
                            <div class="pm-avatar" style="background: ${this.utils.getAvatarColor(displayName)}">
                                ${this.utils.getInitials(displayName)}
                            </div>
                            <div class="pm-person-info">
                                <div class="pm-person-name">${displayName}</div>
                                <div class="pm-person-role">${role}</div>
                            </div>
                        </div>
                    `;
                }).join('');
                
                $container.html(peopleHTML);
            } else {
                $container.html('<div class="pm-no-people">No users found</div>');
            }
        } catch (error) {
            console.error('Error loading people:', error);
            $container.html('<div class="pm-no-people">Error loading users</div>');
        }
    }
    
    searchPeopleForSelector(query, $container) {
        if (!query) {
            this.loadPeopleForSelector($container);
            return;
        }
        
        // Filter existing options
        $container.find('.pm-person-option').each(function() {
            const name = $(this).data('name') || '';
            const email = $(this).data('email') || '';
            const visible = name.toLowerCase().includes(query.toLowerCase()) || 
                           email.toLowerCase().includes(query.toLowerCase());
            $(this).toggle(visible);
        });
    }

    async addPersonToRole($cell, taskId, fieldName, email, name) {
        try {
            // Direct sub-table approach (no fallback needed after cleanup)
            
            // Get current roles for this task
            const currentRoles = await this.getCurrentTaskRoles(taskId);
            
            // Get role type - use role filter if specified, otherwise derive from field name
            let roleType;
            const roleFilter = $cell.data('role-filter');
            if (roleFilter) {
                roleType = roleFilter;
            } else {
                roleType = fieldName.replace('custom_', '');
                // Map frontend field names to sub-table role values
                const roleMapping = {
                    'action_person': 'Action Person',
                    'preparer': 'Preparer',
                    'reviewer': 'Reviewer',
                    'partner': 'Partner',
                    'roles': 'Owner'  // Handle generic roles field for Owner
                };
                roleType = roleMapping[roleType] || roleType;
            }
            
            // Check if person already assigned to this role
            const existingRole = currentRoles.find(r => r.role === roleType && r.user === email);
            if (existingRole) {
                frappe.show_alert({
                    message: 'Person already assigned to this role',
                    indicator: 'orange'
                });
                return;
            }
            
            // Add new role assignment
            currentRoles.push({
                role: roleType,
                user: email,
                is_primary: currentRoles.filter(r => r.role === roleType).length === 0 // First person is primary
            });
            
            // Save roles
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.set_task_roles',
                args: {
                    task_id: taskId,
                    roles_data: JSON.stringify(currentRoles)
                }
            });
            
            if (response.message && response.message.success) {
                // Update cell display
                await this.updatePersonCellDisplay($cell, taskId, roleType);
                
                frappe.show_alert({
                    message: `${name} added as ${roleType}`,
                    indicator: 'green'
                });
            }
        } catch (error) {
            console.error('Error adding person to role:', error);
            frappe.show_alert({
                message: 'Error adding person',
                indicator: 'red'
            });
        }
    }

    async clearRolePeople($cell, taskId, fieldName) {
        try {
            // Get current roles for this task
            const currentRoles = await this.getCurrentTaskRoles(taskId);
            
            // Get role type - use role filter if specified, otherwise derive from field name
            let roleType;
            const roleFilter = $cell.data('role-filter');
            if (roleFilter) {
                roleType = roleFilter;
            } else {
                roleType = fieldName.replace('custom_', '');
                // Map frontend field names to sub-table role values
                const roleMapping = {
                    'action_person': 'Action Person',
                    'preparer': 'Preparer',
                    'reviewer': 'Reviewer',
                    'partner': 'Partner',
                    'roles': 'Owner'  // Handle generic roles field for Owner
                };
                roleType = roleMapping[roleType] || roleType;
            }
            
            // Remove all assignments for this role
            const filteredRoles = currentRoles.filter(r => r.role !== roleType);
            
            // Save roles
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.set_task_roles',
                args: {
                    task_id: taskId,
                    roles_data: JSON.stringify(filteredRoles)
                }
            });
            
            if (response.message && response.message.success) {
                // Update cell display to empty
                $cell.html(`
                    <div class="pm-user-avatars pm-empty-person">
                        <div class="pm-avatar pm-empty-avatar">
                            <i class="fa fa-user"></i>
                        </div>
                    </div>
                `);
                
                frappe.show_alert({
                    message: 'All people removed from role',
                    indicator: 'orange'
                });
            }
        } catch (error) {
            console.error('Error clearing role people:', error);
            frappe.show_alert({
                message: 'Error clearing people',
                indicator: 'red'
            });
        }
    }

    async getCurrentTaskRoles(taskId) {
        try {
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.get_task_roles',
                args: { task_id: taskId }
            });
            
            if (response.message && response.message.success) {
                return response.message.roles || [];
            }
            return [];
        } catch (error) {
            console.error('Error getting current task roles:', error);
            return [];
        }
    }

    async updatePersonCellDisplay($cell, taskId, roleType) {
        try {
            const roles = await this.getCurrentTaskRoles(taskId);
            // roleType is already mapped to sub-table format (e.g., "Action Person")
            const roleUsers = roles.filter(r => r.role === roleType);
            
            if (roleUsers.length === 0) {
                $cell.html(`
                    <div class="pm-user-avatars pm-empty-person">
                        <div class="pm-avatar pm-empty-avatar">
                            <i class="fa fa-user"></i>
                        </div>
                    </div>
                `);
                return;
            }
            
            // Generate avatars - max 2 displayed, rest as "+N"
            let avatarsHTML = '';
            let moreHTML = '';
            
            if (roleUsers.length === 1) {
                // Single user - show full avatar
                const userInfo = await this.utils.getRealUserInfo(roleUsers[0].user);
                const initials = this.utils.getInitials(userInfo?.full_name || roleUsers[0].user);
                const isPrimary = roleUsers[0].is_primary ? ' pm-primary-user' : '';
                
                avatarsHTML = `<div class="pm-avatar${isPrimary}" title="${userInfo?.full_name || roleUsers[0].user}" data-email="${roleUsers[0].user}">${initials}</div>`;
            } else if (roleUsers.length >= 2) {
                // Multiple users - show first user + "+N" count
                const firstUser = roleUsers[0];
                const userInfo = await this.utils.getRealUserInfo(firstUser.user);
                const initials = this.utils.getInitials(userInfo?.full_name || firstUser.user);
                const isPrimary = firstUser.is_primary ? ' pm-primary-user' : '';
                
                avatarsHTML = `<div class="pm-avatar${isPrimary}" title="${userInfo?.full_name || firstUser.user}" data-email="${firstUser.user}">${initials}</div>`;
                moreHTML = `<div class="pm-avatar-more" title="Total ${roleUsers.length} people assigned">+${roleUsers.length - 1}</div>`;
            }
            
            $cell.html(`
                <div class="pm-user-avatars">
                    ${avatarsHTML}
                    ${moreHTML}
                </div>
            `);
            
        } catch (error) {
            console.error('Error updating person cell display:', error);
        }
    }

    async removePersonFromRole($cell, taskId, fieldName, emailToRemove) {
        try {
            // Get current roles for this task
            const currentRoles = await this.getCurrentTaskRoles(taskId);
            
            // Get role type - use role filter if specified, otherwise derive from field name
            let roleType;
            const roleFilter = $cell.data('role-filter');
            if (roleFilter) {
                roleType = roleFilter;
            } else {
                roleType = fieldName.replace('custom_', '');
                // Map frontend field names to sub-table role values
                const roleMapping = {
                    'action_person': 'Action Person',
                    'preparer': 'Preparer',
                    'reviewer': 'Reviewer',
                    'partner': 'Partner',
                    'roles': 'Owner'  // Handle generic roles field for Owner
                };
                roleType = roleMapping[roleType] || roleType;
            }
            
            // Remove this specific person from this role
            const filteredRoles = currentRoles.filter(r => !(r.role === roleType && r.user === emailToRemove));
            
            // If we removed the primary person, make the next person primary
            const remainingInRole = filteredRoles.filter(r => r.role === roleType);
            if (remainingInRole.length > 0 && !remainingInRole.some(r => r.is_primary)) {
                remainingInRole[0].is_primary = true;
            }
            
            // Save roles
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.set_task_roles',
                args: {
                    task_id: taskId,
                    roles_data: JSON.stringify(filteredRoles)
                }
            });
            
            if (response.message && response.message.success) {
                // Update cell display
                await this.updatePersonCellDisplay($cell, taskId, roleType);
                
                frappe.show_alert({
                    message: 'Person removed from role',
                    indicator: 'orange'
                });
            }
        } catch (error) {
            console.error('Error removing person from role:', error);
            frappe.show_alert({
                message: 'Error removing person',
                indicator: 'red'
            });
        }
    }

    updateCurrentPeopleInSelector($selector, $cell) {
        // Get current people from cell
        const currentEmails = [];
        $cell.find('.pm-avatar[data-email]').each(function() {
            const email = $(this).data('email');
            if (email) currentEmails.push(email);
        });
        
        // Update the current people section in selector
        const $currentSection = $selector.find('.pm-current-people');
        if (currentEmails.length > 0) {
            const currentHTML = `
                <div class="pm-current-person-list">
                    ${currentEmails.map(email => {
                        const avatar = $cell.find(`[data-email="${email}"]`);
                        const name = avatar.attr('title') || email;
                        return `
                            <div class="pm-current-person" data-email="${email}">
                                <div class="pm-avatar" style="background: ${this.utils.getAvatarColor(name)}">
                                    ${this.utils.getInitials(name)}
                                </div>
                                <span class="pm-person-name">${name.split(' ')[0]}</span>
                                <button class="pm-remove-person" data-email="${email}">
                                    <i class="fa fa-times"></i>
                                </button>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
            
            if ($currentSection.length === 0) {
                $selector.find('.pm-person-selector-body').prepend(`
                    <div class="pm-current-people">
                        ${currentHTML}
                    </div>
                `);
            } else {
                $currentSection.html(currentHTML);
            }
        } else {
            $currentSection.remove();
        }
    }

    // Legacy single person assignment
    async selectPerson($cell, taskId, fieldName, email, name) {
        try {
            // Update task field
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.update_task_field',
                args: {
                    task_id: taskId,
                    field_name: fieldName,
                    new_value: email
                }
            });
            
            if (response.message && response.message.success) {
                // Update UI
                this.updatePersonFieldDisplay($cell, email, name);
                
                frappe.show_alert({
                    message: 'Person assignment updated',
                    indicator: 'green'
                });
            } else {
                throw new Error(response.message?.error || 'Update failed');
            }
        } catch (error) {
            console.error('Error updating person:', error);
            frappe.show_alert({
                message: 'Failed to update assignment',
                indicator: 'red'
            });
            this.cancelPersonSelection($cell);
        }
        
        // Clean up
        $(document).off('click.person-selector');
    }
    
    updatePersonFieldDisplay($cell, email, name) {
        if (!email) {
            // Show empty state
            $cell.html(`
                <div class="pm-user-avatars editable-field pm-empty-person">
                    <div class="pm-avatar pm-empty-avatar">
                        <i class="fa fa-user"></i>
                    </div>
                </div>
            `);
        } else {
            // Show person
            const initials = this.utils.getInitials(name);
            const color = this.utils.getAvatarColor(name);
            $cell.html(`
                <div class="pm-user-avatars editable-field">
                    <div class="pm-avatar" title="${name}" data-email="${email}" style="background: ${color}">
                        ${initials}
                    </div>
                </div>
            `);
        }
        $cell.removeClass('editing');
    }

    cancelPersonSelection($cell) {
        // Get original content from data attributes or restore from server
        const taskId = $cell.data('task-id');
        const fieldName = $cell.data('field');
        
        // Restore from current data without making server call
        this.restorePersonFieldFromData($cell, taskId, fieldName);
        
        $cell.removeClass('editing');
        $(document).off('click.person-selector');
    }
    
    async restorePersonFieldFromData($cell, taskId, fieldName) {
        try {
            // Get fresh data from server to restore accurate state
            const response = await frappe.call({
                method: 'frappe.client.get',
                args: {
                    doctype: 'Task',
                    name: taskId,
                    fields: [fieldName]
                }
            });
            
            if (response.message) {
                const currentValue = response.message[fieldName];
                if (currentValue) {
                    // Get user info and restore display
                    const userResponse = await frappe.call({
                        method: 'frappe.client.get',
                        args: {
                            doctype: 'User',
                            name: currentValue,
                            fields: ['full_name', 'email']
                        }
                    });
                    
                    if (userResponse.message) {
                        const user = userResponse.message;
                        const displayName = user.full_name || user.email;
                        this.updatePersonFieldDisplay($cell, user.email, displayName);
                        return;
                    }
                }
            }
            
            // If no data, show empty state
            this.updatePersonFieldDisplay($cell, '', '');
            
        } catch (error) {
            console.error('Error restoring field data:', error);
            // Show empty state on error
            this.updatePersonFieldDisplay($cell, '', '');
        }
    }
}

// Create global instance
window.PersonSelectorManager = new PersonSelectorManager();

// Export for module systems if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PersonSelectorManager;
}
