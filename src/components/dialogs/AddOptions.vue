<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Close } from '@element-plus/icons-vue'
import { useSessionStore } from '../../stores/session'
import { useTorrentsStore } from '../../stores/torrents'
import { useUiStore } from '../../stores/ui'

/** Shared options for the add-torrent dialogs (dir / auto-start / labels). */
const dir = defineModel<string>('dir', { required: true })
const setDefault = defineModel<boolean>('setDefault', { required: true })
const autoStart = defineModel<boolean>('autoStart', { required: true })
const labels = defineModel<string[]>('labels', { required: true })

const { t } = useI18n()
const session = useSessionStore()
const torrents = useTorrentsStore()
const ui = useUiStore()

const autocompleteRef = ref<{ getData?: (q: string) => Promise<void> } | null>(null)

interface DirSuggestion {
  value: string
}

/** Known download dirs: session default first, active torrent dirs, then user dictionary. */
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

const labelOptions = computed(() => {
  const set = new Set<string>()
  for (const l of torrents.labelCounts) set.add(l.name)
  for (const l of ui.presetLabels) set.add(l)
  return [...set].sort()
})
</script>

<template>
  <el-form label-width="110px" label-position="left">
    <el-form-item :label="t('dialog.common.downloadDir')">
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
      <el-checkbox v-model="setDefault">{{ t('dialog.common.setDefaultDir') }}</el-checkbox>
    </el-form-item>
    <el-form-item label=" ">
      <el-checkbox v-model="autoStart">{{ t('dialog.common.autoStart') }}</el-checkbox>
    </el-form-item>
    <el-form-item :label="t('dialog.common.labels')">
      <el-select v-model="labels" multiple filterable allow-create class="full">
        <el-option v-for="l in labelOptions" :key="l" :value="l" :label="l" />
      </el-select>
    </el-form-item>
  </el-form>
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
