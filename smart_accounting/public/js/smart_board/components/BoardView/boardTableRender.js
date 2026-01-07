import { BoardRow } from './BoardRow.js';

export function renderHeaderCells(columns) {
  return columns.map(col => `
    <th 
      class="board-table-cell ${col.frozen ? 'frozen' : ''}"
      style="width: ${col.width}px;"
      data-field="${col.field}"
    >
      <div class="cell-content">
        <span class="cell-label">${col.label}</span>
        ${col.sortable !== false ? '<span class="sort-icon"></span>' : ''}
      </div>
      <div class="resize-handle"></div>
    </th>
  `).join('');
}

export function renderRows(projects, columns, onRowClick, rowsOut) {
  if (!projects || projects.length === 0) {
    return '<tr><td colspan="100"><div class="no-data">No projects found</div></td></tr>';
  }
  return projects.map((project, index) => {
    const row = new BoardRow(project, {
      columns,
      index,
      onClick: () => onRowClick(project),
    });
    rowsOut?.push(row);
    return row.getHTML();
  }).join('');
}


