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


def _project_names_with_read_permission(names: list[str]) -> list[str]:
	# Respect Project permissions first; this bounds all downstream queries.
	allowed = frappe.get_all("Project", filters=[["name", "in", names]], pluck="name")
	return [str(x) for x in (allowed or [])]


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
def bulk_set_project_field(projects: Any, field: str, value: Any) -> dict:
	"""
	Bulk update a single field across many Projects (single request).

	- Permission-aware: checks write permission per Project.
	- Field must exist on Project; otherwise save() will raise.

	Returns:
	- updated: list of project names updated
	"""
	_ensure_logged_in()
	names = _normalize_list(projects)
	names = [str(x).strip() for x in names if str(x).strip()]
	field = (field or "").strip()
	if not names:
		return {"updated": []}
	if not field:
		frappe.throw("Missing field")

	updated: list[str] = []
	for name in names:
		doc = frappe.get_doc("Project", name)
		_ensure_write_permission(doc)
		doc.set(field, value)
		doc.save()
		updated.append(doc.name)

	return {"updated": updated}


@frappe.whitelist()
def bulk_set_project_softwares(projects: Any, softwares: Any) -> dict:
	"""
	Bulk replace Project.custom_softwares (Table MultiSelect) for many Projects.
	Same softwares list is applied to all selected Projects.

	Returns:
	- softwares: { project_name: [ {software: str}, ... ] }
	"""
	_ensure_logged_in()
	names = _normalize_list(projects)
	names = [str(x).strip() for x in names if str(x).strip()]
	if not names:
		return {"softwares": {}}

	rows = _normalize_list(softwares)
	values: list[str] = []
	for x in rows:
		if isinstance(x, str):
			v = x.strip()
		elif isinstance(x, dict):
			v = str(x.get("software") or "").strip()
		else:
			v = ""
		if v:
			values.append(v)
	values = [v for (v,) in _uniq_preserve_order([(v,) for v in values])]
	# canonical child row shape for UI
	child_rows = [{"software": v} for v in values]

	out = {}
	for name in names:
		doc = frappe.get_doc("Project", name)
		_ensure_write_permission(doc)
		doc.set("custom_softwares", [])
		for v in values:
			doc.append("custom_softwares", {"software": v})
		doc.save()
		out[doc.name] = doc.get("custom_softwares") or child_rows

	return {"softwares": out}


@frappe.whitelist()
def bulk_set_project_team_role(projects: Any, role: str, users: Any) -> dict:
	"""
	Bulk update ONE role column (team:<Role>) across many Projects.
	We replace only rows where custom_team_members.role == role, and keep other roles.

	Returns:
	- team: { project_name: [ {user, role, assigned_date}, ... ] }
	"""
	_ensure_logged_in()
	names = _normalize_list(projects)
	names = [str(x).strip() for x in names if str(x).strip()]
	role = (role or "").strip()
	if not names:
		return {"team": {}}
	if not role:
		frappe.throw("Missing role")

	rows = _normalize_list(users)
	users_clean = [str(x).strip() for x in rows if str(x).strip()]
	users_clean = [u for (u,) in _uniq_preserve_order([(u,) for u in users_clean])]

	out = {}
	for name in names:
		doc = frappe.get_doc("Project", name)
		_ensure_write_permission(doc)

		existing = doc.get("custom_team_members") or []
		kept = []
		for m in existing:
			if str(getattr(m, "role", "") or "").strip() != role:
				kept.append({"user": getattr(m, "user", None), "role": getattr(m, "role", None), "assigned_date": getattr(m, "assigned_date", None)})

		doc.set("custom_team_members", [])
		# re-add kept (preserve assigned_date where possible)
		for m in kept:
			if not m.get("user") or not m.get("role"):
				continue
			doc.append("custom_team_members", m)

		# set role users
		for u in users_clean:
			doc.append("custom_team_members", {"user": u, "role": role, "assigned_date": today()})

		doc.save()
		out[doc.name] = doc.get("custom_team_members") or []

	return {"team": out}


@frappe.whitelist()
def get_task_counts(projects: Any) -> dict:
	"""
	Return Task counts per Project for Smart Board expand button.

	Permission model:
	- Only considers Projects the current user can READ.
	- Task query uses standard permissions (no ignore_permissions).

	Returns:
	- counts: { project_name: int }
	"""
	_ensure_logged_in()
	names = _normalize_list(projects)
	names = [str(x).strip() for x in names if str(x).strip()]
	if not names:
		return {"counts": {}}

	allowed = _project_names_with_read_permission(names)
	if not allowed:
		return {"counts": {}}

	try:
		rows = frappe.get_all(
			"Task",
			filters=[["project", "in", allowed]],
			fields=["project"],
			limit_page_length=100000,
		)
	except frappe.PermissionError:
		return {"counts": {}}

	counts = {}
	for r in (rows or []):
		p = r.get("project")
		if not p:
			continue
		counts[p] = int(counts.get(p, 0)) + 1
	return {"counts": counts}


@frappe.whitelist()
def get_tasks_for_projects(projects: Any, fields: Any = None, limit_per_project: int = 200) -> dict:
	"""
	Bulk fetch Tasks for a list of Projects.

	- Website-safe
	- Permission-aware:
	  - only Projects user can read are considered
	  - Task query uses standard permission checks (no ignore_permissions)

	Args:
	- projects: list of Project names (or JSON string)
	- fields: list of Task fields (or JSON string). Will be filtered by allowlist.
	- limit_per_project: max tasks returned per project (best-effort)

	Returns:
	- tasks: { project_name: [ {field: value, ...}, ... ] }
	"""
	_ensure_logged_in()
	names = _normalize_list(projects)
	names = [str(x).strip() for x in names if str(x).strip()]
	if not names:
		return {"tasks": {}}

	allowed_projects = _project_names_with_read_permission(names)
	if not allowed_projects:
		return {"tasks": {}}

	allowed_fields = {
		"name",
		"subject",
		"status",
		"priority",
		"exp_start_date",
		"exp_end_date",
		"modified",
		"creation",
		"owner",
		"project",
		"parent_task",
	}
	req_fields = _normalize_list(fields)
	req_fields = [str(x).strip() for x in req_fields if str(x).strip()]
	# Always include name + project so we can group reliably
	final_fields = ["name", "project"]
	for f in req_fields:
		if f in allowed_fields and f not in final_fields:
			final_fields.append(f)
	if "subject" not in final_fields:
		final_fields.append("subject")

	limit_per_project = int(limit_per_project or 200)
	limit_per_project = max(1, min(limit_per_project, 1000))

	try:
		rows = frappe.get_all(
			"Task",
			filters=[["project", "in", allowed_projects]],
			fields=final_fields,
			order_by="modified desc",
			limit_page_length=min(100000, limit_per_project * max(1, len(allowed_projects))),
		)
	except frappe.PermissionError:
		return {"tasks": {}}

	out = {p: [] for p in allowed_projects}
	for r in (rows or []):
		p = r.get("project")
		if not p or p not in out:
			continue
		# Best-effort per-project limit
		if len(out[p]) >= limit_per_project:
			continue
		out[p].append(r)

	# Only return keys requested (preserve input order)
	result = {}
	for p in names:
		if p in out:
			result[p] = out[p]
	return {"tasks": result}


@frappe.whitelist()
def create_task_for_project(project: str, subject: str | None = None) -> dict:
	"""
	Create a new Task under a Project (Smart Board "Add New Task").

	- Permission-aware (no ignore_permissions)
	- Requires logged-in user
	"""
	_ensure_logged_in()
	project = str(project or "").strip()
	if not project:
		frappe.throw("Missing project")

	allowed = _project_names_with_read_permission([project])
	if project not in set(allowed or []):
		frappe.throw("Not permitted")

	subject = str(subject or "").strip() or "New Task"

	doc = frappe.new_doc("Task")
	doc.project = project
	doc.subject = subject
	doc.insert()

	return {"task": {"name": doc.name, "project": doc.project, "subject": doc.subject}}


@frappe.whitelist()
def get_my_projects_with_roles() -> dict:
	"""
	Dashboard: list Projects related to current user via Project.custom_team_members.

	Returns:
	- projects: [
		{ name, project_name, project_type, status, roles: [..], role_text: "..." }
	  ]
	"""
	_ensure_logged_in()
	user = frappe.session.user
	user = str(user or "").strip()
	if not user or user == "Guest":
		return {"projects": []}

	# Child table may be permission-guarded by parent; read only rows for current user.
	try:
		team_rows = frappe.get_all(
			"Project Team Member",
			filters={"user": user},
			fields=["parent", "role"],
			ignore_permissions=True,
			limit_page_length=100000,
		)
	except Exception:
		team_rows = []

	parent_to_roles: dict[str, list[str]] = {}
	for r in (team_rows or []):
		p = str(r.get("parent") or "").strip()
		role = str(r.get("role") or "").strip()
		if not p:
			continue
		parent_to_roles.setdefault(p, [])
		if role and role not in parent_to_roles[p]:
			parent_to_roles[p].append(role)

	if not parent_to_roles:
		return {"projects": []}

	# Respect Project permissions
	allowed = _project_names_with_read_permission(list(parent_to_roles.keys()))
	allowed = [str(x).strip() for x in (allowed or []) if str(x).strip()]
	if not allowed:
		return {"projects": []}

	try:
		prows = frappe.get_all(
			"Project",
			filters=[["name", "in", allowed]],
			fields=["name", "project_name", "project_type", "status"],
			limit_page_length=10000,
		)
	except frappe.PermissionError:
		return {"projects": []}

	by_name = {p.get("name"): p for p in (prows or []) if p.get("name")}
	out = []
	for name in allowed:
		p = by_name.get(name) or {}
		roles = parent_to_roles.get(name, [])
		out.append(
			{
				"name": name,
				"project_name": p.get("project_name") or name,
				"project_type": p.get("project_type") or "",
				"status": p.get("status") or "",
				"roles": roles,
				"role_text": " / ".join([x for x in roles if x]) if roles else "",
			}
		)

	return {"projects": out}

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


