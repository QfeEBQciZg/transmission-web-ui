<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { TORRENT_DETAIL_FIELDS } from '../../api/rpc'
import { useTorrentsStore } from '../../stores/torrents'
import TabGeneral from './TabGeneral.vue'
import TabTrackers from './TabTrackers.vue'
import TabFiles from './TabFiles.vue'
import TabPeers from './TabPeers.vue'
import TabOptions from './TabOptions.vue'

/** Detail panel below the table: 5 tabs for the selected torrent. */
const { t } = useI18n()
const torrents = useTorrentsStore()

const activeTab = ref('general')

/** The selected torrent row (detail fields are merged in as they arrive). */
const row = computed(() =>
  torrents.selectedId != null ? (torrents.all[torrents.selectedId] ?? null) : null,
)

/** Fetch detail fields on selection change and after every successful poll. */
async function fetchDetail(): Promise<void> {
  const id = torrents.selectedId
  if (id == null) return
  try {
    await torrents.refreshOne(id, TORRENT_DETAIL_FIELDS)
  } catch {
    // A failure here is retried on the next poll cycle.
  }
}

watch(
  () => torrents.selectedId,
  () => void fetchDetail(),
  { immediate: true },
)
watch(
  () => torrents.lastRefreshAt,
  () => void fetchDetail(),
)
</script>

<template>
  <div v-if="row" class="attr-panel">
    <el-tabs v-model="activeTab" class="tabs">
      <el-tab-pane :label="t('detail.general')" name="general" lazy>
        <TabGeneral :torrent="row" />
      </el-tab-pane>
      <el-tab-pane :label="t('detail.trackers')" name="trackers" lazy>
        <TabTrackers :torrent="row" />
      </el-tab-pane>
      <el-tab-pane :label="t('detail.files')" name="files" lazy>
        <TabFiles :torrent="row" />
      </el-tab-pane>
      <el-tab-pane :label="t('detail.peers')" name="peers" lazy>
        <TabPeers :torrent="row" />
      </el-tab-pane>
      <el-tab-pane :label="t('detail.options')" name="options" lazy>
        <TabOptions :torrent="row" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped>
.attr-panel {
  flex: none;
  height: 280px;
  border-top: 1px solid var(--twui-border);
  background: var(--twui-bg);
  overflow: hidden;
}

.tabs {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 0 8px;
}

.tabs :deep(.el-tabs__content) {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.tabs :deep(.el-tab-pane) {
  height: 100%;
}
</style>
