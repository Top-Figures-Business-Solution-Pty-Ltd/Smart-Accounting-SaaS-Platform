"""
Board Settings APIs (website-safe)
- Currently: manage Project Type order shown in Smart Board sidebar.

Design:
- Do NOT require DocType/field changes.
- Store ordering in global defaults as JSON array.
"""

from __future__ import annotations

from typing import Any

import frappe


DEFAULT_KEY_PROJECT_TYPE_ORDER = "smart_accounting_project_type_order"
DEFAULT_KEY_PROJECT_TYPE_STATUS_CONFIG = "smart_accounting_project_type_status_config"


def _ensure_logged_in() -> None:
	if frappe.session.user in (None, "", "Guest"):
		frappe.throw("Not permitted", frappe.PermissionError)


def _ensure_can_manage_board_settings() -> None:
	# Board settings affect everyone; keep it admin/system-manager for now.
	user = frappe.session.user
	try:
		if user == "Administrator":
			return
	except Exception:
		pass
	if not frappe.has_permission("Role", "read"):
		# Cheap guard: role read is usually granted to admins only.
		pass
	# Role checks
	if not frappe.has_role("System Manager"):
		frappe.throw("Not permitted", frappe.PermissionError)


def _get_all_project_types() -> list[str]:
	rows = frappe.get_all("Project Type", fields=["name"], order_by="name asc", limit_page_length=5000)
	return [r.get("name") for r in rows if r.get("name")]


def _parse_options(raw: Any) -> list[str]:
	try:
		text = str(raw or "")
	except Exception:
		text = ""
	opts = [x.strip() for x in text.split("\n") if str(x).strip()]
	seen = set()
	out: list[str] = []
	for x in opts:
		if x in seen:
			continue
		out.append(x)
		seen.add(x)
	return out


def _get_project_status_pool() -> list[str]:
	"""Source of truth: Project.status options from DocType meta (includes Property Setter)."""
	try:
		meta = frappe.get_meta("Project")
		f = meta.get_field("status") if meta else None
		return _parse_options(getattr(f, "options", None))
	except Exception:
		return []


def _get_status_config_map() -> dict[str, list[str]]:
	try:
		raw = frappe.defaults.get_global_default(DEFAULT_KEY_PROJECT_TYPE_STATUS_CONFIG)
	except Exception:
		raw = None
	if not raw:
		return {}
	try:
		val = frappe.parse_json(raw)
		if isinstance(val, dict):
			out: dict[str, list[str]] = {}
			for k, v in val.items():
				pt = str(k or "").strip()
				if not pt:
					continue
				if isinstance(v, list):
					out[pt] = [str(x).strip() for x in v if str(x).strip()]
			return out
	except Exception:
		return {}
	return {}


def _set_status_config_map(cfg: dict[str, list[str]]) -> None:
	try:
		frappe.defaults.set_global_default(DEFAULT_KEY_PROJECT_TYPE_STATUS_CONFIG, frappe.as_json(cfg))
	except Exception:
		frappe.defaults.set_global_default(DEFAULT_KEY_PROJECT_TYPE_STATUS_CONFIG, str(cfg))


def _get_saved_order() -> list[str]:
	try:
		raw = frappe.defaults.get_global_default(DEFAULT_KEY_PROJECT_TYPE_ORDER)
	except Exception:
		raw = None
	if not raw:
		return []
	try:
		val = frappe.parse_json(raw)
		if isinstance(val, list):
			return [str(x).strip() for x in val if str(x).strip()]
	except Exception:
		return []
	return []


def _set_saved_order(order: list[str]) -> None:
	# Store as JSON string in global defaults
	try:
		frappe.defaults.set_global_default(DEFAULT_KEY_PROJECT_TYPE_ORDER, frappe.as_json(order))
	except Exception:
		# Fallback: set as plain JSON string
		frappe.defaults.set_global_default(DEFAULT_KEY_PROJECT_TYPE_ORDER, str(order))


def _merge_order(saved: list[str], all_types: list[str]) -> list[str]:
	seen = set()
	out: list[str] = []
	for n in saved or []:
		if n in seen:
			continue
		if n in all_types:
			out.append(n)
			seen.add(n)
	for n in all_types:
		if n in seen:
			continue
		out.append(n)
		seen.add(n)
	return out


@frappe.whitelist()
def get_project_types() -> dict:
	"""Return ordered Project Types for the Smart Board sidebar."""
	_ensure_logged_in()
	all_types = _get_all_project_types()
	saved = _get_saved_order()
	ordered = _merge_order(saved, all_types)
	return {"items": [{"name": n} for n in ordered]}


@frappe.whitelist()
def get_project_type_order() -> dict:
	"""Return current saved order (for the Board Settings UI)."""
	_ensure_logged_in()
	all_types = _get_all_project_types()
	saved = _get_saved_order()
	ordered = _merge_order(saved, all_types)
	return {
		"order": ordered,
		"all": all_types,
		"meta": {"key": DEFAULT_KEY_PROJECT_TYPE_ORDER},
	}


@frappe.whitelist()
def set_project_type_order(order: Any = None) -> dict:
	"""
	Set Project Type ordering.
	order: list[str] or JSON string list
	"""
	_ensure_logged_in()
	_ensure_can_manage_board_settings()

	val = order
	if isinstance(val, str):
		try:
			val = frappe.parse_json(val)
		except Exception:
			val = None
	if not isinstance(val, list):
		frappe.throw("order must be a list")

	all_types = _get_all_project_types()
	all_set = set(all_types)
	clean = []
	seen = set()
	for x in val:
		n = str(x).strip()
		if not n or n in seen:
			continue
		if n not in all_set:
			continue
		clean.append(n)
		seen.add(n)

	# Persist only explicit ordering; unlisted types will be appended automatically.
	_set_saved_order(clean)
	return {"ok": True, "saved_count": len(clean)}


@frappe.whitelist()
def get_project_type_status_config(project_type: str | None = None) -> dict:
	"""
	Get status pool + board-specific allowed statuses for a Project Type.
	- pool: all statuses from Project.status options
	- allowed: saved subset for this project_type (empty => not configured)
	"""
	_ensure_logged_in()
	pt = str(project_type or "").strip()
	pool = _get_project_status_pool()
	cfg = _get_status_config_map()
	allowed = cfg.get(pt) if pt else None
	allowed_list = [str(x).strip() for x in (allowed or []) if str(x).strip()]
	return {
		"project_type": pt,
		"pool": pool,
		"allowed": allowed_list,
		"configured": bool(allowed_list),
		"meta": {"key": DEFAULT_KEY_PROJECT_TYPE_STATUS_CONFIG},
	}


@frappe.whitelist()
def set_project_type_status_config(project_type: str | None = None, statuses: Any = None) -> dict:
	"""
	Set board status subset for a Project Type.
	statuses: list[str] or JSON string list
	Behavior:
	- If statuses is empty OR equals pool => clear config (board uses full pool)
	"""
	_ensure_logged_in()
	_ensure_can_manage_board_settings()

	pt = str(project_type or "").strip()
	if not pt:
		frappe.throw("project_type is required")

	val = statuses
	if isinstance(val, str):
		try:
			val = frappe.parse_json(val)
		except Exception:
			val = None
	if not isinstance(val, list):
		frappe.throw("statuses must be a list")

	pool = _get_project_status_pool()
	pool_set = set(pool)
	clean: list[str] = []
	seen = set()
	for x in val:
		s = str(x or "").strip()
		if not s or s in seen:
			continue
		# keep only known statuses from pool (avoid typos)
		if pool_set and s not in pool_set:
			continue
		clean.append(s)
		seen.add(s)

	# Must keep at least 1 if user is explicitly configuring
	if not clean:
		# Clearing config => board falls back to full pool
		cfg = _get_status_config_map()
		if pt in cfg:
			cfg.pop(pt, None)
			_set_status_config_map(cfg)
		return {"ok": True, "cleared": True, "saved_count": 0}

	# If identical to pool, treat as "no custom config"
	if pool and clean == pool:
		cfg = _get_status_config_map()
		if pt in cfg:
			cfg.pop(pt, None)
			_set_status_config_map(cfg)
		return {"ok": True, "cleared": True, "saved_count": 0}

	cfg = _get_status_config_map()
	cfg[pt] = clean
	_set_status_config_map(cfg)
	return {"ok": True, "cleared": False, "saved_count": len(clean)}


