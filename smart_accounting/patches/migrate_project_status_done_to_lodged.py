from __future__ import annotations

import frappe


def execute():
	"""
	Migrate Project.status:
	- "Done" -> "Lodged"

	Rationale:
	Smart Accounting uses "Lodged" as the terminal Project status.
	We removed "Done" from the Project.status options (Property Setter), so existing rows must be migrated.

	Idempotent: safe to run multiple times.
	"""

	# 1) Data migration (Projects)
	try:
		frappe.db.sql(
			"""
			update `tabProject`
			set status=%s
			where status=%s
			""",
			("Lodged", "Done"),
		)
	except Exception:
		# Best-effort; don't block migration
		pass

	# 2) Clean board status subset config (remove "Done" from allowed lists)
	# This avoids "configured" boards keeping an obsolete status in their saved subset.
	try:
		from smart_accounting.api.board_settings import _get_project_status_pool, _get_status_config_map, _set_status_config_map
	except Exception:
		return

	try:
		cfg = _get_status_config_map() or {}
		if not cfg:
			return
		pool = _get_project_status_pool() or []
		pool_set = set(pool)
		changed = False

		for pt in list(cfg.keys()):
			raw = cfg.get(pt) or []
			if not isinstance(raw, list):
				continue
			clean = []
			seen = set()
			for x in raw:
				s = str(x or "").strip()
				if not s or s == "Done" or s in seen:
					continue
				# If pool is known, keep only statuses that exist (prevents typos from lingering).
				if pool_set and s not in pool_set:
					continue
				clean.append(s)
				seen.add(s)

			# If empty OR equals full pool => clear custom config
			if not clean or (pool_set and set(clean) == pool_set):
				cfg.pop(pt, None)
				changed = True
			elif clean != raw:
				cfg[pt] = clean
				changed = True

		if changed:
			_set_status_config_map(cfg)
	except Exception:
		# Best-effort
		return


