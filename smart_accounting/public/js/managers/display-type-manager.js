// Display Type Manager - Handles different board display types
// Manages data source mapping and column configurations for Task-Centric, Contact-Centric, and Client-Centric views

class DisplayTypeManager {
    constructor() {
        this.displayTypes = {
            'Task-Centric': {
                name: 'Task-Centric',
                icon: 'fa-tasks',
                description: 'Traditional project management focused on tasks and deliverables',
                dataSource: 'Task',
                primaryKey: 'name',
                columns: this.getTaskCentricColumns(),
                filters: this.getTaskCentricFilters(),
                searchFields: ['subject', 'description', 'project']
            },
            'Contact-Centric': {
                name: 'Contact-Centric',
                icon: 'fa-users',
                description: 'Manage relationships and communications with contacts',
                dataSource: 'Contact',
                primaryKey: 'name',
                columns: this.getContactCentricColumns(),
                filters: this.getContactCentricFilters(),
                searchFields: ['first_name', 'last_name', 'email_id', 'company_name']
            },
            'Client-Centric': {
                name: 'Client-Centric',
                icon: 'fa-building',
                description: 'Focus on client projects, referrals, and business development',
                dataSource: 'Customer',
                primaryKey: 'name',
                columns: this.getClientCentricColumns(),
                filters: this.getClientCentricFilters(),
                searchFields: ['customer_name', 'customer_group', 'territory']
            }
        };
    }

    // Get display type configuration
    getDisplayTypeConfig(displayType) {
        return this.displayTypes[displayType] || this.displayTypes['Task-Centric'];
    }

    // Get all available display types
    getAvailableDisplayTypes() {
        return Object.keys(this.displayTypes);
    }

    // Task-Centric column configuration (existing functionality)
    getTaskCentricColumns() {
        return [
            {
                key: 'client',
                label: 'Client',
                field: 'project',
                type: 'link',
                width: '150px',
                sortable: true,
                filterable: true
            },
            {
                key: 'task-name',
                label: 'Task Name',
                field: 'subject',
                type: 'text',
                width: '200px',
                sortable: true,
                filterable: true,
                primary: true
            },
            {
                key: 'status',
                label: 'Status',
                field: 'status',
                type: 'select',
                width: '120px',
                sortable: true,
                filterable: true
            },
            {
                key: 'priority',
                label: 'Priority',
                field: 'priority',
                type: 'select',
                width: '100px',
                sortable: true,
                filterable: true
            },
            {
                key: 'action-person',
                label: 'Assigned To',
                field: 'assigned_to',
                type: 'link',
                width: '130px',
                sortable: true,
                filterable: true
            },
            {
                key: 'target-month',
                label: 'Due Date',
                field: 'exp_end_date',
                type: 'date',
                width: '120px',
                sortable: true,
                filterable: true
            }
        ];
    }

    // Contact-Centric column configuration
    getContactCentricColumns() {
        return [
            {
                key: 'contact-name',
                label: 'Contact Name',
                field: 'first_name',
                type: 'text',
                width: '180px',
                sortable: true,
                filterable: true,
                primary: true,
                formatter: (value, row) => {
                    const firstName = row.first_name || '';
                    const lastName = row.last_name || '';
                    return `${firstName} ${lastName}`.trim();
                }
            },
            {
                key: 'company',
                label: 'Company',
                field: 'company_name',
                type: 'text',
                width: '160px',
                sortable: true,
                filterable: true
            },
            {
                key: 'email',
                label: 'Email',
                field: 'email_id',
                type: 'email',
                width: '200px',
                sortable: true,
                filterable: true
            },
            {
                key: 'phone',
                label: 'Phone',
                field: 'phone',
                type: 'text',
                width: '130px',
                sortable: true,
                filterable: true
            },
            {
                key: 'last-contact',
                label: 'Last Contact',
                field: 'custom_last_contact_date',
                type: 'date',
                width: '120px',
                sortable: true,
                filterable: true
            },
            {
                key: 'notes',
                label: 'Notes',
                field: 'custom_contact_notes',
                type: 'text',
                width: '200px',
                sortable: false,
                filterable: true
            },
            {
                key: 'status',
                label: 'Status',
                field: 'status',
                type: 'select',
                width: '100px',
                sortable: true,
                filterable: true
            }
        ];
    }

    // Client-Centric column configuration
    getClientCentricColumns() {
        return [
            {
                key: 'client-name',
                label: 'Client Name',
                field: 'customer_name',
                type: 'text',
                width: '180px',
                sortable: true,
                filterable: true,
                primary: true
            },
            {
                key: 'priority-level',
                label: 'Priority Level',
                field: 'priority_level',
                type: 'select',
                width: '130px',
                sortable: true,
                filterable: true,
                source: 'Client Project Info',
                sourceField: 'priority_level'
            },
            {
                key: 'accountant',
                label: 'Accountant',
                field: 'accountant',
                type: 'select',
                width: '120px',
                sortable: true,
                filterable: true,
                source: 'Client Project Info',
                sourceField: 'accountant'
            },
            {
                key: 'progress',
                label: 'Progress',
                field: 'darren_progress',
                type: 'text',
                width: '100px',
                sortable: true,
                filterable: true,
                source: 'Client Project Info',
                sourceField: 'darren_progress'
            },
            {
                key: 'referral',
                label: 'Referral List',
                field: 'referral_person',
                type: 'text',
                width: '130px',
                sortable: true,
                filterable: true,
                source: 'Client Referral',
                sourceField: 'referral_person'
            },
            {
                key: 'industry',
                label: 'Industry',
                field: 'industry',
                type: 'text',
                width: '120px',
                sortable: true,
                filterable: true,
                source: 'Client Project Info',
                sourceField: 'industry'
            },
            {
                key: 'risk-profile',
                label: 'Risk Profile',
                field: 'darren_risks',
                type: 'select',
                width: '120px',
                sortable: true,
                filterable: true,
                source: 'Client Project Info',
                sourceField: 'darren_risks'
            }
        ];
    }

    // Task-Centric filter configuration
    getTaskCentricFilters() {
        return [
            {
                key: 'status',
                label: 'Status',
                type: 'select',
                field: 'status',
                options: ['Open', 'Working', 'Pending Review', 'Overdue', 'Template', 'Completed', 'Cancelled']
            },
            {
                key: 'priority',
                label: 'Priority',
                type: 'select',
                field: 'priority',
                options: ['Low', 'Medium', 'High', 'Urgent']
            },
            {
                key: 'assigned_to',
                label: 'Assigned To',
                type: 'link',
                field: 'assigned_to',
                doctype: 'User'
            },
            {
                key: 'project',
                label: 'Project',
                type: 'link',
                field: 'project',
                doctype: 'Project'
            }
        ];
    }

    // Contact-Centric filter configuration
    getContactCentricFilters() {
        return [
            {
                key: 'status',
                label: 'Status',
                type: 'select',
                field: 'status',
                options: ['Passive', 'Open', 'Replied']
            },
            {
                key: 'company_name',
                label: 'Company',
                type: 'text',
                field: 'company_name'
            },
            {
                key: 'last_contact_date',
                label: 'Last Contact Date',
                type: 'daterange',
                field: 'custom_last_contact_date'
            }
        ];
    }

    // Client-Centric filter configuration
    getClientCentricFilters() {
        return [
            {
                key: 'priority_level',
                label: 'Priority Level',
                type: 'select',
                field: 'priority_level',
                options: ['Priority - January', 'Priority - February', 'Priority - March', 'Priority - April', 'Priority - May', 'Priority - June', 'Priority - July', 'Priority - August', 'Priority - September', 'Priority - October', 'Priority - November', 'Priority - December']
            },
            {
                key: 'accountant',
                label: 'Accountant',
                type: 'select',
                field: 'accountant',
                options: ['External', 'Top Grants']
            },
            {
                key: 'darren_risks',
                label: 'Risk Profile',
                type: 'select',
                field: 'darren_risks',
                options: ['Low Risk', 'Medium Risk', 'High Risk']
            },
            {
                key: 'customer_group',
                label: 'Customer Group',
                type: 'link',
                field: 'customer_group',
                doctype: 'Customer Group'
            }
        ];
    }

    // Get data loading configuration for a display type
    getDataLoadingConfig(displayType) {
        const config = this.getDisplayTypeConfig(displayType);
        
        return {
            doctype: config.dataSource,
            fields: this.getRequiredFields(displayType),
            filters: this.getDefaultFilters(displayType),
            order_by: this.getDefaultOrderBy(displayType)
        };
    }

    // Get required fields for data loading
    getRequiredFields(displayType) {
        const config = this.getDisplayTypeConfig(displayType);
        const fields = [config.primaryKey];
        
        // Add all column fields
        config.columns.forEach(column => {
            if (column.field && !fields.includes(column.field)) {
                fields.push(column.field);
            }
        });

        // Add search fields
        config.searchFields.forEach(field => {
            if (!fields.includes(field)) {
                fields.push(field);
            }
        });

        // Add display type specific fields
        switch (displayType) {
            case 'Task-Centric':
                fields.push('description', 'exp_start_date', 'act_start_date', 'act_end_date', 'progress', 'is_template');
                break;
            case 'Contact-Centric':
                fields.push('designation', 'department', 'mobile_no', 'address', 'creation', 'modified');
                break;
            case 'Client-Centric':
                fields.push('customer_group', 'territory', 'customer_type', 'creation', 'modified');
                break;
        }

        return fields;
    }

    // Get default filters for data loading
    getDefaultFilters(displayType) {
        switch (displayType) {
            case 'Task-Centric':
                return [['is_template', '!=', 1]]; // Exclude template tasks
            case 'Contact-Centric':
                return [['status', '!=', 'Disabled']]; // Exclude disabled contacts
            case 'Client-Centric':
                return [['disabled', '!=', 1]]; // Exclude disabled customers
            default:
                return [];
        }
    }

    // Get default order by
    getDefaultOrderBy(displayType) {
        switch (displayType) {
            case 'Task-Centric':
                return 'modified desc';
            case 'Contact-Centric':
                return 'first_name asc';
            case 'Client-Centric':
                return 'customer_name asc';
            default:
                return 'modified desc';
        }
    }

    // Check if display type requires additional data sources
    requiresAdditionalData(displayType) {
        return displayType === 'Client-Centric';
    }

    // Get additional data sources for Client-Centric view
    getAdditionalDataSources(displayType) {
        if (displayType === 'Client-Centric') {
            return [
                {
                    doctype: 'Client Project Info',
                    linkField: 'client',
                    fields: ['client', 'priority_level', 'accountant', 'darren_progress', 'darren_risks', 'industry']
                },
                {
                    doctype: 'Client Referral',
                    linkField: 'client',
                    fields: ['client', 'referral_person', 'relationship_type', 'referral_status']
                }
            ];
        }
        return [];
    }

    // Validate display type
    isValidDisplayType(displayType) {
        return displayType && this.displayTypes.hasOwnProperty(displayType);
    }

    // Get default display type
    getDefaultDisplayType() {
        return 'Task-Centric';
    }
}

// Make DisplayTypeManager globally available
window.DisplayTypeManager = DisplayTypeManager;

// Create global instance
window.displayTypeManager = new DisplayTypeManager();
