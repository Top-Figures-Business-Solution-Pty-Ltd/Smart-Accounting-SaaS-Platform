/**
 * Smart Board - Board Row Component
 * 表格行组件
 */

import { BoardCell } from './BoardCell.js';

export class BoardRow {
    constructor(project, options = {}) {
        this.project = project;
        this.options = options;
        this.columns = options.columns || [];
        this.index = options.index || 0;
        this.onClick = options.onClick || (() => {});
    }
    
    getHTML() {
        const cells = this.columns.map(col => {
            return this.renderCell(col);
        }).join('');
        
        return `
            <tr 
                class="board-table-row" 
                data-project-name="${this.project.name}"
                data-index="${this.index}"
            >
                ${cells}
            </tr>
        `;
    }
    
    renderCell(column) {
        const cell = new BoardCell(this.project, column);
        return cell.getHTML();
    }
    
    destroy() {
        // 清理资源
    }
}

