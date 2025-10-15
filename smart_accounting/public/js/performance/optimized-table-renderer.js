// Smart Accounting - 优化的表格渲染器
// 解决DOM操作性能问题，实现虚拟滚动和智能渲染

class OptimizedTableRenderer {
    constructor(options = {}) {
        this.container = options.container;
        this.config = window.AppConfig || {};
        
        // 渲染配置 - 企业级优化
        this.rowHeight = options.rowHeight || this.config.get('performance.virtualScrolling.rowHeight', 48);
        this.bufferSize = options.bufferSize || this.config.get('performance.virtualScrolling.bufferSize', 20);
        this.threshold = options.threshold || this.config.get('performance.virtualScrolling.threshold', 200);
        
        // 自适应性能配置 - 根据数据量自动调整
        this.adaptiveConfig = {
            smallDataset: { threshold: 100, chunkSize: 50, bufferSize: 10 },
            mediumDataset: { threshold: 1000, chunkSize: 100, bufferSize: 20 },
            largeDataset: { threshold: 10000, chunkSize: 200, bufferSize: 50 }
        };
        
        // 当前使用的配置
        this.currentConfig = this.adaptiveConfig.smallDataset;
        
        // 状态管理
        this.data = [];
        this.filteredData = [];
        this.visibleRange = { start: 0, end: 0 };
        this.scrollTop = 0;
        this.containerHeight = 0;
        this.totalHeight = 0;
        
        // DOM 元素
        this.viewport = null;
        this.content = null;
        this.spacerTop = null;
        this.spacerBottom = null;
        
        // 性能优化
        this.renderQueue = [];
        this.isRendering = false;
        this.lastRenderTime = 0;
        this.renderThrottle = 16; // 60fps
        
        // 缓存
        this.rowCache = new Map();
        this.templateCache = new Map();
        
        this.init();
    }

    // 初始化
    init() {
        this.createViewport();
        this.bindEvents();
        this.setupAdaptiveRendering();
        console.log('✅ 优化表格渲染器初始化完成');
    }
    
    // 设置自适应渲染
    setupAdaptiveRendering() {
        // 监听数据量变化，自动调整配置
        this.dataObserver = new MutationObserver((mutations) => {
            const rowCount = document.querySelectorAll('.pm-task-row').length;
            this.adaptToDataVolume(rowCount);
        });
        
        // 观察表格容器的变化
        const tableContainer = document.querySelector('.pm-table-container');
        if (tableContainer) {
            this.dataObserver.observe(tableContainer, {
                childList: true,
                subtree: true
            });
        }
    }
    
    // 根据数据量自适应调整
    adaptToDataVolume(dataCount) {
        let newConfig = this.adaptiveConfig.smallDataset;
        
        if (dataCount > 10000) {
            newConfig = this.adaptiveConfig.largeDataset;
        } else if (dataCount > 1000) {
            newConfig = this.adaptiveConfig.mediumDataset;
        }
        
        // 只有配置真正改变时才更新
        if (JSON.stringify(newConfig) !== JSON.stringify(this.currentConfig)) {
            this.currentConfig = newConfig;
            this.applyNewConfig();
            
            console.log(`🔄 Adapted to ${dataCount} items with config:`, newConfig);
        }
    }
    
    // 应用新配置
    applyNewConfig() {
        this.bufferSize = this.currentConfig.bufferSize;
        this.threshold = this.currentConfig.threshold;
        
        // 如果数据量超过阈值，启用虚拟滚动
        if (this.data.length > this.threshold && !this.virtualScrollingEnabled) {
            this.enableVirtualScrolling();
        }
        
        // 重新渲染以应用新配置
        this.scheduleRender();
    }

    // 创建视口
    createViewport() {
        if (!this.container) return;

        // 创建虚拟滚动容器
        this.viewport = document.createElement('div');
        this.viewport.className = 'pm-virtual-viewport';
        this.viewport.style.cssText = `
            height: 100%;
            overflow-y: auto;
            overflow-x: hidden;
            position: relative;
        `;

        // 创建内容容器
        this.content = document.createElement('div');
        this.content.className = 'pm-virtual-content';
        this.content.style.cssText = `
            position: relative;
            min-height: 100%;
        `;

        // 创建占位符
        this.spacerTop = document.createElement('div');
        this.spacerTop.className = 'pm-virtual-spacer-top';
        
        this.spacerBottom = document.createElement('div');
        this.spacerBottom.className = 'pm-virtual-spacer-bottom';

        // 组装DOM结构
        this.content.appendChild(this.spacerTop);
        this.content.appendChild(this.spacerBottom);
        this.viewport.appendChild(this.content);
        this.container.appendChild(this.viewport);
    }

    // 绑定事件
    bindEvents() {
        if (!this.viewport) return;

        // 滚动事件（节流处理）
        let scrollTimer = null;
        this.viewport.addEventListener('scroll', () => {
            if (scrollTimer) clearTimeout(scrollTimer);
            
            scrollTimer = setTimeout(() => {
                this.handleScroll();
            }, 16); // 60fps
        });

        // 窗口大小变化
        window.addEventListener('resize', () => {
            this.updateContainerHeight();
            this.scheduleRender();
        });
    }

    // 设置数据
    setData(data) {
        this.data = Array.isArray(data) ? data : [];
        this.filteredData = [...this.data];
        this.updateTotalHeight();
        this.scheduleRender();
        
        console.log(`📊 表格数据已更新，共 ${this.data.length} 行`);
    }

    // 过滤数据
    filterData(filterFn) {
        if (typeof filterFn === 'function') {
            this.filteredData = this.data.filter(filterFn);
        } else {
            this.filteredData = [...this.data];
        }
        
        this.updateTotalHeight();
        this.scheduleRender();
        
        console.log(`🔍 数据过滤完成，显示 ${this.filteredData.length}/${this.data.length} 行`);
    }

    // 更新总高度
    updateTotalHeight() {
        this.totalHeight = this.filteredData.length * this.rowHeight;
        if (this.content) {
            this.content.style.height = `${this.totalHeight}px`;
        }
    }

    // 更新容器高度
    updateContainerHeight() {
        if (this.viewport) {
            this.containerHeight = this.viewport.clientHeight;
        }
    }

    // 处理滚动
    handleScroll() {
        if (!this.viewport) return;

        this.scrollTop = this.viewport.scrollTop;
        this.updateVisibleRange();
        this.scheduleRender();
    }

    // 更新可见范围
    updateVisibleRange() {
        if (this.filteredData.length === 0) {
            this.visibleRange = { start: 0, end: 0 };
            return;
        }

        const startIndex = Math.floor(this.scrollTop / this.rowHeight);
        const endIndex = Math.min(
            startIndex + Math.ceil(this.containerHeight / this.rowHeight) + this.bufferSize,
            this.filteredData.length
        );

        this.visibleRange = {
            start: Math.max(0, startIndex - this.bufferSize),
            end: endIndex
        };
    }

    // 调度渲染
    scheduleRender() {
        if (this.isRendering) return;

        const now = performance.now();
        if (now - this.lastRenderTime < this.renderThrottle) {
            // 使用 requestAnimationFrame 优化渲染时机
            requestAnimationFrame(() => this.render());
            return;
        }

        this.render();
    }

    // 渲染
    async render() {
        if (this.isRendering) return;
        
        this.isRendering = true;
        this.lastRenderTime = performance.now();

        try {
            // 检查是否需要虚拟滚动
            if (this.filteredData.length <= this.threshold) {
                await this.renderAll();
            } else {
                await this.renderVirtual();
            }
        } catch (error) {
            console.error('❌ 表格渲染错误:', error);
        } finally {
            this.isRendering = false;
        }
    }

    // 渲染所有行（小数据集）
    async renderAll() {
        const fragment = document.createDocumentFragment();
        
        for (let i = 0; i < this.filteredData.length; i++) {
            const row = await this.renderRow(this.filteredData[i], i);
            if (row) {
                fragment.appendChild(row);
            }
        }

        // 清空现有内容并添加新内容
        this.clearContent();
        this.content.insertBefore(fragment, this.spacerBottom);
        
        // 重置占位符
        this.spacerTop.style.height = '0px';
        this.spacerBottom.style.height = '0px';
    }

    // 虚拟渲染（大数据集）
    async renderVirtual() {
        const { start, end } = this.visibleRange;
        const fragment = document.createDocumentFragment();
        
        // 渲染可见行
        for (let i = start; i < end; i++) {
            if (i < this.filteredData.length) {
                const row = await this.renderRow(this.filteredData[i], i);
                if (row) {
                    fragment.appendChild(row);
                }
            }
        }

        // 清空现有内容
        this.clearContent();
        
        // 设置占位符高度
        this.spacerTop.style.height = `${start * this.rowHeight}px`;
        this.spacerBottom.style.height = `${(this.filteredData.length - end) * this.rowHeight}px`;
        
        // 添加可见行
        this.content.insertBefore(fragment, this.spacerBottom);
    }

    // 渲染单行
    async renderRow(rowData, index) {
        // 检查缓存
        const cacheKey = this.getRowCacheKey(rowData, index);
        if (this.rowCache.has(cacheKey)) {
            return this.rowCache.get(cacheKey).cloneNode(true);
        }

        try {
            const row = await this.createRowElement(rowData, index);
            
            // 缓存行元素
            if (this.rowCache.size < 1000) { // 限制缓存大小
                this.rowCache.set(cacheKey, row.cloneNode(true));
            }
            
            return row;
        } catch (error) {
            console.error('❌ 行渲染错误:', error, rowData);
            return this.createErrorRow(error, index);
        }
    }

    // 创建行元素
    async createRowElement(rowData, index) {
        const row = document.createElement('div');
        row.className = 'pm-task-row pm-responsive-table';
        row.dataset.taskId = rowData.task_id || '';
        row.dataset.index = index;
        row.style.height = `${this.rowHeight}px`;

        // 获取列配置
        const columns = this.config.getAllColumns ? this.config.getAllColumns() : {};
        const visibleColumns = this.config.getDefaultVisibleColumns ? 
            this.config.getDefaultVisibleColumns() : 
            ['client', 'task-name', 'status'];

        // 渲染可见列
        for (const columnKey of visibleColumns) {
            const columnConfig = columns[columnKey];
            if (columnConfig) {
                const cell = await this.createCellElement(rowData, columnKey, columnConfig);
                row.appendChild(cell);
            }
        }

        return row;
    }

    // 创建单元格元素
    async createCellElement(rowData, columnKey, columnConfig) {
        const cell = document.createElement('div');
        cell.className = `pm-cell pm-cell-${columnKey}`;
        cell.style.width = `${columnConfig.width || 100}px`;
        
        // 根据列类型渲染内容
        switch (columnConfig.type) {
            case 'checkbox':
                cell.innerHTML = `<input type="checkbox" class="pm-task-checkbox" data-task-id="${rowData.task_id || ''}" title="Select this task">`;
                break;
                
            case 'client_selector':
                cell.innerHTML = `
                    <div class="pm-client-content">
                        <span class="pm-client-selector-trigger client-display" 
                              data-task-id="${rowData.task_id || ''}"
                              data-field="custom_client"
                              data-field-type="client_selector"
                              title="Click to select client">
                            ${this.escapeHtml(rowData.client_name || 'No Client')}
                        </span>
                    </div>
                `;
                break;
                
            case 'task_name_editor':
                cell.innerHTML = `
                    <div class="pm-task-name-content">
                        <span class="editable-field task-name-display">
                            ${this.escapeHtml(rowData.task_name || rowData.subject || 'Untitled Task')}
                        </span>
                        <i class="fa fa-edit pm-edit-icon"></i>
                    </div>
                `;
                break;
                
            case 'status_badge':
                const status = rowData.status || 'open';
                cell.innerHTML = `<span class="pm-status-badge status-${status.toLowerCase()}">${this.escapeHtml(status)}</span>`;
                break;
                
            case 'badge':
                const entityType = rowData.entity_type || 'Company';
                cell.innerHTML = `<span class="pm-entity-badge entity-${entityType.toLowerCase()}">${this.escapeHtml(entityType)}</span>`;
                break;
                
            case 'currency':
                const value = rowData[this.getFieldName(columnKey)];
                if (value && value > 0) {
                    cell.innerHTML = `<span class="pm-currency editable-field">$${parseFloat(value).toFixed(2)}</span>`;
                } else {
                    cell.innerHTML = `<span class="pm-no-amount editable-field">-</span>`;
                }
                break;
                
            case 'date':
                const dateValue = rowData[this.getFieldName(columnKey)];
                cell.innerHTML = `<span class="editable-field">${dateValue || '-'}</span>`;
                break;
                
            default:
                const fieldValue = rowData[this.getFieldName(columnKey)];
                cell.innerHTML = `<span class="editable-field">${this.escapeHtml(fieldValue || '-')}</span>`;
        }

        // 添加编辑属性
        if (columnConfig.type !== 'checkbox' && columnConfig.type !== 'badge') {
            cell.dataset.editable = 'true';
            cell.dataset.field = this.getFieldName(columnKey);
            cell.dataset.taskId = rowData.task_id || '';
            cell.dataset.fieldType = columnConfig.type;
        }

        return cell;
    }

    // 创建错误行
    createErrorRow(error, index) {
        const row = document.createElement('div');
        row.className = 'pm-task-row pm-error-row';
        row.style.height = `${this.rowHeight}px`;
        row.innerHTML = `
            <div class="pm-cell pm-error-cell">
                <i class="fa fa-exclamation-triangle"></i>
                <span>渲染错误 (行 ${index + 1}): ${error.message}</span>
            </div>
        `;
        return row;
    }

    // 清空内容
    clearContent() {
        const children = Array.from(this.content.children);
        children.forEach(child => {
            if (child !== this.spacerTop && child !== this.spacerBottom) {
                this.content.removeChild(child);
            }
        });
    }

    // 获取行缓存键
    getRowCacheKey(rowData, index) {
        return `${rowData.task_id || index}_${rowData.modified || ''}`;
    }

    // 获取字段名映射
    getFieldName(columnKey) {
        const fieldMap = {
            'client': 'client_name',
            'task-name': 'task_name',
            'tf-tg': 'tf_tg',
            'target-month': 'target_month',
            'budget': 'budget_planning',
            'actual': 'actual_billing',
            'action-person': 'action_person',
            'process-date': 'process_date',
            'lodgment-due': 'lodgment_due_date',
            'year-end': 'year_end',
            'last-updated': 'last_updated',
            'reset-date': 'custom_reset_date'
        };
        return fieldMap[columnKey] || columnKey.replace('-', '_');
    }

    // HTML 转义
    escapeHtml(text) {
        if (typeof text !== 'string') return text;
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 滚动到指定行
    scrollToRow(index) {
        if (!this.viewport || index < 0 || index >= this.filteredData.length) return;
        
        const targetScrollTop = index * this.rowHeight;
        this.viewport.scrollTop = targetScrollTop;
    }

    // 获取性能统计
    getPerformanceStats() {
        return {
            totalRows: this.data.length,
            filteredRows: this.filteredData.length,
            visibleRange: this.visibleRange,
            cacheSize: this.rowCache.size,
            isVirtualScrolling: this.filteredData.length > this.threshold,
            lastRenderTime: this.lastRenderTime
        };
    }

    // 清理资源
    destroy() {
        console.log('🧹 清理优化表格渲染器资源...');
        
        // 清理缓存
        this.rowCache.clear();
        this.templateCache.clear();
        
        // 移除事件监听器
        if (this.viewport) {
            this.viewport.removeEventListener('scroll', this.handleScroll);
        }
        window.removeEventListener('resize', this.updateContainerHeight);
        
        // 清理DOM
        if (this.container && this.viewport) {
            this.container.removeChild(this.viewport);
        }
        
        // 重置状态
        this.data = [];
        this.filteredData = [];
        this.isRendering = false;
    }
}

// 创建全局实例
window.OptimizedTableRenderer = OptimizedTableRenderer;

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OptimizedTableRenderer;
}
