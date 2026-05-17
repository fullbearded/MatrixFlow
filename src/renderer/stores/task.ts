import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export type TaskStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';

export interface Task {
  id: string;
  type: 'publish' | 'check_cookie' | 'login';
  accountId: string;
  accountName?: string;
  contentId?: string;
  contentTitle?: string;
  platform: string;
  status: TaskStatus;
  progress: number;
  message?: string;
  errorCode?: string;
  startedAt?: string;
  completedAt?: string;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
}

export const useTaskStore = defineStore('task', () => {
  const tasks = ref<Task[]>([]);
  const loading = ref(false);

  const runningTasks = computed(() => tasks.value.filter((t) => t.status === 'running'));
  const failedTasks = computed(() => tasks.value.filter((t) => t.status === 'failed'));
  const hasFailedTasks = computed(() => failedTasks.value.length > 0);

  const stats = computed(() => ({
    total: tasks.value.length,
    pending: tasks.value.filter((t) => t.status === 'pending').length,
    running: runningTasks.value.length,
    success: tasks.value.filter((t) => t.status === 'success').length,
    failed: failedTasks.value.length,
  }));

  async function fetchTasks(filter?: Record<string, unknown>) {
    if (!window.matrixflow) return;
    loading.value = true;
    try {
      const list = await window.matrixflow.publish.listTasks(filter);
      tasks.value = list as Task[];
    } finally {
      loading.value = false;
    }
  }

  async function createTask(data: Partial<Task>) {
    if (!window.matrixflow) return;
    return window.matrixflow.publish.createTask(data);
  }

  async function cancelTask(id: string) {
    if (!window.matrixflow) return;
    await window.matrixflow.publish.cancelTask(id);
    const task = tasks.value.find((t) => t.id === id);
    if (task) task.status = 'cancelled';
  }

  async function retryTask(id: string) {
    if (!window.matrixflow) return;
    return window.matrixflow.publish.retryTask(id);
  }

  async function retryAllFailed() {
    const ids = failedTasks.value.map((t) => t.id);
    for (const id of ids) {
      await retryTask(id);
    }
  }

  function updateTaskProgress(taskId: string, progress: number, message?: string) {
    const task = tasks.value.find((t) => t.id === taskId);
    if (task) {
      task.progress = progress;
      if (message) task.message = message;
    }
  }

  function updateTaskStatus(taskId: string, status: TaskStatus, data?: Partial<Task>) {
    const task = tasks.value.find((t) => t.id === taskId);
    if (task) {
      task.status = status;
      task.updatedAt = new Date().toISOString();
      if (data) {
        Object.assign(task, data);
      }
    }
  }

  /** 监听主进程推送的任务事件 */
  function listenIpcEvents(): () => void {
    if (!window.matrixflow?.onTaskProgress) return () => {};

    const off1 = window.matrixflow.onTaskProgress((taskId: string, progress: number, message?: string) => {
      updateTaskProgress(taskId, progress, message);
    });

    const off2 = window.matrixflow.onTaskStatusChange?.((taskId: string, status: string, data?: Partial<Task>) => {
      updateTaskStatus(taskId, status as TaskStatus, data);
    });

    return () => {
      off1();
      off2?.();
    };
  }

  return {
    tasks,
    loading,
    runningTasks,
    failedTasks,
    hasFailedTasks,
    stats,
    fetchTasks,
    createTask,
    cancelTask,
    retryTask,
    retryAllFailed,
    updateTaskProgress,
    updateTaskStatus,
    listenIpcEvents,
  };
});
