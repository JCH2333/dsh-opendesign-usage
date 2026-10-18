/**
 * The cached, never-throwing usage service (host half).
 *
 * view() serves a TTL cache, refresh() forces a fetch, and both share one
 * in-flight promise so several pollers cost one upstream request. A failure is
 * pinned for ERROR_COOLDOWN_MS so a dead cookie cannot hammer the console, and
 * every outcome - success or error - is returned as a plain object. Nothing in
 * here rejects to its caller.
 */
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { dshHome, loadConfig } from './config.js'
import { UsageError, fetchBalance, fetchUsage } from './api.js'

/** How long a failed fetch keeps view() on the error path before it retries. */
export const ERROR_COOLDOWN_MS = 60 * 1000

/** The cordis service name this instance registers under. */
export const SERVICE_NAME = 'opendesignUsage'

/**
 * Bare base used when no cordis copy can be reached (standalone import, tests)
 * or when the resolved copy refuses the context it was handed.
 */
class StandaloneServiceBase {
  constructor(ctx, name) {
    this.ctx = ctx
    this.name = name
  }
}

/**
 * Cordis copies reachable from this machine. A linked plugin lives outside the
 * profile, so the bare specifier cannot resolve from its realpath; the profile
 * stores are walked explicitly instead.
 */
function cordisCandidates() {
  const found = []
  try {
    const root = join(dshHome(), 'profiles')
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const candidate = join(root, entry.name, 'node_modules', '@deepseek-ai', 'cordis', 'lib', 'index.js')
      if (existsSync(candidate)) found.push(candidate)
    }
  } catch {
    // No profiles directory: the caller falls back to the standalone base.
  }
  return found
}

/** Resolve the cordis Service base class, degrading to the plain base offline. */
async function resolveServiceBase() {
  try {
    const mod = await import('@deepseek-ai/cordis')
    if (typeof mod.Service === 'function') return mod.Service
  } catch {
    // Bare specifier unresolved: try the profile stores below.
  }
  for (const candidate of cordisCandidates()) {
    try {
      const mod = await import(pathToFileURL(candidate).href)
      if (typeof mod.Service === 'function') return mod.Service
    } catch {
      // Unusable copy: keep looking.
    }
  }
  return StandaloneServiceBase
}

const ResolvedServiceBase = await resolveServiceBase()

/** One line of error text, safe for the browser (no cookie ever reaches here). */
function describe(error) {
  const text = typeof error?.message === 'string' && error.message !== '' ? error.message : String(error)
  return text.split('\n')[0].slice(0, 200)
}

/**
 * Every behaviour the service exposes, defined once and installed on both the
 * cordis-backed class and the standalone fallback so the two cannot drift.
 */
const UsageServiceMethods = {
  /** Effective config, re-read on every fetch so a config write lands at once. */
  effectiveConfig() {
    return loadConfig()
  },

  /**
   * The snapshot for the browser: cache first, cooldown second, fetch last.
   * @returns {Promise<object>} a UsageView; never rejects.
   */
  async view() {
    const now = Date.now()
    if (this.cache !== null && this.cache.expiresAt > now) return this.cache.view
    if (this.errorCache !== null && this.errorCache.until > now) return this.errorCache.view
    return this.refresh()
  },

  /**
   * Force a fetch, sharing one in-flight request with every concurrent caller.
   * @returns {Promise<object>} a UsageView; never rejects.
   */
  refresh() {
    if (this.inflight !== null) return this.inflight
    this.inflight = this.load().finally(() => {
      this.inflight = null
    })
    return this.inflight
  },

  /** Drop both caches so the next view() fetches (used after a config write). */
  invalidateCache() {
    this.cache = null
    this.errorCache = null
  },

  /** Fetch, normalise, and record either the snapshot or the error view. */
  async load() {
    const cfg = loadConfig()
    try {
      const snapshot = await fetchUsage(cfg)
      const balanceUsd = await fetchBalance(cfg)
      const view = {
        updatedAt: snapshot.updatedAt,
        windows: snapshot.windows,
        balanceUsd,
      }
      this.cache = { view, expiresAt: Date.now() + Math.max(0, cfg.cacheTTL) * 1000 }
      this.errorCache = null
      return view
    } catch (error) {
      const code = error instanceof UsageError ? error.code : 'fetch'
      const view = { error: code, message: describe(error) }
      this.cache = null
      this.errorCache = { view, until: Date.now() + ERROR_COOLDOWN_MS }
      try {
        this.ctx?.logger?.warn?.('[opendesign-usage] fetch failed: ' + code + ' ' + describe(error))
      } catch {
        // A logger failure must not turn a soft error into a thrown one.
      }
      return view
    }
  },
}

/** Per-instance state, shared by both classes. */
function initState(instance) {
  instance.cache = null
  instance.errorCache = null
  instance.inflight = null
}

/** The cordis-backed service class: what the host normally mounts. */
export class UsageService extends ResolvedServiceBase {
  constructor(ctx, config = {}) {
    super(ctx, SERVICE_NAME)
    void config
    initState(this)
  }
}
Object.assign(UsageService.prototype, UsageServiceMethods)

/** The dependency-free fallback: same behaviour, no cordis registration. */
export class FallbackUsageService extends StandaloneServiceBase {
  constructor(ctx, config = {}) {
    super(ctx, SERVICE_NAME)
    void config
    initState(this)
  }
}
Object.assign(FallbackUsageService.prototype, UsageServiceMethods)

/**
 * Build the service, degrading to the standalone class when the resolved
 * cordis copy refuses this context (a bare context without reflect.provide).
 * @param {object} ctx - the owning cordis context.
 * @param {object} [config] - the plugin row config.
 * @returns {UsageService|FallbackUsageService}
 */
export function createUsageService(ctx, config = {}) {
  try {
    return new UsageService(ctx, config)
  } catch (error) {
    try {
      ctx?.logger?.warn?.('[opendesign-usage] cordis Service unavailable (' + describe(error) + '); using the standalone service')
    } catch {
      // Logging is best effort.
    }
    return new FallbackUsageService(ctx, config)
  }
}

export default UsageService
