import { ProjectService } from '../../services/projectService.js';
import { notify } from '../../services/uiAdapter.js';

/**
 * Monthly Status (Task monthly cells + Project monthly completion summary).
 * Extracted from BoardTable.js to keep the core table component slimmer.
 */
export function installBoardTableMonthlyStatusFeatures(BoardTable) {
	if (!BoardTable || !BoardTable.prototype) return;

	BoardTable.prototype._ensureMonthlyBundle = async function (projectNames, { includeTasks = false } = {}) {
		// Backward/defensive init (in case older instances exist)
		if (!this._msLoadedProjects) this._msLoadedProjects = new Set();
		if (!this._msLoadingProjects) this._msLoadingProjects = new Set();
		if (!this._msLoadedProjectsMatrix) this._msLoadedProjectsMatrix = new Set();
		if (!this._msLoadingProjectsMatrix) this._msLoadingProjectsMatrix = new Set();

		const names = Array.isArray(projectNames) ? projectNames.filter(Boolean) : [];
		// IMPORTANT:
		// - Summary can be prefetched (includeTasks=false)
		// - Matrix requires a separate fetch (includeTasks=true)
		// If we already prefetched summary, do NOT skip the matrix fetch.
		const missing = includeTasks
			? names.filter((n) => !this._msLoadedProjectsMatrix.has(n) && !this._msLoadingProjectsMatrix.has(n))
			: names.filter((n) => !this._msLoadedProjects.has(n) && !this._msLoadingProjects.has(n));
		if (!missing.length) return;

		missing.forEach((n) => (includeTasks ? this._msLoadingProjectsMatrix.add(n) : this._msLoadingProjects.add(n)));
		this.scheduleRowsUpdate();
		try {
			const taskFields = includeTasks
				? (this._taskCols || [])
						.map((c) => c?.field)
						.filter((f) => f && !String(f).startsWith('__sb_ts_m') && f !== '__sb_task_monthly_status')
				: [];
			if (includeTasks && this._needsTaskTeam()) {
				if (!taskFields.includes('custom_task_members')) taskFields.push('custom_task_members');
				if (!taskFields.includes('custom_team_members')) taskFields.push('custom_team_members');
			}
			const bundle = await ProjectService.getMonthlyStatusBundle(missing, {
				includeTasks,
				includeMatrix: includeTasks,
				includeSummary: true,
				limitPerProject: 500,
				taskFields,
			});
			const startMonth = Number(bundle?.start_month || 0) || null;
			const wasNull = !this._msStartMonth;
			if (startMonth && wasNull) {
				this._msStartMonth = startMonth;
				this._msStartMonthCounts = bundle?.start_month_counts || {};
				this._msStartMonthByProject = bundle?.start_month_by_project || {};
				// Month labels affect header; re-render once to apply correct month names.
				if (this._hasProjectMonthlyCompletion?.() || this._hasTaskMonthlyStatus?.()) {
					this.render();
				}
			}

			// Summary -> annotate project objects for fast cell rendering
			const summary = bundle?.summary || {};
			for (const [p, months] of Object.entries(summary)) {
				this._msSummaryByProject.set(p, months || {});
				const proj = this._projectByName.get(p);
				if (proj) proj.__sb_monthly_completion = months || {};
			}

			// Tasks+Matrix (optional)
			if (includeTasks) {
				const tasks = bundle?.tasks || {};
				for (const [p, list] of Object.entries(tasks)) {
					const sorted = typeof this._sortTasksBySubject === 'function'
						? this._sortTasksBySubject(list)
						: (Array.isArray(list) ? list : []);
					this._tasksByProject.set(p, sorted);
				}
				const matrix = bundle?.matrix || {};
				for (const [t, m] of Object.entries(matrix)) {
					const mm = {};
					for (const [k, v] of Object.entries(m || {})) mm[Number(k)] = v;
					this._msMatrixByTask.set(t, mm);
				}
			}

			// Mark loaded
			if (includeTasks) {
				missing.forEach((n) => this._msLoadedProjectsMatrix.add(n));
				// matrix implies summary is also effectively loaded (or at least safe to treat as loaded)
				missing.forEach((n) => this._msLoadedProjects.add(n));
			} else {
				missing.forEach((n) => this._msLoadedProjects.add(n));
			}
			this._msLastFetchAt = Date.now();
		} catch (e) {
			console.error(e);
		} finally {
			missing.forEach((n) => (includeTasks ? this._msLoadingProjectsMatrix.delete(n) : this._msLoadingProjects.delete(n)));
			this.scheduleRowsUpdate();
		}
	};

	BoardTable.prototype._openTaskMonthlyStatusMenu = function (cellEl) {
		const td = cellEl?.closest?.('td') || cellEl;
		if (!td) return;
		const taskName = td.dataset.task;
		const projectName = td.dataset.project;
		const fy = td.dataset.fiscalYear || '';
		const mi = Number(td.dataset.monthIndex || 0);
		if (!taskName || !mi) return;
		if (!fy) {
			notify('请先为该项目设置 Fiscal Year（可在 Columns 中勾选 Fiscal Year 并填写），然后再设置 Task Monthly Status。', 'orange');
			return;
		}

		// Simple inline popover (website-safe)
		const existing = document.querySelector('.sb-ms-menu');
		if (existing) existing.remove();

		const menu = document.createElement('div');
		menu.className = 'sb-ms-menu';
		menu.innerHTML = `
          <button type="button" data-v="Not Started">Not Started</button>
          <button type="button" data-v="Working On It">Working On It</button>
          <button type="button" data-v="Stuck">Stuck</button>
          <button type="button" data-v="Done">Done</button>
        `;
		document.body.appendChild(menu);

		const r = td.getBoundingClientRect();
		menu.style.left = `${Math.round(r.left + window.scrollX)}px`;
		menu.style.top = `${Math.round(r.bottom + window.scrollY + 6)}px`;

		const close = () => {
			try {
				menu.remove();
			} catch (e) {}
		};
		const onDoc = (ev) => {
			if (ev.target?.closest?.('.sb-ms-menu')) return;
			close();
			document.removeEventListener('mousedown', onDoc);
		};
		document.addEventListener('mousedown', onDoc);

		menu.addEventListener('click', async (ev) => {
			const btn = ev.target?.closest?.('button[data-v]');
			if (!btn) return;
			const v = btn.dataset.v;
			close();
			try {
				await ProjectService.setMonthlyStatus({
					referenceDoctype: 'Task',
					referenceName: taskName,
					fiscalYear: fy,
					monthIndex: mi,
					status: v,
				});
				// Update local cache
				const cur = this._msMatrixByTask.get(taskName) || {};
				cur[mi] = v;
				this._msMatrixByTask.set(taskName, cur);

				// Recompute summary for that project (only for this month)
				const proj = projectName ? this._projectByName.get(projectName) : null;
				const tasks = projectName ? this._tasksByProject.get(projectName) || [] : [];
				const total = tasks.length;
				let done = 0;
				for (const t of tasks) {
					const tn = String(t?.name || '').trim();
					if (!tn) continue;
					if ((this._msMatrixByTask.get(tn) || {})[mi] === 'Done') done += 1;
				}
				const percent = total ? (done / total) * 100 : 0;
				const months =
					proj?.__sb_monthly_completion || (projectName ? this._msSummaryByProject.get(projectName) || {} : {});
				months[mi] = { done, total, percent };
				if (projectName) this._msSummaryByProject.set(projectName, months);
				if (proj) proj.__sb_monthly_completion = months;

				this.scheduleRowsUpdate();
			} catch (e) {
				console.error(e);
				notify('Failed to update monthly status', 'red');
			}
		});
	};
}


