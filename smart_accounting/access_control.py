"""
Smart Accounting - Access Control

Goal:
- External users should use the product shell (/smart) and be prevented from entering Desk (/app).
- Internal admins (Administrator + System Manager) can still access Desk normally.
"""

from __future__ import annotations

import frappe


def _redirect(location: str, status_code: int = 302) -> None:
	"""
	Force a redirect early in request lifecycle.

	Important:
	- This hook runs inside `frappe.app.init_request()` (before response rendering).
	- Raising `frappe.Redirect` here will be treated as an unhandled exception and may render a traceback page in dev.
	- Instead, raise a Werkzeug HTTP redirect (caught by `frappe.app.application` as HTTPException).
	"""
	code = int(status_code or 302)
	location = str(location or "/").strip() or "/"
	# Use a Response-based abort to stay compatible across Werkzeug versions.
	from werkzeug.wrappers import Response
	from werkzeug.exceptions import abort

	resp = Response("", status=code)
	resp.headers["Location"] = location
	abort(resp)


def _get_desk_allow_roles() -> set[str]:
	"""
	Desk access allowlist (roles).

	Default: empty.
	Note: System Manager is allowed by code by default and does not need to be listed here.

	Optional site_config.json:
	  "smart_desk_allow_roles": ["System Manager", "Support Team"]
	"""
	try:
		cfg = frappe.get_site_config() or {}
	except Exception:
		cfg = {}

	roles = cfg.get("smart_desk_allow_roles") or []
	if isinstance(roles, str):
		roles = [roles]

	out: set[str] = set()
	for r in roles:
		s = str(r or "").strip()
		if s:
			out.add(s)
	return out


def _get_desk_allow_users() -> set[str]:
	"""
	Desk access allowlist (users).

	Optional site_config.json:
	  "smart_desk_allow_users": ["alice@company.com"]
	"""
	try:
		cfg = frappe.get_site_config() or {}
	except Exception:
		cfg = {}

	users = cfg.get("smart_desk_allow_users") or []
	if isinstance(users, str):
		users = [users]

	out: set[str] = set()
	for u in users:
		s = str(u or "").strip()
		if s:
			out.add(s)
	return out

def _get_desk_access_mode() -> str:
	"""
	Desk access mode:
	- "admin_only": ONLY Administrator can access /app*
	- "config" (default): Administrator + System Manager + configured roles/users can access /app*
	"""
	try:
		cfg = frappe.get_site_config() or {}
	except Exception:
		cfg = {}
	mode = str(cfg.get("smart_desk_access_mode") or "config").strip().lower()
	if mode not in {"admin_only", "config"}:
		mode = "config"
	return mode

SMART_PUBLIC_PATHS = {
	"/smart/login",
	"/smart/login/",
	"/smart/logout",
	"/smart/logout/",
	"/smart/forgot-password",
	"/smart/forgot-password/",
	"/smart/signup",
	"/smart/signup/",
}


def _is_desk_path(path: str) -> bool:
	# Desk routes are under /app (e.g. /app, /app/project-management)
	return path == "/app" or path.startswith("/app/")

def _is_smart_path(path: str) -> bool:
	# Product shell routes are under /smart
	return path == "/smart" or path.startswith("/smart/")


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

	# System Manager should be able to access Desk by default.
	if "System Manager" in user_roles:
		return True

	# admin_only: keep everyone else out of Desk.
	if _get_desk_access_mode() != "config":
		return False

	# Explicit per-user allowlist (site config)
	try:
		if str(user) in _get_desk_allow_users():
			return True
	except Exception:
		pass

	allow_roles = _get_desk_allow_roles()
	if allow_roles and user_roles.intersection(allow_roles):
		return True

	return False


def before_request():
	"""
	Hard-gate /app for non-admin users.

	- If the request is for /app*, and user is not allowed to use Desk, redirect to /smart.
	- This creates a "product-only" experience while still using System Users.
	"""
	try:
		path = frappe.local.request.path  # type: ignore[attr-defined]
	except Exception:
		return

	if not path:
		return

	# Hard-gate Desk routes first (prevents non-admin users from ever seeing /app* HTML).
	if _is_desk_path(path) and not _is_allowed_to_use_desk():
		_redirect("/smart", 302)

	# Always prefer product login (avoid exposing Desk/ERPNext login UI to end users)
	if path == "/login":
		_redirect("/smart/login", 302)
	# Avoid exposing ERPNext website pages (keep URLs stable but land in /smart).
	if path == "/update-password":
		_redirect("/smart/forgot-password", 302)
	if path == "/signup":
		_redirect("/smart/signup", 302)

	# Ensure /smart always requires login (avoid showing a half-broken shell to Guest)
	# We route Guests to a product-branded login page under /smart/login, not Desk's /login.
	if _is_smart_path(path) and frappe.session.user == "Guest" and path not in SMART_PUBLIC_PATHS:
		_redirect(f"/smart/login?redirect-to={path}", 302)

	# Non-desk routes continue as normal.
	if not _is_desk_path(path):
		return


