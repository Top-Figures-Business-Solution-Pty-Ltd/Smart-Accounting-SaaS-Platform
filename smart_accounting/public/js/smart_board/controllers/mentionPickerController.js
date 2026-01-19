/**
 * MentionPickerController
 * - Attaches an @mention picker to a textarea (website-safe)
 */
import { MentionService } from '../services/mentionService.js';

function escapeHtml(v) {
  return String(v || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getMentionQueryAtCursor(text, cursorPos) {
  const left = String(text || '').slice(0, Math.max(0, cursorPos || 0));
  const at = left.lastIndexOf('@');
  if (at < 0) return null;
  // must be start or preceded by whitespace
  if (at > 0 && !/\s/.test(left[at - 1])) return null;
  const after = left.slice(at + 1);
  // stop if it already contains whitespace/newline
  if (/\s/.test(after)) return null;
  return { at, query: after };
}

export function attachMentionPicker({ textareaEl, onPick } = {}) {
  const ta = textareaEl;
  if (!ta) return { destroy() {} };

  let open = false;
  let items = [];
  let active = 0;
  let lastQuery = null;
  let lastAt = null;
  let fetchSeq = 0;

  const pop = document.createElement('div');
  pop.className = 'sb-mention-picker';
  pop.style.position = 'fixed';
  // Must be above sb-modal-overlay (z-index: 20000). Align with other portal menus (30000).
  pop.style.zIndex = '30000';
  pop.style.display = 'none';
  pop.style.background = '#fff';
  pop.style.border = '1px solid rgba(0,0,0,0.12)';
  pop.style.borderRadius = '10px';
  pop.style.boxShadow = '0 12px 30px rgba(0,0,0,0.12)';
  pop.style.padding = '6px';
  pop.style.width = '280px';
  document.body.appendChild(pop);

  const hide = () => {
    open = false;
    pop.style.display = 'none';
    items = [];
    active = 0;
  };

  const show = () => {
    const rect = ta.getBoundingClientRect();
    pop.style.left = `${Math.min(rect.left, window.innerWidth - 300)}px`;
    pop.style.top = `${Math.min(rect.bottom + 6, window.innerHeight - 220)}px`;
    pop.style.display = 'block';
    open = true;
  };

  const render = () => {
    if (!open) return;
    if (!items.length) {
      pop.innerHTML = `<div class="text-muted" style="padding:8px;">No users</div>`;
      return;
    }
    const rows = items.map((u, idx) => {
      const label = escapeHtml(u?.full_name || u?.name || '');
      const meta = escapeHtml(u?.name || '');
      const isActive = idx === active;
      return `
        <div data-idx="${idx}" style="
          padding:8px 10px; border-radius:8px; cursor:pointer;
          background:${isActive ? 'rgba(13,110,253,0.10)' : 'transparent'};
        ">
          <div style="font-weight:600; line-height:1.1;">${label}</div>
          <div class="text-muted" style="font-size:12px; margin-top:2px;">${meta}</div>
        </div>
      `;
    }).join('');
    pop.innerHTML = `<div>${rows}</div>`;
  };

  const fetchUsers = async (query) => {
    const seq = ++fetchSeq;
    try {
      const res = await MentionService.searchUsers(query, { limit: 8 });
      if (seq !== fetchSeq) return;
      items = Array.isArray(res) ? res : [];
      active = 0;
      show();
      render();
    } catch (e) {
      if (seq !== fetchSeq) return;
      items = [];
      active = 0;
      show();
      render();
    }
  };

  const onInput = () => {
    const pos = ta.selectionStart || 0;
    const info = getMentionQueryAtCursor(ta.value, pos);
    if (!info) {
      hide();
      return;
    }
    lastQuery = info.query;
    lastAt = info.at;
    fetchUsers(lastQuery);
  };

  const pickActive = () => {
    const u = items[active];
    if (!u) return;
    const label = String(u?.full_name || u?.name || '').trim();
    const userId = String(u?.name || '').trim();
    if (!label || !userId) return;

    const pos = ta.selectionStart || 0;
    const before = ta.value.slice(0, Math.max(0, lastAt));
    const after = ta.value.slice(pos);
    const token = `@${label}`;
    const next = `${before}${token} ${after}`;
    ta.value = next;

    const newPos = (before.length + token.length + 1);
    ta.setSelectionRange(newPos, newPos);
    ta.dispatchEvent(new Event('input', { bubbles: true }));

    try { onPick?.({ name: userId, full_name: label }); } catch (e) {}
    hide();
  };

  const onKeyDown = (e) => {
    if (!open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      hide();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      active = Math.min((items.length || 1) - 1, active + 1);
      render();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      active = Math.max(0, active - 1);
      render();
      return;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      // only intercept if we're in a mention flow
      if (lastQuery != null) {
        e.preventDefault();
        pickActive();
      }
    }
  };

  const onDocClick = (e) => {
    if (!open) return;
    const t = e.target;
    if (t === ta || pop.contains(t)) return;
    hide();
  };

  const onPopClick = (e) => {
    const row = e.target?.closest?.('[data-idx]');
    if (!row) return;
    const idx = Number(row.dataset.idx);
    if (!Number.isFinite(idx)) return;
    active = idx;
    render();
    pickActive();
  };

  ta.addEventListener('input', onInput);
  ta.addEventListener('keydown', onKeyDown);
  pop.addEventListener('click', onPopClick);
  document.addEventListener('click', onDocClick);
  window.addEventListener('resize', hide);
  window.addEventListener('scroll', hide, true);

  return {
    destroy() {
      try { ta.removeEventListener('input', onInput); } catch (e) {}
      try { ta.removeEventListener('keydown', onKeyDown); } catch (e) {}
      try { pop.removeEventListener('click', onPopClick); } catch (e) {}
      try { document.removeEventListener('click', onDocClick); } catch (e) {}
      try { window.removeEventListener('resize', hide); } catch (e) {}
      try { window.removeEventListener('scroll', hide, true); } catch (e) {}
      try { pop.remove(); } catch (e) {}
    }
  };
}


