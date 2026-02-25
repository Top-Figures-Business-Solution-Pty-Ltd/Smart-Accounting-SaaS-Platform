# -*- coding: utf-8 -*-
"""
Migrate role label/value from Reviewer -> Manager.

Scope:
- Project Team Member child rows (Project/Task team assignments)
- Board Automation actions config (notify_someone.role)
- Saved View columns payloads (team:Reviewer -> team:Manager)

Idempotent: safe to run multiple times.
"""

from __future__ import annotations

import json

import frappe


def _replace_team_reviewer_field_in_columns(raw):
    changed = False
    v = raw
    if isinstance(v, str):
        try:
            v = json.loads(v)
        except Exception:
            return raw, False

    def _map_cols(cols):
        nonlocal changed
        out = []
        for c in (cols or []):
            if not isinstance(c, dict):
                out.append(c)
                continue
            cc = dict(c)
            field = str(cc.get("field") or "").strip()
            if field == "team:Reviewer":
                cc["field"] = "team:Manager"
                if str(cc.get("label") or "").strip().lower() in {"reviewer", ""}:
                    cc["label"] = "Manager"
                changed = True
            out.append(cc)
        return out

    if isinstance(v, list):
        vv = _map_cols(v)
        return json.dumps(vv, ensure_ascii=False), changed

    if isinstance(v, dict):
        vv = dict(v)
        if isinstance(vv.get("project"), list):
            vv["project"] = _map_cols(vv.get("project"))
        if isinstance(vv.get("tasks"), list):
            vv["tasks"] = _map_cols(vv.get("tasks"))
        if isinstance(vv.get("projectColumns"), list):
            vv["projectColumns"] = _map_cols(vv.get("projectColumns"))
        if isinstance(vv.get("taskColumns"), list):
            vv["taskColumns"] = _map_cols(vv.get("taskColumns"))
        return json.dumps(vv, ensure_ascii=False), changed

    return raw, False


def _migrate_saved_view_columns():
    if not frappe.db.exists("DocType", "Saved View"):
        return 0
    rows = frappe.get_all("Saved View", fields=["name", "columns"], limit_page_length=100000)
    updated = 0
    for row in rows or []:
        name = row.get("name")
        columns = row.get("columns")
        if not name or not columns:
            continue
        next_columns, changed = _replace_team_reviewer_field_in_columns(columns)
        if not changed:
            continue
        frappe.db.set_value("Saved View", name, "columns", next_columns, update_modified=False)
        updated += 1
    return updated


def _migrate_automation_notify_role():
    if not frappe.db.exists("DocType", "Board Automation"):
        return 0
    rows = frappe.get_all("Board Automation", fields=["name", "actions"], limit_page_length=100000)
    updated = 0
    for row in rows or []:
        name = row.get("name")
        raw = row.get("actions")
        if not name or not raw:
            continue
        try:
            actions = json.loads(raw) if isinstance(raw, str) else (raw if isinstance(raw, list) else [])
        except Exception:
            actions = []
        changed = False
        next_actions = []
        for a in actions:
            if not isinstance(a, dict):
                next_actions.append(a)
                continue
            aa = dict(a)
            if str(aa.get("action_type") or "").strip() == "notify_someone":
                cfg = aa.get("config") or {}
                if isinstance(cfg, str):
                    try:
                        cfg = json.loads(cfg)
                    except Exception:
                        cfg = {}
                if isinstance(cfg, dict) and str(cfg.get("role") or "").strip() == "Reviewer":
                    cfg = dict(cfg)
                    cfg["role"] = "Manager"
                    aa["config"] = cfg
                    changed = True
            next_actions.append(aa)
        if not changed:
            continue
        frappe.db.set_value(
            "Board Automation",
            name,
            "actions",
            json.dumps(next_actions, ensure_ascii=False),
            update_modified=False,
        )
        updated += 1
    return updated


def _migrate_team_member_rows():
    if not frappe.db.exists("DocType", "Project Team Member"):
        return 0
    # Safe + idempotent SQL update.
    frappe.db.sql(
        """
        update `tabProject Team Member`
        set role = 'Manager'
        where role = 'Reviewer'
        """
    )
    try:
        return int(frappe.db.sql("select row_count() as n", as_dict=True)[0].get("n") or 0)
    except Exception:
        return 0


def execute():
    _migrate_team_member_rows()
    _migrate_automation_notify_role()
    _migrate_saved_view_columns()

