<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { useTorrentsStore } from '../../stores/torrents'

/** Batch up/down speed limits (KB/s; unchecked = unlimited). */
const { t } = useI18n()
const torrents = useTorrentsStore()

const visible = ref(false)
const submitting = ref(false)
const downEnabled = ref(false)
const downLimit = ref(1024)
const upEnabled = ref(false)
const upLimit = ref(512)
const ids = ref<number[]>([])

function open(): void {
  const rows = torrents.selectedTorrents
  if (rows.length === 0) return
  ids.value = rows.map((r) => r.id)
  // Initialize from the single selected torrent when its detail fields are present.
  const single = rows.length === 1 ? rows[0] : null
  downEnabled.value = single?.download_limited ?? false
  downLimit.value = single?.download_limit ?? 1024
  upEnabled.value = single?.upload_limited ?? false
  upLimit.value = single?.upload_limit ?? 512
  visible.value = true
}

defineExpose({ open })

async function submit(): Promise<void> {
  if (ids.value.length === 0 || submitting.value) return
  submitting.value = true
  try {
    await torrents.setSpeedLimits(ids.value, {
      download_limited: downEnabled.value,
      download_limit: downEnabled.value ? downLimit.value : 0,
      upload_limited: upEnabled.value,
      upload_limit: upEnabled.value ? upLimit.value : 0,
    })
    torrents.clearSelection()
    visible.value = false
  } catch (e) {
    ElMessage.error(t('message.actionFailed', { msg: e instanceof Error ? e.message : String(e) }))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-dialog v-model="visible" :title="t('dialog.speedLimit.title')" width="440px">
    <el-form label-width="110px" label-position="left">
      <el-form-item :label="t('dialog.speedLimit.down')">
        <el-checkbox v-model="downEnabled" class="enable" />
        <el-input-number
          v-model="downLimit"
          :min="1"
          :step="128"
          :disabled="!downEnabled"
          controls-position="right"
        />
        <span class="unit">KB/s</span>
      </el-form-item>
      <el-form-item :label="t('dialog.speedLimit.up')">
        <el-checkbox v-model="upEnabled" class="enable" />
        <el-input-number
          v-model="upLimit"
          :min="1"
          :step="128"
          :disabled="!upEnabled"
          controls-position="right"
        />
        <span class="unit">KB/s</span>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">{{ t('dialog.common.cancel') }}</el-button>
      <el-button type="primary" :loading="submitting" @click="submit">
        {{ t('dialog.common.ok') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.enable {
  margin-right: 8px;
}

.unit {
  margin-left: 8px;
  color: var(--twui-text-secondary);
  font-size: 12px;
}
</style>
