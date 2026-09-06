<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'

/** Add (multi-URL, with public-list fetch) or edit (single URL) trackers. */
const { t } = useI18n()

const emit = defineEmits<{
  confirm: [payload: { mode: 'add' | 'edit'; oldUrl?: string; urls: string[] }]
}>()

const NGOSANG_BEST_URL =
  'https://raw.githubusercontent.com/ngosang/trackerslist/master/trackers_best.txt'

const visible = ref(false)
const fetching = ref(false)
const mode = ref<'add' | 'edit'>('add')
const oldUrl = ref('')
const text = ref('')

function open(opts: { mode: 'add' | 'edit'; oldUrl?: string }): void {
  mode.value = opts.mode
  oldUrl.value = opts.oldUrl ?? ''
  text.value = opts.oldUrl ?? ''
  visible.value = true
}

defineExpose({ open })

/** Pull the ngosang trackerslist (best) into the textarea. */
async function fetchPublic(): Promise<void> {
  if (fetching.value) return
  fetching.value = true
  try {
    const resp = await fetch(NGOSANG_BEST_URL)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const body = await resp.text()
    const urls = body
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    if (urls.length === 0) throw new Error('empty list')
    text.value = urls.join('\n')
    ElMessage.success(t('trackers.fetched', { count: urls.length }))
  } catch {
    ElMessage.error(t('trackers.fetchFailed'))
  } finally {
    fetching.value = false
  }
}

function submit(): void {
  const urls = text.value
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  if (urls.length === 0) return
  emit('confirm', { mode: mode.value, oldUrl: oldUrl.value || undefined, urls })
  visible.value = false
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="mode === 'add' ? t('trackers.addTitle') : t('trackers.editTitle')"
    width="520px"
  >
    <el-form label-position="top">
      <el-form-item :label="mode === 'add' ? t('trackers.urlsLabel') : t('trackers.urlLabel')">
        <el-input v-if="mode === 'add'" v-model="text" type="textarea" :rows="8" />
        <el-input v-else v-model="text" />
      </el-form-item>
      <el-form-item v-if="mode === 'add'">
        <el-button size="small" :loading="fetching" @click="fetchPublic">
          {{ fetching ? t('trackers.fetching') : t('trackers.fetchPublic') }}
        </el-button>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">{{ t('dialog.common.cancel') }}</el-button>
      <el-button type="primary" :disabled="text.trim() === ''" @click="submit">
        {{ t('dialog.common.ok') }}
      </el-button>
    </template>
  </el-dialog>
</template>
