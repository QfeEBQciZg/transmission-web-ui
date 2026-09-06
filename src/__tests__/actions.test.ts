import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { TorrentStatus, type Torrent } from '../api/types'
import {
  TORRENT_LIST_FIELDS,
  sessionStats,
  torrentAction,
  torrentGet,
  torrentRemove,
  torrentRenamePath,
  torrentSet,
  torrentSetLocation,
} from '../api/rpc'
import { __resetPollingForTests, computeActionStates, useTorrentsStore } from '../stores/torrents'
import { makeStats, makeTorrent } from './helpers'

vi.mock('../api/rpc', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/rpc')>()
  return {
    ...actual,
    torrentGet: vi.fn(),
    sessionStats: vi.fn(),
    torrentAction: vi.fn(),
    torrentRemove: vi.fn(),
    torrentSet: vi.fn(),
    torrentSetLocation: vi.fn(),
    torrentRenamePath: vi.fn(),
  }
})

const torrentGetMock = vi.mocked(torrentGet)
const sessionStatsMock = vi.mocked(sessionStats)
const torrentActionMock = vi.mocked(torrentAction)
const torrentRemoveMock = vi.mocked(torrentRemove)
const torrentSetMock = vi.mocked(torrentSet)
const torrentSetLocationMock = vi.mocked(torrentSetLocation)
const torrentRenamePathMock = vi.mocked(torrentRenamePath)

beforeEach(() => {
  setActivePinia(createPinia())
  __resetPollingForTests()
  vi.clearAllMocks()
  torrentGetMock.mockResolvedValue({ torrents: [] })
  sessionStatsMock.mockResolvedValue(makeStats(0))
})

/** Seed the store with an initial full fetch. */
async function seed(torrents: Torrent[]) {
  const store = useTorrentsStore()
  torrentGetMock.mockResolvedValueOnce({ torrents })
  sessionStatsMock.mockResolvedValue(makeStats(torrents.length))
  await store.refresh()
  return store
}

describe('computeActionStates', () => {
  it('disables everything with no selection', () => {
    const s = computeActionStates([])
    expect(Object.values(s).every((v) => v === false)).toBe(true)
  })

  it('single stopped torrent: start/verify only', () => {
    const s = computeActionStates([makeTorrent({ status: TorrentStatus.stopped })])
    expect(s.start).toBe(true)
    expect(s.verify).toBe(true)
    expect(s.stop).toBe(false)
    expect(s.reannounce).toBe(false)
    expect(s.rename).toBe(true)
    expect(s.queue).toBe(true)
  })

  it('single downloading torrent: stop/reannounce only', () => {
    const s = computeActionStates([makeTorrent({ status: TorrentStatus.download })])
    expect(s.start).toBe(false)
    expect(s.verify).toBe(false)
    expect(s.stop).toBe(true)
    expect(s.reannounce).toBe(true)
  })

  it('single checking torrent: nothing status-related', () => {
    const s = computeActionStates([makeTorrent({ status: TorrentStatus.check })])
    expect(s.start).toBe(false)
    expect(s.stop).toBe(false)
    expect(s.verify).toBe(false)
    expect(s.reannounce).toBe(false)
  })

  it('multi-select disables rename/reannounce/queue, enables the rest', () => {
    const s = computeActionStates([makeTorrent({ id: 1 }), makeTorrent({ id: 2 })])
    expect(s.start).toBe(true)
    expect(s.stop).toBe(true)
    expect(s.verify).toBe(true)
    expect(s.remove).toBe(true)
    expect(s.changeDir).toBe(true)
    expect(s.speedLimit).toBe(true)
    expect(s.rename).toBe(false)
    expect(s.reannounce).toBe(false)
    expect(s.queue).toBe(false)
  })
})

describe('selection-driven actions', () => {
  it('start/stop/verify/reannounce act on the checked ids', async () => {
    const store = await seed([makeTorrent({ id: 1 }), makeTorrent({ id: 2 })])
    store.setSelection([1, 2])

    await store.start()
    expect(torrentActionMock).toHaveBeenCalledWith('torrent_start', [1, 2])
    await store.stop()
    expect(torrentActionMock).toHaveBeenCalledWith('torrent_stop', [1, 2])
    await store.verify()
    expect(torrentActionMock).toHaveBeenCalledWith('torrent_verify', [1, 2])
    await store.reannounce()
    expect(torrentActionMock).toHaveBeenCalledWith('torrent_reannounce', [1, 2])
  })

  it('does nothing with an empty selection', async () => {
    const store = await seed([makeTorrent({ id: 1 })])
    await store.start()
    expect(torrentActionMock).not.toHaveBeenCalled()
  })

  it('startAll/stopAll omit ids (applies to all torrents)', async () => {
    const store = await seed([makeTorrent({ id: 1 })])
    await store.startAll()
    expect(torrentActionMock).toHaveBeenCalledWith('torrent_start')
    await store.stopAll()
    expect(torrentActionMock).toHaveBeenCalledWith('torrent_stop')
  })

  it('queueMove maps the direction to the RPC method', async () => {
    const store = await seed([makeTorrent({ id: 1 })])
    store.setSelection([1])
    await store.queueMove('top')
    expect(torrentActionMock).toHaveBeenCalledWith('queue_move_top', [1])
    await store.queueMove('bottom')
    expect(torrentActionMock).toHaveBeenCalledWith('queue_move_bottom', [1])
  })

  it('remove deletes and forces a full refetch', async () => {
    const store = await seed([makeTorrent({ id: 1 }), makeTorrent({ id: 2 })])
    store.setSelection([1])
    torrentGetMock.mockClear()

    await store.remove([1], true)
    expect(torrentRemoveMock).toHaveBeenCalledWith([1], true)
    // Full refetch: torrent_get without an ids argument.
    expect(torrentGetMock).toHaveBeenCalledWith(TORRENT_LIST_FIELDS)
  })

  it('rename uses the current name as the path', async () => {
    const store = await seed([makeTorrent({ id: 1, name: 'old name' })])
    await store.rename(1, 'new name')
    expect(torrentRenamePathMock).toHaveBeenCalledWith(1, 'old name', 'new name')
  })

  it('changeLocation moves and optionally verifies afterwards', async () => {
    const store = await seed([makeTorrent({ id: 1 })])
    await store.changeLocation([1], '/new/dir', true, true)
    expect(torrentSetLocationMock).toHaveBeenCalledWith([1], '/new/dir', true)
    expect(torrentActionMock).toHaveBeenCalledWith('torrent_verify', [1])

    torrentActionMock.mockClear()
    await store.changeLocation([1], '/new/dir', false, false)
    expect(torrentActionMock).not.toHaveBeenCalled()
  })

  it('setSpeedLimits forwards KB/s limits with limited flags', async () => {
    const store = await seed([makeTorrent({ id: 1 })])
    await store.setSpeedLimits([1, 2], {
      download_limited: true,
      download_limit: 512,
      upload_limited: false,
      upload_limit: 0,
    })
    expect(torrentSetMock).toHaveBeenCalledWith([1, 2], {
      download_limited: true,
      download_limit: 512,
      upload_limited: false,
      upload_limit: 0,
    })
  })

  it('setLabels replaces the labels array and forces a full refetch', async () => {
    const store = await seed([makeTorrent({ id: 1 })])
    torrentGetMock.mockClear()
    await store.setLabels([1, 2], ['hd', 'movies'])
    expect(torrentSetMock).toHaveBeenCalledWith([1, 2], { labels: ['hd', 'movies'] })
    expect(torrentGetMock).toHaveBeenCalledWith(TORRENT_LIST_FIELDS)
  })
})

describe('selection & full-refresh bookkeeping', () => {
  it('records the last poll error and clears it on the next success', async () => {
    const store = await seed([makeTorrent({ id: 1 })])
    torrentGetMock.mockRejectedValueOnce(new Error('Failed to fetch'))
    await expect(store.refresh()).rejects.toThrow('Failed to fetch')
    expect(store.lastPollError).toBe('Failed to fetch')

    torrentGetMock.mockResolvedValueOnce({ torrents: [makeTorrent({ id: 1 })] })
    await store.refresh()
    expect(store.lastPollError).toBe('')
  })

  it('prunes checked ids that disappear from the daemon', async () => {
    const store = await seed([makeTorrent({ id: 1 }), makeTorrent({ id: 2 })])
    store.setSelection([1, 2])
    torrentGetMock.mockResolvedValueOnce({ torrents: [], removed: [2] })
    await store.refresh()
    expect(store.selectedIds).toEqual([1])
  })

  it('forces a full refetch when the daemon torrent count changes', async () => {
    const store = await seed([makeTorrent({ id: 1 })])
    torrentGetMock.mockClear()
    sessionStatsMock.mockResolvedValue(makeStats(3))
    torrentGetMock.mockResolvedValueOnce({
      torrents: [makeTorrent({ id: 1 }), makeTorrent({ id: 2 }), makeTorrent({ id: 3 })],
    })
    await store.refresh()
    expect(torrentGetMock).toHaveBeenCalledWith(TORRENT_LIST_FIELDS)
    expect(Object.keys(store.all)).toHaveLength(3)
  })
})
