from __future__ import annotations

import frappe


def _get_brand_context() -> dict:
	cfg = frappe.get_site_config() or {}
	brand_name = str(cfg.get("smart_brand_name") or "Smart Accounting").strip()
	brand_tagline = str(cfg.get("smart_brand_tagline") or "").strip()
	return {
		"brand_name": brand_name,
		"brand_tagline": brand_tagline,
	}


def get_context(context):
	"""
	Smart Accounting entrypoint.
	"""
	context.login_required = True
	context.no_cache = 1
	for k, v in (_get_brand_context() or {}).items():
		setattr(context, k, v)
	return context
