#!/usr/bin/env python3
"""
自动化脚本：为所有Partition添加Process Date列配置
用途：在添加新列后，自动更新所有现有partition的column config，避免手动操作
"""

import frappe
import json
from frappe import _

def update_all_partitions_with_process_date():
    """
    为所有现有的Partition添加Process Date列配置
    """
    print("🚀 开始更新所有Partition的列配置...")
    
    try:
        # 获取所有partition
        partitions = frappe.get_all("Partition", 
                                  fields=["name", "partition_name", "visible_columns", "column_config"],
                                  order_by="partition_name")
        
        if not partitions:
            print("ℹ️ 没有找到任何Partition记录")
            return
        
        print(f"📋 找到 {len(partitions)} 个Partition需要更新")
        
        updated_count = 0
        skipped_count = 0
        
        for partition in partitions:
            try:
                result = update_single_partition(partition)
                if result:
                    updated_count += 1
                    print(f"✅ 已更新: {partition['partition_name']} ({partition['name']})")
                else:
                    skipped_count += 1
                    print(f"⏭️ 跳过: {partition['partition_name']} (已包含Process Date)")
                    
            except Exception as e:
                print(f"❌ 更新失败: {partition['partition_name']} - {str(e)}")
                continue
        
        print(f"\n📊 更新完成统计:")
        print(f"   ✅ 成功更新: {updated_count} 个")
        print(f"   ⏭️ 跳过: {skipped_count} 个")
        print(f"   📋 总计: {len(partitions)} 个")
        
        # 提交更改
        frappe.db.commit()
        print("💾 所有更改已保存到数据库")
        
    except Exception as e:
        print(f"❌ 脚本执行失败: {str(e)}")
        frappe.db.rollback()
        raise

def update_single_partition(partition_data):
    """
    更新单个partition的列配置
    
    Args:
        partition_data: partition的基本信息字典
        
    Returns:
        bool: True表示已更新，False表示跳过
    """
    partition_name = partition_data['name']
    
    # 获取完整的partition文档
    partition_doc = frappe.get_doc("Partition", partition_name)
    
    # 解析现有配置
    visible_columns_raw = getattr(partition_doc, 'visible_columns', None)
    column_config_raw = getattr(partition_doc, 'column_config', None)
    
    # 解析JSON
    try:
        visible_columns = json.loads(visible_columns_raw) if visible_columns_raw else []
        column_config = json.loads(column_config_raw) if column_config_raw else {}
    except json.JSONDecodeError:
        print(f"⚠️ JSON解析失败，使用默认配置: {partition_data['partition_name']}")
        visible_columns = []
        column_config = {}
    
    # 检查是否已经包含process-date
    if 'process-date' in visible_columns:
        return False  # 跳过，已经存在
    
    # 获取当前列顺序
    column_order = column_config.get('column_order', [])
    
    # 如果没有列顺序配置，使用默认顺序
    if not column_order:
        column_order = get_default_column_order()
    
    # 在lodgment-due前面插入process-date
    updated_order = insert_process_date_before_lodgment_due(column_order)
    
    # 更新配置（process-date默认不可见，只添加到顺序中）
    column_config['column_order'] = updated_order
    
    # 保存更新
    partition_doc.column_config = json.dumps(column_config, ensure_ascii=False)
    # visible_columns保持不变，因为process-date默认隐藏
    
    # 保存文档
    partition_doc.save()
    
    return True

def get_default_column_order():
    """
    获取默认的列顺序
    """
    return [
        'client', 'task-name', 'entity', 'tf-tg', 'software', 'communication-methods', 
        'client-contact', 'status', 'note', 'target-month', 'budget', 'actual', 
        'review-note', 'action-person', 'preparer', 'reviewer', 'partner', 
        'lodgment-due', 'engagement', 'group', 'year-end', 'last-updated', 
        'priority', 'frequency', 'reset-date'
    ]

def insert_process_date_before_lodgment_due(column_order):
    """
    在lodgment-due前面插入process-date
    
    Args:
        column_order: 现有的列顺序列表
        
    Returns:
        list: 更新后的列顺序
    """
    # 创建新的顺序列表
    new_order = []
    process_date_inserted = False
    
    for column in column_order:
        # 如果遇到lodgment-due，先插入process-date
        if column == 'lodgment-due' and not process_date_inserted:
            new_order.append('process-date')
            process_date_inserted = True
        
        # 添加当前列（跳过已存在的process-date）
        if column != 'process-date':
            new_order.append(column)
    
    # 如果没有找到lodgment-due，在末尾添加process-date
    if not process_date_inserted:
        # 尝试在partner后面添加
        if 'partner' in new_order:
            partner_index = new_order.index('partner')
            new_order.insert(partner_index + 1, 'process-date')
        else:
            new_order.append('process-date')
    
    return new_order

def validate_column_configuration():
    """
    验证所有partition的列配置是否正确
    """
    print("🔍 验证所有Partition的列配置...")
    
    partitions = frappe.get_all("Partition", 
                              fields=["name", "partition_name", "column_config"])
    
    issues_found = 0
    
    for partition in partitions:
        try:
            column_config_raw = getattr(partition, 'column_config', None)
            if column_config_raw:
                column_config = json.loads(column_config_raw)
                column_order = column_config.get('column_order', [])
                
                if 'process-date' in column_order:
                    # 检查process-date是否在正确位置（lodgment-due前面）
                    if 'lodgment-due' in column_order:
                        process_index = column_order.index('process-date')
                        lodgment_index = column_order.index('lodgment-due')
                        
                        if process_index > lodgment_index:
                            print(f"⚠️ {partition['partition_name']}: process-date位置不正确")
                            issues_found += 1
                        else:
                            print(f"✅ {partition['partition_name']}: 配置正确")
                    else:
                        print(f"✅ {partition['partition_name']}: 包含process-date")
                else:
                    print(f"ℹ️ {partition['partition_name']}: 未包含process-date")
            else:
                print(f"⚠️ {partition['partition_name']}: 无列配置")
                
        except Exception as e:
            print(f"❌ {partition['partition_name']}: 验证失败 - {str(e)}")
            issues_found += 1
    
    if issues_found == 0:
        print("🎉 所有配置验证通过！")
    else:
        print(f"⚠️ 发现 {issues_found} 个配置问题")

# 主执行函数
def main():
    """
    主执行函数
    """
    print("=" * 60)
    print("🔧 Partition列配置自动更新脚本")
    print("=" * 60)
    
    try:
        # 更新所有partition
        update_all_partitions_with_process_date()
        
        print("\n" + "=" * 60)
        
        # 验证配置
        validate_column_configuration()
        
        print("\n✨ 脚本执行完成！")
        
    except Exception as e:
        print(f"\n❌ 脚本执行失败: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    # 如果直接运行脚本
    main()
