import { escapeHtml } from '../../utils/dom.js';

export class ReportApp {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.activeTab = 'daily';
    this._onClick = null;
  }

  init() {
    this.render();
    this.bindEvents();
  }

  render() {
    const tab = String(this.activeTab || 'daily').trim();
    this.container.innerHTML = `
      <div class="sb-report">
        <div class="sb-report__tabs">
          <button type="button" class="sb-report__tab ${tab === 'daily' ? 'is-active' : ''}" data-tab="daily">Daily</button>
          <button type="button" class="sb-report__tab ${tab === 'weekly' ? 'is-active' : ''}" data-tab="weekly">Weekly</button>
          <button type="button" class="sb-report__tab ${tab === 'monthly' ? 'is-active' : ''}" data-tab="monthly">Monthly</button>
        </div>
        <div class="sb-report__panel">
          <div class="text-muted">Report data for <b>${escapeHtml(tab)}</b> is coming soon.</div>
        </div>
      </div>
    `;
  }

  bindEvents() {
    this._onClick = (e) => {
      const btn = e.target?.closest?.('[data-tab]');
      if (!btn) return;
      const next = String(btn.getAttribute('data-tab') || '').trim();
      if (!next || next === this.activeTab) return;
      this.activeTab = next;
      this.render();
    };
    this.container.addEventListener('click', this._onClick);
  }

  destroy() {
    if (this._onClick) {
      this.container.removeEventListener('click', this._onClick);
      this._onClick = null;
    }
    this.container.innerHTML = '';
  }
}

