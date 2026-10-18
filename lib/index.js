/**
 * dsh-opendesign-usage - host half.
 *
 * Mounts the usage service and the six same-origin JSON routes the browser pill
 * polls. The routes are plain node request handlers: writeHead plus a JSON
 * body, no framework, no dependency beyond node builtins.
 */
import { createUsageService } from './service.js'
import { maskedConfigView, writeConfigFile } from './config.js'
import { cancelLogin, loginStatus, startLogin } from './login.js'

/** Stable cordis plugin name (matches the cordis.patch.yml insert id). */
export const name = 'opendesign-usage'

/** The host webserver must exist before the routes can mount. */
export const inject = ['webServer']

/** Hard cap on a POST body; the config payload is two short strings. */
export const MAX_BODY_BYTES = 64 * 1024

/** Route table from the SPEC. */
export const ROUTES = {
  view: '/api/opendesign-usage',
  refresh: '/api/opendesign-usage/refresh',
  config: '/api/opendesign-usage/config',
  login: '/api/opendesign-usage/login',
  loginStatus: '/api/opendesign-usage/login/status',
}

/** Headers every JSON response carries. */
const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
}

/** Write one JSON response. */
function writeJson(res, status, body) {
  let payload
  try {
    payload = JSON.stringify(body)
  } catch {
    payload = JSON.stringify({ error: 'fetch', message: 'response could not be serialised' })
    status = 500
  }
  res.writeHead(status, JSON_HEADERS)
  res.end(payload)
}

/** Read a request body, refusing anything over the cap. */
function readBody(req, limit = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    let settled = false
    const fail = (error) => {
      if (settled) return
      settled = true
      reject(error)
    }
    req.on('data', (chunk) => {
      if (settled) return
      size += chunk.length
      if (size > limit) {
        fail(Object.assign(new Error('request body exceeds ' + limit + ' bytes'), { statusCode: 413 }))
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (settled) return
      settled = true
      resolve(Buffer.concat(chunks).toString('utf8'))
    })
    req.on('error', fail)
    req.on('aborted', () => fail(new Error('request aborted')))
  })
}

/** Parse a JSON object body; an empty body is an empty object. */
async function readJsonBody(req) {
  const text = (await readBody(req)).trim()
  if (text === '') return {}
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw Object.assign(new Error('request body is not valid JSON'), { statusCode: 400 })
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw Object.assign(new Error('request body must be a JSON object'), { statusCode: 400 })
  }
  return parsed
}

/** Reject anything but the documented method. */
function requireMethod(req, res, method) {
  if (req.method === method) return true
  writeJson(res, 405, { error: 'method', message: 'expected ' + method + ', got ' + String(req.method) })
  return false
}

/** The six route descriptors handed to webServer.register. */
function makeRoutes(service) {
  return [
    {
      kind: 'exact',
      path: ROUTES.view,
      handler: async (req, res) => {
        if (!requireMethod(req, res, 'GET')) return
        writeJson(res, 200, await service.view())
      },
    },
    {
      kind: 'exact',
      path: ROUTES.refresh,
      handler: async (req, res) => {
        if (!requireMethod(req, res, 'GET')) return
        writeJson(res, 200, await service.refresh())
      },
    },
    {
      kind: 'exact',
      path: ROUTES.config,
      handler: async (req, res) => {
        if (req.method === 'GET') {
          writeJson(res, 200, maskedConfigView())
          return
        }
        if (!requireMethod(req, res, 'POST')) return
        try {
          const body = await readJsonBody(req)
          const partial = {}
          if ('cookie' in body) partial.cookie = body.cookie
          if ('workspaceID' in body) partial.workspaceID = body.workspaceID
          const view = writeConfigFile(partial)
          service.invalidateCache()
          writeJson(res, 200, view)
        } catch (error) {
          const status = Number.isInteger(error?.statusCode) ? error.statusCode : 400
          writeJson(res, status, { error: 'config', message: String(error?.message ?? error) })
        }
      },
    },
    {
      kind: 'exact',
      path: ROUTES.login,
      handler: async (req, res) => {
        if (!requireMethod(req, res, 'POST')) return
        try {
          // Drain the (empty) body so the socket is reusable before we answer.
          await readJsonBody(req)
        } catch {
          // A malformed body must not block starting the flow.
        }
        const status = await startLogin({
          onSuccess: () => {
            service.invalidateCache()
          },
        })
        writeJson(res, 200, status)
      },
    },
    {
      kind: 'exact',
      path: ROUTES.loginStatus,
      handler: async (req, res) => {
        if (!requireMethod(req, res, 'GET')) return
        writeJson(res, 200, loginStatus())
      },
    },
  ]
}

/**
 * Mount the service and its routes.
 * @param {object} ctx - cordis context carrying webServer.
 * @param {object} [config] - the plugin row config (unused; the config file and env win).
 */
export function apply(ctx, config = {}) {
  const service = createUsageService(ctx, config)

  ctx.effect(() => () => {
    void cancelLogin()
  }, 'opendesign-usage: login teardown')

  /** Register all six routes on whichever context finally carries webServer. */
  const mount = (scope, webServer) => {
    const routes = makeRoutes(service)
    scope.effect(() => {
      const disposers = routes.map((route) => webServer.register(route))
      return () => {
        for (const dispose of disposers) dispose()
      }
    }, 'opendesign-usage: routes')
  }

  /** webServer off a context, by direct property or through ctx.get(). */
  const webServerOf = (scope) => {
    const direct = scope?.webServer
    if (direct !== undefined && direct !== null) return direct
    try {
      const fetched = typeof scope?.get === 'function' ? scope.get('webServer', false) : undefined
      if (fetched !== undefined && fetched !== null) return fetched
    } catch {
      // Service not provided on this context yet.
    }
    return undefined
  }

  const ready = webServerOf(ctx)
  if (ready !== undefined) mount(ctx, ready)
  else
    ctx.inject(['webServer'], (scope) => {
      const scoped = webServerOf(scope)
      if (scoped !== undefined) mount(scope, scoped)
    })

  try {
    ctx.logger?.info?.('[opendesign-usage] host ready: 6 endpoints on 5 routes under /api/opendesign-usage')
  } catch {
    // A logger failure must not abort the mount.
  }
}
