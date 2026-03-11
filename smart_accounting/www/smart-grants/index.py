from __future__ import annotations

import frappe


def get_context(context):
	"""
	Smart Grants placeholder entrypoint.
	"""
	context.login_required = True
	context.no_cache = 1
	context.brand_name = "Smart Grants"
	context.brand_tagline = "Placeholder module"
	return context
