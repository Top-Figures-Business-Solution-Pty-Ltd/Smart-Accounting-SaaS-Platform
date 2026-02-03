"""
Admin helpers for status options (bench-only convenience).

Why:
- Some Frappe versions block changing Select 'options' via Customize Form UI.
- Misconfigured Property Setter (e.g. DocType Action/Link) can shadow the intended DocField override.
"""

from __future__ import annotations

import frappe


def _status_pool() -> list[str]:
	return [
		"Not started",
		"Working on it",
		"Waiting for client",
		"R&D",
		"Ready for manager review",
		"Review points to be actioned",
		"Ready for partner review",
		"Ready to send to client",
		"Sent to client for signature",
		"Hold",
		"Waiting of payment",
		"Lodged",
		"Done",
	]


def apply_project_status_pool() -> dict:
	"""
	Set Project.status options to the Smart Accounting status pool.
	Intended to run via:
	  bench --site <site> execute smart_accounting.api.status_admin.apply_project_status_pool
	"""
	# Delete any existing conflicting property setters (regardless of schema)
	frappe.db.delete("Property Setter", {"name": "Project-status-options"})
	frappe.db.delete("Property Setter", {"doc_type": "Project", "property": "options", "field_name": "status"})
	frappe.db.delete("Property Setter", {"doc_type": "Project", "property": "options", "row_name": "status"})

	pool = _status_pool()
	value = "\n".join(pool)

	make_property_setter = frappe.get_attr("frappe.custom.doctype.property_setter.property_setter.make_property_setter")
	ps = make_property_setter(
		"Project",
		"status",
		"options",
		value,
		"Text",
		for_doctype=False,
		validate_fields_for_doctype=False,
		is_system_generated=False,
	)

	# Ensure default value is valid (ERPNext default is "Open")
	try:
		frappe.db.delete("Property Setter", {"name": "Project-status-default"})
		frappe.db.delete(
			"Property Setter",
			{"doc_type": "Project", "property": "default", "field_name": "status"},
		)
	except Exception:
		pass
	make_property_setter(
		"Project",
		"status",
		"default",
		"Not started",
		"Text",
		for_doctype=False,
		validate_fields_for_doctype=False,
		is_system_generated=False,
	)

	try:
		frappe.clear_cache(doctype="Project")
	except Exception:
		pass

	return {"property_setter": ps.name, "count": len(pool)}


def get_project_status_stats() -> dict:
	"""Return current status distribution (including legacy/invalid values)."""
	rows = frappe.db.sql(
		"""
		select status, count(*) as cnt
		from `tabProject`
		group by status
		order by cnt desc
		""",
		as_dict=True,
	)
	total = sum(int(r.get("cnt") or 0) for r in (rows or []))
	return {"total": total, "items": rows or []}


def migrate_project_statuses(dry_run: int = 1, default_status: str = "Not started") -> dict:
	"""
	Migrate legacy Project.status values to the new pool so existing documents can be saved.
	Run:
	  bench --site <site> execute smart_accounting.api.status_admin.migrate_project_statuses
	  bench --site <site> execute smart_accounting.api.status_admin.migrate_project_statuses --kwargs "{'dry_run':0}"
	"""
	pool = _status_pool()
	pool_set = {s for s in pool if str(s).strip()}
	default = str(default_status or "Not started").strip() or "Not started"
	if default not in pool_set:
		default = "Not started"

	# Best-effort mapping from common ERPNext / Smart Board legacy statuses to the new pool.
	mapping = {
		"Open": "Not started",
		"Not Started": "Not started",
		"Working": "Working on it",
		"Ready for Review": "Ready for manager review",
		"Under Review": "Ready for manager review",
		"Partner Review": "Ready for partner review",
		"Query from ATO": "Waiting for client",
		"Query from AusIndustry": "Waiting for client",
		"Resubmit": "Working on it",
		"Approved": "Done",
		"Completed": "Done",
		"Cancelled": "Hold",
		"Canceled": "Hold",
		"Lodged": "Lodged",
	}

	rows = frappe.db.sql(
		"""
		select status, count(*) as cnt
		from `tabProject`
		group by status
		""",
		as_dict=True,
	)

	plan = []
	for r in rows or []:
		raw = r.get("status")  # can be None
		cnt = int(r.get("cnt") or 0)
		cur = str(raw or "").strip()
		if not cur:
			target = default
		elif cur in pool_set:
			target = cur
		elif cur in mapping:
			target = mapping[cur]
		else:
			# Unknown legacy value => default (safe)
			target = default
		if target != cur:
			plan.append({"from": raw, "to": target, "count": cnt})

	planned = sum(int(x.get("count") or 0) for x in plan)
	if int(dry_run or 0):
		unknown = [x for x in plan if str(x.get("from") or "").strip() and str(x.get("from")).strip() not in mapping]
		return {
			"dry_run": True,
			"pool": pool,
			"default": default,
			"to_update": planned,
			"changes": plan,
			"unknown_legacy": unknown[:50],
		}

	updated = 0
	for ch in plan:
		src = ch.get("from")
		dst = ch.get("to")
		if src is None:
			frappe.db.sql("update `tabProject` set status=%s where status is null", (dst,))
		else:
			src_str = str(src or "")
			frappe.db.sql("update `tabProject` set status=%s where status=%s", (dst, src_str))
		updated += int(ch.get("count") or 0)

	frappe.db.commit()
	try:
		frappe.clear_cache(doctype="Project")
	except Exception:
		pass
	return {"dry_run": False, "updated": updated, "default": default, "pool_count": len(pool)}


