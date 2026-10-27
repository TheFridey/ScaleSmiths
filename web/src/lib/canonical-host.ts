/**
 * Public hostname canonicalisation.
 *
 * `https://scalesmiths.co.uk` is the only indexable origin. `www` is an alias:
 * HTTP already redirects, but HTTPS www was still served as 200, so browsers
 * kept a second cookie jar and a second enquiry-attribution store.
 */

export const CANONICAL_PUBLIC_ORIGIN = "https://scalesmiths.co.uk"
export const WWW_ALIAS_HOSTNAME = "www.scalesmiths.co.uk"

export function canonicalWwwRedirectUrl(hostHeader: string | null | undefined, url: URL): URL | null {
  const hostname = hostnameFromHostHeader(hostHeader) ?? hostnameFromHostHeader(url.host)
  if (hostname !== WWW_ALIAS_HOSTNAME) return null
  // Assign path and query on a fixed origin. Building the URL from a raw
  // path string would treat `//host` or `/\host` as a different origin.
  const destination = new URL(CANONICAL_PUBLIC_ORIGIN)
  destination.pathname = url.pathname || "/"
  destination.search = url.search
  if (destination.hostname !== "scalesmiths.co.uk") return null
  return destination
}

function hostnameFromHostHeader(value: string | null | undefined) {
  const host = value?.split(",")[0]?.trim()
  if (!host) return null
  return hostnameOf(host).toLowerCase()
}

function hostnameOf(host: string) {
  if (host.startsWith("[")) {
    const end = host.indexOf("]")
    return end === -1 ? host : host.slice(1, end)
  }
  const separator = host.lastIndexOf(":")
  if (separator > 0 && /^\d+$/.test(host.slice(separator + 1))) return host.slice(0, separator)
  return host
}
