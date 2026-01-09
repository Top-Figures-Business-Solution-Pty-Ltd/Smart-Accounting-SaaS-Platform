"""
Smart Board - Project editing APIs

These APIs exist to keep the frontend architecture healthy:
- Complex columns (child tables / table multiselect) should NOT be mutated via
  ad-hoc `frappe.client.set_value` payloads from the browser.
- Instead, the frontend submits a small, validated payload, and backend performs
  a controlled update on the Project doc.

All methods are website-safe (usable from /smart shell) and permission-aware.
"""

from __future__ import annotations

from typing import Any, Iterable

import frappe
from frappe.utils import today


def _ensure_write_permission(doc) -> None:
	# Enforce standard permission checks (no ignore_permissions here).
	if not doc.has_permission("write"):
		frappe.throw("Not permitted", frappe.PermissionError)


def _normalize_list(value: Any) -> list:
	if value is None:
		return []
	if isinstance(value, list):
		return value
	# Accept JSON string from frappe.call
	if isinstance(value, str):
		try:
			parsed = frappe.parse_json(value)
			return parsed if isinstance(parsed, list) else []
		except Exception:
			return []
	return []


def _uniq_preserve_order(items: Iterable[tuple]) -> list[tuple]:
	seen = set()
	out = []
	for x in items:
		if x in seen:
			continue
		seen.add(x)
		out.append(x)
	return out


@frappe.whitelist()
def set_project_team_members(project: str, members: Any) -> dict:
	"""
	Replace Project.custom_team_members (child table: Project Team Member).

	Payload members:
	- list of { user: str, role: str } OR JSON string of that list

	We store:
	- user (Link/User)
	- role (Select options from Project Team Member meta)
	- assigned_date (today)
	"""
	if not project:
		frappe.throw("Missing project")

	doc = frappe.get_doc("Project", project)
	_ensure_write_permission(doc)

	rows = _normalize_list(members)
	normalized = []
	for m in rows:
		if not isinstance(m, dict):
			continue
		user = (m.get("user") or "").strip()
		role = (m.get("role") or "").strip() or "Preparer"
		if not user:
			continue
		normalized.append((user, role))

	normalized = _uniq_preserve_order(normalized)

	# Replace table
	doc.set("custom_team_members", [])
	for user, role in normalized:
		doc.append(
			"custom_team_members",
			{
				"user": user,
				"role": role,
				"assigned_date": today(),
			},
		)

	doc.save()

	return {
		"project": doc.name,
		"custom_team_members": doc.get("custom_team_members") or [],
	}


@frappe.whitelist()
def set_project_softwares(project: str, softwares: Any) -> dict:
	"""
	Replace Project.custom_softwares (Table MultiSelect -> child doctype: Project Software).

	Payload softwares:
	- list of strings (Software name) OR list of { software: str } OR JSON string
	"""
	if not project:
		frappe.throw("Missing project")

	doc = frappe.get_doc("Project", project)
	_ensure_write_permission(doc)

	rows = _normalize_list(softwares)
	values: list[str] = []

	for x in rows:
		if isinstance(x, str):
			v = x.strip()
		elif isinstance(x, dict):
			v = str(x.get("software") or "").strip()
		else:
			v = ""
		if not v:
			continue
		values.append(v)

	values = [v for (v,) in _uniq_preserve_order([(v,) for v in values])]

	# Replace table. For Table MultiSelect, child rows usually store link in `software`.
	doc.set("custom_softwares", [])
	for v in values:
		doc.append("custom_softwares", {"software": v})

	doc.save()

	return {
		"project": doc.name,
		"custom_softwares": doc.get("custom_softwares") or [],
	}


