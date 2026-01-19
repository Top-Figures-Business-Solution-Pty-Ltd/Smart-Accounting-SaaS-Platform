from __future__ import annotations

from ._brand import get_brand_context


def get_context(context):
	"""
	Product forgot-password page (website-safe).

	We keep this page even if you don't use it today, because SaaS will need it.
	Implementation calls Frappe's builtin reset password API.

	Note:
	- We intentionally do NOT reveal whether an email exists.
	"""
	context.no_cache = 1
	context.login_required = False
	for k, v in (get_brand_context() or {}).items():
		setattr(context, k, v)
	return context


