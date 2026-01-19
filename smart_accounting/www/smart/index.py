from __future__ import annotations

import frappe

from ._brand import get_brand_context


def get_context(context):
	"""
	Product shell entrypoint.

	- Require login for this page (Guest will be redirected to /login automatically by Frappe)
	- Render the website template which mounts Smart Board.
	"""
	# Let Frappe handle Guest redirect to /login
	context.login_required = True

	# Keep website page clean (no sidebar/breadcrumbs)
	context.no_cache = 1

	# Brand context (centralized for future SaaS / multi-industry)
	for k, v in (get_brand_context() or {}).items():
		setattr(context, k, v)
	return context


