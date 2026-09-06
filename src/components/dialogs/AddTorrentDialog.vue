<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { torrentAddByUrl } from '../../api/rpc'
import { useSessionStore } from '../../stores/session'
import { useTorrentsStore } from '../../stores/torrents'
import { useUiStore } from '../../stores/ui'
import AddOptions from './AddOptions.vue'

/** Add torrents by magnet link / URL / 40-char info hash. */
const { t } = useI18n()
const session = useSessionStore()
const torrents = useTorrentsStore()
const ui = useUiStore()

const visible = ref(false)
const submitting = ref(false)
const urls = ref('')
const dir = ref('')
const setDefault = ref(false)
const autoStart = ref(true)
const labels = ref<string[]>([])

function open(): void {
  urls.value = ''
  dir.value = session.downloadDir
  setDefault.value = false
  autoStart.value = session.session?.start_added_torrents ?? true
  labels.value = []
  visible.value = true
}

defineExpose({ open })

/** A bare 40-hex info hash is submitted as a magnet link. */
function normalizeUrl(line: string): string {
  return /^[0-9a-fA-F]{40}$/.test(line) ? `magnet:?xt=urn:btih:${line}` : line
}

async function submit(): Promise<void> {
  const lines = urls.value
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  if (lines.length === 0 || submitting.value) return
  submitting.value = true
  try {
    let added = 0
    let duplicated = 0
    let failed = 0
    for (const line of lines) {
      try {
        const resp = await torrentAddByUrl(normalizeUrl(line), {
          ...(dir.value ? { download_dir: dir.value } : {}),
          paused: !autoStart.value,
          ...(labels.value.length > 0 ? { labels: labels.value } : {}),
        })
        if (resp.torrent_added) {
          added++
          if (lines.length === 1)
            ElMessage.success(t('message.added', { name: resp.torrent_added.name }))
        } else if (resp.torrent_duplicate) {
          duplicated++
          if (lines.length === 1)
            ElMessage.warning(t('message.duplicate', { name: resp.torrent_duplicate.name }))
        }
      } catch (e) {
        failed++
        // eslint-disable-next-line no-console
        console.error('[rpc] add failed:', line, e)
        if (lines.length === 1)
          ElMessage.error(
            t('message.addFailed', { msg: e instanceof Error ? e.message : String(e) }),
          )
      }
    }
    // Batch adds get one aggregated toast instead of one per line.
    if (lines.length > 1) {
      const summary = t('message.addBatchResult', { added, duplicated, failed })
      if (failed > 0) ElMessage.error(summary)
      else if (added > 0) ElMessage.success(summary)
      else ElMessage.warning(summary)
    }
    if (added > 0 && dir.value.trim()) {
      ui.unhideDownloadDir(dir.value.trim())
    }
    if (setDefault.value && dir.value && dir.value !== session.downloadDir) {
      await session.saveSession({ download_dir: dir.value })
    }
    visible.value = false
    torrents.needFullRefresh = true
    await torrents.refresh()
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-dialog v-model="visible" :title="t('dialog.addUrl.title')" width="560px">
    <el-form label-width="110px" label-position="left">
      <el-form-item :label="t('dialog.addUrl.urls')">
        <el-input
          v-model="urls"
          type="textarea"
          :rows="5"
          :placeholder="t('dialog.addUrl.placeholder')"
        />
      </el-form-item>
    </el-form>
    <AddOptions
      v-model:dir="dir"
      v-model:set-default="setDefault"
      v-model:auto-start="autoStart"
      v-model:labels="labels"
    />
    <template #footer>
      <el-button @click="visible = false">{{ t('dialog.common.cancel') }}</el-button>
      <el-button
        type="primary"
        :loading="submitting"
        :disabled="urls.trim() === ''"
        @click="submit"
      >
        {{ t('dialog.common.add') }}
      </el-button>
    </template>
  </el-dialog>
</template>
