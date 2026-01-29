/**
 * clientNameFormat
 * - Formatting rules for Client Name normalization.
 *
 * Rules:
 * - Non-Individual: Capitalize the first letter of each word.
 *   Example: "abc pty ltd" -> "Abc Pty Ltd"
 * - Individual: "LAST, First"
 *   Example: "john smith" -> "SMITH, John"
 */
function _trimSpaces(s) {
  return String(s || '').trim().replace(/\s+/g, ' ');
}

function _capWord(w) {
  const t = String(w || '').trim().toLowerCase();
  if (!t) return '';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function _capHyphenWord(w) {
  const parts = String(w || '').split('-').map(_capWord).filter(Boolean);
  return parts.join('-');
}

function _titleCaseWords(name) {
  const clean = _trimSpaces(name);
  if (!clean) return '';
  return clean
    .split(' ')
    .map(_capHyphenWord)
    .filter(Boolean)
    .join(' ');
}

function _formatIndividual(name) {
  const clean = _trimSpaces(name);
  if (!clean) return '';
  let last = '';
  let first = '';
  if (clean.includes(',')) {
    const parts = clean.split(',');
    last = _trimSpaces(parts[0] || '');
    first = _trimSpaces(parts[1] || '');
  } else {
    const parts = clean.split(' ').filter(Boolean);
    if (parts.length === 1) {
      last = parts[0];
    } else {
      last = parts[parts.length - 1];
      first = parts[0];
    }
  }
  const lastUp = String(last || '').toUpperCase();
  const firstCap = _capWord(first);
  if (!firstCap) return lastUp;
  return `${lastUp}, ${firstCap}`;
}

export function formatClientName(name, customerType) {
  const type = String(customerType || '').trim();
  if (type === 'Individual') return _formatIndividual(name);
  // Non-Individual (Company/Trust/etc.)
  return _titleCaseWords(name);
}


