export function initResizable(rootEl, { onWidthChangeDone } = {}) {
  const resizeHandles = rootEl.querySelectorAll('.resize-handle');
  resizeHandles.forEach(handle => {
    let startX, startWidth, th;

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      th = handle.closest('th');
      startX = e.clientX;
      startWidth = th.offsetWidth;

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    const onMouseMove = (e) => {
      if (!th) return;
      const diff = e.clientX - startX;
      th.style.width = `${startWidth + diff}px`;
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      onWidthChangeDone?.();
    };
  });
}


