/**
 * 冲突检测：同一账号在同一天被不同分组调度视为冲突
 *
 * @param tasks 任务列表
 * @returns 冲突任务的 ID 集合
 */
export function detectConflicts(
  tasks: Array<{ id: string; accountId: string; scheduledAt: string; groupId: string | null }>,
): Set<string> {
  const conflictIds = new Set<string>();
  // date -> accountId -> Set<groupId>
  const dayAccountGroups = new Map<string, Map<string, Set<string>>>();

  for (const task of tasks) {
    const date = task.scheduledAt.slice(0, 10);
    if (!dayAccountGroups.has(date)) dayAccountGroups.set(date, new Map());
    const dayMap = dayAccountGroups.get(date)!;
    if (!dayMap.has(task.accountId)) dayMap.set(task.accountId, new Set());
    if (task.groupId) {
      dayMap.get(task.accountId)!.add(task.groupId);
    }
  }

  for (const task of tasks) {
    const date = task.scheduledAt.slice(0, 10);
    const groups = dayAccountGroups.get(date)?.get(task.accountId);
    if (groups && groups.size > 1) {
      conflictIds.add(task.id);
    }
  }

  return conflictIds;
}
