<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  AlarmClock,
  CircleCheck,
  CopyDocument,
  Delete,
  EditPen,
  FolderAdd,
  FolderOpened,
  Guide,
  Link,
  MoreFilled,
  Odometer,
  PriceTag,
  Search,
  Setting,
  Sort,
  VideoPause,
  VideoPlay,
} from '@element-plus/icons-vue'
import { computeActionStates, useTorrentsStore } from '../../stores/torrents'
import { useSessionStore } from '../../stores/session'

const emit = defineEmits<{ command: [cmd: string] }>()

const { t } = useI18n()
const torrents = useTorrentsStore()
const session = useSessionStore()

/** Enable/disable states for the current selection. */
const states = computed(() => computeActionStates(torrents.selectedTorrents))

function cmd(name: string): void {
  emit('command', name)
}

/** Debounce search input: the store filter re-scans the whole torrent
 *  list, so applying it on every keystroke is wasted work. */
const searchInput = ref(torrents.searchText)
let searchTimer: ReturnType<typeof setTimeout> | undefined

function onSearchInput(v: string): void {
  searchInput.value = v
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => torrents.setSearch(v), 200)
}

onBeforeUnmount(() => {
  clearTimeout(searchTimer)
})
</script>

<template>
  <div class="app-toolbar">
    <el-button size="small" :icon="FolderAdd" @click="cmd('add-files')">
      {{ t('toolbar.addFiles') }}
    </el-button>
    <el-button size="small" :icon="Link" @click="cmd('add-url')">
      {{ t('toolbar.addUrl') }}
    </el-button>

    <el-divider direction="vertical" />
    <el-button size="small" :icon="VideoPlay" :disabled="!states.start" @click="cmd('start')">
      {{ t('toolbar.start') }}
    </el-button>
    <el-button size="small" :icon="VideoPause" :disabled="!states.stop" @click="cmd('stop')">
      {{ t('toolbar.stop') }}
    </el-button>
    <el-button size="small" :icon="VideoPlay" @click="cmd('start-all')">
      {{ t('toolbar.startAll') }}
    </el-button>
    <el-button size="small" :icon="VideoPause" @click="cmd('stop-all')">
      {{ t('toolbar.stopAll') }}
    </el-button>

    <el-divider direction="vertical" />
    <el-button
      size="small"
      :icon="CircleCheck"
      :disabled="!states.verify"
      :title="t('toolbar.verify')"
      @click="cmd('verify')"
    />
    <el-button
      size="small"
      :icon="Guide"
      :disabled="!states.reannounce"
      :title="t('toolbar.reannounce')"
      @click="cmd('reannounce')"
    />
    <el-button
      size="small"
      :icon="Delete"
      :disabled="!states.remove"
      :title="t('toolbar.remove')"
      @click="cmd('remove')"
    />
    <el-button
      size="small"
      :icon="EditPen"
      :disabled="!states.rename"
      :title="t('toolbar.rename')"
      @click="cmd('rename')"
    />
    <el-button
      size="small"
      :icon="FolderOpened"
      :disabled="!states.changeDir"
      :title="t('toolbar.changeDir')"
      @click="cmd('change-dir')"
    />
    <el-button
      size="small"
      :icon="Odometer"
      :disabled="!states.speedLimit"
      :title="t('toolbar.speedLimit')"
      @click="cmd('speed-limit')"
    />
    <el-button
      size="small"
      :icon="CopyDocument"
      :disabled="!states.copyPath"
      :title="t('toolbar.copyPath')"
      @click="cmd('copy-path')"
    />

    <el-divider direction="vertical" />
    <el-dropdown trigger="click" :disabled="!states.queue" @command="cmd">
      <el-button size="small" :icon="Sort" :disabled="!states.queue">
        {{ t('toolbar.queue') }}
      </el-button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="queue-top">{{ t('menu.queueTop') }}</el-dropdown-item>
          <el-dropdown-item command="queue-up">{{ t('menu.queueUp') }}</el-dropdown-item>
          <el-dropdown-item command="queue-down">{{ t('menu.queueDown') }}</el-dropdown-item>
          <el-dropdown-item command="queue-bottom">{{ t('menu.queueBottom') }}</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>

    <span class="spacer" />
    <el-button
      size="small"
      :icon="AlarmClock"
      :type="session.altSpeedEnabled ? 'warning' : ''"
      @click="cmd('toggle-alt-speed')"
    >
      {{ t('toolbar.altSpeed') }}
    </el-button>
    <el-dropdown trigger="click" @command="cmd">
      <el-button size="small" :icon="MoreFilled">{{ t('toolbar.tools') }}</el-button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="set-labels" :icon="PriceTag" :disabled="!states.labels">
            {{ t('menu.setLabels') }}
          </el-dropdown-item>
          <el-dropdown-item command="replace-tracker">{{
            t('dialog.replaceTracker.title')
          }}</el-dropdown-item>
          <el-dropdown-item command="auto-match" :disabled="torrents.selectedTorrents.length === 0">
            {{ t('menu.autoMatch') }}
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
    <el-button size="small" :icon="Setting" @click="cmd('system-config')">
      {{ t('toolbar.settings') }}
    </el-button>
    <el-input
      :model-value="searchInput"
      class="search"
      size="small"
      :placeholder="t('toolbar.search')"
      clearable
      @input="onSearchInput"
    >
      <template #prefix>
        <el-icon><Search /></el-icon>
      </template>
    </el-input>
  </div>
</template>

<style scoped>
.app-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  flex: none;
  background: var(--twui-toolbar-bg);
  border-bottom: 1px solid var(--twui-border);
  overflow-x: auto;
}

.app-toolbar .el-button + .el-button {
  margin-left: 0;
}

/* Disabled buttons keep the plain arrow cursor: EP's default not-allowed
   glyph sits right under the pointer and covers the button's tooltip. */
.app-toolbar .el-button.is-disabled,
.app-toolbar .el-button.is-disabled:hover {
  cursor: default;
}

.app-toolbar .el-divider--vertical {
  margin: 0 6px;
  height: 18px;
}

.app-toolbar .spacer {
  flex: 1;
}

.app-toolbar .search {
  width: 220px;
  flex: none;
}
</style>
