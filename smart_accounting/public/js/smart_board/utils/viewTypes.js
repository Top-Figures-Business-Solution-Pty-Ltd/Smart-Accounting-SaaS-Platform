/**
 * Smart Board - View Types
 * Keep view classification in one place to avoid "if (view === ...)" spreading everywhere.
 */

// Product shell views (non-board).
// NOTE: Some product views are rendered as real apps (e.g. Clients), not placeholders.
export const PRODUCT_VIEWS = ['dashboard', 'clients', 'client-projects', 'settings'];

export function isProductView(view) {
    return PRODUCT_VIEWS.includes(view);
}

/**
 * Board view = a Project Type board (e.g. External/Internal/Other) that exists in system Project Type list.
 */
export function isBoardView(view, projectTypes = []) {
    if (isProductView(view)) return false;
    const values = new Set((projectTypes || []).map(t => t?.value).filter(Boolean));
    return values.has(view);
}


