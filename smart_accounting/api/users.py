"""
Users APIs (website-safe)
"""

from __future__ import annotations

from typing import Any

import frappe


def _ensure_logged_in() -> None:
	if frappe.session.user in (None, "", "Guest"):
		frappe.throw("Not permitted", frappe.PermissionError)


def _normalize_int(v: Any, default: int) -> int:
	try:
		return int(v)
	except Exception:
		return int(default)


@frappe.whitelist()
def get_users(search: str | None = None, limit_start: int = 0, limit_page_length: int = 100) -> dict:
	"""
	List system users for the product shell.

	Returns:
	- items: [{name, full_name, email, enabled}]
	"""
	_ensure_logged_in()

	q = str(search or "").strip()
	limit_start = max(0, _normalize_int(limit_start, 0))
	limit_page_length = max(1, min(200, _normalize_int(limit_page_length, 100)))

	filters: list[list[Any]] = [["name", "!=", "Guest"], ["user_type", "=", "System User"]]
	or_filters: list[list[Any]] = []
	if q:
		like = f"%{q}%"
		or_filters = [
			["name", "like", like],
			["email", "like", like],
			["full_name", "like", like],
		]

	rows = frappe.get_all(
		"User",
		filters=filters,
		or_filters=or_filters,
		fields=["name", "full_name", "email", "enabled"],
		order_by="enabled desc, full_name asc, name asc",
		limit_start=limit_start,
		limit_page_length=limit_page_length,
		ignore_permissions=True,
	)

	items = []
	for row in rows or []:
		name = str(row.get("name") or "").strip()
		email = str(row.get("email") or "").strip() or name
		full_name = str(row.get("full_name") or "").strip() or email or name
		if not name:
			continue
		items.append(
			{
				"name": name,
				"full_name": full_name,
				"email": email,
				"enabled": int(row.get("enabled") or 0),
			}
		)

	total_rows = frappe.get_all(
		"User",
		filters=filters,
		or_filters=or_filters,
		fields=["count(name) as cnt"],
		limit_page_length=1,
		ignore_permissions=True,
	)
	try:
		total_count = int((total_rows or [{}])[0].get("cnt") or 0)
	except Exception:
		total_count = len(items)

	return {
		"items": items,
		"meta": {
			"total_count": total_count,
			"returned_count": len(items),
			"limit_start": limit_start,
			"limit_page_length": limit_page_length,
		},
	}
