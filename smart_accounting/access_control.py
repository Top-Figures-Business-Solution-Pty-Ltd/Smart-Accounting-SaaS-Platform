"""
Smart Accounting - Access Control

Goal:
- External users should use the product shell (/smart) and be prevented from entering Desk (/app).
- Internal admins (e.g. System Manager) can still access Desk normally.
"""

from __future__ import annotations

import frappe


# Extend this allowlist as needed (e.g. Support Team, Implementation)
DESK_ALLOW_ROLES = {
	"System Manager",
}


def _is_desk_path(path: str) -> bool:
	# Desk routes are under /app (e.g. /app, /app/project-management)
	return path == "/app" or path.startswith("/app/")


def _is_allowed_to_use_desk() -> bool:
	user = frappe.session.user
	if not user or user == "Guest":
		return False

	# Administrator should never be blocked.
	if user == "Administrator":
		return True

	try:
		user_roles = set(frappe.get_roles(user))
	except Exception:
		user_roles = set()

	if user_roles.intersection(DESK_ALLOW_ROLES):
		return True

	return False


def before_request():
	"""
	Hard-gate /app for non-admin users.

	- If the request is for /app*, and user is not in allow roles, redirect to /smart.
	- This creates a "product-only" experience while still using System Users.
	"""
	try:
		path = frappe.local.request.path  # type: ignore[attr-defined]
	except Exception:
		return

	if not path:
		return

	# Ensure /smart always requires login (avoid showing a half-broken shell to Guest)
	if path == "/smart" and frappe.session.user == "Guest":
		frappe.local.response["type"] = "redirect"
		frappe.local.response["location"] = "/login?redirect-to=/smart"
		return

	if not _is_desk_path(path):
		return

	# Allow internal admins to use Desk
	if _is_allowed_to_use_desk():
		return

	# Redirect external users to product shell
	frappe.local.response["type"] = "redirect"
	frappe.local.response["location"] = "/smart"


