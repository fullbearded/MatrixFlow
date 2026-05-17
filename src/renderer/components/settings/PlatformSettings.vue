<template>
  <div class="platform-settings">
    <div v-if="loading" class="platform-settings__loading">
      <el-icon class="is-loading" :size="20"><Loading /></el-icon>
      <span>加载平台列表...</span>
    </div>

    <div v-else class="platform-settings__list">
      <div
        v-for="platform in platforms"
        :key="platform.id"
        class="platform-item"
      >
        <div class="platform-item__header">
          <span class="platform-item__icon">{{ platform.icon }}</span>
          <div class="platform-item__info">
            <span class="platform-item__name">{{ platform.name }}</span>
            <span class="platform-item__desc">{{ platform.description }}</span>
          </div>
          <el-switch
            v-model="platform.enabled"
            @change="(v: boolean) => togglePlatform(platform.id, v)"
          />
        </div>

        <div v-if="platform.enabled" class="platform-item__config">
          <el-form label-width="90px" size="small">
            <el-form-item label="发布模式">
              <el-select
                v-model="platform.publishMode"
                @change="(v: string) => updatePlatformConfig(platform.id, 'publishMode', v)"
              >
                <el-option label="自动发布" value="auto" />
                <el-option label="手动确认" value="manual" />
                <el-option label="定时发布" value="scheduled" />
              </el-select>
            </el-form-item>
            <el-form-item label="默认标签">
              <el-select
                v-model="platform.defaultTags"
                multiple
                filterable
                allow-create
                placeholder="输入标签后回车"
                style="width: 100%"
                @change="(v: string[]) => updatePlatformConfig(platform.id, 'defaultTags', v)"
              >
                <el-option v-for="tag in platform.suggestedTags" :key="tag" :label="tag" :value="tag" />
              </el-select>
            </el-form-item>
          </el-form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Loading } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';

interface PlatformConfig {
  id: string;
  name: string;
  icon: string;
  description: string;
  enabled: boolean;
  publishMode: string;
  defaultTags: string[];
  suggestedTags: string[];
}

const loading = ref(false);
const platforms = ref<PlatformConfig[]>([
  {
    id: 'douyin',
    name: '抖音',
    icon: '🎵',
    description: '短视频平台，支持视频和图文发布',
    enabled: true,
    publishMode: 'auto',
    defaultTags: [],
    suggestedTags: ['日常', '生活', '推荐', '热门'],
  },
  {
    id: 'xiaohongshu',
    name: '小红书',
    icon: '📕',
    description: '生活方式分享平台，支持图文和视频',
    enabled: true,
    publishMode: 'manual',
    defaultTags: [],
    suggestedTags: ['好物分享', '日常', '生活', '种草'],
  },
  {
    id: 'channels',
    name: '视频号',
    icon: '💬',
    description: '微信视频号，支持视频和图片发布',
    enabled: true,
    publishMode: 'auto',
    defaultTags: [],
    suggestedTags: ['日常', '分享'],
  },
  {
    id: 'kuaishou',
    name: '快手',
    icon: '🎬',
    description: '短视频平台，支持视频发布',
    enabled: false,
    publishMode: 'auto',
    defaultTags: [],
    suggestedTags: ['日常', '生活'],
  },
  {
    id: 'bilibili',
    name: 'B站',
    icon: '📺',
    description: '视频分享平台，支持视频投稿',
    enabled: false,
    publishMode: 'manual',
    defaultTags: [],
    suggestedTags: ['日常', '生活', '知识'],
  },
]);

onMounted(async () => {
  if (!window.matrixflow) return;
  loading.value = true;
  try {
    // 通过 IPC 获取平台配置
    const config = await window.matrixflow.settings.get('platforms');
    if (config && typeof config === 'object') {
      const map = config as Record<string, Partial<PlatformConfig>>;
      platforms.value.forEach((p) => {
        if (map[p.id]) {
          Object.assign(p, map[p.id]);
        }
      });
    }
  } catch {
    /* ignore */
  } finally {
    loading.value = false;
  }
});

async function togglePlatform(id: string, enabled: boolean) {
  if (!window.matrixflow) return;
  try {
    await savePlatformConfig(id);
    ElMessage.success(enabled ? '已启用平台' : '已禁用平台');
  } catch {
    ElMessage.error('操作失败');
  }
}

async function updatePlatformConfig(id: string, _key: string, _value: unknown) {
  if (!window.matrixflow) return;
  try {
    await savePlatformConfig(id);
  } catch {
    ElMessage.error('保存失败');
  }
}

async function savePlatformConfig(id: string) {
  const platform = platforms.value.find((p) => p.id === id);
  if (!platform) return;

  const config: Record<string, unknown> = {};
  platforms.value.forEach((p) => {
    config[p.id] = {
      enabled: p.enabled,
      publishMode: p.publishMode,
      defaultTags: p.defaultTags,
    };
  });
  await window.matrixflow.settings.set('platforms', config);
}
</script>

<style scoped>
.platform-settings__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-8);
  color: var(--color-text-secondary);
}

.platform-settings__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.platform-item {
  background: var(--color-bg-page);
  border-radius: var(--border-radius-md);
  padding: var(--space-4);
  border: 1px solid var(--color-border-light);
  transition: border-color var(--transition-fast);
}

.platform-item:hover {
  border-color: var(--color-border);
}

.platform-item__header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.platform-item__icon {
  font-size: 24px;
  flex-shrink: 0;
}

.platform-item__info {
  flex: 1;
  min-width: 0;
}

.platform-item__name {
  display: block;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

.platform-item__desc {
  display: block;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin-top: var(--space-1);
}

.platform-item__config {
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border-light);
}
</style>
