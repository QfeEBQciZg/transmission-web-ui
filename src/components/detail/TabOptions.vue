<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import type { Torrent } from '../../api/types'
import { torrentSet } from '../../api/rpc'
import { useTorrentsStore } from '../../stores/torrents'

/** Options tab: per-torrent speed limits, seed ratio / idle rules, peer limit. */
const props = defineProps<{ torrent: Torrent }>()
const { t } = useI18n()
const torrents = useTorrentsStore()

const saving = ref(false)
const dirty = ref(false)

const form = reactive({
  honors_session_limits: true,
  download_limited: false,
  download_limit: 1024,
  upload_limited: false,
  upload_limit: 512,
  seed_ratio_mode: 0,
  seed_ratio_limit: 2,
  seed_idle_mode: 0,
  seed_idle_limit: 30,
  peer_limit: 100,
})

function init(): void {
  const o = props.torrent
  form.honors_session_limits = o.honors_session_limits ?? true
  form.download_limited = o.download_limited ?? false
  form.download_limit = o.download_limit ?? 1024
  form.upload_limited = o.upload_limited ?? false
  form.upload_limit = o.upload_limit ?? 512
  form.seed_ratio_mode = o.seed_ratio_mode ?? 0
  form.seed_ratio_limit = o.seed_ratio_limit ?? 2
  form.seed_idle_mode = o.seed_idle_mode ?? 0
  form.seed_idle_limit = o.seed_idle_limit ?? 30
  form.peer_limit = o.peer_limit ?? 100
}

// Re-init on torrent switch; also when the detail fields first arrive
// (unless the user has already edited something).
watch(
  () => props.torrent.id,
  () => {
    init()
    dirty.value = false
  },
  { immediate: true },
)
watch(
  () => [props.torrent.download_limited, props.torrent.seed_ratio_mode, props.torrent.peer_limit],
  () => {
    if (!dirty.value) init()
  },
)

function markDirty(): void {
  dirty.value = true
}

async function save(): Promise<void> {
  if (saving.value) return
  saving.value = true
  try {
    await torrentSet([props.torrent.id], { ...form })
    await torrents.refreshOne(props.torrent.id, [
      'honors_session_limits',
      'download_limit',
      'download_limited',
      'upload_limit',
      'upload_limited',
      'seed_ratio_limit',
      'seed_ratio_mode',
      'seed_idle_limit',
      'seed_idle_mode',
      'peer_limit',
    ])
    dirty.value = false
    ElMessage.success(t('options.saved'))
  } catch (e) {
    ElMessage.error(t('message.actionFailed', { msg: e instanceof Error ? e.message : String(e) }))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="tab-options">
    <div class="groups">
      <fieldset>
        <legend>{{ t('options.bandwidth') }}</legend>
        <div class="row">
          <el-checkbox v-model="form.honors_session_limits" @change="markDirty">
            {{ t('options.honorGlobal') }}
          </el-checkbox>
        </div>
        <div class="row">
          <el-checkbox v-model="form.download_limited" @change="markDirty" />
          <span class="label field-label">{{ t('options.downLimit') }}</span>
          <el-input-number
            v-model="form.download_limit"
            :min="1"
            :step="128"
            :disabled="!form.download_limited"
            controls-position="right"
            size="small"
            @change="markDirty"
          />
        </div>
        <div class="row">
          <el-checkbox v-model="form.upload_limited" @change="markDirty" />
          <span class="label field-label">{{ t('options.upLimit') }}</span>
          <el-input-number
            v-model="form.upload_limit"
            :min="1"
            :step="128"
            :disabled="!form.upload_limited"
            controls-position="right"
            size="small"
            @change="markDirty"
          />
        </div>
      </fieldset>

      <fieldset>
        <legend>{{ t('options.seeding') }}</legend>
        <div class="row">
          <span class="label field-label">{{ t('options.ratioMode') }}</span>
          <el-select v-model="form.seed_ratio_mode" size="small" class="mode" @change="markDirty">
            <el-option :value="0" :label="t('options.modeGlobal')" />
            <el-option :value="1" :label="t('options.modeStopRatio')" />
            <el-option :value="2" :label="t('options.modeUnlimited')" />
          </el-select>
          <template v-if="form.seed_ratio_mode === 1">
            <span class="label">{{ t('options.ratioLimit') }}</span>
            <el-input-number
              v-model="form.seed_ratio_limit"
              :min="0"
              :step="0.1"
              :precision="2"
              controls-position="right"
              size="small"
              @change="markDirty"
            />
          </template>
        </div>
        <div class="row">
          <span class="label field-label">{{ t('options.idleMode') }}</span>
          <el-select v-model="form.seed_idle_mode" size="small" class="mode" @change="markDirty">
            <el-option :value="0" :label="t('options.modeGlobal')" />
            <el-option :value="1" :label="t('options.modeStopIdle')" />
            <el-option :value="2" :label="t('options.modeUnlimited')" />
          </el-select>
          <template v-if="form.seed_idle_mode === 1">
            <span class="label">{{ t('options.idleLimit') }}</span>
            <el-input-number
              v-model="form.seed_idle_limit"
              :min="1"
              controls-position="right"
              size="small"
              @change="markDirty"
            />
          </template>
        </div>
        <div class="row">
          <span class="label field-label">{{ t('options.peerLimit') }}</span>
          <el-input-number
            v-model="form.peer_limit"
            :min="1"
            controls-position="right"
            size="small"
            @change="markDirty"
          />
        </div>
      </fieldset>
    </div>

    <div class="actions">
      <el-button type="primary" size="small" :loading="saving" :disabled="!dirty" @click="save">
        {{ t('options.save') }}
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.tab-options {
  padding: 8px 4px;
  overflow: auto;
  height: 100%;
}

.groups {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

fieldset {
  border: 1px solid var(--twui-border);
  border-radius: 4px;
  padding: 8px 12px 12px;
  min-width: 340px;
  flex: 1;
}

legend {
  font-size: 12px;
  color: var(--twui-text-secondary);
  padding: 0 4px;
}

.row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.row .label {
  font-size: 13px;
  white-space: nowrap;
}

.row .field-label {
  width: 120px;
  flex: none;
}

.mode {
  width: 180px;
}

.actions {
  margin-top: 12px;
}
</style>
