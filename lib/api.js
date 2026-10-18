/**
 * OpenDesign console API client (host half).
 *
 * Only two endpoints matter: the coding-plan usage windows (the pill's data)
 * and the wallet balance (optional garnish). Every failure is normalised into
 * a UsageError carrying a short machine code the browser renders as an
 * error tag.
 */
import { DEFAULT_TIMEOUT_MS, DEFAULT_WORKSPACE_ID } from './config.js'

/** Upstream console API origin. */
export const API_BASE = 'https://amr-api.open-design.ai'

/** A browser-shaped identity: the Cloudflare front in front of the API dislikes a bare node UA. */
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

/** Usage endpoint path for one workspace. */
export function usagePath(workspaceID) {
  return '/api/v1/workspaces/' + encodeURIComponent(workspaceID) + '/billing/coding-plan-usage'
}

/** Wallet balance endpoint path for one workspace. */
export function balancePath(workspaceID) {
  return '/api/v1/workspaces/' + encodeURIComponent(workspaceID) + '/wallet/balance'
}

/** An API failure carrying the code the browser renders. */
export class UsageError extends Error {
  /**
   * @param {string} code - short machine code: noconfig | unauthorized | http<status> | timeout | fetch.
   * @param {string} [message] - human-readable detail; never contains the cookie.
   */
  constructor(code, message) {
    super(typeof message === 'string' && message !== '' ? message : String(code))
    this.name = 'UsageError'
    this.code = String(code)
  }
}

/** Coerce a JSON number-or-numeric-string into a finite number, else NaN. */
function toFinite(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : NaN
  }
  return NaN
}

/** Clamp a percentage into 0-100 integers. */
function clampPercent(value) {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, Math.round(value)))
}

/**
 * The official front-end percentage: the REMAINING share of a window.
 * Returns 0 for unusable input, exactly as the upstream bundle does.
 */
export function percentOf(remaining, limit) {
  if (!Number.isFinite(remaining) || !Number.isFinite(limit) || limit <= 0) return 0
  return Math.min(100, Math.max(0, (remaining / limit) * 100))
}

/**
 * Map one upstream window duration onto the SPEC kind/label pair.
 * 18000s is the 5-hour rolling window, 604800s the 7-day weekly one; anything
 * else is "other" with a label derived from the hour count.
 * @returns {{kind: 'rolling'|'weekly'|'other', label: string}}
 */
export function classifyWindow(durationSeconds) {
  if (durationSeconds === 18000) return { kind: 'rolling', label: '5h' }
  if (durationSeconds === 604800) return { kind: 'weekly', label: '7d' }
  const usable = Number.isFinite(durationSeconds) && durationSeconds > 0
  const hours = usable ? Math.round(durationSeconds / 3600) : 0
  if (hours <= 0) {
    const seconds = usable ? Math.round(durationSeconds) : 0
    return { kind: 'other', label: seconds > 0 ? seconds + 's' : 'other' }
  }
  if (hours % 24 === 0) return { kind: 'other', label: hours / 24 + 'd' }
  return { kind: 'other', label: hours + 'h' }
}

/**
 * Normalise one upstream window into the WindowView contract.
 * @param {unknown} raw - an entry of the upstream windows array.
 * @param {number} [now] - reference instant for the reset countdown.
 * @returns {object} a WindowView.
 */
export function normalizeWindow(raw, now = Date.now()) {
  const source = typeof raw === 'object' && raw !== null ? raw : {}
  const durationSeconds = toFinite(source.durationSeconds)
  const remainingCredits = toFinite(source.remainingCredits)
  const limitCredits = toFinite(source.limitCredits)
  const resetsAtRaw = typeof source.resetsAt === 'string' ? source.resetsAt.trim() : ''
  const resetsAtMs = resetsAtRaw === '' ? NaN : Date.parse(resetsAtRaw)

  const remainingPercent = clampPercent(Math.round(percentOf(remainingCredits, limitCredits)))
  const classified = classifyWindow(durationSeconds)

  const view = {
    kind: classified.kind,
    label: classified.label,
    durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : 0,
    remainingPercent,
    usedPercent: 100 - remainingPercent,
    resetInSec: Number.isFinite(resetsAtMs) ? Math.max(0, Math.round((resetsAtMs - now) / 1000)) : 0,
    status: Number.isFinite(remainingCredits) && remainingCredits <= 0 ? 'exhausted' : 'ok',
  }
  if (Number.isFinite(resetsAtMs)) view.resetsAt = new Date(resetsAtMs).toISOString()
  return view
}

/** Display rank: the two pill windows first, then anything else. */
const KIND_RANK = { rolling: 0, weekly: 1, other: 2 }

/**
 * Normalise the upstream window array into ordered WindowViews.
 * @param {unknown} list - the upstream windows array.
 * @param {number} [now] - reference instant for the reset countdowns.
 */
export function normalizeWindows(list, now = Date.now()) {
  if (!Array.isArray(list)) return []
  return list
    .map((entry) => normalizeWindow(entry, now))
    .sort((left, right) => (KIND_RANK[left.kind] ?? 9) - (KIND_RANK[right.kind] ?? 9))
}

/** Envelope keys walked when hunting for the window array. */
const WINDOW_ENVELOPE_KEYS = ['data', 'result', 'usage', 'codingPlan', 'coding_plan', 'plan', 'payload']

/**
 * Locate the window array in an upstream payload. The SPEC pins a top-level
 * windows field; a data.windows (or result.windows) envelope is tolerated in
 * case the console starts wrapping its responses. Breadth-first, depth-limited
 * by the envelope key list, cycle-safe.
 */
export function pickWindowList(payload) {
  if (Array.isArray(payload)) return payload
  const queue = [payload]
  const seen = new Set()
  while (queue.length > 0) {
    const node = queue.shift()
    if (typeof node !== 'object' || node === null || Array.isArray(node) || seen.has(node)) continue
    seen.add(node)
    if (Array.isArray(node.windows)) return node.windows
    for (const key of WINDOW_ENVELOPE_KEYS) {
      const child = node[key]
      if (Array.isArray(child)) return child
      if (typeof child === 'object' && child !== null) queue.push(child)
    }
  }
  return []
}

/** True when an error came from an aborted (timed-out) fetch. */
function isAbortError(error) {
  return error?.name === 'AbortError' || error?.code === 'ABORT_ERR' || error?.cause?.name === 'AbortError'
}

/** One short line of error text, safe to hand to the browser. */
function describeError(error) {
  const text = typeof error?.message === 'string' && error.message !== '' ? error.message : String(error)
  return text.split('\n')[0].slice(0, 200)
}

/** Discard a response body we will not read (keeps the socket reusable). */
async function discardBody(response) {
  try {
    await response.body?.cancel?.()
  } catch {
    // Nothing to do: the status code already decided the outcome.
  }
}

/**
 * GET one console API URL as JSON, mapping every failure onto a UsageError.
 * The cookie only ever travels in the request header, never in a message.
 * @returns {Promise<unknown>} the parsed JSON body.
 */
async function requestJson(url, cfg) {
  const timeoutMs = Number.isFinite(cfg.timeoutMs) && cfg.timeoutMs > 0 ? cfg.timeoutMs : DEFAULT_TIMEOUT_MS
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  if (typeof timer.unref === 'function') timer.unref()

  let response
  try {
    response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        Cookie: cfg.cookie,
        'x-vela-workspace-id': cfg.workspaceID,
        Accept: 'application/json',
        Origin: 'https://open-design.ai',
        Referer: 'https://open-design.ai/',
        'User-Agent': USER_AGENT,
      },
    })
  } catch (error) {
    if (isAbortError(error) || controller.signal.aborted) {
      throw new UsageError('timeout', 'OpenDesign API did not answer within ' + timeoutMs + 'ms')
    }
    throw new UsageError('fetch', describeError(error))
  } finally {
    clearTimeout(timer)
  }

  if (response.status === 401) {
    await discardBody(response)
    throw new UsageError('unauthorized', 'OpenDesign rejected the session cookie (401 unauthenticated)')
  }
  if (!response.ok) {
    await discardBody(response)
    throw new UsageError('http' + response.status, 'OpenDesign API answered ' + response.status)
  }
  try {
    return await response.json()
  } catch (error) {
    if (isAbortError(error)) throw new UsageError('timeout', 'OpenDesign API response was cut off')
    throw new UsageError('fetch', 'OpenDesign API returned a non-JSON body')
  }
}

/** Resolve the effective cookie/workspace pair, or throw the noconfig code. */
function resolveCredentials(cfg) {
  const cookie = typeof cfg?.cookie === 'string' ? cfg.cookie.trim() : ''
  if (cookie === '') throw new UsageError('noconfig', 'No OpenDesign session cookie configured yet; sign in first')
  const workspaceID =
    typeof cfg?.workspaceID === 'string' && cfg.workspaceID.trim() !== '' ? cfg.workspaceID.trim() : DEFAULT_WORKSPACE_ID
  return { cookie, workspaceID, timeoutMs: cfg?.timeoutMs }
}

/**
 * Fetch the coding-plan usage snapshot.
 * @param {{cookie?: string, workspaceID?: string, timeoutMs?: number}} cfg
 * @returns {Promise<{updatedAt: number, windows: object[]}>}
 * @throws {UsageError} with one of the SPEC error codes.
 */
export async function fetchUsage(cfg) {
  const credentials = resolveCredentials(cfg)
  const payload = await requestJson(API_BASE + usagePath(credentials.workspaceID), credentials)
  const now = Date.now()
  return { updatedAt: now, windows: normalizeWindows(pickWindowList(payload), now) }
}

/** Candidate USD keys on a balance payload, most specific first. */
const BALANCE_USD_KEYS = [
  'balanceUsd',
  'usdBalance',
  'availableUsd',
  'creditUsd',
  'amountUsd',
  'totalUsd',
  'balance',
  'available',
  'amount',
  'credit',
]
/** Candidate cents keys, converted to dollars. */
const BALANCE_CENT_KEYS = ['balanceCents', 'availableCents', 'amountCents', 'creditCents', 'cents']

/** Format a numeric amount as a 2-decimal string. */
function formatUsd(value) {
  return Number.isFinite(value) ? value.toFixed(2) : null
}

/**
 * Extract a USD balance string from an unknown upstream payload; null when no
 * plausible field is present (the balance is optional and may not exist).
 */
export function pickBalanceUsd(payload) {
  const queue = [payload]
  const seen = new Set()
  while (queue.length > 0) {
    const node = queue.shift()
    if (typeof node !== 'object' || node === null || Array.isArray(node) || seen.has(node)) continue
    seen.add(node)
    for (const key of BALANCE_USD_KEYS) {
      const formatted = formatUsd(toFinite(node[key]))
      if (formatted !== null) return formatted
    }
    for (const key of BALANCE_CENT_KEYS) {
      const cents = toFinite(node[key])
      if (Number.isFinite(cents)) return formatUsd(cents / 100)
    }
    for (const key of ['data', 'wallet', 'balance', 'result']) {
      const child = node[key]
      if (typeof child === 'object' && child !== null) queue.push(child)
    }
  }
  return null
}

/**
 * Fetch the wallet balance. Secondary data: every failure returns null so it
 * can never block the usage snapshot.
 * @returns {Promise<string|null>}
 */
export async function fetchBalance(cfg) {
  try {
    const credentials = resolveCredentials(cfg)
    const payload = await requestJson(API_BASE + balancePath(credentials.workspaceID), credentials)
    return pickBalanceUsd(payload)
  } catch {
    return null
  }
}
