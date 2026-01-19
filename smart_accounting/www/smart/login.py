from __future__ import annotations

import frappe

from ._brand import get_brand_context


def get_context(context):
	"""
	Product-branded login page.

	- Must be accessible to Guest users (login_required=False)
	- If user is already logged in, redirect to /smart
	"""
	context.no_cache = 1
	context.login_required = False

	if frappe.session.user and frappe.session.user != "Guest":
		# Already logged in: go to product shell
		context.redirect_to = "/smart"

	for k, v in (get_brand_context() or {}).items():
		setattr(context, k, v)

	return context


