/**
 * Storage helpers
 */

/**
 * 从本地存储获取数据
 */
export function getFromStorage(key, defaultValue = null) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : defaultValue;
  } catch (e) {
    console.error('Error reading from storage:', e);
    return defaultValue;
  }
}

/**
 * 保存数据到本地存储
 */
export function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error('Error saving to storage:', e);
    return false;
  }
}


