<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, type UploadRawFile, type UploadUserFile } from 'element-plus'
import { torrentAddByMetainfo } from '../../api/rpc'
import { useSessionStore } from '../../stores/session'
import { useTorrentsStore } from '../../stores/torrents'
import { useUiStore } from '../../stores/ui'
import AddOptions from './AddOptions.vue'

/** Add torrents by uploading .torrent files (metainfo sent as base64). */
const { t } = useI18n()
const session = useSessionStore()
const torrents = useTorrentsStore()
const ui = useUiStore()

const visible = ref(false)
const submitting = ref(false)
const fileList = ref<UploadUserFile[]>([])
const dir = ref('')
const setDefault = ref(false)
const autoStart = ref(true)
const labels = ref<string[]>([])

function open(): void {
  fileList.value = []
  dir.value = session.downloadDir
  setDefault.value = false
  autoStart.value = session.session?.start_added_torrents ?? true
  labels.value = []
  visible.value = true
}

/** Used by the app-wide drag & drop: pre-load the dropped files. */
let syntheticUid = Date.now()
function openWithFiles(files: File[]): void {
  open()
  fileList.value = files.map((f) => {
    const raw = f as UploadRawFile
    raw.uid = ++syntheticUid
    return { name: f.name, uid: raw.uid, status: 'ready', size: f.size, raw } as UploadUserFile
  })
}

defineExpose({ open, openWithFiles })

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const bytes = new Uint8Array(reader.result as ArrayBuffer)
      let bin = ''
      const chunk = 0x8000
      for (let i = 0; i < bytes.length; i += chunk) {
        bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
      }
      resolve(btoa(bin))
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
}

async function submit(): Promise<void> {
  const raws = fileList.value.map((f) => f.raw).filter((f): f is UploadRawFile => f !== undefined)
  if (raws.length === 0 || submitting.value) return
  submitting.value = true
  try {
    for (const file of raws) {
      try {
        const metainfo = await fileToBase64(file)
        const resp = await torrentAddByMetainfo(metainfo, {
          ...(dir.value ? { download_dir: dir.value } : {}),
          paused: !autoStart.value,
          ...(labels.value.length > 0 ? { labels: labels.value } : {}),
        })
        if (resp.torrent_added) {
          ElMessage.success(t('message.added', { name: resp.torrent_added.name }))
          if (dir.value.trim()) ui.unhideDownloadDir(dir.value.trim())
        } else if (resp.torrent_duplicate) {
          ElMessage.warning(t('message.duplicate', { name: resp.torrent_duplicate.name }))
          if (dir.value.trim()) ui.unhideDownloadDir(dir.value.trim())
        }
      } catch (e) {
        ElMessage.error(t('message.addFailed', { msg: e instanceof Error ? e.message : String(e) }))
      }
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
  <el-dialog v-model="visible" :title="t('dialog.addFiles.title')" width="560px">
    <el-upload
      v-model:file-list="fileList"
      drag
      multiple
      accept=".torrent"
      :auto-upload="false"
      class="upload"
    >
      <div class="drop-text">{{ t('dialog.addFiles.dropText') }}</div>
      <div class="drop-hint">{{ t('dialog.addFiles.hint') }}</div>
    </el-upload>
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
        :disabled="fileList.length === 0"
        @click="submit"
      >
        {{ t('dialog.common.add') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.upload {
  margin-bottom: 16px;
}

.drop-text {
  padding: 24px 0 4px;
  font-size: 14px;
}

.drop-hint {
  padding-bottom: 20px;
  font-size: 12px;
  color: var(--twui-text-secondary);
}
</style>
