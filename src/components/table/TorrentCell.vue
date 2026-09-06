<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { TorrentStatus } from '../../api/types'
import {
  formatBytes,
  formatDuration,
  formatRatio,
  formatSpeed,
  formatTimestamp,
  statusKey,
} from '../../utils/format'
import type { TorrentRow } from '../../stores/torrents'
import ProgressBar from './ProgressBar.vue'
import StatusIcon from './StatusIcon.vue'
import LabelChips from './LabelChips.vue'

/** Per-column cell renderer for the torrent table. */
const props = defineProps<{ colKey: string; row: TorrentRow }>()
const { t } = useI18n()

const isChecking = computed(
  () => props.row.status === TorrentStatus.check || props.row.status === TorrentStatus.check_wait,
)

/** Checking torrents show the recheck progress instead of the download progress. */
const effectiveProgress = computed(() =>
  isChecking.value ? props.row.recheck_progress : props.row.percent_done,
)

const progressState = computed(() => {
  if (props.row.isError) return 'error'
  if (props.row.warning) return 'warning'
  if (isChecking.value) return 'checking'
  switch (props.row.status) {
    case TorrentStatus.seed:
    case TorrentStatus.seed_wait:
      return 'seeding'
    case TorrentStatus.stopped:
      return 'stopped'
    default:
      return 'downloading'
  }
})

const nameTooltip = computed(() =>
  props.row.isError && props.row.error_string
    ? `${props.row.name}\n${props.row.error_string}`
    : props.row.name,
)

const statusText = computed(() => t(`status.${statusKey(props.row.status)}`))
</script>

<template>
  <div v-if="colKey === 'name'" class="cell-name" :title="nameTooltip">
    <StatusIcon :row="row" />
    <span class="name-text">{{ row.name }}</span>
  </div>

  <ProgressBar
    v-else-if="colKey === 'percent_done'"
    :ratio="effectiveProgress"
    :state="progressState"
  />

  <span v-else-if="colKey === 'total_size'">{{ formatBytes(row.total_size) }}</span>
  <span v-else-if="colKey === 'eta'">{{ formatDuration(row.eta) }}</span>
  <span v-else-if="colKey === 'upload_ratio'">{{ formatRatio(row.upload_ratio) }}</span>
  <span v-else-if="colKey === 'status'">{{ statusText }}</span>
  <span v-else-if="colKey === 'seeds'">{{ row.seederCount }}</span>
  <span v-else-if="colKey === 'peers'">{{ row.leecherCount }}</span>
  <span v-else-if="colKey === 'rate_download'">
    {{ row.rate_download > 0 ? formatSpeed(row.rate_download) : '' }}
  </span>
  <span v-else-if="colKey === 'rate_upload'">
    {{ row.rate_upload > 0 ? formatSpeed(row.rate_upload) : '' }}
  </span>
  <span v-else-if="colKey === 'downloaded'">{{ formatBytes(row.downloaded_ever) }}</span>
  <span v-else-if="colKey === 'uploaded_ever'">{{ formatBytes(row.uploaded_ever) }}</span>
  <span v-else-if="colKey === 'added_date'">{{ formatTimestamp(row.added_date) }}</span>
  <span v-else-if="colKey === 'activity_date'">{{ formatTimestamp(row.activity_date) }}</span>
  <span v-else-if="colKey === 'done_date'">{{ formatTimestamp(row.done_date) }}</span>
  <span v-else-if="colKey === 'id'">{{ row.id }}</span>
  <span v-else-if="colKey === 'queue_position'">{{ row.queue_position }}</span>
  <span v-else-if="colKey === 'trackers'">{{ row.trackerNames }}</span>
  <span v-else-if="colKey === 'download_dir'">{{ row.download_dir }}</span>
  <LabelChips v-else-if="colKey === 'labels'" :labels="row.labels ?? []" />
  <span v-else>-</span>
</template>

<style scoped>
.cell-name {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.name-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
