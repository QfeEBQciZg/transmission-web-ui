<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { AnnounceState, type Torrent, type TrackerStat } from '../../api/types'
import { torrentSet } from '../../api/rpc'
import { useTorrentsStore } from '../../stores/torrents'
import { formatTimestamp } from '../../utils/format'
import { addTrackers, removeTrackers, replaceTracker } from '../../utils/trackerList'
import AddTrackerDialog from '../dialogs/AddTrackerDialog.vue'

/** Trackers tab: tracker_stats table + add/edit/delete via tracker_list rewrite. */
const props = defineProps<{ torrent: Torrent }>()
const { t } = useI18n()
const torrents = useTorrentsStore()

const dialog = ref<InstanceType<typeof AddTrackerDialog>>()
const selected = ref<TrackerStat[]>([])

const stats = computed(() => props.torrent.tracker_stats ?? [])

function stateText(state: number): string {
  switch (state) {
    case AnnounceState.inactive:
      return t('trackerState.inactive')
    case AnnounceState.waiting:
      return t('trackerState.waiting')
    case AnnounceState.queued:
      return t('trackerState.queued')
    case AnnounceState.active:
      return t('trackerState.active')
    default:
      return String(state)
  }
}

/** Submit a rewritten tracker_list and refresh this torrent's tracker data. */
async function applyList(newList: string): Promise<void> {
  try {
    await torrentSet([props.torrent.id], { tracker_list: newList })
    await torrents.refreshOne(props.torrent.id, ['tracker_stats', 'tracker_list'])
  } catch (e) {
    ElMessage.error(t('message.actionFailed', { msg: e instanceof Error ? e.message : String(e) }))
  }
}

function onDelete(): void {
  const urls = selected.value.map((s) => s.announce)
  if (urls.length === 0) return
  void applyList(removeTrackers(props.torrent.tracker_list ?? '', urls))
}

function onDialogConfirm(payload: { mode: 'add' | 'edit'; oldUrl?: string; urls: string[] }): void {
  const current = props.torrent.tracker_list ?? ''
  const next =
    payload.mode === 'add'
      ? addTrackers(current, payload.urls)
      : replaceTracker(current, payload.oldUrl ?? '', payload.urls[0] ?? '')
  void applyList(next)
}
</script>

<template>
  <div class="tab-trackers">
    <div class="bar">
      <el-button size="small" @click="dialog?.open({ mode: 'add' })">
        {{ t('trackers.add') }}
      </el-button>
      <el-button
        size="small"
        :disabled="selected.length !== 1"
        @click="dialog?.open({ mode: 'edit', oldUrl: selected[0].announce })"
      >
        {{ t('trackers.edit') }}
      </el-button>
      <el-button size="small" :disabled="selected.length === 0" @click="onDelete">
        {{ t('trackers.delete') }}
      </el-button>
    </div>

    <el-table
      :data="stats"
      size="small"
      border
      height="200"
      @selection-change="(rows: TrackerStat[]) => (selected = rows)"
    >
      <el-table-column type="selection" width="34" />
      <el-table-column
        prop="announce"
        :label="t('trackers.announce')"
        min-width="220"
        show-overflow-tooltip
      />
      <el-table-column prop="tier" :label="t('trackers.tier')" width="56" align="right" />
      <el-table-column :label="t('trackers.state')" width="90">
        <template #default="{ row }">{{ stateText(row.announce_state) }}</template>
      </el-table-column>
      <el-table-column :label="t('trackers.result')" min-width="160" show-overflow-tooltip>
        <template #default="{ row }">
          <span :class="{ failed: row.has_announced && !row.last_announce_succeeded }">
            {{ row.has_announced ? row.last_announce_result : '-' }}
          </span>
        </template>
      </el-table-column>
      <el-table-column prop="seeder_count" :label="t('trackers.seeds')" width="72" align="right" />
      <el-table-column
        prop="leecher_count"
        :label="t('trackers.leeches')"
        width="72"
        align="right"
      />
      <el-table-column :label="t('trackers.lastAnnounce')" width="140">
        <template #default="{ row }">{{ formatTimestamp(row.last_announce_time) }}</template>
      </el-table-column>
      <el-table-column :label="t('trackers.nextAnnounce')" width="140">
        <template #default="{ row }">{{ formatTimestamp(row.next_announce_time) }}</template>
      </el-table-column>
    </el-table>

    <AddTrackerDialog ref="dialog" @confirm="onDialogConfirm" />
  </div>
</template>

<style scoped>
.tab-trackers {
  padding: 8px 4px;
}

.bar {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.bar .el-button + .el-button {
  margin-left: 0;
}

.failed {
  color: var(--twui-error);
}
</style>
