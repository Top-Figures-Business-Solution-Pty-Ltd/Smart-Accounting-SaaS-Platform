/**
 * Header Toolbars
 * - Renders and binds the right-side actions area based on view type.
 * - Keeps Header.js small and prevents it from growing unbounded.
 */

export function renderHeaderActions(view, { isBoardView }) {
    const isBoard = !!isBoardView;

    if (isBoard) {
        return `
            <div class="header-search">
                <input 
                    type="text" 
                    class="form-control search-input" 
                    placeholder="Search projects..."
                    id="headerSearchInput"
                />
            </div>
            <button class="btn btn-default btn-filter" id="btnFilter">Filter<span class="filter-badge" id="filterBadge"></span></button>
            <button class="btn btn-default btn-columns" id="btnManageColumns">Columns</button>
            <button class="btn btn-primary btn-new-project" id="btnNewProject">New Project</button>
        `;
    }

    if (view === 'clients') {
        return `
            <div class="header-search">
                <input 
                    type="text" 
                    class="form-control search-input" 
                    placeholder="Search clients..."
                    id="headerClientSearchInput"
                />
            </div>
            <button class="btn btn-default" id="btnClientsColumns">Columns</button>
            <button class="btn btn-primary" id="btnNewClient">New Client</button>
        `;
    }

    if (view === 'client-projects') {
        return `
            <button class="btn btn-default" id="btnClientProjectsBack">Back</button>
            <div class="header-search">
                <input 
                    type="text" 
                    class="form-control search-input" 
                    placeholder="Search projects..."
                    id="headerClientProjectsSearchInput"
                />
            </div>
        `;
    }

    if (view === 'dashboard') {
        return `<button class="btn btn-default" id="btnDashboardRefresh">Refresh</button>`;
    }

    return '';
}

export function bindHeaderActions(rootEl, view, { isBoardView, onAction, onShowFilter }) {
    const isBoard = !!isBoardView;

    if (isBoard) {
        rootEl.querySelector('#btnNewProject')?.addEventListener('click', () => onAction?.('new_project'));
        rootEl.querySelector('#btnManageColumns')?.addEventListener('click', () => onAction?.('manage_columns'));
        rootEl.querySelector('#btnFilter')?.addEventListener('click', () => onShowFilter?.());

        const searchInput = rootEl.querySelector('#headerSearchInput');
        if (searchInput) {
            let t;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(t);
                t = setTimeout(() => onAction?.('search', e.target.value), 300);
            });
        }
        return;
    }

    rootEl.querySelector('#btnNewClient')?.addEventListener('click', () => onAction?.('new_client'));
    rootEl.querySelector('#btnClientsColumns')?.addEventListener('click', () => onAction?.('clients_columns'));

    const clientSearch = rootEl.querySelector('#headerClientSearchInput');
    if (clientSearch) {
        let t;
        clientSearch.addEventListener('input', (e) => {
            clearTimeout(t);
            t = setTimeout(() => onAction?.('clients_search', e.target.value), 300);
        });
    }

    rootEl.querySelector('#btnDashboardRefresh')?.addEventListener('click', () => onAction?.('dashboard_refresh'));

    rootEl.querySelector('#btnClientProjectsBack')?.addEventListener('click', () => onAction?.('client_projects_back'));
    const clientProjectsSearch = rootEl.querySelector('#headerClientProjectsSearchInput');
    if (clientProjectsSearch) {
        let t;
        clientProjectsSearch.addEventListener('input', (e) => {
            clearTimeout(t);
            t = setTimeout(() => onAction?.('client_projects_search', e.target.value), 300);
        });
    }
}


