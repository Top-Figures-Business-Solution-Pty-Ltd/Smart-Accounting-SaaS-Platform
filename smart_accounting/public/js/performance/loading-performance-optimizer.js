// Loading Performance Optimizer - 页面加载性能优化器
// 减少加载时间，优化资源加载策略

class LoadingPerformanceOptimizer {
    constructor() {
        this.config = window.AppConfig || {};
        this.performanceMetrics = {
            startTime: Date.now(),
            domContentLoaded: 0,
            firstPaint: 0,
            firstContentfulPaint: 0,
            largestContentfulPaint: 0,
            loadComplete: 0
        };
        
        // 资源优先级配置
        this.resourcePriorities = {
            critical: ['app-config.js', 'enhanced-loading-system.js'],
            high: ['main.js', 'common.css', 'project_management.css'],
            normal: ['reports.js', 'editors.js', 'ui/*.js'],
            low: ['debug/*.js', 'utils/*.js']
        };
        
        this.init();
    }
    
    init() {
        this.setupPerformanceMonitoring();
        this.optimizeCSSDelivery();
    }
    
    // 设置性能监控
    setupPerformanceMonitoring() {
        // 记录关键时间点
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.performanceMetrics.domContentLoaded = Date.now();
            });
        } else {
            this.performanceMetrics.domContentLoaded = Date.now();
        }
        
        // 简化的性能监控 - 避免PerformanceObserver错误
        if (window.performance && window.performance.getEntriesByType) {
            try {
                const paintEntries = window.performance.getEntriesByType('paint');
                paintEntries.forEach(entry => {
                    if (entry.name === 'first-paint') {
                        this.performanceMetrics.firstPaint = entry.startTime;
                    } else if (entry.name === 'first-contentful-paint') {
                        this.performanceMetrics.firstContentfulPaint = entry.startTime;
                    }
                });
            } catch (e) {
                // 性能API不支持，跳过
            }
        }
        
        // 页面加载完成
        window.addEventListener('load', () => {
            this.performanceMetrics.loadComplete = Date.now();
            this.reportPerformanceMetrics();
        });
    }
    
    // 优化资源加载 - 简化版本
    optimizeResourceLoading() {
        // 简单的图片懒加载
        const images = document.querySelectorAll('img:not([loading])');
        images.forEach(img => {
            img.loading = 'lazy';
        });
    }
    
    // 预连接到域名
    preconnectToDomains(domains) {
        domains.forEach(domain => {
            const link = document.createElement('link');
            link.rel = 'preconnect';
            link.href = domain;
            document.head.appendChild(link);
        });
    }
    
    // 字体加载优化已移除 - 避免404错误
    
    // 优化图片加载
    optimizeImageLoading() {
        // 为图片添加loading="lazy"属性
        const images = document.querySelectorAll('img:not([loading])');
        images.forEach(img => {
            // 视口内的图片立即加载，其他延迟加载
            const rect = img.getBoundingClientRect();
            const isInViewport = rect.top < window.innerHeight && rect.bottom > 0;
            
            if (!isInViewport) {
                img.loading = 'lazy';
            }
        });
    }
    
    // 预加载提示已移除 - 避免重复加载错误
    
    // 优化CSS交付
    optimizeCSSDelivery() {
        // 内联关键CSS
        this.inlineCriticalCSS();
    }
    
    // 内联关键CSS
    inlineCriticalCSS() {
        const criticalCSS = `
            /* 关键CSS - 防止FOUC */
            body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                margin: 0;
                padding: 0;
                background: #f8f9fa;
            }
            
            .pm-enhanced-loading-container {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .pm-table-container {
                opacity: 0;
                transition: opacity 0.6s ease;
            }
            
            .pm-content-ready .pm-table-container {
                opacity: 1;
            }
        `;
        
        const style = document.createElement('style');
        style.textContent = criticalCSS;
        document.head.insertBefore(style, document.head.firstChild);
    }
    
    // CSS异步加载已移除 - 避免加载冲突
    
    // 懒加载功能已移除 - 简化代码避免错误
    
    // 报告性能指标
    reportPerformanceMetrics() {
        const metrics = {
            ...this.performanceMetrics,
            totalLoadTime: this.performanceMetrics.loadComplete - this.performanceMetrics.startTime,
            timeToInteractive: this.performanceMetrics.domContentLoaded - this.performanceMetrics.startTime
        };
        
        // 性能指标记录 - 不输出到控制台避免噪音
        
        // 发送性能数据到分析服务（如果配置）
        this.sendPerformanceData(metrics);
    }
    
    // 发送性能数据
    sendPerformanceData(metrics) {
        // 检查是否配置了性能监控
        if (window.gtag && metrics.totalLoadTime > 0) {
            window.gtag('event', 'page_load_performance', {
                'custom_parameter_1': Math.round(metrics.totalLoadTime),
                'custom_parameter_2': Math.round(metrics.timeToInteractive),
                'custom_parameter_3': Math.round(metrics.firstContentfulPaint)
            });
        }
    }
    
    // 获取性能建议
    getPerformanceRecommendations() {
        const recommendations = [];
        const metrics = this.performanceMetrics;
        
        if (metrics.firstContentfulPaint > 2000) {
            recommendations.push('Consider optimizing critical CSS delivery');
        }
        
        if (metrics.largestContentfulPaint > 4000) {
            recommendations.push('Optimize largest content element loading');
        }
        
        if (metrics.totalLoadTime > 5000) {
            recommendations.push('Consider code splitting and lazy loading');
        }
        
        return recommendations;
    }
    
    // 页面优化已简化
    optimizeCurrentPage() {
        // 启用硬件加速
        this.enableHardwareAcceleration();
    }
    
    // CSS优化已简化 - 避免复杂的DOM操作
    
    // DOM结构优化已简化 - 避免意外删除元素
    
    // 元素合并已移除 - 避免破坏页面结构
    
    // 启用硬件加速
    enableHardwareAcceleration() {
        const acceleratedElements = document.querySelectorAll(
            '.pm-table-container, .pm-task-row, .pm-enhanced-loading-container'
        );
        
        acceleratedElements.forEach(element => {
            element.style.transform = 'translateZ(0)';
            element.style.willChange = 'transform, opacity';
        });
    }
    
    // 获取性能指标
    getMetrics() {
        return { ...this.performanceMetrics };
    }
    
    // 清理资源
    destroy() {
        // 清理硬件加速
        const acceleratedElements = document.querySelectorAll('[style*="translateZ"]');
        acceleratedElements.forEach(element => {
            element.style.transform = '';
            element.style.willChange = '';
        });
    }
}

// 创建全局实例
window.LoadingPerformanceOptimizer = new LoadingPerformanceOptimizer();

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LoadingPerformanceOptimizer;
}
