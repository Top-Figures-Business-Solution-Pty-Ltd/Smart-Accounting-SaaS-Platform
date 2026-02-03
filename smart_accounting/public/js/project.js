/**
 * Project Client Script
 * NOTE (2026-02):
 * Status options are managed via DocType meta (Customize Form / Property Setter).
 * We intentionally DO NOT override `status.options` here, otherwise it will shadow
 * the global status pool and any future per-board configuration in Smart Board.
 */

frappe.ui.form.on('Project', {
    refresh: function(frm) {},
    project_type: function(frm) {}
});
