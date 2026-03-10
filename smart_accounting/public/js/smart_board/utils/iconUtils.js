export function renderIcon(iconName, size = "sm", svgClass = "sb-ui-icon") {
    const name = String(iconName || "").trim();
    if (!name) return "";
    try {
        return frappe.utils.icon(name, size, "", "", svgClass);
    } catch (e) {
        return "";
    }
}
