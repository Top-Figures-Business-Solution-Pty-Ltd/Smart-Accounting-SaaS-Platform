/**
 * Perf (dev-only, opt-in)
 * - Zero-impact by default (disabled)
 * - Enable via:
 *   - localStorage.setItem('sb_perf', '1') then refresh
 *   - or add query param ?sb_perf=1
 *
 * IMPORTANT: Must not change app behavior; logging only.
 */
let _enabled = null;

function _readEnabled() {
  try {
    const u = new URL(window.location.href);
    const qp = String(u.searchParams.get('sb_perf') || '').trim();
    if (qp === '1' || qp.toLowerCase() === 'true') return true;
  } catch (e) {}
  try {
    const v = String(window?.localStorage?.getItem?.('sb_perf') || '').trim();
    if (v === '1' || v.toLowerCase() === 'true') return true;
  } catch (e) {}
  return false;
}

function _now() {
  try {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  } catch (e) {
    return Date.now();
  }
}

function _metaValue(meta) {
  try {
    return (typeof meta === 'function') ? (meta() || {}) : (meta || {});
  } catch (e) {
    return {};
  }
}

function _log(label, ms, meta) {
  try {
    const m = _metaValue(meta);
    // eslint-disable-next-line no-console
    console.debug(`[sb:perf] ${label} ${ms.toFixed(1)}ms`, m);
  } catch (e) {}
}

export const Perf = {
  enabled() {
    if (_enabled == null) _enabled = _readEnabled();
    return !!_enabled;
  },
  now: _now,
  log: _log,
  async timeAsync(label, fn, meta) {
    if (!Perf.enabled()) return await fn();
    const t0 = _now();
    try {
      return await fn();
    } finally {
      _log(label, _now() - t0, meta);
    }
  },
};


