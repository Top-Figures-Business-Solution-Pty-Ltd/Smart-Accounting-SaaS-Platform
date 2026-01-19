import { getTaskColumnSpec } from '../../columns/specs/taskColumns.js';
import { ProjectService } from '../../services/projectService.js';
import { confirmDialog, notify } from '../../services/uiAdapter.js';
import { escapeHtml } from '../../utils/dom.js';

/**
 * Keep BoardTable.js smaller by moving task-expand / task-subtable logic here.
 * We attach methods onto BoardTable.prototype to avoid invasive rewiring.
 */
export function installBoardTableTaskFeatures(BoardTable) {
	if (!BoardTable || !BoardTable.prototype) return;

	BoardTable.prototype._getTaskByName = function (projectName, taskName) {
		if (!projectName || !taskName) return null;
		const tasks = this._tasksByProject.get(projectName) || [];
		return tasks.find((t) => String(t?.name || '') === String(taskName)) || null;
	};

	BoardTable.prototype._updateTaskLocal = function (projectName, taskName, field, value) {
		const task = this._getTaskByName(projectName, taskName);
		if (task) task[field] = value;
		this.scheduleRowsUpdate();
	};

	BoardTable.prototype._isTaskFieldEditable = function (column) {
		const field = column?.field;
		if (!field) return false;
		if (String(field).startsWith('__sb_')) return false;
		if (column?.__msKind) return false;
		const spec = getTaskColumnSpec(field);
		if (spec && spec.isEditable !== undefined) return !!spec.isEditable;
		return true;
	};

	BoardTable.prototype._getTaskAffordance = function (field) {
		const spec = getTaskColumnSpec(field);
		const kind = spec?.afford || 'edit';
		return kind === 'select' ? '▾' : '✎';
	};

	BoardTable.prototype._renderTaskTeam = function (members) {
		if (!Array.isArray(members) || !members.length) {
			return '<span class="text-muted">—</span>';
		}
		const avatars = members
			.slice(0, 3)
			.map((member) => {
				const name = this._extractName(member?.user || '');
				const initial = (name || '').charAt(0).toUpperCase();
				const img = member?.user_image || '';
				if (img) {
					return `<img class="user-avatar user-avatar--img" src="${escapeHtml(String(img))}" title="${escapeHtml(name)}" alt="" />`;
				}
				return `<span class="user-avatar" title="${escapeHtml(name)}">${escapeHtml(initial)}</span>`;
			})
			.join('');
		const moreCount = members.length - 3;
		const moreText = moreCount > 0 ? `<span class="more-count">+${moreCount}</span>` : '';
		return `<div class="team-avatars">${avatars}${moreText}</div>`;
	};

	BoardTable.prototype._extractName = function (email) {
		if (!email) return '';
		const name = String(email).split('@')[0];
		return name.charAt(0).toUpperCase() + name.slice(1);
	};

	BoardTable.prototype._prefetchTaskCounts = async function () {
		const names = (this.projects || []).map((p) => p?.name).filter(Boolean);
		// Avoid duplicate in-flight requests: without this, every store update while the request is pending
		// can re-trigger get_task_counts and make the app feel progressively slower.
		if (!this._taskCountsLoading) this._taskCountsLoading = new Set();
		const missing = names.filter((n) => !this._taskCounts.has(n) && !this._taskCountsLoading.has(n));
		if (!missing.length) {
			// still keep expanded flag in sync for rendering
			for (const p of this.projects || []) {
				if (!p?.name) continue;
				p.__sb_expanded = this._expanded.has(p.name);
			}
			return;
		}
		missing.forEach((n) => this._taskCountsLoading.add(n));
		try {
			const counts = await ProjectService.getTaskCounts(missing);
			for (const n of missing) {
				const c = Number(counts?.[n] || 0);
				this._taskCounts.set(n, c);
			}
			// annotate project objects (used by BoardRow)
			for (const p of this.projects || []) {
				if (!p?.name) continue;
				const c = this._taskCounts.get(p.name);
				if (c != null) p.__sb_task_count = c;
				p.__sb_expanded = this._expanded.has(p.name);
			}
		} catch (e) {
			// ignore
		} finally {
			missing.forEach((n) => this._taskCountsLoading.delete(n));
			this.scheduleRowsUpdate();
		}
	};

	BoardTable.prototype.ensureTasksLoaded = async function (projectName) {
		if (!projectName) return;
		if (this._tasksByProject.has(projectName)) return;
		if (this._tasksLoading.has(projectName)) return;
		this._tasksLoading.add(projectName);
		this.scheduleRowsUpdate();
		try {
			const fields = this._taskCols.map((c) => c.field);
			if (this._needsTaskTeam()) {
				if (!fields.includes('custom_task_members')) fields.push('custom_task_members');
				if (!fields.includes('custom_team_members')) fields.push('custom_team_members');
			}
			const map = await ProjectService.getTasksForProjects([projectName], fields, 200);
			const tasks = map?.[projectName] || [];
			this._tasksByProject.set(projectName, tasks);
		} finally {
			this._tasksLoading.delete(projectName);
			this.scheduleRowsUpdate();
		}
	};

	BoardTable.prototype.toggleExpand = async function (projectName) {
		if (this._expanded.has(projectName)) {
			this._expanded.delete(projectName);
		} else {
			this._expanded.add(projectName);
			// If monthly component is enabled, load tasks+matrix+summary in one request for best perf.
			if (this._hasTaskMonthlyStatus() || this._hasProjectMonthlyCompletion()) {
				await this._ensureMonthlyBundle([projectName], { includeTasks: this._hasTaskMonthlyStatus() });
			}
			await this.ensureTasksLoaded(projectName);
		}
		const p = this._projectByName.get(projectName);
		if (p) p.__sb_expanded = this._expanded.has(projectName);
		this.scheduleRowsUpdate();
	};

	BoardTable.prototype._renderExpandedTasksRow = function (project, columns) {
		const cols = Array.isArray(columns) ? columns : [];
		const colspan = cols.length || 1;
		const name = project?.name || '';
		const loading = name && this._tasksLoading.has(name);
		const tasks = name ? this._tasksByProject.get(name) || [] : [];
		const taskCols = this._expandTaskColumnsForRender((this._taskCols || []).slice());

		// Defensive: ensure monthly matrix is loaded when task monthly columns are visible.
		// In some flows, summary may be prefetched but matrix isn't, leading to empty task cells.
		try {
			if (
				name &&
				this._hasTaskMonthlyStatus?.() &&
				!this._msLoadedProjectsMatrix?.has?.(name) &&
				!this._msLoadingProjectsMatrix?.has?.(name)
			) {
				// Fire-and-forget; scheduleRowsUpdate will refresh once loaded.
				this._ensureMonthlyBundle?.([name], { includeTasks: true });
			}
		} catch (e) {}

		const table = (() => {
			const widths = taskCols.map((c) => Math.max(60, Number(c.width) || 120));
			const baseWidth = widths.reduce((a, b) => a + b, 0);

			// Do NOT stretch existing columns; instead add one trailing filler column.
			const leftPad = 12 + 52; // matches CSS indent (12px + select col 52px)
			const rightPad = 12;
			const avail = Math.max(0, Number(this._tableWidthPx || 0) - leftPad - rightPad);
			const filler = Math.max(0, avail - baseWidth);
			// Task row select column (checkbox) at far-left inside task table
			const selectW = 44;
			const allWidths = filler > 0 ? [selectW].concat(widths).concat([filler]) : [selectW].concat(widths);

			const totalWidth = allWidths.reduce((a, b) => a + b, 0);
			const colgroup = `<colgroup>${allWidths.map((w) => `<col style="width:${w}px" />`).join('')}</colgroup>`;
			const selectedSet = this._taskSelected?.get?.(name);
			const allSelected = !!(tasks && tasks.length && selectedSet && tasks.every((t) => selectedSet.has(String(t?.name || '').trim())));
			const ths =
				`<th class="sb-task-select-col"><input type="checkbox" class="sb-task-select-all" data-project="${escapeHtml(name)}" ${allSelected ? 'checked' : ''} aria-label="Select all tasks" /></th>` +
				taskCols.map((c) => `<th>${escapeHtml(c.label || c.field)}</th>`).join('');
			const rows = [];

			if (loading) {
				const tds =
					`<td class="sb-task-select-col"></td>` +
					taskCols
						.map((c, idx) =>
							idx === 0 ? `<td><span class="sb-task-muted">Loading…</span></td>` : `<td></td>`
						)
						.join('');
				rows.push(`<tr>${tds}${filler > 0 ? '<td></td>' : ''}</tr>`);
			} else if (tasks && tasks.length) {
				for (const t of tasks) {
					const tn = String(t?.name || '').trim();
					const selected = !!(project?.name && this._taskSelected?.get?.(project.name)?.has?.(tn));
					const tds = taskCols
						.map((c) => {
							if (c?.__msKind === 'task_status') {
								const mi = Number(c.__monthIndex || 0);
								const st = tn && this._msMatrixByTask.get(tn) ? this._msMatrixByTask.get(tn)[mi] || '' : '';
								const slug = st
									? String(st)
											.toLowerCase()
											.replace(/[^a-z0-9]+/g, '-')
											.replace(/^-+|-+$/g, '')
									: '';
								const cls = st ? `sb-ms-cell sb-ms-cell--${slug}` : 'sb-ms-cell sb-ms-cell--empty';
								const fy = escapeHtml(project?.custom_fiscal_year || project?.custom_fiscal_year?.name || '');
								return `<td class="${cls}" data-task="${escapeHtml(tn)}" data-month-index="${mi}" data-fiscal-year="${fy}" data-project="${escapeHtml(name)}">${st ? escapeHtml(st) : ''}</td>`;
							}
							const v = t?.[c.field];
							const editable = this._isTaskFieldEditable(c);
							const cls = editable ? 'editable' : '';
							const attrs = editable
								? ` data-task-field="${escapeHtml(c.field)}" data-task-name="${escapeHtml(tn)}" data-project-name="${escapeHtml(name)}"`
								: '';
							let val = '';
							const teamMembers =
								c.field === 'custom_task_members' || c.field === 'custom_team_members' || c.field === 'owner'
									? Array.isArray(t?.custom_task_members)
										? t.custom_task_members
										: Array.isArray(t?.custom_team_members)
											? t.custom_team_members
											: null
									: null;
							if (teamMembers && teamMembers.length) {
								val = this._renderTaskTeam(teamMembers);
							} else {
								val = escapeHtml(v ?? '—');
							}
							const afford = editable ? `<span class="sb-afford sb-afford--task">${this._getTaskAffordance(c.field)}</span>` : '';
							return `<td class="${cls}"${attrs}><div class="cell-content">${val}${afford}</div></td>`;
						})
						.join('');
					const selTd = `<td class="sb-task-select-col"><input type="checkbox" class="sb-task-select" data-project="${escapeHtml(name)}" data-task="${escapeHtml(tn)}" ${selected ? 'checked' : ''} aria-label="Select task" /></td>`;
					rows.push(
						`<tr class="${selected ? 'sb-task-selected' : ''}" data-task-name="${escapeHtml(tn)}" data-project-name="${escapeHtml(name)}">${selTd}${tds}${filler > 0 ? '<td></td>' : ''}</tr>`
					);
				}
			} else {
				const tds =
					`<td class="sb-task-select-col"></td>` +
					taskCols
						.map((c, idx) => (idx === 0 ? `<td><span class="sb-task-muted">No tasks yet</span></td>` : `<td></td>`))
						.join('');
				rows.push(`<tr>${tds}${filler > 0 ? '<td></td>' : ''}</tr>`);
			}

			// Always show an add row (Monday-like)
			const addTds = taskCols
				.map((c, idx) => {
					if (idx === 0) {
						return `<td>
                      <button type="button" class="sb-add-task-btn" data-project-name="${escapeHtml(name)}">＋ Add New Task</button>
                    </td>`;
					}
					return `<td></td>`;
				})
				.join('');
			rows.push(`<tr class="sb-task-add-row"><td class="sb-task-select-col"></td>${addTds}${filler > 0 ? '<td></td>' : ''}</tr>`);

			return `
              <div class="sb-task-grid">
                <table class="sb-task-table" style="width:${totalWidth}px">
                  ${colgroup}
                  <thead><tr>${ths}${filler > 0 ? '<th></th>' : ''}</tr></thead>
                  <tbody>${rows.join('')}</tbody>
                </table>
              </div>
            `;
		})();

		return `
          <tr class="sb-task-row" data-project-name="${escapeHtml(name)}">
            <td colspan="${colspan}">
              <div class="sb-task-wrap">
                ${table}
              </div>
            </td>
          </tr>
        `;
	};

	BoardTable.prototype._handleAddTask = async function (projectName) {
		const name = String(projectName || '').trim();
		if (!name) return;
		const ok = await confirmDialog(`Add a new task to ${name}?`);
		if (!ok) return;
		try {
			await ProjectService.createTask(name, { subject: 'New Task' });
			const next = Number(this._taskCounts.get(name) || 0) + 1;
			this._taskCounts.set(name, next);
			const p = this._projectByName.get(name);
			if (p) p.__sb_task_count = next;
			this._tasksByProject.delete(name);
			await this.ensureTasksLoaded(name);
			notify('Task created', 'green');
		} catch (e) {
			console.error(e);
			notify('Failed to create task', 'red');
		}
	};
}


