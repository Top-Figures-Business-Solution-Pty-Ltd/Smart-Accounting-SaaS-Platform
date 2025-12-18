# Smart Accounting v2.0

**Monday.com-style Project Management SaaS for Accounting Firms**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Frappe](https://img.shields.io/badge/Frappe-Framework-blue.svg)](https://frappeframework.com/)
[![ERPNext](https://img.shields.io/badge/ERPNext-Compatible-green.svg)](https://erpnext.com/)

---

## 🎯 项目概述

Smart Accounting 是一个专为会计事务所设计的 SaaS 项目管理平台，提供类似 Monday.com 的现代化用户体验。

### 核心特性

- 📊 **多业务类型支持**: ITR, BAS, Payroll, Bookkeeping, Grants 等
- 👥 **团队协作**: Preparer, Reviewer, Partner 角色分配
- 📅 **截止日期管理**: 法定截止日期 + 内部目标日期
- 🎨 **Monday.com 风格界面**: 表格视图、看板视图、筛选器
- 🔐 **多租户隔离**: Frappe 原生多 Site 架构
- 🛠️ **高度可配置**: Status、Software、Project Type 用户自定义

---

## 🏗️ 技术架构

### 架构策略

- ✅ **最大化利用 ERPNext 原生 DocType**
- ✅ **通过 Custom Fields 扩展原生 DocType**
- ✅ **Property Setter 配置 Select 选项**
- ✅ **多 Site 架构实现租户隔离**

### 核心 DocType

| DocType | 类型 | 说明 |
|---------|------|------|
| **Project** | ERPNext 原生 + 扩展 | 统一承载所有业务（会计 + Grants）|
| **Task** | ERPNext 原生 + 扩展 | 任务/子任务 |
| **Customer** | ERPNext 原生 + 扩展 | 客户信息 |
| **Contact** | ERPNext 原生 + 扩展 | 联系人/推荐人 |
| **Project Type** | ERPNext 原生 + 扩展 | 业务类型（ITR/BAS/Payroll...）|
| **Software** | 新建 | 软件列表（Xero/MYOB/QuickBooks...）|
| **Saved View** | 新建 | 用户自定义视图配置 |

---

## 📚 文档

### 设计文档

- **Document A**: [数据模型设计](docs/A_Data_Model_Assessment.md) - v6.0
- **Document D**: [UI 设计](docs/D_UI_Design.md)
- **Document E**: [实施教程](docs/E_Implementation_Tutorial.md) - v2.0

### 快速开始

1. **安装**: 按照 Frappe 标准安装流程
2. **配置**: 按照 Document E 通过 UI 配置所有 DocType
3. **使用**: 开始创建 Project 和 Task

---

## 🚀 版本历史

### v2.0 (2025-12-16) - Clean Slate 重构

**重大变更**：
- 🔄 完全重构架构，采用 ERPNext 原生 DocType
- ❌ 删除所有自定义 DocType（Engagement, Partition, User Preferences 等）
- ✅ 最小化新建 DocType（仅 Software 和 Saved View）
- ✅ 通过 UI 配置替代代码实现
- ✅ 多 Site 架构实现租户隔离

**数据模型**：
- Project: 6 个扩展字段
- Task: 4 个扩展字段  
- Customer: 3 个扩展字段
- Contact: 3 个扩展字段
- Project Type: 2 个扩展字段

### v1.0 (2024-2025) - 已废弃

初始版本，使用自定义 DocType 架构（已完全删除）

---

## 📄 License

MIT License - Top Figures Pty Ltd

---

## 👥 团队

**开发**: Top Figures Pty Ltd  
**联系**: Jeffrey@topfigures.com.au

---

## 🔗 相关链接

- [Frappe Framework](https://frappeframework.com/)
- [ERPNext](https://erpnext.com/)
- [Monday.com](https://monday.com/) (UI 参考)
