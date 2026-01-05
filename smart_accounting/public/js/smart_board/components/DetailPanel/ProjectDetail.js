/**
 * Smart Board - Project Detail Component
 * 项目详情面板组件（占位符）
 */

export class ProjectDetail {
    constructor(container, options = {}) {
        this.container = container;
        this.options = options;
        this.project = options.project;
    }
    
    render() {
        // TODO: 实现详情面板UI
        this.container.innerHTML = `
            <div class="project-detail-panel">
                <h3>${this.project ? this.project.project_name : 'Project Details'}</h3>
                <div class="detail-content">
                    <!-- Details will be rendered here -->
                </div>
            </div>
        `;
    }
    
    updateProject(project) {
        this.project = project;
        this.render();
    }
    
    destroy() {
        this.container.innerHTML = '';
    }
}

