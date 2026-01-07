import { isProductView } from '../../utils/viewTypes.js';

export function isPlaceholderView(view) {
    return isProductView(view);
}

export function renderPlaceholderHTML(view, store) {
    const state = store?.getState?.() || {};
    const projects = state.projects?.items || [];

    const total = projects.length;
    const byStatus = projects.reduce((acc, p) => {
        const s = p.status || 'Unknown';
        acc[s] = (acc[s] || 0) + 1;
        return acc;
    }, {});

    if (view === 'dashboard') {
        const topStatuses = Object.entries(byStatus)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(([k, v]) => `<div class="sb-card"><div class="sb-card__label">${k}</div><div class="sb-card__value">${v}</div></div>`)
            .join('');

        return `
            <div class="sb-page">
                <div class="sb-page__subtitle">Quick overview of your work</div>
                <div class="sb-cards">
                    <div class="sb-card">
                        <div class="sb-card__label">Projects Loaded</div>
                        <div class="sb-card__value">${total}</div>
                    </div>
                    ${topStatuses || '<div class="text-muted" style="padding:12px;">No projects loaded yet. Open a board to load data.</div>'}
                </div>
                <div class="sb-page__hint">Tip: choose a Board on the left to view projects.</div>
            </div>
        `;
    }

    if (view === 'clients') {
        return `
            <div class="sb-page">
                <div class="sb-page__subtitle">Client directory (coming soon)</div>
                <div class="sb-page__hint">
                    We will build a custom Clients UI here (based on Customer/Contact) while keeping your SaaS look & feel.
                </div>
            </div>
        `;
    }

    if (view === 'settings') {
        return `
            <div class="sb-page">
                <div class="sb-page__subtitle">Personal & workspace settings (coming soon)</div>
                <div class="sb-page__hint">
                    This will replace Desk settings for external users.
                </div>
            </div>
        `;
    }

    return `<div class="sb-page"><div class="sb-page__title">${view}</div></div>`;
}


