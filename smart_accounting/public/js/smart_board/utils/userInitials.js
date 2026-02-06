/**
 * userInitials
 * - Compute stable avatar initials from a user's full name.
 *
 * Goal:
 * - Show 2 letters when possible (e.g. "Jean Ren" -> "JR") to reduce ambiguity in team columns.
 */

function _clean(s) {
  return String(s || '').trim().replace(/\s+/g, ' ');
}

function _firstChar(str) {
  const s = _clean(str);
  if (!s) return '';
  return s.charAt(0);
}

/**
 * Compute initials from full name (preferred) or user id (fallback).
 * - If the name has multiple parts: first + last initial
 * - If single part: first 2 chars (best-effort), else 1
 */
export function getUserInitials({ fullName, user } = {}) {
  const name = _clean(fullName) || _clean(user);
  if (!name) return '';

  // Handle "LAST, First"
  if (name.includes(',')) {
    const parts = name.split(',').map((x) => _clean(x)).filter(Boolean);
    const last = parts[0] || '';
    const first = parts[1] || '';
    const a = _firstChar(first) || _firstChar(last);
    const b = _firstChar(last) || '';
    const out = (a + b).trim();
    return out ? out.toUpperCase() : '';
  }

  const parts = name.split(' ').filter(Boolean);
  if (parts.length >= 2) {
    const a = _firstChar(parts[0]);
    const b = _firstChar(parts[parts.length - 1]);
    const out = (a + b).trim();
    return out ? out.toUpperCase() : '';
  }

  const one = parts[0] || name;
  const cleaned = _clean(one);
  if (!cleaned) return '';
  // Two characters if available (works for CJK too)
  const out = cleaned.slice(0, 2);
  return out.toUpperCase ? out.toUpperCase() : out;
}


