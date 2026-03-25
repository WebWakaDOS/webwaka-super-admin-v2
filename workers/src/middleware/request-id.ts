/**
 * Request ID Middleware — WebWaka Super Admin V2
 *
 * Attaches X-Request-ID to every response for distributed tracing.
 * Logs a structured JSON line after each request:
 *   { reqId, method, path, status, durationMs }
 *
 * Usage in Hono app:
 *   import { requestIdMiddleware } from './middleware/request-id'
 *   app.use('*', requestIdMiddleware)
 */

import type { MiddlewareHandler } from 'hono'

/**
 * requestIdMiddleware
 *
 * Sets X-Request-ID response header and logs:
 *   { reqId: string, method: string, path: string, status: number, durationMs: number }
 */
export const requestIdMiddleware: MiddlewareHandler = async (c, next) => {
  const reqId = crypto.randomUUID()
  const start = Date.now()

  // Set the ID on the response header
  c.res.headers.set('X-Request-ID', reqId)

  await next()

  const durationMs = Date.now() - start
  const status = c.res.status
  const { method, path } = c.req

  console.log(
    JSON.stringify({
      reqId,
      method,
      path,
      status,
      durationMs,
    })
  )
}

/**
 * generateRequestId — standalone helper if you need a UUID outside middleware
 */
export function generateRequestId(): string {
  return crypto.randomUUID()
}
