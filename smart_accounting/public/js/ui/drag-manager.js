// Project Management - Drag and Drop Manager
// Handles all drag and drop functionality for column reordering

class DragManager {
    constructor() {
        this.draggedElement = null;
        this.placeholder = null;
        this.container = null;
        this.onOrderChange = null;
    }

    /**
     * 初始化拖拽功能
     * @param {string} containerId - 容器ID
     * @param {Function} onOrderChange - 顺序改变时的回调函数
     */
    initializeDragSort(containerId, onOrderChange = null) {
        console.log('🎯 Initializing drag sort for container:', containerId);
        
        // 先清理之前的状态
        this.cleanup();
        
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error('❌ Container not found:', containerId);
            return false;
        }
        
        this.onOrderChange = onOrderChange;
        
        const columnItems = this.container.querySelectorAll('.pm-column-item');
        const dragHandles = this.container.querySelectorAll('.pm-column-drag-handle');
        
        // console.log Found ${columnItems.length} items and ${dragHandles.length} drag handles`);
        
        if (dragHandles.length === 0) {
            console.warn('⚠️ No drag handles found - drag functionality may not work');
        }
        
        // 绑定事件监听器
        this.bindDragEvents();
        
        // 设置拖拽句柄样式
        this.setupDragHandles();
        
        console.log('🎉 Drag sort initialized successfully!');
        return true;
    }

    /**
     * 绑定拖拽事件
     */
    bindDragEvents() {
        console.log('🔗 Binding drag events to container');
        
        // 鼠标事件 - 使用capture模式确保优先执行
        this.container.addEventListener('mousedown', (e) => {
            console.log('🖱️ Mouse down detected on:', e.target);
            this.handleDragStart(e, e.clientY);
        }, true); // capture = true
        
        // 触摸事件
        this.container.addEventListener('touchstart', (e) => {
            console.log('👆 Touch start detected');
            if (e.touches.length === 1) {
                this.handleDragStart(e, e.touches[0].clientY);
            }
        }, { passive: false, capture: true });
    }

    /**
     * 处理拖拽开始
     */
    handleDragStart(e, clientY) {
        console.log('🎯 handleDragStart called with target:', e.target);
        
        const handle = e.target.closest('.pm-column-drag-handle');
        console.log('🔍 Found drag handle:', !!handle);
        
        if (!handle) {
            console.log('❌ No drag handle found, target classes:', e.target.className);
            return;
        }

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        const columnItem = handle.closest('.pm-column-item');
        console.log('🔍 Found column item:', !!columnItem);
        
        if (!columnItem) {
            console.log('❌ No column item found');
            return;
        }

        console.log('🎯 Drag started for:', columnItem.dataset.column);
        
        this.draggedElement = columnItem;
        
        // 创建占位符
        this.createPlaceholder();
        
        // 添加拖拽样式
        this.applyDragStyles(columnItem);
        
        // 延迟添加全局事件监听器，确保当前事件处理完毕
        setTimeout(() => {
            this.addGlobalListeners();
            // console.log Drag initialization complete, waiting for mouse move...');
        }, 10);
    }

    /**
     * 创建占位符
     */
    createPlaceholder() {
        this.placeholder = document.createElement('div');
        this.placeholder.className = 'pm-column-placeholder';
        this.placeholder.innerHTML = ''; // CSS会添加"Drop here"文字
    }

    /**
     * 应用拖拽样式
     */
    applyDragStyles(element) {
        element.classList.add('pm-dragging');
        element.style.position = 'relative';
        element.style.zIndex = '1000';
        element.style.transform = 'rotate(2deg)';
        element.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    }

    /**
     * 移除拖拽样式
     */
    removeDragStyles(element) {
        element.classList.remove('pm-dragging');
        element.style.position = '';
        element.style.zIndex = '';
        element.style.transform = '';
        element.style.boxShadow = '';
    }

    /**
     * 添加全局事件监听器
     */
    addGlobalListeners() {
        console.log('🔗 Adding global event listeners for drag');
        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('mouseup', this.handleDragEnd);
        document.addEventListener('touchmove', this.handleTouchMove, { passive: false });
        document.addEventListener('touchend', this.handleDragEnd);
        
        // 防止页面滚动和其他默认行为
        document.addEventListener('selectstart', this.preventDefaultDrag);
        document.addEventListener('dragstart', this.preventDefaultDrag);
    }

    /**
     * 移除全局事件监听器
     */
    removeGlobalListeners() {
        console.log('🗑️ Removing global event listeners');
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleDragEnd);
        document.removeEventListener('touchmove', this.handleTouchMove);
        document.removeEventListener('touchend', this.handleDragEnd);
        document.removeEventListener('selectstart', this.preventDefaultDrag);
        document.removeEventListener('dragstart', this.preventDefaultDrag);
    }
    
    /**
     * 防止默认拖拽行为
     */
    preventDefaultDrag = (e) => {
        if (this.draggedElement) {
            e.preventDefault();
            return false;
        }
    }

    /**
     * 处理鼠标移动
     */
    handleMouseMove = (e) => {
        if (this.draggedElement) {
            console.log('🖱️ Mouse move during drag, Y:', e.clientY);
            this.updatePlaceholderPosition(e.clientY);
        }
    }

    /**
     * 处理触摸移动
     */
    handleTouchMove = (e) => {
        e.preventDefault();
        if (e.touches.length === 1) {
            this.updatePlaceholderPosition(e.touches[0].clientY);
        }
    }

    /**
     * 更新占位符位置
     */
    updatePlaceholderPosition(clientY) {
        if (!this.draggedElement || !this.container) return;

        const items = Array.from(this.container.children).filter(item => 
            item !== this.draggedElement && !item.classList.contains('pm-column-placeholder')
        );

        let insertAfter = null;
        
        // 找到应该插入的位置
        for (let item of items) {
            const rect = item.getBoundingClientRect();
            if (clientY > rect.top + rect.height / 2) {
                insertAfter = item;
            }
        }

        // 移除现有占位符
        if (this.placeholder && this.placeholder.parentNode) {
            this.placeholder.parentNode.removeChild(this.placeholder);
        }

        // 插入占位符到正确位置
        if (insertAfter) {
            insertAfter.parentNode.insertBefore(this.placeholder, insertAfter.nextSibling);
        } else {
            this.container.insertBefore(this.placeholder, this.container.firstChild);
        }
    }

    /**
     * 处理拖拽结束
     */
    handleDragEnd = (e) => {
        console.log('🔚 handleDragEnd called, event type:', e.type, 'dragged element exists:', !!this.draggedElement);
        
        if (!this.draggedElement) {
            console.log('❌ No dragged element, ignoring dragEnd');
            return;
        }

        console.log('🎯 Drag ended for:', this.draggedElement.dataset.column);

        // 移除拖拽样式
        this.removeDragStyles(this.draggedElement);

        // 将拖拽元素移动到占位符位置
        if (this.placeholder && this.placeholder.parentNode) {
            this.placeholder.parentNode.insertBefore(this.draggedElement, this.placeholder);
            this.placeholder.parentNode.removeChild(this.placeholder);
            
            // 添加重排序效果
            this.showReorderEffect(this.draggedElement);

            // 触发顺序改变回调
            if (this.onOrderChange) {
                this.onOrderChange();
            }
        }

        // 清理
        this.cleanup();
    }

    /**
     * 显示重排序效果
     */
    showReorderEffect(element) {
        element.classList.add('pm-reordered');
        setTimeout(() => {
            element.classList.remove('pm-reordered');
        }, 1000);
    }

    /**
     * 清理拖拽状态
     */
    cleanup() {
        // 清理当前拖拽状态
        if (this.draggedElement) {
            this.removeDragStyles(this.draggedElement);
        }
        
        this.draggedElement = null;
        this.placeholder = null;
        this.removeGlobalListeners();
        
        // 不要清空容器引用和回调，保持拖拽功能可用
        // this.container = null;  // 注释掉这行
        // this.onOrderChange = null;  // 注释掉这行
        
        console.log('🧹 Drag state cleaned, ready for next drag');
    }

    /**
     * 设置拖拽句柄样式
     */
    setupDragHandles() {
        const handles = this.container.querySelectorAll('.pm-column-drag-handle');
        handles.forEach(handle => {
            handle.style.cursor = 'move';
            handle.setAttribute('title', 'Drag to reorder');
        });
    }

    /**
     * 获取当前元素顺序
     * @returns {Array} 元素的data-column属性数组
     */
    getCurrentOrder() {
        if (!this.container) return [];
        
        const items = this.container.querySelectorAll('.pm-column-item');
        return Array.from(items).map(item => item.dataset.column).filter(Boolean);
    }

    /**
     * 销毁拖拽管理器
     */
    destroy() {
        this.cleanup();
        // 完全销毁时才清空引用
        this.container = null;
        this.onOrderChange = null;
        console.log('🗑️ DragManager destroyed');
    }
}

// 创建全局实例
window.DragManager = new DragManager();

// Export for module systems if available
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DragManager;
}
