// Enhanced Loading System - 企业级加载体验优化
// 替换模糊骨架屏为清晰的进度指示器，防止页面闪烁

class EnhancedLoadingSystem {
    constructor() {
        this.config = window.AppConfig || {};
        this.isLoading = false;
        this.loadingStages = [];
        this.currentStage = 0;
        this.progressPercentage = 0;
        this.startTime = Date.now();
        
        // 加载阶段定义
        this.stages = [
            { name: 'Initializing', weight: 10, duration: 200 },
            { name: 'Loading Configuration', weight: 15, duration: 300 },
            { name: 'Fetching Data', weight: 40, duration: 800 },
            { name: 'Rendering Interface', weight: 25, duration: 400 },
            { name: 'Finalizing', weight: 10, duration: 200 }
        ];
        
        this.init();
    }
    
    init() {
        this.createLoadingInterface();
        this.setupPreventFlash();
        this.bindEvents();
    }
    
    // 创建加载界面
    createLoadingInterface() {
        // 移除旧的加载元素
        this.removeOldLoadingElements();
        
        // 创建新的加载容器
        const loadingContainer = document.createElement('div');
        loadingContainer.id = 'pm-enhanced-loading';
        loadingContainer.className = 'pm-enhanced-loading-container';
        loadingContainer.innerHTML = `
            <div class="pm-loading-backdrop"></div>
            <div class="pm-loading-content">
                <div class="pm-loading-header">
                    <div class="pm-loading-logo">
                        <i class="fa fa-calculator"></i>
                    </div>
                    <h3 class="pm-loading-title">Smart Accounting</h3>
                    <p class="pm-loading-subtitle">Loading your workspace...</p>
                </div>
                
                <div class="pm-loading-progress-section">
                    <div class="pm-progress-bar-container">
                        <div class="pm-progress-bar">
                            <div class="pm-progress-fill" id="pm-progress-fill"></div>
                        </div>
                        <div class="pm-progress-percentage" id="pm-progress-percentage">0%</div>
                    </div>
                    
                    <div class="pm-loading-stage" id="pm-loading-stage">
                        Initializing...
                    </div>
            </div>
        `;
        
        // 添加样式
        this.addLoadingStyles();
        
        // 插入到页面
        document.body.appendChild(loadingContainer);
    }
    
    // 移除旧的加载元素
    removeOldLoadingElements() {
        // 移除骨架屏
        const skeletons = document.querySelectorAll('.pm-combination-skeleton, .pm-skeleton-loader');
        skeletons.forEach(skeleton => skeleton.remove());
        
        // 移除旧的加载指示器
        const oldLoading = document.getElementById('pm-enhanced-loading');
        if (oldLoading) oldLoading.remove();
    }
    
    // 添加加载样式
    addLoadingStyles() {
        const styleId = 'pm-enhanced-loading-styles';
        if (document.getElementById(styleId)) return;
        
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
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
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            
            .pm-loading-backdrop {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                opacity: 0.95;
            }
            
            .pm-loading-content {
                position: relative;
                background: white;
                border-radius: 16px;
                padding: 32px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
                text-align: center;
                min-width: 380px;
                max-width: 450px;
                animation: loadingSlideIn 0.5s ease-out;
            }
            
            @keyframes loadingSlideIn {
                from {
                    opacity: 0;
                    transform: translateY(30px) scale(0.95);
                }
                to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }
            
            .pm-loading-header {
                margin-bottom: 24px;
            }
            
            .pm-loading-logo {
                width: 64px;
                height: 64px;
                background: linear-gradient(135deg, #667eea, #764ba2);
                border-radius: 16px;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 16px;
                color: white;
                font-size: 28px;
            }
            
            .pm-loading-title {
                margin: 0 0 8px 0;
                font-size: 24px;
                font-weight: 600;
                color: #2c3e50;
            }
            
            .pm-loading-subtitle {
                margin: 0;
                color: #64748b;
                font-size: 16px;
            }
            
            .pm-loading-progress-section {
                margin-bottom: 16px;
            }
            
            .pm-progress-bar-container {
                position: relative;
                margin-bottom: 16px;
            }
            
            .pm-progress-bar {
                width: 100%;
                height: 8px;
                background: #e2e8f0;
                border-radius: 4px;
                overflow: hidden;
            }
            
            .pm-progress-fill {
                height: 100%;
                background: linear-gradient(90deg, #667eea, #764ba2);
                border-radius: 4px;
                width: 0%;
                transition: width 0.3s ease;
            }
            
            .pm-progress-percentage {
                position: absolute;
                top: -30px;
                right: 0;
                font-weight: 600;
                color: #667eea;
                font-size: 14px;
            }
            
            .pm-loading-stage {
                font-size: 16px;
                font-weight: 500;
                color: #475569;
                margin-bottom: 0;
                min-height: 24px;
            }
            
            
            /* 隐藏页面内容直到加载完成 */
            .pm-loading-active .pm-table-container,
            .pm-loading-active .pm-combination-boards-container,
            .pm-loading-active .pm-header-actions {
                opacity: 0 !important;
                pointer-events: none !important;
            }
            
            /* 加载完成后的淡入动画 */
            .pm-content-ready .pm-table-container,
            .pm-content-ready .pm-combination-boards-container,
            .pm-content-ready .pm-header-actions {
                opacity: 1 !important;
                pointer-events: auto !important;
                animation: contentFadeIn 0.6s ease-out;
            }
            
            @keyframes contentFadeIn {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
        `;
        
        document.head.appendChild(style);
    }
    
    // 设置防闪烁
    setupPreventFlash() {
        // 添加加载状态类
        document.body.classList.add('pm-loading-active');
        
        // 预设页面样式，防止布局变化
        this.presetPageStyles();
    }
    
    // 预设页面样式
    presetPageStyles() {
        const style = document.createElement('style');
        style.id = 'pm-preload-styles';
        style.textContent = `
            /* 预设样式，防止布局闪烁 */
            .pm-table-container {
                min-height: 600px;
                opacity: 0;
                transition: opacity 0.6s ease;
            }
            
            .pm-combination-boards-container {
                min-height: 400px;
                opacity: 0;
                transition: opacity 0.6s ease;
            }
            
            .pm-header-actions {
                opacity: 0;
                transition: opacity 0.6s ease;
            }
            
            /* 确保页面结构稳定 */
            .pm-project-group {
                min-height: 100px;
            }
            
            .pm-task-row {
                min-height: 48px;
            }
        `;
        
        document.head.appendChild(style);
    }
    
    // 提示轮播已移除 - 简化加载界面
    
    // 开始加载
    startLoading() {
        this.isLoading = true;
        this.currentStage = 0;
        this.progressPercentage = 0;
        this.startTime = Date.now();
        
        // 显示加载界面
        const loadingContainer = document.getElementById('pm-enhanced-loading');
        if (loadingContainer) {
            loadingContainer.style.display = 'flex';
        }
        
        // 开始进度更新
        this.updateProgress();
        
        // 增强加载已启动
    }
    
    // 更新进度
    updateProgress() {
        if (!this.isLoading || this.manualMode) return;
        
        const stage = this.stages[this.currentStage];
        if (!stage) return;
        
        // 更新阶段信息
        this.updateStageDisplay(stage.name);
        
        // 计算进度
        const stageProgress = Math.min(100, (Date.now() - this.startTime) / stage.duration * 100);
        const totalProgress = this.calculateTotalProgress(stageProgress);
        
        // 更新进度条
        this.updateProgressBar(totalProgress);
        
        // 更新检查项
        this.updateCheckItems();
        
        // 检查是否完成当前阶段
        if (stageProgress >= 100) {
            this.currentStage++;
            this.startTime = Date.now();
            
            if (this.currentStage >= this.stages.length) {
                this.completeLoading();
                return;
            }
        }
        
        // 继续更新
        requestAnimationFrame(() => this.updateProgress());
    }
    
    // 计算总进度
    calculateTotalProgress(stageProgress) {
        let totalWeight = 0;
        let completedWeight = 0;
        
        this.stages.forEach((stage, index) => {
            totalWeight += stage.weight;
            if (index < this.currentStage) {
                completedWeight += stage.weight;
            } else if (index === this.currentStage) {
                completedWeight += (stage.weight * stageProgress / 100);
            }
        });
        
        return Math.min(100, (completedWeight / totalWeight) * 100);
    }
    
    // 更新阶段显示
    updateStageDisplay(stageName) {
        const stageElement = document.getElementById('pm-loading-stage');
        if (stageElement) {
            stageElement.textContent = stageName;
        }
    }
    
    // 更新进度条
    updateProgressBar(percentage) {
        this.progressPercentage = percentage;
        
        const progressFill = document.getElementById('pm-progress-fill');
        const progressPercentage = document.getElementById('pm-progress-percentage');
        
        if (progressFill) {
            progressFill.style.width = `${percentage}%`;
        }
        
        if (progressPercentage) {
            progressPercentage.textContent = `${Math.round(percentage)}%`;
        }
    }
    
    // 检查项已移除 - 简化加载界面
    updateCheckItems() {
        // 不再需要更新检查项
    }
    
    // 完成加载
    completeLoading() {
        this.isLoading = false;
        
        // 显示完成状态
        this.showCompletionState();
        
        // 延迟隐藏加载界面
        setTimeout(() => {
            this.hideLoadingInterface();
        }, 800);
        
        // 增强加载已完成
    }
    
    // 显示完成状态
    showCompletionState() {
        const stageElement = document.getElementById('pm-loading-stage');
        const progressFill = document.getElementById('pm-progress-fill');
        const progressPercentage = document.getElementById('pm-progress-percentage');
        
        if (stageElement) {
            stageElement.textContent = 'Ready!';
            stageElement.style.color = '#22c55e';
        }
        
        if (progressFill) {
            progressFill.style.width = '100%';
        }
        
        if (progressPercentage) {
            progressPercentage.textContent = '100%';
        }
        
        // 检查项已移除
    }
    
    // 隐藏加载界面
    hideLoadingInterface() {
        const loadingContainer = document.getElementById('pm-enhanced-loading');
        if (loadingContainer) {
            loadingContainer.style.opacity = '0';
            loadingContainer.style.transform = 'scale(0.95)';
            loadingContainer.style.transition = 'all 0.5s ease';
            
            setTimeout(() => {
                loadingContainer.remove();
                this.showPageContent();
            }, 500);
        }
    }
    
    // 显示页面内容
    showPageContent() {
        // 移除加载状态
        document.body.classList.remove('pm-loading-active');
        document.body.classList.add('pm-content-ready');
        
        // 移除预加载样式
        const preloadStyles = document.getElementById('pm-preload-styles');
        if (preloadStyles) {
            preloadStyles.remove();
        }
        
        // 触发内容显示事件
        const event = new CustomEvent('pm:content-ready', {
            detail: { 
                loadTime: Date.now() - this.startTime,
                timestamp: Date.now() 
            }
        });
        document.dispatchEvent(event);
        
        // 页面内容现已可见
    }
    
    // 绑定事件
    bindEvents() {
        // 监听页面加载事件
        document.addEventListener('DOMContentLoaded', () => {
            this.startLoading();
        });
        
        // 监听内容准备事件
        document.addEventListener('pm:loaded', () => {
            this.completeLoading();
        });
    }
    
    // 手动设置进度（用于外部调用）
    setProgress(percentage, stageName = null) {
        // 🚀 启用手动模式，停止自动进度更新
        this.manualMode = true;
        
        if (stageName) {
            this.updateStageDisplay(stageName);
        }
        this.updateProgressBar(percentage);
        this.updateCheckItems();
        
        // 🚀 修复：当达到100%时，准备完成但不立即完成
        // 让外部调用forceComplete()来真正完成
        if (percentage >= 100) {
            this.readyToComplete = true;
        }
    }
    
    // 手动完成加载
    forceComplete() {
        this.completeLoading();
    }
    
    // 获取当前进度
    getProgress() {
        return {
            percentage: this.progressPercentage,
            stage: this.currentStage,
            isLoading: this.isLoading
        };
    }
    
    // 清理资源
    destroy() {
        const loadingContainer = document.getElementById('pm-enhanced-loading');
        if (loadingContainer) {
            loadingContainer.remove();
        }
        
        const styles = document.getElementById('pm-enhanced-loading-styles');
        if (styles) {
            styles.remove();
        }
        
        document.body.classList.remove('pm-loading-active', 'pm-content-ready');
    }
}

// 创建全局实例
window.EnhancedLoadingSystem = new EnhancedLoadingSystem();

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnhancedLoadingSystem;
}
