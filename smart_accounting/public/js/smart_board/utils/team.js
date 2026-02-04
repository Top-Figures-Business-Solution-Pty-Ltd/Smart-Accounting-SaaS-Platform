/**
 * Team helpers
 */

/**
 * 提取团队成员显示名称
 */
export function formatTeamMembers(teamMembers) {
  if (!teamMembers || !teamMembers.length) return '';

  const names = teamMembers.map((member) => {
    const user = member.user || member;
    // 从 email 提取名字（bob@tf.com -> Bob）
    const name = user.split('@')[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  });

  return names.join(', ');
}

/**
 * 按角色分组团队成员
 */
export function groupTeamByRole(teamMembers) {
  if (!teamMembers || !teamMembers.length) return {};

  return teamMembers.reduce((acc, member) => {
    const role = member.role || 'Preparer';
    if (!acc[role]) acc[role] = [];
    acc[role].push(member.user);
    return acc;
  }, {});
}


