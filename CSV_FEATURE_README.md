# Smart Accounting - CSV导出/导入功能

## 功能概述

本功能为Smart Accounting项目添加了完整的CSV数据导出和导入功能，与ERPNext内置功能集成，支持模块化架构和可扩展设计。

## 功能特点

### 🔧 模块化设计
- 独立的CSV管理器模块 (`csv-manager.js`)
- 分离的导出/导入API (`csv_export.py`, `csv_import.py`)
- 可复用的UI组件和样式

### 📊 智能字段管理
- 基于当前board的字段筛选
- 与`ColumnConfigManager`集成
- 支持字段显示名称映射
- 避免ERPNext原生字段混淆

### 🎨 用户友好界面
- 现代化的对话框设计
- 直观的字段选择器
- 拖拽上传支持
- 实时数据预览

### 🔒 安全性考虑
- 用户权限验证
- 文件类型和大小限制
- 错误处理和日志记录
- 数据验证机制

## 文件结构

```
smart_accounting/
├── public/
│   ├── js/
│   │   └── csv-manager.js          # 前端CSV管理器
│   └── css/
│       └── csv-manager.css         # CSV功能样式
├── api/
│   ├── __init__.py                 # API模块初始化
│   ├── csv_export.py               # CSV导出API
│   ├── csv_import.py               # CSV导入API
│   └── test_csv.py                 # 测试API
└── www/project_management/
    └── index.html                  # 更新的主页面
```

## 使用方法

### 1. 导出数据

1. 在项目管理界面点击"导出CSV"按钮
2. 选择要导出的字段（支持全选/全不选/仅可见列）
3. 配置导出选项：
   - 包含列标题
   - 导出所有数据或仅当前筛选结果
4. 点击"导出CSV"下载文件

### 2. 导入数据

1. 点击"导入CSV"按钮
2. 选择或拖拽CSV文件到上传区域
3. 预览数据内容
4. 选择导入模式：
   - 插入新记录
   - 更新现有记录
5. 配置是否跳过错误行
6. 点击"导入数据"执行导入

## 支持的字段

| 字段名 | 显示名称 | 数据库字段 | 类型 |
|--------|----------|------------|------|
| client | Client Name | custom_client_name | 文本 |
| task-name | Task Name | subject | 文本 |
| entity | Entity | custom_entity | 文本 |
| tf-tg | TF/TG | custom_tf_tg | 选择 |
| software | Software | custom_software | 文本 |
| status | Status | status | 选择 |
| target-month | Target Month | custom_target_month | 日期 |
| budget | Budget | custom_budget | 货币 |
| actual | Actual | custom_actual | 货币 |
| ... | ... | ... | ... |

## API端点

### 导出API
- **端点**: `/api/method/smart_accounting.api.csv_export.export_board_data`
- **方法**: POST
- **参数**:
  - `board_view`: 当前board视图
  - `selected_fields`: 选中的字段列表
  - `include_headers`: 是否包含标题
  - `export_all_data`: 是否导出所有数据

### 导入API
- **端点**: `/api/method/smart_accounting.api.csv_import.import_board_data`
- **方法**: POST (multipart/form-data)
- **参数**:
  - `file`: CSV文件
  - `board_view`: 目标board视图
  - `import_mode`: 导入模式 (insert/update)
  - `skip_errors`: 是否跳过错误

### 测试API
- **字段映射测试**: `/api/method/smart_accounting.api.test_csv.test_field_mapping`
- **导出功能测试**: `/api/method/smart_accounting.api.test_csv.test_csv_export`
- **可用字段查询**: `/api/method/smart_accounting.api.test_csv.get_available_fields`

## 技术实现

### 前端架构
- **CSVManager类**: 核心管理器，处理UI交互和API调用
- **模块化对话框**: 可复用的导出/导入对话框组件
- **事件驱动**: 基于jQuery的事件绑定和处理
- **状态管理**: 维护当前视图和字段配置状态

### 后端架构
- **数据层**: 基于Frappe ORM的数据查询和操作
- **业务层**: 字段映射、数据验证、格式转换
- **API层**: RESTful接口，支持JSON和文件上传
- **日志层**: 完整的操作日志和错误追踪

### 数据流程

#### 导出流程
1. 前端收集用户选择的字段和选项
2. 调用导出API传递参数
3. 后端查询数据库获取Task记录
4. 应用字段映射和数据格式化
5. 生成CSV内容并保存为文件
6. 返回文件URL供前端下载

#### 导入流程
1. 前端上传CSV文件到后端
2. 后端解析CSV内容并验证格式
3. 应用字段映射转换为Task数据格式
4. 根据导入模式创建或更新记录
5. 返回导入结果统计和错误信息
6. 前端显示结果并可选择刷新页面

## 扩展性设计

### 字段扩展
- 在`get_field_mapping()`中添加新的字段映射
- 在`get_field_labels()`中添加显示标签
- 在格式化函数中添加特殊字段处理逻辑

### Board类型扩展
- 支持未来的"Board Display Type"功能
- 可根据不同board类型过滤可用字段
- 支持board特定的导入/导出逻辑

### UI扩展
- 模块化的对话框组件可复用于其他功能
- CSS类名遵循BEM命名规范，便于维护
- 响应式设计支持移动设备

## 安全考虑

### 权限控制
- 导出需要Task的读取权限
- 导入需要Task的创建权限
- API调用需要用户登录

### 数据验证
- 文件类型限制为CSV
- 文件大小限制为5MB
- CSV格式验证和错误处理
- 字段值格式验证

### 错误处理
- 完整的异常捕获和日志记录
- 用户友好的错误信息显示
- 可选的错误跳过机制

## 性能优化

### 前端优化
- 延迟加载大型对话框内容
- 文件预览限制为前几行数据
- 异步API调用避免界面阻塞

### 后端优化
- 分页查询避免内存溢出
- 批量操作提高导入效率
- 临时文件清理机制

## 故障排除

### 常见问题

1. **CSV功能按钮不显示**
   - 检查`csv-manager.js`是否正确加载
   - 确认`CSVManager`全局对象是否存在
   - 查看浏览器控制台错误信息

2. **导出失败**
   - 检查用户是否有Task读取权限
   - 确认API端点是否可访问
   - 查看服务器日志中的错误信息

3. **导入失败**
   - 验证CSV文件格式是否正确
   - 检查字段名是否匹配
   - 确认用户是否有Task创建权限

### 调试工具

使用测试API进行功能验证：
```javascript
// 在浏览器控制台中执行
frappe.call({
    method: 'smart_accounting.api.test_csv.test_field_mapping',
    callback: (r) => console.log(r.message)
});
```

## 未来改进

### 计划功能
- [ ] 支持Excel格式导入/导出
- [ ] 批量操作进度显示
- [ ] 导入模板下载功能
- [ ] 字段映射配置界面
- [ ] 导入历史记录查看

### 性能改进
- [ ] 大文件分块上传
- [ ] 后台任务处理大批量导入
- [ ] 缓存机制优化重复查询

## 维护说明

### 代码维护
- 遵循现有的代码风格和命名规范
- 保持模块化架构，避免紧耦合
- 及时更新文档和注释

### 数据库维护
- 定期清理临时导出文件
- 监控导入/导出操作日志
- 备份重要的配置数据

---

**开发者**: Smart Accounting Team  
**版本**: 1.0.0  
**最后更新**: 2025-10-20
