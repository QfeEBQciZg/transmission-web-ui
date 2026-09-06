import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useUiStore } from '../stores/ui'

/** In-memory localStorage stub (tests run in the node environment). */
function makeLocalStorage(): Storage {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    get length() {
      return map.size
    },
    key: (i: number) => [...map.keys()][i] ?? null,
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', makeLocalStorage())
  setActivePinia(createPinia())
})

describe('ui store config export/import/reset', () => {
  it('export → reset → import restores the preferences', () => {
    const ui = useUiStore()
    ui.setLocale('en')
    ui.setPageSize(100)
    ui.setFolderDictionary(['/data/movies', '/data/tv'])

    const exported = ui.exportConfig()
    expect(JSON.parse(exported).app).toBe('transmission-web-ui')

    ui.resetToDefaults()
    expect(ui.locale).toBe('zh-CN')
    expect(ui.pageSize).toBe(50)
    expect(ui.folderDictionary).toEqual([])

    expect(ui.importConfig(exported)).toBe('')
    expect(ui.locale).toBe('en')
    expect(ui.pageSize).toBe(100)
    expect(ui.folderDictionary).toEqual(['/data/movies', '/data/tv'])
  })

  it('rejects invalid JSON and missing prefs', () => {
    const ui = useUiStore()
    expect(ui.importConfig('not json')).toBe('invalid JSON')
    expect(ui.importConfig('{"foo":1}')).toBe('missing "prefs" object')
  })

  it('ignores invalid values while importing', () => {
    const ui = useUiStore()
    const err = ui.importConfig(
      JSON.stringify({
        app: 'transmission-web-ui',
        version: 1,
        prefs: { locale: 'fr', pageSize: -5, refreshIntervalMs: 100, autoRefresh: false },
      }),
    )
    expect(err).toBe('')
    // Invalid values are skipped, valid ones applied.
    expect(ui.locale).toBe('zh-CN')
    expect(ui.pageSize).toBe(50)
    expect(ui.refreshIntervalMs).toBe(5000)
    expect(ui.autoRefresh).toBe(false)
  })

  it('persists changes to localStorage under one key', () => {
    const ui = useUiStore()
    ui.setPageSize(20)
    const raw = localStorage.getItem('transmission-web-ui')
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw as string).pageSize).toBe(20)
  })

  it('manages hidden and removed known directories correctly', () => {
    const ui = useUiStore()
    ui.setFolderDictionary(['/data/movies', '/data/tv'])
    expect(ui.folderDictionary).toEqual(['/data/movies', '/data/tv'])
    expect(ui.hiddenDownloadDirs).toEqual([])

    // Remove a dir in folderDictionary -> removed from dict and added to hidden list
    ui.removeKnownDir('/data/movies')
    expect(ui.folderDictionary).toEqual(['/data/tv'])
    expect(ui.hiddenDownloadDirs).toEqual(['/data/movies'])

    // Remove a dir from torrents/session that was not in dict -> added to hidden list
    ui.removeKnownDir('/downloads/temp')
    expect(ui.hiddenDownloadDirs).toEqual(['/data/movies', '/downloads/temp'])

    // Unhiding a single directory
    ui.unhideDownloadDir('/downloads/temp')
    expect(ui.hiddenDownloadDirs).toEqual(['/data/movies'])

    // Re-adding a directory to folderDictionary automatically unhides it
    ui.setFolderDictionary(['/data/movies', '/data/tv'])
    expect(ui.hiddenDownloadDirs).toEqual([])

    // Restores all hidden dirs
    ui.removeKnownDir('/data/movies')
    ui.restoreKnownDirs()
    expect(ui.hiddenDownloadDirs).toEqual([])
  })
})
