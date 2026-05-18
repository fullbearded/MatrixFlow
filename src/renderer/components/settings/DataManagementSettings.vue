<template>
  <div class="data-management-settings">
    <el-divider content-position="left">数据备份</el-divider>

    <div class="backup-section">
      <el-form label-width="120px">
        <el-form-item label="自动备份">
          <el-switch v-model="autoBackup" @change="handleAutoBackupChange" />
        </el-form-item>
        <el-form-item v-if="autoBackup" label="备份间隔">
          <el-select v-model="backupInterval" style="width: 150px;">
            <el-option label="每天" value="daily" />
            <el-option label="每周" value="weekly" />
            <el-option label="每月" value="monthly" />
          </el-select>
        </el-form-item>
        <el-form-item label="保留备份数">
          <el-input-number v-model="maxBackups" :min="1" :max="30" />
        </el-form-item>
      </el-form>

      <el-button type="primary" @click="handleCreateBackup" :loading="backingUp">
        <el-icon><Download /></el-icon>
        立即备份
      </el-button>
    </div>

    <el-divider content-position="left">备份历史</el-divider>

    <el-table :data="backups" v-loading="loadingBackups" style="width: 100%">
      <el-table-column prop="name" label="备份名称" min-width="200" />
      <el-table-column prop="size" label="大小" width="100">
        <template #default="{ row }">
          {{ formatSize(row.size) }}
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="创建时间" width="180">
        <template #default="{ row }">
          {{ formatDate(row.createdAt) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="handleRestore(row)" :loading="row.restoring">
            恢复
          </el-button>
          <el-button size="small" type="danger" @click="handleDeleteBackup(row)">
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-divider content-position="left">数据清理</el-divider>

    <div class="cleanup-section">
      <el-alert type="warning" :closable="false" show-icon style="margin-bottom: 16px;">
        <template #title>数据清理操作不可恢复，请谨慎操作</template>
      </el-alert>

      <div class="cleanup-actions">
        <el-button @click="handleClearLogs">
          清理日志文件
        </el-button>
        <el-button @click="handleClearCache">
          清理缓存数据
        </el-button>
        <el-button type="danger" @click="handleClearAllData">
          清空所有数据
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Download } from '@element-plus/icons-vue';

interface Backup {
  id: string;
  name: string;
  size: number;
  createdAt: string;
  restoring?: boolean;
}

const autoBackup = ref(false);
const backupInterval = ref('daily');
const maxBackups = ref(7);
const backingUp = ref(false);
const loadingBackups = ref(false);
const backups = ref<Backup[]>([]);

onMounted(() => {
  loadBackups();
  loadSettings();
});

async function loadSettings() {
  try {
    const enabled = await window.matrixflow.settings.get('backup.auto');
    const interval = await window.matrixflow.settings.get('backup.interval');
    const max = await window.matrixflow.settings.get('backup.maxBackups');
    autoBackup.value = enabled ?? false;
    backupInterval.value = interval ?? 'daily';
    maxBackups.value = max ?? 7;
  } catch {
    // ignore
  }
}

async function loadBackups() {
  loadingBackups.value = true;
  try {
    const result = await window.matrixflow.data.listBackups();
    if (result.success && result.data) {
      backups.value = result.data;
    }
  } catch {
    // ignore
  } finally {
    loadingBackups.value = false;
  }
}

async function handleAutoBackupChange(value: boolean) {
  await window.matrixflow.settings.set('backup.auto', value);
  ElMessage.success(value ? '已开启自动备份' : '已关闭自动备份');
}

async function handleCreateBackup() {
  backingUp.value = true;
  try {
    const result = await window.matrixflow.data.createBackup();
    if (result.success && result.data) {
      backups.value.unshift(result.data);
      ElMessage.success('备份创建成功');
    } else {
      ElMessage.error(result.message || '备份创建失败');
    }
  } catch {
    ElMessage.error('备份创建失败');
  } finally {
    backingUp.value = false;
  }
}

async function handleRestore(backup: Backup) {
  try {
    await ElMessageBox.confirm(
      `确定要从备份 "${backup.name}" 恢复数据吗？当前数据将被覆盖。`,
      '确认恢复',
      { type: 'warning' }
    );

    backup.restoring = true;
    const result = await window.matrixflow.data.restoreBackup(backup.id);
    if (result.success) {
      ElMessage.success('数据恢复成功，请重启应用');
    } else {
      ElMessage.error(result.message || '数据恢复失败');
    }
  } catch {
    // 用户取消
  } finally {
    backup.restoring = false;
  }
}

async function handleDeleteBackup(backup: Backup) {
  try {
    await ElMessageBox.confirm(`确定删除备份 "${backup.name}" 吗？`, '确认删除', { type: 'warning' });
    const result = await window.matrixflow.data.deleteBackup(backup.id);
    if (result.success) {
      backups.value = backups.value.filter(b => b.id !== backup.id);
      ElMessage.success('备份已删除');
    } else {
      ElMessage.error(result.message || '删除失败');
    }
  } catch {
    // 用户取消
  }
}

async function handleClearLogs() {
  try {
    await ElMessageBox.confirm('确定清理所有日志文件吗？', '确认清理', { type: 'warning' });
    const result = await window.matrixflow.data.clearData('logs');
    if (result.success) {
      ElMessage.success('日志文件已清理');
    } else {
      ElMessage.error(result.message || '清理失败');
    }
  } catch {
    // 用户取消
  }
}

async function handleClearCache() {
  try {
    await ElMessageBox.confirm('确定清理所有缓存数据吗？', '确认清理', { type: 'warning' });
    const result = await window.matrixflow.data.clearData('cache');
    if (result.success) {
      ElMessage.success('缓存数据已清理');
    } else {
      ElMessage.error(result.message || '清理失败');
    }
  } catch {
    // 用户取消
  }
}

async function handleClearAllData() {
  try {
    await ElMessageBox.confirm(
      '此操作将清空所有账号、发布记录、统计数据等，且不可恢复！确定继续吗？',
      '危险操作',
      { type: 'error', confirmButtonText: '确定清空', cancelButtonText: '取消' }
    );
    const result = await window.matrixflow.data.clearData('all');
    if (result.success) {
      ElMessage.success('数据已清空');
    } else {
      ElMessage.error(result.message || '清空失败');
    }
  } catch {
    // 用户取消
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('zh-CN');
}
</script>

<style scoped>
.data-management-settings {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.backup-section,
.cleanup-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cleanup-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
</style>
