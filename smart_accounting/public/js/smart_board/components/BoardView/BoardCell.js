/**
 * Smart Board - Board Cell Component
 * 表格单元格组件
 */

import { formatDate, formatTeamMembers, getStatusColor } from '../../utils/helpers.js';

export class BoardCell {
    constructor(project, column) {
        this.project = project;
        this.column = column;
    }
    
    getHTML() {
        const value = this.project[this.column.field];
        const formattedValue = this.formatValue(value);
        const isEditable = this.isEditableField();
        
        return `
            <td 
                class="board-table-cell ${this.column.frozen ? 'frozen' : ''} ${isEditable ? 'editable' : ''}"
                data-field="${this.column.field}"
                style="width: ${this.column.width}px;"
            >
                <div class="cell-content">
                    ${formattedValue}
                </div>
            </td>
        `;
    }
    
    formatValue(value) {
        const field = this.column.field;

        // Derived column: team:<Role>
        if (typeof field === 'string' && field.startsWith('team:')) {
            const role = field.slice('team:'.length);
            return this.formatTeamByRole(role);
        }
        
        // 空值处理
        if (value === null || value === undefined || value === '') {
            return '<span class="text-muted">—</span>';
        }
        
        // 根据字段类型格式化
        switch (field) {
            case 'status':
                return this.formatStatus(value);
            
            case 'custom_team_members':
                return this.formatTeam(value);
            
            case 'custom_lodgement_due_date':
            case 'expected_end_date':
            case 'expected_start_date':
                return this.formatDate(value);
            
            case 'custom_softwares':
                return this.formatSoftwares(value);
            
            case 'priority':
                return this.formatPriority(value);

            case 'is_active':
                return this.formatActive(value);

            case 'percent_complete':
                return this.formatPercent(value);

            case 'modified':
                return this.formatDate(value);

            case 'auto_repeat':
                return this.escapeHtml(value);

            case 'company':
                return this.formatCompany(value);
            
            case 'custom_entity_type':
                return this.formatEntity(value);
            
            case 'estimated_costing':
                return this.formatCurrency(value);
            
            case 'notes':
                return this.formatNotes(value);
            
            default:
                return this.escapeHtml(value);
        }
    }
    
    formatStatus(status) {
        const color = getStatusColor(status);
        return `
            <span class="status-badge" style="background-color: ${color};">
                ${this.escapeHtml(status)}
            </span>
        `;
    }
    
    formatTeam(teamMembers) {
        if (!teamMembers || !teamMembers.length) {
            return '<span class="text-muted">—</span>';
        }
        
        // 显示头像和名字
        const avatars = teamMembers.slice(0, 3).map(member => {
            const name = this.extractName(member.user);
            const initial = name.charAt(0).toUpperCase();
            return `<span class="user-avatar" title="${name}">${initial}</span>`;
        }).join('');
        
        const moreCount = teamMembers.length - 3;
        const moreText = moreCount > 0 ? `<span class="more-count">+${moreCount}</span>` : '';
        
        return `<div class="team-avatars">${avatars}${moreText}</div>`;
    }

    formatTeamByRole(role) {
        const all = this.project?.custom_team_members || [];
        // Prefer pre-aggregated cache from BoardTable (performance)
        const byRole = this.project?.__sb_team_by_role;
        const members = (byRole && byRole[role]) ? byRole[role] : all.filter((m) => (m?.role || '') === role);
        return this.formatTeam(members);
    }
    
    formatDate(date) {
        return formatDate(date);
    }
    
    formatSoftwares(softwares) {
        if (!softwares || !softwares.length) {
            return '<span class="text-muted">—</span>';
        }
        
        if (Array.isArray(softwares)) {
            return softwares.map(s => s.software_name || s).join(', ');
        }
        
        return this.escapeHtml(softwares);
    }

    formatPriority(priority) {
        // Keep it simple for now; later we can map to colors.
        return this.escapeHtml(priority);
    }

    formatActive(isActive) {
        const v = (typeof isActive === 'string') ? isActive : String(isActive);
        const yes = v === 'Yes' || v === '1' || v.toLowerCase?.() === 'yes' || v.toLowerCase?.() === 'true';
        const text = yes ? 'Yes' : 'No';
        const cls = yes ? 'company-badge company-tg' : 'company-badge company-tf';
        return `<span class="${cls}">${text}</span>`;
    }

    formatPercent(pct) {
        const n = Number(pct);
        if (!Number.isFinite(n)) return this.escapeHtml(pct);
        return `${Math.round(n)}%`;
    }
    
    formatCompany(company) {
        // 显示简短标识（TF/TG）
        if (company.includes('TF') || company.includes('Top Figures')) {
            return '<span class="company-badge company-tf">TF</span>';
        } else if (company.includes('TG') || company.includes('Top Grants')) {
            return '<span class="company-badge company-tg">TG</span>';
        }
        return this.escapeHtml(company);
    }
    
    formatEntity(entity) {
        if (!entity) return '<span class="text-muted">—</span>';
        
        // 提取简短标识
        // 例如："Client A Pty Ltd" -> "Pty Ltd"
        const parts = entity.split(' ');
        if (parts.length > 2) {
            return this.escapeHtml(parts.slice(-2).join(' '));
        }
        return this.escapeHtml(entity);
    }
    
    formatCurrency(amount) {
        if (!amount) return '<span class="text-muted">—</span>';
        return `$${Number(amount).toLocaleString('en-AU')}`;
    }
    
    formatNotes(notes) {
        if (!notes) return '<span class="text-muted">—</span>';
        
        // 截断长文本
        const maxLength = 100;
        if (notes.length > maxLength) {
            return `<span title="${this.escapeHtml(notes)}">${this.escapeHtml(notes.substring(0, maxLength))}...</span>`;
        }
        return this.escapeHtml(notes);
    }
    
    extractName(email) {
        if (!email) return '';
        const name = email.split('@')[0];
        return name.charAt(0).toUpperCase() + name.slice(1);
    }
    
    escapeHtml(text) {
        if (typeof text !== 'string') {
            text = String(text);
        }
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    isEditableField() {
        const nonEditableFields = ['customer', 'project_name', 'company'];
        return !nonEditableFields.includes(this.column.field);
    }
}

