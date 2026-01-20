"""
Clients APIs (website-safe)

Source of truth:
- Customer (ERPNext)
- Customer Entity (child table; stored as its own DocType rows with parent linkage)
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
def get_clients(search: str | None = None, limit_start: int = 0, limit_page_length: int = 50) -> dict:
	"""
	List Customers with an entity summary (from Customer Entity child table).

	Returns:
	- items: [
	    {
	      name, customer_name, customer_group, territory, disabled, modified,
	      entities_count,
	      primary_entity: { entity_name, entity_type, abn, year_end, is_primary } | None
	    }, ...
	  ]
	"""
	_ensure_logged_in()

	q = (search or "").strip()
	limit_start = max(0, _normalize_int(limit_start, 0))
	limit_page_length = max(1, min(200, _normalize_int(limit_page_length, 50)))

	fields = [
		"name",
		"customer_name",
		"customer_group",
		"territory",
		"disabled",
		"modified",
	]
	filters: dict[str, Any] = {}
	or_filters = []
	if q:
		like = f"%{q}%"
		or_filters = [["name", "like", like], ["customer_name", "like", like]]

	customers = frappe.get_all(
		"Customer",
		fields=fields,
		filters=filters,
		or_filters=or_filters,
		order_by="modified desc",
		limit_start=limit_start,
		limit_page_length=limit_page_length,
	)

	# Total count for UI ("Showing X / total")
	# Note: get_all respects permissions; we use an aggregate query to match the same permission scope.
	total_count = None
	try:
		cnt_rows = frappe.get_all(
			"Customer",
			fields=["count(name) as cnt"],
			filters=filters,
			or_filters=or_filters,
			limit_page_length=1,
		)
		if cnt_rows and isinstance(cnt_rows, list):
			total_count = int((cnt_rows[0] or {}).get("cnt") or 0)
	except Exception:
		total_count = None

	names = [c.get("name") for c in (customers or []) if c.get("name")]
	by_customer: dict[str, list[dict]] = {n: [] for n in names}
	project_counts: dict[str, int] = {n: 0 for n in names}
	active_project_counts: dict[str, int] = {n: 0 for n in names}
	last_project_type: dict[str, str] = {n: "" for n in names}

	if names:
		# Project counts per customer (permission-aware)
		try:
			rows = frappe.get_all(
				"Project",
				filters={"customer": ["in", names]},
				fields=["customer", "count(name) as project_count"],
				group_by="customer",
				limit_page_length=100000,
			)
			for r in rows or []:
				cn = r.get("customer")
				if cn in project_counts:
					project_counts[cn] = int(r.get("project_count") or 0)
		except Exception:
			pass

		# Active-only counts (best-effort; field exists in your Project customizations)
		try:
			rows2 = frappe.get_all(
				"Project",
				filters={"customer": ["in", names], "is_active": "Yes"},
				fields=["customer", "count(name) as project_count"],
				group_by="customer",
				limit_page_length=100000,
			)
			for r in rows2 or []:
				cn = r.get("customer")
				if cn in active_project_counts:
					active_project_counts[cn] = int(r.get("project_count") or 0)
		except Exception:
			pass

		# Last project type (most recently modified project) per customer
		try:
			rows3 = frappe.get_all(
				"Project",
				filters={"customer": ["in", names]},
				fields=["customer", "project_type", "modified"],
				order_by="modified desc",
				limit_page_length=5000,
			)
			seen = set()
			for r in rows3 or []:
				cn = r.get("customer")
				if not cn or cn in seen or cn not in last_project_type:
					continue
				last_project_type[cn] = str(r.get("project_type") or "").strip()
				seen.add(cn)
		except Exception:
			pass

		# Fetch child entities (best-effort; will respect perms based on parent linkage in most setups)
		try:
			entities = frappe.get_all(
				"Customer Entity",
				filters={
					"parenttype": "Customer",
					"parentfield": "custom_entities",
					"parent": ["in", names],
				},
				fields=["parent", "entity_name", "entity_type", "abn", "year_end", "is_primary"],
				order_by="is_primary desc, modified desc",
				limit_page_length=100000,
			)
		except Exception:
			entities = []

		for e in (entities or []):
			p = e.get("parent")
			if p and p in by_customer:
				by_customer[p].append(e)

	items = []
	for c in (customers or []):
		name = c.get("name")
		es = by_customer.get(name) or []
		primary = None
		if es:
			primary = es[0]
		items.append(
			{
				**c,
				"entities_count": len(es),
				"project_count": int(project_counts.get(name) or 0),
				"active_project_count": int(active_project_counts.get(name) or 0),
				"last_project_type": str(last_project_type.get(name) or ""),
				"primary_entity": (
					{
						"entity_name": primary.get("entity_name"),
						"entity_type": primary.get("entity_type"),
						"abn": primary.get("abn"),
						"year_end": primary.get("year_end"),
						"is_primary": primary.get("is_primary"),
					}
					if primary
					else None
				),
			}
		)

	return {
		"items": items,
		"meta": {
			"total_count": total_count,
			"returned_count": len(items),
			"limit_start": limit_start,
			"limit_page_length": limit_page_length,
		},
	}


