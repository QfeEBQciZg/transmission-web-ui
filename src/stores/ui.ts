import { defineStore } from 'pinia'

/**
 * UI preferences persisted to localStorage.
 * Everything under one key so it can be exported/imported later.
 */

const STORAGE_KEY = 'transmission-web-ui'

export interface ColumnConfig {
  /** Column keys in display order */
  order: string[]
  /** Hidden column keys */
  hidden: string[]
  /** Column widths by key */
  widths: Record<string, number>
}

export interface UiPrefs {
  locale: 'zh-CN' | 'en'
  autoRefresh: boolean
  refreshIntervalMs: number
  pageSize: number
  columns: ColumnConfig
  /** Folder dictionary for auto-match-data-folder */
  folderDictionary: string[]
  /** Preset label tags for add/set label autocomplete */
  presetLabels: string[]
  /** Download directories explicitly hidden/removed from autocomplete suggestions */
  hiddenDownloadDirs: string[]
  sidebarCollapsed: boolean
}

const DEFAULT_COLUMNS: ColumnConfig = {
  order: [
    'name',
    'total_size',
    'percent_done',
    'eta',
    'upload_ratio',
    'status',
    'seeds',
    'peers',
    'rate_download',
    'rate_upload',
    'downloaded',
    'uploaded_ever',
    'added_date',
    'id',
    'queue_position',
    'trackers',
    'download_dir',
    'activity_date',
    'labels',
    'done_date',
  ],
  hidden: ['id', 'queue_position', 'download_dir', 'activity_date', 'done_date'],
  widths: {},
}

function defaults(): UiPrefs {
  return {
    locale: 'zh-CN',
    autoRefresh: true,
    refreshIntervalMs: 5000,
    pageSize: 50,
    columns: DEFAULT_COLUMNS,
    folderDictionary: [],
    presetLabels: ['Movies', 'TV', 'Music', 'Software', 'Games'],
    hiddenDownloadDirs: [],
    sidebarCollapsed: false,
  }
}

function load(): UiPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaults()
    const parsed = JSON.parse(raw) as Partial<UiPrefs>
    return {
      ...defaults(),
      ...parsed,
      columns: { ...DEFAULT_COLUMNS, ...(parsed.columns ?? {}) },
      presetLabels: Array.isArray(parsed.presetLabels)
        ? parsed.presetLabels.filter((s): s is string => typeof s === 'string')
        : defaults().presetLabels,
      hiddenDownloadDirs: Array.isArray(parsed.hiddenDownloadDirs)
        ? parsed.hiddenDownloadDirs.filter((s): s is string => typeof s === 'string')
        : [],
    }
  } catch {
    return defaults()
  }
}

export const useUiStore = defineStore('ui', {
  state: (): UiPrefs => load(),

  actions: {
    persist(): void {
      const {
        locale,
        autoRefresh,
        refreshIntervalMs,
        pageSize,
        columns,
        folderDictionary,
        presetLabels,
        hiddenDownloadDirs,
        sidebarCollapsed,
      } = this.$state
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          locale,
          autoRefresh,
          refreshIntervalMs,
          pageSize,
          columns,
          folderDictionary,
          presetLabels,
          hiddenDownloadDirs,
          sidebarCollapsed,
        }),
      )
    },

    setLocale(locale: 'zh-CN' | 'en'): void {
      this.locale = locale
      this.persist()
    },

    setAutoRefresh(enabled: boolean, intervalMs?: number): void {
      this.autoRefresh = enabled
      if (intervalMs && intervalMs >= 3000) this.refreshIntervalMs = intervalMs
      this.persist()
    },

    setPageSize(size: number): void {
      this.pageSize = size
      this.persist()
    },

    setColumnHidden(key: string, hidden: boolean): void {
      const set = new Set(this.columns.hidden)
      if (hidden) set.add(key)
      else set.delete(key)
      this.columns.hidden = [...set]
      this.persist()
    },

    setColumnWidth(key: string, width: number): void {
      this.columns.widths[key] = width
      this.persist()
    },

    setFolderDictionary(dirs: string[]): void {
      this.folderDictionary = dirs
      if (dirs.length > 0) {
        const dirSet = new Set(dirs)
        this.hiddenDownloadDirs = this.hiddenDownloadDirs.filter((d) => !dirSet.has(d))
      }
      this.persist()
    },

    setPresetLabels(labels: string[]): void {
      this.presetLabels = labels
      this.persist()
    },

    removeKnownDir(dir: string): void {
      if (this.folderDictionary.includes(dir)) {
        this.folderDictionary = this.folderDictionary.filter((d) => d !== dir)
      }
      if (!this.hiddenDownloadDirs.includes(dir)) {
        this.hiddenDownloadDirs.push(dir)
      }
      this.persist()
    },

    restoreKnownDirs(): void {
      this.hiddenDownloadDirs = []
      this.persist()
    },

    unhideDownloadDir(dir: string): void {
      this.hiddenDownloadDirs = this.hiddenDownloadDirs.filter((d) => d !== dir)
      this.persist()
    },

    toggleSidebar(): void {
      this.sidebarCollapsed = !this.sidebarCollapsed
      this.persist()
    },

    /** Reset all UI preferences to defaults (settings dialog "恢复默认"). */
    resetToDefaults(): void {
      this.$patch(defaults())
      this.persist()
    },

    /** Export the UI preferences as a JSON string (config export). */
    exportConfig(): string {
      const {
        locale,
        autoRefresh,
        refreshIntervalMs,
        pageSize,
        columns,
        folderDictionary,
        presetLabels,
        hiddenDownloadDirs,
        sidebarCollapsed,
      } = this.$state
      return JSON.stringify(
        {
          app: 'transmission-web-ui',
          version: 1,
          prefs: {
            locale,
            autoRefresh,
            refreshIntervalMs,
            pageSize,
            columns,
            folderDictionary,
            presetLabels,
            hiddenDownloadDirs,
            sidebarCollapsed,
          },
        },
        null,
        2,
      )
    },

    /**
     * Import UI preferences from an exported JSON string.
     * Returns '' on success, otherwise an error message.
     */
    importConfig(json: string): string {
      let parsed: unknown
      try {
        parsed = JSON.parse(json)
      } catch {
        return 'invalid JSON'
      }
      const prefs = (parsed as { prefs?: unknown })?.prefs
      if (typeof prefs !== 'object' || prefs === null) return 'missing "prefs" object'
      const p = prefs as Partial<UiPrefs>
      const next = defaults()
      if (p.locale === 'zh-CN' || p.locale === 'en') next.locale = p.locale
      if (typeof p.autoRefresh === 'boolean') next.autoRefresh = p.autoRefresh
      if (typeof p.refreshIntervalMs === 'number' && p.refreshIntervalMs >= 3000)
        next.refreshIntervalMs = p.refreshIntervalMs
      if (typeof p.pageSize === 'number' && p.pageSize >= 0) next.pageSize = p.pageSize
      if (p.columns && Array.isArray(p.columns.order) && Array.isArray(p.columns.hidden)) {
        next.columns = {
          order: p.columns.order.filter((k): k is string => typeof k === 'string'),
          hidden: p.columns.hidden.filter((k): k is string => typeof k === 'string'),
          widths:
            typeof p.columns.widths === 'object' && p.columns.widths !== null
              ? (p.columns.widths as Record<string, number>)
              : {},
        }
      }
      if (Array.isArray(p.folderDictionary)) {
        next.folderDictionary = p.folderDictionary.filter((d): d is string => typeof d === 'string')
      }
      if (Array.isArray(p.presetLabels)) {
        next.presetLabels = p.presetLabels.filter((s): s is string => typeof s === 'string')
      }
      if (Array.isArray(p.hiddenDownloadDirs)) {
        next.hiddenDownloadDirs = p.hiddenDownloadDirs.filter(
          (d): d is string => typeof d === 'string',
        )
      }
      if (typeof p.sidebarCollapsed === 'boolean') next.sidebarCollapsed = p.sidebarCollapsed
      this.$patch(next)
      this.persist()
      return ''
    },
  },
})
