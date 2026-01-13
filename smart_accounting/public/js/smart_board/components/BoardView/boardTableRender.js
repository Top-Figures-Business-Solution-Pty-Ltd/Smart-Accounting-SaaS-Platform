import { BoardRow } from './BoardRow.js';

export function renderColGroup(columns) {
  const cols = Array.isArray(columns) ? columns : [];
  return `
    <colgroup>
      ${cols.map((c) => `<col data-field="${c.field}" style="width:${Number(c.width) || 0}px;" />`).join('')}
    </colgroup>
  `;
}

export function renderHeaderCells(columns) {
  return columns.map(col => `
    <th 
      class="board-table-cell ${col.frozen ? 'frozen' : ''} ${col.__headerClass || ''} ${col.field === '__sb_select' ? 'sb-select-col' : ''}"
      style="${col.frozen && col._stickyLeft != null ? ` left:${col._stickyLeft}px;` : ''}"
      data-field="${col.field}"
    >
      ${col.field === '__sb_select'
        ? `<div class="cell-content sb-select-all-wrap"><input type="checkbox" class="sb-select-all" aria-label="Select all rows" /></div>`
        : `<div class="cell-content">
            <span class="cell-label">${col.label}</span>
            ${col.sortable !== false ? '<span class="sort-icon"></span>' : ''}
          </div>
          <div class="resize-handle"></div>`
      }
    </th>
  `).join('');
}

export function renderRows(projects, columns, onRowClick, rowsOut, { isSelected } = {}) {
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
    return row.getHTML();
  }).join('');
}


