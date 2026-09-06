/**
 * Transmission 4.1+ JSON-RPC 2.0 type definitions.
 * Field names mirror the RPC spec (snake_case) one-to-one — no mapping layer.
 * Reference: https://github.com/transmission/transmission/blob/main/docs/rpc-spec.md
 */

/** JSON-RPC 2.0 request envelope */
export interface JsonRpcRequest<P = Record<string, unknown>> {
  jsonrpc: '2.0'
  method: string
  params?: P
  id: number
}

/** JSON-RPC 2.0 response envelope */
export interface JsonRpcResponse<R = unknown> {
  jsonrpc: '2.0'
  result?: R
  error?: {
    code: number
    message: string
    data?: {
      error_string?: string
      result?: Record<string, unknown>
    }
  }
  id: number | null
}

/** Torrent status codes (tr_stat.status) */
export const TorrentStatus = {
  stopped: 0,
  check_wait: 1,
  check: 2,
  download_wait: 3,
  download: 4,
  seed_wait: 5,
  seed: 6,
} as const
export type TorrentStatusCode = (typeof TorrentStatus)[keyof typeof TorrentStatus]

/** Client-side virtual status: any torrent with non-zero transfer rate */
export const STATUS_ACTIVELY = 101

export interface TrackerStat {
  announce: string
  announce_state: number
  download_count: number
  downloader_count: number
  has_announced: boolean
  has_scraped: boolean
  host: string
  id: number
  is_backup: boolean
  last_announce_peer_count: number
  last_announce_result: string
  last_announce_start_time: number
  last_announce_succeeded: boolean
  last_announce_time: number
  last_announce_timed_out: boolean
  last_scrape_result: string
  last_scrape_start_time: number
  last_scrape_succeeded: boolean
  last_scrape_time: number
  last_scrape_timed_out: boolean
  leecher_count: number
  next_announce_time: number
  next_scrape_time: number
  scrape: string
  scrape_state: number
  seeder_count: number
  sitename: string
  tier: number
}

/** announce_state values */
export const AnnounceState = {
  inactive: 0,
  waiting: 1,
  queued: 2,
  active: 3,
} as const

export interface PeerStat {
  address: string
  bytes_to_client: number
  bytes_to_peer: number
  client_is_choked: boolean
  client_is_interested: boolean
  client_name: string
  flag_str: string
  is_downloading_from: boolean
  is_encrypted: boolean
  is_incoming: boolean
  is_uploading_to: boolean
  is_utp: boolean
  peer_id: string
  peer_is_choked: boolean
  peer_is_interested: boolean
  port: number
  progress: number
  rate_to_client: number
  rate_to_peer: number
}

export interface TorrentFile {
  bytes_completed: number
  length: number
  name: string
  begin_piece: number
  end_piece: number
}

export interface TorrentFileStat {
  bytes_completed: number
  wanted: boolean
  priority: number
}

/** Torrent object as returned by torrent_get (subset we request) */
export interface Torrent {
  id: number
  name: string
  status: TorrentStatusCode
  hash_string: string
  total_size: number
  percent_done: number
  added_date: number
  tracker_stats?: TrackerStat[]
  tracker_list?: string
  left_until_done: number
  rate_download: number
  rate_upload: number
  recheck_progress: number
  peers_getting_from_us: number
  peers_sending_to_us: number
  upload_ratio: number
  uploaded_ever: number
  downloaded_ever: number
  download_dir: string
  error: number
  error_string: string
  done_date: number
  queue_position: number
  activity_date: number
  eta: number
  labels: string[]
  // on-demand (detail panel / dialogs)
  magnet_link?: string
  metadata_percent_complete?: number
  comment?: string
  creator?: string
  date_created?: number
  is_private?: boolean
  piece_count?: number
  piece_size?: number
  pieces?: string
  files?: TorrentFile[]
  file_stats?: TorrentFileStat[]
  peers?: PeerStat[]
  download_limit?: number
  download_limited?: boolean
  upload_limit?: number
  upload_limited?: boolean
  seed_ratio_limit?: number
  seed_ratio_mode?: number
  seed_idle_limit?: number
  seed_idle_mode?: number
  peer_limit?: number
  honors_session_limits?: boolean
  bandwidth_priority?: number
}

export interface TorrentGetResponse {
  torrents: Torrent[]
  removed?: number[]
}

export interface TorrentAddedResponse {
  torrent_added?: { id: number; name: string; hash_string: string }
  torrent_duplicate?: { id: number; name: string; hash_string: string }
}

/** Session configuration (subset; session_get without fields returns everything) */
export interface SessionConfig {
  version: string
  rpc_version_semver: string
  session_id?: string
  config_dir: string
  download_dir: string
  incomplete_dir: string
  incomplete_dir_enabled: boolean
  rename_partial_files: boolean
  start_added_torrents: boolean
  cache_size_mib: number
  script_torrent_done_enabled: boolean
  script_torrent_done_filename: string
  alt_speed_enabled: boolean
  alt_speed_down: number
  alt_speed_up: number
  alt_speed_time_enabled: boolean
  alt_speed_time_begin: number
  alt_speed_time_end: number
  alt_speed_time_day: number
  speed_limit_down: number
  speed_limit_down_enabled: boolean
  speed_limit_up: number
  speed_limit_up_enabled: boolean
  peer_limit_global: number
  peer_limit_per_torrent: number
  peer_port: number
  peer_port_random_on_start: boolean
  port_forwarding_enabled: boolean
  encryption: string
  utp_enabled: boolean
  dht_enabled: boolean
  lpd_enabled: boolean
  pex_enabled: boolean
  blocklist_enabled: boolean
  blocklist_url: string
  blocklist_size: number
  download_queue_enabled: boolean
  download_queue_size: number
  seed_queue_enabled: boolean
  seed_queue_size: number
  queue_stalled_enabled: boolean
  queue_stalled_minutes: number
  seed_ratio_limit: number
  seed_ratio_limited: boolean
  idle_seeding_limit: number
  idle_seeding_limit_enabled: boolean
  default_trackers?: string
  units?: {
    speed_units: string[]
    speed_bytes: number
    size_units: string[]
    size_bytes: number
    memory_units: string[]
    memory_bytes: number
  }
  [key: string]: unknown
}

export interface StatsBlock {
  uploaded_bytes: number
  downloaded_bytes: number
  files_added: number
  seconds_active: number
  session_count: number
}

export interface SessionStats {
  active_torrent_count: number
  download_speed: number
  paused_torrent_count: number
  torrent_count: number
  upload_speed: number
  cumulative_stats: StatsBlock
  current_stats: StatsBlock
}

export interface FreeSpace {
  path: string
  size_bytes: number
  total_size: number
}

export interface PortTestResult {
  port_is_open: boolean
  ip_protocol?: string
}
