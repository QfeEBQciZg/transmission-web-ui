<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { TorrentStatus } from '../../api/types'
import { statusKey } from '../../utils/format'
import type { TorrentRow } from '../../stores/torrents'
import {
  IconCheck,
  IconDownloadDouble,
  IconError,
  IconPause,
  IconSeedDouble,
  IconWarning,
} from '../common/StatusSvgIcons'

const props = defineProps<{ row: TorrentRow }>()
const { t } = useI18n()

const icon = computed(() => {
  if (props.row.isError) return IconError
  if (props.row.warning) return IconWarning
  switch (props.row.status) {
    case TorrentStatus.download:
    case TorrentStatus.download_wait:
      return IconDownloadDouble
    case TorrentStatus.seed:
    case TorrentStatus.seed_wait:
      return IconSeedDouble
    case TorrentStatus.check:
    case TorrentStatus.check_wait:
      return IconCheck
    default:
      return IconPause
  }
})

const cls = computed(() => {
  if (props.row.isError) return 'st-error'
  if (props.row.warning) return 'st-warning'
  switch (props.row.status) {
    case TorrentStatus.download:
    case TorrentStatus.download_wait:
      return 'st-download'
    case TorrentStatus.seed:
    case TorrentStatus.seed_wait:
      return 'st-seed'
    case TorrentStatus.check:
    case TorrentStatus.check_wait:
      return 'st-check'
    default:
      return 'st-stopped'
  }
})

const tip = computed(() => {
  const base = t(`status.${statusKey(props.row.status)}`)
  return props.row.isError && props.row.error_string ? `${base}: ${props.row.error_string}` : base
})
</script>

<template>
  <el-tooltip :content="tip" placement="top" :show-after="400">
    <el-icon class="status-icon" :class="cls"><component :is="icon" /></el-icon>
  </el-tooltip>
</template>

<style scoped>
.status-icon {
  font-size: 14px;
}

.st-download {
  color: #409eff;
}

.st-seed {
  color: #67c23a;
}

.st-check,
.st-warning {
  color: #e6a23c;
}

.st-error {
  color: #f56c6c;
}

.st-stopped {
  color: #909399;
}
</style>
