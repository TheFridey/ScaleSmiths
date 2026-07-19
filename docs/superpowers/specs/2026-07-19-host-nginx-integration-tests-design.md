# Host-Nginx production topology integration tests

Date: 2026-07-19
Status: Approved for implementation

## Goal

Make the host-Nginx production routing topology **executable, testable, and CI-gated** without
requiring real production certificates or Cloudflare network access.

Authoritative production routing:

- `scalesmiths.co.uk` -> public web application
- `www.scalesmiths.co.uk` -> 301 redirect to the canonical `https://scalesmiths.co.uk` origin
- `admin.scalesmiths.co.uk` -> admin application
- Repository root on the VPS: `/var/www/scalesmiths/ScaleSmiths`

The authoritative config file is `nginx/host-scalesmiths.conf` (the host-installed
`sites-available` config that includes `upstreams.conf` and terminates TLS with Let's Encrypt
certificates). The in-compose `nginx/nginx.conf` is a separate containerized variant and is out of
scope here.

## Constraints

- No real certificates. The disposable harness generates a self-signed cert at image build time.
- No production network / no Cloudflare access. Cloudflare trust is simulated with container IPs.
- Must run identically on Windows dev machines and Linux CI (everything runs inside Docker; the
  assertion suite runs in a `tester` container on the compose network, never on the host network).
- The VPS already serves other sites, so production must **not** gain a global `default_server`
  catch-all that could swallow requests destined for co-hosted vhosts.

## Design

### 1. Shared-snippet refactor (drift reduction)

Extract the cert-independent, upstream-independent directives from `host-scalesmiths.conf` into
`nginx/snippets/`, included by **both** the production config and the derived test config:

- `connection-upgrade-map.conf` — `map $http_upgrade $connection_upgrade`
- `security-headers.conf` — HSTS, `X-Frame-Options`, `X-Content-Type-Options`
- `proxy-public.conf` — proxy pass + forwarding headers for the public app (appends the
  `X-Forwarded-For` chain via `$proxy_add_x_forwarded_for`)
- `proxy-admin.conf` — admin variant: **overwrites** `X-Forwarded-For` with `$remote_addr` (drops
  any client-supplied chain at a direct origin) and sets `X-Forwarded-Host`
- `body-size.conf` — `client_max_body_size` (new hardening)
- `hardening-locations.conf` — `error_page` handling and an explicit
  `location ^~ /generated-sites` -> `404` on the public app (new hardening)

`host-scalesmiths.conf` is edited to `include` these snippets and to apply the body-size,
error-page, and generated-sites hardening **scoped to its own server blocks**. Certificate paths and
`listen 443 ssl` stay in the production file only. `nginx -t` must still pass.

The `proxy-public.conf` upstream target is parameterised so the same snippet resolves to the
production `scalesmiths_web` / `scalesmiths_admin` upstreams and, in the harness, to the mock
upstream service names.

### 2. Disposable Docker harness (`tests/nginx/`)

- `Dockerfile.nginx` — official `nginx`, generates a self-signed cert for `*.scalesmiths.co.uk` at
  build. Loads `host-scalesmiths.test.conf`, which `include`s the same `nginx/snippets/*` plus
  test-only pieces: test upstreams pointing at the mock services, self-signed cert paths, and the
  **harness-only** `server { listen 443 default_server; return 444; }` catch-all.
- `mock-upstream/server.mjs` — one tiny Node HTTP server reused for web and admin. Echoes back
  `Host`, `X-Forwarded-*`, `X-Real-IP`, `Upgrade`/`Connection`, and `CF-Connecting-IP` as JSON,
  serves `GET /api/health` -> `200`, and returns an identity marker (`APP=web` / `APP=admin`) so a
  misroute is detectable by assertion.
- `edge-cloudflare/` — an nginx "edge" container assigned a **static IP inside the trusted CIDR**
  that injects `CF-Connecting-IP` and proxies to the real nginx (a trusted Cloudflare origin). The
  `tester` hitting nginx directly is an untrusted source.
- `tester` — runs the `node --test` assertion suite against compose service names on a user-defined
  bridge with static IPs, giving deterministic source IPs on both Windows and Linux.

### 3. Assertions (`tests/nginx/nginx-request.test.mjs`)

- `nginx -t` config syntax validation
- public routing -> web mock; `www.` -> 301 to the canonical `https://scalesmiths.co.uk`
- admin subdomain -> admin mock
- HTTP -> HTTPS 301 using the self-signed test certs
- security headers present on public and admin responses
- forwarded host/proto: public **appends** the XFF chain; admin **overwrites** it with the peer
- body-size limit -> oversized body rejected (`413`)
- health endpoints -> `200`
- websocket/upgrade headers forwarded to the upstream
- error-page behaviour (upstream down -> controlled `502`, not a raw upstream error)
- **generated-sites not served publicly** -> `/generated-sites/...` on the public host -> `404`
- **unknown host rejected** -> unknown `Host` -> `444` via the harness `default_server`, proving the
  scalesmiths server blocks use exact `server_name` matching and never greedily catch unknown hosts
- **Cloudflare trust:** through the trusted edge, a spoofed `CF-Connecting-IP` is honoured
  (real_ip); direct/untrusted, `CF-Connecting-IP` is ignored and the origin-peer geo check -> `444`
- **admin isolation:** an `admin.scalesmiths.co.uk` request never reaches the web mock (identity
  marker assertion) — a misroute fails CI
- **`/admin` on the public host** is served by the web mock and is **not** treated as the production
  admin application (no proxy to the admin upstream)

### 4. CI wiring

A new `nginx` job in `.github/workflows/ci.yml` plus root `package.json` scripts:

- `test:nginx-config` — syntax check of the production config
- `test:nginx` — full harness via `scripts/run-nginx-tests.mjs`, which mirrors
  `run-admin-integration-tests.mjs`: `compose up --build --wait` -> `compose run --rm tester` ->
  `compose down -v` in a `finally` block.

### 5. Documentation

`docs/operations/nginx-testing.md`: how to run the harness locally, and a pre-reload production
checklist (`nginx -t` against the real installed file before `systemctl reload nginx`).

## Acceptance criteria

- Routing and headers are executable `node --test` assertions, not documentation alone.
- No real certificate or production network is required.
- Misrouting the admin subdomain fails CI (admin-isolation and `/admin`-on-public assertions).
