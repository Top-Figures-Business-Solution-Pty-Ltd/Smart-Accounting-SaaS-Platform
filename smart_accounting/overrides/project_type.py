from __future__ import annotations

from erpnext.projects.doctype.project_type.project_type import ProjectType as ERPNextProjectType


class SmartProjectType(ERPNextProjectType):
	"""
	ERPNext blocks deletion of the Project Type named exactly 'External' in core.

	In Smart Accounting we treat placeholder Project Types as user-manageable,
	so we allow deleting them (still subject to normal link checks).
	"""

	def on_trash(self):
		# Allow deleting ERPNext's protected placeholder type(s) if your org wants to remove them.
		if self.name in {"External"}:
			return
		return super().on_trash()


