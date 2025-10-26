/**
 * 列配置更新工具
 * 用于自动更新所有Partition的列配置
 */

class ColumnUpdater {
    /**
     * 更新所有Partition的列配置，添加Process Date列
     */
    static updateAllPartitionsWithProcessDate() {
        // 显示确认对话框
        frappe.confirm(
            '确定要为所有Partition添加Process Date列配置吗？<br><br>' +
            '<small class="text-muted">这将会更新所有现有Partition的列顺序，在Lodgement Due前面添加Process Date列。Process Date列默认隐藏，可通过Manage Columns功能显示。</small>',
            () => {
                // 用户确认，执行更新
                this.executeUpdate();
            },
            '更新Partition配置'
        );
    }

    /**
     * 执行更新操作
     */
    static executeUpdate() {
        // 显示加载指示器
        const loadingMsg = frappe.show_alert({
            message: '正在更新Partition配置...',
            indicator: 'blue'
        }, 0); // 0表示不自动消失

        frappe.call({
            method: 'smart_accounting.www.project_management.index.update_all_partitions_with_new_column',
            callback: (response) => {
                // 隐藏加载指示器
                if (loadingMsg) {
                    loadingMsg.hide();
                }

                if (response.message && response.message.success) {
                    const result = response.message;
                    
                    // 显示成功消息
                    frappe.show_alert({
                        message: `✅ 成功更新了 ${result.updated_count}/${result.total_partitions} 个Partition`,
                        indicator: 'green'
                    }, 5);

                    // 显示详细结果
                    frappe.msgprint({
                        title: '更新完成',
                        message: `
                            <div class="update-result">
                                <p><strong>更新结果：</strong></p>
                                <ul>
                                    <li>总Partition数量: ${result.total_partitions}</li>
                                    <li>成功更新: ${result.updated_count}</li>
                                    <li>跳过（已存在）: ${result.total_partitions - result.updated_count}</li>
                                </ul>
                                <p class="text-muted">
                                    <small>Process Date列已添加到所有Partition的列配置中，默认隐藏。<br>
                                    用户可以通过"Manage Columns"功能来显示此列。</small>
                                </p>
                            </div>
                        `,
                        indicator: 'green'
                    });

                    // 如果当前页面是project management，刷新页面以应用更改
                    if (window.location.pathname.includes('/project_management')) {
                        setTimeout(() => {
                            frappe.show_alert({
                                message: '正在刷新页面以应用更改...',
                                indicator: 'blue'
                            }, 2);
                            setTimeout(() => {
                                window.location.reload();
                            }, 2000);
                        }, 3000);
                    }

                } else {
                    // 显示错误消息
                    const errorMsg = response.message?.error || '更新失败';
                    frappe.show_alert({
                        message: `❌ 更新失败: ${errorMsg}`,
                        indicator: 'red'
                    }, 8);

                    frappe.msgprint({
                        title: '更新失败',
                        message: `更新Partition配置时发生错误：<br><code>${errorMsg}</code>`,
                        indicator: 'red'
                    });
                }
            },
            error: (error) => {
                // 隐藏加载指示器
                if (loadingMsg) {
                    loadingMsg.hide();
                }

                console.error('Update error:', error);
                frappe.show_alert({
                    message: '❌ 网络错误或服务器错误',
                    indicator: 'red'
                }, 8);

                frappe.msgprint({
                    title: '更新失败',
                    message: '网络错误或服务器错误，请检查控制台日志。',
                    indicator: 'red'
                });
            }
        });
    }

    /**
     * 验证所有Partition的列配置
     */
    static validatePartitionConfigurations() {
        frappe.call({
            method: 'smart_accounting.www.project_management.index.get_all_partition_column_status',
            callback: (response) => {
                if (response.message && response.message.success) {
                    const partitions = response.message.partitions;
                    
                    let hasProcessDate = 0;
                    let missingProcessDate = 0;
                    
                    partitions.forEach(partition => {
                        if (partition.has_process_date) {
                            hasProcessDate++;
                        } else {
                            missingProcessDate++;
                        }
                    });

                    frappe.msgprint({
                        title: 'Partition配置状态',
                        message: `
                            <div class="validation-result">
                                <p><strong>配置状态统计：</strong></p>
                                <ul>
                                    <li>总Partition数量: ${partitions.length}</li>
                                    <li>已包含Process Date: ${hasProcessDate}</li>
                                    <li>缺少Process Date: ${missingProcessDate}</li>
                                </ul>
                                ${missingProcessDate > 0 ? 
                                    '<p class="text-warning">⚠️ 有Partition缺少Process Date配置，建议运行更新。</p>' : 
                                    '<p class="text-success">✅ 所有Partition都已正确配置。</p>'
                                }
                            </div>
                        `,
                        indicator: missingProcessDate > 0 ? 'orange' : 'green'
                    });
                }
            }
        });
    }
}

// 全局暴露
window.ColumnUpdater = ColumnUpdater;

// 在控制台中提供快捷方式
if (typeof console !== 'undefined') {
    // console.log('🔧 ColumnUpdater已加载。使用方法：');
    // console.log('   ColumnUpdater.updateAllPartitionsWithProcessDate() - 更新所有Partition');
    // console.log('   ColumnUpdater.validatePartitionConfigurations() - 验证配置状态');
}
