import { describe, expect, it } from 'vitest'
import { STATUS_ACTIVELY, TorrentStatus } from '../api/types'
import {
  ETA_UNKNOWN,
  formatBytes,
  formatDuration,
  formatMinutesOfDay,
  formatRatio,
  formatSpeed,
  formatTimestamp,
  labelColor,
  statusKey,
} from '../utils/format'

describe('formatBytes', () => {
  it('formats sub-KB values as raw bytes', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
  })

  it('uses 1024-based units', () => {
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(1048576)).toBe('1 MB')
    expect(formatBytes(5 * 1024 ** 3)).toBe('5 GB')
    expect(formatBytes(123456789)).toBe('117.7 MB')
  })

  it('clamps negatives and survives non-finite input', () => {
    expect(formatBytes(-5)).toBe('0 B')
    expect(formatBytes(Number.NaN)).toBe('')
  })
})

describe('formatSpeed', () => {
  it('appends /s to the byte format', () => {
    expect(formatSpeed(0)).toBe('0 B/s')
    expect(formatSpeed(1024)).toBe('1 KB/s')
  })
})

describe('formatDuration', () => {
  it('renders ETA_UNKNOWN and absurd values as ∞', () => {
    expect(formatDuration(ETA_UNKNOWN)).toBe('∞')
    expect(formatDuration(-5)).toBe('∞')
    expect(formatDuration(4e9)).toBe('∞')
  })

  it('picks the two largest non-zero units', () => {
    expect(formatDuration(0)).toBe('0s')
    expect(formatDuration(59)).toBe('59s')
    expect(formatDuration(61)).toBe('1m 1s')
    expect(formatDuration(3600)).toBe('1h 0m')
    expect(formatDuration(90000)).toBe('1d 1h')
  })
})

describe('formatTimestamp', () => {
  it('renders 0 as a placeholder and real times as local date-time', () => {
    expect(formatTimestamp(0)).toBe('-')
    expect(formatTimestamp(1700000000)).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  })
})

describe('formatRatio', () => {
  it('renders -1 as ∞ and otherwise two decimals', () => {
    expect(formatRatio(-1)).toBe('∞')
    expect(formatRatio(1.234)).toBe('1.23')
  })
})

describe('statusKey', () => {
  it('maps every RPC status code to its i18n key', () => {
    expect(statusKey(TorrentStatus.stopped)).toBe('stopped')
    expect(statusKey(TorrentStatus.check_wait)).toBe('check_wait')
    expect(statusKey(TorrentStatus.check)).toBe('check')
    expect(statusKey(TorrentStatus.download_wait)).toBe('download_wait')
    expect(statusKey(TorrentStatus.download)).toBe('download')
    expect(statusKey(TorrentStatus.seed_wait)).toBe('seed_wait')
    expect(statusKey(TorrentStatus.seed)).toBe('seed')
  })

  it('maps unknown and virtual codes to "unknown"', () => {
    expect(statusKey(STATUS_ACTIVELY)).toBe('unknown')
    expect(statusKey(999)).toBe('unknown')
  })
})

describe('formatMinutesOfDay', () => {
  it('formats minutes-of-day as HH:mm', () => {
    expect(formatMinutesOfDay(0)).toBe('00:00')
    expect(formatMinutesOfDay(75)).toBe('01:15')
    expect(formatMinutesOfDay(1439)).toBe('23:59')
  })
})

describe('labelColor', () => {
  it('is deterministic and returns a hex color', () => {
    expect(labelColor('movies')).toBe(labelColor('movies'))
    expect(labelColor('movies')).toMatch(/^#[0-9a-f]{6}$/)
  })
})
