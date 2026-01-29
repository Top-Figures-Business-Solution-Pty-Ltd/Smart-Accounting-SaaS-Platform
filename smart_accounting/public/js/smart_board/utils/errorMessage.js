/**
 * errorMessage
 * - Convert unknown thrown values (Error/object/string) into a user-friendly message.
 * - Handles common Frappe response shapes (e._server_messages).
 */
export function getErrorMessage(err) {
  try {
    if (!err) return '';

    const _clean = (s) => {
      const txt = String(s || '').replace(/\r/g, '').trim();
      if (!txt) return '';

      // If it's a JSON-ish string, try to decode and extract a meaningful exception line
      if (txt.startsWith('{') && txt.includes('"exception"')) {
        try {
          const j = JSON.parse(txt);
          const ex = String(j?.exception || '').replace(/\r/g, '');
          // Prefer the human part after the last ": "
          const m = ex.match(/LinkValidationError:\s*([^\n]+)/) || ex.match(/:\s*([^\n]+)$/);
          if (m?.[1]) return String(m[1]).trim();
        } catch (e) {}
      }

      // Common Frappe validation
      const m1 = txt.match(/LinkValidationError:\s*([^\n]+)/);
      if (m1?.[1]) return String(m1[1]).trim();

      // Extract "Could not find ..." as a user-friendly sentence
      const m2 = txt.match(/Could not find[^\n]+/i);
      if (m2?.[0]) return String(m2[0]).trim();

      // Drop traceback noise if present
      const idx = txt.indexOf('Traceback (most recent call last)');
      if (idx >= 0) {
        const head = txt.slice(0, idx).trim();
        if (head) return head;
      }

      // Prefer first line only (avoid massive dumps)
      const firstLine = txt.split('\n')[0]?.trim();
      return firstLine || '';
    };

    if (typeof err === 'string') return _clean(err);
    if (err instanceof Error) return _clean(err.message || '');

    // Frappe often returns server messages as a JSON string array in _server_messages.
    try {
      const raw = err?._server_messages;
      if (raw) {
        const arr = JSON.parse(raw);
        const first = Array.isArray(arr) ? arr[0] : null;
        const decoded = first ? JSON.parse(first) : null;
        const msg = decoded?.message;
        if (msg) return _clean(msg);
      }
    } catch (e) {}

    const m =
      err?.message ||
      err?.exc ||
      err?.exception ||
      err?.error ||
      err?._error_message ||
      err?.responseText ||
      err?.statusText ||
      '';
    if (typeof m === 'string' && m.trim()) return _clean(m);

    // Avoid "[object Object]" noise
    return '';
  } catch (e) {
    return '';
  }
}


