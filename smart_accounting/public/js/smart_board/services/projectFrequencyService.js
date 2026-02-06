/**
 * ProjectFrequencyService
 * - Fetch select options for Project.custom_project_frequency from backend DocType meta.
 * - Website-safe (uses DoctypeMetaService which caches results).
 */
import { DoctypeMetaService } from './doctypeMetaService.js';

export class ProjectFrequencyService {
  static async fetchFrequencyOptions() {
    const opts = await DoctypeMetaService.getSelectOptions('Project', 'custom_project_frequency');
    const list = Array.isArray(opts) ? opts.map(String).map((s) => s.trim()).filter(Boolean) : [];
    // De-dupe (preserve order)
    const out = [];
    const seen = new Set();
    for (const v of list) {
      if (seen.has(v)) continue;
      seen.add(v);
      out.push(v);
    }
    return out;
  }
}


