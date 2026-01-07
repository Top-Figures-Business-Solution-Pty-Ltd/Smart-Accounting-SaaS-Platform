/**
 * BoardTable virtualization (windowing)
 * Render only visible rows to keep DOM light for large datasets.
 */

export function shouldVirtualize(totalRows, threshold = 200) {
  return totalRows > threshold;
}

export function computeWindow({ scrollTop, viewportHeight, rowHeight, total, overscan = 6 }) {
  const safeRowHeight = Math.max(1, rowHeight || 44);
  const visible = Math.ceil(viewportHeight / safeRowHeight) + overscan * 2;
  const start = Math.max(0, Math.floor(scrollTop / safeRowHeight) - overscan);
  const end = Math.min(total, start + visible);
  const topPad = start * safeRowHeight;
  const bottomPad = Math.max(0, (total - end) * safeRowHeight);
  return { start, end, topPad, bottomPad };
}

export function spacerRow(heightPx) {
  if (!heightPx) return '';
  return `<tr class="sb-spacer-row"><td colspan="100" style="height:${heightPx}px;border:0;padding:0;"></td></tr>`;
}


