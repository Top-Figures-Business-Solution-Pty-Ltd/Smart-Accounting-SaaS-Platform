/**
 * Smart Board - Status Select Component
 * 状态选择组件（占位符）
 */

export class StatusSelect {
    constructor(container, options = {}) {
        this.container = container;
        this.options = options;
    }
    
    render() {
        // TODO: 实现状态选择器UI
        this.container.innerHTML = `
            <select class="form-control status-select">
                <option>Not Started</option>
                <option>Working</option>
                <option>Completed</option>
            </select>
        `;
    }
    
    getValue() {
        const select = this.container.querySelector('select');
        return select ? select.value : null;
    }
    
    setValue(value) {
        const select = this.container.querySelector('select');
        if (select) {
            select.value = value;
        }
    }
    
    destroy() {
        this.container.innerHTML = '';
    }
}

