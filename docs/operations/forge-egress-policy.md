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
  address is private, loopback, link-local, multicast, reserved, unspecified,
  CGNAT, or cloud-metadata (`169.254.169.254` and its IPv6-mapped forms);
- **pins** one validated address onto an undici dispatcher whose custom `lookup`
  can only return that address, so DNS cannot rebind the socket between
  validation and connection — validation and the connection use the same address;
- preserves TLS: the original hostname stays the TLS servername and `Host`, so
  certificate verification is unchanged and **never disabled**;
- enforces response-size, timeout and redirect-count limits.

The address classifier (`admin/src/lib/server/address-safety.ts`) is pure and
exhaustively unit-tested; rebinding and unsafe-redirect behaviour is covered by
`safe-outbound.test.ts`.

This layer travels with the code and protects every environment, including local
development where no network egress controls exist.

## Layer two: production network egress controls (defence in depth)

The admin container should not be able to reach internal networks or the cloud
metadata endpoint even if a future code path bypassed the client. Apply the
strongest control your platform supports:

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
the proxy is additive, not a replacement.

## What is intentionally allowed

- Public IPv4/IPv6 destinations on ports 80/443.
- Documentation ranges (RFC 5737 / RFC 3849) are treated as safe by the
  classifier: they are not internal and are used as public stand-ins in tests.

## Failure visibility

Crawl failures are returned to Forge in the site-inventory `failures` array and,
for autofill, cause the page to be skipped. Messages are generic and never
contain a resolved internal address; security blocks additionally emit a concise
server log keyed by host and a stable reason code (never an IP).
