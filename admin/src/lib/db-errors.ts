/**
 * Safe database error translation. Partners and founders must never see SQL, constraint names, table names or record ids.
 * Messages raised deliberately by our own triggers (SQLSTATE P0001) are curated sentences and pass through; anything else is
 * replaced by a short, generic, human explanation chosen from the SQLSTATE class.
 */
export interface SafeDbError { status: number; message: string }
type ErrorShape = { code?: string; message?: string; cause?: { code?: string; message?: string } }

export function dbErrorCode(error: unknown): string | undefined {
  const e = error as ErrorShape
  return e?.cause?.code ?? e?.code
}
function looksLikeEngineText(message: string) {
  return /violates (check|foreign key|unique|not-null)|duplicate key|null value in column|relation "|column "|constraint "|syntax error|^Failed query|params:|invalid input syntax/i.test(message)
}
export function translateDbError(error: unknown, fallback = "That change is not permitted."): SafeDbError | null {
  // Programming errors are never database refusals and must not be shown to anyone.
  if (error instanceof TypeError || error instanceof RangeError || error instanceof ReferenceError || error instanceof SyntaxError) return null
  const e = error as ErrorShape
  const code = dbErrorCode(error)
  const message = e?.cause?.message ?? e?.message ?? ""
  if (code === "23505") return { status: 409, message: "That has already been recorded." }
  if (code === "23503") return { status: 409, message: "A selected record does not exist or is still in use." }
  if (code === "23514") return { status: 400, message: "That value is not permitted." }
  if (code === "23502") return { status: 400, message: "A required value is missing." }
  if (code && /^22/.test(code)) return { status: 400, message: "That value is not valid." }
  if (code === "P0001" && message && !looksLikeEngineText(message)) return { status: 409, message }
  if (!code && message && !looksLikeEngineText(message) && message.length < 220) return { status: 409, message }
  if (message && looksLikeEngineText(message)) return { status: 409, message: fallback }
  return null
}
export const safeDbMessage = (error: unknown, fallback: string) => translateDbError(error, fallback)?.message ?? fallback
