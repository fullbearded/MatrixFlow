<template>
  <div class="fingerprint-settings">
    <div class="section-header">
      <h3>指纹模板管理</h3>
      <el-button type="primary" @click="showCreateDialog">
        <el-icon><Plus /></el-icon>
        创建模板
      </el-button>
    </div>

    <el-table :data="templates" v-loading="loading" style="width: 100%">
      <el-table-column prop="name" label="名称" width="150" />
      <el-table-column prop="platform" label="平台" width="100">
        <template #default="{ row }">
          <el-tag size="small">{{ getPlatformLabel(row.platform) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="user_agent" label="User Agent" min-width="200" show-overflow-tooltip />
      <el-table-column label="分辨率" width="120">
        <template #default="{ row }">
          {{ row.screen_width }}x{{ row.screen_height }}
        </template>
      </el-table-column>
      <el-table-column prop="language" label="语言" width="80" />
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="showEditDialog(row)">编辑</el-button>
          <el-button size="small" type="danger" @click="deleteTemplate(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑指纹模板' : '创建指纹模板'"
      width="550px"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="模板名称" />
        </el-form-item>
        <el-form-item label="平台" prop="platform">
          <el-select v-model="form.platform" style="width: 100%">
            <el-option label="抖音" value="douyin" />
            <el-option label="小红书" value="xiaohongshu" />
            <el-option label="视频号" value="wechat" />
            <el-option label="快手" value="kuaishou" />
            <el-option label="通用" value="generic" />
          </el-select>
        </el-form-item>
        <el-form-item label="User Agent">
          <el-input v-model="form.user_agent" type="textarea" :rows="2" placeholder="留空使用默认" />
        </el-form-item>
        <el-form-item label="屏幕宽度" prop="screen_width">
          <el-input-number v-model="form.screen_width" :min="800" :max="3840" style="width: 100%" />
        </el-form-item>
        <el-form-item label="屏幕高度" prop="screen_height">
          <el-input-number v-model="form.screen_height" :min="600" :max="2160" style="width: 100%" />
        </el-form-item>
        <el-form-item label="语言" prop="language">
          <el-input v-model="form.language" placeholder="zh-CN" />
        </el-form-item>
        <el-form-item label="WebGL Vendor">
          <el-input v-model="form.webgl_vendor" placeholder="Google Inc." />
        </el-form-item>
        <el-form-item label="WebGL Renderer">
          <el-input v-model="form.webgl_renderer" placeholder="ANGLE ..." />
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

interface FingerprintTemplate {
  id: string;
  name: string;
  platform: string;
  user_agent: string | null;
  screen_width: number;
  screen_height: number;
  language: string;
  webgl_vendor: string | null;
  webgl_renderer: string | null;
  extra_config: string;
}

const templates = ref<FingerprintTemplate[]>([]);
const loading = ref(false);
const dialogVisible = ref(false);
const isEdit = ref(false);
const submitting = ref(false);
const editingId = ref<string | null>(null);
const formRef = ref<FormInstance>();

const form = reactive({
  name: '',
  platform: 'generic',
  user_agent: '',
  screen_width: 1920,
  screen_height: 1080,
  language: 'zh-CN',
  webgl_vendor: '',
  webgl_renderer: '',
});

const rules: FormRules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  platform: [{ required: true, message: '请选择平台', trigger: 'change' }],
  screen_width: [{ required: true, message: '请输入宽度', trigger: 'change' }],
  screen_height: [{ required: true, message: '请输入高度', trigger: 'change' }],
  language: [{ required: true, message: '请输入语言', trigger: 'blur' }],
};

function getPlatformLabel(platform: string): string {
  const labels: Record<string, string> = {
    douyin: '抖音',
    xiaohongshu: '小红书',
    wechat: '视频号',
    kuaishou: '快手',
    generic: '通用',
  };
  return labels[platform] || platform;
}

onMounted(() => {
  loadTemplates();
});

async function loadTemplates() {
  loading.value = true;
  try {
    const result = await window.matrixflow.fingerprint.list();
    if (result.success && result.data) {
      templates.value = result.data;
    }
  } catch (error) {
    ElMessage.error('加载指纹模板失败');
  } finally {
    loading.value = false;
  }
}

function showCreateDialog() {
  isEdit.value = false;
  editingId.value = null;
  Object.assign(form, {
    name: '',
    platform: 'generic',
    user_agent: '',
    screen_width: 1920,
    screen_height: 1080,
    language: 'zh-CN',
    webgl_vendor: '',
    webgl_renderer: '',
  });
  dialogVisible.value = true;
}

function showEditDialog(template: FingerprintTemplate) {
  isEdit.value = true;
  editingId.value = template.id;
  Object.assign(form, {
    name: template.name,
    platform: template.platform,
    user_agent: template.user_agent || '',
    screen_width: template.screen_width,
    screen_height: template.screen_height,
    language: template.language,
    webgl_vendor: template.webgl_vendor || '',
    webgl_renderer: template.webgl_renderer || '',
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
      platform: form.platform,
      user_agent: form.user_agent || null,
      screen_width: form.screen_width,
      screen_height: form.screen_height,
      language: form.language,
      webgl_vendor: form.webgl_vendor || null,
      webgl_renderer: form.webgl_renderer || null,
      extra_config: '{}',
    };

    if (isEdit.value && editingId.value) {
      await window.matrixflow.fingerprint.update(editingId.value, data);
      ElMessage.success('模板已更新');
    } else {
      await window.matrixflow.fingerprint.create(data);
      ElMessage.success('模板已创建');
    }

    dialogVisible.value = false;
    await loadTemplates();
  } catch (error) {
    ElMessage.error(isEdit.value ? '更新失败' : '创建失败');
  } finally {
    submitting.value = false;
  }
}

async function deleteTemplate(template: FingerprintTemplate) {
  try {
    await ElMessageBox.confirm(`确定删除指纹模板 "${template.name}" 吗？`, '确认删除', {
      type: 'warning',
    });

    await window.matrixflow.fingerprint.delete(template.id);
    ElMessage.success('模板已删除');
    await loadTemplates();
  } catch {
    // 用户取消
  }
}
</script>

<style scoped>
.fingerprint-settings {
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
