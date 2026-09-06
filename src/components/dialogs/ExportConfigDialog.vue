<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { useUiStore } from '../../stores/ui'

/** Export UI config as JSON: show + download / copy. */
const { t } = useI18n()
const ui = useUiStore()

const visible = ref(false)
const json = ref('')

function open(): void {
  json.value = ui.exportConfig()
  visible.value = true
}

defineExpose({ open })

function download(): void {
  const blob = new Blob([json.value], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'transmission-web-ui-config.json'
  a.click()
  URL.revokeObjectURL(url)
}

async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(json.value)
    ElMessage.success(t('message.copied'))
  } catch {
    ElMessage.error(t('message.copyFailed'))
  }
}
</script>

<template>
  <el-dialog v-model="visible" :title="t('dialog.export.title')" width="520px" append-to-body>
    <p class="tip">{{ t('dialog.export.tip') }}</p>
    <el-input :model-value="json" type="textarea" :rows="12" readonly />
    <template #footer>
      <el-button @click="copy">{{ t('dialog.export.copy') }}</el-button>
      <el-button type="primary" @click="download">{{ t('dialog.export.download') }}</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.tip {
  margin: 0 0 8px;
  font-size: 13px;
}
</style>
