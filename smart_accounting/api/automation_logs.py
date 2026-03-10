"""
Automation run log APIs (website-safe)
"""

from __future__ import annotations

from typing import Any

import frappe


def _ensure_logged_in() -> None:
	if frappe.session.user in (None, "", "Guest"):
		frappe.throw("Not permitted", frappe.PermissionError)


def _normalize_int(v: Any, default: int = 0) -> int:
	try:
		return int(v)
	except Exception:
		return int(default)


def _clean(v: Any) -> str:
	return str(v or "").strip()


@frappe.whitelist()
def get_automation_run_logs(
	automation: str | None = None,
	project: str | None = None,
	project_type: str | None = None,
	result: str | None = None,
	execution_source: str | None = None,
	search: str | None = None,
	limit_start: int = 0,
	limit_page_length: int = 20,
) -> dict:
	_ensure_logged_in()
	limit_start = max(0, _normalize_int(limit_start, 0))
	limit_page_length = max(1, min(100, _normalize_int(limit_page_length, 20)))

	filters: dict[str, Any] = {}
	automation_name = _clean(automation)
	project_name = _clean(project)
	project_type_name = _clean(project_type)
	result_name = _clean(result)
	source_name = _clean(execution_source)
	search_term = _clean(search)
	if automation_name:
		filters["automation"] = automation_name
	if project_name:
		if not frappe.has_permission("Project", "read", project_name):
			frappe.throw("Not permitted", frappe.PermissionError)
		filters["project"] = project_name
	if project_type_name:
		filters["project_type"] = project_type_name
	if result_name:
		filters["result"] = result_name
	if source_name:
		filters["execution_source"] = source_name

	or_filters = None
	if search_term:
		like = f"%{search_term}%"
		or_filters = [
			["automation_name", "like", like],
			["project_title", "like", like],
			["project", "like", like],
			["message", "like", like],
		]

	rows = frappe.get_all(
		"Automation Run Log",
		filters=filters,
		or_filters=or_filters,
		fields=[
			"name",
			"run_id",
			"automation",
			"automation_name",
			"project",
			"project_title",
			"project_type",
			"triggered_at",
			"execution_source",
			"result",
			"message",
			"changed_field_count",
		],
		order_by="triggered_at desc, creation desc",
		limit_start=limit_start,
		limit_page_length=limit_page_length,
		ignore_permissions=True,
	)

	items = []
	for row in (rows or []):
		log_name = _clean(row.get("name"))
		changes = frappe.get_all(
			"Automation Run Log Change",
			filters={"parent": log_name, "parenttype": "Automation Run Log", "parentfield": "changes"},
			fields=["fieldname", "field_label", "action_type", "from_value", "to_value"],
			order_by="idx asc",
			limit_page_length=20,
			ignore_permissions=True,
		) if log_name else []
		items.append({**row, "changes": changes or []})

	total_rows = frappe.get_all(
		"Automation Run Log",
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
			"limit_start": limit_start,
			"limit_page_length": limit_page_length,
			"total_count": total_count,
		},
	}
