// Smart Accounting Access Guard
// Prevents non-administrator users from accessing ERPNext system pages

(function() {
    'use strict';
    
    // Check if we're on an ERPNext system page
    function isERPNextSystemPage() {
        const path = window.location.pathname;
        const erpnextPaths = ['/app', '/desk', '/report', '/dashboard', '/list', '/form', '/tree'];
        return erpnextPaths.some(erpPath => path.startsWith(erpPath));
    }
    
    // Check if current user is Administrator
    function isAdministrator() {
        // Check from various possible sources
        if (window.frappe && frappe.session && frappe.session.user) {
            return frappe.session.user === 'Administrator';
        }
        
        // Check from template data
        const templateData = document.getElementById('template-data');
        if (templateData) {
            const sessionUser = templateData.getAttribute('data-session-user');
            return sessionUser === 'Administrator';
        }
        
        return false;
    }
    
    // Redirect to project management
    function redirectToProjectManagement() {
        console.log('Access Guard: Redirecting non-administrator user to project management');
        window.location.href = '/project_management';
    }
    
    // Main access control function
    function enforceAccessControl() {
        if (isERPNextSystemPage() && !isAdministrator()) {
            console.log('Access Guard: Non-administrator attempting to access ERPNext system page');
            redirectToProjectManagement();
            return false;
        }
        return true;
    }
    
    // Run access control immediately
    if (!enforceAccessControl()) {
        return; // Stop execution if redirecting
    }
    
    // Also monitor for navigation changes (for SPAs)
    if (window.history && window.history.pushState) {
        const originalPushState = window.history.pushState;
        window.history.pushState = function() {
            originalPushState.apply(window.history, arguments);
            setTimeout(enforceAccessControl, 100);
        };
        
        const originalReplaceState = window.history.replaceState;
        window.history.replaceState = function() {
            originalReplaceState.apply(window.history, arguments);
            setTimeout(enforceAccessControl, 100);
        };
    }
    
    // Monitor for hash changes
    window.addEventListener('hashchange', function() {
        setTimeout(enforceAccessControl, 100);
    });
    
    // Periodic check (as a fallback)
    setInterval(enforceAccessControl, 5000);
    
})();
