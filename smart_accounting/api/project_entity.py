"""
Project Entity APIs (website-safe)

Purpose:
- Bridge Project -> Customer Entity selection for Smart Board (Entity column).
- Provide a safe fallback so Entity can display even when Project.custom_customer_entity is empty.

Key fields:
- Project.custom_customer_entity (Link -> Customer Entity row name)  [override]
- Project.custom_entity_type (Data, read-only, historically fetch_from custom_customer_entity.entity_type)

Design:
- Read path: provide customer entities list for a given Project (so UI can pick).
- Write path: set Project.custom_customer_entity and return the resolved entity_type for UI refresh.
- Utility: attach effective entity_type to Project list rows (override -> primary entity fallback).
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


def attach_effective_entity_type(project_rows: list[dict]) -> list[dict]:
	"""
	Attach `custom_entity_type` to Project rows when missing.

	Rules:
	- If Project.custom_customer_entity is set: use that Customer Entity.entity_type (override)
	- Else: use Customer's primary entity (Customer Entity where parent=<customer> and is_primary=1)

	Best-effort:
	- Never raises; returns rows unchanged on any error.
	- Uses ignore_permissions=True because this is used in /smart shell, but caller should still
	  ensure the user can read Projects (Project list query already enforces this).
	"""
	rows = list(project_rows or [])
	if not rows:
		return rows

	try:
		customers = [str(r.get("customer") or "").strip() for r in rows if str(r.get("customer") or "").strip()]
		links = [str(r.get("custom_customer_entity") or "").strip() for r in rows if str(r.get("custom_customer_entity") or "").strip()]
	except Exception:
		customers = []
		links = []

	# De-dupe (stable-ish)
	customers = list(dict.fromkeys(customers))
	links = list(dict.fromkeys(links))

	by_link: dict[str, str] = {}
	by_customer_primary: dict[str, str] = {}

	# Override path: linked entity rows
	if links:
		try:
			erows = frappe.get_all(
				"Customer Entity",
				filters=[["name", "in", links]],
				fields=["name", "entity_type"],
				ignore_permissions=True,
				limit_page_length=100000,
			)
			for e in erows or []:
				n = str(e.get("name") or "").strip()
				t = str(e.get("entity_type") or "").strip()
				if n and t:
					by_link[n] = t
		except Exception:
			pass

	# Fallback path: primary entity per customer
	if customers:
		try:
			prows = frappe.get_all(
				"Customer Entity",
				filters=[["parent", "in", customers], ["is_primary", "=", 1]],
				fields=["parent", "entity_type"],
				ignore_permissions=True,
				limit_page_length=100000,
			)
			for e in prows or []:
				c = str(e.get("parent") or "").strip()
				t = str(e.get("entity_type") or "").strip()
				if c and t and c not in by_customer_primary:
					by_customer_primary[c] = t
		except Exception:
			pass

	# Attach
	for r in rows:
		try:
			if str(r.get("custom_entity_type") or "").strip():
				continue
			link = str(r.get("custom_customer_entity") or "").strip()
			if link and link in by_link:
				r["custom_entity_type"] = by_link.get(link) or ""
				continue
			c = str(r.get("customer") or "").strip()
			if c and c in by_customer_primary:
				r["custom_entity_type"] = by_customer_primary.get(c) or ""
		except Exception:
			continue

	return rows


@frappe.whitelist()
def get_project_customer_entities(project: str | None = None) -> dict:
	"""
	Return Customer Entity rows for the Project's customer.

	Returns:
	- { customer: str, items: [{name, entity_name, entity_type, year_end, abn, is_primary}, ...] }
	"""
	_ensure_logged_in()
	pn = str(project or "").strip()
	if not pn:
		frappe.throw("project is required")

	# Ensure the user can at least read this Project (UI is scoped to visible rows)
	if not frappe.has_permission("Project", "read", pn):
		frappe.throw("Not permitted", frappe.PermissionError)

	customer = frappe.db.get_value("Project", pn, "customer")
	customer = str(customer or "").strip()
	if not customer:
		return {"customer": "", "items": []}

	try:
		items = frappe.get_all(
			"Customer Entity",
			filters={
				"parenttype": "Customer",
				"parentfield": "custom_entities",
				"parent": customer,
			},
			fields=["name", "entity_name", "entity_type", "year_end", "abn", "is_primary"],
			order_by="is_primary desc, modified desc",
			ignore_permissions=True,
			limit_page_length=200,
		)
	except Exception:
		items = []

	return {"customer": customer, "items": items or []}


@frappe.whitelist()
def set_project_customer_entity(project: str | None = None, customer_entity: str | None = None) -> dict:
	"""
	Set Project.custom_customer_entity and return the resolved entity_type for immediate UI refresh.

	Notes:
	- We also write Project.custom_entity_type to keep storage consistent for non-desk flows
	  (Desk fetch_from is client-side; /smart updates need server-side alignment).
	"""
	_ensure_logged_in()
	pn = str(project or "").strip()
	en = str(customer_entity or "").strip()
	if not pn:
		frappe.throw("project is required")
	if not en:
		frappe.throw("customer_entity is required")

	if not frappe.has_permission("Project", "write", pn):
		frappe.throw("Not permitted", frappe.PermissionError)

	customer = frappe.db.get_value("Project", pn, "customer")
	customer = str(customer or "").strip()
	if not customer:
		frappe.throw("Project has no customer")

	row = frappe.db.get_value(
		"Customer Entity",
		en,
		["name", "parent", "entity_type"],
		as_dict=True,
	)
	if not row:
		frappe.throw("Customer Entity not found")

	parent = str(row.get("parent") or "").strip()
	entity_type = str(row.get("entity_type") or "").strip()
	if parent and parent != customer:
		frappe.throw("Customer Entity does not belong to the Project's client")

	# Persist both fields for consistent display in /smart (without relying on client fetch_from)
	try:
		frappe.db.set_value(
			"Project",
			pn,
			{"custom_customer_entity": en, "custom_entity_type": entity_type},
			update_modified=True,
		)
	except Exception as e:
		frappe.throw(str(e))

	return {"project": pn, "custom_customer_entity": en, "custom_entity_type": entity_type}


@frappe.whitelist()
def backfill_project_customer_entities(limit: int = 2000, dry_run: int = 1, active_only: int = 0) -> dict:
	"""
	Backfill missing Project.custom_customer_entity using the Customer's primary entity.

	Admin/debug tool intended for test environments.

	Returns:
	- ok: bool
	- dry_run: 1/0
	- scanned: int
	- missing_entity_link: int
	- will_update: int
	- missing_primary_entity: int
	- updated: [project_name] (limited)
	"""
	_ensure_logged_in()
	roles = set(frappe.get_roles(frappe.session.user) or [])
	if frappe.session.user != "Administrator" and "System Manager" not in roles:
		frappe.throw("Not permitted", frappe.PermissionError)

	limit = max(1, min(20000, _normalize_int(limit, 2000)))
	dry_run = 1 if int(dry_run or 0) else 0
	active_only = 1 if int(active_only or 0) else 0

	cond_active = " and ifnull(is_active,'')='Yes' " if active_only else ""
	rows = frappe.db.sql(
		f"""
		select name, customer, custom_customer_entity, custom_entity_type
		from `tabProject`
		where ifnull(customer,'')!=''
		  and ifnull(custom_customer_entity,'')=''
		  {cond_active}
		order by modified desc
		limit %s
		""",
		(limit,),
		as_dict=True,
	)

	scanned = len(rows or [])
	if not scanned:
		return {
			"ok": True,
			"dry_run": dry_run,
			"scanned": 0,
			"missing_entity_link": 0,
			"will_update": 0,
			"missing_primary_entity": 0,
			"updated": [],
		}

	customers = list(dict.fromkeys([str(r.get("customer") or "").strip() for r in rows if str(r.get("customer") or "").strip()]))
	primary_by_customer: dict[str, dict] = {}
	if customers:
		try:
			ents = frappe.get_all(
				"Customer Entity",
				filters=[["parent", "in", customers], ["is_primary", "=", 1]],
				fields=["name", "parent", "entity_type"],
				ignore_permissions=True,
				limit_page_length=100000,
			)
		except Exception:
			ents = []
		for e in ents or []:
			c = str(e.get("parent") or "").strip()
			if not c or c in primary_by_customer:
				continue
			primary_by_customer[c] = {
				"name": str(e.get("name") or "").strip(),
				"entity_type": str(e.get("entity_type") or "").strip(),
			}

	will_update = 0
	missing_primary = 0
	updated = []

	for r in rows or []:
		pn = str(r.get("name") or "").strip()
		c = str(r.get("customer") or "").strip()
		pe = primary_by_customer.get(c) if c else None
		if not pn or not c or not pe or not pe.get("name"):
			missing_primary += 1
			continue
		will_update += 1
		if dry_run:
			continue
		try:
			frappe.db.set_value(
				"Project",
				pn,
				{
					"custom_customer_entity": pe.get("name"),
					"custom_entity_type": pe.get("entity_type") or "",
				},
				update_modified=False,
			)
			if len(updated) < 50:
				updated.append(pn)
		except Exception:
			continue

	return {
		"ok": True,
		"dry_run": dry_run,
		"scanned": scanned,
		"missing_entity_link": scanned,
		"will_update": will_update,
		"missing_primary_entity": missing_primary,
		"updated": updated,
	}


