# Forge outbound egress policy

Forge fetches attacker-influenced URLs on the server when it crawls an existing
site (`forge-site-crawler`) and when it autofills a project brief from a URL
(`forge-url-autofill`). Both go through one shared, reviewed client
(`admin/src/lib/server/safe-outbound.ts`). This document describes the layered
egress controls: the in-process client is layer one; production network controls
are layer two.

## Layer one: the in-process safe client (always on)

`createSafeOutboundClient()` is the only sanctioned way for Forge to make outbound
HTTP requests. For the initial request and **every redirect hop independently**
it:

- allows only `http`/`https` and rejects credentials in the URL;
- restricts ports to the scheme default (80 / 443);
- normalises the hostname (the URL parser applies IDNA punycode and canonicalises
  IPv4 decimal/octal/hex and IPv6 literals; a trailing dot is stripped);
- resolves **all** A and AAAA records and rejects the whole answer set if **any**
  address is private, loopback, link-local, unique-local, multicast, reserved,
  unspecified, CGNAT, or cloud-metadata (`169.254.169.254`, `fd00:ec2::254`, and
  IPv4-mapped / NAT64 forms);
- **binds TCP to one validated address** via an undici connector: the socket is
  opened to that IP, a custom `lookup` can only return that IP, and Happy
  Eyeballs is disabled so a second family cannot be chosen;
- **revalidates the connected socket**: `remoteAddress` must match the pin
  (IPv4-mapped IPv6 is treated as the embedded IPv4) and must not be a
  forbidden range; mismatch destroys the socket before request bytes are written;
- preserves TLS: the original hostname stays the TLS `servername` and `Host`, so
  certificate verification is unchanged and **never disabled**;
- uses undici's own `fetch` with the pinned dispatcher so validation and the
  HTTP stack are the same library copy;
- enforces response-size, timeout and redirect-count limits.

The address classifier (`admin/src/lib/server/address-safety.ts`) is pure and
exhaustively unit-tested. Deterministic rebinding and unsafe-redirect tests in
`safe-outbound.test.ts` execute the production fetch boundary (real sockets,
production dispatcher, a system-resolver rebind to loopback/metadata).

This layer travels with the code and protects every environment, including local
development where no network egress controls exist.

## Layer two: production network egress controls (defence in depth)

The admin container should not be able to reach internal networks or the cloud
metadata endpoint even if a future code path bypassed the client. Apply the
strongest control your platform supports. Layer two is operator-owned; the
in-process client does not replace it.

### Cloud metadata

- Prefer IMDSv2 and set the metadata hop limit to 1 so containers cannot reach
  `169.254.169.254` (AWS: `--http-put-response-hop-limit 1`, `--http-tokens
  required`; GCP/Azure: equivalent metadata-server hardening).
- Where the workload does not need instance metadata at all, block
  `169.254.169.254` and `fd00:ec2::254` outright.

### Egress firewall / Docker networking

The admin service is defined in `docker-compose.host-nginx.yml`. Constrain its
egress so it can reach the public internet but not RFC1918 / link-local ranges:

- Drop egress from the admin container to `10.0.0.0/8`, `172.16.0.0/12`,
  `192.168.0.0/16`, `100.64.0.0/10`, `169.254.0.0/16`, `127.0.0.0/8`, and the
  IPv6 equivalents (`::1/128`, `fc00::/7`, `fe80::/10`), except the specific
  loopback ports Nginx and PostgreSQL require.
- Example host firewall rule (adjust the container subnet):

  ```sh
  # Block the admin container from private ranges (metadata included).
  iptables -I DOCKER-USER -s <admin-container-subnet> -d 169.254.0.0/16 -j DROP
  iptables -I DOCKER-USER -s <admin-container-subnet> -d 10.0.0.0/8       -j DROP
  iptables -I DOCKER-USER -s <admin-container-subnet> -d 172.16.0.0/12    -j DROP
  iptables -I DOCKER-USER -s <admin-container-subnet> -d 192.168.0.0/16   -j DROP
  ```

  Keep the admin↔PostgreSQL and admin↔Nginx loopback paths on the dedicated
  Compose network (`ss-net`) so these DROP rules do not affect them.

### Optional: allowlisting forward proxy

For the strongest posture, route Forge egress through an outbound proxy that
allowlists destinations and re-checks DNS. The in-process client still applies —
the proxy is additive, not a replacement. If a proxy is configured, it must fail
closed on resolver errors and must not forward to private, loopback, link-local,
or metadata destinations.

## What is intentionally allowed

- Public IPv4/IPv6 destinations on ports 80/443.
- Documentation ranges (RFC 5737 / RFC 3849) are treated as safe by the
  classifier: they are not internal and are used as public stand-ins in tests.

## Safe failure behaviour

The client is fail-closed. Any ambiguous or hostile answer is a denial, not a
best-effort fetch:

| Condition | Result | Caller-visible `code` |
| --- | --- | --- |
| Invalid URL, credentials, non-http(s), disallowed port | No DNS, no connect | `invalid_url` / `credentials_in_url` / `disallowed_scheme` / `disallowed_port` |
| Resolver error or empty answer set | No connect | `dns_failure` |
| Any A/AAAA record is private, loopback, link-local, unique-local, metadata, or otherwise forbidden | No connect; mixed safe/unsafe sets are treated as hostile | `blocked_address` |
| Redirect `Location` missing, invalid, over limit, or independently forbidden | Hop aborted; later hops never start | `redirect_no_location` / `invalid_url` / `redirect_limit` / `blocked_address` |
| Connected `remoteAddress` missing, mismatched, or forbidden | Socket destroyed before request bytes | `blocked_address` (or `request_failed` if the HTTP stack wraps the error) |
| TLS certificate mismatch or untrusted issuer | Handshake aborted; verification is never disabled | `request_failed` |
| Timeout, connect failure, or other transport error | Generic failure; no internal address is returned | `timeout` / `request_failed` |
| Response over the byte limit | Stream aborted | `response_too_large` |

Messages never contain a resolved internal address or resolver output. A
policy denial does not fall back to the global `fetch`, to an unpinned
dispatcher, or to a different address from the same DNS answer.

Crawl failures are returned to Forge in the site-inventory `failures` array and,
for autofill, cause the page to be skipped. Security blocks may also emit a
concise server log keyed by host and a stable reason code (never an IP).
