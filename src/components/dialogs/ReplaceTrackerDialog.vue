<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { torrentSet } from '../../api/rpc'
import { useTorrentsStore } from '../../stores/torrents'
import { replaceTracker } from '../../utils/trackerList'

/** Batch-replace a tracker URL across ALL torrents (tracker_list rewrite). */
const { t } = useI18n()
const torrents = useTorrentsStore()

const visible = ref(false)
const running = ref(false)
const oldUrl = ref('')
const newUrl = ref('')
const progress = ref('')

/** Every announce URL in use, deduplicated. */
const oldOptions = computed(() => {
  const set = new Set<string>()
  for (const row of Object.values(torrents.all)) {
    for (const ts of row.tracker_stats ?? []) {
      if (ts.announce) set.add(ts.announce)
    }
  }
  return [...set].sort()
})

/** Torrents whose tracker_list contains the old URL. */
const affected = computed(() => {
  if (!oldUrl.value) return []
  return Object.values(torrents.all).filter((row) =>
    (row.tracker_stats ?? []).some((ts) => ts.announce === oldUrl.value),
  )
})

function open(): void {
  oldUrl.value = ''
  newUrl.value = ''
  progress.value = ''
  visible.value = true
}

defineExpose({ open })

async function submit(): Promise<void> {
  const targets = affected.value
  const replacement = newUrl.value.trim()
  if (targets.length === 0 || replacement === '' || running.value) return
  running.value = true
  try {
    let done = 0
    for (const row of targets) {
      progress.value = `${++done}/${targets.length}`
      const rewritten = replaceTracker(row.tracker_list ?? '', oldUrl.value, replacement)
      await torrentSet([row.id], { tracker_list: rewritten })
    }
    ElMessage.success(t('dialog.replaceTracker.done', { count: targets.length }))
    torrents.clearSelection()
    visible.value = false
    torrents.needFullRefresh = true
    await torrents.refresh()
  } catch (e) {
    ElMessage.error(t('message.actionFailed', { msg: e instanceof Error ? e.message : String(e) }))
  } finally {
    running.value = false
  }
}
</script>

<template>
  <el-dialog v-model="visible" :title="t('dialog.replaceTracker.title')" width="520px">
    <p class="tip">{{ t('dialog.replaceTracker.tip') }}</p>
    <el-form label-width="100px" label-position="left">
      <el-form-item :label="t('dialog.replaceTracker.old')">
        <el-select v-model="oldUrl" filterable allow-create class="full">
          <el-option v-for="u in oldOptions" :key="u" :value="u" :label="u" />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('dialog.replaceTracker.new')">
        <el-input v-model="newUrl" />
      </el-form-item>
      <el-form-item label=" ">
        <span v-if="oldUrl" :class="affected.length > 0 ? 'ok' : 'none'">
          {{
            affected.length > 0
              ? t('dialog.replaceTracker.affected', { count: affected.length })
              : t('dialog.replaceTracker.notFound')
          }}
        </span>
      </el-form-item>
    </el-form>
    <template #footer>
      <span class="progress">{{ progress }}</span>
      <el-button @click="visible = false">{{ t('dialog.common.cancel') }}</el-button>
      <el-button
        type="primary"
        :loading="running"
        :disabled="affected.length === 0 || newUrl.trim() === ''"
        @click="submit"
      >
        {{ t('dialog.common.ok') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.tip {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--twui-text-secondary);
}

.full {
  width: 100%;
}

.ok {
  color: #67c23a;
}

.none {
  color: var(--twui-warning);
}

.progress {
  float: left;
  line-height: 32px;
  color: var(--twui-text-secondary);
}
</style>
