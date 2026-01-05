/**
 * Desk Page: project_management
 *
 * URL:
 * - /app/project_management   (canonical)
 * - /project_management       (redirects to /app/project_management)
 */

frappe.pages["project-management"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __("Project Management"),
		single_column: true,
	});

	// root container for SPA
	const root = document.createElement("div");
	root.className = "smart-board-container";
	page.main[0].appendChild(root);

	// 按需加载 CSS（只影响当前 Page，避免全局污染）
	frappe.require([
		"/assets/smart_accounting/css/smart_board/main.css",
		"/assets/smart_accounting/css/smart_board/layout.css",
		"/assets/smart_accounting/css/smart_board/board.css",
		"/assets/smart_accounting/css/smart_board/components.css",
	]).then(() => {
		// 按需加载模块化 SPA（ESM）
		// 这里使用 dynamic import，保持 smart_board/ 目录的 import/export 结构不被破坏
		const entry = "/assets/smart_accounting/js/smart_board/index.js";
		import(entry)
			.then(() => {
				// index.js 会注册 smart_accounting.show_smart_board()
				if (window.smart_accounting?.show_smart_board) {
					// 让 SPA mount 到当前 page 的 root，而不是 append 到 body
					// 先设置一个临时 hook，供 SPA 读取（后续可以改成更正式的 mount API）
					window.smart_accounting.__mount_target = root;
					window.smart_accounting.show_smart_board();
				} else {
					root.innerHTML = `<div class="text-muted p-3">Smart Board entry loaded, but API not found.</div>`;
				}
			})
			.catch((e) => {
				console.error(e);
				root.innerHTML = `<div class="text-muted p-3">Failed to load Smart Board modules. Run bench build and refresh.</div>`;
			});
	});
};


