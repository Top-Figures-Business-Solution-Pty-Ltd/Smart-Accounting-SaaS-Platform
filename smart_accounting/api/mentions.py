"""
Mention APIs
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
def search_users(query: str | None = None, limit: int = 8) -> dict:
	"""
	Website-safe user search for @mention picker.

	Returns:
	- items: [{ name, full_name, user_image }]
	"""
	_ensure_logged_in()

	q = (query or "").strip()
	limit = _normalize_int(limit, 8)
	limit = max(1, min(limit, 20))

	filters = {"enabled": 1}
	or_filters = []
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
		fields=["name", "full_name", "user_image"],
		order_by="full_name asc",
		limit_page_length=limit,
		ignore_permissions=True,
	)

	# Hide Guest/system users
	items = []
	for r in rows or []:
		name = r.get("name")
		if not name or name == "Guest":
			continue
		items.append(
			{
				"name": name,
				"full_name": r.get("full_name") or name,
				"user_image": r.get("user_image") or "",
			}
		)

	return {"items": items}


