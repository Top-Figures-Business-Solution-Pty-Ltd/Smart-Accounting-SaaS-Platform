"""
Updates / Comments APIs (website-safe)

Implementation strategy:
- Use Frappe's native Comment DocType for persistence (no new DocTypes).
- Bound all operations by Project permissions.
"""

from __future__ import annotations

from typing import Any

import frappe


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
		fields=["name", "content", "creation", "owner", "comment_by", "comment_email"],
		order_by="creation desc",
		limit_start=limit_start,
		limit_page_length=limit_page_length,
		ignore_permissions=True,  # bounded by Project read permission above
	)

	return {"items": rows or []}


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
		# We only want in-app notifications right now.
		# Prevent any email side-effects (and the "setup default outgoing Email Account" prompt).
		prev_mute = bool(getattr(frappe.flags, "mute_emails", False))
		frappe.flags.mute_emails = True
		try:
			from frappe.utils import strip_html

			preview = strip_html(content or "")
			preview = (preview or "").strip()
			if len(preview) > 240:
				preview = preview[:240] + "…"

			project_title = frappe.db.get_value("Project", project, "project_name") or project
			subject_base = f"{full_name} mentioned you in {project_title}"
			for target in mentions_list:
				if target == user:
					continue
				# Validate enabled user
				enabled = frappe.db.get_value("User", target, "enabled")
				if not enabled:
					continue

				n = frappe.new_doc("Notification Log")
				n.type = "Mention"
				n.for_user = target
				n.from_user = user
				n.document_type = "Project"
				n.document_name = project
				n.subject = subject_base
				n.email_content = preview
				# Link is optional; in /smart we'll navigate by document_type/name
				n.insert(ignore_permissions=True)
		except Exception:
			# Never block posting updates because of notification side effects.
			pass
		finally:
			# Restore flag no matter what.
			frappe.flags.mute_emails = prev_mute

	return {
		"item": {
			"name": c.name,
			"content": c.content,
			"creation": c.creation,
			"owner": c.owner,
			"comment_by": c.comment_by,
			"comment_email": c.comment_email,
		}
	}


