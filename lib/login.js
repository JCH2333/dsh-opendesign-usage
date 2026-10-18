/**
 * Interactive sign-in for the OpenDesign console (host half).
 *
 * The console API only accepts a browser session cookie and the login page sits
 * behind Cloudflare Turnstile, so no automation can sign in on its own. The host
 * therefore launches a private Chrome with a remote debugging port, lets the
 * user sign in inside that window, harvests the cookies over CDP, and declares
 * success only once a real coding-plan-usage request answers 2xx.
 *
 * Every exit path - success, failure, timeout, cancellation - kills the browser
 * process tree and removes the throwaway profile directory. Resources belong to
 * the flow that created them, so a cancelled flow can never tear down the one
 * that replaced it.
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { loadConfig, writeConfigFile } from './config.js'
import { fetchUsage } from './api.js'

/** Chrome/Edge install paths, probed in this order; the first that exists wins. */
export const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
]

/** The whole interactive sign-in may take this long before it is abandoned. */
export const LOGIN_TIMEOUT_MS = 5 * 60 * 1000
/** How long a freshly spawned browser may take to expose its CDP page target. */
export const CDP_CONNECT_TIMEOUT_MS = 45 * 1000
/** Delay between cookie harvest attempts. */
export const HARVEST_INTERVAL_MS = 2000
/** Page opened in the login window. */
export const LOGIN_PAGE_ORIGIN = 'https://open-design.ai'
/** Cookie domain fragments that belong to the console. */
const COOKIE_DOMAIN_HINTS = ['open-design.ai']
/** Cookie name fragments that identify a Better Auth session. */
const SESSION_COOKIE_HINTS = ['session_token', 'session']
/** Message shown while the user is expected to be signing in. */
const WAITING_MESSAGE = 'waiting for sign-in in the browser window'
/** Message shown once the deadline passed. */
const TIMEOUT_MESSAGE = 'timeout: sign-in was not completed within 5 minutes'
/** Message used when a flow is abandoned by its owner. */
const CANCELLED_MESSAGE = 'cancelled'

/**
 * Module-level login state: exactly one flow per host process.
 * `generation` is bumped on cancellation so a superseded flow cannot write the
 * status of the flow that replaced it.
 */
const state = {
  status: { state: 'idle' },
  flow: null,
  generation: 0,
  /** The live flow's resource bag, so cancelLogin can flag it. */
  resources: null,
}

/**
 * Resolve after the given number of milliseconds.
 *
 * The timer is deliberately NOT unref'd: the flow awaits it, and an unref'd
 * timer lets the process exit while the promise is still pending.
 */
function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/** One line of error text, safe to log or show. */
function describe(error) {
  const text = typeof error?.message === 'string' && error.message !== '' ? error.message : String(error)
  return text.split('\n')[0].slice(0, 300)
}

/** Replace the status atomically and stamp it. */
function setStatus(next) {
  state.status = { ...next, updatedAt: Date.now() }
  return { ...state.status }
}

/**
 * The current login status, exactly as the browser contract requires.
 * @returns {{state: 'idle'|'pending'|'success'|'failed', message?: string, updatedAt?: number}}
 */
export function loginStatus() {
  return { ...state.status }
}

/** The first existing Chrome/Edge executable, or null when none is installed. */
export function findChrome() {
  for (const candidate of CHROME_CANDIDATES) {
    try {
      if (existsSync(candidate)) return candidate
    } catch {
      // Unreadable path: treat as absent and keep probing.
    }
  }
  return null
}

/** Reserve a free loopback TCP port and hand it back. */
export function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.unref()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address !== null ? address.port : 0
      server.close(() => {
        if (Number.isInteger(port) && port > 0) resolve(port)
        else reject(new Error('could not determine a free port'))
      })
    })
  })
}

/** Create the throwaway profile directory for one login window. */
export function makeTempProfileDir() {
  const dir = join(tmpdir(), 'opendesign-login-' + randomBytes(6).toString('hex'))
  mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * Extract every complete JSON document from a CDP socket buffer.
 *
 * Chrome may coalesce several JSON documents into one WebSocket message and may
 * also deliver one document across frames, so the caller keeps the leftover
 * text. Newline-delimited documents are consumed first, then a balanced-brace
 * scan pulls out documents that arrived without a separator. Malformed
 * documents are skipped instead of throwing: one bad frame must not kill the
 * flow.
 *
 * @param {string} buffer - accumulated socket text.
 * @returns {{messages: object[], rest: string}} parsed documents plus the tail.
 */
export function extractCdpMessages(buffer) {
  const messages = []
  let rest = typeof buffer === 'string' ? buffer : ''

  const parseInto = (text) => {
    const trimmed = text.trim()
    if (trimmed === '') return
    try {
      const parsed = JSON.parse(trimmed)
      if (typeof parsed === 'object' && parsed !== null) messages.push(parsed)
    } catch {
      // Not a complete document yet, or not JSON at all: drop it.
    }
  }

  if (rest.includes('\n')) {
    const parts = rest.split('\n')
    rest = parts.pop() ?? ''
    for (const part of parts) parseInto(part)
  }

  // Balanced-brace scan for documents that arrived with no separator at all.
  for (;;) {
    const start = rest.indexOf('{')
    if (start < 0) {
      rest = ''
      break
    }
    if (start > 0) rest = rest.slice(start)
    let depth = 0
    let inString = false
    let escaped = false
    let end = -1
    for (let index = 0; index < rest.length; index += 1) {
      const char = rest[index]
      if (inString) {
        if (escaped) escaped = false
        else if (char === '\\') escaped = true
        else if (char === '"') inString = false
        continue
      }
      if (char === '"') inString = true
      else if (char === '{') depth += 1
      else if (char === '}') {
        depth -= 1
        if (depth === 0) {
          end = index
          break
        }
      }
    }
    if (end < 0) break
    parseInto(rest.slice(0, end + 1))
    rest = rest.slice(end + 1)
  }

  return { messages, rest }
}

/** Minimal CDP client over the platform WebSocket. */
class CdpClient {
  /** @param {string} url - the page target's webSocketDebuggerUrl. */
  constructor(url) {
    this.url = url
    this.socket = null
    this.buffer = ''
    this.nextId = 1
    this.pending = new Map()
    this.closed = false
  }

  /** Open the socket; resolves once the handshake completed. */
  connect() {
    return new Promise((resolve, reject) => {
      let settled = false
      let socket
      try {
        socket = new WebSocket(this.url)
      } catch (error) {
        reject(new Error('could not open the CDP socket: ' + describe(error)))
        return
      }
      this.socket = socket
      const timer = setTimeout(() => {
        if (settled) return
        settled = true
        reject(new Error('CDP socket handshake timed out'))
      }, CDP_CONNECT_TIMEOUT_MS)

      socket.addEventListener('open', () => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve()
      })
      socket.addEventListener('message', (event) => {
        this.consume(typeof event.data === 'string' ? event.data : String(event.data ?? ''))
      })
      socket.addEventListener('error', (event) => {
        if (!settled) {
          settled = true
          clearTimeout(timer)
          reject(new Error('CDP socket error: ' + describe(event?.error ?? event?.message ?? 'unknown')))
        }
      })
      socket.addEventListener('close', () => {
        this.closed = true
        for (const [, entry] of this.pending) entry.reject(new Error('CDP socket closed'))
        this.pending.clear()
      })
    })
  }

  /** Feed raw socket text through the framing buffer and dispatch documents. */
  consume(text) {
    this.buffer += text
    const { messages, rest } = extractCdpMessages(this.buffer)
    this.buffer = rest
    for (const message of messages) {
      if (typeof message.id !== 'number') continue
      const entry = this.pending.get(message.id)
      if (entry === undefined) continue
      this.pending.delete(message.id)
      if (message.error !== undefined) entry.reject(new Error(describe(message.error?.message ?? message.error)))
      else entry.resolve(message.result)
    }
  }

  /**
   * Send one CDP method and await its result.
   * @param {string} method - e.g. 'Network.getAllCookies'.
   * @param {object} [params]
   * @returns {Promise<object>} the result payload.
   */
  send(method, params = {}) {
    if (this.socket === null || this.closed) return Promise.reject(new Error('CDP socket is not open'))
    const id = this.nextId
    this.nextId += 1
    const payload = JSON.stringify({ id, method, params })
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error('CDP ' + method + ' timed out'))
      }, 10000)
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer)
          resolve(value)
        },
        reject: (error) => {
          clearTimeout(timer)
          reject(error)
        },
      })
      try {
        this.socket.send(payload)
      } catch (error) {
        this.pending.delete(id)
        clearTimeout(timer)
        reject(new Error('CDP send failed: ' + describe(error)))
      }
    })
  }

  /** Close the socket and reject everything still in flight. */
  close() {
    this.closed = true
    try {
      this.socket?.close()
    } catch {
      // Already gone.
    }
    for (const [, entry] of this.pending) entry.reject(new Error('CDP socket closed'))
    this.pending.clear()
  }
}

/** Poll /json/list until a page target exposes a debugger URL. */
async function waitForPageTarget(port, deadline, resources) {
  const url = 'http://127.0.0.1:' + port + '/json/list'
  while (Date.now() < deadline) {
    if (resources.cancelled === true) throw new Error(CANCELLED_MESSAGE)
    if (resources.chrome === null || resources.chrome.exitCode !== null) {
      throw new Error('the browser closed before its debugging endpoint came up')
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) })
      if (response.ok) {
        const targets = await response.json()
        if (Array.isArray(targets)) {
          const page = targets.find(
            (target) =>
              target?.type === 'page' &&
              typeof target.webSocketDebuggerUrl === 'string' &&
              target.webSocketDebuggerUrl !== '',
          )
          if (page !== undefined) return page.webSocketDebuggerUrl
        }
      }
    } catch {
      // Browser still starting: keep polling.
    }
    await delay(300)
  }
  throw new Error('the browser never exposed a debugging page target')
}

/** True when the cookie jar holds a Better Auth style session cookie. */
function hasSessionCookie(cookies) {
  return cookies.some((cookie) => {
    const name = String(cookie?.name ?? '').toLowerCase()
    return SESSION_COOKIE_HINTS.some((hint) => name.includes(hint))
  })
}

/**
 * Keep the console cookies, joined into a Cookie request header value.
 * @param {unknown} cookies - the Network.getAllCookies array.
 * @returns {string} 'name=value; name=value', or '' when nothing matched.
 */
export function buildCookieHeader(cookies) {
  if (!Array.isArray(cookies)) return ''
  const parts = []
  for (const cookie of cookies) {
    const domain = String(cookie?.domain ?? '').toLowerCase()
    const name = String(cookie?.name ?? '')
    const value = String(cookie?.value ?? '')
    if (name === '') continue
    if (!COOKIE_DOMAIN_HINTS.some((hint) => domain.includes(hint))) continue
    parts.push(name + '=' + value)
  }
  return parts.join('; ')
}

/** Kill a browser process and its whole child tree on Windows. */
function killChrome(child) {
  if (child === null || typeof child !== 'object') return
  const pid = child.pid
  try {
    child.kill('SIGKILL')
  } catch {
    // Already dead.
  }
  if (typeof pid === 'number') {
    try {
      const killer = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
      killer.on('error', () => undefined)
      killer.unref()
    } catch {
      // taskkill unavailable: the direct kill above is all we have.
    }
  }
}

/** Remove the throwaway profile, retrying while Chrome releases its handles. */
async function removeTempDir(dir) {
  if (typeof dir !== 'string' || dir === '') return
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      rmSync(dir, { recursive: true, force: true })
      return
    } catch {
      await delay(250)
    }
  }
}

/**
 * Release everything one flow owns: socket, browser process tree, profile dir.
 * Resources live on the flow, so this never touches a newer flow's browser.
 */
async function teardown(resources) {
  if (resources.socket !== null) {
    try {
      resources.socket.close()
    } catch {
      // Already closed.
    }
    resources.socket = null
  }
  const child = resources.chrome
  resources.chrome = null
  killChrome(child)
  if (child !== null) await delay(200)
  const dir = resources.tempDir
  resources.tempDir = null
  await removeTempDir(dir)
}

/**
 * Harvest cookies until a real API call succeeds, the deadline passes, or the
 * socket dies. Transient misses (no console cookie yet, no session cookie yet,
 * the API still answering 401) leave the window open and retry; only the
 * deadline or a closed window ends the flow.
 *
 * @returns {Promise<string>} the Cookie header that passed the live API check.
 */
async function harvestLoop(client, workspaceID, deadline, report, isCancelled) {
  while (Date.now() < deadline) {
    if (isCancelled()) throw new Error(CANCELLED_MESSAGE)
    if (client.closed) throw new Error('the browser window was closed before sign-in completed')

    let result
    try {
      result = await client.send('Network.getAllCookies')
    } catch (error) {
      throw new Error('could not read cookies from the browser: ' + describe(error))
    }

    const cookies = Array.isArray(result?.cookies) ? result.cookies : []
    const cookie = buildCookieHeader(cookies)
    if (cookie === '') {
      report(WAITING_MESSAGE)
      await delay(HARVEST_INTERVAL_MS)
      continue
    }
    if (!hasSessionCookie(cookies)) {
      report('signed-in session cookie not found yet')
      await delay(HARVEST_INTERVAL_MS)
      continue
    }

    try {
      await fetchUsage({ cookie, workspaceID, timeoutMs: 15000 })
      return cookie
    } catch (error) {
      const code = typeof error?.code === 'string' ? error.code : 'fetch'
      report(code === 'unauthorized' ? 'waiting for sign-in to complete' : 'OpenDesign API check failed (' + code + ')')
    }

    await delay(HARVEST_INTERVAL_MS)
  }
  throw new Error(TIMEOUT_MESSAGE)
}

/**
 * The full 8-step flow. Owns its resources; every exit path tears them down and
 * every status write is dropped once the flow was cancelled.
 *
 * @param {{onSuccess?: (status: object) => void}} options
 * @param {number} generation - the cancellation generation this flow belongs to.
 * @param {{chrome: object|null, socket: object|null, tempDir: string|null, cancelled: boolean}} resources
 *   the bag this flow owns; shared with cancelLogin so it can flag the flow.
 */
async function runFlow(options, generation, resources) {
  /** True once cancelLogin superseded this flow. */
  const superseded = () => state.generation !== generation
  const finish = (next) => (superseded() ? loginStatus() : setStatus(next))

  const workspaceID = loadConfig().workspaceID
  const deadline = Date.now() + LOGIN_TIMEOUT_MS

  const chromePath = findChrome()
  if (chromePath === null) return finish({ state: 'failed', message: 'no Chrome or Edge found at the known install paths' })

  let port
  try {
    port = await findFreePort()
  } catch (error) {
    return finish({ state: 'failed', message: 'could not reserve a local port: ' + describe(error) })
  }

  try {
    resources.tempDir = makeTempProfileDir()
  } catch (error) {
    return finish({ state: 'failed', message: 'could not create the temporary browser profile: ' + describe(error) })
  }

  const pageUrl = LOGIN_PAGE_ORIGIN + '/cloud/dashboard?workspaceId=' + encodeURIComponent(workspaceID)
  const args = [
    '--remote-debugging-port=' + port,
    '--remote-allow-origins=*',
    '--user-data-dir=' + resources.tempDir,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-features=Translate',
    pageUrl,
  ]

  try {
    const child = spawn(chromePath, args, { stdio: 'ignore', windowsHide: false, detached: false })
    child.on('error', () => undefined)
    child.unref()
    resources.chrome = child
  } catch (error) {
    await teardown(resources)
    return finish({ state: 'failed', message: 'could not start the browser: ' + describe(error) })
  }

  let lastMessage = 'launching browser'
  const report = (message) => {
    if (message === lastMessage) return
    lastMessage = message
    if (!superseded()) setStatus({ state: 'pending', message })
  }

  try {
    const wsUrl = await waitForPageTarget(port, Math.min(deadline, Date.now() + CDP_CONNECT_TIMEOUT_MS), resources)
    const client = new CdpClient(wsUrl)
    resources.socket = client
    await client.connect()
    report(WAITING_MESSAGE)
    const cookie = await harvestLoop(client, workspaceID, deadline, report, superseded)
    writeConfigFile({ cookie, workspaceID })
    const status = finish({ state: 'success', message: 'signed in' })
    await teardown(resources)
    if (typeof options?.onSuccess === 'function') {
      try {
        options.onSuccess(status)
      } catch {
        // A listener failure must not downgrade a successful sign-in.
      }
    }
    return status
  } catch (error) {
    const status = finish({ state: 'failed', message: describe(error) })
    await teardown(resources)
    return status
  }
}

/**
 * Start the interactive sign-in. Returns as soon as the flow is under way; the
 * browser polls loginStatus() for the outcome. A second call while a flow is
 * running is a no-op that returns the live status.
 *
 * @param {{onSuccess?: (status: object) => void}} [options]
 * @returns {Promise<object>} the current login status.
 */
export async function startLogin(options = {}) {
  if (state.flow !== null) return loginStatus()
  if (findChrome() === null) {
    return setStatus({ state: 'failed', message: 'no Chrome or Edge found at the known install paths' })
  }
  const generation = state.generation
  setStatus({ state: 'pending', message: 'launching browser' })
  const resources = { chrome: null, socket: null, tempDir: null, cancelled: false }
  state.resources = resources
  state.flow = runFlow(options, generation, resources)
    .catch((error) => setStatus({ state: 'failed', message: describe(error) }))
    .finally(() => {
      state.flow = null
      state.resources = null
    })
  return loginStatus()
}

/**
 * Abandon the running flow: bump the generation so its status writes are
 * dropped, and let its own teardown release its resources.
 * @returns {Promise<object>} the new (idle) status.
 */
export async function cancelLogin() {
  if (state.flow === null) return loginStatus()
  state.generation += 1
  if (state.resources !== null) state.resources.cancelled = true
  const status = setStatus({ state: 'idle', message: 'cancelled' })
  state.flow = null
  return status
}

/**
 * Await the running flow's terminal status; resolves immediately when idle.
 * Exposed for tests and for callers that prefer to block over polling.
 */
export async function waitForLogin() {
  if (state.flow !== null) await state.flow
  return loginStatus()
}
