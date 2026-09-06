import { defineStore } from 'pinia'
import { AnnounceState, TorrentStatus, type Torrent, type TrackerStat } from '../api/types'
import {
  TORRENT_LIST_FIELDS,
  torrentAction,
  torrentGet,
  torrentRemove,
  torrentRenamePath,
  torrentSet,
  torrentSetLocation,
  type TorrentActionMethod,
} from '../api/rpc'
import { useSessionStore } from './session'

/** Derived per-torrent fields computed client-side. */
export interface TorrentDerived {
  /** Σ tracker_stats.seeder_count (negatives clamped) */
  seederCount: number
  /** Σ tracker_stats.leecher_count (negatives clamped) */
  leecherCount: number
  /** True when every tracker is actively failing (failed && not inactive) */
  warning: boolean
  /** max(0, total_size - left_until_done) */
  completeSize: number
  /** Tracker display names (full domain via trackerDisplayName), joined */
  trackerNames: string
  /** Virtual status used by the UI: error/warning flags + status code */
  isError: boolean
  isActively: boolean
}

export type TorrentRow = Torrent & TorrentDerived

/** Sidebar filter selection. */
export interface NavFilter {
  /** e.g. 'all' | 'downloading' | 'paused' | 'seeding' | 'checking' | 'actively' | 'error' | 'warning'
   *  | 'search' | 'tracker:<name>' | 'folder:<path>' | 'label:<name>' | 'statistics' */
  type: string
  value?: string
}

export const DEFAULT_FILTER: NavFilter = { type: 'all' }

/** Get tracker display name from host (stripping www./tracker./announce. prefix). */
export function trackerDisplayName(ts: TrackerStat): string {
  if (ts.host) return ts.host.replace(/^(www\.|tracker\.|announce\.)/, '')
  return ts.sitename
}

export function deriveTorrent(t: Torrent): TorrentDerived {
  let seederCount = 0
  let leecherCount = 0
  const names: string[] = []
  const stats = t.tracker_stats ?? []
  // Warning rule: a torrent warns only when EVERY tracker is actively failing —
  // last announce failed AND the tracker is not inactive. Inactive trackers
  // (stopped torrent, backup tier) never count, so paused torrents and
  // mixed tracker sets stay warning-free.
  let failedCount = 0
  for (const ts of stats) {
    seederCount += Math.max(0, ts.seeder_count)
    leecherCount += Math.max(0, ts.leecher_count)
    const name = trackerDisplayName(ts)
    if (name && !names.includes(name)) names.push(name)
    if (!ts.last_announce_succeeded && ts.announce_state !== AnnounceState.inactive) {
      failedCount++
    }
  }
  const warning = stats.length > 0 && failedCount === stats.length
  return {
    seederCount,
    leecherCount,
    warning: t.error === 0 && warning,
    completeSize: Math.max(0, t.total_size - t.left_until_done),
    trackerNames: names.join('; '),
    isError: t.error !== 0,
    isActively: t.rate_download > 0 || t.rate_upload > 0,
  }
}

export function matchFilter(t: TorrentRow, filter: NavFilter, searchText = ''): boolean {
  switch (filter.type) {
    case 'all':
      return true
    case 'downloading':
      return t.status === TorrentStatus.download || t.status === TorrentStatus.download_wait
    case 'paused':
      return t.status === TorrentStatus.stopped
    case 'seeding':
      return t.status === TorrentStatus.seed || t.status === TorrentStatus.seed_wait
    case 'checking':
      return t.status === TorrentStatus.check || t.status === TorrentStatus.check_wait
    case 'actively':
      return t.isActively
    case 'error':
      return t.isError
    case 'warning':
      return t.warning
    case 'search': {
      if (searchText === '') return true
      // Name first, then the fields users commonly search by.
      const q = searchText.toLowerCase()
      return (
        t.name.toLowerCase().includes(q) ||
        t.download_dir.toLowerCase().includes(q) ||
        (t.labels ?? []).some((l) => l.toLowerCase().includes(q)) ||
        (t.tracker_stats ?? []).some((ts) => ts.host.toLowerCase().includes(q))
      )
    }
    case 'tracker':
      return (t.tracker_stats ?? []).some(
        (ts) => trackerDisplayName(ts) === filter.value || ts.host === filter.value,
      )
    case 'folder': {
      // Hierarchical tree: a node covers its own dir and all descendants.
      const dir = filter.value ?? ''
      if (t.download_dir === dir) return true
      const sep = dir.includes('\\') ? '\\' : '/'
      return t.download_dir.startsWith(dir.endsWith(sep) ? dir : dir + sep)
    }
    case 'label':
      return (t.labels ?? []).includes(filter.value ?? '')
    default:
      return true
  }
}

export interface FolderNode {
  name: string
  path: string
  count: number
  children: FolderNode[]
}

/** Enable/disable state of every selection-driven toolbar & context-menu action. */
export interface TorrentActionStates {
  start: boolean
  stop: boolean
  verify: boolean
  reannounce: boolean
  rename: boolean
  remove: boolean
  changeDir: boolean
  speedLimit: boolean
  copyPath: boolean
  copyMagnet: boolean
  queue: boolean
  labels: boolean
  autoMatch: boolean
}

const NO_ACTIONS: TorrentActionStates = {
  start: false,
  stop: false,
  verify: false,
  reannounce: false,
  rename: false,
  remove: false,
  changeDir: false,
  speedLimit: false,
  copyPath: false,
  copyMagnet: false,
  queue: false,
  labels: false,
  autoMatch: false,
}

export function computeActionStates(rows: Torrent[]): TorrentActionStates {
  if (rows.length === 0) return { ...NO_ACTIONS }
  if (rows.length > 1) {
    // Multi-select: everything except rename / reannounce / queue.
    return {
      ...NO_ACTIONS,
      start: true,
      stop: true,
      verify: true,
      remove: true,
      changeDir: true,
      speedLimit: true,
      copyPath: true,
      labels: true,
      autoMatch: true,
    }
  }
  const t = rows[0]
  const stopped = t.status === TorrentStatus.stopped
  const checking = t.status === TorrentStatus.check || t.status === TorrentStatus.check_wait
  return {
    start: stopped,
    stop: !stopped && !checking,
    verify: stopped,
    reannounce: !stopped && !checking,
    rename: true,
    remove: true,
    changeDir: true,
    speedLimit: true,
    copyPath: true,
    copyMagnet: true,
    queue: true,
    labels: true,
    autoMatch: true,
  }
}

/** Build a hierarchical folder tree from all download_dir values. */
export function buildFolderTree(dirs: Array<{ dir: string; count: number }>): FolderNode[] {
  const roots: FolderNode[] = []
  const nodeByPath = new Map<string, FolderNode>()
  for (const { dir, count } of dirs) {
    const sep = dir.includes('\\') ? '\\' : '/'
    const parts = dir.split(sep).filter((p) => p !== '')
    let prefix = dir.startsWith(sep) ? sep : ''
    let siblings = roots
    for (const part of parts) {
      prefix = prefix === sep ? prefix + part : prefix ? prefix + sep + part : part
      let node = nodeByPath.get(prefix)
      if (!node) {
        node = { name: part, path: prefix, count: 0, children: [] }
        nodeByPath.set(prefix, node)
        siblings.push(node)
        siblings.sort((a, b) => a.name.localeCompare(b.name))
      }
      siblings = node.children
    }
    const leaf = nodeByPath.get(prefix)
    if (leaf) leaf.count += count
  }
  return roots
}

interface TorrentsState {
  /** id → merged torrent object (as returned by RPC) */
  all: Record<number, Torrent>
  loaded: boolean
  /** Force a full fetch on the next poll (e.g. torrent count changed). */
  needFullRefresh: boolean
  filter: NavFilter
  searchText: string
  /** Currently selected torrent id (detail panel), null = none */
  selectedId: number | null
  /** Checked torrent ids (toolbar / context-menu operations) */
  selectedIds: number[]
  polling: boolean
  /** Last poll failure message ('' when the connection is healthy). */
  lastPollError: string
  /** Timestamp of the last successful refresh (drives detail-panel refetch). */
  lastRefreshAt: number
}

let pollTimer: ReturnType<typeof setTimeout> | null = null
let polling = false // reentrancy guard

export const useTorrentsStore = defineStore('torrents', {
  state: (): TorrentsState => ({
    all: {},
    loaded: false,
    needFullRefresh: true,
    filter: DEFAULT_FILTER,
    searchText: '',
    selectedId: null,
    selectedIds: [],
    polling: false,
    lastPollError: '',
    lastRefreshAt: 0,
  }),

  getters: {
    /** Merged list with derived fields attached. */
    rows(): TorrentRow[] {
      return Object.values(this.all).map((t) => ({ ...t, ...deriveTorrent(t) }))
    },

    filteredRows(): TorrentRow[] {
      const rows = this.rows
      if (this.filter.type === 'search') {
        return rows.filter((t) => matchFilter(t, this.filter, this.searchText))
      }
      return rows.filter((t) => matchFilter(t, this.filter))
    },

    countByStatus(): Record<string, number> {
      const c: Record<string, number> = {
        all: 0,
        downloading: 0,
        paused: 0,
        seeding: 0,
        checking: 0,
        actively: 0,
        error: 0,
        warning: 0,
      }
      for (const t of this.rows) {
        c.all++
        if (t.status === TorrentStatus.download || t.status === TorrentStatus.download_wait)
          c.downloading++
        if (t.status === TorrentStatus.stopped) c.paused++
        if (t.status === TorrentStatus.seed || t.status === TorrentStatus.seed_wait) c.seeding++
        if (t.status === TorrentStatus.check || t.status === TorrentStatus.check_wait) c.checking++
        if (t.isActively) c.actively++
        if (t.isError) c.error++
        if (t.warning) c.warning++
      }
      return c
    },

    /** Tracker name → torrent count (sidebar "Trackers" section). */
    trackerCounts(): Array<{ name: string; count: number }> {
      const map = new Map<string, number>()
      for (const t of this.rows) {
        const seen = new Set<string>()
        for (const ts of t.tracker_stats ?? []) {
          const name = trackerDisplayName(ts)
          if (!name || seen.has(name)) continue
          seen.add(name)
          map.set(name, (map.get(name) ?? 0) + 1)
        }
      }
      return [...map.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => a.name.localeCompare(b.name))
    },

    /** download_dir → count (sidebar "Folders" section, hierarchical). */
    folderTree(): FolderNode[] {
      const map = new Map<string, number>()
      for (const t of Object.values(this.all)) {
        map.set(t.download_dir, (map.get(t.download_dir) ?? 0) + 1)
      }
      return buildFolderTree([...map.entries()].map(([dir, count]) => ({ dir, count })))
    },

    /** Union of all native labels with counts. */
    labelCounts(): Array<{ name: string; count: number }> {
      const map = new Map<string, number>()
      for (const t of Object.values(this.all)) {
        for (const label of new Set(t.labels ?? [])) {
          map.set(label, (map.get(label) ?? 0) + 1)
        }
      }
      return [...map.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => a.name.localeCompare(b.name))
    },

    /** Unique download dirs, sorted (used by add/change-dir dialogs). */
    downloadDirs(): string[] {
      const set = new Set<string>()
      for (const t of Object.values(this.all)) set.add(t.download_dir)
      return [...set].sort()
    },

    selectedTorrent(): Torrent | null {
      return this.selectedId != null ? (this.all[this.selectedId] ?? null) : null
    },

    /** Checked torrents in selection order (toolbar / context menu). */
    selectedTorrents(): Torrent[] {
      const out: Torrent[] = []
      for (const id of this.selectedIds) {
        const t = this.all[id]
        if (t) out.push(t)
      }
      return out
    },
  },

  actions: {
    /**
     * One poll cycle: session_stats first (a torrent-count change forces a
     * full refetch), then full fetch on first run / when forced, otherwise
     * recently-active incremental; prunes removed ids; back-fills any
     * unknown ids with a full field set; drops stale checked ids.
     */
    async refresh(): Promise<void> {
      if (polling) return
      polling = true
      try {
        const session = useSessionStore()
        try {
          await session.refreshStats()
          if (session.stats && session.stats.torrent_count !== Object.keys(this.all).length) {
            this.needFullRefresh = true
          }
        } catch {
          // A stats failure must not block the torrent refresh.
        }

        if (this.needFullRefresh) {
          const resp = await torrentGet(TORRENT_LIST_FIELDS)
          const next: Record<number, Torrent> = {}
          for (const t of resp.torrents) next[t.id] = t
          this.all = next
          this.needFullRefresh = false
          this.loaded = true
          void session.refreshFreeSpace()
        } else {
          const resp = await torrentGet(TORRENT_LIST_FIELDS, 'recently_active')
          for (const id of resp.removed ?? []) {
            delete this.all[id]
          }
          const newIds: number[] = []
          for (const t of resp.torrents) {
            if (this.all[t.id]) {
              Object.assign(this.all[t.id], t)
            } else {
              newIds.push(t.id)
            }
          }
          if (newIds.length > 0) {
            const full = await torrentGet(TORRENT_LIST_FIELDS, newIds)
            for (const t of full.torrents) this.all[t.id] = t
          }
        }
        // Drop checked ids that no longer exist on the daemon.
        this.selectedIds = this.selectedIds.filter((id) => id in this.all)
        this.lastPollError = ''
        this.lastRefreshAt = Date.now()
      } catch (e) {
        // Surfaced in the status bar so a dead daemon/dev-proxy is visible.
        this.lastPollError = e instanceof Error ? e.message : String(e)
        throw e
      } finally {
        polling = false
      }
    },

    /** Start the polling loop. */
    startPolling(intervalMs = 5000): void {
      this.stopPolling()
      this.polling = true
      const tick = async () => {
        if (!this.polling) return
        try {
          await this.refresh()
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('[rpc] poll failed', e)
        }
        if (this.polling) pollTimer = setTimeout(tick, intervalMs)
      }
      void tick()
    },

    stopPolling(): void {
      this.polling = false
      if (pollTimer) {
        clearTimeout(pollTimer)
        pollTimer = null
      }
    },

    setFilter(filter: NavFilter): void {
      this.filter = filter
    },

    setSearch(text: string): void {
      this.searchText = text
      if (text) this.filter = { type: 'search' }
      else if (this.filter.type === 'search') this.filter = DEFAULT_FILTER
    },

    select(id: number | null): void {
      this.selectedId = id
    },

    /** Replace the checked ids (table selection). */
    setSelection(ids: number[]): void {
      this.selectedIds = ids
    },

    clearSelection(): void {
      this.selectedIds = []
    },

    /** Re-fetch a single torrent with extra fields (detail panel). */
    async refreshOne(id: number, fields: readonly string[]): Promise<Torrent | null> {
      const resp = await torrentGet(fields, [id])
      const t = resp.torrents[0]
      if (!t) return null
      if (this.all[id]) Object.assign(this.all[id], t)
      else this.all[id] = t
      return this.all[id]
    },

    // ------------------------------------------------------------------
    // Selection-driven mutations (toolbar / context menu)
    // ------------------------------------------------------------------

    async start(ids?: number[]): Promise<void> {
      const targets = ids ?? this.selectedIds
      if (targets.length === 0) return
      await torrentAction('torrent_start', targets)
      await this.refresh()
    },

    async stop(ids?: number[]): Promise<void> {
      const targets = ids ?? this.selectedIds
      if (targets.length === 0) return
      await torrentAction('torrent_stop', targets)
      await this.refresh()
    },

    async verify(ids?: number[]): Promise<void> {
      const targets = ids ?? this.selectedIds
      if (targets.length === 0) return
      await torrentAction('torrent_verify', targets)
      await this.refresh()
    },

    async reannounce(ids?: number[]): Promise<void> {
      const targets = ids ?? this.selectedIds
      if (targets.length === 0) return
      await torrentAction('torrent_reannounce', targets)
      await this.refresh()
    },

    async queueMove(direction: 'top' | 'up' | 'down' | 'bottom', ids?: number[]): Promise<void> {
      const targets = ids ?? this.selectedIds
      if (targets.length === 0) return
      const method = `queue_move_${direction}` as TorrentActionMethod
      await torrentAction(method, targets)
      await this.refresh()
    },

    async startAll(): Promise<void> {
      await torrentAction('torrent_start')
      await this.refresh()
    },

    async stopAll(): Promise<void> {
      await torrentAction('torrent_stop')
      await this.refresh()
    },

    async remove(ids: number[], deleteLocalData: boolean): Promise<void> {
      if (ids.length === 0) return
      await torrentRemove(ids, deleteLocalData)
      this.needFullRefresh = true
      await this.refresh()
    },

    /** Rename a torrent's root path (path = current name). */
    async rename(id: number, newName: string): Promise<void> {
      const t = this.all[id]
      if (!t) return
      await torrentRenamePath(id, t.name, newName)
      await this.refresh()
    },

    /** torrent_set_location (+ optional verify afterwards). */
    async changeLocation(
      ids: number[],
      dir: string,
      move: boolean,
      verifyAfter: boolean,
    ): Promise<void> {
      if (ids.length === 0 || !dir) return
      await torrentSetLocation(ids, dir, move)
      if (verifyAfter) await torrentAction('torrent_verify', ids)
      void useSessionStore().refreshFreeSpace(dir)
      this.needFullRefresh = true
      await this.refresh()
    },

    /** Batch speed limits; limits are in KB/s, *Limited=false means unlimited. */
    async setSpeedLimits(
      ids: number[],
      limits: {
        download_limited: boolean
        download_limit: number
        upload_limited: boolean
        upload_limit: number
      },
    ): Promise<void> {
      if (ids.length === 0) return
      await torrentSet(ids, { ...limits })
      await this.refresh()
    },

    /** Replace the native labels of the given torrents (whole-array write). */
    async setLabels(ids: number[], labels: string[]): Promise<void> {
      if (ids.length === 0) return
      await torrentSet(ids, { labels })
      this.needFullRefresh = true
      await this.refresh()
    },
  },
})

// Test-only helper: reset the module-level poll guard.
export function __resetPollingForTests(): void {
  polling = false
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
}
