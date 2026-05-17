import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export interface ContentItem {
  id: string;
  title: string;
  description?: string;
  type: 'video' | 'image' | 'article';
  filePath?: string;
  thumbnail?: string;
  duration?: string;
  status: 'draft' | 'ready' | 'published';
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export const useContentStore = defineStore('content', () => {
  const contents = ref<ContentItem[]>([]);
  const loading = ref(false);
  const searchQuery = ref('');
  const statusFilter = ref<'' | ContentItem['status']>('');

  const filteredContents = computed(() => {
    let list = contents.value;
    if (statusFilter.value) {
      list = list.filter((c) => c.status === statusFilter.value);
    }
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase();
      list = list.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    return list;
  });

  async function fetchContents() {
    if (!window.matrixflow) return;
    loading.value = true;
    try {
      const list = await window.matrixflow.content.list();
      contents.value = list as ContentItem[];
    } finally {
      loading.value = false;
    }
  }

  async function createContent(data: Partial<ContentItem>) {
    if (!window.matrixflow) return;
    const item = await window.matrixflow.content.create(data);
    contents.value.unshift(item as ContentItem);
    return item;
  }

  async function updateContent(id: string, data: Partial<ContentItem>) {
    if (!window.matrixflow) return;
    const updated = await window.matrixflow.content.update(id, data);
    const idx = contents.value.findIndex((c) => c.id === id);
    if (idx !== -1 && updated) {
      contents.value[idx] = updated as ContentItem;
    }
    return updated;
  }

  async function deleteContent(id: string) {
    if (!window.matrixflow) return;
    await window.matrixflow.content.delete(id);
    contents.value = contents.value.filter((c) => c.id !== id);
  }

  async function batchDelete(ids: string[]) {
    if (!window.matrixflow) return;
    for (const id of ids) {
      await window.matrixflow.content.delete(id);
    }
    contents.value = contents.value.filter((c) => !ids.includes(c.id));
  }

  async function uploadVideo(data: { filePath: string; title: string }) {
    if (!window.matrixflow) return;
    return window.matrixflow.content.uploadVideo(data);
  }

  return {
    contents,
    loading,
    searchQuery,
    statusFilter,
    filteredContents,
    fetchContents,
    createContent,
    updateContent,
    deleteContent,
    batchDelete,
    uploadVideo,
  };
});
