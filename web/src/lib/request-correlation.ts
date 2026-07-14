export const REQUEST_ID_HEADER = "x-request-id"
const SAFE_REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/

export function normalizeRequestId(value: string | null | undefined, createId: () => string = () => crypto.randomUUID()) {
  const candidate = value?.trim()
  return candidate && SAFE_REQUEST_ID.test(candidate) ? candidate : createId()
}
