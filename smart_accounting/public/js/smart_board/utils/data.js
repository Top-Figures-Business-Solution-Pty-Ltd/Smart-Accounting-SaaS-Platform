/**
 * Data helpers
 */

/**
 * 深度克隆对象
 */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * 生成唯一ID
 */
export function generateId() {
  return `_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 比较两个对象是否相等
 */
export function isEqual(obj1, obj2) {
  return JSON.stringify(obj1) === JSON.stringify(obj2);
}

/**
 * 获取字段显示值
 */
export function getFieldValue(doc, fieldname) {
  if (!doc || !fieldname) return '';

  const value = doc[fieldname];
  if (!value) return '';

  // 处理不同字段类型
  if (Array.isArray(value)) {
    return value.join(', ');
  }

  return value;
}

/**
 * 构建筛选器查询
 */
export function buildFilters(filterObj) {
  const filters = [];

  Object.keys(filterObj).forEach((key) => {
    const value = filterObj[key];
    if (value !== null && value !== undefined && value !== '') {
      if (Array.isArray(value)) {
        filters.push([key, 'in', value]);
      } else {
        filters.push([key, '=', value]);
      }
    }
  });

  return filters;
}


