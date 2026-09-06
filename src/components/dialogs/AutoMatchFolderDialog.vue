<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { TorrentStatus } from '../../api/types'
import { torrentAction, torrentGet, torrentSetLocation } from '../../api/rpc'
import { useTorrentsStore } from '../../stores/torrents'
import { useUiStore } from '../../stores/ui'

/**
 * Auto-match data folder: for each stopped, 0%-progress selected torrent,
 * try every dictionary folder — set location (no move) + verify; verified
 * progress means the data lives there. Unmatched torrents are restored to
 * their original folder.
 */
const { t } = useI18n()
const torrents = useTorrentsStore()
const ui = useUiStore()

const PROBE_TIMEOUT_MS = 10_000
const PROBE_INTERVAL_MS = 1_000

const visible = ref(false)
const running = ref(false)
const cancelled = ref(false)
const dictionaryText = ref('')
const log = ref<string[]>([])
const currentTorrent = ref('')
const currentFolder = ref('')
const doneCount = ref(0)
const matchedCount = ref(0)
const totalCount = ref(0)

interface Candidate {
  id: number
  name: string
  dir: string
}

const folders = computed(() =>
  dictionaryText.value
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean),
)

function candidates(): Candidate[] {
  return torrents.selectedTorrents
    .filter((r) => r.status === TorrentStatus.stopped && r.percent_done === 0)
    .map((r) => ({ id: r.id, name: r.name, dir: r.download_dir }))
}

function open(): void {
  if (torrents.selectedTorrents.length === 0) return
  dictionaryText.value = ui.folderDictionary.join('\n')
  log.value = []
  currentTorrent.value = ''
  currentFolder.value = ''
  doneCount.value = 0
  matchedCount.value = 0
  totalCount.value = 0
  running.value = false
  visible.value = true
}

defineExpose({ open })

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Poll until verify shows progress (match), verify ends (no match), or timeout. */
async function probe(id: number): Promise<boolean> {
  const deadline = Date.now() + PROBE_TIMEOUT_MS
  while (Date.now() < deadline && !cancelled.value) {
    await sleep(PROBE_INTERVAL_MS)
    const resp = await torrentGet(['percent_done', 'status'], [id])
    const row = resp.torrents[0]
    if (!row) return false
    if (row.percent_done > 0) return true
    if (row.status !== TorrentStatus.check && row.status !== TorrentStatus.check_wait) return false
  }
  return false
}

async function run(): Promise<void> {
  const dirs = folders.value
  if (dirs.length === 0) {
    ElMessage.warning(t('dialog.autoMatch.needDictionary'))
    return
  }
  ui.setFolderDictionary(dirs)
  const skipped = torrents.selectedTorrents.length - candidates().length
  const list = candidates()
  if (skipped > 0) log.value.push(`- ${t('dialog.autoMatch.skipped')}: ${skipped}`)
  totalCount.value = list.length
  running.value = true
  cancelled.value = false
  try {
    for (const item of list) {
      if (cancelled.value) break
      currentTorrent.value = item.name
      let matched = false
      for (const dir of dirs) {
        if (cancelled.value || matched) break
        if (dir === item.dir) continue
        currentFolder.value = dir
        try {
          await torrentSetLocation([item.id], dir, false)
          await torrentAction('torrent_verify', [item.id])
          matched = await probe(item.id)
        } catch {
          // A failed probe (e.g. folder not writable) just tries the next one.
        }
      }
      doneCount.value++
      if (matched) {
        matchedCount.value++
        log.value.push(`✔ ${item.name} → ${currentFolder.value} (${t('dialog.autoMatch.matched')})`)
      } else {
        // Restore the original folder so an unmatched torrent is untouched.
        try {
          await torrentSetLocation([item.id], item.dir, false)
        } catch {
          // best effort
        }
        log.value.push(`✘ ${item.name} (${t('dialog.autoMatch.unmatched')})`)
      }
    }
    log.value.push(
      `— ${t('dialog.autoMatch.done', { matched: matchedCount.value, total: totalCount.value })}`,
    )
    torrents.needFullRefresh = true
    await torrents.refresh()
  } finally {
    running.value = false
    currentTorrent.value = ''
    currentFolder.value = ''
  }
}

function stop(): void {
  cancelled.value = true
}
</script>

<template>
  <el-dialog v-model="visible" :title="t('dialog.autoMatch.title')" width="600px">
    <p class="tip">{{ t('dialog.autoMatch.tip') }}</p>
    <div class="counts">
      <span
        >{{ t('dialog.autoMatch.torrentCount') }}:
        {{ running ? totalCount : candidates().length }}</span
      >
      <span>{{ t('dialog.autoMatch.folderCount') }}: {{ folders.length }}</span>
    </div>
    <el-form label-position="top">
      <el-form-item :label="t('dialog.autoMatch.dictionary')">
        <el-input v-model="dictionaryText" type="textarea" :rows="5" :disabled="running" />
      </el-form-item>
    </el-form>

    <div v-if="running" class="status">
      <div>
        {{ t('dialog.autoMatch.currentTorrent') }}: {{ currentTorrent }} ({{ doneCount + 1 }}/{{
          totalCount
        }})
      </div>
      <div>{{ t('dialog.autoMatch.currentFolder') }}: {{ currentFolder }}</div>
    </div>

    <div v-if="log.length > 0" class="log">
      <div v-for="(line, i) in log" :key="i">{{ line }}</div>
    </div>

    <template #footer>
      <el-button v-if="!running" :disabled="folders.length === 0" type="primary" @click="run">
        {{ t('dialog.autoMatch.start') }}
      </el-button>
      <el-button v-else type="danger" @click="stop">{{ t('dialog.autoMatch.stop') }}</el-button>
      <el-button :disabled="running" @click="visible = false">{{
        t('dialog.common.cancel')
      }}</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.tip {
  margin: 0 0 8px;
  font-size: 12px;
  color: var(--twui-text-secondary);
}

.counts {
  display: flex;
  gap: 16px;
  margin-bottom: 8px;
  font-size: 13px;
}

.status {
  margin: 8px 0;
  padding: 6px 8px;
  background: #f5f7fa;
  border-radius: 4px;
  font-size: 12px;
}

.log {
  max-height: 160px;
  overflow-y: auto;
  margin-top: 8px;
  padding: 6px 8px;
  background: #f5f7fa;
  border-radius: 4px;
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
</style>
