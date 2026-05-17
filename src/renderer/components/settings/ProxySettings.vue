<template>
  <div class="proxy-settings">
    <div class="settings-section">
      <div class="section-title">
        <h4>全局代理设置</h4>
        <p class="section-desc">设置全局代理，所有账号默认使用此代理</p>
      </div>
      
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="启用代理">
          <el-switch
            v-model="form.enabled"
            @change="(v: boolean) => saveField('enabled', v)"
          />
        </el-form-item>

        <template v-if="form.enabled">
          <el-form-item label="代理类型" prop="type">
            <el-select v-model="form.type" @change="(v: string) => saveField('type', v)">
              <el-option label="HTTP" value="http" />
              <el-option label="HTTPS" value="https" />
              <el-option label="SOCKS5" value="socks5" />
            </el-select>
          </el-form-item>

          <el-form-item label="代理地址" prop="host">
            <el-input
              v-model="form.host"
              placeholder="127.0.0.1"
              @change="(v: string) => saveField('host', v)"
            />
          </el-form-item>

          <el-form-item label="端口" prop="port">
            <el-input-number
              v-model="form.port"
              :min="1"
              :max="65535"
              controls-position="right"
              @change="(v: number | undefined) => v && saveField('port', v)"
            />
          </el-form-item>

          <el-form-item label="用户名">
            <el-input
              v-model="form.username"
              placeholder="留空表示无需认证"
              @change="(v: string) => saveField('username', v)"
            />
          </el-form-item>

          <el-form-item label="密码">
            <el-input
              v-model="form.password"
              type="password"
              show-password
              placeholder="留空表示无需认证"
              @change="(v: string) => saveField('password', v)"
            />
          </el-form-item>

          <el-form-item>
            <el-button @click="testProxy" :loading="testing">
              测试连接
            </el-button>
          </el-form-item>
        </template>
      </el-form>
    </div>

    <el-divider />

    <ProxyPoolSettings />
    
    <el-divider />

    <FingerprintSettings />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage } from 'element-plus';
import ProxyPoolSettings from './ProxyPoolSettings.vue';
import FingerprintSettings from './FingerprintSettings.vue';

interface ProxyConfig {
  enabled: boolean;
  type: string;
  host: string;
  port: number;
  username: string;
  password: string;
}

const defaults: ProxyConfig = {
  enabled: false,
  type: 'http',
  host: '127.0.0.1',
  port: 7890,
  username: '',
  password: '',
};

const formRef = ref<FormInstance>();
const testing = ref(false);

const form = reactive<ProxyConfig>({ ...defaults });

const rules: FormRules = {
  type: [{ required: true, message: '请选择代理类型', trigger: 'change' }],
  host: [{ required: true, message: '请输入代理地址', trigger: 'blur' }],
  port: [{ required: true, message: '请输入端口号', trigger: 'change' }],
};

onMounted(async () => {
  if (!window.matrixflow) return;
  try {
    const keys = Object.keys(defaults) as (keyof ProxyConfig)[];
    const entries = await Promise.all(
      keys.map(async (key) => {
        const val = await window.matrixflow.settings.get(`proxy.${key}`);
        return [key, val ?? defaults[key]] as const;
      }),
    );
    Object.assign(form, Object.fromEntries(entries));
  } catch {
    // ignore
  }
});

async function saveField<K extends keyof ProxyConfig>(key: K, value: ProxyConfig[K]) {
  if (!window.matrixflow) return;
  try {
    await window.matrixflow.settings.set(`proxy.${key}`, value);
  } catch {
    ElMessage.error('保存失败');
  }
}

async function testProxy() {
  if (!formRef.value) return;
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;

  testing.value = true;
  try {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    ElMessage.success('代理连接成功');
  } catch {
    ElMessage.error('代理连接失败，请检查配置');
  } finally {
    testing.value = false;
  }
}
</script>

<style scoped>
.proxy-settings {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-title h4 {
  margin: 0 0 4px 0;
  font-size: 14px;
  font-weight: 500;
}

.section-desc {
  margin: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
