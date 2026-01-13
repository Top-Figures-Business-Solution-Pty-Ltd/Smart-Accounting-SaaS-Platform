export function initResizable(rootEl, { onWidthChange, onWidthChangeDone } = {}) {
  const resizeHandles = rootEl.querySelectorAll('.resize-handle');

  const cssEscape = (s) => {
    try {
      return CSS && typeof CSS.escape === 'function' ? CSS.escape(String(s)) : String(s).replace(/"/g, '\\"');
    } catch (e) {
      return String(s).replace(/"/g, '\\"');
    }
  };

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  resizeHandles.forEach((handle) => {
    let startX = 0;
    let startWidth = 0;
    let th = null;
    let field = '';

    const setColWidth = (selector, width) => {
      rootEl.querySelectorAll(selector).forEach((colEl) => {
        colEl.style.width = `${width}px`;
        colEl.style.minWidth = `${width}px`;
      });
    };

    const applyWidth = (w) => {
      if (!th || !field) return;
      const width = clamp(Number(w) || 0, 44, 1200);
      const sel = cssEscape(field);
      // Preferred: update both header/body colgroups (keeps 2 tables in perfect sync)
      setColWidth(`.board-table-header col[data-field="${sel}"]`, width);
      setColWidth(`#boardTableBody col[data-field="${sel}"]`, width);
      // Notify owner to update its in-memory columns config (so rerenders keep the width)
      onWidthChange?.(field, width);
    };

    const onMouseMove = (e) => {
      if (!th) return;
      const diff = e.clientX - startX;
      applyWidth(startWidth + diff);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      const finalWidth = th ? th.offsetWidth : null;
      if (field && finalWidth) onWidthChangeDone?.(field, finalWidth);
    };

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      th = handle.closest('th');
      if (!th) return;
      field = th.dataset?.field || '';
      if (!field) return;

      startX = e.clientX;
      startWidth = th.offsetWidth;

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  });
}


