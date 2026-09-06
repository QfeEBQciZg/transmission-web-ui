<script setup lang="ts">
import { computed, ref, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { Expand, Files, Fold, Folder, Guide, PriceTag, Search } from '@element-plus/icons-vue'
import { useTorrentsStore, type FolderNode, type NavFilter } from '../../stores/torrents'
import { useUiStore } from '../../stores/ui'
import { labelColor } from '../../utils/format'
import {
  IconActive,
  IconCheck,
  IconDownload,
  IconError,
  IconPause,
  IconSeed,
  IconWarning,
} from '../common/StatusSvgIcons'

const { t } = useI18n()
const torrents = useTorrentsStore()
const ui = useUiStore()

interface NavNode {
  key: string
  label: string
  icon: Component
  filter: NavFilter
  count: number
  color?: string
}

/** Status group, plus the transient search node. */
const statusNodes = computed<NavNode[]>(() => {
  const c = torrents.countByStatus
  const nodes: NavNode[] = [
    { key: 'all', label: t('sidenav.all'), icon: Files, filter: { type: 'all' }, count: c.all },
    {
      key: 'downloading',
      label: t('sidenav.downloading'),
      icon: IconDownload,
      filter: { type: 'downloading' },
      count: c.downloading,
    },
    {
      key: 'paused',
      label: t('sidenav.paused'),
      icon: IconPause,
      filter: { type: 'paused' },
      count: c.paused,
    },
    {
      key: 'seeding',
      label: t('sidenav.seeding'),
      icon: IconSeed,
      filter: { type: 'seeding' },
      count: c.seeding,
    },
    {
      key: 'checking',
      label: t('sidenav.checking'),
      icon: IconCheck,
      filter: { type: 'checking' },
      count: c.checking,
    },
    {
      key: 'actively',
      label: t('sidenav.actively'),
      icon: IconActive,
      filter: { type: 'actively' },
      count: c.actively,
    },
    {
      key: 'error',
      label: t('sidenav.error'),
      icon: IconError,
      filter: { type: 'error' },
      count: c.error,
    },
    {
      key: 'warning',
      label: t('sidenav.warning'),
      icon: IconWarning,
      filter: { type: 'warning' },
      count: c.warning,
    },
  ]
  if (torrents.searchText !== '') {
    nodes.push({
      key: 'search',
      label: t('sidenav.searchResult'),
      icon: Search,
      filter: { type: 'search' },
      count: torrents.filter.type === 'search' ? torrents.filteredRows.length : 0,
    })
  }
  return nodes
})

const trackerNodes = computed<NavNode[]>(() =>
  torrents.trackerCounts.map(({ name, count }) => ({
    key: `tracker:${name}`,
    label: name,
    icon: Guide,
    filter: { type: 'tracker', value: name },
    count,
  })),
)

const labelNodes = computed<NavNode[]>(() =>
  torrents.labelCounts.map(({ name, count }) => ({
    key: `label:${name}`,
    label: name,
    icon: PriceTag,
    filter: { type: 'label', value: name },
    count,
    color: labelColor(name),
  })),
)

// ---------------------------------------------------------------------------
// Folder tree: flattened with per-path collapse state and aggregate counts.
// ---------------------------------------------------------------------------

const collapsedFolders = ref(new Set<string>())

interface FlatFolder {
  node: FolderNode
  depth: number
  hasChildren: boolean
}

const flatFolders = computed<FlatFolder[]>(() => {
  const out: FlatFolder[] = []
  const walk = (nodes: FolderNode[], depth: number): void => {
    for (const n of nodes) {
      const hasChildren = n.children.length > 0
      out.push({ node: n, depth, hasChildren })
      if (hasChildren && !collapsedFolders.value.has(n.path)) walk(n.children, depth + 1)
    }
  }
  walk(torrents.folderTree, 0)
  return out
})

function folderCount(n: FolderNode): number {
  return n.count + n.children.reduce((sum, c) => sum + folderCount(c), 0)
}

function toggleFolder(path: string): void {
  const s = new Set(collapsedFolders.value)
  if (s.has(path)) s.delete(path)
  else s.add(path)
  collapsedFolders.value = s
}

function isActive(filter: NavFilter): boolean {
  return torrents.filter.type === filter.type && torrents.filter.value === filter.value
}

function onFilterClick(filter: NavFilter): void {
  // Leaving the search view clears the search text.
  if (torrents.filter.type === 'search') torrents.setSearch('')
  torrents.setFilter(filter)
}
</script>

<template>
  <aside class="side-nav" :class="{ collapsed: ui.sidebarCollapsed }">
    <div class="nav-toolbar">
      <el-button
        text
        size="small"
        :title="ui.sidebarCollapsed ? t('sidenav.expand') : t('sidenav.collapse')"
        @click="ui.toggleSidebar()"
      >
        <el-icon>
          <Expand v-if="ui.sidebarCollapsed" />
          <Fold v-else />
        </el-icon>
      </el-button>
    </div>
    <template v-if="!ui.sidebarCollapsed">
      <div class="nav-group">
        <div class="nav-header">{{ t('sidenav.filters') }}</div>
        <div
          v-for="n in statusNodes"
          :key="n.key"
          class="nav-item"
          :class="{ active: isActive(n.filter) }"
          @click="onFilterClick(n.filter)"
        >
          <el-icon><component :is="n.icon" /></el-icon>
          <span class="label">{{ n.label }}</span>
          <span class="count">{{ n.count }}</span>
        </div>
      </div>

      <div v-if="trackerNodes.length > 0" class="nav-group">
        <div class="nav-header">{{ t('sidenav.trackers') }}</div>
        <div
          v-for="n in trackerNodes"
          :key="n.key"
          class="nav-item"
          :class="{ active: isActive(n.filter) }"
          :title="n.label"
          @click="onFilterClick(n.filter)"
        >
          <el-icon><component :is="n.icon" /></el-icon>
          <span class="label">{{ n.label }}</span>
          <span class="count">{{ n.count }}</span>
        </div>
      </div>

      <div v-if="flatFolders.length > 0" class="nav-group">
        <div class="nav-header">{{ t('sidenav.folders') }}</div>
        <div
          v-for="f in flatFolders"
          :key="f.node.path"
          class="nav-item"
          :class="{ active: isActive({ type: 'folder', value: f.node.path }) }"
          :style="{ paddingLeft: `${12 + f.depth * 14}px` }"
          :title="f.node.path"
          @click="onFilterClick({ type: 'folder', value: f.node.path })"
        >
          <span
            class="twisty"
            :class="{ leaf: !f.hasChildren }"
            @click.stop="f.hasChildren && toggleFolder(f.node.path)"
          >
            {{ f.hasChildren ? (collapsedFolders.has(f.node.path) ? '▸' : '▾') : '' }}
          </span>
          <el-icon><Folder /></el-icon>
          <span class="label">{{ f.node.name }}</span>
          <span class="count">{{ folderCount(f.node) }}</span>
        </div>
      </div>

      <div v-if="labelNodes.length > 0" class="nav-group">
        <div class="nav-header">{{ t('sidenav.labels') }}</div>
        <div
          v-for="n in labelNodes"
          :key="n.key"
          class="nav-item"
          :class="{ active: isActive(n.filter) }"
          :title="n.label"
          @click="onFilterClick(n.filter)"
        >
          <span class="dot" :style="{ backgroundColor: n.color }" />
          <span class="label">{{ n.label }}</span>
          <span class="count">{{ n.count }}</span>
        </div>
      </div>
    </template>
  </aside>
</template>

<style scoped>
.side-nav {
  width: 200px;
  flex: none;
  background: var(--twui-sidebar-bg);
  border-right: 1px solid var(--twui-border);
  overflow-y: auto;
  padding-bottom: 8px;
}

.side-nav.collapsed {
  width: 34px;
  overflow: hidden;
}

.nav-toolbar {
  display: flex;
  justify-content: flex-end;
  padding: 2px 4px 0;
}

.side-nav.collapsed .nav-toolbar {
  justify-content: center;
  padding: 2px 0 0;
}

.nav-header {
  padding: 10px 12px 4px;
  font-size: 12px;
  color: var(--twui-text-secondary);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  cursor: pointer;
  font-size: 13px;
  user-select: none;
}

.nav-item:hover {
  background: rgba(0, 0, 0, 0.04);
}

.nav-item.active {
  background: rgba(64, 158, 255, 0.12);
  color: #409eff;
}

.nav-item .label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-item .count {
  font-size: 12px;
  color: var(--twui-text-secondary);
}

.twisty {
  width: 12px;
  flex: none;
  font-size: 10px;
  color: var(--twui-text-secondary);
  text-align: center;
}

.dot {
  width: 10px;
  height: 10px;
  flex: none;
  border-radius: 50%;
}
</style>
