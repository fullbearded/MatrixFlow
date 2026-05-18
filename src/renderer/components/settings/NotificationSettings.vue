<template>
  <div class="notification-settings">
    <div class="settings-section">
      <div class="section-title">
        <h4>桌面通知</h4>
        <p class="section-desc">接收监控告警和异常检测的桌面通知提醒</p>
      </div>

      <el-form label-width="110px">
        <el-form-item label="启用通知">
          <el-switch
            v-model="settings.settings.notificationEnabled"
            @change="(v: boolean) => settings.updateSetting('notificationEnabled', v)"
          />
        </el-form-item>

        <template v-if="settings.settings.notificationEnabled">
          <el-form-item label="通知声音">
            <el-switch
              v-model="settings.settings.notificationSound"
              @change="(v: boolean) => settings.updateSetting('notificationSound', v)"
            />
          </el-form-item>

          <el-divider content-position="left">通知来源</el-divider>

          <el-form-item label="监控告警">
            <el-switch
              v-model="settings.settings.notificationMonitorAlerts"
              @change="(v: boolean) => settings.updateSetting('notificationMonitorAlerts', v)"
            />
          </el-form-item>

          <el-form-item label="异常检测告警">
            <el-switch
              v-model="settings.settings.notificationAnomalyAlerts"
              @change="(v: boolean) => settings.updateSetting('notificationAnomalyAlerts', v)"
            />
          </el-form-item>

          <el-divider content-position="left">过滤</el-divider>

          <el-form-item label="仅严重告警">
            <el-switch
              v-model="settings.settings.notificationCriticalOnly"
              @change="(v: boolean) => settings.updateSetting('notificationCriticalOnly', v)"
            />
            <p class="settings-hint">开启后仅接收严重级别的告警通知</p>
          </el-form-item>

          <el-divider content-position="left">测试</el-divider>

          <el-form-item>
            <el-button @click="sendTestNotification" :loading="testing">
              发送测试通知
            </el-button>
          </el-form-item>
        </template>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useSettingsStore } from '@/renderer/stores/settings';

const settings = useSettingsStore();
const testing = ref(false);

async function sendTestNotification() {
  testing.value = true;
  try {
    await window.matrixflow.notification.test();
    ElMessage.success('测试通知已发送');
  } catch {
    ElMessage.error('发送测试通知失败');
  } finally {
    testing.value = false;
  }
}
</script>

<style scoped>
.notification-settings {
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

.settings-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin: 4px 0 0 0;
  line-height: 1.5;
}
</style>
