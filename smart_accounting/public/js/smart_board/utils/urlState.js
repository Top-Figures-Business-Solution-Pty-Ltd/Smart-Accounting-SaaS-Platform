/**
 * URL State (website-safe)
 * - Keeps minimal app state in query params for shareability and reload safety.
 * - Uses replaceState to avoid polluting browser history.
 */
const VIEW_PARAM = 'view';
const CUSTOMER_PARAM = 'customer';
const STATUS_PARAM = 'status';
const PROJECT_PARAM = 'project';

let _lastWrittenUrl = null;

export function getUrlState() {
  try {
    const u = new URL(window.location.href);
    const view = String(u.searchParams.get(VIEW_PARAM) || '').trim();
    const customer = String(u.searchParams.get(CUSTOMER_PARAM) || '').trim();
    const status = String(u.searchParams.get(STATUS_PARAM) || '').trim();
    const project = String(u.searchParams.get(PROJECT_PARAM) || '').trim();
    return {
      view: view || null,
      customer: customer || null,
      status: status || null,
      project: project || null,
    };
  } catch (e) {
    return { view: null, customer: null, status: null, project: null };
  }
}

export function setUrlState({ view, customer, status, project } = {}) {
  try {
    const u = new URL(window.location.href);
    const v = String(view || '').trim();
    const c = String(customer || '').trim();
    const s = String(status || '').trim();
    const p = String(project || '').trim();

    if (v) u.searchParams.set(VIEW_PARAM, v);
    else u.searchParams.delete(VIEW_PARAM);

    if (c) u.searchParams.set(CUSTOMER_PARAM, c);
    else u.searchParams.delete(CUSTOMER_PARAM);

    if (s) u.searchParams.set(STATUS_PARAM, s);
    else u.searchParams.delete(STATUS_PARAM);

    if (p) u.searchParams.set(PROJECT_PARAM, p);
    else u.searchParams.delete(PROJECT_PARAM);

    const next = u.toString();
    // Avoid redundant replaceState calls (can be surprisingly expensive in some browsers).
    if (_lastWrittenUrl === next || window.location.href === next) return;
    _lastWrittenUrl = next;
    // Keep path/hash intact, only update query string.
    window.history.replaceState({}, '', next);
  } catch (e) {
    // no-op
  }
}


