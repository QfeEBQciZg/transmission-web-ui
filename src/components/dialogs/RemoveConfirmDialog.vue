<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { useTorrentsStore } from '../../stores/torrents'

/** Confirm removal of the selected torrents (optionally deleting local data). */
const { t } = useI18n()
const torrents = useTorrentsStore()

const visible = ref(false)
const submitting = ref(false)
const deleteData = ref(false)
const ids = ref<number[]>([])
const names = ref<string[]>([])

function open(): void {
  const rows = torrents.selectedTorrents
  if (rows.length === 0) return
  ids.value = rows.map((r) => r.id)
  names.value = rows.map((r) => r.name)
  deleteData.value = false
  visible.value = true
}

defineExpose({ open })

async function submit(): Promise<void> {
  if (ids.value.length === 0 || submitting.value) return
  submitting.value = true
  try {
    await torrents.remove(ids.value, deleteData.value)
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
  <el-dialog v-model="visible" :title="t('dialog.remove.title')" width="480px">
    <p class="confirm-text">{{ t('dialog.remove.confirm', { count: ids.length }) }}</p>
    <div class="name-list">
      <div v-for="n in names" :key="n" class="name">{{ n }}</div>
    </div>
    <el-checkbox v-model="deleteData">{{ t('dialog.remove.deleteData') }}</el-checkbox>
    <template #footer>
      <el-button @click="visible = false">{{ t('dialog.common.cancel') }}</el-button>
      <el-button type="danger" :loading="submitting" @click="submit">
        {{ t('dialog.common.ok') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.confirm-text {
  margin: 0 0 8px;
}

.name-list {
  max-height: 140px;
  overflow-y: auto;
  margin-bottom: 12px;
  padding: 6px 8px;
  background: #f5f7fa;
  border-radius: 4px;
  font-size: 12px;
  color: var(--twui-text-secondary);
}

.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
