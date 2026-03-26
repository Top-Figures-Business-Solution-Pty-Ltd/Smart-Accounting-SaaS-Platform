"""
Notification delivery helpers.

Design goals:
- In-app notifications (Notification Log) are the primary channel.
- Email delivery is optional and best-effort.
- Mail failures must never break the user-facing workflow.
"""

from __future__ import annotations

from typing import Iterable

import frappe


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
