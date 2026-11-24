import "server-only"
import { NextResponse } from "next/server"
import { AscendError } from "./ascend-engine"
import { expansionFailure, expansionHeaders } from "./expansion-http"

export const ascendHeaders = expansionHeaders

/** Bounded JSON body for machine callers (no browser origin). */
export async function ascendMachineBody(request: Request, max = 16384): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new AscendError("JSON is required.", 415, "invalid_payload")
  const reader = request.body?.getReader()
  if (!reader) return {}
  const parts: Uint8Array[] = []; let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > max) { await reader.cancel(); throw new AscendError("Request is too large.", 413, "invalid_payload") }
    parts.push(value)
  }
  if (!total) return {}
  let parsed: unknown
  try { parsed = JSON.parse(Buffer.concat(parts).toString("utf8")) } catch { throw new AscendError("Invalid JSON.", 400, "invalid_payload") }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new AscendError("An object is required.", 400, "invalid_payload")
  return parsed as Record<string, unknown>
}

/** Structured, sanitised errors. Unknown failures never reveal driver messages. */
export function ascendFailure(error: unknown) {
  if (error instanceof AscendError) return NextResponse.json({ error: error.message, failureClass: error.failureClass ?? null }, { status: error.status, headers: ascendHeaders })
  return expansionFailure(error)
}
