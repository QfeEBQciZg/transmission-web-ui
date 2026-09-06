import { defineStore } from 'pinia'
import {
  MIN_RPC_VERSION_SEMVER,
  compareSemver,
  freeSpace,
  getHandshakeRpcVersion,
  sessionGet,
  sessionSet,
  sessionStats,
} from '../api/rpc'
import type { FreeSpace, SessionConfig, SessionStats } from '../api/types'

interface SessionState {
  session: SessionConfig | null
  stats: SessionStats | null
  freeSpace: FreeSpace | null
  /** RPC protocol semver from the 409 handshake header (6.0.0+ ⇒ Transmission 4.1+) */
  rpcVersionSemver: string
  connected: boolean
  /** Last connection/RPC error message, '' when healthy */
  lastError: string
  initialized: boolean
}

export const useSessionStore = defineStore('session', {
  state: (): SessionState => ({
    session: null,
    stats: null,
    freeSpace: null,
    rpcVersionSemver: '',
    connected: false,
    lastError: '',
    initialized: false,
  }),

  getters: {
    /** True when the daemon speaks JSON-RPC 2.0 (Transmission ≥ 4.1). */
    supported(): boolean {
      const v = this.session?.rpc_version_semver || this.rpcVersionSemver
      return v !== '' && compareSemver(v, MIN_RPC_VERSION_SEMVER) >= 0
    },
    daemonVersion(): string {
      return this.session?.version ?? ''
    },
    altSpeedEnabled(): boolean {
      return this.session?.alt_speed_enabled ?? false
    },
    downloadDir(): string {
      return this.session?.download_dir ?? ''
    },
  },

  actions: {
    /** First contact: session_get (drives the 409 handshake) + version check. */
    async init(): Promise<void> {
      try {
        this.session = await sessionGet()
        this.rpcVersionSemver = this.session.rpc_version_semver || getHandshakeRpcVersion()
        this.connected = true
        this.lastError = ''
        this.initialized = true
        await Promise.all([this.refreshStats(), this.refreshFreeSpace()])
        // eslint-disable-next-line no-console
        console.info(
          `[rpc] connected: Transmission ${this.session.version}, rpc ${this.rpcVersionSemver}`,
        )
      } catch (e) {
        this.connected = false
        this.lastError = e instanceof Error ? e.message : String(e)
        throw e
      }
    },

    async refreshSession(): Promise<void> {
      this.session = await sessionGet()
    },

    async refreshStats(): Promise<void> {
      this.stats = await sessionStats()
    },

    async refreshFreeSpace(path?: string): Promise<void> {
      const dir = path ?? this.session?.download_dir
      if (!dir) return
      try {
        this.freeSpace = await freeSpace(dir)
      } catch {
        this.freeSpace = null
      }
    },

    /** session_set with only the keys that actually changed. */
    async saveSession(next: Partial<SessionConfig>): Promise<void> {
      const diff: Record<string, unknown> = {}
      const current = (this.session ?? {}) as Record<string, unknown>
      for (const [key, value] of Object.entries(next)) {
        if (current[key] !== value) diff[key] = value
      }
      if (Object.keys(diff).length === 0) return
      await sessionSet(diff)
      await this.refreshSession()
    },

    async toggleAltSpeed(): Promise<void> {
      await sessionSet({ alt_speed_enabled: !this.altSpeedEnabled })
      await this.refreshSession()
    },
  },
})
