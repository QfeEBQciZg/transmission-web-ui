import { reactive } from 'vue'

/**
 * Peer IP → country code lookup for the Peers tab flags.
 * Uses ipwho.is (no token required, CORS enabled); results are cached
 * in memory for the page lifetime. Failures are silent ('-' = no flag).
 * Flag images are served by flagcdn.com: flagUrl(cc).
 */

const codes = reactive<Record<string, string>>({})
const pending = new Set<string>()

/** Kick off a lookup for ip (once per session). Reactive via `codes`. */
export function ensureCountryCode(ip: string): void {
  if (!ip || codes[ip] !== undefined || pending.has(ip)) return
  pending.add(ip)
  fetch(`https://ipwho.is/${encodeURIComponent(ip)}?fields=country_code,success`)
    .then((r) => r.json())
    .then((d: { success?: boolean; country_code?: string }) => {
      codes[ip] = d && d.success && d.country_code ? d.country_code.toLowerCase() : '-'
    })
    .catch(() => {
      codes[ip] = '-'
    })
    .finally(() => pending.delete(ip))
}

/** Current country code for ip ('' while loading, '-' on failure). */
export function countryCode(ip: string): string {
  return codes[ip] ?? ''
}

/** flagcdn image URL for a lowercase ISO country code. */
export function flagUrl(cc: string): string {
  return `https://flagcdn.com/w20/${cc}.png`
}

/** Test-only: clear the cache. */
export function __resetPeerCountryForTests(): void {
  for (const k of Object.keys(codes)) delete codes[k]
  pending.clear()
}
