import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { AnnounceState, TorrentStatus, type Torrent } from '../api/types'
import { TORRENT_LIST_FIELDS, torrentGet } from '../api/rpc'
import {
  __resetPollingForTests,
  buildFolderTree,
  deriveTorrent,
  matchFilter,
  useTorrentsStore,
  type TorrentRow,
} from '../stores/torrents'
import { makeTorrent, makeTrackerStat } from './helpers'

vi.mock('../api/rpc', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/rpc')>()
  return { ...actual, torrentGet: vi.fn() }
})

const torrentGetMock = vi.mocked(torrentGet)

function asRow(t: Torrent): TorrentRow {
  return { ...t, ...deriveTorrent(t) }
}

beforeEach(() => {
  setActivePinia(createPinia())
  __resetPollingForTests()
  torrentGetMock.mockReset()
})

describe('deriveTorrent', () => {
  it('sums seeder/leecher counts across trackers, clamping negatives', () => {
    const t = makeTorrent({
      tracker_stats: [
        makeTrackerStat({ seeder_count: 10, leecher_count: 3 }),
        makeTrackerStat({ seeder_count: -1, leecher_count: -1, sitename: 'other', host: 'o.th' }),
      ],
    })
    const d = deriveTorrent(t)
    expect(d.seederCount).toBe(10)
    expect(d.leecherCount).toBe(3)
  })

  it('joins deduplicated tracker display names (host-derived, TLD kept)', () => {
    const t = makeTorrent({
      tracker_stats: [
        // sitename is ignored on purpose: the daemon reduces it to the
        // domain base name, collapsing abc.com and abc.net into "abc".
        makeTrackerStat({ sitename: 'abc', host: 'tracker.abc.com' }),
        makeTrackerStat({ sitename: '', host: 'www.beta.org' }),
        makeTrackerStat({ sitename: 'abc', host: 'tracker.abc.com' }),
      ],
    })
    expect(deriveTorrent(t).trackerNames).toBe('abc.com; beta.org')
  })

  it('keeps same-base domains distinct (abc.com vs abc.net)', () => {
    const t = makeTorrent({
      tracker_stats: [
        makeTrackerStat({ sitename: 'abc', host: 'tracker.abc.com' }),
        makeTrackerStat({ sitename: 'abc', host: 'tracker.abc.net' }),
      ],
    })
    expect(deriveTorrent(t).trackerNames).toBe('abc.com; abc.net')
  })

  it('flags warning only when every tracker is actively failing', () => {
    // makeTrackerStat defaults to announce_state = active (3).
    const allFailed = makeTorrent({
      tracker_stats: [
        makeTrackerStat({ last_announce_succeeded: false }),
        makeTrackerStat({ last_announce_succeeded: false, host: 't2', sitename: 't2' }),
      ],
    })
    expect(deriveTorrent(allFailed).warning).toBe(true)

    const oneOk = makeTorrent({
      tracker_stats: [
        makeTrackerStat({ last_announce_succeeded: false }),
        makeTrackerStat({ last_announce_succeeded: true, host: 't2', sitename: 't2' }),
      ],
    })
    expect(deriveTorrent(oneOk).warning).toBe(false)

    const noTrackers = makeTorrent({ tracker_stats: [] })
    expect(deriveTorrent(noTrackers).warning).toBe(false)
  })

  it('never flags warning for stopped torrents (all trackers inactive)', () => {
    // Regression: a paused torrent showed the warning icon instead of pause.
    const stopped = makeTorrent({
      status: TorrentStatus.stopped,
      tracker_stats: [
        makeTrackerStat({ announce_state: AnnounceState.inactive, last_announce_succeeded: false }),
        makeTrackerStat({
          announce_state: AnnounceState.inactive,
          last_announce_succeeded: false,
          host: 't2',
          sitename: 't2',
        }),
      ],
    })
    expect(deriveTorrent(stopped).warning).toBe(false)
  })

  it('does not flag warning when only some trackers are actively failing', () => {
    // Requires warnings.length == trackerStats.length: an inactive
    // (e.g. backup-tier) tracker alongside a failing one keeps it quiet.
    const mixed = makeTorrent({
      tracker_stats: [
        makeTrackerStat({ last_announce_succeeded: false }),
        makeTrackerStat({
          announce_state: AnnounceState.inactive,
          last_announce_succeeded: false,
          host: 't2',
          sitename: 't2',
        }),
      ],
    })
    expect(deriveTorrent(mixed).warning).toBe(false)
  })

  it('suppresses warning and sets isError when the torrent has an error', () => {
    const t = makeTorrent({
      error: 3,
      error_string: 'No data found',
      tracker_stats: [makeTrackerStat({ last_announce_succeeded: false })],
    })
    const d = deriveTorrent(t)
    expect(d.isError).toBe(true)
    expect(d.warning).toBe(false)
  })

  it('computes completeSize and the actively flag', () => {
    const d = deriveTorrent(makeTorrent({ total_size: 1000, left_until_done: 250, rate_upload: 1 }))
    expect(d.completeSize).toBe(750)
    expect(d.isActively).toBe(true)
    expect(deriveTorrent(makeTorrent()).isActively).toBe(false)
  })
})

describe('matchFilter', () => {
  const cases: Array<[string, Partial<Torrent>, boolean]> = [
    ['downloading', { status: TorrentStatus.download }, true],
    ['downloading', { status: TorrentStatus.download_wait }, true],
    ['downloading', { status: TorrentStatus.seed }, false],
    ['paused', { status: TorrentStatus.stopped }, true],
    ['seeding', { status: TorrentStatus.seed }, true],
    ['seeding', { status: TorrentStatus.seed_wait }, true],
    ['checking', { status: TorrentStatus.check }, true],
    ['checking', { status: TorrentStatus.check_wait }, true],
    ['actively', { rate_download: 1 }, true],
    ['error', { error: 1 }, true],
  ]

  for (const [type, partial, expected] of cases) {
    it(`${type} filter ${expected ? 'matches' : 'rejects'} status/rate fixture`, () => {
      expect(matchFilter(asRow(makeTorrent(partial)), { type })).toBe(expected)
    })
  }

  it('matches search text case-insensitively', () => {
    const row = asRow(makeTorrent({ name: 'Ubuntu 24.04 LTS' }))
    expect(matchFilter(row, { type: 'search' }, 'ubuntu')).toBe(true)
    expect(matchFilter(row, { type: 'search' }, 'debian')).toBe(false)
    expect(matchFilter(row, { type: 'search' }, '')).toBe(true)
  })

  it('matches search text against directory, labels, and tracker hosts', () => {
    const row = asRow(
      makeTorrent({
        name: 'some release',
        download_dir: '/data/Movies/HD',
        labels: ['Linux-ISO'],
        tracker_stats: [makeTrackerStat({ host: 'tracker.example.com' })],
      }),
    )
    expect(matchFilter(row, { type: 'search' }, 'movies')).toBe(true)
    expect(matchFilter(row, { type: 'search' }, 'linux-iso')).toBe(true)
    expect(matchFilter(row, { type: 'search' }, 'tracker.example')).toBe(true)
    expect(matchFilter(row, { type: 'search' }, 'nothing')).toBe(false)
  })

  it('matches tracker by display name or host', () => {
    const row = asRow(
      makeTorrent({
        tracker_stats: [makeTrackerStat({ sitename: 'alpha', host: 'tracker.alpha.org' })],
      }),
    )
    // Display name keeps the full domain ("tracker." subdomain stripped);
    // the daemon's sitename ("alpha") does not match.
    expect(matchFilter(row, { type: 'tracker', value: 'alpha.org' })).toBe(true)
    expect(matchFilter(row, { type: 'tracker', value: 'tracker.alpha.org' })).toBe(true)
    expect(matchFilter(row, { type: 'tracker', value: 'alpha' })).toBe(false)
    expect(matchFilter(row, { type: 'tracker', value: 'beta.org' })).toBe(false)
  })

  it('matches folder filter hierarchically (node covers descendants)', () => {
    const row = asRow(makeTorrent({ download_dir: '/data/movies', labels: ['hd', 'movies'] }))
    expect(matchFilter(row, { type: 'folder', value: '/data/movies' })).toBe(true)
    // Parent node matches children; sibling prefixes do not.
    expect(matchFilter(row, { type: 'folder', value: '/data' })).toBe(true)
    expect(matchFilter(row, { type: 'folder', value: '/data2' })).toBe(false)
    expect(matchFilter(row, { type: 'folder', value: '/data/mo' })).toBe(false)
    expect(matchFilter(row, { type: 'label', value: 'hd' })).toBe(true)
    expect(matchFilter(row, { type: 'label', value: 'sd' })).toBe(false)
  })
})

describe('buildFolderTree', () => {
  it('builds a sorted hierarchy with per-leaf counts', () => {
    const roots = buildFolderTree([
      { dir: '/data/movies', count: 2 },
      { dir: '/data/tv', count: 1 },
      { dir: '/downloads', count: 3 },
    ])
    expect(roots.map((n) => n.path)).toEqual(['/data', '/downloads'])
    const data = roots[0]
    expect(data.children.map((n) => `${n.name}:${n.count}`)).toEqual(['movies:2', 'tv:1'])
  })

  it('handles windows-style separators', () => {
    const roots = buildFolderTree([{ dir: 'C:\\dl\\movies', count: 1 }])
    expect(roots[0].path).toBe('C:')
    expect(roots[0].children[0].path).toBe('C:\\dl')
    expect(roots[0].children[0].children[0].count).toBe(1)
  })
})

describe('torrents store refresh', () => {
  it('does a full fetch first, then merges incremental updates', async () => {
    const store = useTorrentsStore()

    torrentGetMock.mockResolvedValueOnce({
      torrents: [makeTorrent({ id: 1 }), makeTorrent({ id: 2, name: 'debian.iso' })],
    })
    await store.refresh()
    expect(Object.keys(store.all).sort()).toEqual(['1', '2'])
    expect(torrentGetMock).toHaveBeenLastCalledWith(TORRENT_LIST_FIELDS)

    // Incremental: id 1 updated, id 2 removed, id 3 appears and is back-filled.
    torrentGetMock.mockResolvedValueOnce({
      torrents: [makeTorrent({ id: 1, rate_download: 100 }), makeTorrent({ id: 3 })],
      removed: [2],
    })
    torrentGetMock.mockResolvedValueOnce({
      torrents: [makeTorrent({ id: 3, name: 'fedora.iso' })],
    })
    await store.refresh()

    expect(torrentGetMock).toHaveBeenNthCalledWith(2, TORRENT_LIST_FIELDS, 'recently_active')
    expect(torrentGetMock).toHaveBeenNthCalledWith(3, TORRENT_LIST_FIELDS, [3])
    expect(store.all[2]).toBeUndefined()
    expect(store.all[1].rate_download).toBe(100)
    expect(store.all[3].name).toBe('fedora.iso')
  })

  it('re-fetches everything when needFullRefresh is set again', async () => {
    const store = useTorrentsStore()
    torrentGetMock.mockResolvedValue({ torrents: [makeTorrent({ id: 1 })] })
    await store.refresh()
    store.needFullRefresh = true
    await store.refresh()
    expect(torrentGetMock).toHaveBeenLastCalledWith(TORRENT_LIST_FIELDS)
  })
})

describe('category indexes', () => {
  it('counts torrents per sidebar status bucket', async () => {
    const store = useTorrentsStore()
    torrentGetMock.mockResolvedValueOnce({
      torrents: [
        makeTorrent({ id: 1, status: TorrentStatus.download }),
        makeTorrent({ id: 2, status: TorrentStatus.seed, rate_upload: 5 }),
        makeTorrent({ id: 3, status: TorrentStatus.stopped, error: 2 }),
      ],
    })
    await store.refresh()
    const c = store.countByStatus
    expect(c.all).toBe(3)
    expect(c.downloading).toBe(1)
    expect(c.seeding).toBe(1)
    expect(c.paused).toBe(1)
    expect(c.actively).toBe(1)
    expect(c.error).toBe(1)
  })

  it('builds tracker and label indexes', async () => {
    const store = useTorrentsStore()
    torrentGetMock.mockResolvedValueOnce({
      torrents: [
        makeTorrent({
          id: 1,
          labels: ['hd'],
          tracker_stats: [makeTrackerStat({ sitename: 'abc', host: 'tracker.abc.com' })],
        }),
        makeTorrent({
          id: 2,
          labels: ['hd', 'tv'],
          tracker_stats: [
            makeTrackerStat({ sitename: 'abc', host: 'tracker.abc.com' }),
            makeTrackerStat({ sitename: 'abc', host: 'tracker.abc.net' }),
          ],
        }),
      ],
    })
    await store.refresh()

    // Same-base domains stay distinct; a torrent counts once per display name.
    expect(store.trackerCounts).toEqual([
      { name: 'abc.com', count: 2 },
      { name: 'abc.net', count: 1 },
    ])
    expect(store.labelCounts).toEqual([
      { name: 'hd', count: 2 },
      { name: 'tv', count: 1 },
    ])
  })
})
