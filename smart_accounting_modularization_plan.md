# Smart Accounting 模块化重构方案

## 📋 目录

1. [当前问题分析](#1-当前问题分析)
2. [目标架构设计](#2-目标架构设计)
3. [重构阶段规划](#3-重构阶段规划)
4. [具体实施步骤](#4-具体实施步骤)
5. [风险控制](#5-风险控制)

---

## 1. 当前问题分析

### 1.1 代码统计

| 类别 | 当前状态 | 问题 |
|------|---------|------|
| JS总行数 | 34,448行 | 分布在40+文件中 |
| 全局变量 | 20+ Managers | 全部挂在window上 |
| 最大文件 | combination-view.js (2325行) | 应拆分 |
| 依赖管理 | script标签顺序 | 无模块系统 |

### 1.2 核心问题

```
❌ 全局变量污染 (window.XXXManager)
❌ 没有ES6模块系统
❌ 文件职责不清晰
❌ 组件间直接调用，高度耦合
❌ 没有统一的状态管理
❌ 没有事件总线
```

---

## 2. 目标架构设计

### 2.1 新目录结构

```
smart_accounting/public/js/
├── core/                          # 核心框架
│   ├── app.js                     # 应用入口
│   ├── event-bus.js               # 事件总线
│   ├── state-manager.js           # 状态管理
│   └── api-client.js              # API封装
│
├── modules/                       # 业务模块（按功能域划分）
│   ├── task/                      # 任务模块
│   │   ├── index.js               # 模块入口
│   │   ├── TaskManager.js         # 任务管理器
│   │   ├── TaskEditor.js          # 任务编辑
│   │   ├── TaskList.js            # 任务列表
│   │   └── TaskStatus.js          # 状态管理
│   │
│   ├── subtask/                   # 子任务模块
│   │   ├── index.js
│   │   ├── SubtaskManager.js
│   │   └── SubtaskPanel.js
│   │
│   ├── client/                    # 客户模块
│   │   ├── index.js
│   │   ├── ClientManager.js
│   │   ├── ClientSelector.js
│   │   └── ClientContactSelector.js
│   │
│   ├── project/                   # 项目类别模块
│   │   ├── index.js
│   │   ├── ProjectManager.js
│   │   └── ProjectForm.js
│   │
│   ├── engagement/                # 业务约定模块
│   │   ├── index.js
│   │   ├── EngagementManager.js
│   │   └── EngagementModal.js
│   │
│   ├── workspace/                 # 工作区模块
│   │   ├── index.js
│   │   ├── WorkspaceManager.js
│   │   ├── PartitionManager.js
│   │   └── BoardSwitcher.js
│   │
│   ├── person/                    # 人员分配模块
│   │   ├── index.js
│   │   ├── PersonSelector.js
│   │   └── RoleAssignment.js
│   │
│   ├── software/                  # 软件选择模块
│   │   ├── index.js
│   │   └── SoftwareSelector.js
│   │
│   └── combination/               # 组合视图模块
│       ├── index.js
│       ├── CombinationManager.js
│       ├── CombinationRenderer.js
│       └── CombinationConfig.js
│
├── ui/                            # UI组件（通用、可复用）
│   ├── components/                # 基础组件
│   │   ├── Modal.js               # 模态框
│   │   ├── Dropdown.js            # 下拉菜单
│   │   ├── Table.js               # 表格
│   │   ├── Tooltip.js             # 提示框
│   │   ├── Badge.js               # 标签
│   │   └── Button.js              # 按钮
│   │
│   ├── editors/                   # 编辑器组件
│   │   ├── BaseEditor.js          # 编辑器基类
│   │   ├── TextEditor.js          # 文本编辑
│   │   ├── SelectEditor.js        # 下拉选择
│   │   ├── DateEditor.js          # 日期编辑
│   │   ├── StatusEditor.js        # 状态编辑
│   │   └── CurrencyEditor.js      # 货币编辑
│   │
│   ├── filters/                   # 筛选组件
│   │   ├── FilterManager.js
│   │   ├── AdvancedFilter.js
│   │   └── QuickFilter.js
│   │
│   └── layout/                    # 布局组件
│       ├── Navbar.js
│       ├── Sidebar.js
│       └── MainContent.js
│
├── services/                      # 服务层
│   ├── api/                       # API服务
│   │   ├── index.js               # API统一入口
│   │   ├── task-api.js
│   │   ├── client-api.js
│   │   ├── project-api.js
│   │   └── ...
│   │
│   ├── storage.js                 # 本地存储服务
│   ├── notification.js            # 通知服务
│   └── permission.js              # 权限服务
│
├── utils/                         # 工具函数
│   ├── dom.js                     # DOM操作
│   ├── date.js                    # 日期处理
│   ├── format.js                  # 格式化
│   ├── validation.js              # 验证
│   └── helpers.js                 # 通用帮助函数
│
├── config/                        # 配置
│   ├── app-config.js              # 应用配置
│   ├── column-config.js           # 列配置
│   └── constants.js               # 常量定义
│
└── legacy/                        # 遗留代码（过渡期）
    └── ...                        # 旧代码暂存
```

### 2.2 核心设计原则

#### 事件总线 (Event Bus)

```javascript
// core/event-bus.js
class EventBus {
    constructor() {
        this.events = new Map();
    }
    
    on(event, callback) {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        this.events.get(event).push(callback);
        return () => this.off(event, callback); // 返回取消订阅函数
    }
    
    off(event, callback) {
        const callbacks = this.events.get(event);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index > -1) callbacks.splice(index, 1);
        }
    }
    
    emit(event, data) {
        const callbacks = this.events.get(event);
        if (callbacks) {
            callbacks.forEach(cb => cb(data));
        }
    }
}

export default new EventBus();
```

#### 模块注册系统

```javascript
// core/app.js
class App {
    constructor() {
        this.modules = new Map();
        this.eventBus = EventBus;
    }
    
    // 注册模块
    registerModule(name, module) {
        this.modules.set(name, module);
        if (module.init) {
            module.init(this);
        }
    }
    
    // 获取模块
    getModule(name) {
        return this.modules.get(name);
    }
    
    // 启动应用
    async start() {
        // 按依赖顺序初始化模块
        for (const [name, module] of this.modules) {
            if (module.start) {
                await module.start();
            }
        }
        this.eventBus.emit('app:ready');
    }
}

export default new App();
```

#### 模块定义规范

```javascript
// modules/task/index.js
import TaskManager from './TaskManager.js';
import TaskEditor from './TaskEditor.js';
import TaskList from './TaskList.js';

export default {
    name: 'task',
    
    // 依赖的其他模块
    dependencies: ['client', 'person'],
    
    // 模块初始化
    init(app) {
        this.app = app;
        this.eventBus = app.eventBus;
        
        this.manager = new TaskManager(this);
        this.editor = new TaskEditor(this);
        this.list = new TaskList(this);
    },
    
    // 模块启动
    async start() {
        await this.manager.loadInitialData();
        this.bindEvents();
    },
    
    // 绑定事件
    bindEvents() {
        this.eventBus.on('client:selected', (client) => {
            this.list.filterByClient(client);
        });
    },
    
    // 对外暴露的API
    api: {
        getTasks: () => this.manager.getTasks(),
        createTask: (data) => this.manager.create(data),
        updateTask: (id, data) => this.manager.update(id, data),
    }
};
```

---

## 3. 重构阶段规划

### 阶段概览

```
Phase 1 (基础设施)     →  Phase 2 (核心模块)    →  Phase 3 (UI组件)     →  Phase 4 (清理)
    2周                       3周                      2周                    1周
    
├─ 事件总线              ├─ Task模块              ├─ 编辑器组件          ├─ 删除遗留代码
├─ 状态管理              ├─ Client模块            ├─ 筛选组件            ├─ 性能优化
├─ API封装               ├─ Project模块           ├─ 表格组件            ├─ 文档完善
└─ 模块加载器            └─ Workspace模块         └─ 模态框组件          └─ 测试补充
```

### Phase 1: 基础设施搭建 (2周)

**目标**: 建立模块化基础框架，不影响现有功能

| 任务 | 优先级 | 工时 | 说明 |
|------|--------|------|------|
| 创建目录结构 | P0 | 1天 | 创建新的目录结构 |
| 实现EventBus | P0 | 1天 | 组件间通信基础 |
| 实现App核心 | P0 | 2天 | 模块注册和生命周期 |
| API Client封装 | P0 | 2天 | 统一API调用 |
| 状态管理器 | P1 | 2天 | 简单的状态管理 |
| 兼容层 | P0 | 2天 | 让新旧代码共存 |

**兼容层设计** (关键！):

```javascript
// core/compat.js - 兼容层，让新旧代码共存
import App from './app.js';
import EventBus from './event-bus.js';

// 保持旧的全局变量可用，但内部使用新架构
window.SA = {
    app: App,
    eventBus: EventBus,
    
    // 兼容旧代码的方法
    getManager(name) {
        // 先查新模块
        const module = App.getModule(name.replace('Manager', '').toLowerCase());
        if (module) return module;
        
        // 回退到旧的全局变量
        return window[name];
    }
};

// 保持旧的window.XXXManager可用
// 在Phase 4之前不删除
```

### Phase 2: 核心业务模块迁移 (3周)

**目标**: 将核心业务逻辑迁移到新模块系统

| 周 | 模块 | 来源文件 | 说明 |
|----|------|---------|------|
| Week 1 | task | subtask.js, editors.js(部分) | 最核心的模块 |
| Week 1 | client | client-selector.js, client-contact-selector.js | 客户相关 |
| Week 2 | project | project.js | 项目类别 |
| Week 2 | workspace | workspace.js | 工作区切换 |
| Week 3 | person | person-selector.js | 人员分配 |
| Week 3 | combination | combination-view.js | 组合视图(最复杂) |

**迁移策略**:

```javascript
// 示例：迁移 subtask.js 到 modules/subtask/

// 1. 创建新模块
// modules/subtask/SubtaskManager.js
export class SubtaskManager {
    constructor(module) {
        this.module = module;
        this.eventBus = module.eventBus;
    }
    
    async loadSubtaskCounts() {
        // 从旧代码复制逻辑
    }
    
    updateSubtaskIndicator(taskId, count) {
        // 从旧代码复制逻辑
    }
}

// 2. 创建模块入口
// modules/subtask/index.js
import { SubtaskManager } from './SubtaskManager.js';

export default {
    name: 'subtask',
    dependencies: ['task'],
    
    init(app) {
        this.manager = new SubtaskManager(this);
    }
};

// 3. 保持向后兼容
// 在旧的 subtask.js 末尾添加:
import SubtaskModule from './modules/subtask/index.js';
SA.app.registerModule('subtask', SubtaskModule);

// 保持旧的全局变量
window.SubtaskManager = SA.app.getModule('subtask').manager;
```

### Phase 3: UI组件抽象 (2周)

**目标**: 将可复用的UI组件抽象出来

| 组件 | 来源 | 说明 |
|------|------|------|
| Modal | ui/modal.js | 统一模态框 |
| Table | ui/table.js | 表格渲染 |
| BaseEditor | editors.js | 编辑器基类 |
| TextEditor | editors.js | 文本编辑 |
| SelectEditor | editors.js | 下拉选择 |
| DateEditor | editors.js | 日期选择 |
| StatusEditor | editors.js | 状态编辑 |
| FilterManager | ui/filters.js | 筛选管理 |

**编辑器重构示例**:

```javascript
// ui/editors/BaseEditor.js
export class BaseEditor {
    constructor(options) {
        this.element = options.element;
        this.field = options.field;
        this.value = options.value;
        this.onSave = options.onSave;
    }
    
    show() { /* 子类实现 */ }
    hide() { /* 子类实现 */ }
    getValue() { /* 子类实现 */ }
    validate() { return true; }
    
    async save() {
        if (!this.validate()) return false;
        const value = this.getValue();
        await this.onSave(this.field, value);
        this.hide();
        return true;
    }
}

// ui/editors/StatusEditor.js
import { BaseEditor } from './BaseEditor.js';

export class StatusEditor extends BaseEditor {
    constructor(options) {
        super(options);
        this.statusOptions = options.statusOptions || [];
    }
    
    show() {
        // 渲染状态选择下拉
    }
    
    getValue() {
        return this.selectedStatus;
    }
}
```

### Phase 4: 清理与优化 (1周)

**目标**: 删除遗留代码，优化性能

| 任务 | 说明 |
|------|------|
| 删除legacy目录 | 确认所有功能正常后删除 |
| 删除旧的全局变量 | 移除window.XXXManager |
| Tree Shaking | 移除未使用的代码 |
| 性能测试 | 确保性能不下降 |
| 文档更新 | 更新开发文档 |

---

## 4. 具体实施步骤

### Step 1: 创建基础设施 (Day 1-3)

```bash
# 创建目录结构
mkdir -p smart_accounting/public/js/{core,modules,ui/components,ui/editors,ui/filters,ui/layout,services/api,utils,config,legacy}

# 创建核心文件
touch smart_accounting/public/js/core/{app.js,event-bus.js,state-manager.js,api-client.js,compat.js}
```

### Step 2: 实现EventBus (Day 2)

```javascript
// core/event-bus.js
class EventBus {
    constructor() {
        this.events = new Map();
        this.onceEvents = new Map();
    }
    
    on(event, callback, context = null) {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        this.events.get(event).push({ callback, context });
        
        // 返回取消订阅函数
        return () => this.off(event, callback);
    }
    
    once(event, callback, context = null) {
        const wrapper = (data) => {
            callback.call(context, data);
            this.off(event, wrapper);
        };
        return this.on(event, wrapper, context);
    }
    
    off(event, callback) {
        const listeners = this.events.get(event);
        if (listeners) {
            const index = listeners.findIndex(l => l.callback === callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }
    
    emit(event, data) {
        const listeners = this.events.get(event);
        if (listeners) {
            listeners.forEach(({ callback, context }) => {
                try {
                    callback.call(context, data);
                } catch (error) {
                    console.error(`EventBus error in ${event}:`, error);
                }
            });
        }
    }
    
    // 调试用：列出所有事件
    listEvents() {
        return Array.from(this.events.keys());
    }
}

// 单例导出
const eventBus = new EventBus();
export default eventBus;

// 同时挂到window上供过渡期使用
window.SAEventBus = eventBus;
```

### Step 3: 实现App核心 (Day 3-4)

```javascript
// core/app.js
import eventBus from './event-bus.js';

class App {
    constructor() {
        this.modules = new Map();
        this.eventBus = eventBus;
        this.state = {};
        this.initialized = false;
    }
    
    // 注册模块
    registerModule(name, moduleDefinition) {
        if (this.modules.has(name)) {
            console.warn(`Module ${name} already registered, skipping.`);
            return;
        }
        
        // 检查依赖
        const deps = moduleDefinition.dependencies || [];
        for (const dep of deps) {
            if (!this.modules.has(dep)) {
                console.warn(`Module ${name} depends on ${dep}, which is not registered yet.`);
            }
        }
        
        this.modules.set(name, moduleDefinition);
        
        // 如果App已初始化，立即初始化新模块
        if (this.initialized && moduleDefinition.init) {
            moduleDefinition.init(this);
        }
    }
    
    // 获取模块
    getModule(name) {
        return this.modules.get(name);
    }
    
    // 启动应用
    async start() {
        console.log('🚀 Smart Accounting App starting...');
        
        // 按依赖顺序排序模块
        const sortedModules = this.topologicalSort();
        
        // 初始化所有模块
        for (const name of sortedModules) {
            const module = this.modules.get(name);
            if (module.init) {
                console.log(`  📦 Initializing module: ${name}`);
                module.init(this);
            }
        }
        
        this.initialized = true;
        
        // 启动所有模块
        for (const name of sortedModules) {
            const module = this.modules.get(name);
            if (module.start) {
                await module.start();
            }
        }
        
        this.eventBus.emit('app:ready');
        console.log('✅ Smart Accounting App ready!');
    }
    
    // 拓扑排序（按依赖顺序）
    topologicalSort() {
        const result = [];
        const visited = new Set();
        const visiting = new Set();
        
        const visit = (name) => {
            if (visited.has(name)) return;
            if (visiting.has(name)) {
                throw new Error(`Circular dependency detected: ${name}`);
            }
            
            visiting.add(name);
            const module = this.modules.get(name);
            
            if (module && module.dependencies) {
                for (const dep of module.dependencies) {
                    if (this.modules.has(dep)) {
                        visit(dep);
                    }
                }
            }
            
            visiting.delete(name);
            visited.add(name);
            result.push(name);
        };
        
        for (const name of this.modules.keys()) {
            visit(name);
        }
        
        return result;
    }
}

const app = new App();
export default app;

// 全局访问
window.SAApp = app;
```

### Step 4: API Client封装 (Day 5-6)

```javascript
// core/api-client.js
class APIClient {
    constructor() {
        this.baseURL = '';
        this.defaultHeaders = {
            'Content-Type': 'application/json',
        };
    }
    
    // 获取CSRF Token
    getCsrfToken() {
        if (window.frappe && window.frappe.csrf_token) {
            return window.frappe.csrf_token;
        }
        // 从cookie获取
        const match = document.cookie.match(/csrf_token=([^;]+)/);
        return match ? match[1] : '';
    }
    
    // 通用请求方法
    async request(method, endpoint, data = null, options = {}) {
        const config = {
            method: endpoint,
            args: data || {},
            ...options
        };
        
        return new Promise((resolve, reject) => {
            if (window.frappe && window.frappe.call) {
                frappe.call({
                    method: `smart_accounting.www.project_management.${method}`,
                    args: config.args,
                    async: true,
                    callback: (response) => {
                        if (response.message) {
                            resolve(response.message);
                        } else {
                            resolve(response);
                        }
                    },
                    error: (error) => {
                        reject(error);
                    }
                });
            } else {
                reject(new Error('Frappe not available'));
            }
        });
    }
    
    // 便捷方法
    async get(endpoint, params = {}) {
        return this.request(endpoint, 'GET', params);
    }
    
    async post(endpoint, data = {}) {
        return this.request(endpoint, 'POST', data);
    }
    
    // 批量请求
    async batch(requests) {
        return Promise.all(requests.map(req => 
            this.request(req.method, req.endpoint, req.data)
        ));
    }
}

const apiClient = new APIClient();
export default apiClient;

window.SAApi = apiClient;
```

### Step 5: 创建第一个业务模块示例 (Day 7-10)

```javascript
// modules/task/TaskManager.js
import apiClient from '../../core/api-client.js';

export class TaskManager {
    constructor(module) {
        this.module = module;
        this.eventBus = module.app.eventBus;
        this.tasks = new Map();
    }
    
    async loadTasks(filters = {}) {
        const response = await apiClient.request('index.get_project_management_data', 'POST', filters);
        if (response.success) {
            this.tasks.clear();
            response.tasks.forEach(task => {
                this.tasks.set(task.name, task);
            });
            this.eventBus.emit('task:loaded', { tasks: Array.from(this.tasks.values()) });
        }
        return response;
    }
    
    async updateTask(taskId, field, value) {
        const response = await apiClient.request('index.update_task_field', 'POST', {
            task_id: taskId,
            field: field,
            value: value
        });
        
        if (response.success) {
            const task = this.tasks.get(taskId);
            if (task) {
                task[field] = value;
                this.eventBus.emit('task:updated', { taskId, field, value });
            }
        }
        return response;
    }
    
    getTask(taskId) {
        return this.tasks.get(taskId);
    }
    
    getAllTasks() {
        return Array.from(this.tasks.values());
    }
}

// modules/task/index.js
import { TaskManager } from './TaskManager.js';

export default {
    name: 'task',
    dependencies: [],
    
    init(app) {
        this.app = app;
        this.manager = new TaskManager(this);
    },
    
    async start() {
        // 初始加载可以在这里做
    },
    
    // 对外API
    getManager() {
        return this.manager;
    }
};
```

---

## 5. 风险控制

### 5.1 回滚策略

```javascript
// 每个阶段完成后打tag
git tag -a phase1-complete -m "Phase 1: Infrastructure complete"
git tag -a phase2-complete -m "Phase 2: Core modules migrated"

// 如果出问题，可以快速回滚
git checkout phase1-complete
```

### 5.2 功能开关

```javascript
// config/feature-flags.js
export const FeatureFlags = {
    USE_NEW_TASK_MODULE: false,      // 开启新Task模块
    USE_NEW_EVENT_BUS: false,        // 开启新事件总线
    USE_NEW_API_CLIENT: false,       // 开启新API客户端
    ENABLE_DEBUG_MODE: true,         // 调试模式
};

// 使用方式
if (FeatureFlags.USE_NEW_TASK_MODULE) {
    // 使用新模块
    const taskModule = SAApp.getModule('task');
    taskModule.manager.loadTasks();
} else {
    // 使用旧代码
    window.SubtaskManager.loadSubtaskCounts();
}
```

### 5.3 并行运行测试

```javascript
// 在过渡期，新旧代码并行运行，对比结果
async function compareResults() {
    // 旧方式
    const oldResult = await window.SubtaskManager.loadSubtaskCounts();
    
    // 新方式
    const newResult = await SAApp.getModule('subtask').manager.loadSubtaskCounts();
    
    // 对比
    if (JSON.stringify(oldResult) !== JSON.stringify(newResult)) {
        console.error('Results mismatch!', { oldResult, newResult });
    }
}
```

### 5.4 监控指标

| 指标 | 目标 | 监控方式 |
|------|------|---------|
| 页面加载时间 | 不增加 | Performance API |
| 内存使用 | 减少20% | Chrome DevTools |
| 错误率 | 不增加 | 错误日志 |
| 用户反馈 | 无负面 | 用户测试 |

---

## 6. 时间线总结

```
Week 1-2:  Phase 1 - 基础设施
Week 3-5:  Phase 2 - 核心模块迁移
Week 6-7:  Phase 3 - UI组件抽象
Week 8:    Phase 4 - 清理优化

总计: 8周 (2个月)
```

---

## 7. 下一步行动

1. **立即可做**: 创建目录结构和核心文件
2. **本周目标**: 完成EventBus和App核心
3. **下周目标**: 迁移第一个业务模块(task)作为示范

是否开始执行 Phase 1？

