<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ArrowDown,
  ArrowUp,
  Bottom,
  CircleCheck,
  CopyDocument,
  Delete,
  EditPen,
  FolderOpened,
  Guide,
  Link,
  MagicStick,
  Odometer,
  PriceTag,
  Top,
  VideoPause,
  VideoPlay,
} from '@element-plus/icons-vue'
import { computeActionStates, useTorrentsStore, type TorrentRow } from '../../stores/torrents'
import { useUiStore } from '../../stores/ui'
import TorrentCell from './TorrentCell.vue'
import ContextMenu, { type ContextMenuItem } from './ContextMenu.vue'

const emit = defineEmits<{ command: [cmd: string] }>()

const { t } = useI18n()
const torrents = useTorrentsStore()
const ui = useUiStore()

// ---------------------------------------------------------------------------
// Column registry
// ---------------------------------------------------------------------------

interface ColumnDef {
  key: string
  label: string
  width?: number
  minWidth?: number
  align: 'left' | 'right' | 'center'
  sortable: boolean
  sortBy: (row: TorrentRow) => string | number
}

const columnDefs = computed<ColumnDef[]>(() => [
  {
    key: 'name',
    label: t('table.name'),
    minWidth: 220,
    align: 'left',
    sortable: true,
    sortBy: (r) => r.name.toLowerCase(),
  },
  {
    key: 'total_size',
    label: t('table.total_size'),
    width: 90,
    align: 'right',
    sortable: true,
    sortBy: (r) => r.total_size,
  },
  {
    key: 'percent_done',
    label: t('table.percent_done'),
    width: 130,
    align: 'left',
    sortable: true,
    sortBy: (r) => r.percent_done,
  },
  {
    key: 'eta',
    label: t('table.eta'),
    width: 90,
    align: 'right',
    sortable: true,
    sortBy: (r) => (r.eta < 0 ? Number.MAX_SAFE_INTEGER : r.eta),
  },
  {
    key: 'upload_ratio',
    label: t('table.upload_ratio'),
    width: 80,
    align: 'right',
    sortable: true,
    sortBy: (r) => r.upload_ratio,
  },
  {
    key: 'status',
    label: t('table.status'),
    width: 90,
    align: 'left',
    sortable: true,
    sortBy: (r) => r.status,
  },
  {
    key: 'seeds',
    label: t('table.seeds'),
    width: 64,
    align: 'right',
    sortable: true,
    sortBy: (r) => r.seederCount,
  },
  {
    key: 'peers',
    label: t('table.peers'),
    width: 64,
    align: 'right',
    sortable: true,
    sortBy: (r) => r.leecherCount,
  },
  {
    key: 'rate_download',
    label: t('table.rate_download'),
    width: 100,
    align: 'right',
    sortable: true,
    sortBy: (r) => r.rate_download,
  },
  {
    key: 'rate_upload',
    label: t('table.rate_upload'),
    width: 100,
    align: 'right',
    sortable: true,
    sortBy: (r) => r.rate_upload,
  },
  {
    key: 'downloaded',
    label: t('table.downloaded'),
    width: 90,
    align: 'right',
    sortable: true,
    sortBy: (r) => r.downloaded_ever,
  },
  {
    key: 'uploaded_ever',
    label: t('table.uploaded_ever'),
    width: 90,
    align: 'right',
    sortable: true,
    sortBy: (r) => r.uploaded_ever,
  },
  {
    key: 'added_date',
    label: t('table.added_date'),
    width: 150,
    align: 'left',
    sortable: true,
    sortBy: (r) => r.added_date,
  },
  {
    key: 'id',
    label: t('table.id'),
    width: 60,
    align: 'right',
    sortable: true,
    sortBy: (r) => r.id,
  },
  {
    key: 'queue_position',
    label: t('table.queue_position'),
    width: 64,
    align: 'right',
    sortable: true,
    sortBy: (r) => r.queue_position,
  },
  {
    key: 'trackers',
    label: t('table.trackers'),
    width: 140,
    align: 'left',
    sortable: true,
    sortBy: (r) => r.trackerNames,
  },
  {
    key: 'download_dir',
    label: t('table.download_dir'),
    width: 180,
    align: 'left',
    sortable: true,
    sortBy: (r) => r.download_dir,
  },
  {
    key: 'activity_date',
    label: t('table.activity_date'),
    width: 150,
    align: 'left',
    sortable: true,
    sortBy: (r) => r.activity_date,
  },
  {
    key: 'labels',
    label: t('table.labels'),
    width: 140,
    align: 'left',
    sortable: true,
    sortBy: (r) => (r.labels ?? []).join(', '),
  },
  {
    key: 'done_date',
    label: t('table.done_date'),
    width: 150,
    align: 'left',
    sortable: true,
    sortBy: (r) => r.done_date,
  },
])

const defsByKey = computed(() => new Map(columnDefs.value.map((d) => [d.key, d])))

/** Columns in the user's configured order, minus hidden ones, with persisted widths. */
const visibleColumns = computed(() =>
  ui.columns.order
    .filter((k) => !ui.columns.hidden.includes(k))
    .map((k) => defsByKey.value.get(k))
    .filter((d): d is ColumnDef => d !== undefined)
    .map((d) => ({ ...d, width: ui.columns.widths[d.key] ?? d.width })),
)

function onHeaderDragend(newWidth: number, _oldWidth: number, column: { property?: string }): void {
  if (column.property) ui.setColumnWidth(column.property, Math.round(newWidth))
}

// ---------------------------------------------------------------------------
// Sorting (client-side, custom)
// ---------------------------------------------------------------------------

const sortKey = ref<string>('added_date')
const sortOrder = ref<'ascending' | 'descending' | null>('descending')

function onSortChange({
  prop,
  order,
}: {
  prop: string
  order: 'ascending' | 'descending' | null
}): void {
  if (prop) sortKey.value = prop
  sortOrder.value = order
}

const sortedRows = computed(() => {
  const rows = [...torrents.filteredRows]
  if (sortKey.value && sortOrder.value) {
    const def = defsByKey.value.get(sortKey.value)
    if (def) {
      const dir = sortOrder.value === 'ascending' ? 1 : -1
      rows.sort((a, b) => {
        const va = def.sortBy(a)
        const vb = def.sortBy(b)
        if (typeof va === 'string' && typeof vb === 'string') {
          return va.localeCompare(vb) * dir
        }
        if (va < vb) return -dir
        if (va > vb) return dir
        return 0
      })
    }
  }
  return rows
})

// ---------------------------------------------------------------------------
// Pagination (client-side; pageSize 0 = "all")
// ---------------------------------------------------------------------------

const currentPage = ref(1)
const effectivePageSize = computed(() =>
  ui.pageSize > 0 ? ui.pageSize : Math.max(sortedRows.value.length, 1),
)

const pagedRows = computed(() => {
  const rows = sortedRows.value
  if (ui.pageSize <= 0) return rows
  const start = (currentPage.value - 1) * ui.pageSize
  return rows.slice(start, start + ui.pageSize)
})

function onPageSizeChange(size: number): void {
  ui.setPageSize(size)
  currentPage.value = 1
}

watch(
  () => torrents.filteredRows.length,
  (len) => {
    const maxPage = Math.max(1, Math.ceil(len / effectivePageSize.value))
    if (currentPage.value > maxPage) currentPage.value = maxPage
  },
)

// ---------------------------------------------------------------------------
// Selection: checkboxes + row click (plain / ctrl / shift-range)
// ---------------------------------------------------------------------------

const anchorId = ref<number | null>(null)
const viewIds = computed(() => pagedRows.value.map((r) => r.id))
const selectedSet = computed(() => new Set(torrents.selectedIds))

function isSelected(id: number): boolean {
  return selectedSet.value.has(id)
}

function selectRange(fromId: number, toId: number): void {
  const ids = viewIds.value
  const a = ids.indexOf(fromId)
  const b = ids.indexOf(toId)
  if (a === -1 || b === -1) return
  const [lo, hi] = a < b ? [a, b] : [b, a]
  torrents.setSelection(ids.slice(lo, hi + 1))
}

const pageAllSelected = computed(
  () => viewIds.value.length > 0 && viewIds.value.every((id) => selectedSet.value.has(id)),
)
const pageSomeSelected = computed(
  () => !pageAllSelected.value && viewIds.value.some((id) => selectedSet.value.has(id)),
)

function toggleSelectPage(checked: boolean): void {
  if (checked) {
    torrents.setSelection([...new Set([...torrents.selectedIds, ...viewIds.value])])
  } else {
    torrents.setSelection(torrents.selectedIds.filter((id) => !viewIds.value.includes(id)))
  }
}

function onCheckClick(row: TorrentRow, e: MouseEvent): void {
  if (e.shiftKey && anchorId.value != null && anchorId.value !== row.id) {
    // Stop the checkbox toggle; do a range selection instead.
    e.preventDefault()
    selectRange(anchorId.value, row.id)
  }
}

function onCheckChange(row: TorrentRow, checked: boolean): void {
  anchorId.value = row.id
  const set = new Set(torrents.selectedIds)
  if (checked) set.add(row.id)
  else set.delete(row.id)
  torrents.setSelection([...set])
}

function onRowClick(row: TorrentRow, _column: unknown, event: MouseEvent): void {
  // Checkbox clicks are handled by the checkbox itself.
  if ((event.target as HTMLElement).closest('.el-checkbox')) return
  if (event.shiftKey && anchorId.value != null) {
    selectRange(anchorId.value, row.id)
  } else if (event.ctrlKey || event.metaKey) {
    const set = new Set(torrents.selectedIds)
    if (set.has(row.id)) set.delete(row.id)
    else set.add(row.id)
    torrents.setSelection([...set])
    anchorId.value = row.id
  } else {
    torrents.setSelection([row.id])
    anchorId.value = row.id
  }
  torrents.select(row.id)
}

// ---------------------------------------------------------------------------
// Context menus (row + header column config)
// ---------------------------------------------------------------------------

const rowMenu = ref<{ x: number; y: number } | null>(null)
const colMenu = ref<{ x: number; y: number } | null>(null)

function onRowContextMenu(row: TorrentRow, _column: unknown, event: MouseEvent): void {
  event.preventDefault()
  if (!selectedSet.value.has(row.id)) {
    torrents.setSelection([row.id])
    anchorId.value = row.id
  }
  torrents.select(row.id)
  rowMenu.value = { x: event.clientX, y: event.clientY }
}

function onHeaderContextMenu(_column: unknown, event: MouseEvent): void {
  event.preventDefault()
  colMenu.value = { x: event.clientX, y: event.clientY }
}

const rowMenuItems = computed<ContextMenuItem[]>(() => {
  const s = computeActionStates(torrents.selectedTorrents)
  return [
    { key: 'start', label: t('menu.start'), icon: VideoPlay, disabled: !s.start },
    { key: 'stop', label: t('menu.stop'), icon: VideoPause, disabled: !s.stop },
    {
      key: 'verify',
      label: t('menu.verify'),
      icon: CircleCheck,
      disabled: !s.verify,
      dividerBefore: true,
    },
    { key: 'reannounce', label: t('menu.reannounce'), icon: Guide, disabled: !s.reannounce },
    {
      key: 'rename',
      label: t('menu.rename'),
      icon: EditPen,
      disabled: !s.rename,
      dividerBefore: true,
    },
    { key: 'change-dir', label: t('menu.changeDir'), icon: FolderOpened, disabled: !s.changeDir },
    { key: 'auto-match', label: t('menu.autoMatch'), icon: MagicStick, disabled: !s.autoMatch },
    { key: 'copy-path', label: t('menu.copyPath'), icon: CopyDocument, disabled: !s.copyPath },
    { key: 'copy-magnet', label: t('menu.copyMagnet'), icon: Link, disabled: !s.copyMagnet },
    {
      key: 'queue-top',
      label: t('menu.queueTop'),
      icon: Top,
      disabled: !s.queue,
      dividerBefore: true,
    },
    { key: 'queue-up', label: t('menu.queueUp'), icon: ArrowUp, disabled: !s.queue },
    { key: 'queue-down', label: t('menu.queueDown'), icon: ArrowDown, disabled: !s.queue },
    { key: 'queue-bottom', label: t('menu.queueBottom'), icon: Bottom, disabled: !s.queue },
    {
      key: 'speed-limit',
      label: t('menu.speedLimit'),
      icon: Odometer,
      disabled: !s.speedLimit,
      dividerBefore: true,
    },
    { key: 'set-labels', label: t('menu.setLabels'), icon: PriceTag, disabled: !s.labels },
    {
      key: 'remove',
      label: t('menu.remove'),
      icon: Delete,
      disabled: !s.remove,
      danger: true,
      dividerBefore: true,
    },
  ]
})

const colMenuItems = computed<ContextMenuItem[]>(() =>
  columnDefs.value.map((c) => ({
    key: c.key,
    label: c.label,
    checked: !ui.columns.hidden.includes(c.key),
    keepOpen: true,
  })),
)

function onRowMenuSelect(key: string): void {
  emit('command', key)
}

function onColMenuSelect(key: string): void {
  ui.setColumnHidden(key, !ui.columns.hidden.includes(key))
}
</script>

<template>
  <div class="torrent-table">
    <div class="table-wrap">
      <el-table
        :data="pagedRows"
        row-key="id"
        border
        stripe
        size="small"
        height="100%"
        :default-sort="{ prop: 'added_date', order: 'descending' }"
        @row-click="onRowClick"
        @row-contextmenu="onRowContextMenu"
        @header-contextmenu="onHeaderContextMenu"
        @sort-change="onSortChange"
        @header-dragend="onHeaderDragend"
      >
        <el-table-column :width="34" align="center" :resizable="false">
          <template #header>
            <el-checkbox
              :model-value="pageAllSelected"
              :indeterminate="pageSomeSelected"
              @change="toggleSelectPage"
            />
          </template>
          <template #default="{ row }">
            <el-checkbox
              :model-value="isSelected(row.id)"
              @change="(v: boolean) => onCheckChange(row, v)"
              @click="(e: MouseEvent) => onCheckClick(row, e)"
            />
          </template>
        </el-table-column>

        <el-table-column
          v-for="col in visibleColumns"
          :key="col.key"
          :prop="col.key"
          :label="col.label"
          :width="col.width"
          :min-width="col.minWidth"
          :align="col.align"
          :sortable="col.sortable ? 'custom' : false"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <TorrentCell :col-key="col.key" :row="row" />
          </template>
        </el-table-column>

        <template #empty>{{ t('table.empty') }}</template>
      </el-table>
    </div>

    <div class="table-footer">
      <el-select
        class="page-size"
        :model-value="ui.pageSize"
        size="small"
        @change="onPageSizeChange"
      >
        <el-option v-for="s in [20, 50, 100]" :key="s" :value="s" :label="String(s)" />
        <el-option :value="0" :label="t('table.all')" />
      </el-select>
      <el-pagination
        v-model:current-page="currentPage"
        :page-size="effectivePageSize"
        :total="sortedRows.length"
        layout="total, prev, pager, next"
        background
        small
      />
    </div>

    <ContextMenu
      v-if="rowMenu"
      :x="rowMenu.x"
      :y="rowMenu.y"
      :items="rowMenuItems"
      @select="onRowMenuSelect"
      @close="rowMenu = null"
    />
    <ContextMenu
      v-if="colMenu"
      :x="colMenu.x"
      :y="colMenu.y"
      :items="colMenuItems"
      @select="onColMenuSelect"
      @close="colMenu = null"
    />
  </div>
</template>

<style scoped>
.torrent-table {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.table-wrap {
  flex: 1;
  min-height: 0;
}

.table-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 8px;
  flex: none;
  border-top: 1px solid var(--twui-border);
  background: var(--twui-toolbar-bg);
}

.page-size {
  width: 84px;
}

:deep(.el-table .el-checkbox) {
  vertical-align: middle;
}
</style>
