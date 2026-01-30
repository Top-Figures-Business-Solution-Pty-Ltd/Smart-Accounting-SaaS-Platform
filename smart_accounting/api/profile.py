"""
Profile APIs (website-safe)
"""
from __future__ import annotations

import frappe


def _ensure_logged_in() -> None:
	if frappe.session.user in (None, "", "Guest"):
		frappe.throw("Not permitted", frappe.PermissionError)


@frappe.whitelist()
def get_my_profile() -> dict:
	_ensure_logged_in()
	user = frappe.session.user
	doc = frappe.get_doc("User", user)
	return {
		"name": doc.name,
		"full_name": doc.full_name,
		"email": doc.email,
		"user_image": doc.user_image,
	}


@frappe.whitelist()
def set_my_profile_image(file_url: str | None = None) -> dict:
	_ensure_logged_in()
	user = frappe.session.user
	val = (file_url or "").strip()
	frappe.db.set_value("User", user, "user_image", val, update_modified=False)
	return get_my_profile()

