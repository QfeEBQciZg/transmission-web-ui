<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Torrent } from '../../api/types'
import { formatSpeed } from '../../utils/format'
import { countryCode, ensureCountryCode, flagUrl } from '../../utils/peerCountry'

/** Peers tab: address (with country flag), client, progress, speeds, flags. */
const props = defineProps<{ torrent: Torrent }>()
const { t } = useI18n()

const peers = computed(() => props.torrent.peers ?? [])

// Kick off country lookups for the visible peer addresses (cached).
watch(
  peers,
  (list) => {
    for (const p of list) ensureCountryCode(p.address)
  },
  { immediate: true },
)
</script>

<template>
  <div class="tab-peers">
    <el-table :data="peers" size="small" border height="230">
      <el-table-column :label="t('peers.address')" min-width="150">
        <template #default="{ row }">
          <img
            v-if="countryCode(row.address) !== '' && countryCode(row.address) !== '-'"
            :src="flagUrl(countryCode(row.address))"
            :alt="countryCode(row.address)"
            class="flag"
          />
          {{ row.address }}
        </template>
      </el-table-column>
      <el-table-column prop="port" :label="t('peers.port')" width="76" align="right" />
      <el-table-column
        prop="client_name"
        :label="t('peers.client')"
        min-width="140"
        show-overflow-tooltip
      />
      <el-table-column :label="t('peers.progress')" width="80" align="right">
        <template #default="{ row }">{{ (row.progress * 100).toFixed(1) }}%</template>
      </el-table-column>
      <el-table-column :label="t('peers.downSpeed')" width="100" align="right">
        <template #default="{ row }">
          {{ row.rate_to_client > 0 ? formatSpeed(row.rate_to_client) : '' }}
        </template>
      </el-table-column>
      <el-table-column :label="t('peers.upSpeed')" width="100" align="right">
        <template #default="{ row }">
          {{ row.rate_to_peer > 0 ? formatSpeed(row.rate_to_peer) : '' }}
        </template>
      </el-table-column>
      <el-table-column prop="flag_str" :label="t('peers.flags')" width="90" align="center" />
      <el-table-column :label="t('peers.encrypted')" width="64" align="center">
        <template #default="{ row }">{{
          row.is_encrypted ? t('general.yes') : t('general.no')
        }}</template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style scoped>
.tab-peers {
  padding: 8px 4px;
}

.flag {
  width: 16px;
  height: auto;
  margin-right: 6px;
  vertical-align: -2px;
}
</style>
