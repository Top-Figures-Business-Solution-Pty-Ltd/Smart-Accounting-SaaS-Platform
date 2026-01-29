"""
Clients APIs (website-safe)

Source of truth:
- Customer (ERPNext)
- Customer Entity (child table; stored as its own DocType rows with parent linkage)
"""

from __future__ import annotations

from typing import Any

import frappe
from frappe.exceptions import DuplicateEntryError


def _ensure_logged_in() -> None:
	if frappe.session.user in (None, "", "Guest"):
		frappe.throw("Not permitted", frappe.PermissionError)


def _normalize_int(v: Any, default: int) -> int:
	try:
		return int(v)
	except Exception:
		return int(default)


def _clean_spaces(s: str) -> str:
	return " ".join(str(s or "").strip().split())


def _cap_word(w: str) -> str:
	t = str(w or "").strip().lower()
	if not t:
		return ""
	return t[:1].upper() + t[1:]


def _cap_hyphen(w: str) -> str:
	parts = [p for p in str(w or "").split("-") if p.strip()]
	return "-".join([_cap_word(p) for p in parts if _cap_word(p)])


def _title_case_words(name: str) -> str:
	clean = _clean_spaces(name)
	if not clean:
		return ""
	return " ".join([_cap_hyphen(w) for w in clean.split(" ") if w.strip()])


def _format_individual(name: str) -> str:
	clean = _clean_spaces(name)
	if not clean:
		return ""
	last = ""
	first = ""
	if "," in clean:
		parts = clean.split(",", 1)
		last = _clean_spaces(parts[0])
		first = _clean_spaces(parts[1])
	else:
		parts = [p for p in clean.split(" ") if p.strip()]
		if len(parts) == 1:
			last = parts[0]
		else:
			last = parts[-1]
			first = parts[0]
	last_up = str(last or "").upper()
	first_cap = _cap_word(first)
	return f"{last_up}, {first_cap}" if first_cap else last_up


def _normalize_client_name(name: str, customer_type: str) -> str:
	ct = str(customer_type or "").strip()
	if ct == "Individual":
		return _format_individual(name)
	# Non-Individual
	return _title_case_words(name)


def _pick_default(doctype: str, preferred_name: str) -> str | None:
	"""Best-effort pick a default value for Link fields like Customer Group / Territory."""
	try:
		if preferred_name and frappe.db.exists(doctype, preferred_name):
			return preferred_name
	except Exception:
		pass
	try:
		rows = frappe.get_all(doctype, fields=["name"], limit_page_length=1)
		if rows:
			return rows[0].get("name")
	except Exception:
		pass
	return None


def _build_client_summary(customer: dict, primary_entity: dict | None = None) -> dict:
	"""Return a minimal item shape compatible with ClientsTable rows."""
	return {
		"name": customer.get("name"),
		"customer_name": customer.get("customer_name") or customer.get("name"),
		"customer_group": customer.get("customer_group"),
		"territory": customer.get("territory"),
		"disabled": int(customer.get("disabled") or 0),
		"modified": customer.get("modified"),
		"entities_count": 1 if primary_entity else 0,
		"project_count": 0,
		"active_project_count": 0,
		"last_project_type": "",
		"primary_entity": primary_entity,
	}


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


@frappe.whitelist()
def create_client(payload: dict | None = None) -> dict:
	"""
	Create a new Customer (and optional Primary Entity row).
	Website-safe: designed for /smart shell.

	payload:
	{
	  customer_name: str (required)
	  customer_type: "Company"|"Individual"|... (optional)
	  customer_group: str (optional)
	  territory: str (optional)
	  primary_entity: {
	    entity_name: str
	    entity_type: str
	    abn: str|None
	    year_end: str|None
	  } | null
	}
	"""
	_ensure_logged_in()

	# frappe.call may send nested objects as JSON strings; normalize here.
	if isinstance(payload, str):
		try:
			data = frappe.parse_json(payload) or {}
		except Exception:
			data = {}
	else:
		data = payload or {}
	if not isinstance(data, dict):
		data = {}
	customer_name = str(data.get("customer_name") or "").strip()
	if not customer_name:
		frappe.throw("customer_name is required")

	customer_type = str(data.get("customer_type") or "").strip() or "Individual"
	customer_group = str(data.get("customer_group") or "").strip() or (_pick_default("Customer Group", "All Customer Groups") or "")
	territory = str(data.get("territory") or "").strip() or (_pick_default("Territory", "All Territories") or "")

	primary = data.get("primary_entity") or None
	primary_entity_row = None
	if isinstance(primary, dict):
		entity_name = str(primary.get("entity_name") or "").strip()
		entity_type = str(primary.get("entity_type") or "").strip()
		abn = str(primary.get("abn") or "").strip() or None
		year_end = str(primary.get("year_end") or "").strip() or None
		if not year_end:
			frappe.throw("year_end is required")
		if entity_name and entity_type:
			primary_entity_row = {
				"doctype": "Customer Entity",
				"entity_name": entity_name,
				"entity_type": entity_type,
				"abn": abn,
				"year_end": year_end,
				"is_primary": 1,
			}

	try:
		doc = frappe.get_doc(
			{
				"doctype": "Customer",
				"customer_name": customer_name,
				"customer_type": customer_type,
				"customer_group": customer_group or None,
				"territory": territory or None,
				# Child table field may or may not exist; append only if present.
				"custom_entities": [primary_entity_row] if primary_entity_row else [],
			}
		)
		doc.insert()
	except DuplicateEntryError:
		frappe.throw("Customer already exists")

	# Return a website-safe summary (avoid sending full doc blob)
	customer = doc.as_dict()
	pe = None
	if primary_entity_row:
		pe = {
			"entity_name": primary_entity_row.get("entity_name"),
			"entity_type": primary_entity_row.get("entity_type"),
			"abn": primary_entity_row.get("abn"),
			"year_end": primary_entity_row.get("year_end"),
			"is_primary": 1,
		}
	return {"item": _build_client_summary(customer, pe)}


@frappe.whitelist()
def normalize_client_names(apply: int = 0) -> dict:
	"""
	Normalize Customer.customer_name using standard naming rules.
	- Individual: LAST, First
	- Non-Individual: Title Case words
	Only updates customer_name (does NOT rename the Customer docname).
	"""
	_ensure_logged_in()
	if not frappe.has_permission("Customer", "write"):
		frappe.throw("Not permitted", frappe.PermissionError)

	rows = frappe.get_all(
		"Customer",
		fields=["name", "customer_name", "customer_type"],
		limit_page_length=100000,
	)

	changes = []
	for r in rows or []:
		docname = r.get("name")
		cur = str(r.get("customer_name") or r.get("name") or "").strip()
		if not docname or not cur:
			continue
		target = _normalize_client_name(cur, str(r.get("customer_type") or ""))
		target = str(target or "").strip()
		if target and target != cur:
			changes.append({"name": docname, "from": cur, "to": target})

	if not apply:
		return {
			"total": len(rows or []),
			"to_update": len(changes),
			"sample": changes[:10],
		}

	updated = 0
	for c in changes:
		try:
			frappe.db.set_value("Customer", c["name"], "customer_name", c["to"], update_modified=True)
			updated += 1
		except Exception:
			# Best-effort: skip failures and continue
			pass

	return {
		"total": len(rows or []),
		"updated": updated,
		"skipped": max(0, len(changes) - updated),
		"sample": changes[:10],
	}


@frappe.whitelist()
def check_client_name_exists(name: str | None = None) -> dict:
	"""
	Check if a Customer already exists with the same customer_name (or docname).
	Used by /smart New Client to prompt before creating duplicates.
	"""
	_ensure_logged_in()
	q = str(name or "").strip()
	if not q:
		return {"exists": False, "items": []}

	rows = frappe.get_all(
		"Customer",
		fields=["name", "customer_name"],
		filters={"customer_name": q},
		limit_page_length=5,
	)
	# Also check docname equality (ERPNext may name by customer_name)
	rows2 = frappe.get_all(
		"Customer",
		fields=["name", "customer_name"],
		filters={"name": q},
		limit_page_length=5,
	)
	merged = {r.get("name"): r for r in (rows or []) if r.get("name")}
	for r in rows2 or []:
		if r.get("name"):
			merged[r.get("name")] = r

	items = list(merged.values())
	return {"exists": bool(items), "items": items}


