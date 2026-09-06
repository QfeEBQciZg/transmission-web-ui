<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Torrent } from '../../api/types'
import { formatBytes, formatTimestamp } from '../../utils/format'
import LabelChips from '../table/LabelChips.vue'
import PiecesGrid from './PiecesGrid.vue'

/** General tab: basic fields + pieces completeness grid. */
const props = defineProps<{ torrent: Torrent }>()
const { t } = useI18n()

const completeSize = computed(() =>
  Math.max(0, props.torrent.total_size - props.torrent.left_until_done),
)

const havePieces = computed(() => {
  if (!props.torrent.pieces || !props.torrent.piece_count) return ''
  const bin = atob(props.torrent.pieces)
  let have = 0
  for (let i = 0; i < props.torrent.piece_count; i++) {
    if ((bin.charCodeAt(i >> 3) & (0x80 >> (i & 7))) !== 0) have++
  }
  return `${have}/${props.torrent.piece_count}`
})
</script>

<template>
  <div class="tab-general">
    <el-descriptions :column="2" border size="small" class="fields">
      <el-descriptions-item :label="t('general.name')" :span="2">
        {{ torrent.name }}
      </el-descriptions-item>
      <el-descriptions-item :label="t('general.hash')" :span="2">
        <span class="mono">{{ torrent.hash_string }}</span>
      </el-descriptions-item>
      <el-descriptions-item :label="t('general.size')">
        {{ formatBytes(torrent.total_size) }}
      </el-descriptions-item>
      <el-descriptions-item :label="t('general.completed')">
        {{ formatBytes(completeSize) }}
      </el-descriptions-item>
      <el-descriptions-item :label="t('general.savePath')" :span="2">
        {{ torrent.download_dir }}
      </el-descriptions-item>
      <el-descriptions-item :label="t('general.addedOn')">
        {{ formatTimestamp(torrent.added_date) }}
      </el-descriptions-item>
      <el-descriptions-item :label="t('general.completedOn')">
        {{ formatTimestamp(torrent.done_date) }}
      </el-descriptions-item>
      <el-descriptions-item :label="t('general.lastActivity')">
        {{ formatTimestamp(torrent.activity_date) }}
      </el-descriptions-item>
      <el-descriptions-item :label="t('general.private')">
        {{ torrent.is_private ? t('general.yes') : t('general.no') }}
      </el-descriptions-item>
      <el-descriptions-item :label="t('general.labels')" :span="2">
        <LabelChips :labels="torrent.labels ?? []" />
      </el-descriptions-item>
      <el-descriptions-item v-if="torrent.creator" :label="t('general.creator')">
        {{ torrent.creator }}
      </el-descriptions-item>
      <el-descriptions-item v-if="torrent.date_created" :label="t('general.createdOn')">
        {{ formatTimestamp(torrent.date_created) }}
      </el-descriptions-item>
      <el-descriptions-item v-if="torrent.comment" :label="t('general.comment')" :span="2">
        {{ torrent.comment }}
      </el-descriptions-item>
      <el-descriptions-item v-if="torrent.error !== 0" :label="t('general.error')" :span="2">
        <span class="error">{{ torrent.error_string }}</span>
      </el-descriptions-item>
      <el-descriptions-item :label="t('general.pieces')" :span="2">
        <div v-if="torrent.pieces && torrent.piece_count" class="pieces">
          <div class="pieces-text">
            {{ havePieces }} × {{ formatBytes(torrent.piece_size ?? 0) }}
          </div>
          <PiecesGrid :pieces="torrent.pieces" :piece-count="torrent.piece_count" />
        </div>
        <span v-else>-</span>
      </el-descriptions-item>
    </el-descriptions>
  </div>
</template>

<style scoped>
.tab-general {
  padding: 8px 4px;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  word-break: break-all;
}

.error {
  color: var(--twui-error);
}

.pieces-text {
  margin-bottom: 4px;
  font-size: 12px;
  color: var(--twui-text-secondary);
}
</style>
