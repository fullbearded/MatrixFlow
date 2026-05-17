import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export type PublishStatus = 'pending' | 'scheduled' | 'running' | 'completed' | 'failed' | 'cancelled';
export type PublishMode = 'server' | 'client';

export interface PublishTask {
  id: string;
  contentId: string;
  contentTitle: string;
  groupId: string | null;
  platform: string;
  accountId: string;
  accountName: string;
  publishMode: PublishMode;
  status: PublishStatus;
  scheduledAt: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export const usePublishStore = defineStore('publish', () => {
  const tasks = ref<PublishTask[]>([]);
  const loading = ref(false);

  // scheduledAt 按日期分组：'YYYY-MM-DD' -> PublishTask[]
  const tasksByDate = computed(() => {
    const map = new Map<string, PublishTask[]>();
    for (const task of tasks.value) {
      const dateKey = task.scheduledAt.slice(0, 10);
      const list = map.get(dateKey) || [];
      list.push(task);
      map.set(dateKey, list);
    }
    return map;
  });

  const pendingCount = computed(() => tasks.value.filter((t) => t.status === 'pending').length);
  const scheduledCount = computed(() => tasks.value.filter((t) => t.status === 'scheduled').length);

  async function fetchTasks() {
    if (!window.matrixflow) return;
    loading.value = true;
    try {
      const result = await window.matrixflow.publish.listTasks();
      tasks.value = (result as PublishTask[]) ?? [];
    } finally {
      loading.value = false;
    }
  }

  async function createTask(data: {
    contentId: string;
    accountIds: string[];
    scheduledAt: string | null;
    publishMode: PublishMode;
  }) {
    if (!window.matrixflow) return;
    const results: PublishTask[] = [];
    for (const accountId of data.accountIds) {
      const task = await window.matrixflow.publish.createTask({
        contentId: data.contentId,
        accountId,
        platform: '',
        scheduledAt: data.scheduledAt,
        publishMode: data.publishMode,
        metadata: {},
      });
      if (task) results.push(task as PublishTask);
    }
    tasks.value.push(...results);
    return results;
  }

  async function updateTaskSchedule(taskId: string, scheduledAt: string) {
    if (!window.matrixflow) return;
    await window.matrixflow.publish.updateTask(taskId, { scheduledAt });
    const task = tasks.value.find((t) => t.id === taskId);
    if (task) {
      task.scheduledAt = scheduledAt;
      task.updatedAt = new Date().toISOString();
    }
  }

  async function deleteTask(taskId: string) {
    if (!window.matrixflow) return;
    await window.matrixflow.publish.deleteTask(taskId);
    tasks.value = tasks.value.filter((t) => t.id !== taskId);
  }

  async function cancelTask(taskId: string) {
    if (!window.matrixflow) return;
    await window.matrixflow.publish.cancelTask(taskId);
    const task = tasks.value.find((t) => t.id === taskId);
    if (task) task.status = 'cancelled';
  }

  async function retryTask(taskId: string) {
    if (!window.matrixflow) return;
    return window.matrixflow.publish.retryTask(taskId);
  }

  async function confirmPendingTasks() {
    const pending = tasks.value.filter(
      (t) => t.status === 'pending' || t.status === 'scheduled',
    );
    for (const task of pending) {
      if (!window.matrixflow) continue;
      await window.matrixflow.publish.updateTask(task.id, { status: 'scheduled' });
      task.status = 'scheduled';
    }
  }

  return {
    tasks,
    loading,
    tasksByDate,
    pendingCount,
    scheduledCount,
    fetchTasks,
    createTask,
    updateTaskSchedule,
    deleteTask,
    cancelTask,
    retryTask,
    confirmPendingTasks,
  };
});
