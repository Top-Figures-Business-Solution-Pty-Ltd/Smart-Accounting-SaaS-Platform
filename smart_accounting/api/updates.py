"""
Updates / Comments APIs (website-safe)

Implementation strategy:
- Use Frappe's native Comment DocType for persistence (no new DocTypes).
- Bound all operations by Project permissions.
"""

from __future__ import annotations

from typing import Any

import frappe

from smart_accounting.api.notification_delivery import (
	create_in_app_notifications,
	get_enabled_notification_recipients,
	send_notification_emails_safe,
)


def _ensure_logged_in() -> None:
	if frappe.session.user in (None, "", "Guest"):
		frappe.throw("Not permitted", frappe.PermissionError)


def _ensure_can_read_project(project: str) -> None:
	doc = frappe.get_doc("Project", project)
	doc.check_permission("read")


def _normalize_int(v: Any, default: int = 0) -> int:
	try:
		return int(v)
	except Exception:
		return int(default)


def _can_manage_update(row: dict, user: str) -> bool:
	if not isinstance(row, dict):
		return False
	u = str(user or "").strip()
	if not u:
		return False
	if u == "Administrator":
		return True
	try:
		if "System Manager" in (frappe.get_roles(u) or []):
			return True
	except Exception:
		pass
	owner = str(row.get("owner") or "").strip()
	return bool(owner and owner == u)


@frappe.whitelist()
def get_project_updates(project: str, limit_start: int = 0, limit_page_length: int = 20) -> dict:
	"""
	List updates (Comments) for a Project.
	Returns:
	- items: [{name, content, creation, owner, comment_by, comment_email}]
	"""
	_ensure_logged_in()
	project = str(project or "").strip()
	if not project:
		frappe.throw("Missing project")

	_ensure_can_read_project(project)

	limit_start = max(0, _normalize_int(limit_start, 0))
	limit_page_length = max(1, min(100, _normalize_int(limit_page_length, 20)))

	rows = frappe.get_all(
		"Comment",
		filters={
			"reference_doctype": "Project",
			"reference_name": project,
			"comment_type": "Comment",
		},
		fields=["name", "content", "creation", "modified", "owner", "comment_by", "comment_email"],
		order_by="creation desc",
		limit_start=limit_start,
		limit_page_length=limit_page_length,
		ignore_permissions=True,  # bounded by Project read permission above
	)
	user = str(frappe.session.user or "").strip()
	items = []
	for r in (rows or []):
		row = dict(r or {})
		row["can_manage"] = _can_manage_update(row, user)
		# "edited" indicator for UI
		row["is_edited"] = str(row.get("modified") or "") != str(row.get("creation") or "")
		items.append(row)
	total_rows = frappe.get_all(
		"Comment",
		filters={
			"reference_doctype": "Project",
			"reference_name": project,
			"comment_type": "Comment",
		},
		fields=["count(name) as cnt"],
		limit_page_length=1,
		ignore_permissions=True,
	)
	try:
		total_count = int((total_rows or [{}])[0].get("cnt") or 0)
	except Exception:
		total_count = len(items)
	return {"items": items, "meta": {"total_count": total_count}}


@frappe.whitelist()
def add_project_update(project: str, content: str, mentions: Any = None) -> dict:
	"""
	Add an update (Comment) to a Project.
	We require Project read permission (write is not strictly required for collaboration),
	but you can tighten this later if needed.
	"""
	_ensure_logged_in()
	project = str(project or "").strip()
	content = str(content or "").strip()
	if not project:
		frappe.throw("Missing project")
	if not content:
		frappe.throw("Missing content")
	if len(content) > 10_000:
		frappe.throw("Update too long")

	_ensure_can_read_project(project)

	user = frappe.session.user
	full_name = frappe.utils.get_fullname(user) if hasattr(frappe, "utils") else user

	c = frappe.new_doc("Comment")
	c.comment_type = "Comment"
	c.reference_doctype = "Project"
	c.reference_name = project
	c.content = content
	c.comment_by = full_name
	c.comment_email = user

	# Insert without requiring explicit Comment permissions; bounded by Project permission above.
	c.insert(ignore_permissions=True)

	# Optional: create in-app notifications for mentioned users.
	mentions_raw = mentions if mentions is not None else frappe.form_dict.get("mentions")
	mentions_list: list[str] = []
	try:
		if isinstance(mentions_raw, str):
			# allow JSON string or comma-separated
			if mentions_raw.strip().startswith("["):
				mentions_list = frappe.parse_json(mentions_raw) or []
			else:
				mentions_list = [u.strip() for u in mentions_raw.split(",") if u.strip()]
		elif isinstance(mentions_raw, (list, tuple)):
			mentions_list = list(mentions_raw)
	except Exception:
		mentions_list = []

	mentions_list = [str(u).strip() for u in (mentions_list or []) if str(u).strip()]
	mentions_list = [u for u in mentions_list if u and u != "Guest"]
	mentions_list = list(dict.fromkeys(mentions_list))  # de-dupe, preserve order

	if mentions_list:
		preview = frappe.utils.strip_html(content or "")
		preview = (preview or "").strip()
		if len(preview) > 240:
			preview = preview[:240] + "…"

		project_title = frappe.db.get_value("Project", project, "project_name") or project
		subject_base = f"{full_name} mentioned you in {project_title}"
		valid_targets = get_enabled_notification_recipients(mentions_list, exclude_user=user)

		# 1) In-app notifications (always, never blocked by email config)
		create_in_app_notifications(
			valid_targets,
			actor=user,
			document_type="Project",
			document_name=project,
			subject=subject_base,
			preview=preview,
			notification_type="Mention",
		)

		# 2) Mention email notifications (only for @mentions)
		# Fail-open: posting updates should still succeed even if mail is misconfigured.
		message_html = (
			f"<p><b>{frappe.utils.escape_html(full_name)}</b> mentioned you in "
			f"<b>{frappe.utils.escape_html(project_title)}</b>.</p>"
			f"<p>{frappe.utils.escape_html(preview or '(no preview)')}</p>"
		)
		send_notification_emails_safe(
			valid_targets,
			subject=subject_base,
			message_html=message_html,
			context_label=f"project_mention:{project}",
		)

	return {
		"item": {
			"name": c.name,
			"content": c.content,
			"creation": c.creation,
			"modified": c.modified,
			"owner": c.owner,
			"comment_by": c.comment_by,
			"comment_email": c.comment_email,
			"can_manage": _can_manage_update({"owner": c.owner}, user),
			"is_edited": False,
		}
	}


@frappe.whitelist()
def update_project_update(update_name: str, content: str) -> dict:
	"""
	Edit an existing project update (Comment).
	Allowed:
	- original author
	- System Manager / Administrator
	"""
	_ensure_logged_in()
	name = str(update_name or "").strip()
	text = str(content or "").strip()
	if not name:
		frappe.throw("Missing update_name")
	if not text:
		frappe.throw("Missing content")
	if len(text) > 10_000:
		frappe.throw("Update too long")

	row = frappe.db.get_value(
		"Comment",
		name,
		["name", "reference_doctype", "reference_name", "comment_type", "owner", "comment_by", "comment_email", "creation", "modified"],
		as_dict=True,
	)
	if not row:
		frappe.throw("Update not found")
	if str(row.get("comment_type") or "").strip() != "Comment":
		frappe.throw("Only project updates can be edited")
	if str(row.get("reference_doctype") or "").strip() != "Project":
		frappe.throw("Only project updates can be edited")

	project = str(row.get("reference_name") or "").strip()
	_ensure_can_read_project(project)
	user = str(frappe.session.user or "").strip()
	if not _can_manage_update(row, user):
		frappe.throw("Not permitted", frappe.PermissionError)

	doc = frappe.get_doc("Comment", name)
	doc.content = text
	doc.save(ignore_permissions=True)
	return {
		"item": {
			"name": doc.name,
			"content": doc.content,
			"creation": doc.creation,
			"modified": doc.modified,
			"owner": doc.owner,
			"comment_by": doc.comment_by,
			"comment_email": doc.comment_email,
			"can_manage": _can_manage_update({"owner": doc.owner}, user),
			"is_edited": str(doc.modified or "") != str(doc.creation or ""),
		}
	}


@frappe.whitelist()
def delete_project_update(update_name: str) -> dict:
	"""
	Delete a project update (Comment).
	Allowed:
	- original author
	- System Manager / Administrator
	"""
	_ensure_logged_in()
	name = str(update_name or "").strip()
	if not name:
		frappe.throw("Missing update_name")
	row = frappe.db.get_value(
		"Comment",
		name,
		["name", "reference_doctype", "reference_name", "comment_type", "owner"],
		as_dict=True,
	)
	if not row:
		frappe.throw("Update not found")
	if str(row.get("comment_type") or "").strip() != "Comment":
		frappe.throw("Only project updates can be deleted")
	if str(row.get("reference_doctype") or "").strip() != "Project":
		frappe.throw("Only project updates can be deleted")
	project = str(row.get("reference_name") or "").strip()
	_ensure_can_read_project(project)
	user = str(frappe.session.user or "").strip()
	if not _can_manage_update(row, user):
		frappe.throw("Not permitted", frappe.PermissionError)
	frappe.delete_doc("Comment", name, ignore_permissions=True)
	return {"ok": True, "name": name}


@frappe.whitelist()
def get_project_update_counts(projects: Any = None) -> dict:
	"""
	Return update counts per project (Comment count).
	Respects Project read permissions by filtering to permitted projects.
	"""
	_ensure_logged_in()
	names: list[str] = []
	try:
		if isinstance(projects, str):
			names = frappe.parse_json(projects) or []
		elif isinstance(projects, (list, tuple)):
			names = list(projects)
	except Exception:
		names = []
	names = [str(n).strip() for n in (names or []) if str(n).strip()]
	if not names:
		return {"counts": {}}

	# Permission-respecting list of projects
	permitted = frappe.get_all(
		"Project",
		fields=["name"],
		filters={"name": ["in", names]},
		limit_page_length=len(names) + 5,
	)
	perm_names = [p.get("name") for p in (permitted or []) if p.get("name")]
	if not perm_names:
		return {"counts": {}}

	rows = frappe.get_all(
		"Comment",
		fields=["reference_name", "count(name) as cnt"],
		filters={
			"reference_doctype": "Project",
			"reference_name": ["in", perm_names],
			"comment_type": "Comment",
		},
		group_by="reference_name",
		limit_page_length=100000,
		ignore_permissions=True,  # bounded by Project permission above
	)

	counts = {str(r.get("reference_name")): int(r.get("cnt") or 0) for r in (rows or []) if r.get("reference_name")}
	return {"counts": counts}


