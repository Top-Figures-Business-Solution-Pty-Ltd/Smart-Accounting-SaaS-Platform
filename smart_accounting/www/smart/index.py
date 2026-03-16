from __future__ import annotations

import frappe

from smart_accounting.access_control import (
	SMART_ACCOUNTING_ROUTE,
	SMART_GRANTS_ROUTE,
	get_product_module_access,
)

from ._brand import get_brand_context


def get_context(context):
	"""
	Product platform selector entrypoint.
	"""
	context.login_required = True
	context.no_cache = 1

	for k, v in (get_brand_context() or {}).items():
		setattr(context, k, v)

	module_access = get_product_module_access()
	context.module_cards = [
		{
			"key": "accounting",
			"title": "Smart Accounting",
			"description": "Boards, clients, reporting, automation logs, and project execution workflows.",
			"href": SMART_ACCOUNTING_ROUTE,
			"available": bool(module_access.get("accounting")),
			"status_text": "Available" if module_access.get("accounting") else "No access",
		},
		{
			"key": "grants",
			"title": "Smart Grants",
		"description": "Grants workspace for project intake, tracking, and module-specific data management.",
			"href": SMART_GRANTS_ROUTE,
			"available": bool(module_access.get("grants")),
			"status_text": "Available" if module_access.get("grants") else "No access",
		},
	]
	context.has_any_module_access = any(bool(card.get("available")) for card in context.module_cards)

	denied = str((getattr(frappe.local, "form_dict", {}) or {}).get("denied") or "").strip().lower()
	context.denied_module = denied
	context.denied_module_label = {
		"accounting": "Smart Accounting",
		"grants": "Smart Grants",
	}.get(denied, "")
	return context


