import { AsyncLocalStorage } from "node:async_hooks"
import { randomUUID } from "node:crypto"
import { createLogger, type LogContext, type Logger } from "./logging"

export const REQUEST_ID_HEADER = "x-request-id"
const SAFE_REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/

export interface RequestLogContext extends LogContext {
  requestId: string
  actorId?: string
}

const requestContextStorage = new AsyncLocalStorage<RequestLogContext>()

export function normalizeRequestId(value: string | null | undefined) {
  const candidate = value?.trim()
  return candidate && SAFE_REQUEST_ID.test(candidate) ? candidate : randomUUID()
}

export function requestIdFromRequest(request: Request) {
  return normalizeRequestId(request.headers.get(REQUEST_ID_HEADER))
}

export function withRequestLogContext<T>(context: RequestLogContext, callback: () => T): T {
  return requestContextStorage.run(context, callback)
}

export function currentRequestLogContext(): RequestLogContext | undefined {
  return requestContextStorage.getStore()
}

export function requestLogger(context: LogContext = {}): Logger {
  const current = currentRequestLogContext()
  return createLogger({
    service: "scalesmiths-admin",
    requestId: current?.requestId ?? randomUUID(),
    ...current,
    ...context,
  })
}
