# -*- coding: utf-8 -*-
"""
Project DocType Override
扩展ERPNext原生Project，支持Smart Board工作流和Board Automation
"""

import json
import frappe
from frappe.utils import getdate, add_months, add_days, get_last_day
from erpnext.projects.doctype.project.project import Project


class CustomProject(Project):
    """
    自定义Project类
    - before_insert: 确保status在合法选项内
    - validate: 实体同步 + Board Automation 执行
    - update_percent_complete: 阻止ERPNext自动覆盖status
    """

    def before_insert(self):
        """
        Ensure Project.status is valid against current DocType options.

        Why:
        - ERPNext standard Project.status default is "Open".
        - Smart Accounting overrides the status pool via Property Setter (removing "Open").
        - When inserting via API (/smart), status may be missing and defaults to "Open",
          causing validation errors.
        """
        try:
            f = self.meta.get_field("status") if getattr(self, "meta", None) else None
            raw = str(getattr(f, "options", "") or "")
            opts = [x.strip() for x in raw.split("\n") if str(x).strip()]
        except Exception:
            opts = []

        if not opts:
            return

        cur = str(getattr(self, "status", "") or "").strip()
        if cur in opts:
            return

        # Prefer our canonical default if present
        preferred = "Not started"
        self.status = preferred if preferred in opts else opts[0]

    def update_percent_complete(self):
        """
        ERPNext 默认会在 update_percent_complete 里把 Project.status 强制设为：
        - percent_complete == 100 -> "Completed"
        - else -> "Open"

        Smart Accounting 将 Project.status 作为自定义工作流状态池（不包含 Open/Completed）。
        因此必须阻止 ERPNext 自动覆盖 status，否则会触发 Select options 校验失败。
        """
        previous_status = (self.status or "").strip()

        # Keep ERPNext percent calculation behavior
        super().update_percent_complete()

        # Restore / normalize status to a valid option in current status pool
        try:
            f = self.meta.get_field("status") if getattr(self, "meta", None) else None
            raw = str(getattr(f, "options", "") or "")
            options = [x.strip() for x in raw.split("\n") if str(x).strip()]
        except Exception:
            options = []

        if not options:
            return

        options_lower = {o.lower(): o for o in options}

        def pick(opt: str) -> str | None:
            if not opt:
                return None
            opt = opt.strip()
            if opt in options:
                return opt
            return options_lower.get(opt.lower())

        # 1) If user had a valid status before, keep it (do not auto-overwrite)
        kept = pick(previous_status)
        if kept:
            self.status = kept
            return

        # 2) If current status happens to be valid, keep it
        kept = pick(self.status)
        if kept:
            self.status = kept
            return

        # 3) Map ERPNext legacy statuses -> nearest equivalents (best-effort)
        legacy_map = {
            "open": "Not started",
            # Project no longer uses "Done"; "Lodged" is the terminal status.
            "completed": "Lodged",
            "done": "Lodged",
            "cancelled": "Hold",
            "not started": "Not started",
        }
        mapped = legacy_map.get(previous_status.lower()) if previous_status else None
        kept = pick(mapped) if mapped else None
        if kept:
            self.status = kept
            return

        # 4) Default fallback
        self.status = pick("Not started") or options[0]
    
    def validate(self):
        """Project validation hooks for Smart Board flows."""
        super().validate()
        # Keep derived entity display in sync for non-desk flows (/smart).
        # Desk fetch_from is client-side; API updates need server-side alignment.
        self._sync_entity_type_from_customer_entity()

        # Board Automation: run automations on existing projects
        if not self.is_new():
            self._run_board_automations()

    def _sync_entity_type_from_customer_entity(self):
        """If Project.custom_customer_entity is set, keep Project.custom_entity_type aligned."""
        try:
            en = str(getattr(self, "custom_customer_entity", "") or "").strip()
        except Exception:
            en = ""
        if not en:
            return
        try:
            t = frappe.db.get_value("Customer Entity", en, "entity_type", cache=False)
        except Exception:
            t = None
        t = str(t or "").strip()
        if not t:
            return
        cur = str(getattr(self, "custom_entity_type", "") or "").strip()
        if cur != t:
            self.custom_entity_type = t
    
    # =========================================================================
    # Board Automation Engine
    # =========================================================================

    def _run_board_automations(self):
        """
        Execute all enabled Board Automation rules that match the current change.
        Called during validate() so changes are saved in a single DB write.

        Guards:
        1. frappe.flags (request-level): prevents re-firing even if doc.save() is
           called multiple times within the same HTTP request (different doc instances).
        2. Per-document instance flag: prevents re-entrance within the same instance.
        3. Snapshot: captures user's original status before any automation modifies it.
        """
        # Request-level guard: one automation execution per project per request
        flag_key = f'_sb_automation_done_{self.name}'
        if frappe.flags.get(flag_key):
            return
        frappe.flags[flag_key] = True

        # Per-document instance guard (belt + suspenders)
        if getattr(self, '_sb_automation_done', False):
            return
        self._sb_automation_done = True

        # Snapshot the user's original status change BEFORE any automation modifies it
        self._sb_original_status = str(self.status or "").strip()
        self._sb_status_changed = self.has_value_changed("status")
        try:
            automations = frappe.get_all(
                "Board Automation",
                filters={"enabled": 1},
                fields=["name", "trigger_type", "trigger_config", "actions",
                         "execution_count"],
            )
        except Exception:
            # DocType may not exist yet during migration
            return

        for auto in automations:
            try:
                if self._trigger_matches(auto):
                    self._execute_actions(auto)
            except Exception as e:
                frappe.log_error(
                    f"Board Automation {auto.get('name')} failed for Project {self.name}: {str(e)}",
                    "Board Automation Error",
                )

    def _trigger_matches(self, auto):
        """Check if this automation's trigger matches the current document change.
        Uses the snapshot taken before any automation modified fields."""
        trigger_type = str(auto.get("trigger_type") or "").strip()

        if trigger_type == "status_change":
            config = _parse_json(auto.get("trigger_config"))
            to_value = str(config.get("to_value") or "").strip()
            if not to_value:
                return False
            # Use snapshot to avoid interference from prior action resets
            if not getattr(self, '_sb_status_changed', False):
                return False
            return getattr(self, '_sb_original_status', '') == to_value

        return False

    def _execute_actions(self, auto):
        """Execute all actions in the automation's actions array."""
        actions_raw = auto.get("actions")
        actions = _parse_json_array(actions_raw)
        if not actions:
                return

        for action in actions:
            action_type = str(action.get("action_type") or "").strip()
            config = action.get("config") or {}
            if isinstance(config, str):
                config = _parse_json(config)

            if action_type == "roll_due_date":
                self._action_roll_due_date(config, auto)
            elif action_type == "reset_status":
                self._action_reset_status(config, auto)
            else:
                frappe.logger("smart_accounting").warning(
                    "Board Automation %s: unknown action_type '%s'", auto.get("name"), action_type
                )

        # Update execution stats (once per automation, not per action)
        try:
            frappe.db.set_value(
                "Board Automation",
                auto.get("name"),
                {
                    "execution_count": (auto.get("execution_count") or 0) + 1,
                    "last_triggered": frappe.utils.now_datetime(),
                },
                update_modified=False,
            )
        except Exception:
            pass

    def _action_roll_due_date(self, config, auto):
        """Action: Roll Lodgement Due forward by the project's frequency."""
        target_field = "custom_lodgement_due_date"

        freq = str(getattr(self, "custom_project_frequency", "") or "").strip()
        current_date = getattr(self, target_field, None)

        if not freq or freq in ("One-off", "One off", ""):
            return
        if not current_date:
                return

        current_date = getdate(current_date)
        new_date = _roll_date_by_frequency(current_date, freq)

        if new_date and new_date != current_date:
            self.set(target_field, new_date)
            frappe.logger("smart_accounting").info(
                "Board Automation %s: rolled %s from %s to %s for Project %s",
                auto.get("name"), target_field, current_date, new_date, self.name,
            )
    
    def _action_reset_status(self, config, auto):
        """Action: Reset project status to a configured value."""
        reset_to = str(config.get("reset_to") or "Not started").strip()
        if not reset_to:
            return

        try:
            f = self.meta.get_field("status") if getattr(self, "meta", None) else None
            raw = str(getattr(f, "options", "") or "")
            pool = [x.strip() for x in raw.split("\n") if str(x).strip()]
        except Exception:
            pool = []

        if pool and reset_to in pool:
            self.status = reset_to
        elif pool:
            self.status = pool[0]


# =========================================================================
# Module-level helpers
# =========================================================================

def _parse_json(val):
    """Safely parse a JSON string or return dict as-is."""
    if isinstance(val, dict):
        return val
    if isinstance(val, str):
        try:
            return json.loads(val)
        except Exception:
            return {}
    return {}


def _parse_json_array(val):
    """Safely parse a JSON string as a list, or return list as-is."""
    if isinstance(val, list):
        return val
    if isinstance(val, str):
        try:
            parsed = json.loads(val)
            return parsed if isinstance(parsed, list) else []
        except Exception:
            return []
    return []


def _roll_date_by_frequency(current_date, frequency: str):
    """Calculate the next date based on frequency."""
    freq = str(frequency or "").strip().lower()
    d = getdate(current_date)

    if freq in ("weekly",):
        return add_days(d, 7)
    if freq in ("monthly",):
        return add_months(d, 1)
    if freq in ("quarterly",):
        return add_months(d, 3)
    if freq in ("half-yearly", "half yearly", "halfyearly"):
        return add_months(d, 6)
    if freq in ("yearly",):
        return add_months(d, 12)

    return None
