/**
 * Smart Board - Button Component
 * 按钮组件（占位符）
 */

export class Button {
    constructor(container, options = {}) {
        this.container = container;
        this.options = options;
        this.label = options.label || 'Button';
        this.onClick = options.onClick || (() => {});
        this.variant = options.variant || 'default'; // default, primary, danger
    }
    
    render() {
        const btnClass = `btn btn-${this.variant}`;
        this.container.innerHTML = `
            <button class="${btnClass}" id="btnCustom">
                ${this.label}
            </button>
        `;
        
        this.bindEvents();
    }
    
    bindEvents() {
        const btn = this.container.querySelector('#btnCustom');
        if (btn) {
            btn.addEventListener('click', this.onClick);
        }
    }
    
    destroy() {
        this.container.innerHTML = '';
    }
}

