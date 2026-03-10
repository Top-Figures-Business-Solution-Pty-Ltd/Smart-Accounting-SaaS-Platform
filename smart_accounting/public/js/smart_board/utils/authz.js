export function isAdminLike() {
  const user = String(frappe?.session?.user || '').trim();
  if (user === 'Administrator') return true;
  const roles = (frappe?.boot?.user?.roles) || frappe?.user_roles || [];
  return Array.isArray(roles) && roles.map(String).includes('System Manager');
}
