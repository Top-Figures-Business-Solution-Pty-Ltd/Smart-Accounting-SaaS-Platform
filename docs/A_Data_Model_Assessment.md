# 📄 Document A: Data Model - Refactoring Plan
# 数据模型 - 重构规划文档

**项目**: Smart Accounting  
**版本**: v2.2  
**日期**: 2025-12-08  
**状态**: 🔄 重构规划中 (Prototype 阶段)  

---

## 文档目的

> **本文档记录数据模型重构的思路、分析和决策方向。**
> 
> 当前阶段：积攒思路，确定大方向

---

## 1. 重构背景

### 1.1 当前问题

| 问题 | 影响 |
|------|------|
| Engagement 与 Task 职责重叠 | 数据冗余，定位模糊 |
| Project 语义错位 | 实际是"分组"而非"项目" |
| Service Line 冗余 | 可以用字段替代 |
| Partition 功能受限 | 视图配置不够灵活 |
| 不适应双公司业务 | TF（会计）和 TG（Grants）需求不同 |

### 1.2 当前结构

```
Partition (看板)
    └── Project (实际是分组/Category)
          └── Task (实际是工作项目/Job)
                └── Subtask

Engagement ← 与 Task 重叠，定位不清
Service Line ← 被 Project 和 Engagement 双重引用
```

---

## 2. 新架构设计

### 2.1 核心思路

**将 Engagement 和 Project 作为同级别的业务单元：**

- **Engagement** → 用于 **TF（会计事务所）** 的客户约定
- **Project** → 用于 **TG（Grants）** 的项目管理
- **Task** → 回归 ERPNext 原生含义，作为具体任务
- **Saved View** → 替代 Partition，提供灵活的视图配置

### 2.2 新结构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        新数据架构                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐         ┌──────────────┐                      │
│  │  Engagement  │         │   Project    │                      │
│  │    (TF)      │         │    (TG)      │                      │
│  │              │         │              │                      │
│  │  - customer  │         │  - customer  │                      │
│  │  - type      │         │  - type      │                      │
│  │  - partner   │         │  - partner   │                      │
│  │  - budget    │         │  - budget    │                      │
│  └──────┬───────┘         └──────┬───────┘                      │
│         │                        │                              │
│         │    ┌───────────────────┘                              │
│         │    │                                                  │
│         ▼    ▼                                                  │
│  ┌─────────────────────────┐                                    │
│  │         Task            │  (ERPNext 原生任务)                 │
│  │  - subject              │                                    │
│  │  - status               │                                    │
│  │  - preparer/reviewer    │                                    │
│  └─────────────────────────┘                                    │
│                                                                  │
│  ┌─────────────────────────┐                                    │
│  │      Saved View         │  (替代 Partition)                   │
│  │  - 视图配置             │                                    │
│  │  - 列显示/排序          │                                    │
│  │  - 筛选条件             │                                    │
│  └─────────────────────────┘                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 与当前结构对比

| 概念 | 当前 | 新架构 |
|------|------|--------|
| 看板/视图 | Partition | **Saved View** (更灵活) |
| 分组 | Project | ❌ 删除这个用法 |
| TF 业务 | Task (误用) | **Engagement** |
| TG 项目 | 无 | **Project** |
| 具体任务 | Subtask | **Task** (原生) |
| 服务类型 | Service Line | ❌ 删除，用 type 字段替代 |

---

## 3. 视图配置系统设计

### 3.1 设计思路

> **核心理念**: Sensible Defaults + User Customization
> 
> - 每个 Engagement Type 有一个**系统默认 View**（专业、合理、不可删除）
> - 用户可以**自定义 View**（在默认基础上修改、保存）
> - SaaS 模式下，新租户默认就有专业的预设 View

### 3.2 View 配置层级

```
┌─────────────────────────────────────────────────────────────────┐
│                      View 配置层级                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1️⃣ 系统默认 View (System Default)                              │
│     ├── ITR Default View           ← 不可删除                   │
│     ├── BAS Default View           ← 不可删除                   │
│     ├── Company Tax Default View   ← 不可删除                   │
│     └── ...每个 Type 一个默认 View                               │
│                                                                  │
│  2️⃣ 租户自定义 View (Tenant Custom) ← SaaS 时管理员创建         │
│     ├── "Our ITR Process"          ← 可删除，租户内共享          │
│     └── ...                                                     │
│                                                                  │
│  3️⃣ 用户个人 View (User Personal)                               │
│     ├── "Alice's Quick View"       ← 可删除，仅自己可见          │
│     └── ...                                                     │
│                                                                  │
│  优先级: 用户个人 > 租户自定义 > 系统默认                         │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Saved View DocType 设计（概念）

```
Saved View:
  - name: 唯一标识
  - title: 显示名称
  - view_type: [system / tenant / personal]
  - owner: 创建者 (personal view)
  - company: 所属公司 (租户隔离)
  
  - engagement_type: 关联的 Engagement Type
  - filters: 筛选条件 (JSON)
  - visible_columns: 可见列 (JSON)
  - column_order: 列顺序 (JSON)
  - column_widths: 列宽 (JSON)
  - sort_by: 排序字段
  
  - is_default: 是否为该 Type 的默认视图
  - is_deletable: 是否可删除 (系统默认 = false)
```

### 3.4 与 Partition 的对比

| 方面 | Partition (当前) | Saved View (新) |
|------|-----------------|-----------------|
| 配置粒度 | 按看板 | 按 Type + 用户 |
| 共享方式 | 所有人同一配置 | 支持个人/租户/系统三级 |
| 灵活性 | 低 | 高 |
| SaaS 友好 | ❌ | ✅ |
| 用户自定义 | ❌ | ✅ |

### 3.5 用户体验流程

```
1. 用户进入 Engagement 列表
        ↓
2. 选择 Type 筛选（如 "ITR"）
        ↓
3. 自动加载 ITR 的默认 View（或用户保存的 View）
        ↓
4. 用户可以调整：列显示/隐藏、顺序、宽度、筛选条件
        ↓
5. 点击 "Save View" → 保存为个人视图
        ↓
6. 下次进入自动加载用户的视图
```

---

## 4. DocType 字段设计

### 4.1 Engagement（TF 业务约定）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | Data | ✅ | 约定编号 |
| `title` | Data | ✅ | 约定标题 |
| `customer` | Link → Customer | ✅ | 所属客户 |
| `company` | Link → Company | ✅ | TF 公司 |
| `type` | Select | ✅ | 服务类型 (替代 Service Line) |
| `fiscal_year` | Data | | 财年 |
| `target_month` | Select | | 目标月份 |
| `partner` | Link → User | | 负责合伙人 |
| `budget` | Currency | | 预算金额 |
| `actual_billing` | Currency | | 实际账单 |
| `engagement_letter` | Attach | | 约定书附件 |
| `status` | Select | ✅ | 状态 |

### 4.2 Project（TG 项目）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | Data | ✅ | 项目编号 |
| `project_name` | Data | ✅ | 项目名称 |
| `customer` | Link → Customer | ✅ | 所属客户 |
| `company` | Link → Company | ✅ | TG 公司 |
| `type` | Select | ✅ | 项目类型 |
| `start_date` | Date | | 开始日期 |
| `end_date` | Date | | 结束日期 |
| `partner` | Link → User | | 负责合伙人 |
| `budget` | Currency | | 预算金额 |
| `status` | Select | ✅ | 状态 |

### 4.3 Task（原生任务）

| 字段 | 类型 | 说明 |
|------|------|------|
| `subject` | Data | 任务名称 |
| `project` | Link → Project | 所属项目 (TG) |
| `custom_engagement` | Link → Engagement | 所属约定 (TF) |
| `status` | Select | 任务状态 (原生) |
| `custom_preparer` | Link → User | 准备人 |
| `custom_reviewer` | Link → User | 审核人 |
| `custom_review_notes` | Table | 审核备注 |
| `parent_task` | Link → Task | 父任务 (支持子任务) |

---

## 5. 删除的 DocType

| DocType | 原因 | 替代方案 |
|---------|------|---------|
| **Service Line** | 冗余 | 用 `type` 字段替代 |
| **Partition** | 不够灵活 | 用 **Saved View** 替代 |
| **Task Role Assignment** | 过度设计 | 简化为 Task 上的字段 |

---

## 6. Engagement Type 分类（待定）

> 需要确定会计事务所实际使用的服务类型分类

### 参考分类

**税务类 (Tax)**
- Individual Tax Return (ITR)
- Company Tax Return
- Trust Tax Return
- SMSF Tax Return

**合规类 (Compliance)**
- BAS
- FBT
- Payroll Tax

**簿记类 (Bookkeeping)**
- Monthly/Quarterly/Year-end Bookkeeping

**咨询类 (Advisory)**
- Tax Planning
- Business Structuring

> 每个 Type 都会有一个系统默认 View，配置该类型最常用的字段

---

## 7. 新关系图

```
┌─────────────────┐
│ Referral Person │
└────────┬────────┘
         │
         ▼
┌───────────┐         ┌───────────┐
│  Customer │◄────────│  Contact  │
└─────┬─────┘         └───────────┘
      │
      │ customer
      ├─────────────────────────────────┐
      │                                 │
      ▼                                 ▼
┌─────────────┐                  ┌─────────────┐
│ Engagement  │                  │   Project   │
│   (TF)      │                  │    (TG)     │
└──────┬──────┘                  └──────┬──────┘
       │                                │
       │ engagement / project           │
       └───────────────┬────────────────┘
                       │
                       ▼
                ┌─────────────┐
                │    Task     │
                └──────┬──────┘
                       │ parent_task
                       ▼
                ┌─────────────┐
                │   Subtask   │
                └─────────────┘


┌─────────────────────────────────────────┐
│             Saved View                   │
│  (独立的视图配置，不是数据层级)           │
│  - 按 Type 提供默认配置                  │
│  - 用户可保存个人视图                    │
└─────────────────────────────────────────┘
```

---

## 8. 待确认问题

### 8.1 角色分配方案

| 方案 | 说明 |
|------|------|
| **方案 B (倾向)** | Partner 在 Engagement/Project，Preparer/Reviewer 在 Task |

### 8.2 状态管理

```
Engagement/Project 状态:
- Not Started → In Progress → Under Review → Completed

Task 状态 (ERPNext 原生):
- Open → Working → Pending Review → Completed
```

### 8.3 Type 分类

> 待确定实际使用的 Engagement Type 列表

---

## 9. 实施步骤（草案）

### Phase 1: DocType 设计
1. [ ] 确定 Engagement Type 分类
2. [ ] 设计 Saved View DocType
3. [ ] 重新设计 Engagement/Project 字段

### Phase 2: 默认 View 配置
1. [ ] 为每个 Type 设计默认 View
2. [ ] 实现 View 保存/加载机制

### Phase 3: 数据迁移
1. [ ] Task → Engagement 迁移
2. [ ] Partition → Saved View 迁移

### Phase 4: 前端改造
1. [ ] 实现 View 选择器
2. [ ] 实现 View 编辑/保存功能

---

## 附录

### A. 修订历史

| 版本 | 日期 | 修改内容 |
|------|------|---------|
| 1.0 | 2025-12-01 | 初始版本（评估导向）|
| 2.0 | 2025-12-08 | 改为重构参考文档 |
| 2.1 | 2025-12-08 | Engagement/Project 同级设计 |
| 2.2 | 2025-12-08 | 删除 Partition，新增 Saved View 设计；视图配置系统设计 |
