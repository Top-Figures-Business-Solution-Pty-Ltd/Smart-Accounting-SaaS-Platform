# 📄 Document C: Business Process Flows
# 业务流程文档

**项目**: Smart Accounting  
**版本**: v2.0  
**日期**: 2025-12-09  
**状态**: 🔄 General Workflow (待细化)

---

## 文档目的

> 本文档描述 Smart Accounting 系统的**业务流程**。
> 
> **当前状态**: General Workflow，后续会逐步细化。
> 
> **BPMN 源文件**: 使用 draw.io 绘制，原图附在本文档同目录下。

---

## 目录

1. [参与角色](#1-参与角色)
2. [主流程 - Tax Return Workflow](#2-主流程---tax-return-workflow)
3. [流程节点说明](#3-流程节点说明)
4. [状态映射](#4-状态映射)
5. [待细化内容](#5-待细化内容)

---

## 1. 参与角色

| 泳道 | 角色 | 说明 |
|------|------|------|
| **CLIENT** | 客户 | 签署 EL、审核、签字、付款、确认完成 |
| **USER** | 内部用户 | Preparer/Reviewer/Partner，执行具体工作 |

> **注**: 当前图中没有 SYSTEM 泳道，系统操作隐含在 USER 操作中。
> 后续细化时可以拆分出 SYSTEM 泳道。

---

## 2. 主流程 - Tax Return Workflow

### 2.1 BPMN 流程图

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  CLIENT                                                                                                             │
│                                                                                                                     │
│    ●───►┌─────────┐                              ┌─────────┐      ┌─────────────┐                                  │
│         │ Sign EL │                              │ Review  │──►◇──┤    Sign     │                                  │
│         └────┬────┘                              └────┬────┘   │   └──────┬──────┘                                  │
│              │                                        ▲        │          │                                         │
│              │                                        │        │No        │                                         │
│              │                                        │        ▼          │                                         │
│              │                                        │   ┌─────────┐     │    ┌───────────┐   ┌───────────┐       │
│              │                                        │   │ Send to │     │    │    Pay    │   │  Confirm  │       │
│              │                                        │   │ Rework  │     │    │  Invoice  │   │ Complete  │───►●   │
│              │                                        │   └────┬────┘     │    └─────┬─────┘   └───────────┘       │
│              │                                        │        │          │          │                              │
│              │                                        └────────┘          │          │                              │
│                                                        (Yes)              │          │                              │
├─────────────┼────────────────────────────────────────────────────────────┼──────────┼──────────────────────────────┤
│  USER       │                                                             │          │                              │
│             ▼                                                             │          │                              │
│      ┌───────────┐   ┌───────────┐   ┌───────────┐   ┌───────────┐       │          │                              │
│      │  Create   │──►│  Collect  │──►│   Work    │──►│  Review   │──►◇   │          │                              │
│      │   Task    │   │   Docs    │   │           │   │           │   │   │          │                              │
│      └───────────┘   └───────────┘   └─────▲─────┘   └───────────┘   │   │          │                              │
│                                            │                          │   │          │                              │
│                                            │    ┌───────────┐        │No │          │                              │
│                                            │    │  Review   │◄───────┘   │          │                              │
│                                            └────│ Feedback  │            │          │                              │
│                                                 └───────────┘            │Yes       │                              │
│                                                                          │          │                              │
│                                                                          ▼          │                              │
│                                                                         ⊕           │                              │
│                                                                      ┌──┴──┐        │                              │
│                                                                      │     │        │                              │
│                                                                      ▼     ▼        │                              │
│                                                               ┌─────────┐ ┌─────────┐                              │
│                                                               │ Send for│ │  Send   │                              │
│                                                               │ Signing │ │ Invoice │                              │
│                                                               └────┬────┘ └────┬────┘                              │
│                                                                    │           │                                    │
│                                                                    ▼           ▼                                    │
│                                                               ┌─────────┐ ┌─────────┐                              │
│                                                               │ Review  │ │ Review  │                              │
│                                                               │Signature│ │ Payment │                              │
│                                                               └────┬────┘ └────┬────┘                              │
│                                                                    │           │                                    │
│                                                                    └─────┬─────┘                                    │
│                                                                          │                                          │
│                                                                          ⊕                                          │
│                                                                          │                                          │
│                                                                          ▼                                          │
│                                                                   ┌───────────┐                                    │
│                                                                   │  Lodge    │                                    │
│                                                                   │  to ATO   │                                    │
│                                                                   └───────────┘                                    │
│                                                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

Legend:  ● Start/End   ◇ Exclusive Gateway (XOR)   ⊕ Parallel Gateway (AND)   ──► Flow
```

### 2.2 流程概述

```
CLIENT: Sign EL ─────────────────────► Review ──► Sign ──► Pay Invoice ──► Confirm Complete
                                         ▲         │
                                         │ (Rework)│
                                         └─────────┘

USER:   Create Task ──► Collect Docs ──► Work ──► Review ──► [Send for Signing + Send Invoice] ──► Lodge to ATO
                                          ▲          │
                                          │ (Reject) │
                                          └──────────┘
```

---

## 3. 流程节点说明

### 3.1 CLIENT 节点

| 节点 | 说明 | 触发条件 | 后续操作 |
|------|------|---------|---------|
| **Sign EL** | 签署 Engagement Letter | 流程开始 | 触发 USER 创建 Task |
| **Review** | 客户审核工作成果 | USER 发送审核请求 | 通过→Sign / 不通过→Send to Rework |
| **Send to Rework** | 退回修改 | 客户不满意 | 返回 Review |
| **Sign** | 签字确认 | 审核通过 | 等待 Invoice |
| **Pay Invoice** | 支付账单 | 收到 Invoice | USER Review Payment |
| **Confirm Complete** | 确认完成 | 全部完成 | 流程结束 |

### 3.2 USER 节点

| 节点 | 说明 | 触发条件 | 后续操作 |
|------|------|---------|---------|
| **Create Task** | 创建任务 | 客户签署 EL | Collect Docs |
| **Collect Docs** | 收集客户资料 | Task 创建后 | Work |
| **Work** | 执行工作 | 资料收集完成 | Review |
| **Review** | 内部审核 (Reviewer/Partner) | 工作完成 | 通过→并行 / 不通过→Feedback |
| **Review Feedback** | 处理审核意见 | 审核不通过 | 返回 Work |
| **Send for Signing** | 发送给客户签字 | 审核通过 (并行) | Review Signature |
| **Send Invoice** | 发送账单给客户 | 审核通过 (并行) | Review Payment |
| **Review Signature** | 确认客户签字 | 客户签字后 | 等待汇合 |
| **Review Payment** | 确认客户付款 | 客户付款后 | 等待汇合 |
| **Lodge to ATO** | 提交给 ATO | 签字+付款确认 | 流程结束 |

### 3.3 网关说明

| 网关 | 类型 | 位置 | 说明 |
|------|------|------|------|
| **Review Gateway (USER)** | XOR | Review 后 | Approved → 继续 / Rejected → Feedback |
| **Client Approval Gateway** | XOR | Client Review 后 | Approved → Sign / Not Approved → Rework |
| **Parallel Split** | AND | 审核通过后 | 同时触发 Signing 和 Invoice 流程 |
| **Parallel Join** | AND | Lodge 前 | 等待 Signature 和 Payment 都完成 |

---

## 4. 状态映射

### 4.1 流程节点 → Task Status

| 流程节点 | 对应 Task Status |
|---------|-----------------|
| Create Task | Not Started |
| Collect Docs | Collecting Documents |
| Work | Working |
| Review | Ready for Review |
| Review Feedback | Review Points to be Actioned |
| Send for Signing | Sent for Client Signing |
| Send Invoice | Invoice Sent |
| Review Signature | Waiting for Signature |
| Review Payment | Waiting for Payment |
| Lodge to ATO | Lodged |
| (Complete) | Done |

### 4.2 状态流转图

```
Not Started
    │
    ▼
Collecting Documents
    │
    ▼
Working ◄─────────────────┐
    │                     │
    ▼                     │
Ready for Review          │
    │                     │
    ├──► (Rejected) ──────┘
    │
    ▼ (Approved)
    ┌───────────────┬───────────────┐
    │               │               │
    ▼               ▼               │
Sent for        Invoice Sent        │
Signing             │               │
    │               ▼               │
    │         Waiting for           │
    │          Payment              │
    ▼               │               │
Waiting for         │               │
Signature           │               │
    │               │               │
    └───────┬───────┘               │
            │                       │
            ▼                       │
         Lodged                     │
            │                       │
            ▼                       │
          Done                      │
```

---

## 5. 待细化内容

> 以下内容将在后续版本中逐步添加

### 5.1 TODO: 细化流程

- [ ] **Sign EL 流程**: Engagement Letter 签署的详细步骤
- [ ] **Collect Docs 流程**: 文档收集的具体步骤，文档清单管理
- [ ] **Review 流程**: Reviewer 和 Partner 两级审核的详细流程
- [ ] **Client Review 流程**: 客户审核的详细交互
- [ ] **Invoice 流程**: 账单生成、发送、跟踪的详细步骤
- [ ] **Lodge 流程**: ATO 提交的详细步骤

### 5.2 TODO: 添加其他 Workflow

- [ ] **BAS Workflow**: 商业活动报表流程
- [ ] **Bookkeeping Workflow**: 簿记流程
- [ ] **Grant Workflow**: TG 项目流程
- [ ] **Client Onboarding Workflow**: 新客户入职流程

### 5.3 TODO: 系统操作映射

- [ ] 添加 SYSTEM 泳道
- [ ] 映射每个 USER 操作对应的系统 API
- [ ] 定义自动化触发规则

### 5.4 TODO: 异常流程

- [ ] 任务取消流程
- [ ] 客户退出流程
- [ ] 超时处理流程

---

## 附录

### A. BPMN 源文件

- 原图使用 draw.io 绘制
- 文件位置: `docs/bpmn/tax-return-workflow.drawio`

### B. 相关文档

- `docs/A_Data_Model_Assessment.md` - 数据模型重构规划
- `docs/B_Code_Architecture_Review.md` - 代码架构审查

### C. 修订历史

| 版本 | 日期 | 修改内容 |
|------|------|---------|
| 1.0 | 2025-12-01 | 初始版本 |
| 2.0 | 2025-12-09 | 根据 draw.io BPMN 图更新；简化结构；添加待细化章节 |
