import { UpdatesService } from '../../services/updatesService.js';

/**
 * Updates badge features for BoardTable
 * - Prefetch update counts per project (batched)
 * - Annotate project objects with __sb_update_count
 */
export function installBoardTableUpdatesFeatures(BoardTable) {
  if (!BoardTable || !BoardTable.prototype) return;

  BoardTable.prototype._prefetchUpdateCounts = async function () {
    const names = (this.projects || []).map((p) => p?.name).filter(Boolean);
    if (!this._updateCountsLoading) this._updateCountsLoading = new Set();
    if (!this._updateCounts) this._updateCounts = new Map();
    const missing = names.filter((n) => !this._updateCounts.has(n) && !this._updateCountsLoading.has(n));
    if (!missing.length) {
      for (const p of this.projects || []) {
        if (!p?.name) continue;
        const c = this._updateCounts.get(p.name);
        if (c != null) p.__sb_update_count = c;
      }
      return;
    }
    missing.forEach((n) => this._updateCountsLoading.add(n));
    try {
      const counts = await UpdatesService.getUpdateCounts(missing);
      for (const n of missing) {
        const c = Number(counts?.[n] || 0);
        this._updateCounts.set(n, c);
      }
      for (const p of this.projects || []) {
        if (!p?.name) continue;
        const c = this._updateCounts.get(p.name);
        if (c != null) p.__sb_update_count = c;
      }
    } catch (e) {
      // ignore
    } finally {
      missing.forEach((n) => this._updateCountsLoading.delete(n));
      this.scheduleRowsUpdate();
    }
  };

  BoardTable.prototype._bumpUpdateCount = function (projectName, delta = 1) {
    if (!projectName) return;
    if (!this._updateCounts) this._updateCounts = new Map();
    const current = Number(this._updateCounts.get(projectName) || 0);
    const next = Math.max(0, current + Number(delta || 0));
    this._updateCounts.set(projectName, next);
    const p = this._projectByName?.get?.(projectName);
    if (p) p.__sb_update_count = next;
    if (p) p.__sb_update_hot = true;
  };

  BoardTable.prototype._markUpdatesSeen = function (projectName) {
    if (!projectName) return;
    const p = this._projectByName?.get?.(projectName);
    if (p) p.__sb_update_hot = false;
  };
}


