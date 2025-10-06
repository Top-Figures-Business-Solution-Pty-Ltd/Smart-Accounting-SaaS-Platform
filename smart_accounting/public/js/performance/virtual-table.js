// Smart Accounting - Virtual Table Manager
// 虚拟滚动表格，提升大数据渲染性能

class VirtualTableManager {
    constructor(options = {}) {
        this.container = options.container || '.pm-table-body';
        this.rowHeight = options.rowHeight || 48;
        this.bufferSize = options.bufferSize || 10;
        this.visibleRows = options.visibleRows || 20;
        
        this.data = [];
        this.filteredData = [];
        this.renderedRows = new Map();
        this.scrollTop = 0;
        this.containerHeight = 0;
        
        this.init();
    }

    init() {
        this.setupContainer();
        this.bindEvents();
    }

    setupContainer() {
        const $container = $(this.container);
        if (!$container.length) return;

        // 创建虚拟滚动容器
        $container.addClass('pm-virtual-table');
        
        // 创建滚动区域
        this.scrollContainer = $('<div class="pm-virtual-scroll-container"></div>');
        this.viewport = $('<div class="pm-virtual-viewport"></div>');
        
        $container.append(this.scrollContainer);
        this.scrollContainer.append(this.viewport);
        
        this.updateContainerHeight();
    }

    bindEvents() {
        // 滚动事件优化
        let scrollTimer;
        this.scrollContainer.on('scroll', () => {
            clearTimeout(scrollTimer);
            scrollTimer = setTimeout(() => {
                this.handleScroll();
            }, 16); // 60fps
        });

        // 窗口大小变化
        $(window).on('resize.virtual-table', () => {
            this.updateContainerHeight();
            this.render();
        });
    }

    // 设置数据
    setData(data) {
        this.data = data;
        this.filteredData = [...data];
        this.updateScrollHeight();
        this.render();
    }

    // 过滤数据
    filterData(filterFn) {
        this.filteredData = this.data.filter(filterFn);
        this.updateScrollHeight();
        this.render();
    }

    // 处理滚动
    handleScroll() {
        const newScrollTop = this.scrollContainer.scrollTop();
        if (Math.abs(newScrollTop - this.scrollTop) < this.rowHeight / 2) {
            return; // 避免频繁重渲染
        }
        
        this.scrollTop = newScrollTop;
        this.render();
    }

    // 计算可见范围
    getVisibleRange() {
        const startIndex = Math.floor(this.scrollTop / this.rowHeight);
        const endIndex = Math.min(
            startIndex + this.visibleRows + this.bufferSize,
            this.filteredData.length
        );
        
        return {
            start: Math.max(0, startIndex - this.bufferSize),
            end: endIndex
        };
    }

    // 渲染可见行
    render() {
        const { start, end } = this.getVisibleRange();
        const fragment = document.createDocumentFragment();
        
        // 清理不在可见范围内的行
        this.cleanupInvisibleRows(start, end);
        
        // 渲染可见行
        for (let i = start; i < end; i++) {
            if (!this.renderedRows.has(i)) {
                const row = this.createRow(this.filteredData[i], i);
                this.renderedRows.set(i, row);
            }
            
            const row = this.renderedRows.get(i);
            this.positionRow(row, i);
            fragment.appendChild(row);
        }
        
        this.viewport.empty().append(fragment);
    }

    // 创建行元素
    createRow(data, index) {
        const row = document.createElement('div');
        row.className = 'pm-task-row pm-virtual-row';
        row.style.position = 'absolute';
        row.style.width = '100%';
        row.style.height = `${this.rowHeight}px`;
        row.dataset.index = index;
        row.dataset.taskId = data.task_id;
        
        // 使用模板渲染行内容
        row.innerHTML = this.renderRowContent(data);
        
        return row;
    }

    // 渲染行内容（优化的模板）
    renderRowContent(data) {
        return `
            <div class="pm-cell pm-cell-select">
                <input type="checkbox" class="pm-task-checkbox" data-task-id="${data.task_id}">
            </div>
            <div class="pm-cell pm-cell-client">
                <span class="client-display">${data.client_name || 'No Client'}</span>
            </div>
            <div class="pm-cell pm-cell-task-name">
                <span class="task-name-display">${data.task_name || 'Untitled Task'}</span>
            </div>
            <div class="pm-cell pm-cell-status">
                <span class="pm-status-badge">${data.status || 'Open'}</span>
            </div>
            <div class="pm-cell pm-cell-priority">
                <span class="pm-priority-badge">${data.priority || 'Medium'}</span>
            </div>
        `;
    }

    // 定位行
    positionRow(row, index) {
        row.style.transform = `translateY(${index * this.rowHeight}px)`;
    }

    // 清理不可见行
    cleanupInvisibleRows(visibleStart, visibleEnd) {
        const toRemove = [];
        
        this.renderedRows.forEach((row, index) => {
            if (index < visibleStart || index >= visibleEnd) {
                toRemove.push(index);
            }
        });
        
        toRemove.forEach(index => {
            this.renderedRows.delete(index);
        });
    }

    // 更新容器高度
    updateContainerHeight() {
        this.containerHeight = this.scrollContainer.height();
        this.visibleRows = Math.ceil(this.containerHeight / this.rowHeight);
    }

    // 更新滚动高度
    updateScrollHeight() {
        const totalHeight = this.filteredData.length * this.rowHeight;
        this.viewport.css('height', `${totalHeight}px`);
    }

    // 滚动到指定行
    scrollToRow(index) {
        const targetScrollTop = index * this.rowHeight;
        this.scrollContainer.scrollTop(targetScrollTop);
    }

    // 销毁
    destroy() {
        $(window).off('resize.virtual-table');
        this.scrollContainer.off('scroll');
        this.renderedRows.clear();
    }
}

// 全局实例
window.VirtualTableManager = VirtualTableManager;

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VirtualTableManager;
}
