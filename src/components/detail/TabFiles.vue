<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { Check, Close } from '@element-plus/icons-vue'
import type { Torrent } from '../../api/types'
import { torrentSet } from '../../api/rpc'
import { useTorrentsStore } from '../../stores/torrents'
import { formatBytes } from '../../utils/format'
import ProgressBar from '../table/ProgressBar.vue'

/** Files tab: wanted toggle / priority / regex filter (presets included). */
const props = defineProps<{ torrent: Torrent }>()
const { t } = useI18n()
const torrents = useTorrentsStore()

interface FileRow {
  index: number
  name: string
  length: number
  completed: number
  wanted: boolean
  priority: number
}

const fileRows = computed<FileRow[]>(() => {
  const files = props.torrent.files ?? []
  const stats = props.torrent.file_stats ?? []
  return files.map((f, i) => ({
    index: i,
    name: f.name,
    length: f.length,
    completed: stats[i]?.bytes_completed ?? f.bytes_completed,
    wanted: stats[i]?.wanted ?? true,
    priority: stats[i]?.priority ?? 0,
  }))
})

// Regex filter with preset patterns (BitComet padding / unnecessary files).
const presets = computed(() => [
  { label: t('files.presetAll'), value: '.*' },
  { label: t('files.presetBitComet'), value: '____padding_file' },
  {
    label: t('files.presetUnnecessary'),
    value: '(.*\\.(url|lnk)$)|(RARBG_DO_NOT_MIRROR\\.exe)|(____padding_file)',
  },
])

const filterText = ref('.*')

const compiled = computed(() => {
  try {
    return new RegExp(filterText.value, 'i')
  } catch {
    return null
  }
})

const displayedRows = computed(() => {
  const re = compiled.value
  if (!re) return fileRows.value
  return fileRows.value.filter((r) => re.test(r.name))
})

const selected = ref<FileRow[]>([])

async function apply(params: Record<string, unknown>): Promise<void> {
  try {
    await torrentSet([props.torrent.id], params)
    await torrents.refreshOne(props.torrent.id, ['files', 'file_stats'])
  } catch (e) {
    ElMessage.error(t('message.actionFailed', { msg: e instanceof Error ? e.message : String(e) }))
  }
}

function selectedIndices(): number[] {
  return selected.value.map((r) => r.index)
}

function setWanted(wanted: boolean): void {
  const indices = selectedIndices()
  if (indices.length === 0) return
  void apply({ [wanted ? 'files_wanted' : 'files_unwanted']: indices })
}

function setPriority(priority: 'high' | 'normal' | 'low'): void {
  const indices = selectedIndices()
  if (indices.length === 0) return
  void apply({ [`priority_${priority}`]: indices })
}

function priorityText(p: number): string {
  if (p > 0) return t('files.high')
  if (p < 0) return t('files.low')
  return t('files.normal')
}
</script>

<template>
  <div class="tab-files">
    <div class="bar">
      <el-select
        v-model="filterText"
        size="small"
        filterable
        allow-create
        default-first-option
        class="filter"
        :placeholder="t('files.filterPlaceholder')"
      >
        <el-option v-for="p in presets" :key="p.value" :value="p.value" :label="p.label">
          <span class="preset-label">{{ p.label }}</span>
          <span class="preset-value">{{ p.value }}</span>
        </el-option>
      </el-select>

      <el-divider direction="vertical" />
      <el-button size="small" :disabled="selected.length === 0" @click="setWanted(true)">
        {{ t('files.download') }}
      </el-button>
      <el-button size="small" :disabled="selected.length === 0" @click="setWanted(false)">
        {{ t('files.skip') }}
      </el-button>
      <el-divider direction="vertical" />
      <el-button size="small" :disabled="selected.length === 0" @click="setPriority('high')">
        {{ t('files.high') }}
      </el-button>
      <el-button size="small" :disabled="selected.length === 0" @click="setPriority('normal')">
        {{ t('files.normal') }}
      </el-button>
      <el-button size="small" :disabled="selected.length === 0" @click="setPriority('low')">
        {{ t('files.low') }}
      </el-button>
    </div>

    <el-table
      :data="displayedRows"
      size="small"
      border
      height="200"
      @selection-change="(rows: FileRow[]) => (selected = rows)"
    >
      <el-table-column type="selection" width="34" />
      <el-table-column prop="name" :label="t('files.name')" min-width="260" show-overflow-tooltip />
      <el-table-column :label="t('files.size')" width="90" align="right">
        <template #default="{ row }">{{ formatBytes(row.length) }}</template>
      </el-table-column>
      <el-table-column :label="t('files.progress')" width="140">
        <template #default="{ row }">
          <ProgressBar
            :ratio="row.length > 0 ? row.completed / row.length : 1"
            state="downloading"
          />
        </template>
      </el-table-column>
      <el-table-column :label="t('files.download')" width="60" align="center">
        <template #default="{ row }">
          <el-icon v-if="row.wanted" class="wanted"><Check /></el-icon>
          <el-icon v-else class="skipped"><Close /></el-icon>
        </template>
      </el-table-column>
      <el-table-column :label="t('files.priority')" width="70" align="center">
        <template #default="{ row }">{{ priorityText(row.priority) }}</template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style scoped>
.tab-files {
  padding: 8px 4px;
}

.bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.bar .el-button + .el-button {
  margin-left: 0;
}

.filter {
  width: 320px;
}

.preset-label {
  float: left;
}

.preset-value {
  float: right;
  font-size: 12px;
  color: var(--twui-text-secondary);
}

.wanted {
  color: #67c23a;
}

.skipped {
  color: #c0c4cc;
}
</style>
