from __future__ import annotations

from typing import Any

import frappe
from frappe.client import insert as core_insert


def _resolve_customer_id(value: Any) -> str:
	v = str(value or "").strip()
	if not v:
		return ""
	if frappe.db.exists("Customer", v):
		return v
	rows = frappe.get_all(
		"Customer",
		fields=["name"],
		filters={"customer_name": v},
		limit_page_length=2,
	)
	if len(rows or []) == 1:
		return str(rows[0].get("name") or "").strip()
	if len(rows or []) > 1:
		frappe.throw(f"Multiple Customers found for name: {v}. Please choose a unique Client.")
	return ""


@frappe.whitelist()
def insert(doc=None):
	"""
	Override frappe.client.insert for /smart compatibility.
	Only transforms Project.customer from customer_name -> Customer.name.
	"""
	if isinstance(doc, str):
		try:
			payload = frappe.parse_json(doc) or {}
		except Exception:
			payload = {}
	else:
		payload = doc or {}

	if isinstance(payload, dict) and str(payload.get("doctype") or "").strip() == "Project":
		raw = payload.get("customer")
		resolved = _resolve_customer_id(raw)
		if resolved:
			payload["customer"] = resolved

	return core_insert(doc=payload)

