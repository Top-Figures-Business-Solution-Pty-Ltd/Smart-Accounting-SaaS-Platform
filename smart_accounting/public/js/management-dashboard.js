// Management Dashboard - Main Controller
// Handles dashboard interactions and module navigation

class ManagementDashboard {
    constructor() {
        this.currentModule = null;
        this.dashboardData = null;
        this.refreshInterval = null;
        
        this.init();
    }

    async init() {
        console.log('🚀 Initializing Management Dashboard...');
        
        try {
            // Bind events
            this.bindEvents();
            
            // Load initial data
            await this.loadDashboardData();
            
            // Start auto-refresh (every 5 minutes)
            this.startAutoRefresh();
            
            console.log('✅ Management Dashboard initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing Management Dashboard:', error);
            this.showError('Failed to initialize dashboard');
        }
    }

    bindEvents() {
        // Breadcrumb navigation - using PM breadcrumb classes
        $(document).on('click', '.pm-breadcrumb-item[data-view="main"]', (e) => {
            e.preventDefault();
            this.navigateToProjectManagement();
        });

        // Refresh button
        $(document).on('click', '.mgmt-refresh-btn', (e) => {
            e.preventDefault();
            this.refreshDashboard();
        });

        // Module entry buttons
        $(document).on('click', '.mgmt-module-enter', (e) => {
            e.preventDefault();
            const module = $(e.currentTarget).data('module');
            this.enterModule(module);
        });

        // Quick action buttons
        $(document).on('click', '.mgmt-quick-action', (e) => {
            e.preventDefault();
            const action = $(e.currentTarget).data('action');
            this.executeQuickAction(action);
        });

        // Module card hover effects
        $(document).on('mouseenter', '.mgmt-module-card', (e) => {
            $(e.currentTarget).addClass('mgmt-card-hover');
        });

        $(document).on('mouseleave', '.mgmt-module-card', (e) => {
            $(e.currentTarget).removeClass('mgmt-card-hover');
        });

        // Handle window resize
        $(window).on('resize', () => {
            this.handleResize();
        });
    }

    async loadDashboardData() {
        try {
            console.log('📊 Loading dashboard data...');
            
            const response = await frappe.call({
                method: 'smart_accounting.www.management_dashboard.index.get_dashboard_stats',
                freeze: false
            });

            if (response.message) {
                this.dashboardData = response.message;
                this.updateDashboardUI();
                console.log('✅ Dashboard data loaded successfully');
            }
        } catch (error) {
            console.error('❌ Error loading dashboard data:', error);
            this.showError('Failed to load dashboard data');
        }
    }

    updateDashboardUI() {
        if (!this.dashboardData) return;

        // Update module stats only
        this.updateModuleStats();
    }

    updateModuleStats() {
        const { client_stats, engagement_stats } = this.dashboardData;

        // Update Client Management module stats - only clients count
        $('.mgmt-module-clients .mgmt-stat-number').text(client_stats.total_customers || 0);
        
        // Update Engagement Management module stats - only total count
        $('.mgmt-module-engagements .mgmt-stat-number').text(engagement_stats.total || 0);

        // Add animation to updated numbers
        $('.mgmt-stat-number').addClass('mgmt-number-updated');
        setTimeout(() => {
            $('.mgmt-stat-number').removeClass('mgmt-number-updated');
        }, 1000);
    }

    async refreshDashboard() {
        console.log('🔄 Refreshing dashboard...');
        
        const $refreshBtn = $('.mgmt-refresh-btn');
        const $icon = $refreshBtn.find('i');
        
        // Show loading state
        $icon.addClass('fa-spin');
        $refreshBtn.prop('disabled', true);
        
        try {
            await this.loadDashboardData();
            
            frappe.show_alert({
                message: 'Dashboard refreshed successfully',
                indicator: 'green'
            });
        } catch (error) {
            console.error('❌ Error refreshing dashboard:', error);
            frappe.show_alert({
                message: 'Failed to refresh dashboard',
                indicator: 'red'
            });
        } finally {
            // Reset loading state
            $icon.removeClass('fa-spin');
            $refreshBtn.prop('disabled', false);
        }
    }

    enterModule(module) {
        console.log(`🎯 Entering module: ${module}`);

        switch (module) {
            case 'clients':
                this.enterClientManagement();
                break;
            case 'contacts':
                this.showComingSoon('Contact Management');
                break;
            case 'engagements':
                this.showComingSoon('Engagement Management');
                break;
            case 'analytics':
                this.showComingSoon('Analytics & Reports');
                break;
            default:
                console.warn(`Unknown module: ${module}`);
        }
    }

    enterClientManagement() {
        // Navigate to the dedicated Client Management page
        window.location.href = '/client_management';
    }

    executeQuickAction(action) {
        console.log(`⚡ Executing quick action: ${action}`);

        switch (action) {
            case 'export-data':
                this.showComingSoon('Export Data');
                break;
            default:
                console.warn(`Unknown action: ${action}`);
        }
    }

    showComingSoon(feature) {
        frappe.show_alert({
            message: `${feature} feature is coming soon!`,
            indicator: 'blue'
        });
    }

    navigateToProjectManagement() {
        window.location.href = '/project_management';
    }

    startAutoRefresh() {
        // Refresh every 5 minutes
        this.refreshInterval = setInterval(() => {
            this.loadDashboardData();
        }, 5 * 60 * 1000);
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    handleResize() {
        // Handle responsive layout adjustments if needed
        const width = $(window).width();
        
        if (width < 768) {
            $('.mgmt-modules-grid').addClass('mgmt-mobile-layout');
        } else {
            $('.mgmt-modules-grid').removeClass('mgmt-mobile-layout');
        }
    }

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

    showError(message) {
        frappe.show_alert({
            message: message,
            indicator: 'red'
        });
    }

    // Cleanup method
    destroy() {
        this.stopAutoRefresh();
        $(document).off('.mgmt-dashboard');
        $(window).off('resize');
    }
}

// Additional CSS for animations and effects
const dashboardStyles = `
<style>
.mgmt-card-hover {
    transform: translateY(-4px) !important;
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.15) !important;
}

.mgmt-number-updated {
    animation: mgmt-numberPulse 0.6s ease-out;
}

@keyframes mgmt-numberPulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); color: var(--monday-blue); }
    100% { transform: scale(1); }
}

.mgmt-mobile-layout .mgmt-module-card {
    margin-bottom: 16px;
}

.mgmt-mobile-layout .mgmt-module-actions {
    flex-direction: column;
    gap: 8px;
}

.mgmt-mobile-layout .mgmt-module-actions .mgmt-btn {
    width: 100%;
    justify-content: center;
}
</style>
`;

// Initialize when DOM is ready
$(document).ready(function() {
    // Add dashboard styles
    $('head').append(dashboardStyles);
    
    // Initialize Management Dashboard
    window.managementDashboard = new ManagementDashboard();
    
    console.log('🎛️ Management Dashboard interface initialized');
});

// Cleanup on page unload
$(window).on('beforeunload', function() {
    if (window.managementDashboard) {
        window.managementDashboard.destroy();
    }
});
