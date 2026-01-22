# -*- coding: utf-8 -*-
"""
Project DocType Override
扩展ERPNext原生Project，支持Auto Repeat自动创建和团队继承
"""

import frappe
from frappe.utils import getdate, add_months, get_last_day
from erpnext.projects.doctype.project.project import Project


class CustomProject(Project):
    """
    自定义Project类
    - after_insert: 根据custom_project_frequency自动创建Auto Repeat
    - validate: 同步custom_project_frequency到Auto Repeat
    - on_recurring: Auto Repeat创建新Project时自动生成名称和继承配置
    """
    
    def after_insert(self):
        """Project创建后自动创建Auto Repeat"""
        super().after_insert()
        if self.custom_project_frequency and self.custom_project_frequency != "One-off":
            self.create_auto_repeat()
    
    def create_auto_repeat(self):
        """根据custom_project_frequency创建Auto Repeat"""
        try:
            auto_repeat = frappe.new_doc("Auto Repeat")
            auto_repeat.reference_doctype = "Project"
            auto_repeat.reference_document = self.name
            auto_repeat.frequency = self.custom_project_frequency  # Monthly/Quarterly/Yearly
            auto_repeat.start_date = self.expected_start_date or frappe.utils.today()
            
            # 可选：根据业务需求设置end_date
            # auto_repeat.end_date = self.expected_end_date
            
            auto_repeat.insert(ignore_permissions=True)
            
            # 更新Project的auto_repeat字段
            frappe.db.set_value("Project", self.name, "auto_repeat", auto_repeat.name)
            # NOTE: Do not show msgprint popups on insert; it harms /smart UX.
            # Keep only server-side logs; the feature still works.
            frappe.logger("smart_accounting").info("Auto Repeat created: %s for Project %s", auto_repeat.name, self.name)
            
        except Exception as e:
            frappe.log_error(f"Failed to create Auto Repeat for {self.name}: {str(e)}")
            frappe.throw(f"创建 Auto Repeat 失败: {str(e)}")
    
    def validate(self):
        """修改frequency时同步Auto Repeat"""
        super().validate()
        if self.has_value_changed("custom_project_frequency") and self.auto_repeat:
            self.sync_auto_repeat_frequency()
    
    def sync_auto_repeat_frequency(self):
        """同步frequency到Auto Repeat"""
        try:
            if self.custom_project_frequency == "One-off":
                # 改为One-off，禁用Auto Repeat
                frappe.db.set_value("Auto Repeat", self.auto_repeat, "disabled", 1)
                frappe.logger("smart_accounting").info("Auto Repeat disabled: %s for Project %s", self.auto_repeat, self.name)
            else:
                auto_repeat = frappe.get_doc("Auto Repeat", self.auto_repeat)
                auto_repeat.frequency = self.custom_project_frequency
                auto_repeat.disabled = 0
                auto_repeat.save(ignore_permissions=True)
                frappe.logger("smart_accounting").info(
                    "Auto Repeat updated: %s frequency=%s for Project %s",
                    self.auto_repeat,
                    self.custom_project_frequency,
                    self.name,
                )
        except Exception as e:
            frappe.log_error(f"Failed to sync Auto Repeat for {self.name}: {str(e)}")
            frappe.throw(f"同步 Auto Repeat 失败: {str(e)}")
    
    def on_recurring(self, reference_doc, auto_repeat_doc):
        """
        Auto Repeat创建新Project时触发
        自动生成名称、更新日期、继承配置
        """
        
        # 1. 生成新名称（包含entity信息）
        date = getdate(auto_repeat_doc.next_schedule_date)
        
        # 构建名称部分
        parts = [self.customer]
        
        # 如果有entity，添加到名称中
        if self.custom_entity_type:
            # 从entity_name提取简短标识
            # 例如："Client A Pty Ltd" -> "(Pty Ltd)"
            entity_short = self.custom_entity_type.replace(self.customer, "").strip()
            if entity_short:
                parts.append(f"({entity_short})")
        
        # 生成period
        if auto_repeat_doc.frequency == "Monthly":
            period = date.strftime("%B %Y")  # "August 2025"
        elif auto_repeat_doc.frequency == "Quarterly":
            quarter = (date.month - 1) // 3 + 1
            period = f"Q{quarter} FY{date.year % 100}"
        else:
            period = f"FY{date.year % 100}"
        
        parts.append(period)
        parts.append(self.project_type)
        
        self.project_name = " - ".join(parts)
        # 结果："Client A (Pty Ltd) - August 2025 - BAS"
        
        # 2. 更新日期
        self.expected_start_date = date
        if auto_repeat_doc.frequency == "Monthly":
            self.expected_end_date = get_last_day(date)
        elif auto_repeat_doc.frequency == "Quarterly":
            self.expected_end_date = get_last_day(add_months(date, 3))
        else:
            self.expected_end_date = get_last_day(add_months(date, 12))
        
        # 3. 继承关键字段（用户可修改）
        self.custom_entity_type = reference_doc.custom_entity_type
        
        # 继承团队成员子表
        self.custom_team_members = []  # 清空现有成员
        for member in reference_doc.custom_team_members:
            self.append('custom_team_members', {
                'user': member.user,
                'role': member.role,
                'assigned_date': frappe.utils.today()
            })
        
        # 4. 重置状态
        self.status = "Not Started"
        self.percent_complete = 0
        self.notes = ""

