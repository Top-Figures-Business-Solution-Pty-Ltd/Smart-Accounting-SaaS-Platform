"""
Notification delivery helpers.

Design goals:
- In-app notifications (Notification Log) are the primary channel.
- Email delivery is optional and best-effort.
- Mail failures must never break the user-facing workflow.
- Supports pluggable delivery backends for notification emails.
"""

from __future__ import annotations

from typing import Iterable
from urllib.parse import quote

import frappe
import requests
from frappe.email.doctype.email_account.email_account import EmailAccount


def _normalize_users(users: Iterable[str] | None = None) -> list[str]:
	out: list[str] = []
	seen: set[str] = set()
	for user in users or []:
		value = str(user or "").strip()
		if not value or value == "Guest" or value in seen:
			continue
		seen.add(value)
		out.append(value)
	return out


def _notification_email_enabled() -> bool:
	"""
	Notification emails are enabled by default.

	Optional site_config override:
	- "smart_notification_email_enabled": false
	"""
	try:
		cfg = frappe.get_site_config() or {}
	except Exception:
		cfg = {}
	value = cfg.get("smart_notification_email_enabled", True)
	if isinstance(value, str):
		return value.strip().lower() not in {"0", "false", "no", "off"}
	return bool(value)


def _notification_email_provider() -> str:
	"""
	Optional site_config override:
	- "smart_notification_email_provider": "smtp" | "graph"

	Default remains "smtp" for backward compatibility.
	"""
	try:
		cfg = frappe.get_site_config() or {}
	except Exception:
		cfg = {}
	value = str(cfg.get("smart_notification_email_provider") or "smtp").strip().lower()
	if value in {"graph", "microsoft_graph", "msgraph"}:
		return "graph"
	return "smtp"


def _get_default_outgoing_email_account():
	try:
		return EmailAccount.find_default_outgoing()
	except Exception:
		return None


def _get_graph_endpoint_base() -> str:
	try:
		cfg = frappe.get_site_config() or {}
	except Exception:
		cfg = {}
	base = str(cfg.get("smart_notification_graph_base_url") or "https://graph.microsoft.com/v1.0").strip()
	return base.rstrip("/")


def _get_connected_app_access_token(email_account) -> str:
	if not email_account or str(getattr(email_account, "auth_method", "") or "").strip() != "OAuth":
		return ""
	connected_app_name = str(getattr(email_account, "connected_app", "") or "").strip()
	if not connected_app_name:
		return ""
	try:
		connected_app = frappe.get_doc("Connected App", connected_app_name)
		if int(getattr(email_account, "backend_app_flow", 0) or 0):
			token_cache = connected_app.get_backend_app_token()
		else:
			connected_user = str(getattr(email_account, "connected_user", "") or frappe.session.user or "").strip()
			token_cache = connected_app.get_active_token(connected_user)
		if not token_cache:
			return ""
		return str(token_cache.get_password("access_token", False) or "").strip()
	except Exception:
		return ""


def get_enabled_notification_recipients(
	users: Iterable[str] | None = None,
	*,
	exclude_user: str | None = None,
) -> list[str]:
	recipients = _normalize_users(users)
	excluded = str(exclude_user or "").strip()
	out: list[str] = []
	for user in recipients:
		if excluded and user == excluded:
			continue
		try:
			enabled = frappe.db.get_value("User", user, "enabled")
		except Exception:
			enabled = 0
		if enabled:
			out.append(user)
	return out


def create_in_app_notifications(
	recipients: Iterable[str] | None = None,
	*,
	actor: str,
	document_type: str,
	document_name: str,
	subject: str,
	preview: str = "",
	notification_type: str = "Mention",
) -> list[str]:
	"""
	Create Notification Log rows without triggering implicit emails.
	Returns the users for whom insertion succeeded.
	"""
	users = _normalize_users(recipients)
	if not users:
		return []

	prev_mute = bool(getattr(frappe.flags, "mute_emails", False))
	created: list[str] = []
	frappe.flags.mute_emails = True
	try:
		for target in users:
			try:
				n = frappe.new_doc("Notification Log")
				n.type = str(notification_type or "Mention").strip() or "Mention"
				n.for_user = target
				n.from_user = actor
				n.document_type = document_type
				n.document_name = document_name
				n.subject = subject
				n.email_content = preview
				n.insert(ignore_permissions=True)
				created.append(target)
			except Exception as e:
				frappe.log_error(
					title="In-app notification delivery failed",
					message=(
						f"target={target}\n"
						f"document_type={document_type}\n"
						f"document_name={document_name}\n"
						f"subject={subject}\n"
						f"error={str(e)}"
					),
				)
	finally:
		frappe.flags.mute_emails = prev_mute
	return created


def _send_notification_emails_via_smtp(
	users: list[str],
	*,
	subject: str,
	message_html: str,
	context_label: str,
) -> dict[str, int | bool]:
	sent = 0
	failed = 0
	for target in users:
		try:
			email = frappe.db.get_value("User", target, "email") or target
			email = str(email or "").strip()
			if not email:
				continue
			frappe.sendmail(
				recipients=[email],
				subject=subject,
				message=message_html,
				delayed=False,
			)
			sent += 1
		except Exception as e:
			failed += 1
			frappe.log_error(
				title="Notification email delivery failed",
				message=(
					f"context={context_label}\n"
					f"provider=smtp\n"
					f"target={target}\n"
					f"subject={subject}\n"
					f"error={str(e)}"
				),
			)
	return {"attempted": len(users), "sent": sent, "failed": failed, "disabled": False}


def _send_notification_emails_via_graph(
	users: list[str],
	*,
	subject: str,
	message_html: str,
	context_label: str,
) -> dict[str, int | bool]:
	email_account = _get_default_outgoing_email_account()
	account_name = str(getattr(email_account, "name", "") or "").strip()
	provider_name = str(getattr(email_account, "provider_name", "") or "").strip()
	if not email_account:
		frappe.log_error(
			title="Notification email delivery failed",
			message=f"context={context_label}\nprovider=graph\nerror=No default outgoing Email Account found",
		)
		return {"attempted": len(users), "sent": 0, "failed": len(users), "disabled": False}

	access_token = _get_connected_app_access_token(email_account)
	if not access_token:
		frappe.log_error(
			title="Notification email delivery failed",
			message=(
				f"context={context_label}\n"
				f"provider=graph\n"
				f"email_account={account_name}\n"
				f"error=Could not resolve access token from Connected App"
			),
		)
		return {"attempted": len(users), "sent": 0, "failed": len(users), "disabled": False}

	sender_email = str(getattr(email_account, "email_id", "") or "").strip()
	if int(getattr(email_account, "backend_app_flow", 0) or 0):
		if not sender_email:
			frappe.log_error(
				title="Notification email delivery failed",
				message=(
					f"context={context_label}\n"
					f"provider=graph\n"
					f"email_account={account_name}\n"
					f"error=Email Account email_id is required for backend app flow"
				),
			)
			return {"attempted": len(users), "sent": 0, "failed": len(users), "disabled": False}
		send_url = f"{_get_graph_endpoint_base()}/users/{quote(sender_email)}/sendMail"
	else:
		send_url = f"{_get_graph_endpoint_base()}/me/sendMail"

	headers = {
		"Authorization": f"Bearer {access_token}",
		"Content-Type": "application/json",
	}
	sent = 0
	failed = 0
	for target in users:
		try:
			email = frappe.db.get_value("User", target, "email") or target
			email = str(email or "").strip()
			if not email:
				continue
			payload = {
				"message": {
					"subject": subject,
					"body": {
						"contentType": "HTML",
						"content": message_html,
					},
					"toRecipients": [
						{"emailAddress": {"address": email}},
					],
				},
				"saveToSentItems": True,
			}
			resp = requests.post(send_url, headers=headers, json=payload, timeout=30)
			if resp.status_code not in {200, 202}:
				raise Exception(f"Graph sendMail returned {resp.status_code}: {resp.text}")
			sent += 1
		except Exception as e:
			failed += 1
			frappe.log_error(
				title="Notification email delivery failed",
				message=(
					f"context={context_label}\n"
					f"provider=graph\n"
					f"email_account={account_name}\n"
					f"connected_app_provider={provider_name}\n"
					f"target={target}\n"
					f"subject={subject}\n"
					f"error={str(e)}"
				),
			)
	return {"attempted": len(users), "sent": sent, "failed": failed, "disabled": False}


def send_notification_emails_safe(
	recipients: Iterable[str] | None = None,
	*,
	subject: str,
	message_html: str,
	context_label: str = "notification",
) -> dict[str, int | bool]:
	"""
	Send notification emails best-effort.
	Failures are logged and never raised.
	"""
	users = _normalize_users(recipients)
	if not users:
		return {"attempted": 0, "sent": 0, "failed": 0, "disabled": False}
	if not _notification_email_enabled():
		return {"attempted": len(users), "sent": 0, "failed": 0, "disabled": True}
	provider = _notification_email_provider()
	if provider == "graph":
		return _send_notification_emails_via_graph(
			users,
			subject=subject,
			message_html=message_html,
			context_label=context_label,
		)
	return _send_notification_emails_via_smtp(
		users,
		subject=subject,
		message_html=message_html,
		context_label=context_label,
	)
