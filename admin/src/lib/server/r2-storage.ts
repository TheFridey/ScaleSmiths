import "server-only"
import { createHash, createHmac } from "node:crypto"

function config() {
  const accountId = process.env.R2_ACCOUNT_ID, accessKey = process.env.R2_ACCESS_KEY_ID, secret = process.env.R2_SECRET_ACCESS_KEY, bucket = process.env.R2_BUCKET
  if (!accountId || !accessKey || !secret || !bucket) throw new Error("R2 document storage is not configured.")
  return { accountId, accessKey, secret, bucket }
}
const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex")
const hmac = (key: string | Buffer, value: string) => createHmac("sha256", key).update(value).digest()
function encodedPath(bucket: string, key: string) { return `/${encodeURIComponent(bucket)}/${key.split("/").map(encodeURIComponent).join("/")}` }
async function r2Request(method: "GET" | "PUT" | "DELETE", key: string, body?: Uint8Array, contentType?: string) {
  const { accountId, accessKey, secret, bucket } = config(), host = `${accountId}.r2.cloudflarestorage.com`, path = encodedPath(bucket, key)
  const now = new Date(), date = now.toISOString().replace(/[:-]|\.\d{3}/g, ""), day = date.slice(0, 8), payloadHash = hash(body ?? new Uint8Array())
  const headers: Record<string, string> = { host, "x-amz-content-sha256": payloadHash, "x-amz-date": date }
  if (contentType) headers["content-type"] = contentType
  const signedHeaders = Object.keys(headers).sort().join(";"), canonicalHeaders = Object.keys(headers).sort().map((name) => `${name}:${headers[name]}\n`).join("")
  const canonical = `${method}\n${path}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`, scope = `${day}/auto/s3/aws4_request`
  const stringToSign = `AWS4-HMAC-SHA256\n${date}\n${scope}\n${hash(canonical)}`
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secret}`, day), "auto"), "s3"), "aws4_request")
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${createHmac("sha256", signingKey).update(stringToSign).digest("hex")}`
  const response = await fetch(`https://${host}${path}`, { method, headers, body: body as BodyInit | undefined })
  if (!response.ok) throw new Error(`R2 ${method} failed with status ${response.status}.`)
  return response
}
export const putR2Object = (key: string, body: Uint8Array, mime: string) => r2Request("PUT", key, body, mime)
export const getR2Object = (key: string) => r2Request("GET", key)
export const deleteR2Object = (key: string) => r2Request("DELETE", key)
