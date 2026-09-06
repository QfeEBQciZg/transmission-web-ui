import { TorrentStatus, type SessionStats, type Torrent, type TrackerStat } from '../api/types'

/** Shared test fixtures for the store tests. */

export function makeTrackerStat(partial: Partial<TrackerStat> = {}): TrackerStat {
  return {
    announce: 'https://tracker.example.com/announce',
    announce_state: 3,
    download_count: 0,
    downloader_count: 0,
    has_announced: true,
    has_scraped: true,
    host: 'tracker.example.com',
    id: 0,
    is_backup: false,
    last_announce_peer_count: 10,
    last_announce_result: 'Success',
    last_announce_start_time: 1700000000,
    last_announce_succeeded: true,
    last_announce_time: 1700000000,
    last_announce_timed_out: false,
    last_scrape_result: 'Success',
    last_scrape_start_time: 1700000000,
    last_scrape_succeeded: true,
    last_scrape_time: 1700000000,
    last_scrape_timed_out: false,
    leecher_count: 5,
    next_announce_time: 1700003600,
    next_scrape_time: 1700003600,
    scrape: 'https://tracker.example.com/scrape',
    scrape_state: 1,
    seeder_count: 20,
    sitename: 'example',
    tier: 0,
    ...partial,
  }
}

export function makeTorrent(partial: Partial<Torrent> = {}): Torrent {
  return {
    id: 1,
    name: 'ubuntu.iso',
    status: TorrentStatus.download,
    hash_string: 'abc123',
    total_size: 1000,
    percent_done: 0.5,
    added_date: 1700000000,
    tracker_stats: [],
    left_until_done: 500,
    rate_download: 0,
    rate_upload: 0,
    recheck_progress: 0,
    peers_getting_from_us: 0,
    peers_sending_to_us: 0,
    upload_ratio: 1,
    uploaded_ever: 0,
    downloaded_ever: 0,
    download_dir: '/downloads',
    error: 0,
    error_string: '',
    done_date: 0,
    queue_position: 1,
    activity_date: 1700000000,
    eta: -1,
    labels: [],
    ...partial,
  }
}

export function makeStats(torrentCount: number): SessionStats {
  const block = {
    uploaded_bytes: 0,
    downloaded_bytes: 0,
    files_added: 0,
    seconds_active: 0,
    session_count: 1,
  }
  return {
    active_torrent_count: 0,
    download_speed: 0,
    paused_torrent_count: 0,
    torrent_count: torrentCount,
    upload_speed: 0,
    cumulative_stats: { ...block },
    current_stats: { ...block },
  }
}
