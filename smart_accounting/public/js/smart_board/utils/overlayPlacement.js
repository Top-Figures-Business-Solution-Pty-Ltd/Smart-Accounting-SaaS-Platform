/**
 * Compute overlay popup placement near an anchor rect.
 * Shared by menu-like editors to avoid off-screen dropdowns.
 */
export function computeOverlayPlacement(anchorRect, {
  preferredWidth = 240,
  minHeight = 140,
  maxHeight = 520,
  gap = 6,
  viewportPadding = 8,
  menuScrollHeight = 260,
} = {}) {
  const vw = Math.max(0, Number(window?.innerWidth || 0));
  const vh = Math.max(0, Number(window?.innerHeight || 0));
  const pad = Math.max(0, Number(viewportPadding || 0));
  const width = Math.max(180, Number(preferredWidth || 240));

  const leftMin = pad;
  const leftMax = Math.max(pad, vw - pad - width);
  const left = Math.min(leftMax, Math.max(leftMin, Number(anchorRect?.left || 0)));

  const topAnchor = Number(anchorRect?.top || 0);
  const bottomAnchor = Number(anchorRect?.bottom || 0);
  const spaceBelow = Math.max(0, vh - bottomAnchor - gap - pad);
  const spaceAbove = Math.max(0, topAnchor - gap - pad);

  const wanted = Math.max(minHeight, Math.min(maxHeight, Number(menuScrollHeight || maxHeight)));
  const openUp = spaceBelow < Math.min(220, wanted) && spaceAbove > spaceBelow;

  const available = openUp ? spaceAbove : spaceBelow;
  const finalMaxHeight = Math.max(minHeight, Math.min(maxHeight, available));
  const top = openUp
    ? Math.max(pad, topAnchor - gap - finalMaxHeight)
    : Math.max(pad, bottomAnchor + gap);

  return {
    left,
    top,
    width,
    maxHeight: finalMaxHeight,
    direction: openUp ? 'up' : 'down',
  };
}

