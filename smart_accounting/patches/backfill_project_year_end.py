# -*- coding: utf-8 -*-
"""
Backfill Project.custom_year_end from Customer Entity.year_end.

Why:
- Existing Projects created before the new Year End sync may have empty custom_year_end.
- This patch runs once on migrate, so test/prod can auto-align after git pull.

Idempotent:
- Safe to run multiple times; only updates rows with empty custom_year_end.
"""

from __future__ import annotations

import frappe


def execute():
    try:
        from smart_accounting.api.project_entity import backfill_project_year_end
    except Exception:
        return

    if not frappe.db.has_column("Project", "custom_year_end"):
        return

    # Real run on migrate; function itself is idempotent.
    try:
        backfill_project_year_end(limit=200000, dry_run=0, active_only=0)
    except Exception:
        # Never block migrate for best-effort data alignment.
        pass
