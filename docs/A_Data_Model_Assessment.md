# 📄 Document A: Data Model Assessment
# 数据模型评估文档

**项目**: Smart Accounting  
**版本**: v1.0  
**日期**: 2025-12-01  
**作者**: AI Assistant  

---

## 目录

1. [Executive Summary](#1-executive-summary)
2. [DocType Inventory](#2-doctype-inventory)
3. [Entity Relationships](#3-entity-relationships)
4. [Semantic Mismatch Analysis](#4-semantic-mismatch-analysis)
5. [Gap Analysis](#5-gap-analysis)
6. [Recommendations](#6-recommendations)

---

## 1. Executive Summary

### 1.1 项目背景

Smart Accounting 是一个基于 ERPNext/Frappe 框架开发的会计事务所项目管理系统，旨在替代 Monday.com 的基础项目管理功能。长期目标是打包为 SaaS 产品。

### 1.2 核心发现

| 类别 | 状态 | 说明 |
|------|------|------|
| **语义错位** | 🔴 严重 | ERPNext 的 Task/Project 与业务概念存在错位 |
| **数据冗余** | 🟡 中等 | Engagement 与 Task 职责重叠 |
| **关系复杂度** | 🟡 中等 | Customer 多处被引用，缺乏统一入口 |
| **扩展性** | 🟢 良好 | 使用 Custom Field 扩展，未修改核心 |

### 1.3 关键结论

```
ERPNext DocType    →    实际业务概念
─────────────────────────────────────
Task               →    工作项目 (Work Item)
Project            →    项目类别 (Project Category)  
Partition          →    看板/工作区 (Board)
Engagement         →    业务约定 (Contract) [定位模糊]
```

---

## 2. DocType Inventory

### 2.1 核心业务 DocType

#### Task（任务 → 实际：工作项目）

| 属性 | 值 |
|------|-----|
| **类型** | ERPNext 原生 + 自定义字段 |
| **实际用途** | 表格中的每一行，代表一个客户的一项具体工作 |
| **记录数量** | ~220+ (活跃) |

**关键字段**:

| 字段名 | 类型 | 用途 | 评估 |
|--------|------|------|------|
| `subject` | Data | 任务名称 | ✅ 正常使用 |
| `project` | Link → Project | 所属项目类别 | ✅ 正常使用 |
| `parent_task` | Link → Task | 父任务(subtask) | ✅ 正常使用 |
| `custom_client` | Link → Customer | 所属客户 | ✅ 核心字段 |
| `custom_tftg` | Link → Company | TF/TG公司 | ✅ 核心字段 |
| `custom_engagement` | Link → Engagement | 关联业务约定 | ⚠️ 使用率低 |
| `custom_task_status` | Select | 自定义状态 | ✅ 核心字段 |
| `custom_target_month` | Select | 目标月份 | ✅ 核心字段 |
| `custom_budget_planning` | Currency | 预算 | ✅ 正常使用 |
| `custom_actual_billing` | Currency | 实际账单 | ✅ 正常使用 |
| `custom_roles` | Table → Task Role Assignment | 角色分配 | ✅ 核心字段 |
| `custom_softwares` | Table → Task Software | 使用软件 | ✅ 正常使用 |
| `custom_review_notes` | Table → Review Note | 审核备注 | ✅ 正常使用 |
| `custom_is_archived` | Check | 是否归档 | ✅ 正常使用 |

**问题**:
- ❌ 原生 `status` 字段与 `custom_task_status` 并存，造成混淆
- ⚠️ `custom_engagement` 链接使用率低，定位不清

---

#### Project（项目 → 实际：项目类别）

| 属性 | 值 |
|------|-----|
| **类型** | ERPNext 原生 + 自定义字段 |
| **实际用途** | 按年度+服务类型分组 Task |
| **记录数量** | ~3-10 per partition |

**关键字段**:

| 字段名 | 类型 | 用途 | 评估 |
|--------|------|------|------|
| `project_name` | Data | 类别名称 | ✅ 如 "FY2024 Tax Returns" |
| `customer` | Link → Customer | 所属客户 | ⚠️ 实际不使用 |
| `custom_partition` | Link → Partition | 所属看板 | ✅ 核心字段 |
| `custom_service_line` | Link → Service Line | 服务类型 | ✅ 核心字段 |
| `custom_is_archived` | Check | 是否归档 | ✅ 正常使用 |

**问题**:
- ⚠️ 原生 `customer` 字段在此场景下无意义（Task 才关联客户）
- ⚠️ 命名为 "Project" 但实际是分类，语义混乱

---

#### Partition（分区 → 实际：看板/Board）

| 属性 | 值 |
|------|-----|
| **类型** | 自定义 DocType |
| **实际用途** | UI 层面的视图组织 |
| **记录数量** | ~10-20 |

**关键字段**:

| 字段名 | 类型 | 用途 | 评估 |
|--------|------|------|------|
| `partition_name` | Data | 看板名称 | ✅ 如 "Top Figures" |
| `parent_partition` | Link → Partition | 父级(层级) | ✅ 支持嵌套 |
| `is_workspace` | Check | 是否为工作区 | ✅ 区分层级 |
| `display_type` | Select | 显示类型 | ✅ table/board |
| `visible_columns` | Long Text | 列配置JSON | ✅ 用户定制 |
| `column_config` | Long Text | 列宽配置JSON | ✅ 用户定制 |

**评估**: ✅ 设计合理，职责清晰

---

#### Customer（客户）

| 属性 | 值 |
|------|-----|
| **类型** | ERPNext 原生 + 自定义字段 |
| **实际用途** | 客户信息管理 |
| **记录数量** | ~200+ |

**关键自定义字段**:

| 字段名 | 类型 | 用途 | 评估 |
|--------|------|------|------|
| `custom_referred_by` | Link → Referral Person | 推荐人 | ✅ 正常使用 |
| `custom_associated_companies` | Table → Customer Company Tag | 关联公司 | ✅ 新增，支持多公司 |
| `custom_entity_type` | Select | 实体类型 | ✅ Individual/Company |
| `custom_year_end` | Select | 财年结束月 | ✅ 正常使用 |
| `custom_client_group` | Link → Client Group | 客户组 | ✅ 分组管理 |

**评估**: ✅ 设计合理

---

#### Engagement（业务约定）

| 属性 | 值 |
|------|-----|
| **类型** | 自定义 DocType |
| **实际用途** | 与客户的服务协议 |
| **记录数量** | 使用率较低 |

**关键字段**:

| 字段名 | 类型 | 用途 | 评估 |
|--------|------|------|------|
| `customer` | Link → Customer | 所属客户 | ✅ 必填 |
| `company` | Link → Company | 所属公司 | ✅ TF/TG |
| `project` | Link → Project | 关联项目 | ⚠️ 关系复杂 |
| `service_line` | Link → Service Line | 服务类型 | ⚠️ 与Project重复 |
| `fiscal_year` | Link → Fiscal Year | 财年 | ✅ 必填 |
| `owner_partner` | Link → User | 负责合伙人 | ⚠️ 与Task角色重复 |
| `primary_contact` | Link → Contact | 主要联系人 | ✅ 正常 |
| `engagement_letter` | Attach | 约定书附件 | ✅ 核心功能 |

**问题**:
- 🔴 **定位模糊**: Engagement 与 Task 有大量职责重叠
- 🔴 **使用率低**: 很多 Task 没有关联 Engagement
- ⚠️ `owner_partner` 与 Task 的角色分配重复

---

#### Service Line（服务线）

| 属性 | 值 |
|------|-----|
| **类型** | 自定义 DocType |
| **实际用途** | 服务类型分类 |
| **记录数量** | ~10-20 |

**关键字段**:

| 字段名 | 类型 | 用途 | 评估 |
|--------|------|------|------|
| `code` | Data | 服务代码 | ✅ 唯一标识 |
| `service_name` | Data | 服务名称 | ✅ 如 "Individual Tax Return" |
| `category` | Select | 分类 | ✅ Tax/BAS/Bookkeeping |
| `is_active` | Check | 是否启用 | ✅ 正常 |

**评估**: ✅ 设计合理，职责清晰

---

#### Contact（联系人）

| 属性 | 值 |
|------|-----|
| **类型** | ERPNext 原生 + 自定义字段 |
| **实际用途** | 客户联系人信息 |

**关键自定义字段**:

| 字段名 | 类型 | 用途 | 评估 |
|--------|------|------|------|
| `custom_contact_role` | Select | 联系人角色 | ✅ |
| `custom_social_app` | Table → Contact Social | 社交账号 | ✅ |
| `custom_contact_notes` | Text | 备注 | ✅ |
| `custom_last_contact_date` | Date | 最后联系日期 | ✅ |

**评估**: ✅ 设计合理

> **注意**: Contact 不再有 `custom_referred_by` 字段，推荐人关系只在 Customer 层面维护。

---

#### Referral Person（推荐人）

| 属性 | 值 |
|------|-----|
| **类型** | 自定义 DocType |
| **实际用途** | 客户来源追踪 |

**评估**: ✅ 设计合理，职责清晰

---

### 2.2 子表 DocType

| DocType | 父表 | 用途 | 评估 |
|---------|------|------|------|
| Task Role Assignment | Task | 角色分配 | ✅ |
| Task Software | Task | 使用软件 | ✅ |
| Review Note | Task | 审核备注 | ✅ |
| Task Communication Method | Task | 沟通方式 | ✅ |
| Customer Company Tag | Customer | 关联公司 | ✅ |
| Contact Social | Contact | 社交账号 | ✅ |

---

## 3. Entity Relationships

### 3.1 关系图

```
                                    ┌─────────────────┐
                                    │ Referral Person │
                                    └────────┬────────┘
                                             │ referred_by
                    ┌────────────────────────┴────────────────────────┐
                    ▼                                                 ▼
            ┌───────────┐            ┌───────────┐            ┌─────────────┐
            │  Customer │◄───────────│  Contact  │            │ Engagement  │
            └─────┬─────┘  Dynamic   └───────────┘            └──────┬──────┘
                  │        Link                                      │
                  │                                                  │
    ┌─────────────┼─────────────┬────────────────────────────────────┘
    │             │             │
    │             │             │ customer
    │             │             ▼
    │             │      ┌─────────────┐      ┌──────────────┐
    │             │      │   Project   │◄─────│  Partition   │
    │             │      │  (类别)     │      │   (看板)     │
    │             │      └──────┬──────┘      └──────────────┘
    │             │             │                    ▲
    │             │             │ project            │ parent_partition
    │             │             ▼                    │
    │             │      ┌─────────────┐      ┌──────┴───────┐
    │             └─────►│    Task     │      │  Partition   │
    │   custom_client    │  (工作项目) │      │   (子看板)   │
    │                    └──────┬──────┘      └──────────────┘
    │                           │
    │                           │ custom_roles
    │                           ▼
    │                    ┌─────────────────────┐
    │                    │ Task Role Assignment│
    │                    └──────────┬──────────┘
    │                               │ user
    │                               ▼
    │                         ┌──────────┐
    └─────────────────────────│   User   │
                              └──────────┘
```

### 3.2 关系矩阵

| From → To | Customer | Contact | Task | Project | Partition | Engagement | Service Line |
|-----------|----------|---------|------|---------|-----------|------------|--------------|
| **Customer** | - | Dynamic Link | custom_client | customer | - | customer | - |
| **Contact** | Dynamic Link | - | - | - | - | primary_contact | - |
| **Task** | custom_client | - | parent_task | project | - | custom_engagement | - |
| **Project** | customer | - | - | - | custom_partition | project | custom_service_line |
| **Partition** | - | - | - | - | parent_partition | - | - |
| **Engagement** | customer | contacts | - | project | - | - | service_line |
| **Service Line** | - | - | - | - | - | service_line | - |

### 3.3 关系问题

| 问题 | 严重程度 | 说明 |
|------|---------|------|
| Customer 被多处引用 | 🟡 | Task、Project、Engagement 都引用 Customer，但 Project 的引用无实际意义 |
| Service Line 双重引用 | 🟡 | Project 和 Engagement 都引用 Service Line，可能不一致 |
| Engagement 孤立 | 🔴 | 很多 Task 没有关联 Engagement，数据不完整 |

---

## 4. Semantic Mismatch Analysis

### 4.1 核心语义错位

```
┌─────────────────────────────────────────────────────────────────┐
│                    ERPNext 原生设计意图                          │
├─────────────────────────────────────────────────────────────────┤
│  Project (项目)                                                  │
│    └── Task (任务)                                              │
│          └── Subtask (子任务)                                   │
│                                                                  │
│  一个 Project 是一个完整的项目（有开始、结束、里程碑）           │
│  一个 Task 是项目中的一个小任务                                 │
└─────────────────────────────────────────────────────────────────┘

                              VS

┌─────────────────────────────────────────────────────────────────┐
│                    Smart Accounting 实际使用                     │
├─────────────────────────────────────────────────────────────────┤
│  Partition (看板)                                                │
│    └── Project (项目类别，如 "FY2024 Tax Returns")              │
│          └── Task (工作项目，如 "Client A 的税务申报")          │
│                └── Subtask (子任务)                             │
│                                                                  │
│  一个 Project 只是用来分组的"类别"                              │
│  一个 Task 才是真正的"工作项目"                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 影响分析

| 影响领域 | 严重程度 | 具体表现 |
|---------|---------|---------|
| **代码可读性** | 🟡 | 代码中的 `project` 变量实际指"类别" |
| **新人理解** | 🔴 | 新开发者会困惑于 Task 和 Project 的关系 |
| **业务沟通** | 🟡 | 与老板讨论时需要"翻译" |
| **扩展性** | 🟡 | 如果将来需要真正的"项目"概念，会有冲突 |

### 4.3 Engagement 定位问题

```
当前状态：
┌─────────────────────────────────────────────────────────────────┐
│  Engagement (业务约定)                                           │
│    - customer: 客户                                              │
│    - service_line: 服务类型                                      │
│    - fiscal_year: 财年                                          │
│    - owner_partner: 负责合伙人                                   │
│    - engagement_letter: 约定书                                   │
└─────────────────────────────────────────────────────────────────┘

                              VS

┌─────────────────────────────────────────────────────────────────┐
│  Task (工作项目)                                                 │
│    - custom_client: 客户                                         │
│    - project.custom_service_line: 服务类型                       │
│    - custom_target_month: 目标月份 (隐含财年)                    │
│    - custom_roles[Partner]: 负责合伙人                           │
└─────────────────────────────────────────────────────────────────┘

问题：大量信息重复！
```

**Engagement 的真正价值**:
- ✅ 存储 `engagement_letter`（约定书附件）
- ✅ 作为合同级别的记录
- ❌ 其他字段与 Task 重复

---

## 5. Gap Analysis

### 5.1 当前状态 vs 业务需求

| 业务需求 | 当前实现 | 差距 | 优先级 |
|---------|---------|------|--------|
| 追踪每个客户的工作 | Task + custom_client | ✅ 满足 | - |
| 按年度/服务类型分组 | Project | ✅ 满足 | - |
| 多看板视图 | Partition | ✅ 满足 | - |
| 角色分配 | Task Role Assignment | ✅ 满足 | - |
| 多公司支持 | Customer Company Tag | ✅ 满足 | - |
| 合同/约定书管理 | Engagement | ⚠️ 部分满足 | P2 |
| 统一的项目概念 | 无 | 🔴 语义混乱 | P1 |
| 清晰的数据入口 | 无 | 🔴 多处引用 Customer | P2 |

### 5.2 数据完整性问题

| 问题 | 影响 | 建议 |
|------|------|------|
| Task 缺少 Engagement 关联 | 无法追溯合同 | 要么强制关联，要么重新定义 Engagement 用途 |
| Project.customer 无意义 | 数据冗余 | 考虑移除或重新定义 |
| Service Line 双重定义 | 可能不一致 | 统一到 Project 级别 |

### 5.3 扩展性考虑

| 未来需求 | 当前支持度 | 建议 |
|---------|-----------|------|
| SaaS 多租户 | 🟡 需要改造 | 利用 ERPNext 的 Company 隔离 |
| 更复杂的项目管理 | 🔴 受限于语义错位 | 考虑引入新的 "Engagement" 作为真正的项目 |
| 报表/分析 | 🟡 数据分散 | 需要统一数据入口 |

---

## 6. Recommendations

### 6.1 短期建议（1-2周）

#### R1: 文档化语义映射 ✅ 已完成

在所有文档中明确标注：
```
Task = 工作项目 (Work Item)
Project = 项目类别 (Project Category)
Partition = 看板 (Board)
```

#### R2: 代码注释规范

```python
# 在 index.py 等核心文件顶部添加
"""
SEMANTIC MAPPING:
- Task: Represents a Work Item (actual project for a client)
- Project: Represents a Project Category (grouping of tasks)
- Partition: Represents a Board/Workspace (UI organization)
"""
```

### 6.2 中期建议（1-2月）

#### R3: 重新定义 Engagement

**方案 A**: Engagement 作为"合同容器"
```
Engagement (合同)
  └── engagement_letter: 约定书
  └── terms: 条款
  └── 不再存储 service_line, owner_partner 等
  
Task 通过 custom_engagement 关联合同
```

**方案 B**: 废弃 Engagement，合并到 Customer
```
Customer
  └── engagement_letters: Table → Customer Engagement
      └── fiscal_year
      └── attachment
```

**推荐**: 方案 A，保持 Engagement 但简化其职责

#### R4: 清理 Project.customer

```python
# 移除 Project 对 Customer 的直接引用
# Customer 关系只在 Task 级别维护
```

### 6.3 长期建议（3-6月）

#### R5: 考虑引入 "Job" 概念

如果业务需要真正的"项目"概念（跨越多个 Task 的大型工作）：

```
新架构：
Partition (看板)
  └── Job (真正的项目，新 DocType)
        └── Task (工作项)
              └── Subtask (子任务)

其中 Project 可以：
- 废弃，由 Job 替代
- 或保留为 "模板/类别"
```

#### R6: 统一数据入口

```
Customer (客户)
  ├── contacts: 联系人
  ├── engagements: 合同
  └── jobs/tasks: 工作
  
通过 Customer 作为唯一入口查询所有相关数据
```

### 6.4 优先级矩阵

```
                    影响大
                      │
         R5 Job概念   │   R3 重定义Engagement
              ●       │        ●
                      │
    ──────────────────┼──────────────────── 实施难度
         R1 文档化    │   R4 清理Project
              ●       │        ●
              ✅      │
                      │
                    影响小

优先级排序：
P0: R1 文档化语义映射 ✅
P1: R2 代码注释规范
P2: R3 重定义 Engagement
P2: R4 清理 Project.customer
P3: R5 引入 Job 概念
P3: R6 统一数据入口
```

---

## 附录

### A. 字段完整清单

详见 `smart_accounting_data_architecture.md`

### B. 数据迁移脚本

如需执行 R3/R4 建议，需要准备数据迁移脚本，待确认方案后提供。

### C. 修订历史

| 版本 | 日期 | 修改内容 |
|------|------|---------|
| 1.0 | 2025-12-01 | 初始版本 |

