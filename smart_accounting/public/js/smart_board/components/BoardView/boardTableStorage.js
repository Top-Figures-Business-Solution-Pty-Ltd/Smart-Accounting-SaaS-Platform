import { getFromStorage, saveToStorage } from '../../utils/helpers.js';

export function getColumnWidthsKey(viewType) {
  return `column_widths_${viewType}`;
}

export function loadColumnWidths(viewType) {
  return getFromStorage(getColumnWidthsKey(viewType), null);
}

export function saveColumnWidths(viewType, widths) {
  return saveToStorage(getColumnWidthsKey(viewType), widths);
}


