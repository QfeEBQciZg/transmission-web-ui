<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { Close } from '@element-plus/icons-vue'
import { useSessionStore } from '../../stores/session'
import { useTorrentsStore } from '../../stores/torrents'
import { useUiStore } from '../../stores/ui'

/** torrent_set_location for the selected torrents (+ optional verify). */
const { t } = useI18n()
const session = useSessionStore()
const torrents = useTorrentsStore()
const ui = useUiStore()

const visible = ref(false)
const submitting = ref(false)
const dir = ref('')
const move = ref(true)
const verifyAfter = ref(false)
const ids = ref<number[]>([])
const autocompleteRef = ref<{ getData?: (q: string) => Promise<void> } | null>(null)

interface DirSuggestion {
  value: string
}

const dirOptions = computed(() => {
  const set = new Set<string>()
  if (session.downloadDir) set.add(session.downloadDir)
  for (const d of torrents.downloadDirs) {
    if (d) set.add(d)
  }
  for (const d of ui.folderDictionary) {
    if (d) set.add(d)
  }
  for (const h of ui.hiddenDownloadDirs) {
    set.delete(h)
  }
  return [...set]
})

function queryDirSearch(queryString: string, cb: (results: DirSuggestion[]) => void): void {
  const all: DirSuggestion[] = dirOptions.value.map((d) => ({ value: d }))
  if (!queryString || !queryString.trim()) {
    cb(all)
    return
  }
  const q = queryString.trim().toLowerCase()
  const filtered = all.filter((item) => item.value.toLowerCase().includes(q))
  cb(filtered)
}

function handleRemoveDir(path: string): void {
  ui.removeKnownDir(path)
  void autocompleteRef.value?.getData?.(dir.value)
}

function open(): void {
  const rows = torrents.selectedTorrents
  if (rows.length === 0) return
  ids.value = rows.map((r) => r.id)
  dir.value = rows.length === 1 ? rows[0].download_dir : session.downloadDir
  move.value = true
  verifyAfter.value = false
  visible.value = true
}

defineExpose({ open })

async function submit(): Promise<void> {
  if (ids.value.length === 0 || dir.value.trim() === '' || submitting.value) return
  submitting.value = true
  const targetDir = dir.value.trim()
  try {
    await torrents.changeLocation(ids.value, targetDir, move.value, verifyAfter.value)
    ui.unhideDownloadDir(targetDir)
    torrents.clearSelection()
    visible.value = false
  } catch (e) {
    ElMessage.error(t('message.actionFailed', { msg: e instanceof Error ? e.message : String(e) }))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-dialog v-model="visible" :title="t('dialog.changeDir.title')" width="520px">
    <el-form label-width="110px" label-position="left">
      <el-form-item :label="t('dialog.changeDir.dir')">
        <el-autocomplete
          ref="autocompleteRef"
          v-model="dir"
          :fetch-suggestions="queryDirSearch"
          :trigger-on-focus="true"
          clearable
          class="full"
        >
          <template #default="{ item }">
            <div class="dir-item">
              <span class="dir-text" :title="item.value">{{ item.value }}</span>
              <el-icon
                class="dir-delete-btn"
                :title="t('dialog.common.removeDir')"
                @click.stop.prevent="handleRemoveDir(item.value)"
              >
                <Close />
              </el-icon>
            </div>
          </template>
        </el-autocomplete>
      </el-form-item>
      <el-form-item label=" ">
        <el-checkbox v-model="move">{{ t('dialog.changeDir.move') }}</el-checkbox>
      </el-form-item>
      <el-form-item label=" ">
        <el-checkbox v-model="verifyAfter" :disabled="!move">
          {{ t('dialog.changeDir.verify') }}
        </el-checkbox>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">{{ t('dialog.common.cancel') }}</el-button>
      <el-button type="primary" :loading="submitting" :disabled="dir.trim() === ''" @click="submit">
        {{ t('dialog.common.ok') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.full {
  width: 100%;
}

.dir-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 8px;
}

.dir-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dir-delete-btn {
  flex-shrink: 0;
  font-size: 14px;
  color: var(--el-text-color-secondary);
  border-radius: 4px;
  padding: 2px;
  transition:
    color 0.15s,
    background-color 0.15s;
}

.dir-delete-btn:hover {
  color: var(--el-color-danger);
  background-color: var(--el-fill-color-light);
}
</style>
