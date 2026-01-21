"""
Board Settings APIs (website-safe)
- Currently: manage Project Type order shown in Smart Board sidebar.

Design:
- Do NOT require DocType/field changes.
- Store ordering in global defaults as JSON array.
"""

from __future__ import annotations

from typing import Any

import frappe


DEFAULT_KEY_PROJECT_TYPE_ORDER = "smart_accounting_project_type_order"


def _ensure_logged_in() -> None:
	if frappe.session.user in (None, "", "Guest"):
		frappe.throw("Not permitted", frappe.PermissionError)


def _ensure_can_manage_board_settings() -> None:
	# Board settings affect everyone; keep it admin/system-manager for now.
	user = frappe.session.user
	try:
		if user == "Administrator":
			return
	except Exception:
		pass
	if not frappe.has_permission("Role", "read"):
		# Cheap guard: role read is usually granted to admins only.
		pass
	# Role checks
	if not frappe.has_role("System Manager"):
		frappe.throw("Not permitted", frappe.PermissionError)


def _get_all_project_types() -> list[str]:
	rows = frappe.get_all("Project Type", fields=["name"], order_by="name asc", limit_page_length=5000)
	return [r.get("name") for r in rows if r.get("name")]


def _get_saved_order() -> list[str]:
	try:
		raw = frappe.defaults.get_global_default(DEFAULT_KEY_PROJECT_TYPE_ORDER)
	except Exception:
		raw = None
	if not raw:
		return []
	try:
		val = frappe.parse_json(raw)
		if isinstance(val, list):
			return [str(x).strip() for x in val if str(x).strip()]
	except Exception:
		return []
	return []


def _set_saved_order(order: list[str]) -> None:
	# Store as JSON string in global defaults
	try:
		frappe.defaults.set_global_default(DEFAULT_KEY_PROJECT_TYPE_ORDER, frappe.as_json(order))
	except Exception:
		# Fallback: set as plain JSON string
		frappe.defaults.set_global_default(DEFAULT_KEY_PROJECT_TYPE_ORDER, str(order))


def _merge_order(saved: list[str], all_types: list[str]) -> list[str]:
	seen = set()
	out: list[str] = []
	for n in saved or []:
		if n in seen:
			continue
		if n in all_types:
			out.append(n)
			seen.add(n)
	for n in all_types:
		if n in seen:
			continue
		out.append(n)
		seen.add(n)
	return out


@frappe.whitelist()
def get_project_types() -> dict:
	"""Return ordered Project Types for the Smart Board sidebar."""
	_ensure_logged_in()
	all_types = _get_all_project_types()
	saved = _get_saved_order()
	ordered = _merge_order(saved, all_types)
	return {"items": [{"name": n} for n in ordered]}


@frappe.whitelist()
def get_project_type_order() -> dict:
	"""Return current saved order (for the Board Settings UI)."""
	_ensure_logged_in()
	all_types = _get_all_project_types()
	saved = _get_saved_order()
	ordered = _merge_order(saved, all_types)
	return {
		"order": ordered,
		"all": all_types,
		"meta": {"key": DEFAULT_KEY_PROJECT_TYPE_ORDER},
	}


@frappe.whitelist()
def set_project_type_order(order: Any = None) -> dict:
	"""
	Set Project Type ordering.
	order: list[str] or JSON string list
	"""
	_ensure_logged_in()
	_ensure_can_manage_board_settings()

	val = order
	if isinstance(val, str):
		try:
			val = frappe.parse_json(val)
		except Exception:
			val = None
	if not isinstance(val, list):
		frappe.throw("order must be a list")

	all_types = _get_all_project_types()
	all_set = set(all_types)
	clean = []
	seen = set()
	for x in val:
		n = str(x).strip()
		if not n or n in seen:
			continue
		if n not in all_set:
			continue
		clean.append(n)
		seen.add(n)

	# Persist only explicit ordering; unlisted types will be appended automatically.
	_set_saved_order(clean)
	return {"ok": True, "saved_count": len(clean)}


