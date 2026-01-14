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


def _year_end_to_month_num(year_end: str | None) -> int | None:
	"""
	Map Customer Entity.year_end (Select) to month number.
	Expected values: June/December/March/September (case-insensitive).
	"""
	if not year_end:
		return None
	s = str(year_end).strip().lower()
	m = {
		"june": 6,
		"december": 12,
		"march": 3,
		"september": 9,
	}.get(s)
	return int(m) if m else None


def _fy_start_month_from_year_end(year_end: str | None) -> int | None:
	m = _year_end_to_month_num(year_end)
	if not m:
		return None
	return (m % 12) + 1


def _get_project_fy_start_months(project_rows: list[dict]) -> tuple[dict[str, int], dict[int, int]]:
	"""
	Compute fiscal start month per Project:
	- Prefer Project.custom_customer_entity.year_end (override)
	- Fallback to Customer primary entity year_end

	Returns:
	- by_project: { project_name: start_month_int }
	- counts: { start_month_int: n_projects }
	"""
	by_project: dict[str, int] = {}
	counts: dict[int, int] = {}

	projects = [r for r in (project_rows or []) if r.get("name")]
	if not projects:
		return by_project, counts

	# 1) Collect customers + entity links
	customers = [str(r.get("customer") or "").strip() for r in projects if str(r.get("customer") or "").strip()]
	entity_links = [str(r.get("custom_customer_entity") or "").strip() for r in projects if str(r.get("custom_customer_entity") or "").strip()]
	customers = list(dict.fromkeys(customers))
	entity_links = list(dict.fromkeys(entity_links))

	# 2) Fetch year_end for linked Customer Entity rows (override path)
	entity_year_end: dict[str, str] = {}
	if entity_links:
		try:
			rows = frappe.get_all(
				"Customer Entity",
				filters=[["name", "in", entity_links]],
				fields=["name", "year_end"],
				ignore_permissions=True,
				limit_page_length=100000,
			)
			for r in (rows or []):
				n = str(r.get("name") or "").strip()
				ye = str(r.get("year_end") or "").strip()
				if n and ye:
					entity_year_end[n] = ye
		except Exception:
			pass

	# 3) Fetch primary entity year_end per customer (fallback path)
	customer_year_end: dict[str, str] = {}
	if customers:
		try:
			rows = frappe.get_all(
				"Customer Entity",
				filters=[["parent", "in", customers], ["is_primary", "=", 1]],
				fields=["parent", "year_end"],
				ignore_permissions=True,
				limit_page_length=100000,
			)
			for r in (rows or []):
				c = str(r.get("parent") or "").strip()
				ye = str(r.get("year_end") or "").strip()
				if c and ye and c not in customer_year_end:
					customer_year_end[c] = ye
		except Exception:
			pass

	# 4) Build per-project mapping
	for r in projects:
		pn = str(r.get("name") or "").strip()
		if not pn:
			continue
		ye = None
		el = str(r.get("custom_customer_entity") or "").strip()
		if el and el in entity_year_end:
			ye = entity_year_end.get(el)
		if not ye:
			c = str(r.get("customer") or "").strip()
			ye = customer_year_end.get(c)
		start = _fy_start_month_from_year_end(ye)
		if start:
			by_project[pn] = start
			counts[start] = int(counts.get(start, 0)) + 1

	return by_project, counts


@frappe.whitelist()
def get_board_fiscal_start_month(projects: Any) -> dict:
	"""
	Return board-level fiscal start month (1-12) based on projects' primary year_end.
	We choose the most common start_month across the provided projects.

	Returns:
	- start_month: int | None
	- counts: { start_month: n }
	- by_project: { project_name: start_month }
	"""
	_ensure_logged_in()
	names = _normalize_list(projects)
	names = [str(x).strip() for x in names if str(x).strip()]
	if not names:
		return {"start_month": None, "counts": {}, "by_project": {}}

	allowed = _project_names_with_read_permission(names)
	if not allowed:
		return {"start_month": None, "counts": {}, "by_project": {}}

	prows = frappe.get_all(
		"Project",
		filters=[["name", "in", allowed]],
		fields=["name", "customer", "custom_customer_entity"],
		limit_page_length=100000,
	)
	by_project, counts = _get_project_fy_start_months(prows or [])
	start_month = None
	if counts:
		start_month = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))[0][0]
	return {"start_month": start_month, "counts": counts, "by_project": by_project}


@frappe.whitelist()
def set_monthly_status(reference_doctype: str, reference_name: str, fiscal_year: str, month_index: int, status: str) -> dict:
	"""
	Upsert a Monthly Status cell.
	- reference_doctype: Task (today) or Project (future)
	- fiscal_year: Link to Fiscal Year
	- month_index: 1-12 (board fiscal order)
	- status: Not Started / Working On It / Stuck / Done
	"""
	_ensure_logged_in()
	reference_doctype = str(reference_doctype or "").strip()
	reference_name = str(reference_name or "").strip()
	fiscal_year = str(fiscal_year or "").strip()
	status = str(status or "").strip()
	try:
		month_index = int(month_index or 0)
	except Exception:
		month_index = 0

	if not reference_doctype or not reference_name:
		frappe.throw("Missing reference")
	if not fiscal_year:
		frappe.throw("Missing fiscal_year")
	if month_index < 1 or month_index > 12:
		frappe.throw("Invalid month_index")
	if status not in {"Not Started", "Working On It", "Stuck", "Done"}:
		frappe.throw("Invalid status")

	# Permission boundary: user must be able to WRITE the referenced doc.
	ref = frappe.get_doc(reference_doctype, reference_name)
	_ensure_write_permission(ref)

	project = ""
	if reference_doctype == "Task":
		project = str(getattr(ref, "project", "") or "").strip()
	elif reference_doctype == "Project":
		project = reference_name

	# Upsert Monthly Status (ignore perms on this helper doctype; bounded by ref permission above)
	filters = {
		"reference_doctype": reference_doctype,
		"reference_name": reference_name,
		"fiscal_year": fiscal_year,
		"month_index": month_index,
	}
	existing = frappe.get_all("Monthly Status", filters=filters, pluck="name", limit_page_length=1, ignore_permissions=True)
	if existing:
		ms = frappe.get_doc("Monthly Status", existing[0])
		ms.status = status
		if project:
			ms.project = project
		ms.save(ignore_permissions=True)
	else:
		ms = frappe.new_doc("Monthly Status")
		ms.reference_doctype = reference_doctype
		ms.reference_name = reference_name
		if project:
			ms.project = project
		ms.fiscal_year = fiscal_year
		ms.month_index = month_index
		ms.status = status
		ms.insert(ignore_permissions=True)

	return {"ok": True, "name": ms.name, "project": project, "reference_name": reference_name, "month_index": month_index, "status": status}


@frappe.whitelist()
def get_monthly_status_bundle(
	projects: Any,
	include_tasks: int = 1,
	include_matrix: int = 1,
	include_summary: int = 1,
	limit_per_project: int = 500,
	task_fields: Any = None,
) -> dict:
	"""
	Bulk load Monthly Status for a list of Projects.

	Returns:
	- start_month: int | None (board-level, mode of projects)
	- tasks: { project_name: [ {name, subject, project}, ... ] }  (optional)
	- matrix: { task_name: { month_index: status } } (optional)
	- summary: { project_name: { month_index: {done,total,percent} } } (optional)
	- fiscal_year: { project_name: fiscal_year } (best-effort)
	"""
	_ensure_logged_in()
	names = _normalize_list(projects)
	names = [str(x).strip() for x in names if str(x).strip()]
	if not names:
		return {"start_month": None, "tasks": {}, "matrix": {}, "summary": {}, "fiscal_year": {}}

	allowed_projects = _project_names_with_read_permission(names)
	if not allowed_projects:
		return {"start_month": None, "tasks": {}, "matrix": {}, "summary": {}, "fiscal_year": {}}

	prows = frappe.get_all(
		"Project",
		filters=[["name", "in", allowed_projects]],
		fields=["name", "customer", "custom_customer_entity", "custom_fiscal_year"],
		limit_page_length=100000,
	)
	by_project_start, counts = _get_project_fy_start_months(prows or [])
	start_month = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))[0][0] if counts else None

	# fiscal year per project (best-effort)
	by_fy = {str(r.get("name")): str(r.get("custom_fiscal_year") or "").strip() for r in (prows or []) if r.get("name")}

	# Task fields (allowlist). Always include name+project+subject.
	allowed_task_fields = {
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
	req_task_fields = _normalize_list(task_fields)
	req_task_fields = [str(x).strip() for x in req_task_fields if str(x).strip()]
	final_task_fields = ["name", "project"]
	for f in req_task_fields:
		if f in allowed_task_fields and f not in final_task_fields:
			final_task_fields.append(f)
	if "subject" not in final_task_fields:
		final_task_fields.append("subject")

	# Load tasks in one query; cut per-project to limit_per_project.
	limit_per_project = int(limit_per_project or 500)
	limit_per_project = max(1, min(limit_per_project, 2000))

	# Total tasks per project (for summary). Prefer an aggregated query so summary isn't affected by per-project limits.
	task_total_by_project: dict[str, int] = {p: 0 for p in allowed_projects}
	try:
		total_rows = frappe.get_all(
			"Task",
			filters=[["project", "in", allowed_projects]],
			fields=["project", "count(name) as total"],
			group_by="project",
			limit_page_length=100000,
		)
		for r in (total_rows or []):
			p = str(r.get("project") or "").strip()
			if not p:
				continue
			try:
				task_total_by_project[p] = int(r.get("total") or 0)
			except Exception:
				task_total_by_project[p] = int(task_total_by_project.get(p, 0))
	except frappe.PermissionError:
		# Fallback: if Task permissions block counts, we will compute totals from the visible task list later.
		task_total_by_project = {p: 0 for p in allowed_projects}

	tasks_by_project: dict[str, list[dict]] = {p: [] for p in allowed_projects}
	all_tasks: list[dict] = []
	if int(include_tasks or 0) or int(include_matrix or 0) or int(include_summary or 0):
		try:
			rows = frappe.get_all(
				"Task",
				filters=[["project", "in", allowed_projects]],
				fields=final_task_fields,
				order_by="modified desc",
				limit_page_length=100000,
			)
		except frappe.PermissionError:
			rows = []

		# Keep per-project limited list (stable order: modified desc)
		per_count: dict[str, int] = {}
		for t in (rows or []):
			p = str(t.get("project") or "").strip()
			if not p or p not in tasks_by_project:
				continue
			n = int(per_count.get(p, 0))
			if n >= limit_per_project:
				continue
			per_count[p] = n + 1
			row = dict(t)
			row["project"] = p
			tasks_by_project[p].append(row)
			all_tasks.append(row)

		# Fallback total counts when we couldn't read aggregated totals.
		if not any(task_total_by_project.values()):
			for p in allowed_projects:
				task_total_by_project[p] = len(tasks_by_project.get(p) or [])

	matrix: dict[str, dict[int, str]] = {}
	done_counts: dict[str, dict[int, int]] = {}  # project -> mi -> done
	if int(include_matrix or 0) or int(include_summary or 0):
		task_names = [str(t.get("name") or "").strip() for t in all_tasks if str(t.get("name") or "").strip()]
		task_names = list(dict.fromkeys(task_names))
		fys = list({fy for fy in by_fy.values() if fy})

		# If caller needs the full matrix (expanded task table), fetch detailed rows for those tasks.
		if int(include_matrix or 0) and task_names and fys:
			ms_rows = frappe.get_all(
				"Monthly Status",
				filters=[
					["reference_doctype", "=", "Task"],
					["reference_name", "in", task_names],
					["fiscal_year", "in", fys],
					["month_index", "between", [1, 12]],
				],
				fields=["reference_name", "fiscal_year", "month_index", "status", "project"],
				ignore_permissions=True,
				limit_page_length=200000,
			)
			for r in (ms_rows or []):
				tn = str(r.get("reference_name") or "").strip()
				p = str(r.get("project") or "").strip()
				fy = str(r.get("fiscal_year") or "").strip()
				try:
					mi = int(r.get("month_index") or 0)
				except Exception:
					mi = 0
				st = str(r.get("status") or "").strip()
				if not tn or mi < 1 or mi > 12 or not st:
					continue
				# Only count rows matching the project's FY (best-effort)
				if p and by_fy.get(p) and fy and fy != by_fy.get(p):
					continue
				matrix.setdefault(tn, {})[mi] = st
				if st == "Done" and p:
					done_counts.setdefault(p, {})[mi] = int(done_counts.get(p, {}).get(mi, 0)) + 1

		# If caller only needs summary, fetch aggregated Done counts without pulling full matrix.
		if int(include_summary or 0) and (not int(include_matrix or 0)) and fys:
			try:
				done_rows = frappe.get_all(
					"Monthly Status",
					filters=[
						["reference_doctype", "=", "Task"],
						["project", "in", allowed_projects],
						["fiscal_year", "in", fys],
						["month_index", "between", [1, 12]],
						["status", "=", "Done"],
					],
					fields=["project", "fiscal_year", "month_index", "count(name) as done"],
					group_by="project, fiscal_year, month_index",
					ignore_permissions=True,
					limit_page_length=200000,
				)
			except Exception:
				done_rows = []
			for r in (done_rows or []):
				p = str(r.get("project") or "").strip()
				fy = str(r.get("fiscal_year") or "").strip()
				try:
					mi = int(r.get("month_index") or 0)
				except Exception:
					mi = 0
				try:
					done = int(r.get("done") or 0)
				except Exception:
					done = 0
				if not p or mi < 1 or mi > 12 or done <= 0:
					continue
				if by_fy.get(p) and fy and fy != by_fy.get(p):
					continue
				done_counts.setdefault(p, {})[mi] = int(done_counts.get(p, {}).get(mi, 0)) + done

	# Summary per project
	summary: dict[str, dict[int, dict]] = {}
	if int(include_summary or 0):
		for p in allowed_projects:
			total = int(task_total_by_project.get(p, 0) or 0)
			months = {}
			for mi in range(1, 13):
				done = int((done_counts.get(p) or {}).get(mi, 0) or 0)
				percent = float(done) / float(total) * 100.0 if total else 0.0
				months[mi] = {"done": done, "total": total, "percent": percent}
			summary[p] = months

	out = {
		"start_month": start_month,
		"start_month_by_project": by_project_start,
		"start_month_counts": counts,
		"fiscal_year": by_fy,
	}
	if int(include_tasks or 0):
		out["tasks"] = tasks_by_project
	if int(include_matrix or 0):
		out["matrix"] = matrix
	if int(include_summary or 0):
		out["summary"] = summary
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


