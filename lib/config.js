/**
 * Config for dsh-opendesign-usage (host half).
 *
 * One JSON file under DSH_HOME plus four environment overrides; the env wins.
 * The cookie is the only secret here: it is written with mode 0600, never
 * logged, and never leaves the host except as a mask (set + last 4 chars).
 */
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

/**
 * No workspace default: a workspace id names one account's console, so baking
 * any value in would both leak that account and silently point a fresh install
 * at someone else's workspace. The pill reports 'noconfig' until the user signs
 * in (the login flow records it) or sets OPENDESIGN_USAGE_WORKSPACE_ID.
 */
export const DEFAULT_WORKSPACE_ID = ''
/** Cache lifetime in seconds when neither file nor env says otherwise. */
export const DEFAULT_CACHE_TTL_SECONDS = 60
/** Upstream request timeout in milliseconds. */
export const DEFAULT_TIMEOUT_MS = 10000
/** File name inside DSH_HOME. */
export const CONFIG_FILE_NAME = 'opendesign-usage.json'

/** Environment overrides, highest precedence. */
export const ENV_KEYS = {
  cookie: 'OPENDESIGN_USAGE_COOKIE',
  workspaceID: 'OPENDESIGN_USAGE_WORKSPACE_ID',
  cacheTTL: 'OPENDESIGN_USAGE_CACHE_TTL',
  timeoutMs: 'OPENDESIGN_USAGE_TIMEOUT_MS',
}

/** Absolute DSH home directory (env override, else ~/.dsh). */
export function dshHome() {
  const raw = process.env.DSH_HOME
  if (typeof raw === 'string' && raw.trim() !== '') return raw.trim()
  return join(homedir(), '.dsh')
}

/** Absolute path of the config file. */
export function configFilePath() {
  return join(dshHome(), CONFIG_FILE_NAME)
}

/** True for a plain JSON object (not null, not an array). */
function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** A trimmed non-empty string, else undefined. */
function asString(value) {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

/** A finite non-negative number, else undefined. */
function asNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

/** Read one environment override as a string. */
function envString(key) {
  return asString(process.env[key])
}

/** Read one environment override as a number. */
function envNumber(key) {
  const value = asNumber(process.env[key])
  return value !== undefined && value >= 0 ? value : undefined
}

/**
 * The raw config file contents; {} when the file is missing, unreadable or
 * not a JSON object. Never throws: a broken config must not break the plugin.
 */
export function readConfigFile() {
  try {
    const parsed = JSON.parse(readFileSync(configFilePath(), 'utf8'))
    return isObject(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

/** Timeout clamped into a range that cannot wedge the host or spin. */
function clampTimeoutMs(value) {
  return Math.min(120000, Math.max(100, Math.round(value)))
}

/**
 * Effective config: file values overridden by environment variables, with the
 * documented defaults for anything absent.
 * @returns {{cookie: string, workspaceID: string, cacheTTL: number, timeoutMs: number}}
 */
export function loadConfig() {
  const stored = readConfigFile()
  const cookie = envString(ENV_KEYS.cookie) ?? asString(stored.cookie) ?? ''
  const workspaceID = envString(ENV_KEYS.workspaceID) ?? asString(stored.workspaceID) ?? DEFAULT_WORKSPACE_ID
  const cacheTTL = envNumber(ENV_KEYS.cacheTTL) ?? asNumber(stored.cacheTTL) ?? DEFAULT_CACHE_TTL_SECONDS
  const timeoutMs = envNumber(ENV_KEYS.timeoutMs) ?? asNumber(stored.timeoutMs) ?? DEFAULT_TIMEOUT_MS
  return {
    cookie,
    workspaceID,
    cacheTTL: Math.max(0, Math.round(cacheTTL)),
    timeoutMs: clampTimeoutMs(timeoutMs),
  }
}

/** Masked secret shape from SPEC: whether it is set, plus the last 4 chars. */
function maskSecret(value) {
  const text = typeof value === 'string' ? value : ''
  return { set: text !== '', tail: text === '' ? '' : text.slice(-4) }
}

/**
 * The config as the browser may see it: no cookie value, only a mask.
 * @returns {{workspaceID: {set: boolean, tail: string}, cookie: {set: boolean, tail: string}}}
 */
export function maskedConfigView() {
  const cfg = loadConfig()
  return {
    workspaceID: maskSecret(cfg.workspaceID),
    cookie: maskSecret(cfg.cookie),
  }
}

/**
 * Merge a partial config into the file (mode 0600) and return the mask view.
 * An empty cookie string clears the stored cookie (sign-out); keys this
 * function does not know about are preserved untouched, and unknown fields in
 * the partial argument are ignored.
 */
export function writeConfigFile(partial = {}) {
  const source = isObject(partial) ? partial : {}
  const next = { ...readConfigFile() }

  if ('cookie' in source) {
    const cookie = asString(source.cookie)
    if (cookie === undefined) delete next.cookie
    else next.cookie = cookie
  }
  if ('workspaceID' in source) {
    const workspaceID = asString(source.workspaceID)
    if (workspaceID !== undefined) next.workspaceID = workspaceID
  }
  if ('cacheTTL' in source) {
    const cacheTTL = asNumber(source.cacheTTL)
    if (cacheTTL !== undefined) next.cacheTTL = Math.max(0, Math.round(cacheTTL))
  }
  if ('timeoutMs' in source) {
    const timeoutMs = asNumber(source.timeoutMs)
    if (timeoutMs !== undefined) next.timeoutMs = clampTimeoutMs(timeoutMs)
  }

  const file = configFilePath()
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 })
  writeFileSync(file, JSON.stringify(next, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 })
  // writeFileSync only applies the mode when it creates the file; re-assert on rewrite.
  try {
    chmodSync(file, 0o600)
  } catch {
    // Windows has no POSIX mode bits; the create-time flag is the best we get.
  }
  return maskedConfigView()
}
