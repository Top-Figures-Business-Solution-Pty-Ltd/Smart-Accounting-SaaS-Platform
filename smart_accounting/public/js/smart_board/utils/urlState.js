/**
 * URL State (website-safe)
 * - Keeps minimal app state in query params for shareability and reload safety.
 * - Uses replaceState to avoid polluting browser history.
 */
const VIEW_PARAM = 'view';
const CUSTOMER_PARAM = 'customer';

export function getUrlState() {
  try {
    const u = new URL(window.location.href);
    const view = String(u.searchParams.get(VIEW_PARAM) || '').trim();
    const customer = String(u.searchParams.get(CUSTOMER_PARAM) || '').trim();
    return {
      view: view || null,
      customer: customer || null,
    };
  } catch (e) {
    return { view: null, customer: null };
  }
}

export function setUrlState({ view, customer } = {}) {
  try {
    const u = new URL(window.location.href);
    const v = String(view || '').trim();
    const c = String(customer || '').trim();

    if (v) u.searchParams.set(VIEW_PARAM, v);
    else u.searchParams.delete(VIEW_PARAM);

    if (c) u.searchParams.set(CUSTOMER_PARAM, c);
    else u.searchParams.delete(CUSTOMER_PARAM);

    // Keep path/hash intact, only update query string.
    window.history.replaceState({}, '', u.toString());
  } catch (e) {
    // no-op
  }
}


