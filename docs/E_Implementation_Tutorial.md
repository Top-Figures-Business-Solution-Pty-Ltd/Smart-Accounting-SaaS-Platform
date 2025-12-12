# 📄 Document E: Implementation Tutorial
# 实施教程文档

**项目**: Smart Accounting  
**版本**: v1.0  
**日期**: 2025-12-12  
**用途**: 🔧 **开发指南** - 如何在 ERPNext 中通过 UI 实现数据结构

---

## 目录

1. [概述](#1-概述)
2. [添加 Custom Fields](#2-添加-custom-fields)
3. [创建 Saved View DocType](#3-创建-saved-view-doctype)
4. [配置 Select 选项](#4-配置-select-选项)
5. [实施顺序](#5-实施顺序)
6. [验证清单](#6-验证清单)

---

## 1. 概述

### 1.1 需要做的事情

| 任务 | 说明 |
|------|------|
| **扩展 Project** | 添加 custom fields |
| **扩展 Task** | 添加 custom fields |
| **扩展 Customer** | 添加 custom fields |
| **扩展 Contact** | 添加 custom fields |
| **创建 Saved View** | 新建 DocType |
| **配置选项** | 配置 Select 字段的选项 |

### 1.2 操作方式

所有操作通过 ERPNext **UI 界面**完成，无需写代码。

---

## 2. 添加 Custom Fields

### 2.1 进入 Customize Form

```
方法 1: Setup → Customize → Customize Form
方法 2: 地址栏输入 /app/customize-form
```

### 2.2 操作步骤

1. 在 "Enter Form Type" 输入要扩展的 DocType（如 `Project`）
2. 点击 "Go" 或按回车
3. 滚动到字段列表底部
4. 点击 **"Add Row"** 添加新字段
5. 填写字段信息
6. 点击 **"Save"** 保存

### 2.3 字段类型说明

| Fieldtype | 用途 | 示例 |
|-----------|------|------|
| `Data` | 单行文本 | custom_fiscal_year |
| `Select` | 下拉选择 | custom_project_type |
| `Link` | 链接到其他 DocType | custom_primary_contact → Contact |
| `Date` | 日期 | custom_lodgement_due_date |
| `Currency` | 货币金额 | custom_actual_billing |
| `Check` | 复选框 | is_active |
| `Text Editor` | 多行富文本 | notes（原生）|
| `JSON` | JSON 数据 | custom_team |
| `Table MultiSelect` | 多选 | custom_softwares |

### 2.4 字段属性说明

| 属性 | 说明 |
|------|------|
| **Label** | 显示名称（用户看到的）|
| **Fieldname** | 字段名（系统使用，自定义字段以 `custom_` 开头）|
| **Fieldtype** | 字段类型 |
| **Options** | Select 的选项（每行一个）/ Link 的目标 DocType |
| **Mandatory** | 是否必填 |
| **In List View** | 是否在列表视图显示 |
| **In Standard Filter** | 是否在筛选器显示 |
| **Insert After** | 插入到哪个字段后面（控制位置）|

---

## 3. 创建 Saved View DocType

### 3.1 进入 DocType 创建页面

```
方法 1: Setup → DocType → New DocType
方法 2: 地址栏输入 /app/doctype/new-doctype
```

### 3.2 基本设置

| 设置项 | 值 |
|--------|-----|
| Name | `Saved View` |
| Module | `Smart Accounting` |
| Is Submittable | ❌ No |
| Allow Rename | ✅ Yes |
| Track Changes | ✅ Yes |

### 3.3 添加字段（按顺序）

| # | Label | Fieldname | Fieldtype | Options | Mandatory | 说明 |
|---|-------|-----------|-----------|---------|-----------|------|
| 1 | Title | `title` | Data | | ✅ | 视图名称 |
| 2 | View Type | `view_type` | Select | system<br/>tenant<br/>personal | ✅ | 视图层级 |
| 3 | Target DocType | `target_doctype` | Select | Project<br/>Task | ✅ | 目标类型 |
| 4 | Project Type | `project_type` | Data | | | 关联业务类型 |
| 5 | Filters | `filters` | JSON | | | 筛选条件 |
| 6 | Columns | `columns` | JSON | | ✅ | 列配置 |
| 7 | Field Options | `field_options` | JSON | | | 各字段可见选项 |
| 8 | Group By | `group_by` | Data | | | 分组字段 |
| 9 | Sort By | `sort_by` | Data | | | 排序字段 |
| 10 | Sort Order | `sort_order` | Select | asc<br/>desc | | 排序方向 |
| 11 | Company | `company` | Link | Company | | 租户隔离 |
| 12 | Is Default | `is_default` | Check | | | 是否默认 |
| 13 | Is System | `is_system` | Check | | | 系统预置 |

### 3.4 设置权限

在 DocType 的 Permissions 部分添加：

| Role | Read | Write | Create | Delete |
|------|------|-------|--------|--------|
| System Manager | ✅ | ✅ | ✅ | ✅ |
| 其他需要的角色 | ... | ... | ... | ... |

### 3.5 保存

点击 **Save** 保存 DocType。

---

## 4. 配置 Select 选项

### 4.1 修改现有字段的选项

如果需要修改 Select 字段的选项（如 Project 的 status）：

1. 进入 **Customize Form**
2. 选择 DocType（如 Project）
3. 找到要修改的字段（如 status）
4. 修改 **Options** 列的内容（每行一个选项）
5. 保存

### 4.2 示例：Project Status 选项

```
Not Started
Working
Ready for Review
Under Review
Completed
Cancelled
```

### 4.3 示例：Task Status 选项

```
Open
Working
Completed
```

---

## 5. 实施顺序

### Phase 1: Customer & Contact 扩展

**Step 1: Customer 扩展**

| Label | Fieldname | Fieldtype | Options |
|-------|-----------|-----------|---------|
| Referred By | `custom_referred_by` | Link | Contact |
| Entity Type | `custom_entity_type` | Select | Individual<br/>Company<br/>Trust<br/>Partnership<br/>SMSF |
| Year End | `custom_year_end` | Select | June<br/>December<br/>March<br/>September |

**Step 2: Contact 扩展**

| Label | Fieldname | Fieldtype | Options |
|-------|-----------|-----------|---------|
| Is Referrer | `custom_is_referrer` | Check | |
| Contact Role | `custom_contact_role` | Select | Director<br/>Accountant<br/>Admin<br/>Other |
| Social Accounts | `custom_social_accounts` | JSON | |

---

### Phase 2: Project 扩展（8 个字段）

| Label | Fieldname | Fieldtype | Options | 说明 |
|-------|-----------|-----------|---------|------|
| Project Type | `custom_project_type` | Select | ITR<br/>BAS<br/>Bookkeeping<br/>Payroll<br/>Financial Statements | 必填，In List View，In Standard Filter |
| Team | `custom_team` | JSON | | 存储人员分配 `{preparers:[], reviewers:[], partners:[]}` |
| Team Members | `custom_team_members` | Data | | 辅助筛选，Read Only，自动生成 |
| Fiscal Year | `custom_fiscal_year` | Data | | 如 "FY24"，In List View |
| Target Month | `custom_target_month` | Select | January<br/>February<br/>...<br/>December | |
| Lodgement Due Date | `custom_lodgement_due_date` | Date | | ATO 法定截止日期 |
| Frequency | `custom_frequency` | Select | Annually<br/>Quarterly<br/>Monthly<br/>One-off | 按需显示 |
| Softwares | `custom_softwares` | Table MultiSelect | Software Item | 需先创建 Software Item 子表 |

---

### Phase 3: Task 扩展

| Label | Fieldname | Fieldtype | Options |
|-------|-----------|-----------|---------|
| Assigned To | `custom_assigned_to` | Link | User |
| Due Date | `custom_due_date` | Date | |
| Notes | `custom_notes` | Text | |
| Priority | `custom_priority` | Select | Low<br/>Medium<br/>High |

---

### Phase 4: 创建 Saved View（13 个字段）

按照 [第 3 节](#3-创建-saved-view-doctype) 的步骤创建，共 13 个字段。

---

### Phase 5: 配置 Select 选项

按照 [第 4 节](#4-配置-select-选项) 配置 status 等字段选项。

---

## 6. 验证清单

### 6.1 字段验证

- [ ] 在 Project 表单中能看到所有新字段
- [ ] 在 Project 列表视图能看到 custom_project_type
- [ ] 能通过 custom_project_type 筛选 Project
- [ ] Customer、Contact、Task 的扩展字段都能正常显示

### 6.2 Saved View 验证

- [ ] Saved View DocType 创建成功
- [ ] 能新建 Saved View 记录
- [ ] 能正常保存 JSON 字段内容

### 6.3 Select 选项验证

- [ ] Project status 选项正确
- [ ] Task status 选项正确
- [ ] 其他 Select 字段选项正确

---

## 附录

### A. 相关文档

| 文档 | 说明 |
|------|------|
| `docs/A_Data_Model_Assessment.md` | 数据模型设计（字段详细定义）|
| `docs/D_UI_Design.md` | UI 设计文档 |

### B. 修订历史

| 版本 | 日期 | 修改内容 |
|------|------|---------|
| 1.0 | 2025-12-12 | 初始版本，纯 UI 操作方式 |
