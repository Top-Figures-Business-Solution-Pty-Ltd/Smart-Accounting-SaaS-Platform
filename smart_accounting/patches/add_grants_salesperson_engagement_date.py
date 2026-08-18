# -*- coding: utf-8 -*-
"""
Add Smart Grants Salesperson and Engagement Date fields.

This patch is idempotent for test/prod deploys:
- creates the Project custom fields if missing;
- updates labels/types/options if a previous manual field exists;
- keeps the Project form field order sensible.
"""

from __future__ import annotations

from typing import Any

import frappe


FIELDS = [
	{
		"fieldname": "custom_engagement_date",
		"label": "Engagement Date",
		"fieldtype": "Date",
		"insert_after": "custom_grants_fy_label",
	},
	{
		"fieldname": "custom_grants_salesperson",
		"label": "Salesperson",
		"fieldtype": "Link",
		"options": "User",
		"insert_after": "custom_grants_priority",
	},
]


def execute():
	for field in FIELDS:
		_upsert_project_custom_field(field)
	_update_project_field_order()
	_update_grants_saved_views()
	frappe.db.commit()
	try:
		frappe.clear_cache(doctype="Project")
	except Exception:
		pass


def _upsert_project_custom_field(field: dict[str, Any]) -> None:
	fieldname = str(field.get("fieldname") or "").strip()
	if not fieldname:
		return

	name = f"Project-{fieldname}"
	payload = {
		"dt": "Project",
		"fieldname": fieldname,
		"label": field.get("label") or fieldname,
		"fieldtype": field.get("fieldtype") or "Data",
		"insert_after": field.get("insert_after") or None,
		"options": field.get("options") or None,
		"is_system_generated": 1,
	}

	if frappe.db.exists("Custom Field", name):
		doc = frappe.get_doc("Custom Field", name)
		changed = False
		for key, value in payload.items():
			if doc.get(key) != value:
				doc.set(key, value)
				changed = True
		if changed:
			doc.save(ignore_permissions=True)
		return

	doc = frappe.get_doc({"doctype": "Custom Field", **payload})
	doc.insert(ignore_permissions=True)


def _update_project_field_order() -> None:
	rows = frappe.get_all(
		"Property Setter",
		filters={"doc_type": "Project", "property": "field_order"},
		fields=["name", "value"],
		ignore_permissions=True,
	)
	for row in rows or []:
		try:
			order = frappe.parse_json(row.get("value"))
		except Exception:
			continue
		if not isinstance(order, list):
			continue
		next_order = list(order)
		next_order = _insert_after(next_order, "custom_engagement_date", "custom_grants_fy_label")
		next_order = _insert_after(next_order, "custom_grants_salesperson", "custom_grants_priority")
		if next_order != order:
			frappe.db.set_value("Property Setter", row.get("name"), "value", frappe.as_json(next_order), update_modified=False)


def _insert_after(order: list, fieldname: str, after: str) -> list:
	cleaned = [x for x in order if str(x or "").strip() != fieldname]
	try:
		idx = cleaned.index(after)
	except ValueError:
		cleaned.append(fieldname)
		return cleaned
	cleaned.insert(idx + 1, fieldname)
	return cleaned


def _update_grants_saved_views() -> None:
	if not frappe.db.exists("DocType", "Saved View"):
		return
	try:
		rows = frappe.get_all(
			"Saved View",
			fields=["name", "project_type", "columns"],
			ignore_permissions=True,
			limit_page_length=100000,
		)
	except Exception:
		return
	for row in rows or []:
		project_type = str(row.get("project_type") or "").strip()
		try:
			columns = frappe.parse_json(row.get("columns"))
		except Exception:
			continue
		if not _looks_like_grants_view(project_type, columns):
			continue
		next_columns, changed = _update_columns_payload(columns)
		if not changed:
			continue
		try:
			frappe.db.set_value("Saved View", row.get("name"), "columns", frappe.as_json(next_columns), update_modified=False)
		except Exception:
			pass


def _looks_like_grants_view(project_type: str, columns: Any) -> bool:
	if project_type.startswith("FY "):
		return True
	fields = set(_extract_column_fields(columns))
	grants_markers = {
		"custom_grants_fy_label",
		"custom_grants_partner_label",
		"custom_grants_priority",
		"custom_grants_status",
	}
	return bool(fields & grants_markers)


def _extract_column_fields(columns: Any) -> list[str]:
	if isinstance(columns, list):
		return [str(c.get("field") or "").strip() for c in columns if isinstance(c, dict) and c.get("field")]
	if isinstance(columns, dict):
		out: list[str] = []
		for key in ("project", "projectColumns"):
			out.extend(_extract_column_fields(columns.get(key)))
		return out
	return []


def _update_columns_payload(columns: Any) -> tuple[Any, bool]:
	if isinstance(columns, list):
		return _update_columns_list(columns)
	if isinstance(columns, dict):
		changed = False
		next_obj = dict(columns)
		for key in ("project", "projectColumns"):
			if isinstance(columns.get(key), list):
				next_list, c = _update_columns_list(columns.get(key))
				next_obj[key] = next_list
				changed = changed or c
		return next_obj, changed
	return columns, False


def _update_columns_list(columns: list) -> tuple[list, bool]:
	out = []
	changed = False
	has_engagement = False
	has_salesperson = False
	for col in columns:
		if not isinstance(col, dict):
			out.append(col)
			continue
		field = str(col.get("field") or "").strip()
		if field == "custom_engagement_date":
			has_engagement = True
		if field == "custom_grants_salesperson":
			has_salesperson = True
		if field == "custom_grants_partner_label":
			if has_salesperson:
				changed = True
				continue
			next_col = {**col, "field": "custom_grants_salesperson", "label": "Salesperson", "width": col.get("width") or 150}
			out.append(next_col)
			has_salesperson = True
			changed = True
			continue
		out.append(col)

	if not has_engagement:
		insert_at = _find_column_index(out, "custom_grants_fy_label")
		engagement_col = {"field": "custom_engagement_date", "label": "Engagement Date", "width": 150}
		if insert_at >= 0:
			out.insert(insert_at + 1, engagement_col)
		else:
			out.append(engagement_col)
		changed = True

	return out, changed


def _find_column_index(columns: list, fieldname: str) -> int:
	for idx, col in enumerate(columns):
		if isinstance(col, dict) and str(col.get("field") or "").strip() == fieldname:
			return idx
	return -1
