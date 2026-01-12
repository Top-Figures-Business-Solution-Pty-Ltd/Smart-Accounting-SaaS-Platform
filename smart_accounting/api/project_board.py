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

def _ensure_logged_in() -> None:
	if frappe.session.user in (None, "", "Guest"):
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

@frappe.whitelist()
def hydrate_project_children(projects: Any) -> dict:
	"""
	Website-safe bulk fetch for Project child tables needed by Smart Board.

	Why:
	- frappe.client.get_list on child tables may raise PermissionError due to parent permission checks.
	- We first compute the list of Projects the current user can read (permission-aware),
	  then query child tables with ignore_permissions=True but only for those allowed parents.
	"""
	_ensure_logged_in()

	names = _normalize_list(projects)
	names = [str(x).strip() for x in names if str(x).strip()]
	if not names:
		return {"team": {}, "softwares": {}}

	# Respect Project permissions
	allowed = frappe.get_all("Project", filters=[["name", "in", names]], pluck="name")
	allowed = [str(x) for x in (allowed or [])]
	if not allowed:
		return {"team": {}, "softwares": {}}

	team_rows = frappe.get_all(
		"Project Team Member",
		filters=[["parent", "in", allowed]],
		fields=["parent", "user", "role", "assigned_date"],
		limit_page_length=10000,
		ignore_permissions=True,
	)
	soft_rows = frappe.get_all(
		"Project Software",
		filters=[["parent", "in", allowed]],
		fields=["parent", "software"],
		limit_page_length=10000,
		ignore_permissions=True,
	)

	team = {}
	for r in (team_rows or []):
		p = r.get("parent")
		if not p:
			continue
		team.setdefault(p, []).append(r)

	softwares = {}
	for r in (soft_rows or []):
		p = r.get("parent")
		if not p:
			continue
		softwares.setdefault(p, []).append(r)

	return {"team": team, "softwares": softwares}


@frappe.whitelist()
def get_user_meta(users: Any) -> dict:
	"""
	Return lightweight user metadata for UI display (full_name + user_image).
	Website-safe for /smart, avoids frappe.client.get_list('User') permission issues.

	Only returns:
	- name
	- full_name (fallback to name)
	- user_image
	"""
	_ensure_logged_in()

	names = _normalize_list(users)
	names = [str(x).strip() for x in names if str(x).strip()]
	if not names:
		return {}

	try:
		# IMPORTANT: do NOT bypass permissions on User.
		# If the current role cannot read User, we safely fall back to label=name with no image.
		rows = frappe.get_all(
			"User",
			filters=[["name", "in", names], ["enabled", "=", 1]],
			fields=["name", "full_name", "user_image"],
			limit_page_length=min(500, len(names)),
		)
	except frappe.PermissionError:
		rows = []

	out = {}
	for u in (rows or []):
		key = u.get("name")
		if not key:
			continue
		out[key] = {
			"label": u.get("full_name") or key,
			"image": u.get("user_image") or "",
		}
	# Ensure deterministic fallback for any missing
	for n in names:
		out.setdefault(n, {"label": n, "image": ""})
	return out


@frappe.whitelist()
def query_project_names_advanced(project_type: str | None = None, groups: Any = None, limit: int = 2000, is_active_only: int = 1, search: str | None = None) -> dict:
	"""
	Resolve advanced filter groups to a list of Project names.

	groups payload:
	- list of { join: "where"|"and"|"or", rules: [{ field, condition, value }] }

	We evaluate by running one DB query per group (AND inside group),
	then combine group result sets by group.join (AND => intersect, OR => union).
	This supports expressions like: (A AND B) OR (C AND D) safely.
	"""
	limit = int(limit or 2000)
	limit = max(1, min(limit, 10000))

	parsed_groups = _normalize_list(groups)
	if not parsed_groups:
		# No groups => no restriction
		return {"no_restriction": 1, "names": []}

	def rule_to_triple(r: dict) -> list | None:
		field = (r.get("field") or "").strip()
		cond = (r.get("condition") or "").strip()
		val = r.get("value")
		if not field or not cond:
			return None
		needs = cond not in ("is_empty", "is_not_empty")
		v = "" if val is None else str(val)
		if needs and not v:
			return None
		if cond == "equals":
			return [field, "=", v]
		if cond == "not_equals":
			return [field, "!=", v]
		if cond == "contains":
			return [field, "like", f"%{v}%"]
		if cond == "not_contains":
			return [field, "not like", f"%{v}%"]
		if cond == "starts_with":
			return [field, "like", f"{v}%"]
		if cond == "before":
			return [field, "<", v]
		if cond == "after":
			return [field, ">", v]
		if cond == "on_or_before":
			return [field, "<=", v]
		if cond == "on_or_after":
			return [field, ">=", v]
		if cond == "is_empty":
			return [field, "=", ""]
		if cond == "is_not_empty":
			return [field, "!=", ""]
		return None

	def base_filters() -> list:
		f = []
		if project_type:
			f.append(["project_type", "=", project_type])
		if is_active_only:
			f.append(["is_active", "=", "Yes"])
		if search:
			f.append(["project_name", "like", f"%{search}%"])
		return f

	combined: set[str] | None = None
	for idx, g in enumerate(parsed_groups):
		if not isinstance(g, dict):
			continue
		join = (g.get("join") or ("where" if idx == 0 else "and")).lower()
		rules = _normalize_list(g.get("rules"))
		group_filters = base_filters()
		for r in rules:
			if not isinstance(r, dict):
				continue
			t = rule_to_triple(r)
			if t:
				group_filters.append(t)

		# If group has no valid rules beyond base, skip it.
		if len(group_filters) == len(base_filters()):
			continue

		rows = frappe.get_all("Project", filters=group_filters, pluck="name", limit_page_length=limit)
		names = set(rows or [])

		if combined is None:
			combined = names
			continue
		if join == "or":
			combined |= names
		else:
			combined &= names

	final = list(combined or [])
	final.sort()
	# If no group had any effective rule, treat as "no restriction" (do not filter everything out).
	if combined is None:
		return {"no_restriction": 1, "names": []}
	return {"names": final[:limit]}


