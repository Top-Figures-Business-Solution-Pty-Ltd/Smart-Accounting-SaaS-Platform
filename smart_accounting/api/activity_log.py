"""
Activity Log APIs (website-safe)
- Projects + Clients create/update/delete
- Supports masked output unless correct password provided
"""

from __future__ import annotations

from typing import Any

import frappe


def _ensure_logged_in() -> None:
	if frappe.session.user in (None, "", "Guest"):
		frappe.throw("Not permitted", frappe.PermissionError)


def _normalize_int(v: Any, default: int) -> int:
	try:
		return int(v)
	except Exception:
		return int(default)


def _clean_str(v: Any) -> str:
	return str(v or "").strip()


def _target_doctypes(target: str | None = None) -> list[str]:
	t = _clean_str(target).lower()
	if t == "project":
		return ["Project"]
	if t == "client":
		return ["Customer"]
	return ["Project", "Customer"]


def _activity_filter(activity: str | None = None) -> set[str]:
	a = _clean_str(activity).lower()
	if a in ("create", "update", "delete"):
		return {a}
	return {"create", "update", "delete"}


def _get_user_fullname(user: str, cache: dict[str, str]) -> str:
	u = _clean_str(user)
	if not u:
		return ""
	if u in cache:
		return cache[u]
	try:
		name = frappe.get_cached_value("User", u, "full_name") or u
		cache[u] = name
		return name
	except Exception:
		cache[u] = u
		return u


def _is_password_valid(password: str | None) -> bool:
	pwd = _clean_str(password)
	if not pwd:
		return False
	cfg = frappe.get_site_config() or {}
	secret = _clean_str(cfg.get("smart_activity_log_password"))
	if not secret:
		return False
	return pwd == secret


@frappe.whitelist()
def get_activity_users() -> dict:
	_ensure_logged_in()
	rows = frappe.get_all(
		"User",
		filters={"enabled": 1},
		fields=["name", "full_name"],
		limit_page_length=2000,
		order_by="full_name asc",
	)
	items = [
		{"user": r.get("name"), "label": r.get("full_name") or r.get("name")}
		for r in (rows or [])
		if r.get("name")
	]
	return {"items": items}


@frappe.whitelist()
def get_activity_log(
	limit_start: int = 0,
	limit_page_length: int = 50,
	user: str | None = None,
	target: str | None = None,
	activity: str | None = None,
	password: str | None = None,
) -> dict:
	_ensure_logged_in()

	limit_start = max(0, _normalize_int(limit_start, 0))
	limit_page_length = max(1, min(200, _normalize_int(limit_page_length, 50)))
	fetch_limit = max(200, limit_start + limit_page_length)

	target_doctypes = _target_doctypes(target)
	activity_set = _activity_filter(activity)
	user_filter = _clean_str(user)
	unlocked = _is_password_valid(password)

	events: list[dict] = []

	# Create events (doc creation)
	if "create" in activity_set:
		for dt in target_doctypes:
			filters = {}
			if user_filter:
				filters["owner"] = user_filter
			rows = frappe.get_all(
				dt,
				filters=filters,
				fields=["name", "owner", "creation"],
				order_by="creation desc",
				limit_page_length=fetch_limit,
			)
			for r in rows or []:
				events.append(
					{
						"action": "Create",
						"doctype": dt,
						"docname": r.get("name"),
						"user": r.get("owner"),
						"timestamp": r.get("creation"),
					}
				)

	# Update events (Version)
	if "update" in activity_set:
		v_filters: dict[str, Any] = {"ref_doctype": ["in", target_doctypes]}
		if user_filter:
			v_filters["owner"] = user_filter
		rows = frappe.get_all(
			"Version",
			filters=v_filters,
			fields=["ref_doctype", "docname", "owner", "creation"],
			order_by="creation desc",
			limit_page_length=fetch_limit,
		)
		for r in rows or []:
			events.append(
				{
					"action": "Update",
					"doctype": r.get("ref_doctype"),
					"docname": r.get("docname"),
					"user": r.get("owner"),
					"timestamp": r.get("creation"),
				}
			)

	# Delete events (Deleted Document)
	if "delete" in activity_set:
		d_filters: dict[str, Any] = {"deleted_doctype": ["in", target_doctypes]}
		if user_filter:
			d_filters["owner"] = user_filter
		rows = frappe.get_all(
			"Deleted Document",
			filters=d_filters,
			fields=["deleted_doctype", "deleted_name", "owner", "creation"],
			order_by="creation desc",
			limit_page_length=fetch_limit,
		)
		for r in rows or []:
			events.append(
				{
					"action": "Delete",
					"doctype": r.get("deleted_doctype"),
					"docname": r.get("deleted_name"),
					"user": r.get("owner"),
					"timestamp": r.get("creation"),
				}
			)

	# Sort & paginate
	events.sort(key=lambda x: str(x.get("timestamp") or ""), reverse=True)
	page = events[limit_start : limit_start + limit_page_length]

	user_cache: dict[str, str] = {}
	out_items = []
	for ev in page:
		doctype = _clean_str(ev.get("doctype"))
		is_project = doctype == "Project"
		target_label = "Project" if is_project else "Client"
		user_name = _clean_str(ev.get("user"))
		docname = _clean_str(ev.get("docname"))
		if unlocked:
			user_label = _get_user_fullname(user_name, user_cache) or user_name or "Unknown"
			doc_label = docname or "—"
		else:
			user_label = "Someone"
			doc_label = "a project" if is_project else "a client"

		out_items.append(
			{
				"action": ev.get("action"),
				"target": "project" if is_project else "client",
				"target_label": target_label,
				"user": user_name,
				"user_label": user_label,
				"docname": docname,
				"doc_label": doc_label,
				"timestamp": ev.get("timestamp"),
			}
		)

	return {
		"items": out_items,
		"meta": {
			"limit_start": limit_start,
			"limit_page_length": limit_page_length,
			"unlocked": unlocked,
		},
	}


