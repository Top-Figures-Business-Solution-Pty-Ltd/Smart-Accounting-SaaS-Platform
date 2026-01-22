/**
 * Smart Board - Store (State Management)
 * 简单的状态管理（类Redux模式）
 */

import { ProjectsModule } from './modules/projects.js';
import { FiltersModule } from './modules/filters.js';
import { ViewsModule } from './modules/views.js';
import { DashboardModule } from './modules/dashboard.js';
import { ClientsModule } from './modules/clients.js';
import { Perf } from '../utils/perf.js';

export class Store {
    constructor() {
        // 初始化状态
        this.state = {
            projects: ProjectsModule.state(),
            filters: FiltersModule.state(),
            views: ViewsModule.state(),
            dashboard: DashboardModule.state(),
            clients: ClientsModule.state(),
        };
        
        // 订阅者列表
        this.subscribers = [];
        
        // 模块映射
        this.modules = {
            projects: ProjectsModule,
            filters: FiltersModule,
            views: ViewsModule,
            dashboard: DashboardModule,
            clients: ClientsModule,
        };
    }
    
    /**
     * 获取当前状态
     */
    getState() {
        return this.state;
    }
    
    /**
     * 订阅状态变化
     */
    subscribe(callback) {
        this.subscribers.push(callback);
        
        // 返回取消订阅函数
        return () => {
            const index = this.subscribers.indexOf(callback);
            if (index > -1) {
                this.subscribers.splice(index, 1);
            }
        };
    }
    
    /**
     * 通知所有订阅者
     */
    notify() {
        this.subscribers.forEach(callback => {
            callback(this.state);
        });
    }
    
    /**
     * 分发action
     */
    async dispatch(action, payload) {
        // 解析action: 'module/actionName'
        const [moduleName, actionName] = action.split('/');
        
        const module = this.modules[moduleName];
        if (!module) {
            console.error(`Module ${moduleName} not found`);
            return;
        }
        
        const actionFn = module.actions[actionName];
        if (!actionFn) {
            console.error(`Action ${actionName} not found in module ${moduleName}`);
            return;
        }
        
        try {
            // 执行action（可能是异步的）
            const run = async () => await actionFn(this.state[moduleName], payload, this);
            const newState = await Perf.timeAsync(
                `dispatch ${action}`,
                run,
                () => ({
                    module: moduleName,
                    action: actionName,
                    payload_keys: payload && typeof payload === 'object' ? Object.keys(payload).slice(0, 12) : null,
                })
            );
            
            // 更新状态
            if (newState !== undefined) {
                this.state[moduleName] = newState;
            }
            
            // 通知订阅者
            this.notify();
        } catch (error) {
            console.error(`Error in action ${action}:`, error);
            throw error;
        }
    }
    
    /**
     * 提交mutation（同步修改状态）
     */
    commit(mutation, payload) {
        const [moduleName, mutationName] = mutation.split('/');
        
        const module = this.modules[moduleName];
        if (!module) {
            console.error(`Module ${moduleName} not found`);
            return;
        }
        
        const mutationFn = module.mutations[mutationName];
        if (!mutationFn) {
            console.error(`Mutation ${mutationName} not found in module ${moduleName}`);
            return;
        }
        
        // 执行mutation
        mutationFn(this.state[moduleName], payload);
        
        // 通知订阅者
        this.notify();
    }
}

