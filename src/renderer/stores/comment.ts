import { defineStore } from 'pinia';
import { ref } from 'vue';

interface CommentTemplate {
  id: string;
  platform: string;
  name: string;
  content: string;
  triggerCondition: 'after_publish' | 'threshold';
  threshold?: { metric: string; value: number };
  delay?: number;
  createdAt: Date;
  updatedAt: Date;
}

interface CommentTask {
  id: string;
  templateId: string;
  accountId: string;
  platform: string;
  videoId: string;
  status: 'pending' | 'completed' | 'failed';
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

export const useCommentStore = defineStore('comment', () => {
  const templates = ref<CommentTemplate[]>([]);
  const tasks = ref<CommentTask[]>([]);
  const loading = ref(false);

  async function loadTemplates(platform?: string) {
    loading.value = true;
    try {
      const result = await window.matrixflow.comment.template.list(platform);
      if (result.success && result.data) {
        templates.value = result.data;
      }
    } finally {
      loading.value = false;
    }
  }

  async function createTemplate(
    data: Omit<CommentTemplate, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<CommentTemplate | null> {
    const result = await window.matrixflow.comment.template.create(data);
    if (result.success && result.data) {
      templates.value.push(result.data);
      return result.data;
    }
    return null;
  }

  async function updateTemplate(
    id: string,
    updates: Partial<CommentTemplate>
  ): Promise<CommentTemplate | null> {
    const result = await window.matrixflow.comment.template.update(id, updates);
    if (result.success && result.data) {
      const index = templates.value.findIndex((t) => t.id === id);
      if (index !== -1) {
        templates.value[index] = result.data;
      }
      return result.data;
    }
    return null;
  }

  async function deleteTemplate(id: string): Promise<boolean> {
    const result = await window.matrixflow.comment.template.delete(id);
    if (result.success) {
      templates.value = templates.value.filter((t) => t.id !== id);
      return true;
    }
    return false;
  }

  async function loadTasks() {
    const result = await window.matrixflow.comment.task.list();
    if (result.success && result.data) {
      tasks.value = result.data;
    }
  }

  async function scheduleComment(
    templateId: string,
    accountId: string,
    videoId: string
  ): Promise<CommentTask | null> {
    const result = await window.matrixflow.comment.schedule(
      templateId,
      accountId,
      videoId
    );
    if (result.success && result.data) {
      tasks.value.push(result.data);
      return result.data;
    }
    return null;
  }

  async function executeTask(taskId: string): Promise<boolean> {
    const result = await window.matrixflow.comment.execute(taskId);
    if (result.success) {
      const task = tasks.value.find((t) => t.id === taskId);
      if (task) {
        task.status = 'completed';
        task.completedAt = new Date();
      }
      return true;
    }
    return false;
  }

  return {
    templates,
    tasks,
    loading,
    loadTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    loadTasks,
    scheduleComment,
    executeTask,
  };
});
