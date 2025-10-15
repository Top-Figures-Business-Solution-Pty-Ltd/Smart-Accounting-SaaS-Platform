"""
Frappe命令：更新Partition列配置
使用方法：bench --site [site_name] execute smart_accounting.commands.update_columns.update_partition_columns
"""

import frappe
from smart_accounting.scripts.update_partition_columns import main as update_main

def update_partition_columns():
    """
    Frappe命令入口：更新所有Partition的列配置
    """
    print("🚀 开始执行Partition列配置更新...")
    
    # 确保在正确的站点上下文中执行
    if not frappe.db:
        print("❌ 数据库连接未建立")
        return
    
    try:
        # 执行更新脚本
        update_main()
        
        print("✅ Partition列配置更新完成")
        
    except Exception as e:
        print(f"❌ 更新失败: {str(e)}")
        import traceback
        traceback.print_exc()
        raise

# 也可以作为独立函数调用
def quick_update():
    """
    快速更新函数（用于测试）
    """
    from smart_accounting.scripts.update_partition_columns import update_all_partitions_with_process_date
    
    print("⚡ 快速更新模式...")
    update_all_partitions_with_process_date()
    print("✅ 快速更新完成")
