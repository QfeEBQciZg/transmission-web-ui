/**
 * tracker_list string manipulation.
 * The RPC `tracker_list` field is plain text: one announce URL per line,
 * tiers separated by blank lines. All tracker add/edit/delete operations
 * rewrite this string locally and submit it whole via torrent_set
 * (the legacy tracker_add/remove/replace methods are deprecated).
 */

/** Parse tracker_list text into tiers of URLs. */
export function parseTrackerList(text: string): string[][] {
  const tiers: string[][] = []
  let tier: string[] = []
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (line === '') {
      if (tier.length > 0) {
        tiers.push(tier)
        tier = []
      }
    } else {
      tier.push(line)
    }
  }
  if (tier.length > 0) tiers.push(tier)
  return tiers
}

/** Serialize tiers back to tracker_list text (blank line between tiers). */
export function serializeTrackerList(tiers: string[][]): string {
  return tiers
    .filter((t) => t.length > 0)
    .map((t) => t.join('\n'))
    .join('\n\n')
}

/** Append URLs as a new trailing tier; duplicates are skipped. */
export function addTrackers(text: string, urls: string[]): string {
  const tiers = parseTrackerList(text)
  const known = new Set(tiers.flat())
  const fresh = [...new Set(urls.map((u) => u.trim()).filter((u) => u !== '' && !known.has(u)))]
  if (fresh.length > 0) tiers.push(fresh)
  return serializeTrackerList(tiers)
}

/** Remove the given URLs wherever they appear; empty tiers are dropped. */
export function removeTrackers(text: string, urls: string[]): string {
  const drop = new Set(urls)
  const tiers = parseTrackerList(text)
    .map((tier) => tier.filter((u) => !drop.has(u)))
    .filter((tier) => tier.length > 0)
  return serializeTrackerList(tiers)
}

/** Replace one URL with another (in place, keeping its tier/position). */
export function replaceTracker(text: string, oldUrl: string, newUrl: string): string {
  const tiers = parseTrackerList(text).map((tier) =>
    tier.map((u) => (u === oldUrl ? newUrl.trim() : u)),
  )
  return serializeTrackerList(tiers)
}
