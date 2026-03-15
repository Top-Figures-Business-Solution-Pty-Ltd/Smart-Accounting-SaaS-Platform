import { BoardRow } from './BoardRow.js';
import { escapeHtml } from '../../utils/dom.js';

export function renderColGroup(columns) {
  const cols = Array.isArray(columns) ? columns : [];
  return `
    <colgroup>
      ${cols.map((c) => `<col data-field="${c.field}" style="width:${Number(c.width) || 0}px;" />`).join('')}
    </colgroup>
  `;
}

export function renderHeaderCells(columns, sortState = {}) {
  return columns.map(col => `
    <th 
      class="board-table-cell ${col.frozen ? 'frozen' : ''} ${col.__headerClass || ''} ${col.field === '__sb_select' ? 'sb-select-col' : ''} ${String(sortState?.field || '') === String(col.field || '') ? `is-sorted is-sorted--${escapeHtml(String(sortState?.order || 'asc'))}` : ''}"
      style="${col.frozen && col._stickyLeft != null ? ` left:${col._stickyLeft}px;` : ''}"
      data-field="${col.field}"
    >
      ${col.field === '__sb_select'
        ? `<div class="cell-content sb-select-all-wrap">
             <input type="checkbox" class="sb-select-all" aria-label="Select all rows" />
           </div>`
        : `<div class="cell-content">
            <span class="cell-label">${col.label}</span>
            ${col.field === 'status' ? '<button type="button" class="sb-status-settings-btn" title="Status settings" aria-label="Status settings">⚙️</button>' : ''}
            ${col.sortable !== false ? `<span class="sort-icon">${String(sortState?.field || '') === String(col.field || '') ? (String(sortState?.order || 'asc') === 'desc' ? '↓' : '↑') : ''}</span>` : ''}
          </div>
          <div class="resize-handle"></div>`
      }
    </th>
  `).join('');
}

export function renderRows(projects, columns, onRowClick, rowsOut, { isSelected, isExpanded, expandedRowHTML } = {}) {
  if (!projects || projects.length === 0) {
    return '<tr><td colspan="100"><div class="no-data">No projects found</div></td></tr>';
  }
  return projects.map((project, index) => {
    const row = new BoardRow(project, {
      columns,
      index,
      onClick: () => onRowClick(project),
      isSelected: typeof isSelected === 'function' ? isSelected : null,
    });
    rowsOut?.push(row);
    const base = row.getHTML();
    const exp = (typeof isExpanded === 'function' && isExpanded(project)) ? true : false;
    if (exp && typeof expandedRowHTML === 'function') {
      return base + expandedRowHTML(project, columns);
    }
    return base;
  }).join('');
}


