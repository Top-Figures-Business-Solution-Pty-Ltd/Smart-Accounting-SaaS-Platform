/**
 * Shared filter state defaults and reset helpers.
 * Keep Smart Board filter shape in one place so app/store/UI resets stay aligned.
 */

export const DEFAULT_FILTER_STATE = Object.freeze({
    status: [],
    company: null,
    customer: null,
    fiscal_year: null,
    date_from: null,
    date_to: null,
    search: '',
    is_active: true,
    focused_project_name: null,
    sort_field: null,
    sort_order: null,
    advanced_rules: [],
    advanced_groups: [],
});

export const SIMPLE_FILTER_RESET = Object.freeze({
    status: [],
    company: null,
    customer: null,
    fiscal_year: null,
    date_from: null,
    date_to: null,
    search: '',
});

export const TRANSIENT_BOARD_ENTRY_FILTER_RESET = Object.freeze({
    ...SIMPLE_FILTER_RESET,
    is_active: true,
    focused_project_name: null,
    advanced_rules: [],
    advanced_groups: [],
});

function cloneArray(value, fallback = []) {
    return Array.isArray(value) ? [...value] : [...fallback];
}

export function createFilterState(overrides = {}, base = DEFAULT_FILTER_STATE) {
    const source = (base && typeof base === 'object') ? base : DEFAULT_FILTER_STATE;
    const next = {
        ...source,
        ...(overrides || {}),
    };

    next.status = cloneArray(
        Object.prototype.hasOwnProperty.call(overrides || {}, 'status') ? overrides.status : source.status,
        []
    );
    next.advanced_rules = cloneArray(
        Object.prototype.hasOwnProperty.call(overrides || {}, 'advanced_rules') ? overrides.advanced_rules : source.advanced_rules,
        []
    );
    next.advanced_groups = cloneArray(
        Object.prototype.hasOwnProperty.call(overrides || {}, 'advanced_groups') ? overrides.advanced_groups : source.advanced_groups,
        []
    );

    return next;
}

export function createSimpleFilterReset(overrides = {}) {
    return createFilterState(overrides, SIMPLE_FILTER_RESET);
}

export function createTransientBoardEntryFilterReset(current = {}, overrides = {}) {
    return createFilterState(overrides, {
        ...(current || {}),
        ...TRANSIENT_BOARD_ENTRY_FILTER_RESET,
    });
}
