<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { useTorrentsStore } from '../../stores/torrents'

/** Rename the selected torrent's root path (single selection only). */
const { t } = useI18n()
const torrents = useTorrentsStore()

const visible = ref(false)
const submitting = ref(false)
const targetId = ref<number | null>(null)
const newName = ref('')

function open(): void {
  const row = torrents.selectedTorrents[0]
  if (!row) return
  targetId.value = row.id
  newName.value = row.name
  visible.value = true
}

defineExpose({ open })

async function submit(): Promise<void> {
  const id = targetId.value
  const name = newName.value.trim()
  if (id == null || name === '' || submitting.value) return
  submitting.value = true
  try {
    await torrents.rename(id, name)
    visible.value = false
  } catch (e) {
    ElMessage.error(t('message.actionFailed', { msg: e instanceof Error ? e.message : String(e) }))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-dialog v-model="visible" :title="t('dialog.rename.title')" width="480px">
    <el-form label-width="80px" label-position="left" @submit.prevent="submit">
      <el-form-item :label="t('dialog.rename.label')">
        <el-input v-model="newName" autofocus />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">{{ t('dialog.common.cancel') }}</el-button>
      <el-button
        type="primary"
        :loading="submitting"
        :disabled="newName.trim() === ''"
        @click="submit"
      >
        {{ t('dialog.common.ok') }}
      </el-button>
    </template>
  </el-dialog>
</template>
