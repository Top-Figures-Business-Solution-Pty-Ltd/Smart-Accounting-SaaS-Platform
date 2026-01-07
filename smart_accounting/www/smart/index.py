from __future__ import annotations

import frappe


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
	return context


