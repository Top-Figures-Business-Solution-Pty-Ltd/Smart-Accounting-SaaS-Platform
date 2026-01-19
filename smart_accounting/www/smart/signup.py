from __future__ import annotations

from ._brand import get_brand_context


def get_context(context):
	"""
	Product signup page placeholder (SaaS-ready).

	We keep this page behind a feature flag so it doesn't confuse current deployments.
	Turn on in site config:
	- smart_saas_public_enabled = 1
	"""
	context.no_cache = 1
	context.login_required = False

	for k, v in (get_brand_context() or {}).items():
		setattr(context, k, v)

	return context


