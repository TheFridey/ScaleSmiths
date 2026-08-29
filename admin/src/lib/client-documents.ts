import { createHash, randomUUID } from "node:crypto"

export const CLIENT_DOCUMENT_TYPES = ["brief", "proposal", "contract", "brand_asset", "content", "design", "staging_link", "launch_checklist", "handoff", "report", "technical", "other"] as const
export const CLIENT_DOCUMENT_MAX_BYTES = 25 * 1024 * 1024
export const ALLOWED_DOCUMENT_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "image/svg+xml", "text/plain", "text/csv", "text/markdown", "application/json", "application/zip", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.openxmlformats-officedocument.presentationml.presentation"])

export function safeFilename(value: string) {
  const leaf = value.replaceAll("\\", "/").split("/").pop()?.normalize("NFKC") ?? "document"
  const cleaned = leaf.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "-").replace(/\s+/g, " ").trim().replace(/^\.+/, "").slice(0, 180)
  return cleaned || "document"
}
export function validateDocumentMime(file: { type: string; size: number; name: string }) {
  const mime = file.type.toLowerCase().split(";")[0].trim()
  if (!ALLOWED_DOCUMENT_MIME_TYPES.has(mime)) throw new Error("This file type is not allowed.")
  if (file.size <= 0 || file.size > CLIENT_DOCUMENT_MAX_BYTES) throw new Error("Files must be between 1 byte and 25 MB.")
  return { mime, filename: safeFilename(file.name) }
}
export function documentObjectKey(clientId: number, projectId: number, filename: string) {
  const extension = filename.includes(".") ? `.${filename.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10)}` : ""
  return `client-documents/${clientId}/${projectId}/${randomUUID()}${extension}`
}
export function sha256(value: Uint8Array) { return createHash("sha256").update(value).digest("hex") }
export function safeExternalUrl(value: string) {
  const url = new URL(value)
  if (url.protocol !== "https:") throw new Error("Document links must use HTTPS.")
  if (url.username || url.password) throw new Error("Document links cannot contain credentials.")
  return url.toString()
}
