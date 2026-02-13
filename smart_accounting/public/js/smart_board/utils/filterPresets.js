const KEY = 'sb_filter_presets_v1';

function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    return {};
  }
}

function writeAll(obj) {
  try {
    localStorage.setItem(KEY, JSON.stringify(obj || {}));
  } catch (e) {}
}

export function getFilterPresets(viewKey) {
  const key = String(viewKey || '').trim() || 'global';
  const all = readAll();
  const list = all[key];
  return Array.isArray(list) ? list : [];
}

export function saveFilterPreset(viewKey, { id = '', name = '', advanced_groups = [] } = {}) {
  const key = String(viewKey || '').trim() || 'global';
  const title = String(name || '').trim();
  if (!title) return null;
  const all = readAll();
  const list = Array.isArray(all[key]) ? all[key] : [];
  const presetId = String(id || `fp_${Date.now()}_${Math.random().toString(16).slice(2)}`);
  const payload = {
    id: presetId,
    name: title,
    advanced_groups: Array.isArray(advanced_groups) ? advanced_groups : [],
    updated_at: Date.now(),
  };
  const next = list.filter((x) => String(x?.id || '') !== presetId);
  next.push(payload);
  next.sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')));
  all[key] = next;
  writeAll(all);
  return payload;
}

export function deleteFilterPreset(viewKey, id) {
  const key = String(viewKey || '').trim() || 'global';
  const target = String(id || '').trim();
  if (!target) return false;
  const all = readAll();
  const list = Array.isArray(all[key]) ? all[key] : [];
  const next = list.filter((x) => String(x?.id || '') !== target);
  all[key] = next;
  writeAll(all);
  return next.length !== list.length;
}

