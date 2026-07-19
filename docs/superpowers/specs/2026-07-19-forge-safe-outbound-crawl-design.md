# Forge safe outbound HTTP client (SSRF / DNS-rebinding hardening)

Date: 2026-07-19
Status: Approved for implementation

## Problem

Two Forge features fetch attacker-influenced URLs from the admin server process:

- `admin/src/lib/server/forge-site-crawler.ts` (`crawlForgeExistingSite`)
- `admin/src/lib/server/forge-url-autofill.ts` (`generateForgeUrlAutofill`)

Both validate the target with a DNS lookup and then call the global `fetch`,
**which performs its own independent DNS resolution**. Between validation and the
real connection the name can rebind to a private/metadata address (TOCTOU / DNS
rebinding). The validated address is never pinned to the socket. Additional gaps:
no port restriction, incomplete IP classification (IPv6 link-local ranges,
reserved/metadata forms), duplicated and drifting logic across the two modules.

## Goal

One shared, reviewed safe outbound client that every Forge-controlled crawl uses,
where **validation and the actual connection use the same approved IP**, TLS
hostname verification stays intact, and redirects are independently revalidated.

## Approach

Add `undici` as a direct admin dependency (pinned, governance-consistent) and use
an `Agent` with a custom `connect.lookup` that returns only the pre-validated
pinned address. undici keeps the TLS `servername` and `Host` from the original
hostname, so certificate verification is unchanged and we never disable TLS.

### Module: `admin/src/lib/server/safe-outbound.ts`

`safeFetch(rawUrl, options)` performs, for the initial request **and every
redirect hop independently**:

1. **Parse & validate URL**
   - scheme is `http:`/`https:` only
   - reject any userinfo (credentials) in the URL
   - normalise hostname (WHATWG parser already lower-cases, applies IDNA
     punycode, and canonicalises IPv4 decimal/octal/hex and IPv6 literals; we
     additionally strip a single trailing dot for classification/allowlist)
   - restrict ports to 80/443 (and the scheme default)
2. **Resolve** — if the host is an IP literal, classify it directly; otherwise
   resolve **all A and AAAA** records (`dns.resolve4` + `dns.resolve6`).
3. **Classify** every address with the shared `address-safety` classifier:
   reject when the set is empty, when **any** address is unsafe (this is the
   mixed safe/unsafe rejection), covering private, loopback, link-local,
   multicast, reserved, unspecified, and cloud-metadata (169.254.169.254 and
   IPv6-mapped equivalents) ranges.
4. **Pin** one validated address and build a per-hop undici `Agent` whose
   `connect.lookup` always returns that address. The socket therefore cannot go
   anywhere else, even if DNS rebinds.
5. **Fetch** with `redirect: "manual"`, the pinned dispatcher, an `AbortController`
   timeout, and a bounded body reader (stream, aborting past the byte limit;
   also honour a sane `content-length`). Enforce the redirect count; on a 3xx,
   resolve `Location` against the current URL and repeat from step 1 with a fresh
   agent.

Returns a small typed result (`{ status, headers, url: finalUrl, body }`) plus a
`SafeOutboundError` with a stable, **non-leaky** `code` (e.g. `blocked_address`,
`disallowed_scheme`, `credentials_in_url`, `disallowed_port`, `redirect_limit`,
`response_too_large`, `timeout`, `dns_failure`) — the message never contains the
resolved internal IP.

### Module: `admin/src/lib/server/address-safety.ts`

Pure, exhaustively unit-tested `classifyAddress(address)` →
`"safe" | "unsafe"` (with reason), plus `isForbiddenAddress`. Handles IPv4, IPv6,
IPv4-mapped IPv6 (`::ffff:a.b.c.d` and hex form), and the full private/reserved
range table. No network, fully deterministic.

## Refactors

- `forge-site-crawler.ts`: replace `fetchBounded` + `assertSafePublicUrl`
  internals with `safeFetch`; keep the crawler's allowlist-domain check, robots
  handling, page extraction and failure taxonomy. Public exports used by tests
  are preserved or re-pointed at the shared classifier.
- `forge-url-autofill.ts`: replace `fetchWithRedirects` + `assertPublicUrl` /
  `isPrivateIp` with `safeFetch`.

## Failure handling (task 7)

Crawl failures resolve to a safe, user-facing category/message (no internal IPs,
no resolver output). A single server-side `console.warn`/structured log records
the sanitized reason and the requested URL host for Forge visibility, but never
the pinned internal address. The API route keeps returning a generic message.

## Testing (task 5)

`admin/src/lib/server/address-safety.test.ts` — table-driven classifier tests:
IPv4/IPv6, mapped, decimal/octal/hex literals (normalised by the URL parser),
metadata, all reserved ranges, mixed sets.

`admin/src/lib/server/safe-outbound.test.ts` — deterministic, using a controlled
DNS resolver stub and a real loopback HTTP fixture server:
- rebinding: resolver returns a public IP at validation but the pinned socket is
  proven to hit only the validated address (a rebind to loopback cannot connect)
- redirect to metadata/private host is rejected on the redirect hop
- credential URLs, disallowed schemes/ports, oversized bodies, timeouts, redirect
  limits
- trailing-dot and mixed safe/unsafe answer sets

## Egress policy docs (task 6)

`docs/operations/forge-egress-policy.md`: defence-in-depth for production — the
in-process pinning client is layer one; layer two is Docker/network egress
controls (block RFC1918 + 169.254.169.254 from the admin container, or an
allowlisting proxy), plus IMDSv2 / hop-limit guidance for cloud metadata.

## Acceptance criteria

- Validation and connection use the same approved address (pinned dispatcher).
- Rebinding and unsafe redirects are covered by deterministic tests.
- TLS verification remains intact (no `rejectUnauthorized: false`, servername
  preserved).
