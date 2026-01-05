/**
 * Smart Board - User Picker Component
 * 用户选择组件（占位符）
 */

export class UserPicker {
    constructor(container, options = {}) {
        this.container = container;
        this.options = options;
    }
    
    render() {
        // TODO: 实现用户选择器UI
        this.container.innerHTML = `
            <div class="user-picker">
                <input type="text" class="form-control" placeholder="Select user..." />
            </div>
        `;
    }
    
    destroy() {
        this.container.innerHTML = '';
    }
}

