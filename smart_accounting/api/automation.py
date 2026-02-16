# -*- coding: utf-8 -*-
"""
Board Automation API
CRUD operations for Board Automation rules.
Website-safe (/smart) — all endpoints are whitelisted.
"""

import json
import frappe
from typing import Any


def _ensure_logged_in():
    if frappe.session.user == "Guest":
        frappe.throw("Please log in", frappe.AuthenticationError)


def _parse_json(val):
    if isinstance(val, dict):
        return val
    if isinstance(val, str):
        try:
            return json.loads(val)
        except Exception:
            return {}
    return {}


# ============================================================
# Metadata: available trigger / action options
# ============================================================

TRIGGER_TYPES = {
    "status_change": {
        "label": "Status changes to",
        "config_fields": [
            {
                "key": "to_value",
                "label": "Target Status",
                "type": "select",
                "source": "project_status_pool",
            }
        ],
    },
}

# Each action is now a standalone unit (no bundled side-effects).
ACTION_TYPES = {
    "roll_due_date": {
        "label": "Roll Lodgement Due forward by frequency",
        "config_fields": [],  # No user config needed; field is hardcoded to custom_lodgement_due_date
    },
    "reset_status": {
        "label": "Reset status to",
        "config_fields": [
            {
                "key": "reset_to",
                "label": "Reset To",
                "type": "select",
                "source": "project_status_pool",
                "default": "Not started",
            },
        ],
    },
}


def _get_project_status_pool() -> list[str]:
    try:
        meta = frappe.get_meta("Project")
        f = meta.get_field("status")
        raw = str(getattr(f, "options", "") or "")
        return [x.strip() for x in raw.split("\n") if str(x).strip()]
    except Exception:
        return ["Not started", "Working on it", "Completed"]


@frappe.whitelist()
def get_automation_meta() -> dict:
    """
    Return available trigger types and action types with their config schemas.
    """
    _ensure_logged_in()
    status_pool = _get_project_status_pool()

    def resolve_fields(config_fields):
        out = []
        for cf in config_fields:
            field = {**cf}
            if field.get("source") == "project_status_pool":
                field["options"] = [{"value": s, "label": s} for s in status_pool]
                del field["source"]
            out.append(field)
        return out

    triggers = {}
    for key, cfg in TRIGGER_TYPES.items():
        triggers[key] = {**cfg, "config_fields": resolve_fields(cfg.get("config_fields", []))}

    actions = {}
    for key, cfg in ACTION_TYPES.items():
        actions[key] = {**cfg, "config_fields": resolve_fields(cfg.get("config_fields", []))}

    return {"triggers": triggers, "actions": actions}


# ============================================================
# CRUD
# ============================================================

@frappe.whitelist()
def get_automations() -> dict:
    _ensure_logged_in()

    try:
        items = frappe.get_all(
            "Board Automation",
            fields=[
                "name", "enabled", "trigger_type", "trigger_config",
                "actions", "execution_count", "last_triggered",
            ],
            order_by="creation asc",
        )
    except Exception:
        items = []

    for item in items:
        item["trigger_config"] = _parse_json(item.get("trigger_config"))
        raw_actions = item.get("actions")
        if isinstance(raw_actions, str):
            try:
                raw_actions = json.loads(raw_actions)
            except Exception:
                raw_actions = []
        item["actions"] = raw_actions if isinstance(raw_actions, list) else []

    return {"items": items}


@frappe.whitelist()
def save_automation(
    name: str | None = None,
    enabled: int = 1,
    trigger_type: str = "",
    trigger_config: Any = None,
    actions: Any = None,
) -> dict:
    """
    Create or update a Board Automation rule.
    actions: JSON array of [{action_type, config}]
    """
    _ensure_logged_in()

    trigger_type = str(trigger_type or "").strip()
    if not trigger_type:
        frappe.throw("Trigger type is required")
    if trigger_type not in TRIGGER_TYPES:
        frappe.throw(f"Unknown trigger type: {trigger_type}")

    # Parse trigger_config
    tc = trigger_config
    if isinstance(tc, str):
        try:
            tc = json.loads(tc)
        except Exception:
            tc = {}
    if not isinstance(tc, dict):
        tc = {}

    # Parse actions array
    acts = actions
    if isinstance(acts, str):
        try:
            acts = json.loads(acts)
        except Exception:
            acts = []
    if not isinstance(acts, list):
        acts = []

    # Validate each action
    clean_actions = []
    for a in acts:
        if not isinstance(a, dict):
            continue
        at = str(a.get("action_type") or "").strip()
        if not at or at not in ACTION_TYPES:
            continue
        ac = a.get("config") or {}
        if isinstance(ac, str):
            try:
                ac = json.loads(ac)
            except Exception:
                ac = {}
        clean_actions.append({"action_type": at, "config": ac})

    if not clean_actions:
        frappe.throw("At least one valid action is required")

    name = str(name or "").strip()
    if name and frappe.db.exists("Board Automation", name):
        doc = frappe.get_doc("Board Automation", name)
        doc.enabled = int(enabled or 0)
        doc.trigger_type = trigger_type
        doc.trigger_config = json.dumps(tc)
        doc.actions = json.dumps(clean_actions)
        doc.save(ignore_permissions=True)
    else:
        doc = frappe.new_doc("Board Automation")
        doc.enabled = int(enabled or 0)
        doc.trigger_type = trigger_type
        doc.trigger_config = json.dumps(tc)
        doc.actions = json.dumps(clean_actions)
        doc.insert(ignore_permissions=True)

    return {
        "ok": True,
        "name": doc.name,
        "enabled": doc.enabled,
        "trigger_type": doc.trigger_type,
    }


@frappe.whitelist()
def toggle_automation(name: str, enabled: int = 1) -> dict:
    _ensure_logged_in()
    name = str(name or "").strip()
    if not name or not frappe.db.exists("Board Automation", name):
        frappe.throw("Automation not found")
    frappe.db.set_value("Board Automation", name, "enabled", int(enabled or 0))
    return {"ok": True, "name": name, "enabled": int(enabled or 0)}


@frappe.whitelist()
def delete_automation(name: str) -> dict:
    _ensure_logged_in()
    name = str(name or "").strip()
    if not name or not frappe.db.exists("Board Automation", name):
        frappe.throw("Automation not found")
    frappe.delete_doc("Board Automation", name, ignore_permissions=True)
    return {"ok": True, "name": name}
