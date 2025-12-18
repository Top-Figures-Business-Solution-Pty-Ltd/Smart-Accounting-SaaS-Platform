/**
 * Project Client Script
 * 动态过滤status选项基于project_type
 */

frappe.ui.form.on('Project', {
    refresh: function(frm) {
        filter_status_options(frm);
    },
    
    project_type: function(frm) {
        filter_status_options(frm);
    }
});

function filter_status_options(frm) {
    // 定义每个project_type允许的status
    const status_map = {
        'ITR': [
            'Not Started',
            'Working',
            'Ready for Review',
            'Under Review',
            'Lodged',
            'Completed',
            'Cancelled'
        ],
        'BAS': [
            'Not Started',
            'Working',
            'Ready for Review',
            'Query from ATO',
            'Resubmit',
            'Lodged',
            'Completed',
            'Cancelled'
        ],
        'Bookkeeping': [
            'Not Started',
            'Working',
            'Completed',
            'Cancelled'
        ],
        'R&D Grant': [
            'Not Started',
            'Working',
            'Partner Review',
            'Under Review',
            'Query from AusIndustry',
            'Resubmit',
            'Approved',
            'Completed',
            'Cancelled'
        ],
        'Financial Statements': [
            'Not Started',
            'Working',
            'Ready for Review',
            'Partner Review',
            'Completed',
            'Cancelled'
        ]
        // 可以继续添加其他project_type...
    };
    
    // 获取当前project_type允许的status
    const project_type = frm.doc.project_type;
    const allowed_statuses = status_map[project_type];
    
    if (allowed_statuses && allowed_statuses.length > 0) {
        // 动态设置status字段的选项
        frm.set_df_property('status', 'options', allowed_statuses);
        frm.refresh_field('status');
    } else {
        // 如果没有匹配的project_type，显示所有状态（超集）
        const all_statuses = [
            'Not Started',
            'Working',
            'Ready for Review',
            'Under Review',
            'Partner Review',
            'Query from ATO',
            'Query from AusIndustry',
            'Resubmit',
            'Lodged',
            'Approved',
            'Completed',
            'Cancelled'
        ];
        frm.set_df_property('status', 'options', all_statuses);
        frm.refresh_field('status');
    }
}

