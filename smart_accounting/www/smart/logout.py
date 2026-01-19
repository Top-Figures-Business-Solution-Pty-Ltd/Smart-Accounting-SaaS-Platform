from __future__ import annotations

from ._brand import get_brand_context


def get_context(context):
	"""
	Product logout page.

	We intentionally keep this as a Website page so users never see Desk routes.
	The template calls Frappe's logout endpoint and then redirects to /smart/login.
	"""
	context.no_cache = 1
	context.login_required = False
	for k, v in (get_brand_context() or {}).items():
		setattr(context, k, v)
	return context


