<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { DataAnalysis, InfoFilled } from '@element-plus/icons-vue'
import { useSessionStore } from '../../stores/session'
import { useTorrentsStore } from '../../stores/torrents'
import { formatBytes, formatSpeed } from '../../utils/format'

const emit = defineEmits<{ command: [cmd: string] }>()

const { t } = useI18n()
const session = useSessionStore()
const torrents = useTorrentsStore()
</script>

<template>
  <footer class="app-statusbar">
    <span v-if="torrents.lastPollError" class="poll-error" :title="torrents.lastPollError">
      ⚠ {{ t('statusbar.disconnected') }}
    </span>
    <span>{{ t('statusbar.torrents') }}: {{ torrents.rows.length }}</span>
    <span class="sep" />
    <span class="down">↓ {{ formatSpeed(session.stats?.download_speed ?? 0) }}</span>
    <span class="up">↑ {{ formatSpeed(session.stats?.upload_speed ?? 0) }}</span>
    <span class="sep" />
    <span>
      {{ t('statusbar.free') }}:
      {{ session.freeSpace ? formatBytes(session.freeSpace.size_bytes) : '-' }}
    </span>
    <span class="spacer" />
    <span v-if="session.connected">Transmission {{ session.daemonVersion }}</span>
    <el-button
      text
      size="small"
      class="stats-btn"
      :title="t('statistics.title')"
      @click="emit('command', 'statistics')"
    >
      <el-icon><DataAnalysis /></el-icon>
    </el-button>
    <el-button
      text
      size="small"
      class="stats-btn"
      :title="t('about.title')"
      @click="emit('command', 'about')"
    >
      <el-icon><InfoFilled /></el-icon>
    </el-button>
  </footer>
</template>

<style scoped>
.app-statusbar {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 24px;
  padding: 0 12px;
  flex: none;
  font-size: 12px;
  color: var(--twui-text-secondary);
  background: var(--twui-toolbar-bg);
  border-top: 1px solid var(--twui-border);
}

.stats-btn {
  padding: 0 4px;
  height: 20px;
  color: var(--twui-text-secondary);
}

.stats-btn:hover {
  color: var(--twui-text-primary, #303133);
}

.sep {
  width: 1px;
  height: 12px;
  background: var(--twui-border);
}

.spacer {
  flex: 1;
}

.down {
  color: #409eff;
}

.up {
  color: #67c23a;
}

.poll-error {
  color: var(--twui-error);
  font-weight: 600;
}
</style>
