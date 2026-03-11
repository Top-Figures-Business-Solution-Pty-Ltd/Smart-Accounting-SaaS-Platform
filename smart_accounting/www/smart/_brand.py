from __future__ import annotations

import frappe


def get_brand_context() -> dict:
	"""
	Branding/context helpers for the /smart product shell.

	We keep branding centralized so future "Smart <Industry>" variants only need config changes.

	Site config (optional):
	- smart_brand_name: str (default: "Smart Task & Compliance Management")
	- smart_brand_tagline: str (default: "")
	- smart_saas_public_enabled: 0/1 (default: 0) - whether to show Signup/Forgot Password links
	"""
	cfg = frappe.get_site_config() or {}
	brand_name = str(cfg.get("smart_brand_name") or "Smart Task & Compliance Management").strip()
	brand_tagline = str(cfg.get("smart_brand_tagline") or "").strip()
	public_enabled = bool(int(cfg.get("smart_saas_public_enabled") or 0))
	return {
		"brand_name": brand_name,
		"brand_tagline": brand_tagline,
		"saas_public_enabled": public_enabled,
	}


