<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { useTorrentsStore } from '../../stores/torrents'
import { useUiStore } from '../../stores/ui'

/** Set native labels on the selected torrents (whole-array replace).
 *  Multi-selection initializes with the labels common to all selected. */
const { t } = useI18n()
const torrents = useTorrentsStore()
const ui = useUiStore()

const visible = ref(false)
const submitting = ref(false)
const ids = ref<number[]>([])
const labels = ref<string[]>([])

const labelOptions = computed(() => {
  const set = new Set<string>()
  for (const l of torrents.labelCounts) set.add(l.name)
  for (const l of ui.presetLabels) set.add(l)
  return [...set].sort()
})

function open(): void {
  const rows = torrents.selectedTorrents
  if (rows.length === 0) return
  ids.value = rows.map((r) => r.id)
  // Intersection of every selected torrent's labels.
  labels.value = rows
    .map((r) => r.labels ?? [])
    .reduce((acc, cur) => acc.filter((l) => cur.includes(l)), rows[0].labels ?? [])
  visible.value = true
}

defineExpose({ open })

async function submit(): Promise<void> {
  if (ids.value.length === 0 || submitting.value) return
  submitting.value = true
  try {
    await torrents.setLabels(ids.value, [...labels.value])
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
  <el-dialog v-model="visible" :title="t('dialog.labels.title')" width="480px">
    <el-form label-position="top">
      <el-form-item :label="t('dialog.labels.current')">
        <el-select v-model="labels" multiple filterable allow-create class="full">
          <el-option v-for="l in labelOptions" :key="l" :value="l" :label="l" />
        </el-select>
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
.full {
  width: 100%;
}
</style>
