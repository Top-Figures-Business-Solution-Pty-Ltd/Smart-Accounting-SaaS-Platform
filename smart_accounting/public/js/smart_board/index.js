/**
 * Smart Board - Entry Point
 * 应用程序入口
 */

import { SmartBoardApp } from './app.js';

// 挂载到frappe全局对象
frappe.provide('smart_accounting');

/**
 * 初始化Smart Board应用
 */
smart_accounting.show_smart_board = function() {
    // 优先 mount 到 Desk Page 提供的容器（避免全屏覆盖/避免污染 body）
    const mountTarget = smart_accounting.__mount_target;
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
    if (smart_accounting.__mount_target) {
        smart_accounting.__mount_target.innerHTML = '';
        smart_accounting.__mount_target = null;
        return;
    }

    const container = document.getElementById('smart-board-container');
    container?.remove();
};

// 如果是通过路由访问，自动显示
if (frappe.get_route()[0] === 'smart-board') {
    frappe.ready(() => {
        smart_accounting.show_smart_board();
    });
}

