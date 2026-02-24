# -*- coding: utf-8 -*-
"""
Backfill Board Automation.automation_name for legacy rows.

This patch is idempotent and safe to run multiple times.
"""

from __future__ import annotations

import json

import frappe


def _parse_json(val):
    if isinstance(val, dict):
        return val
    if isinstance(val, str):
        try:
            return json.loads(val)
        except Exception:
            return {}
    return {}


def _pick_name(row: dict) -> str:
    cfg = _parse_json(row.get("trigger_config"))
    title = str((cfg.get("__sb_meta") or {}).get("title") or "").strip()
    if title:
        return title

    trigger_type = str(row.get("trigger_type") or "").strip()
    if trigger_type == "status_change":
        to_value = ""
        if isinstance(cfg, dict):
            to_value = str(cfg.get("to_value") or "").strip()
            if not to_value and isinstance(cfg.get("triggers"), list):
                for t in cfg.get("triggers") or []:
                    if not isinstance(t, dict):
                        continue
                    if str(t.get("trigger_type") or "").strip() != "status_change":
                        continue
                    tc = t.get("config") or {}
                    if isinstance(tc, str):
                        tc = _parse_json(tc)
                    to_value = str((tc or {}).get("to_value") or "").strip()
                    if to_value:
                        break
        if to_value:
            return f"Status to {to_value}"
        return "Status change automation"

    if trigger_type == "date_reaches":
        return "Date reaches automation"
    if trigger_type == "project_type_is":
        return "Project type automation"
    return f"Automation {trigger_type or 'rule'}"


def execute():
    if not frappe.db.has_column("Board Automation", "automation_name"):
        return

    rows = frappe.get_all(
        "Board Automation",
        fields=["name", "automation_name", "trigger_type", "trigger_config"],
        limit_page_length=10000,
    )
    for row in rows or []:
        existing = str(row.get("automation_name") or "").strip()
        if existing:
            continue
        title = _pick_name(row)
        if not title:
            continue
        frappe.db.set_value("Board Automation", row.get("name"), "automation_name", title, update_modified=False)

