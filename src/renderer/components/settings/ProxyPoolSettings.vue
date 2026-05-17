<template>
  <div class="proxy-pool-settings">
    <div class="section-header">
      <h3>代理池管理</h3>
      <el-button type="primary" @click="showCreateDialog">
        <el-icon><Plus /></el-icon>
        添加代理
      </el-button>
    </div>

    <el-table :data="proxies" v-loading="loading" style="width: 100%">
      <el-table-column prop="name" label="名称" width="150" />
      <el-table-column prop="protocol" label="协议" width="80">
        <template #default="{ row }">
          <el-tag size="small">{{ row.protocol.toUpperCase() }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="地址" min-width="200">
        <template #default="{ row }">
          {{ row.host }}:{{ row.port }}
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 'active' ? 'success' : 'danger'" size="small">
            {{ row.status === 'active' ? '可用' : '不可用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="last_check_result" label="检测结果" min-width="150" show-overflow-tooltip />
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="checkProxy(row)" :loading="row.checking">
            测试
          </el-button>
          <el-button size="small" @click="showEditDialog(row)">
            编辑
          </el-button>
          <el-button size="small" type="danger" @click="deleteProxy(row)">
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑代理' : '添加代理'"
      width="500px"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="代理名称" />
        </el-form-item>
        <el-form-item label="协议" prop="protocol">
          <el-select v-model="form.protocol" style="width: 100%">
            <el-option label="HTTP" value="http" />
            <el-option label="HTTPS" value="https" />
            <el-option label="SOCKS5" value="socks5" />
          </el-select>
        </el-form-item>
        <el-form-item label="主机" prop="host">
          <el-input v-model="form.host" placeholder="127.0.0.1" />
        </el-form-item>
        <el-form-item label="端口" prop="port">
          <el-input-number v-model="form.port" :min="1" :max="65535" style="width: 100%" />
        </el-form-item>
        <el-form-item label="用户名">
          <el-input v-model="form.username" placeholder="留空表示无需认证" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" show-password placeholder="留空表示无需认证" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm" :loading="submitting">
          {{ isEdit ? '保存' : '创建' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';

interface Proxy {
  id: string;
  name: string;
  protocol: string;
  host: string;
  port: number;
  username: string | null;
  password: string | null;
  status: string;
  last_check_at: string | null;
  last_check_result: string | null;
  checking?: boolean;
}

const proxies = ref<Proxy[]>([]);
const loading = ref(false);
const dialogVisible = ref(false);
const isEdit = ref(false);
const submitting = ref(false);
const editingId = ref<string | null>(null);
const formRef = ref<FormInstance>();

const form = reactive({
  name: '',
  protocol: 'http',
  host: '',
  port: 7890,
  username: '',
  password: '',
});

const rules: FormRules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  protocol: [{ required: true, message: '请选择协议', trigger: 'change' }],
  host: [{ required: true, message: '请输入主机地址', trigger: 'blur' }],
  port: [{ required: true, message: '请输入端口', trigger: 'change' }],
};

onMounted(() => {
  loadProxies();
});

async function loadProxies() {
  loading.value = true;
  try {
    const result = await window.matrixflow.proxy.list();
    if (result.success && result.data) {
      proxies.value = result.data;
    }
  } catch (error) {
    ElMessage.error('加载代理列表失败');
  } finally {
    loading.value = false;
  }
}

function showCreateDialog() {
  isEdit.value = false;
  editingId.value = null;
  Object.assign(form, {
    name: '',
    protocol: 'http',
    host: '',
    port: 7890,
    username: '',
    password: '',
  });
  dialogVisible.value = true;
}

function showEditDialog(proxy: Proxy) {
  isEdit.value = true;
  editingId.value = proxy.id;
  Object.assign(form, {
    name: proxy.name,
    protocol: proxy.protocol,
    host: proxy.host,
    port: proxy.port,
    username: proxy.username || '',
    password: proxy.password || '',
  });
  dialogVisible.value = true;
}

async function submitForm() {
  if (!formRef.value) return;
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;

  submitting.value = true;
  try {
    const data = {
      name: form.name,
      protocol: form.protocol,
      host: form.host,
      port: form.port,
      username: form.username || undefined,
      password: form.password || undefined,
    };

    if (isEdit.value && editingId.value) {
      await window.matrixflow.proxy.update(editingId.value, data);
      ElMessage.success('代理已更新');
    } else {
      await window.matrixflow.proxy.create(data);
      ElMessage.success('代理已创建');
    }

    dialogVisible.value = false;
    await loadProxies();
  } catch (error) {
    ElMessage.error(isEdit.value ? '更新失败' : '创建失败');
  } finally {
    submitting.value = false;
  }
}

async function checkProxy(proxy: Proxy) {
  proxy.checking = true;
  try {
    const result = await window.matrixflow.proxy.check(proxy.id);
    if (result.success && result.data) {
      ElMessage[result.data.success ? 'success' : 'error'](result.data.message);
      await loadProxies();
    }
  } catch (error) {
    ElMessage.error('检测失败');
  } finally {
    proxy.checking = false;
  }
}

async function deleteProxy(proxy: Proxy) {
  try {
    await ElMessageBox.confirm(`确定删除代理 "${proxy.name}" 吗？`, '确认删除', {
      type: 'warning',
    });
    
    await window.matrixflow.proxy.delete(proxy.id);
    ElMessage.success('代理已删除');
    await loadProxies();
  } catch {
    // 用户取消
  }
}
</script>

<style scoped>
.proxy-pool-settings {
  padding: 16px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
}
</style>
