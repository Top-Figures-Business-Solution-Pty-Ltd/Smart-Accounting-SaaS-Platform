/**
 * DOM helpers (no framework)
 */

export function escapeHtml(input) {
  const text = typeof input === 'string' ? input : String(input ?? '');
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}


