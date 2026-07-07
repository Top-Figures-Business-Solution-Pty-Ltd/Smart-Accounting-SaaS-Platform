# -*- coding: utf-8 -*-
"""
Rename the Payroll board and remove the one-off Payday Super board.

This patch is intentionally idempotent so production deploys can run it safely
through `bench migrate`.

- Project Type "Payroll" becomes "Payroll & Super".
- One-off Project Types "Payday Super Preparation" / legacy misspelling
  "Payday Super Preperation" are deleted.
- Deleting a Project Type uses SmartProjectType.on_trash, which moves any
  remaining Projects to Archived (Holding), archives them, and records the
  original board in custom_archive_source_ref.
- Saved View / Board Settings defaults are cleaned so the sidebar does not keep
  stale board names.
"""

from __future__ import annotations

from typing import Any

import frappe

OLD_PAYROLL = "Payroll"
NEW_PAYROLL = "Payroll & Super"
PAYDAY_BOARDS = ("Payday Super Preparation", "Payday Super Preperation")


def execute():
    _ensure_archived_holding()
    _rename_payroll_board()
    _delete_payday_boards()
    _cleanup_saved_order()
    _cleanup_status_config()
    frappe.db.commit()


def _ensure_archived_holding() -> None:
    try:
        from smart_accounting.overrides.project_type import ensure_archived_holding_type

        ensure_archived_holding_type()
    except Exception:
        # Do not fail the whole migration for this helper; deletion will still
        # fail loudly later if holding is truly required and cannot be created.
        pass


def _rename_payroll_board() -> None:
    old_exists = bool(frappe.db.exists("Project Type", OLD_PAYROLL))
    new_exists = bool(frappe.db.exists("Project Type", NEW_PAYROLL))

    if old_exists:
        frappe.rename_doc(
            "Project Type",
            OLD_PAYROLL,
            NEW_PAYROLL,
            force=True,
            merge=new_exists,
            show_alert=False,
        )

    # Saved View.project_type is a Data field in this app, so Frappe's Link
    # rename machinery will not update it automatically.
    _replace_value("Saved View", "project_type", OLD_PAYROLL, NEW_PAYROLL)


def _delete_payday_boards() -> None:
    for board in PAYDAY_BOARDS:
        _delete_saved_views_for_board(board)
        _clear_payday_run_logs(board)
        if frappe.db.exists("Project Type", board):
            frappe.delete_doc("Project Type", board, ignore_permissions=True, force=True)


def _delete_saved_views_for_board(board: str) -> None:
    if not _has_column("Saved View", "project_type"):
        return
    try:
        views = frappe.get_all("Saved View", filters={"project_type": board}, pluck="name")
    except Exception:
        views = []
    for view in views or []:
        try:
            frappe.delete_doc("Saved View", view, ignore_permissions=True, force=True)
        except Exception:
            pass


def _clear_payday_run_logs(board: str) -> None:
    # Automation Run Log.project_type is a nullable Link; keep the audit rows but
    # remove the stale board link so Project Type deletion is not blocked.
    _replace_value("Automation Run Log", "project_type", board, "")


def _cleanup_saved_order() -> None:
    key = "smart_accounting_project_type_order"
    raw = _get_global_default(key)
    order = _parse_json_list(raw)
    if not order:
        return

    next_order: list[str] = []
    seen = set()
    for name in order:
        n = str(name or "").strip()
        if not n or n in PAYDAY_BOARDS:
            continue
        if n == OLD_PAYROLL:
            n = NEW_PAYROLL
        if n in seen:
            continue
        next_order.append(n)
        seen.add(n)

    if next_order != order:
        frappe.defaults.set_global_default(key, frappe.as_json(next_order))


def _cleanup_status_config() -> None:
    key = "smart_accounting_project_type_status_config"
    raw = _get_global_default(key)
    cfg = _parse_json_dict(raw)
    if not cfg:
        return

    changed = False
    if OLD_PAYROLL in cfg:
        old_val = cfg.pop(OLD_PAYROLL)
        cfg.setdefault(NEW_PAYROLL, old_val)
        changed = True
    for board in PAYDAY_BOARDS:
        if board in cfg:
            cfg.pop(board, None)
            changed = True

    if changed:
        frappe.defaults.set_global_default(key, frappe.as_json(cfg))


def _replace_value(doctype: str, fieldname: str, old: str, new: str) -> None:
    if not _has_column(doctype, fieldname):
        return
    try:
        rows = frappe.get_all(doctype, filters={fieldname: old}, pluck="name", ignore_permissions=True)
    except Exception:
        rows = []
    for name in rows or []:
        try:
            frappe.db.set_value(doctype, name, fieldname, new, update_modified=False)
        except Exception:
            pass


def _has_column(doctype: str, fieldname: str) -> bool:
    try:
        return bool(frappe.db.has_column(doctype, fieldname))
    except Exception:
        return False


def _get_global_default(key: str) -> str | None:
    try:
        return frappe.defaults.get_global_default(key)
    except Exception:
        return None


def _parse_json_list(raw: Any) -> list[str]:
    try:
        val = frappe.parse_json(raw) if raw else []
    except Exception:
        val = []
    if not isinstance(val, list):
        return []
    return [str(x or "").strip() for x in val if str(x or "").strip()]


def _parse_json_dict(raw: Any) -> dict:
    try:
        val = frappe.parse_json(raw) if raw else {}
    except Exception:
        val = {}
    return val if isinstance(val, dict) else {}
