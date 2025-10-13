// Bulk Update Configuration System
// Scalable and customizable bulk update settings for Smart Accounting

window.BulkUpdateConfig = {
    // ==================== FIELD RESTRICTIONS ====================
    
    // Fields that cannot be bulk updated (high-level business logic restrictions)
    restrictedFields: [
        'client',           // Client assignment is task-specific
        'custom_client',    
        'engagement',       // Engagement is unique per task
        'custom_engagement',
        'subject',          // Task names should remain unique
        'project',          // Tasks belong to specific projects
        'custom_entity'     // Entity may be task-specific
    ],
    
    // Fields that can be bulk updated
    allowedFields: [
        'status',
        'custom_action_person',
        'custom_preparer', 
        'custom_reviewer',
        'custom_partner',
        'custom_softwares',
        'custom_target_month',
        'custom_budget',
        'custom_actual',
        'priority',
        'custom_tftg',
        'custom_note',
        'custom_review_note',
        'custom_lodgement_due_date',
        'custom_reset_date',
        'custom_year_end',
        'custom_frequency'
    ],
    
    // ==================== USER CUSTOMIZATION ====================
    
    // Allow users to customize bulk update behavior
    enableUserCustomization: true,
    
    // Allow admins to override any restrictions
    enableAdminOverride: true,
    
    // Log all bulk operations for audit trail
    logBulkOperations: true,
    
    // ==================== CONFIRMATION SETTINGS ====================
    
    // Always show confirmation for bulk updates
    requireConfirmation: true,
    
    // Show detailed preview of changes
    showChangePreview: true,
    
    // Maximum number of tasks that can be bulk updated at once
    maxBulkUpdateSize: 100,
    
    // ==================== API MAPPING ====================
    
    // Map fields to their specific update APIs
    fieldApiMapping: {
        'custom_softwares': {
            method: 'smart_accounting.www.project_management.index.set_task_softwares',
            argsMapper: (taskId, newValue) => ({
                task_id: taskId,
                softwares_data: JSON.stringify(newValue)
            })
        },
        'status': {
            method: 'smart_accounting.www.project_management.index.update_task_status',
            argsMapper: (taskId, newValue) => ({
                task_id: taskId,
                new_status: newValue
            })
        },
        'custom_action_person': {
            method: 'smart_accounting.www.project_management.index.set_task_roles',
            argsMapper: (taskId, newValue) => ({
                task_id: taskId,
                roles_data: JSON.stringify(Array.isArray(newValue) ? newValue : [{
                    role: 'Action Person',  // 使用后端期望的格式
                    user: newValue,
                    is_primary: true
                }])
            })
        },
        'custom_preparer': {
            method: 'smart_accounting.www.project_management.index.set_task_roles',
            argsMapper: (taskId, newValue) => ({
                task_id: taskId,
                roles_data: JSON.stringify(Array.isArray(newValue) ? newValue : [{
                    role: 'Preparer',  // 使用后端期望的格式
                    user: newValue,
                    is_primary: true
                }])
            })
        },
        'custom_reviewer': {
            method: 'smart_accounting.www.project_management.index.set_task_roles',
            argsMapper: (taskId, newValue) => ({
                task_id: taskId,
                roles_data: JSON.stringify(Array.isArray(newValue) ? newValue : [{
                    role: 'Reviewer',  // 使用后端期望的格式
                    user: newValue,
                    is_primary: true
                }])
            })
        },
        'custom_partner': {
            method: 'smart_accounting.www.project_management.index.set_task_roles',
            argsMapper: (taskId, newValue) => ({
                task_id: taskId,
                roles_data: JSON.stringify(Array.isArray(newValue) ? newValue : [{
                    role: 'Partner',  // 使用后端期望的格式
                    user: newValue,
                    is_primary: true
                }])
            })
        },
        // Add more field-specific APIs here as needed
        // 'custom_special_field': {
        //     method: 'smart_accounting.www.project_management.index.update_special_field',
        //     argsMapper: (taskId, newValue) => ({ task_id: taskId, special_value: newValue })
        // }
    },
    
    // Default API for standard fields
    defaultApi: {
        method: 'smart_accounting.www.project_management.index.update_task_field',
        argsMapper: (taskId, fieldName, newValue) => ({
            task_id: taskId,
            field_name: fieldName,
            new_value: newValue
        })
    },
    
    // ==================== UI UPDATE MAPPING ====================
    
    // Map fields to their UI update methods
    fieldUiMapping: {
        'status': 'updateStatusUI',
        'custom_softwares': 'updateSoftwareUI',
        'custom_action_person': 'updatePersonUI',
        'custom_preparer': 'updatePersonUI',
        'custom_reviewer': 'updatePersonUI', 
        'custom_partner': 'updatePersonUI',
        'custom_tftg': 'updateTfTgUI'
    },
    
    // ==================== EXTENSION POINTS ====================
    
    // Hook for custom validation before bulk update
    beforeBulkUpdate: null, // function(field, newValue, selectedTasks) => boolean
    
    // Hook for custom processing after bulk update
    afterBulkUpdate: null,  // function(field, newValue, updatedTasks, results) => void
    
    // Hook for custom UI updates
    customUiUpdater: null,  // function(taskId, field, newValue) => void
    
    // ==================== METHODS ====================
    
    // Check if a field can be bulk updated
    isFieldAllowed(field, userRole = null) {
        // Admin override
        if (this.enableAdminOverride && userRole === 'Administrator') {
            return true;
        }
        
        // Check restricted fields
        if (this.restrictedFields.includes(field)) {
            return false;
        }
        
        // Check allowed fields (if specified)
        if (this.allowedFields && this.allowedFields.length > 0) {
            return this.allowedFields.includes(field);
        }
        
        // Default: allow if not restricted
        return true;
    },
    
    // Get API configuration for a field
    getApiConfig(field) {
        return this.fieldApiMapping[field] || this.defaultApi;
    },
    
    // Get UI update method for a field
    getUiUpdateMethod(field) {
        return this.fieldUiMapping[field] || 'updateDefaultUI';
    },
    
    // Load user-specific configuration (for future implementation)
    async loadUserConfig(userId) {
        try {
            const response = await frappe.call({
                method: 'smart_accounting.www.project_management.index.get_user_bulk_update_config',
                args: { user_id: userId }
            });
            
            if (response.message && response.message.success) {
                // Merge user config with default config
                Object.assign(this, response.message.config);
            }
        } catch (error) {
            console.log('User bulk update config not available, using defaults');
        }
    },
    
    // Save user-specific configuration (for future implementation)
    async saveUserConfig(userId, config) {
        try {
            await frappe.call({
                method: 'smart_accounting.www.project_management.index.save_user_bulk_update_config',
                args: { 
                    user_id: userId,
                    config: config 
                }
            });
            
            frappe.show_alert({
                message: 'Bulk update preferences saved',
                indicator: 'green'
            });
        } catch (error) {
            console.error('Error saving bulk update config:', error);
            frappe.show_alert({
                message: 'Failed to save preferences',
                indicator: 'red'
            });
        }
    }
};

// Initialize configuration on load
document.addEventListener('DOMContentLoaded', () => {
    // Load user configuration if available
    if (window.frappe && frappe.session.user) {
        window.BulkUpdateConfig.loadUserConfig(frappe.session.user);
    }
});
