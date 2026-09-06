<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import elementZhCn from 'element-plus/es/locale/lang/zh-cn'
import elementEn from 'element-plus/es/locale/lang/en'
import { getMagnetLink } from './api/rpc'
import { useSessionStore } from './stores/session'
import { useTorrentsStore } from './stores/torrents'
import { useUiStore } from './stores/ui'
import AppHeader from './components/layout/AppHeader.vue'
import AppToolbar from './components/layout/AppToolbar.vue'
import AppStatusBar from './components/layout/AppStatusBar.vue'
import SideNav from './components/layout/SideNav.vue'
import TorrentTable from './components/table/TorrentTable.vue'
import AttributePanel from './components/detail/AttributePanel.vue'
import AddTorrentDialog from './components/dialogs/AddTorrentDialog.vue'
import AddFilesDialog from './components/dialogs/AddFilesDialog.vue'
import RenameDialog from './components/dialogs/RenameDialog.vue'
import RemoveConfirmDialog from './components/dialogs/RemoveConfirmDialog.vue'
import ChangeDirDialog from './components/dialogs/ChangeDirDialog.vue'
import SpeedLimitDialog from './components/dialogs/SpeedLimitDialog.vue'
import SetLabelsDialog from './components/dialogs/SetLabelsDialog.vue'
import ReplaceTrackerDialog from './components/dialogs/ReplaceTrackerDialog.vue'
import AutoMatchFolderDialog from './components/dialogs/AutoMatchFolderDialog.vue'
import SystemConfigDialog from './components/dialogs/SystemConfigDialog.vue'
import StatisticsDialog from './components/dialogs/StatisticsDialog.vue'
import AboutDialog from './components/dialogs/AboutDialog.vue'

const { t } = useI18n()
const session = useSessionStore()
const torrents = useTorrentsStore()
const ui = useUiStore()

/** Element Plus widgets (pagination, dialogs) follow the UI locale too. */
const elementLocale = computed(() => (ui.locale === 'zh-CN' ? elementZhCn : elementEn))

const addUrlDialog = ref<InstanceType<typeof AddTorrentDialog>>()
const addFilesDialog = ref<InstanceType<typeof AddFilesDialog>>()
const renameDialog = ref<InstanceType<typeof RenameDialog>>()
const removeDialog = ref<InstanceType<typeof RemoveConfirmDialog>>()
const changeDirDialog = ref<InstanceType<typeof ChangeDirDialog>>()
const speedLimitDialog = ref<InstanceType<typeof SpeedLimitDialog>>()
const setLabelsDialog = ref<InstanceType<typeof SetLabelsDialog>>()
const replaceTrackerDialog = ref<InstanceType<typeof ReplaceTrackerDialog>>()
const autoMatchDialog = ref<InstanceType<typeof AutoMatchFolderDialog>>()
const systemConfigDialog = ref<InstanceType<typeof SystemConfigDialog>>()
const statisticsDialog = ref<InstanceType<typeof StatisticsDialog>>()
const aboutDialog = ref<InstanceType<typeof AboutDialog>>()

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/** Run an RPC action and surface failures as a toast. */
async function run(fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn()
  } catch (e) {
    ElMessage.error(t('message.actionFailed', { msg: errMsg(e) }))
  }
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success(t('message.copied'))
  } catch {
    ElMessage.error(t('message.copyFailed'))
  }
}

function copyPath(): void {
  const rows = torrents.selectedTorrents
  if (rows.length === 0) return
  const sep = rows[0].download_dir.includes('\\') ? '\\' : '/'
  void copyText(rows.map((r) => `${r.download_dir}${sep}${r.name}`).join('\n'))
}

async function copyMagnet(): Promise<void> {
  const row = torrents.selectedTorrents[0]
  if (!row) return
  try {
    const resp = await getMagnetLink(row.id)
    const link = resp.torrents[0]?.magnet_link
    if (link) await copyText(link)
  } catch (e) {
    ElMessage.error(t('message.actionFailed', { msg: errMsg(e) }))
  }
}

function onCommand(cmd: string): void {
  switch (cmd) {
    case 'add-url':
      addUrlDialog.value?.open()
      break
    case 'add-files':
      addFilesDialog.value?.open()
      break
    case 'rename':
      renameDialog.value?.open()
      break
    case 'remove':
      removeDialog.value?.open()
      break
    case 'change-dir':
      changeDirDialog.value?.open()
      break
    case 'speed-limit':
      speedLimitDialog.value?.open()
      break
    case 'set-labels':
      setLabelsDialog.value?.open()
      break
    case 'auto-match':
      autoMatchDialog.value?.open()
      break
    case 'replace-tracker':
      replaceTrackerDialog.value?.open()
      break
    case 'system-config':
      systemConfigDialog.value?.open()
      break
    case 'statistics':
      statisticsDialog.value?.open()
      break
    case 'about':
      aboutDialog.value?.open()
      break
    case 'toggle-alt-speed':
      void run(() => session.toggleAltSpeed())
      break
    case 'start':
      void run(() => torrents.start())
      break
    case 'stop':
      void run(() => torrents.stop())
      break
    case 'start-all':
      void run(() => torrents.startAll())
      break
    case 'stop-all':
      void run(() => torrents.stopAll())
      break
    case 'verify':
      void run(() => torrents.verify())
      break
    case 'reannounce':
      void run(() => torrents.reannounce())
      break
    case 'queue-top':
      void run(() => torrents.queueMove('top'))
      break
    case 'queue-up':
      void run(() => torrents.queueMove('up'))
      break
    case 'queue-down':
      void run(() => torrents.queueMove('down'))
      break
    case 'queue-bottom':
      void run(() => torrents.queueMove('bottom'))
      break
    case 'copy-path':
      copyPath()
      break
    case 'copy-magnet':
      void copyMagnet()
      break
  }
}

// Drag & drop .torrent files anywhere → AddFilesDialog pre-loaded.
function onDragOver(e: DragEvent): void {
  e.preventDefault()
}

function onDrop(e: DragEvent): void {
  e.preventDefault()
  const files = [...(e.dataTransfer?.files ?? [])].filter((f) =>
    f.name.toLowerCase().endsWith('.torrent'),
  )
  if (files.length > 0) addFilesDialog.value?.openWithFiles(files)
}

onMounted(async () => {
  window.addEventListener('dragover', onDragOver)
  window.addEventListener('drop', onDrop)
  try {
    await session.init()
    if (ui.autoRefresh) torrents.startPolling(ui.refreshIntervalMs)
  } catch {
    // Connection failure is surfaced through session.lastError.
  }
})

// Apply auto-refresh preference changes immediately: the interval is
// captured by the polling closure, so the loop must be restarted.
watch([() => ui.autoRefresh, () => ui.refreshIntervalMs], ([enabled, intervalMs]) => {
  if (!session.connected) return
  if (enabled) torrents.startPolling(intervalMs)
  else torrents.stopPolling()
})

onBeforeUnmount(() => {
  window.removeEventListener('dragover', onDragOver)
  window.removeEventListener('drop', onDrop)
  torrents.stopPolling()
})
</script>

<template>
  <el-config-provider :locale="elementLocale">
    <div class="app-shell">
      <AppHeader />

      <div v-if="session.lastError || (session.connected && !session.supported)" class="banners">
        <el-alert
          v-if="session.lastError"
          type="error"
          :closable="false"
          :title="t('session.connectFailed')"
          :description="session.lastError"
        />
        <el-alert
          v-else-if="session.connected && !session.supported"
          type="warning"
          :closable="false"
          :title="t('session.unsupported', { version: session.rpcVersionSemver || '?' })"
        />
      </div>

      <AppToolbar @command="onCommand" />

      <div class="main-area">
        <SideNav />
        <main class="center">
          <div v-if="!session.connected && !session.lastError" class="connecting">
            <p class="connecting-text">{{ t('session.connecting') }}</p>
            <el-skeleton :rows="10" animated />
          </div>
          <template v-else>
            <TorrentTable @command="onCommand" />
            <AttributePanel v-if="torrents.selectedId != null" />
          </template>
        </main>
      </div>

      <AppStatusBar @command="onCommand" />

      <AddTorrentDialog ref="addUrlDialog" />
      <AddFilesDialog ref="addFilesDialog" />
      <RenameDialog ref="renameDialog" />
      <RemoveConfirmDialog ref="removeDialog" />
      <ChangeDirDialog ref="changeDirDialog" />
      <SpeedLimitDialog ref="speedLimitDialog" />
      <SetLabelsDialog ref="setLabelsDialog" />
      <ReplaceTrackerDialog ref="replaceTrackerDialog" />
      <AutoMatchFolderDialog ref="autoMatchDialog" />
      <SystemConfigDialog ref="systemConfigDialog" />
      <StatisticsDialog ref="statisticsDialog" />
      <AboutDialog ref="aboutDialog" />
    </div>
  </el-config-provider>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.banners {
  flex: none;
}

.main-area {
  flex: 1;
  display: flex;
  min-height: 0;
}

.center {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.connecting {
  padding: 16px;
  color: var(--twui-text-secondary);
}

.connecting-text {
  margin: 0 0 12px;
}
</style>
