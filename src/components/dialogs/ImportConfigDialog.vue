<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { useUiStore } from '../../stores/ui'

/** Import UI config: paste JSON or pick a file (exported by ExportConfigDialog). */
const { t } = useI18n()
const ui = useUiStore()

const visible = ref(false)
const text = ref('')
const fileInput = ref<HTMLInputElement>()

function open(): void {
  text.value = ''
  visible.value = true
}

defineExpose({ open })

function onFilePicked(e: Event): void {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    text.value = String(reader.result ?? '')
  }
  reader.readAsText(file)
}

function doImport(): void {
  const err = ui.importConfig(text.value)
  if (err === '') {
    ElMessage.success(t('dialog.import.success'))
    visible.value = false
  } else {
    ElMessage.error(t('dialog.import.invalid', { msg: err }))
  }
}
</script>

<template>
  <el-dialog v-model="visible" :title="t('dialog.import.title')" width="520px" append-to-body>
    <p class="tip">{{ t('dialog.import.tip') }}</p>
    <el-input v-model="text" type="textarea" :rows="10" placeholder="{...}" />
    <div class="row">
      <el-button size="small" @click="fileInput?.click()">{{
        t('dialog.import.chooseFile')
      }}</el-button>
      <input
        ref="fileInput"
        type="file"
        accept=".json,application/json"
        class="file"
        @change="onFilePicked"
      />
    </div>
    <template #footer>
      <el-button @click="visible = false">{{ t('dialog.common.cancel') }}</el-button>
      <el-button type="primary" :disabled="text.trim() === ''" @click="doImport">
        {{ t('dialog.import.doImport') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.tip {
  margin: 0 0 8px;
  font-size: 13px;
}

.row {
  margin-top: 8px;
}

.file {
  display: none;
}
</style>
