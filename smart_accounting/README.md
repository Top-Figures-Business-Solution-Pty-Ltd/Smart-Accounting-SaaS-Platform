# Smart Accounting v2.0 - Clean Slate Architecture

**重构日期**: 2025-12-16  
**基于**: Document A v6.0, Document E v2.0  
**架构**: Frappe 原生多 Site 架构

---

## 📁 目录结构

```
smart_accounting/
├── __init__.py                 # App 初始化
├── hooks.py                    # Frappe hooks 配置
├── modules.txt                 # 模块列表
├── patches.txt                 # 数据迁移脚本列表
│
├── smart_accounting/           # 主模块
│   ├── doctype/               # 自定义 DocType (Software, Saved View)
│   │   ├── software/
│   │   └── saved_view/
│   └── __init__.py
│
├── api/                        # API 接口
│   └── __init__.py
│
├── utils/                      # 工具函数
│   └── __init__.py
│
├── setup/                      # 安装脚本
│   └── __init__.py
│
└── public/                     # 前端资源
    ├── css/                    # 样式文件
    └── js/                     # JavaScript 文件
```

---

## 🎯 实施计划

### Phase 1: 基础 DocType 扩展（通过 UI）
按照 `docs/E_Implementation_Tutorial.md` 执行：

1. **Customer 扩展** (3个字段)
   - custom_referred_by
   - custom_entity_type
   - custom_year_end

2. **Contact 扩展** (3个字段)
   - custom_is_referrer
   - custom_contact_role
   - custom_social_accounts

### Phase 2: 创建 Software DocType（通过 UI）
- software_name
- companies
- is_global
- is_active

### Phase 3: 扩展 Project Type（通过 UI）
- custom_companies
- custom_is_global

### Phase 4: Project 扩展（通过 UI）
6个扩展字段：
- custom_team
- custom_team_members
- custom_target_month
- custom_lodgement_due_date
- custom_frequency
- custom_softwares

### Phase 5: Task 扩展（通过 UI）
4个扩展字段：
- custom_assigned_to
- custom_due_date
- custom_notes
- custom_priority

### Phase 6: 创建 Saved View DocType（通过 UI）
13个字段（详见 docE）

### Phase 7: 配置 Select 选项（通过 UI）
- Project.status
- Task.status
- 其他 Select 字段

---

## 📚 相关文档

- `docs/A_Data_Model_Assessment.md` - 数据模型设计
- `docs/D_UI_Design.md` - UI 设计
- `docs/E_Implementation_Tutorial.md` - 实施教程

---

## ⚠️ 注意事项

1. **所有 DocType 字段配置通过 UI 完成**，不写代码
2. **project_type 是 ERPNext 原生字段**，不要添加 custom_project_type
3. **多 Site 架构**：每个租户一个独立 Site
4. **Status 配置**：通过 Customize Form 的 Property Setter

---

## 🔄 版本历史

- **v1.0** (2024-2025): 初始版本（已废弃）
- **v2.0** (2025-12-16): Clean Slate 重构

