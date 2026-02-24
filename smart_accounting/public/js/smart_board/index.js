/**
 * Smart Board - Entry Point
 * 应用程序入口
 */

import { SmartBoardApp } from './app.js';

function installSmartBoardQuietCallGuard() {
    const f = window.frappe;
    if (!f || typeof f.call !== 'function') return;
    if (f.call.__sbQuietWrapped) return;

    const original = f.call.bind(f);
    const wrapped = function wrappedFrappeCall(opts, ...rest) {
        if (opts && typeof opts === 'object' && !Array.isArray(opts)) {
            if (!Object.prototype.hasOwnProperty.call(opts, 'quiet')) {
                opts = { ...opts, quiet: true };
            }
            return original(opts, ...rest);
        }
        return original(opts, ...rest);
    };
    wrapped.__sbQuietWrapped = true;
    wrapped.__sbOriginal = original;
    f.call = wrapped;
}

// 挂载到全局对象（Desk 有 frappe.provide，Website 可能没有）
if (window.frappe?.provide) {
    frappe.provide('smart_accounting');
} else {
    window.smart_accounting = window.smart_accounting || {};
}

/**
 * 初始化Smart Board应用
 */
smart_accounting.show_smart_board = function() {
    // Use product-level error presentation by default (no ERPNext raw popups).
    installSmartBoardQuietCallGuard();

    // 优先 mount 到 Desk Page 提供的容器（避免全屏覆盖/避免污染 body）
    const mountTarget = smart_accounting.mount_target || smart_accounting.__mount_target;
    const container = mountTarget || document.createElement('div');

    if (!mountTarget) {
        container.id = 'smart-board-container';
        container.className = 'smart-board-container';
        // Fullscreen 模式：挂到 body，需要覆盖整个视窗
        container.classList.add('smart-board-fullscreen');
        document.body.appendChild(container);
    } else {
        // Embedded 模式：挂到 Desk Page 的 root，避免 fixed 覆盖 Desk
        container.classList.add('smart-board-embedded');
    }
    
    // 初始化应用
    const app = new SmartBoardApp(container);
    
    // 保存实例引用
    smart_accounting.smart_board_instance = app;
    
    return app;
};

/**
 * 销毁Smart Board应用
 */
smart_accounting.hide_smart_board = function() {
    if (smart_accounting.smart_board_instance) {
        smart_accounting.smart_board_instance.destroy();
        smart_accounting.smart_board_instance = null;
    }
    
    // 如果是挂在 Page 的 mount target 上，就只清空内容，不 remove 容器本身
    if (smart_accounting.mount_target || smart_accounting.__mount_target) {
        const target = smart_accounting.mount_target || smart_accounting.__mount_target;
        target.innerHTML = '';
        smart_accounting.mount_target = null;
        smart_accounting.__mount_target = null;
        return;
    }

    const container = document.getElementById('smart-board-container');
    container?.remove();
};

// NOTE:
// We intentionally do NOT auto-mount based on Desk route here.
// - /app routes are Desk-specific and rely on Desk APIs (get_route, ready, etc.)
// - /smart (website shell) mounts explicitly from the page template.

