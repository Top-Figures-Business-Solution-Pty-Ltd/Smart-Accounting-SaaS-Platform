# -*- coding: utf-8 -*-
"""
Delete the one-off "Super" board (Project Type).

This patch is intentionally idempotent for production deploys:
- If "Super" is already gone, it only cleans stale board defaults and returns.
- If Projects still reference "Super", SmartProjectType.on_trash moves them to
  Archived (Holding), archives them, and records custom_archive_source_ref.
- Saved Views and board defaults pinned to "Super" are removed so the board does
  not resurface after deploy.
"""

from __future__ import annotations

from typing import Any

import frappe

BOARD = "Super"
PROJECT_TYPE_ORDER_KEY = "smart_accounting_project_type_order"
PROJECT_TYPE_STATUS_CONFIG_KEY = "smart_accounting_project_type_status_config"


def execute():
	_ensure_archived_holding()
	_delete_saved_views_for_board(BOARD)
	_clear_nullable_project_type_links(BOARD)
	_cleanup_saved_order(BOARD)
	_cleanup_status_config(BOARD)

	if frappe.db.exists("Project Type", BOARD):
		frappe.delete_doc("Project Type", BOARD, ignore_permissions=True, force=True)

	frappe.db.commit()


def _ensure_archived_holding() -> None:
	try:
		from smart_accounting.overrides.project_type import ensure_archived_holding_type

		ensure_archived_holding_type()
	except Exception:
		# If Projects still reference the board, deletion below will fail loudly.
		pass


def _delete_saved_views_for_board(board: str) -> None:
	if not _has_column("Saved View", "project_type"):
		return
	try:
		views = frappe.get_all("Saved View", filters={"project_type": board}, pluck="name", ignore_permissions=True)
	except Exception:
		views = []
	for view in views or []:
		try:
			frappe.delete_doc("Saved View", view, ignore_permissions=True, force=True)
		except Exception:
			# Saved View cleanup should not mask the authoritative Project Type delete result.
			pass


def _clear_nullable_project_type_links(board: str) -> None:
	# Keep audit rows but clear nullable Project Type links that can block deletion.
	_replace_value("Automation Run Log", "project_type", board, "")


def _cleanup_saved_order(board: str) -> None:
	order = _parse_json_list(_get_global_default(PROJECT_TYPE_ORDER_KEY))
	if not order:
		return
	next_order = [x for x in order if str(x or "").strip() != board]
	if next_order != order:
		frappe.defaults.set_global_default(PROJECT_TYPE_ORDER_KEY, frappe.as_json(next_order))


def _cleanup_status_config(board: str) -> None:
	cfg = _parse_json_dict(_get_global_default(PROJECT_TYPE_STATUS_CONFIG_KEY))
	if not cfg or board not in cfg:
		return
	cfg.pop(board, None)
	frappe.defaults.set_global_default(PROJECT_TYPE_STATUS_CONFIG_KEY, frappe.as_json(cfg))


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
		return bool(frappe.db.exists("DocType", doctype) and frappe.db.has_column(doctype, fieldname))
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
