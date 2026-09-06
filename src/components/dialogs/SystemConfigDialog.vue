<script setup lang="ts">
import { computed, nextTick, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { blocklistUpdate, freeSpace, portTest } from '../../api/rpc'
import { useSessionStore } from '../../stores/session'
import { useTorrentsStore } from '../../stores/torrents'
import { useUiStore } from '../../stores/ui'
import { formatBytes, labelColor } from '../../utils/format'
import LabelChips from '../table/LabelChips.vue'
import ImportConfigDialog from './ImportConfigDialog.vue'
import ExportConfigDialog from './ExportConfigDialog.vue'

/**
 * System settings dialog.
 */
const { t } = useI18n()
const session = useSessionStore()
const torrents = useTorrentsStore()
const ui = useUiStore()

const visible = ref(false)
const saving = ref(false)
const activeTab = ref('basic')

/** Daemon-editable fields (session_set keys). */
const form = reactive({
  download_dir: '',
  incomplete_dir_enabled: false,
  incomplete_dir: '',
  rename_partial_files: true,
  start_added_torrents: true,
  cache_size_mib: 4,
  script_torrent_done_enabled: false,
  script_torrent_done_filename: '',
  peer_port: 51413,
  peer_port_random_on_start: false,
  port_forwarding_enabled: true,
  encryption: 'preferred',
  utp_enabled: true,
  dht_enabled: true,
  lpd_enabled: true,
  pex_enabled: true,
  peer_limit_global: 200,
  peer_limit_per_torrent: 50,
  blocklist_enabled: false,
  blocklist_url: '',
  speed_limit_down_enabled: false,
  speed_limit_down: 100,
  speed_limit_up_enabled: false,
  speed_limit_up: 100,
  seed_ratio_limited: false,
  seed_ratio_limit: 2,
  idle_seeding_limit_enabled: false,
  idle_seeding_limit: 30,
  queue_stalled_enabled: true,
  queue_stalled_minutes: 30,
  download_queue_enabled: true,
  download_queue_size: 5,
  seed_queue_enabled: false,
  seed_queue_size: 5,
  alt_speed_enabled: false,
  alt_speed_down: 50,
  alt_speed_up: 50,
  alt_speed_time_enabled: false,
  alt_speed_time_begin: 540,
  alt_speed_time_end: 1020,
  alt_speed_time_day: 127,
  default_trackers: '',
})

const freeSpaceText = ref('')
/** Folders-dictionary draft (one directory per line), persisted to the
 *  UI store on save — it is a localStorage pref, not a daemon field. */
const folderDictText = ref('')

/** UI-pref drafts for the More tab (applied on save, like the folders
 *  dictionary — cancel discards them). */
const moreAutoRefresh = ref(true)
const moreRefreshSeconds = ref(5)
const morePageSize = ref(50)

const presetLabelsList = ref<string[]>([])
const newTagInputVisible = ref(false)
const newTagValue = ref('')
const newTagInputRef = ref<{ focus: () => void } | null>(null)

const importDialog = ref<InstanceType<typeof ImportConfigDialog>>()
const exportDialog = ref<InstanceType<typeof ExportConfigDialog>>()

function showNewTagInput(): void {
  newTagInputVisible.value = true
  void nextTick(() => {
    newTagInputRef.value?.focus()
  })
}

function confirmAddPresetTag(): void {
  const val = newTagValue.value.trim()
  if (val && !presetLabelsList.value.includes(val)) {
    presetLabelsList.value.push(val)
  }
  newTagInputVisible.value = false
  newTagValue.value = ''
}

function removePresetTag(tag: string): void {
  presetLabelsList.value = presetLabelsList.value.filter((t) => t !== tag)
}

async function batchClearLabel(labelName: string): Promise<void> {
  const affected = Object.values(torrents.all).filter((t) => (t.labels ?? []).includes(labelName))
  if (affected.length === 0) return
  try {
    for (const t of affected) {
      const updated = (t.labels ?? []).filter((l) => l !== labelName)
      await torrents.setLabels([t.id], updated)
    }
    ElMessage.success(t('dialog.config.labels.cleared', { count: affected.length }))
  } catch (e) {
    ElMessage.error(t('message.actionFailed', { msg: e instanceof Error ? e.message : String(e) }))
  }
}

/** Port-test state: '' = not run yet. */
const portTesting = ref(false)
const portTestResult = ref<'' | 'open' | 'closed'>('')

const blocklistUpdating = ref(false)

/** RPC stores the alt-speed schedule as minutes from midnight; the
 *  time-select works with "HH:mm" strings, so bridge the two. */
function minutesToTime(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
function timeToMinutes(v: string): number {
  const [h, m] = v.split(':').map(Number)
  return h * 60 + m
}

const altTimeBegin = computed({
  get: () => minutesToTime(form.alt_speed_time_begin),
  set: (v: string) => {
    form.alt_speed_time_begin = timeToMinutes(v)
  },
})
const altTimeEnd = computed({
  get: () => minutesToTime(form.alt_speed_time_end),
  set: (v: string) => {
    form.alt_speed_time_end = timeToMinutes(v)
  },
})

/** alt_speed_time_day bitmask presets (Sun=1 … Sat=64). */
const altDayOptions = [127, 62, 65, 1, 2, 4, 8, 16, 32, 64] as const

async function queryFreeSpace(dir: string): Promise<void> {
  if (!dir) {
    freeSpaceText.value = ''
    return
  }
  try {
    const fs = await freeSpace(dir)
    freeSpaceText.value = t('dialog.config.basic.freeSpace', { size: formatBytes(fs.size_bytes) })
  } catch {
    freeSpaceText.value = '-'
  }
}

function open(): void {
  const s = session.session
  if (s) {
    form.download_dir = s.download_dir ?? ''
    form.incomplete_dir_enabled = s.incomplete_dir_enabled ?? false
    form.incomplete_dir = s.incomplete_dir ?? ''
    form.rename_partial_files = s.rename_partial_files ?? true
    form.start_added_torrents = s.start_added_torrents ?? true
    form.cache_size_mib = s.cache_size_mib ?? 4
    form.script_torrent_done_enabled = s.script_torrent_done_enabled ?? false
    form.script_torrent_done_filename = s.script_torrent_done_filename ?? ''
    form.peer_port = s.peer_port ?? 51413
    form.peer_port_random_on_start = s.peer_port_random_on_start ?? false
    form.port_forwarding_enabled = s.port_forwarding_enabled ?? true
    form.encryption = s.encryption ?? 'preferred'
    form.utp_enabled = s.utp_enabled ?? true
    form.dht_enabled = s.dht_enabled ?? true
    form.lpd_enabled = s.lpd_enabled ?? true
    form.pex_enabled = s.pex_enabled ?? true
    form.peer_limit_global = s.peer_limit_global ?? 200
    form.peer_limit_per_torrent = s.peer_limit_per_torrent ?? 50
    form.blocklist_enabled = s.blocklist_enabled ?? false
    form.blocklist_url = s.blocklist_url ?? ''
    form.speed_limit_down_enabled = s.speed_limit_down_enabled ?? false
    form.speed_limit_down = s.speed_limit_down ?? 100
    form.speed_limit_up_enabled = s.speed_limit_up_enabled ?? false
    form.speed_limit_up = s.speed_limit_up ?? 100
    form.seed_ratio_limited = s.seed_ratio_limited ?? false
    form.seed_ratio_limit = s.seed_ratio_limit ?? 2
    form.idle_seeding_limit_enabled = s.idle_seeding_limit_enabled ?? false
    form.idle_seeding_limit = s.idle_seeding_limit ?? 30
    form.queue_stalled_enabled = s.queue_stalled_enabled ?? true
    form.queue_stalled_minutes = s.queue_stalled_minutes ?? 30
    form.download_queue_enabled = s.download_queue_enabled ?? true
    form.download_queue_size = s.download_queue_size ?? 5
    form.seed_queue_enabled = s.seed_queue_enabled ?? false
    form.seed_queue_size = s.seed_queue_size ?? 5
    form.alt_speed_enabled = s.alt_speed_enabled ?? false
    form.alt_speed_down = s.alt_speed_down ?? 50
    form.alt_speed_up = s.alt_speed_up ?? 50
    form.alt_speed_time_enabled = s.alt_speed_time_enabled ?? false
    form.alt_speed_time_begin = s.alt_speed_time_begin ?? 540
    form.alt_speed_time_end = s.alt_speed_time_end ?? 1020
    form.alt_speed_time_day = s.alt_speed_time_day ?? 127
    form.default_trackers = s.default_trackers ?? ''
  }
  activeTab.value = 'basic'
  portTestResult.value = ''
  folderDictText.value = ui.folderDictionary.join('\n')
  moreAutoRefresh.value = ui.autoRefresh
  moreRefreshSeconds.value = Math.round(ui.refreshIntervalMs / 1000)
  morePageSize.value = ui.pageSize
  presetLabelsList.value = [...ui.presetLabels]
  visible.value = true
  void queryFreeSpace(form.download_dir)
}

defineExpose({ open })

async function save(): Promise<void> {
  if (saving.value) return
  saving.value = true
  try {
    ui.setFolderDictionary(
      folderDictText.value
        .split('\n')
        .map((d) => d.trim())
        .filter(Boolean),
    )
    ui.setAutoRefresh(moreAutoRefresh.value, moreRefreshSeconds.value * 1000)
    ui.setPageSize(morePageSize.value)
    ui.setPresetLabels([...presetLabelsList.value])
    await session.saveSession({ ...form })
    void session.refreshFreeSpace()
    ElMessage.success(t('options.saved'))
    visible.value = false
  } catch (e) {
    ElMessage.error(t('message.actionFailed', { msg: e instanceof Error ? e.message : String(e) }))
  } finally {
    saving.value = false
  }
}

function restoreDefaults(): void {
  ui.resetToDefaults()
  ElMessage.success(t('options.saved'))
}

function restoreHiddenDirs(): void {
  ui.restoreKnownDirs()
  ElMessage.success(t('dialog.config.folders.restoreHidden'))
}

async function testPort(): Promise<void> {
  if (portTesting.value) return
  portTesting.value = true
  portTestResult.value = ''
  try {
    const r = await portTest()
    portTestResult.value = r.port_is_open ? 'open' : 'closed'
  } catch (e) {
    ElMessage.error(t('message.actionFailed', { msg: e instanceof Error ? e.message : String(e) }))
  } finally {
    portTesting.value = false
  }
}

async function updateBlocklist(): Promise<void> {
  if (blocklistUpdating.value) return
  blocklistUpdating.value = true
  try {
    const r = await blocklistUpdate()
    await session.refreshSession()
    ElMessage.success(t('dialog.config.network.blocklistUpdated', { count: r.blocklist_size }))
  } catch (e) {
    ElMessage.error(t('message.actionFailed', { msg: e instanceof Error ? e.message : String(e) }))
  } finally {
    blocklistUpdating.value = false
  }
}
</script>

<template>
  <el-dialog v-model="visible" :title="t('dialog.config.title')" width="620px">
    <el-tabs v-model="activeTab">
      <el-tab-pane :label="t('dialog.config.tabs.basic')" name="basic">
        <el-form label-width="150px" label-position="left" class="basic-form">
          <el-form-item :label="t('dialog.config.basic.downloadDir')">
            <el-input v-model="form.download_dir" @blur="queryFreeSpace(form.download_dir)">
              <template #append>{{ freeSpaceText }}</template>
            </el-input>
          </el-form-item>
          <el-form-item label=" ">
            <el-checkbox v-model="form.incomplete_dir_enabled">
              {{ t('dialog.config.basic.incompleteDirEnabled') }}
            </el-checkbox>
          </el-form-item>
          <el-form-item :label="t('dialog.config.basic.incompleteDir')">
            <el-input v-model="form.incomplete_dir" :disabled="!form.incomplete_dir_enabled" />
          </el-form-item>
          <el-form-item label=" ">
            <el-checkbox v-model="form.rename_partial_files">
              {{ t('dialog.config.basic.renamePartial') }}
            </el-checkbox>
          </el-form-item>
          <el-form-item label=" ">
            <el-checkbox v-model="form.start_added_torrents">
              {{ t('dialog.config.basic.startAdded') }}
            </el-checkbox>
          </el-form-item>
          <el-form-item :label="t('dialog.config.basic.cacheSize')">
            <el-input-number v-model="form.cache_size_mib" :min="1" controls-position="right" />
          </el-form-item>
          <el-form-item label=" ">
            <el-checkbox v-model="form.script_torrent_done_enabled">
              {{ t('dialog.config.basic.doneScriptEnabled') }}
            </el-checkbox>
          </el-form-item>
          <el-form-item :label="t('dialog.config.basic.doneScript')">
            <el-input
              v-model="form.script_torrent_done_filename"
              :disabled="!form.script_torrent_done_enabled"
            />
          </el-form-item>
          <el-form-item :label="t('dialog.config.basic.configDir')">
            <el-input :model-value="session.session?.config_dir ?? ''" readonly />
          </el-form-item>
          <el-form-item :label="t('dialog.config.basic.language')">
            <el-select
              :model-value="ui.locale"
              class="lang"
              @change="(v: 'zh-CN' | 'en') => ui.setLocale(v)"
            >
              <el-option value="zh-CN" label="简体中文" />
              <el-option value="en" label="English" />
            </el-select>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <el-tab-pane :label="t('dialog.config.tabs.network')" name="network">
        <el-form label-width="150px" label-position="left" class="basic-form">
          <el-form-item :label="t('dialog.config.network.peerPort')">
            <el-input-number
              v-model="form.peer_port"
              :min="1"
              :max="65535"
              controls-position="right"
            />
            <el-button class="inline-btn" :loading="portTesting" @click="testPort">
              {{ t('dialog.config.network.testPort') }}
            </el-button>
            <span v-if="portTestResult" class="port-result">
              {{
                portTestResult === 'open'
                  ? t('dialog.config.network.portOpen')
                  : t('dialog.config.network.portClosed')
              }}
            </span>
          </el-form-item>
          <el-form-item label=" ">
            <el-checkbox v-model="form.peer_port_random_on_start">
              {{ t('dialog.config.network.randomPort') }}
            </el-checkbox>
          </el-form-item>
          <el-form-item label=" ">
            <el-checkbox v-model="form.port_forwarding_enabled">
              {{ t('dialog.config.network.portForwarding') }}
            </el-checkbox>
          </el-form-item>
          <el-form-item :label="t('dialog.config.network.encryption')">
            <el-select v-model="form.encryption" class="lang">
              <el-option value="required" :label="t('dialog.config.network.encryptionRequired')" />
              <el-option
                value="preferred"
                :label="t('dialog.config.network.encryptionPreferred')"
              />
              <el-option
                value="tolerated"
                :label="t('dialog.config.network.encryptionTolerated')"
              />
            </el-select>
          </el-form-item>
          <el-form-item label=" ">
            <el-checkbox v-model="form.utp_enabled">{{
              t('dialog.config.network.utp')
            }}</el-checkbox>
            <el-checkbox v-model="form.dht_enabled">{{
              t('dialog.config.network.dht')
            }}</el-checkbox>
            <el-checkbox v-model="form.lpd_enabled">{{
              t('dialog.config.network.lpd')
            }}</el-checkbox>
            <el-checkbox v-model="form.pex_enabled">{{
              t('dialog.config.network.pex')
            }}</el-checkbox>
          </el-form-item>
          <el-form-item :label="t('dialog.config.network.peerLimitGlobal')">
            <el-input-number v-model="form.peer_limit_global" :min="1" controls-position="right" />
          </el-form-item>
          <el-form-item :label="t('dialog.config.network.peerLimitPerTorrent')">
            <el-input-number
              v-model="form.peer_limit_per_torrent"
              :min="1"
              controls-position="right"
            />
          </el-form-item>
          <el-form-item label=" ">
            <el-checkbox v-model="form.blocklist_enabled">
              {{ t('dialog.config.network.blocklistEnabled') }}
            </el-checkbox>
            <span v-if="session.session" class="blocklist-size">
              {{
                t('dialog.config.network.blocklistSize', { count: session.session.blocklist_size })
              }}
            </span>
          </el-form-item>
          <el-form-item :label="t('dialog.config.network.blocklistUrl')">
            <el-input v-model="form.blocklist_url" :disabled="!form.blocklist_enabled">
              <template #append>
                <el-button
                  :disabled="!form.blocklist_enabled"
                  :loading="blocklistUpdating"
                  @click="updateBlocklist"
                >
                  {{ t('dialog.config.network.blocklistUpdate') }}
                </el-button>
              </template>
            </el-input>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <el-tab-pane :label="t('dialog.config.tabs.limit')" name="limit">
        <el-form label-width="150px" label-position="left" class="basic-form">
          <el-form-item label=" ">
            <el-checkbox v-model="form.speed_limit_down_enabled">
              {{ t('dialog.config.limit.downEnabled') }}
            </el-checkbox>
          </el-form-item>
          <el-form-item :label="t('dialog.config.limit.down')">
            <el-input-number
              v-model="form.speed_limit_down"
              :min="1"
              :disabled="!form.speed_limit_down_enabled"
              controls-position="right"
            />
          </el-form-item>
          <el-form-item label=" ">
            <el-checkbox v-model="form.speed_limit_up_enabled">
              {{ t('dialog.config.limit.upEnabled') }}
            </el-checkbox>
          </el-form-item>
          <el-form-item :label="t('dialog.config.limit.up')">
            <el-input-number
              v-model="form.speed_limit_up"
              :min="1"
              :disabled="!form.speed_limit_up_enabled"
              controls-position="right"
            />
          </el-form-item>
          <el-form-item label=" ">
            <el-checkbox v-model="form.seed_ratio_limited">
              {{ t('dialog.config.limit.seedRatioEnabled') }}
            </el-checkbox>
          </el-form-item>
          <el-form-item :label="t('dialog.config.limit.seedRatio')">
            <el-input-number
              v-model="form.seed_ratio_limit"
              :min="0"
              :step="0.1"
              :disabled="!form.seed_ratio_limited"
              controls-position="right"
            />
          </el-form-item>
          <el-form-item label=" ">
            <el-checkbox v-model="form.idle_seeding_limit_enabled">
              {{ t('dialog.config.limit.idleEnabled') }}
            </el-checkbox>
          </el-form-item>
          <el-form-item :label="t('dialog.config.limit.idleMinutes')">
            <el-input-number
              v-model="form.idle_seeding_limit"
              :min="1"
              :disabled="!form.idle_seeding_limit_enabled"
              controls-position="right"
            />
          </el-form-item>
          <el-form-item label=" ">
            <el-checkbox v-model="form.queue_stalled_enabled">
              {{ t('dialog.config.limit.queueStalledEnabled') }}
            </el-checkbox>
          </el-form-item>
          <el-form-item :label="t('dialog.config.limit.queueStalledMinutes')">
            <el-input-number
              v-model="form.queue_stalled_minutes"
              :min="1"
              :disabled="!form.queue_stalled_enabled"
              controls-position="right"
            />
          </el-form-item>
          <el-form-item label=" ">
            <el-checkbox v-model="form.download_queue_enabled">
              {{ t('dialog.config.limit.downloadQueueEnabled') }}
            </el-checkbox>
          </el-form-item>
          <el-form-item :label="t('dialog.config.limit.downloadQueueSize')">
            <el-input-number
              v-model="form.download_queue_size"
              :min="1"
              :disabled="!form.download_queue_enabled"
              controls-position="right"
            />
          </el-form-item>
          <el-form-item label=" ">
            <el-checkbox v-model="form.seed_queue_enabled">
              {{ t('dialog.config.limit.seedQueueEnabled') }}
            </el-checkbox>
          </el-form-item>
          <el-form-item :label="t('dialog.config.limit.seedQueueSize')">
            <el-input-number
              v-model="form.seed_queue_size"
              :min="1"
              :disabled="!form.seed_queue_enabled"
              controls-position="right"
            />
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <el-tab-pane :label="t('dialog.config.tabs.altSpeed')" name="altSpeed">
        <el-form label-width="150px" label-position="left" class="basic-form">
          <el-form-item label=" ">
            <el-checkbox v-model="form.alt_speed_enabled">
              {{ t('dialog.config.altSpeed.enabled') }}
            </el-checkbox>
          </el-form-item>
          <el-form-item :label="t('dialog.config.altSpeed.down')">
            <el-input-number v-model="form.alt_speed_down" :min="1" controls-position="right" />
          </el-form-item>
          <el-form-item :label="t('dialog.config.altSpeed.up')">
            <el-input-number v-model="form.alt_speed_up" :min="1" controls-position="right" />
          </el-form-item>
          <el-form-item label=" ">
            <el-checkbox v-model="form.alt_speed_time_enabled">
              {{ t('dialog.config.altSpeed.scheduleEnabled') }}
            </el-checkbox>
          </el-form-item>
          <el-form-item :label="t('dialog.config.altSpeed.time')">
            <el-time-select
              v-model="altTimeBegin"
              :disabled="!form.alt_speed_time_enabled"
              start="00:00"
              step="00:15"
              end="23:45"
              :placeholder="t('dialog.config.altSpeed.timeBegin')"
              class="alt-time"
            />
            <span class="alt-time-sep">–</span>
            <el-time-select
              v-model="altTimeEnd"
              :disabled="!form.alt_speed_time_enabled"
              start="00:00"
              step="00:15"
              end="23:45"
              :placeholder="t('dialog.config.altSpeed.timeEnd')"
              class="alt-time"
            />
          </el-form-item>
          <el-form-item :label="t('dialog.config.altSpeed.days')">
            <el-select
              v-model="form.alt_speed_time_day"
              :disabled="!form.alt_speed_time_enabled"
              class="lang"
            >
              <el-option
                v-for="day in altDayOptions"
                :key="day"
                :value="day"
                :label="t(`dialog.config.altSpeed.day.${day}`)"
              />
            </el-select>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <el-tab-pane :label="t('dialog.config.tabs.folders')" name="folders">
        <el-form label-position="top" class="basic-form">
          <el-form-item :label="t('dialog.config.folders.hint')">
            <el-input
              v-model="folderDictText"
              type="textarea"
              :rows="10"
              :placeholder="t('dialog.config.folders.placeholder')"
            />
          </el-form-item>
          <div v-if="ui.hiddenDownloadDirs.length > 0" class="dict-restore-bar">
            <span>{{
              t('dialog.config.folders.hiddenTip', { count: ui.hiddenDownloadDirs.length })
            }}</span>
            <el-button link type="primary" size="small" @click="restoreHiddenDirs">
              {{ t('dialog.config.folders.restoreHidden') }}
            </el-button>
          </div>
        </el-form>
      </el-tab-pane>

      <el-tab-pane :label="t('dialog.config.tabs.more')" name="more">
        <el-form label-width="150px" label-position="left" class="basic-form">
          <el-form-item label=" ">
            <el-checkbox v-model="moreAutoRefresh">
              {{ t('dialog.config.more.autoRefresh') }}
            </el-checkbox>
          </el-form-item>
          <el-form-item :label="t('dialog.config.more.refreshInterval')">
            <el-input-number
              v-model="moreRefreshSeconds"
              :min="3"
              :disabled="!moreAutoRefresh"
              controls-position="right"
            />
          </el-form-item>
          <el-form-item :label="t('dialog.config.more.pageSize')">
            <el-select v-model="morePageSize" class="lang">
              <el-option v-for="s in [20, 50, 100]" :key="s" :value="s" :label="String(s)" />
              <el-option :value="0" :label="t('table.all')" />
            </el-select>
          </el-form-item>
          <el-form-item :label="t('dialog.config.more.defaultTrackers')">
            <el-input
              v-model="form.default_trackers"
              type="textarea"
              :rows="5"
              :placeholder="t('dialog.config.more.defaultTrackersHint')"
            />
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <el-tab-pane :label="t('dialog.config.tabs.labels')" name="labels">
        <div class="labels-config">
          <div class="labels-section">
            <div class="section-title">{{ t('dialog.config.labels.presetTitle') }}</div>
            <div class="section-hint">{{ t('dialog.config.labels.presetHint') }}</div>
            <div class="preset-tags">
              <el-tag
                v-for="tag in presetLabelsList"
                :key="tag"
                closable
                class="preset-tag"
                :style="{
                  backgroundColor: labelColor(tag),
                  color: '#fff',
                  borderColor: 'transparent',
                }"
                @close="removePresetTag(tag)"
              >
                {{ tag }}
              </el-tag>
              <el-input
                v-if="newTagInputVisible"
                ref="newTagInputRef"
                v-model="newTagValue"
                size="small"
                class="new-tag-input"
                @keyup.enter="confirmAddPresetTag"
                @blur="confirmAddPresetTag"
              />
              <el-button
                v-else
                size="small"
                :icon="Plus"
                class="add-tag-btn"
                @click="showNewTagInput"
              >
                {{ t('dialog.config.labels.addPreset') }}
              </el-button>
            </div>
          </div>

          <div class="labels-section margin-top">
            <div class="section-title">{{ t('dialog.config.labels.activeTitle') }}</div>
            <el-table :data="torrents.labelCounts" size="small" max-height="200" empty-text="-">
              <el-table-column :label="t('dialog.config.labels.name')" min-width="140">
                <template #default="{ row: l }">
                  <LabelChips :labels="[l.name]" />
                </template>
              </el-table-column>
              <el-table-column
                prop="count"
                :label="t('dialog.config.labels.count')"
                width="90"
                align="right"
              />
              <el-table-column :label="t('dialog.config.labels.action')" width="110" align="center">
                <template #default="{ row: l }">
                  <el-button type="danger" link size="small" @click="batchClearLabel(l.name)">
                    {{ t('dialog.config.labels.clearLabel') }}
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <template #footer>
      <div class="footer">
        <div class="left">
          <el-button @click="restoreDefaults">{{
            t('dialog.config.footer.restoreDefaults')
          }}</el-button>
          <el-button @click="importDialog?.open()">{{
            t('dialog.config.footer.importConfig')
          }}</el-button>
          <el-button @click="exportDialog?.open()">{{
            t('dialog.config.footer.exportConfig')
          }}</el-button>
        </div>
        <div class="right">
          <el-button @click="visible = false">{{ t('dialog.common.cancel') }}</el-button>
          <el-button type="primary" :loading="saving" @click="save">
            {{ t('dialog.config.footer.save') }}
          </el-button>
        </div>
      </div>
    </template>

    <ImportConfigDialog ref="importDialog" />
    <ExportConfigDialog ref="exportDialog" />
  </el-dialog>
</template>

<style scoped>
.basic-form {
  max-width: 560px;
}

.lang {
  width: 160px;
}

.inline-btn {
  margin-left: 8px;
}

.port-result {
  margin-left: 8px;
  font-size: 12px;
  color: var(--twui-text-secondary);
}

.blocklist-size {
  margin-left: 12px;
  font-size: 12px;
  color: var(--twui-text-secondary);
}

.alt-time {
  width: 110px;
}

.alt-time-sep {
  margin: 0 6px;
  color: var(--twui-text-secondary);
}

.placeholder {
  padding: 40px 0;
  text-align: center;
  color: var(--twui-text-secondary);
}

.labels-config {
  padding: 4px 0;
}

.labels-section .section-title {
  font-weight: 600;
  margin-bottom: 4px;
}

.labels-section .section-hint {
  font-size: 12px;
  color: var(--twui-text-secondary);
  margin: 0 0 10px;
}

.margin-top {
  margin-top: 20px;
}

.preset-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.preset-tag {
  font-weight: 500;
}

.preset-tag :deep(.el-tag__close) {
  color: rgba(255, 255, 255, 0.85);
}

.preset-tag :deep(.el-tag__close:hover) {
  color: #ffffff;
  background-color: rgba(255, 255, 255, 0.25);
}

.new-tag-input {
  width: 110px;
}

.dict-restore-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: -6px;
  margin-bottom: 8px;
  padding: 6px 10px;
  background-color: var(--el-fill-color-light);
  border-radius: 4px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.footer {
  display: flex;
  justify-content: space-between;
}

.footer .el-button + .el-button {
  margin-left: 8px;
}
</style>
