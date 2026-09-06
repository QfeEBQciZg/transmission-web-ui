<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSessionStore } from '../../stores/session'
import { formatBytes, formatDuration } from '../../utils/format'

/** Transfer statistics dialog (sidebar "传输统计" node). */
const { t } = useI18n()
const session = useSessionStore()

const visible = ref(false)

function open(): void {
  visible.value = true
}

defineExpose({ open })
</script>

<template>
  <el-dialog v-model="visible" :title="t('statistics.title')" width="560px">
    <template v-if="session.stats">
      <h4 class="section">{{ t('statistics.current') }}</h4>
      <el-descriptions :column="2" border size="small">
        <el-descriptions-item :label="t('statistics.uploaded')">
          {{ formatBytes(session.stats.current_stats.uploaded_bytes) }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('statistics.downloaded')">
          {{ formatBytes(session.stats.current_stats.downloaded_bytes) }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('statistics.filesAdded')">
          {{ session.stats.current_stats.files_added }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('statistics.activeTime')">
          {{ formatDuration(session.stats.current_stats.seconds_active) }}
        </el-descriptions-item>
      </el-descriptions>

      <h4 class="section">{{ t('statistics.cumulative') }}</h4>
      <el-descriptions :column="2" border size="small">
        <el-descriptions-item :label="t('statistics.uploaded')">
          {{ formatBytes(session.stats.cumulative_stats.uploaded_bytes) }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('statistics.downloaded')">
          {{ formatBytes(session.stats.cumulative_stats.downloaded_bytes) }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('statistics.filesAdded')">
          {{ session.stats.cumulative_stats.files_added }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('statistics.activeTime')">
          {{ formatDuration(session.stats.cumulative_stats.seconds_active) }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('statistics.sessionCount')">
          {{ session.stats.cumulative_stats.session_count }}
        </el-descriptions-item>
      </el-descriptions>
    </template>
  </el-dialog>
</template>

<style scoped>
.section {
  margin: 0 0 8px;
  font-size: 13px;
}

.section + .el-descriptions {
  margin-bottom: 16px;
}
</style>
