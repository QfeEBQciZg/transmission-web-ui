/**
 * Display formatting helpers (bytes, speed, duration, timestamps, status).
 * Format conventions: binary 1024-based units (KiB/MiB/GiB labeled as KB/MB/GB).
 */

import { TorrentStatus, type TorrentStatusCode } from '../api/types'

export const SIZE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'] as const

/** Format a byte count with 1024-based units. */
export function formatBytes(bytes: number, digits = 2): string {
  if (!Number.isFinite(bytes)) return ''
  if (bytes < 0) bytes = 0
  if (bytes < 1024) return `${bytes} ${SIZE_UNITS[0]}`
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < SIZE_UNITS.length - 1) {
    value /= 1024
    unit++
  }
  const fixed = value >= 100 || unit <= 1 ? value.toFixed(1) : value.toFixed(digits)
  return `${parseFloat(fixed)} ${SIZE_UNITS[unit]}`
}

/** Format a speed in bytes/sec. */
export function formatSpeed(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec, 1)}/s`
}

/** ETA sentinel: RPC returns -1 when unknown. */
export const ETA_UNKNOWN = -1

/**
 * Format a duration in seconds as a compact string, e.g. "2d 3h", "4h 12m".
 * -1 (or any negative) → "∞"; durations > ~100 years → "∞".
 */
export function formatDuration(seconds: number): string {
  if (seconds < 0 || seconds > 3.15e9) return '∞'
  seconds = Math.floor(seconds)
  if (seconds === 0) return '0s'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

/** Format a unix timestamp (seconds) as a local date-time string; 0 → '-'. */
export function formatTimestamp(unixSec: number): string {
  if (!unixSec || unixSec <= 0) return '-'
  const d = new Date(unixSec * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** Format an upload ratio; -1 (no activity) → "∞". */
export function formatRatio(ratio: number): string {
  if (ratio < 0) return '∞'
  return ratio.toFixed(2)
}

/** Human-readable key for a torrent status code (i18n lookup key, not text). */
export function statusKey(status: TorrentStatusCode | number): string {
  switch (status) {
    case TorrentStatus.stopped:
      return 'stopped'
    case TorrentStatus.check_wait:
      return 'check_wait'
    case TorrentStatus.check:
      return 'check'
    case TorrentStatus.download_wait:
      return 'download_wait'
    case TorrentStatus.download:
      return 'download'
    case TorrentStatus.seed_wait:
      return 'seed_wait'
    case TorrentStatus.seed:
      return 'seed'
    default:
      return 'unknown'
  }
}

/** Minutes-of-day ("alt_speed_time_begin/end") → "HH:mm". */
export function formatMinutesOfDay(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Deterministic color for a label name (hash → palette index).
 * Pure UI: native RPC labels carry no color.
 */
const LABEL_PALETTE = [
  '#409eff',
  '#67c23a',
  '#e6a23c',
  '#f56c6c',
  '#9b59b6',
  '#16a085',
  '#d35400',
  '#2c3e50',
  '#7f8c8d',
  '#c0392b',
] as const

export function labelColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  }
  return LABEL_PALETTE[hash % LABEL_PALETTE.length]
}
