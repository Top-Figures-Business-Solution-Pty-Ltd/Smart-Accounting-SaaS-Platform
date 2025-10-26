// Performance Monitor - 综合性能监控
// 监控关键性能指标，包括CLS、LCP、FID等，确保SaaS级别的用户体验

class PerformanceMonitor {
    constructor() {
        this.metrics = {
            cls: 0,
            fcp: 0,
            lcp: 0,
            fid: 0,
            ttfb: 0,
            loadTime: 0,
            renderTime: 0
        };
        
        this.thresholds = {
            cls: 0.1,      // Good: < 0.1
            fcp: 1800,     // Good: < 1.8s
            lcp: 2500,     // Good: < 2.5s
            fid: 100,      // Good: < 100ms
            ttfb: 800      // Good: < 0.8s
        };
        
        this.observers = new Map();
        this.startTime = Date.now();
        
        this.init();
    }
    
    init() {
        // 等待DOM加载完成
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.setupMonitoring();
            });
        } else {
            this.setupMonitoring();
        }
    }
    
    setupMonitoring() {
        // 监控Core Web Vitals
        this.monitorCLS();
        this.monitorLCP();
        this.monitorFID();
        this.monitorFCP();
        this.monitorTTFB();
        
        // 监控自定义指标
        this.monitorLoadTime();
        this.monitorRenderTime();
        
        // 监控资源性能
        this.monitorResourceTiming();
        
        // 设置定期报告
        this.setupReporting();
    }
    
    // 监控累积布局偏移 (CLS)
    monitorCLS() {
        if (!('LayoutShift' in window)) {
            console.warn('LayoutShift not supported');
            return;
        }
        
        const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                // 只计算非用户输入导致的布局偏移
                if (!entry.hadRecentInput) {
                    this.metrics.cls += entry.value;
                    
                    // 记录具体的布局偏移信息
                    this.logLayoutShift(entry);
                    
                    // 如果CLS超过阈值，尝试自动修复
                    if (entry.value > 0.05) {
                        this.attemptCLSFix(entry);
                    }
                    
                    // 如果总CLS超过阈值，发出警告
                    if (this.metrics.cls > this.thresholds.cls) {
                        this.reportCLSIssue(entry);
                    }
                }
            }
        });
        
        observer.observe({ entryTypes: ['layout-shift'] });
        this.observers.set('cls', observer);
    }
    
    // 记录布局偏移详情
    logLayoutShift(entry) {
        console.log('📐 Layout Shift detected:', {
            value: entry.value.toFixed(4),
            sources: entry.sources?.map(source => ({
                element: source.node?.tagName || 'unknown',
                previousRect: source.previousRect,
                currentRect: source.currentRect
            }))
        });
    }
    
    // 报告CLS问题
    reportCLSIssue(entry) {
        console.warn('⚠️ High CLS detected:', {
            totalCLS: this.metrics.cls.toFixed(4),
            threshold: this.thresholds.cls,
            latestShift: entry.value.toFixed(4),
            time: entry.startTime
        });
        
        // 尝试自动修复
        this.attemptCLSFix(entry);
    }
    
    // 尝试修复CLS问题
    attemptCLSFix(entry) {
        try {
            // 确保图片有尺寸属性
            this.fixImageDimensions();
            
            // 确保字体加载不影响布局
            this.fixFontLoading();
            
            // 确保动态内容有预留空间
            this.fixDynamicContent();
            
            // 针对具体元素进行修复
            if (entry && entry.sources && Array.isArray(entry.sources)) {
                entry.sources.forEach(source => {
                    if (source && source.node) {
                        this.fixSpecificElement(source.node);
                    }
                });
            }
        } catch (error) {
            console.debug('CLS fix attempt failed:', error);
        }
    }
    
    // 修复特定元素
    fixSpecificElement(element) {
        if (!element) return;
        
        const className = element.className || '';
        const tagName = element.tagName.toLowerCase();
        
        // 针对已知问题元素进行修复
        if (className.includes('pm-combination-board-badge')) {
            element.style.minWidth = '80px';
            element.style.height = '24px';
            element.style.display = 'inline-flex';
            element.style.alignItems = 'center';
            element.style.justifyContent = 'center';
        } else if (className.includes('pm-combination-boards-container')) {
            element.style.minHeight = '400px';
            element.style.contain = 'layout';
        } else if (tagName === 'h2') {
            element.style.minHeight = '32px';
            element.style.lineHeight = '1.2';
        } else if (className.includes('pm-summary')) {
            element.style.minHeight = '60px';
            element.style.display = 'flex';
            element.style.alignItems = 'center';
        } else if (className.includes('pm-actions') || className.includes('pm-search')) {
            element.style.minHeight = '50px';
            element.style.display = 'flex';
            element.style.alignItems = 'center';
        }
        
        console.log('🔧 Applied CLS fix to element:', element);
    }
    
    // 修复图片尺寸问题
    fixImageDimensions() {
        const images = document.querySelectorAll('img:not([width]):not([height])');
        images.forEach(img => {
            if (img.naturalWidth && img.naturalHeight) {
                img.width = img.naturalWidth;
                img.height = img.naturalHeight;
            }
        });
    }
    
    // 修复字体加载问题
    fixFontLoading() {
        if ('fonts' in document) {
            document.fonts.ready.then(() => {
                // console.log Fonts loaded, layout should be stable');
            });
        }
    }
    
    // 修复动态内容问题
    fixDynamicContent() {
        // 为动态加载的内容添加最小高度
        const dynamicContainers = document.querySelectorAll('[data-dynamic]');
        dynamicContainers.forEach(container => {
            if (!container.style.minHeight) {
                container.style.minHeight = '100px';
            }
        });
    }
    
    // 监控最大内容绘制 (LCP)
    monitorLCP() {
        if (!('LargestContentfulPaint' in window)) {
            console.warn('LargestContentfulPaint not supported');
            return;
        }
        
        const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            this.metrics.lcp = lastEntry.startTime;
            
            console.log('🎨 LCP:', {
                time: `${this.metrics.lcp.toFixed(2)}ms`,
                element: lastEntry.element?.tagName || 'unknown',
                url: lastEntry.url || 'N/A'
            });
            
            if (this.metrics.lcp > this.thresholds.lcp) {
                this.reportLCPIssue(lastEntry);
            }
        });
        
        observer.observe({ entryTypes: ['largest-contentful-paint'] });
        this.observers.set('lcp', observer);
    }
    
    // 报告LCP问题
    reportLCPIssue(entry) {
        console.warn('⚠️ Slow LCP detected:', {
            lcp: `${this.metrics.lcp.toFixed(2)}ms`,
            threshold: `${this.thresholds.lcp}ms`,
            element: entry.element?.tagName,
            suggestions: this.getLCPSuggestions(entry)
        });
    }
    
    // 获取LCP优化建议
    getLCPSuggestions(entry) {
        const suggestions = [];
        
        if (entry.element?.tagName === 'IMG') {
            suggestions.push('Optimize image loading with preload or lazy loading');
            suggestions.push('Use next-gen image formats (WebP, AVIF)');
        }
        
        if (entry.url) {
            suggestions.push('Optimize resource loading order');
            suggestions.push('Use CDN for faster delivery');
        }
        
        return suggestions;
    }
    
    // 监控首次输入延迟 (FID)
    monitorFID() {
        if (!('FirstInputDelay' in window)) {
            console.warn('FirstInputDelay not supported');
            return;
        }
        
        const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                this.metrics.fid = entry.processingStart - entry.startTime;
                
                console.log('👆 FID:', `${this.metrics.fid.toFixed(2)}ms`);
                
                if (this.metrics.fid > this.thresholds.fid) {
                    this.reportFIDIssue(entry);
                }
            }
        });
        
        observer.observe({ entryTypes: ['first-input'] });
        this.observers.set('fid', observer);
    }
    
    // 报告FID问题
    reportFIDIssue(entry) {
        console.warn('⚠️ High FID detected:', {
            fid: `${this.metrics.fid.toFixed(2)}ms`,
            threshold: `${this.thresholds.fid}ms`,
            inputType: entry.name,
            suggestions: [
                'Reduce JavaScript execution time',
                'Split long tasks into smaller chunks',
                'Use web workers for heavy computations'
            ]
        });
    }
    
    // 监控首次内容绘制 (FCP)
    monitorFCP() {
        if (!('PerformancePaintTiming' in window)) {
            console.warn('PerformancePaintTiming not supported');
            return;
        }
        
        const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                if (entry.name === 'first-contentful-paint') {
                    this.metrics.fcp = entry.startTime;
                    console.log('🎨 FCP:', `${this.metrics.fcp.toFixed(2)}ms`);
                }
            }
        });
        
        observer.observe({ entryTypes: ['paint'] });
        this.observers.set('fcp', observer);
    }
    
    // 监控首字节时间 (TTFB)
    monitorTTFB() {
        if ('navigation' in performance) {
            const navTiming = performance.getEntriesByType('navigation')[0];
            if (navTiming) {
                this.metrics.ttfb = navTiming.responseStart - navTiming.requestStart;
                console.log('⚡ TTFB:', `${this.metrics.ttfb.toFixed(2)}ms`);
            }
        }
    }
    
    // 监控加载时间
    monitorLoadTime() {
        window.addEventListener('load', () => {
            this.metrics.loadTime = Date.now() - this.startTime;
            console.log('⏱️ Load Time:', `${this.metrics.loadTime}ms`);
        });
    }
    
    // 监控渲染时间
    monitorRenderTime() {
        // 监听自定义渲染完成事件
        document.addEventListener('pm:loaded', (event) => {
            this.metrics.renderTime = event.detail.timestamp - this.startTime;
            // console.log('🖼️ Render Time:', `${this.metrics.renderTime}ms`);
            
            // 生成性能报告
            this.generatePerformanceReport();
        });
    }
    
    // 监控资源性能
    monitorResourceTiming() {
        if ('PerformanceResourceTiming' in window) {
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    this.analyzeResourcePerformance(entry);
                }
            });
            
            observer.observe({ entryTypes: ['resource'] });
            this.observers.set('resource', observer);
        }
    }
    
    // 分析资源性能
    analyzeResourcePerformance(entry) {
        const duration = entry.responseEnd - entry.startTime;
        const size = entry.transferSize || 0;
        
        // 检查慢资源
        if (duration > 1000) { // 超过1秒
            console.warn('🐌 Slow resource:', {
                name: entry.name,
                duration: `${duration.toFixed(2)}ms`,
                size: `${(size / 1024).toFixed(2)}KB`,
                type: entry.initiatorType
            });
        }
        
        // 检查大资源
        if (size > 500 * 1024) { // 超过500KB
            console.warn('📦 Large resource:', {
                name: entry.name,
                size: `${(size / 1024 / 1024).toFixed(2)}MB`,
                duration: `${duration.toFixed(2)}ms`
            });
        }
    }
    
    // 设置定期报告
    setupReporting() {
        // 每30秒报告一次性能状态
        setInterval(() => {
            this.reportPerformanceStatus();
        }, 30000);
        
        // 页面卸载时发送最终报告
        window.addEventListener('beforeunload', () => {
            this.sendFinalReport();
        });
    }
    
    // 报告性能状态
    reportPerformanceStatus() {
        const status = this.getPerformanceStatus();
        console.log('📊 Performance Status:', status);
        
        // 如果性能不佳，提供优化建议
        if (status.score < 70) {
            this.providePerfomanceAdvice();
        }
    }
    
    // 获取性能状态
    getPerformanceStatus() {
        const scores = {
            cls: this.metrics.cls <= this.thresholds.cls ? 100 : Math.max(0, 100 - (this.metrics.cls / this.thresholds.cls) * 100),
            fcp: this.metrics.fcp <= this.thresholds.fcp ? 100 : Math.max(0, 100 - (this.metrics.fcp / this.thresholds.fcp) * 100),
            lcp: this.metrics.lcp <= this.thresholds.lcp ? 100 : Math.max(0, 100 - (this.metrics.lcp / this.thresholds.lcp) * 100),
            fid: this.metrics.fid <= this.thresholds.fid ? 100 : Math.max(0, 100 - (this.metrics.fid / this.thresholds.fid) * 100)
        };
        
        const overallScore = Object.values(scores).reduce((sum, score) => sum + score, 0) / Object.keys(scores).length;
        
        return {
            score: Math.round(overallScore),
            metrics: this.metrics,
            scores: scores,
            grade: this.getPerformanceGrade(overallScore)
        };
    }
    
    // 获取性能等级
    getPerformanceGrade(score) {
        if (score >= 90) return 'A';
        if (score >= 80) return 'B';
        if (score >= 70) return 'C';
        if (score >= 60) return 'D';
        return 'F';
    }
    
    // 提供性能建议
    providePerfomanceAdvice() {
        const advice = [];
        
        if (this.metrics.cls > this.thresholds.cls) {
            advice.push('Reduce layout shifts by predefining element dimensions');
        }
        
        if (this.metrics.lcp > this.thresholds.lcp) {
            advice.push('Optimize largest contentful paint by preloading critical resources');
        }
        
        if (this.metrics.fid > this.thresholds.fid) {
            advice.push('Reduce first input delay by optimizing JavaScript execution');
        }
        
        if (this.metrics.fcp > this.thresholds.fcp) {
            advice.push('Improve first contentful paint by optimizing critical rendering path');
        }
        
        console.log('💡 Performance Advice:', advice);
    }
    
    // 生成性能报告
    generatePerformanceReport() {
        const report = {
            timestamp: new Date().toISOString(),
            url: window.location.href,
            userAgent: navigator.userAgent,
            metrics: this.metrics,
            status: this.getPerformanceStatus(),
            recommendations: this.getRecommendations()
        };
        
        console.log('📋 Performance Report:', report);
        
        // 保存到localStorage用于调试
        if (window.ProgressiveEnhancement?.isFeatureSupported('localStorage')) {
            localStorage.setItem('pm_performance_report', JSON.stringify(report));
        }
        
        return report;
    }
    
    // 获取优化建议
    getRecommendations() {
        const recommendations = [];
        
        // 基于实际指标提供建议
        if (this.metrics.cls > 0.05) {
            recommendations.push({
                type: 'CLS',
                priority: 'high',
                suggestion: 'Implement skeleton loading and predefined dimensions'
            });
        }
        
        if (this.metrics.loadTime > 3000) {
            recommendations.push({
                type: 'Load Time',
                priority: 'medium',
                suggestion: 'Optimize bundle size and implement code splitting'
            });
        }
        
        return recommendations;
    }
    
    // 发送最终报告
    sendFinalReport() {
        const report = this.generatePerformanceReport();
        
        // Performance metrics logging temporarily disabled to avoid API errors
        // TODO: Implement proper performance metrics endpoint if needed
        console.debug('Performance metrics collected but not sent (endpoint disabled)');
    }
    
    // 公共API
    getMetrics() {
        return { ...this.metrics };
    }
    
    getStatus() {
        return this.getPerformanceStatus();
    }
    
    // 手动触发报告
    generateReport() {
        return this.generatePerformanceReport();
    }
    
    // 清理观察器
    cleanup() {
        this.observers.forEach(observer => observer.disconnect());
        this.observers.clear();
    }
    
    // 开发环境测试功能
    runDevelopmentTest() {
        if (window.location.hostname !== 'localhost' && !window.location.hostname.includes('dev')) {
            return;
        }
        
        console.log('🧪 Running performance test in development mode...');
        
        // 等待页面加载完成后显示结果
        document.addEventListener('pm:loaded', () => {
            setTimeout(() => {
                const report = this.generatePerformanceReport();
                this.showDevelopmentReport(report);
            }, 1000);
        });
    }
    
    // 显示开发环境报告
    showDevelopmentReport(report) {
        const grade = this.getPerformanceGrade(this.getStatus().score);
        const score = this.getStatus().score;
        
        let message = `性能测试完成！`;
        let color = '#28a745';
        
        if (score >= 90) {
            message += ` 表现优秀 (${grade})`;
            color = '#28a745';
        } else if (score >= 75) {
            message += ` 表现良好 (${grade})`;
            color = '#ffc107';
        } else if (score >= 60) {
            message += ` 需要改进 (${grade})`;
            color = '#fd7e14';
        } else {
            message += ` 表现较差 (${grade})`;
            color = '#dc3545';
        }
        
        // 创建开发环境通知
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed; top: 20px; left: 20px; background: white;
            border: 2px solid ${color}; border-radius: 8px; padding: 16px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1); z-index: 10000;
            max-width: 400px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        `;
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                <div style="width: 24px; height: 24px; background: ${color}; border-radius: 50%; 
                           display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">
                    ${grade}
                </div>
                <div style="font-weight: bold; color: ${color};">${message}</div>
            </div>
            <div style="font-size: 14px; color: #666; margin-bottom: 12px;">
                CLS: ${this.metrics.cls.toFixed(4)}<br>
                LCP: ${this.metrics.lcp.toFixed(0)}ms<br>
                加载时间: ${this.metrics.loadTime || 'N/A'}ms
            </div>
            <button onclick="this.parentElement.remove()" 
                    style="background: ${color}; color: white; border: none; padding: 8px 16px; 
                           border-radius: 4px; cursor: pointer; font-size: 14px;">关闭</button>
        `;
        
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 10000);
    }
}

// 全局实例
window.PerformanceMonitor = new PerformanceMonitor();

// 开发环境自动运行测试
if (window.location.hostname === 'localhost' || window.location.hostname.includes('dev')) {
    window.PerformanceMonitor.runDevelopmentTest();
}

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PerformanceMonitor;
}
