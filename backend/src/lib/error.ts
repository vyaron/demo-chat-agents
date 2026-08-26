import { randomUUID } from "node:crypto"
import type { Response } from "express"

interface ApiError {
  code: string
  message: string
  details?: Record<string, unknown>
}

function send(res: Response, status: number, error: ApiError, requestId: string) {
  return res.status(status).json({ error, requestId })
}

export function sendValidationError(
  res: Response,
  code: string,
  message: string,
  details?: Record<string, unknown>
) {
  return send(res, 400, details ? { code, message, details } : { code, message }, randomUUID())
}

// Supabase wraps transport failures so the original `cause` chain is lost by the
// time it reaches a route. Walk whatever is left so the log names the real
// problem (ENOTFOUND, ECONNREFUSED, a PostgREST code) instead of "fetch failed".
function describe(cause: unknown): Record<string, unknown> {
  if (!cause || typeof cause !== "object") return { message: String(cause) }

  const err = cause as Record<string, unknown>
  const described: Record<string, unknown> = {}

  for (const key of ["message", "code", "details", "hint", "name"]) {
    if (err[key] != null) described[key] = err[key]
  }
  if (err.cause) described.cause = describe(err.cause)

  return described
}

// A PGRST* code means the database answered and rejected the request — a schema
// or query bug on our side, which retrying will never fix. Anything without a
// code never reached the database at all (DNS, TLS, connection refused), and
// that is the only case worth telling the caller to retry.
function isReachable(cause: unknown) {
  const code = (cause as { code?: unknown } | null)?.code
  return typeof code === "string" && code.startsWith("PGRST")
}

// Every database failure is an infrastructure error: log the provider detail
// server-side, return a safe status. Raw provider payloads never reach the client.
export function sendUpstreamError(res: Response, operation: string, cause: unknown) {
  const requestId = randomUUID()

  console.error(
    JSON.stringify({
      level: "error",
      category: "infrastructure",
      requestId,
      operation,
      ...describe(cause),
    })
  )

  return isReachable(cause)
    ? send(
        res,
        500,
        { code: "internal_error", message: "The chat service failed to read its data." },
        requestId
      )
    : send(
        res,
        503,
        {
          code: "upstream_unavailable",
          message: "The chat database is unavailable. Please try again shortly.",
        },
        requestId
      )
}
