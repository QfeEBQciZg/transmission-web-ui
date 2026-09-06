/**
 * Transmission 4.1+ JSON-RPC 2.0 client.
 *
 * - POSTs {"jsonrpc":"2.0","method","params","id"} to the RPC endpoint.
 * - CSRF handshake: the first request (or any request after the daemon
 *   expires the token) returns HTTP 409 with the correct
 *   X-Transmission-Session-Id header; we capture it and replay once.
 * - The 409 response also carries X-Transmission-Rpc-Version (semver of the
 *   RPC protocol, ≥ 6.0.0 means Transmission ≥ 4.1 with JSON-RPC support).
 * - JSON-RPC error objects are thrown as RpcError.
 * - HTTP Basic auth is left to the browser (same as the stock web UI).
 */

import type {
  FreeSpace,
  JsonRpcRequest,
  JsonRpcResponse,
  PortTestResult,
  SessionConfig,
  SessionStats,
  Torrent,
  TorrentAddedResponse,
  TorrentGetResponse,
} from './types'

export class RpcError extends Error {
  code?: number
  data?: unknown
  constructor(message: string, code?: number, data?: unknown) {
    super(message)
    this.name = 'RpcError'
    this.code = code
    this.data = data
  }
}

/** Minimum supported RPC protocol semver (Transmission 4.1.0) */
export const MIN_RPC_VERSION_SEMVER = '6.0.0'

/** Dev: same-origin '/transmission/rpc' is proxied by Vite to the daemon.
 *  Prod: resolve '../rpc' relative to the page URL, exactly like the stock
 *  web UI served from Transmission's web dir (…/transmission/web/ → …/transmission/rpc). */
export const RPC_URL: string = import.meta.env.DEV
  ? '/transmission/rpc'
  : new URL('../rpc', window.location.href).pathname

let sessionId = ''
/** RPC protocol semver captured from the 409 handshake header ('' if unknown). */
let handshakeRpcVersion = ''
let nextId = 1

/** Reset handshake state (used by tests and when the daemon restarts). */
export function resetHandshake(): void {
  sessionId = ''
  handshakeRpcVersion = ''
}

export function getHandshakeRpcVersion(): string {
  return handshakeRpcVersion
}

/** Compare two semver strings: returns negative/0/positive like a comparator. */
export function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0)
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i]
  }
  return 0
}

async function postOnce<T>(method: string, params?: Record<string, unknown>): Promise<T> {
  const body: JsonRpcRequest = { jsonrpc: '2.0', method, params, id: nextId++ }
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (sessionId) headers['X-Transmission-Session-Id'] = sessionId

  const resp = await fetch(RPC_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (resp.status === 409) {
    const newId = resp.headers.get('X-Transmission-Session-Id')
    if (!newId) throw new RpcError('Handshake failed: no X-Transmission-Session-Id in 409')
    sessionId = newId
    handshakeRpcVersion = resp.headers.get('X-Transmission-Rpc-Version') ?? ''
    // Replay the same request once with the fresh session id.
    return postOnce<T>(method, params)
  }

  if (!resp.ok) {
    throw new RpcError(`HTTP ${resp.status} ${resp.statusText}`)
  }

  const json = (await resp.json()) as JsonRpcResponse<T>
  if (json.error) {
    const detail = json.error.data?.error_string
    throw new RpcError(
      detail ? `${json.error.message} (${detail})` : json.error.message,
      json.error.code,
      json.error.data,
    )
  }
  if (json.result === undefined) {
    throw new RpcError('Malformed RPC response: neither result nor error present')
  }
  return json.result
}

/**
 * One logical RPC call. postOnce replays the request at most once after a
 * 409 handshake, so an infinite 409 ping-pong is impossible.
 */
export async function rpcCall<T = unknown>(
  method: string,
  params?: Record<string, unknown>,
): Promise<T> {
  // postOnce already replays after a 409; a second failure is final.
  return postOnce<T>(method, params)
}

// ---------------------------------------------------------------------------
// Typed method wrappers
// ---------------------------------------------------------------------------

/** Fields fetched for the main torrent list (full and incremental polls). */
export const TORRENT_LIST_FIELDS = [
  'id',
  'name',
  'status',
  'hash_string',
  'total_size',
  'percent_done',
  'added_date',
  'tracker_stats',
  'tracker_list',
  'left_until_done',
  'rate_download',
  'rate_upload',
  'recheck_progress',
  'peers_getting_from_us',
  'peers_sending_to_us',
  'upload_ratio',
  'uploaded_ever',
  'downloaded_ever',
  'download_dir',
  'error',
  'error_string',
  'done_date',
  'queue_position',
  'activity_date',
  'eta',
  'labels',
] as const

/** Extra fields fetched on demand for the detail panel. */
export const TORRENT_DETAIL_FIELDS = [
  'file_stats',
  'files',
  'peers',
  'piece_count',
  'piece_size',
  'pieces',
  'comment',
  'creator',
  'date_created',
  'is_private',
  'metadata_percent_complete',
  'download_limit',
  'download_limited',
  'upload_limit',
  'upload_limited',
  'seed_ratio_limit',
  'seed_ratio_mode',
  'seed_idle_limit',
  'seed_idle_mode',
  'peer_limit',
  'honors_session_limits',
  'bandwidth_priority',
] as const

export function torrentGet(
  fields: readonly string[],
  ids?: number[] | 'recently_active',
): Promise<TorrentGetResponse> {
  return rpcCall('torrent_get', { fields: [...fields], ...(ids ? { ids } : {}) })
}

export function torrentSet(
  ids: number[],
  params: Record<string, unknown>,
): Promise<Record<string, never>> {
  return rpcCall('torrent_set', { ids, ...params })
}

export type TorrentActionMethod =
  | 'torrent_start'
  | 'torrent_start_now'
  | 'torrent_stop'
  | 'torrent_verify'
  | 'torrent_reannounce'
  | 'queue_move_top'
  | 'queue_move_up'
  | 'queue_move_down'
  | 'queue_move_bottom'

/** Action methods take {ids}; omitting ids applies to all torrents. */
export function torrentAction(
  method: TorrentActionMethod,
  ids?: number[],
): Promise<Record<string, never>> {
  return rpcCall(method, ids && ids.length > 0 ? { ids } : {})
}

export function torrentAddByUrl(
  url: string,
  options: { download_dir?: string; paused?: boolean; labels?: string[] } = {},
): Promise<TorrentAddedResponse> {
  return rpcCall('torrent_add', { filename: url, ...options })
}

export function torrentAddByMetainfo(
  metainfoBase64: string,
  options: { download_dir?: string; paused?: boolean; labels?: string[] } = {},
): Promise<TorrentAddedResponse> {
  return rpcCall('torrent_add', { metainfo: metainfoBase64, ...options })
}

export function torrentRemove(
  ids: number[],
  deleteLocalData: boolean,
): Promise<Record<string, never>> {
  return rpcCall('torrent_remove', { ids, delete_local_data: deleteLocalData })
}

export function torrentSetLocation(
  ids: number[],
  location: string,
  move: boolean,
): Promise<Record<string, never>> {
  return rpcCall('torrent_set_location', { ids, location, move })
}

export function torrentRenamePath(
  id: number,
  path: string,
  name: string,
): Promise<{ id: number; path: string; name: string }> {
  return rpcCall('torrent_rename_path', { ids: [id], path, name })
}

export function getMagnetLink(id: number): Promise<TorrentGetResponse> {
  return rpcCall('torrent_get', { ids: [id], fields: ['id', 'magnet_link'] })
}

export function sessionGet(fields?: string[]): Promise<SessionConfig> {
  return rpcCall('session_get', fields ? { fields } : {})
}

export function sessionSet(params: Record<string, unknown>): Promise<Record<string, never>> {
  return rpcCall('session_set', params)
}

export function sessionStats(): Promise<SessionStats> {
  return rpcCall('session_stats')
}

export function freeSpace(path: string): Promise<FreeSpace> {
  return rpcCall('free_space', { path })
}

export function portTest(ipProtocol?: 'ipv4' | 'ipv6'): Promise<PortTestResult> {
  return rpcCall('port_test', ipProtocol ? { ip_protocol: ipProtocol } : {})
}

export function blocklistUpdate(): Promise<{ blocklist_size: number }> {
  return rpcCall('blocklist_update')
}

/** Perform the initial handshake and return the RPC protocol semver seen. */
export async function handshake(): Promise<string> {
  await sessionGet(['version', 'rpc_version_semver'])
  return handshakeRpcVersion
}

export type { Torrent }
