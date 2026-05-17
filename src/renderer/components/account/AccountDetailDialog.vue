<template>
  <el-dialog
    v-model="visible"
    :title="`账号详情 - ${account?.nickname || ''}`"
    width="560px"
    @close="$emit('update:modelValue', false)"
  >
    <template v-if="account">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="平台">
          <el-tag size="small">{{ getPlatformLabel(account.platform) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="account.status === 'active' ? 'success' : 'danger'" size="small">
            {{ account.status === 'active' ? '在线' : '离线' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="Cookie">
          <el-tag :type="account.cookieValid ? 'success' : 'danger'" size="small">
            {{ account.cookieValid ? '有效' : '失效' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="分组">
          {{ currentGroupName || '未分组' }}
        </el-descriptions-item>
      </el-descriptions>

      <el-divider content-position="left">绑定配置</el-divider>

      <el-form label-width="100px">
        <el-form-item label="指纹模板">
          <el-select
            v-model="fingerprintId"
            placeholder="选择指纹模板"
            clearable
            style="width: 100%"
            @change="handleFingerprintChange"
          >
            <el-option
              v-for="fp in fingerprints"
              :key="fp.id"
              :label="fp.name"
              :value="fp.id"
            />
          </el-select>
          <div class="form-item-hint" v-if="fingerprintId">
            已绑定指纹模板，发布时使用该模板的浏览器指纹
          </div>
        </el-form-item>

        <el-form-item label="代理">
          <el-select
            v-model="proxyId"
            placeholder="选择代理"
            clearable
            style="width: 100%"
            @change="handleProxyChange"
          >
            <el-option
              v-for="proxy in proxies"
              :key="proxy.id"
              :label="`${proxy.name} (${proxy.protocol}://${proxy.host}:${proxy.port})`"
              :value="proxy.id"
            >
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>{{ proxy.name }}</span>
                <el-tag :type="proxy.status === 'active' ? 'success' : 'danger'" size="small">
                  {{ proxy.status === 'active' ? '可用' : '不可用' }}
                </el-tag>
              </div>
            </el-option>
          </el-select>
          <div class="form-item-hint" v-if="proxyId">
            已绑定代理，发布时通过该代理访问平台
          </div>
        </el-form-item>
      </el-form>
    </template>

    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { ElMessage } from 'element-plus';

interface AccountData {
  id: string;
  platform: string;
  nickname: string;
  status: string;
  cookieValid: boolean;
  groupId?: string;
  fingerprintId?: string;
  proxyId?: string;
}

interface FingerprintTemplate {
  id: string;
  name: string;
  platform: string;
}

interface ProxyData {
  id: string;
  name: string;
  protocol: string;
  host: string;
  port: number;
  status: string;
}

const props = defineProps<{
  modelValue: boolean;
  account: AccountData | null;
  groups: Array<{ id: string; name: string }>;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  changed: [];
}>();

const visible = ref(props.modelValue);
const fingerprintId = ref<string | null>(null);
const proxyId = ref<string | null>(null);
const fingerprints = ref<FingerprintTemplate[]>([]);
const proxies = ref<ProxyData[]>([]);

watch(() => props.modelValue, (v) => { visible.value = v; });
watch(visible, (v) => { emit('update:modelValue', v); });

watch(() => props.account, async (acc) => {
  if (acc) {
    fingerprintId.value = acc.fingerprintId || null;
    proxyId.value = acc.proxyId || null;
    await loadBindings();
  }
}, { immediate: true });

async function loadBindings() {
  try {
    const [fpResult, proxyResult] = await Promise.all([
      window.matrixflow.fingerprint.list(),
      window.matrixflow.proxy.list(),
    ]);
    if (fpResult.success && fpResult.data) {
      fingerprints.value = fpResult.data;
    }
    if (proxyResult.success && proxyResult.data) {
      proxies.value = proxyResult.data;
    }
  } catch (error) {
    console.error('加载绑定配置失败:', error);
  }
}

async function handleFingerprintChange(value: string | null) {
  if (!props.account) return;
  try {
    await window.matrixflow.account.setFingerprint(props.account.id, value);
    ElMessage.success(value ? '指纹模板已绑定' : '已解除指纹绑定');
    emit('changed');
  } catch (error) {
    ElMessage.error('绑定指纹模板失败');
  }
}

async function handleProxyChange(value: string | null) {
  if (!props.account) return;
  try {
    await window.matrixflow.account.setProxy(props.account.id, value);
    ElMessage.success(value ? '代理已绑定' : '已解除代理绑定');
    emit('changed');
  } catch (error) {
    ElMessage.error('绑定代理失败');
  }
}

const currentGroupName = ref('');
watch(() => [props.account, props.groups], () => {
  if (props.account && props.groups) {
    const g = props.groups.find(g => g.id === props.account?.groupId);
    currentGroupName.value = g?.name || '';
  }
}, { immediate: true });

function getPlatformLabel(platform: string): string {
  const labels: Record<string, string> = {
    douyin: '抖音',
    xiaohongshu: '小红书',
    wechat: '视频号',
    channels: '视频号',
    kuaishou: '快手',
  };
  return labels[platform] || platform;
}
</script>

<style scoped>
.form-item-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
  line-height: 1.4;
}
</style>
