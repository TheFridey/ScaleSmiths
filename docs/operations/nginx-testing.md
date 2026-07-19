# Testing and validating the host-Nginx topology

The host-Nginx production routing (`scalesmiths.co.uk` -> web, `www` -> canonical
apex, `admin.scalesmiths.co.uk` -> admin) is covered by an executable, disposable
Docker harness so routing, headers and Cloudflare trust are tested, not just
documented. Nothing here needs a real certificate, Cloudflare access, or the
production network.

## What is tested

The assertion suite (`tests/nginx/nginx-request.test.mjs`) drives a real Nginx
container built from the **same shared snippets** production uses
(`nginx/snippets/*`, included by `nginx/host-scalesmiths.conf`). It asserts:

- production config syntax (`nginx -t`)
- public-domain routing and `www` -> apex canonicalisation
- admin-subdomain routing
- HTTP -> HTTPS redirects
- security headers (HSTS, `X-Frame-Options`, `X-Content-Type-Options`)
- forwarded host/proto handling — public **appends** the `X-Forwarded-For` chain,
  admin **overwrites** it (a client-supplied chain is never trusted at the admin)
- body-size limits (oversized request -> `413`)
- health endpoints (`/api/health` -> `200`)
- websocket/upgrade header forwarding
- controlled upstream-error page (no raw upstream error leaks)
- generated marketing sites are never served from the public origin
- unknown hosts are rejected
- **Cloudflare trust:** `CF-Connecting-IP` is honoured only from a verified edge;
  an arbitrary origin cannot spoof it (origin-peer check drops it)
- **admin isolation:** an `admin.scalesmiths.co.uk` request never reaches the web
  app, and `/admin` on the public domain is a plain web path — not the production
  admin application

### How the harness stays honest

Everything runs inside one bridge network with fixed addresses
(`docker-compose.nginx-test.yml`), so source-IP-based Cloudflare trust is
deterministic on both Windows and Linux CI:

- `web-mock` / `admin-mock` — one tiny Node server (`tests/nginx/mock-upstream`)
  that reflects the headers Nginx forwarded and carries an identity marker
  (`x-mock-app`), so a misroute is detectable.
- `nginx` — built from `tests/nginx/Dockerfile.nginx`: the production snippets, a
  self-signed cert generated at build, test upstreams pointing at the mocks, and a
  **harness-only** `default_server` returning `444` (production omits this so it
  stays a polite neighbour on the shared VPS).
- `edge` — a simulated trusted Cloudflare origin at a fixed IP inside the trusted
  CIDR; the tester hitting Nginx directly is the untrusted path.

## Running the tests locally

Requires Docker with Compose v2.

```sh
# Validate the real production config syntax (fast; builds a throwaway image with
# stub certs and runs `nginx -t`). Fails the build on any syntax/snippet error.
npm run test:nginx-config

# Full topology integration suite. Builds the harness, waits for health, runs the
# request assertions inside the tester container, then tears everything down.
npm run test:nginx
```

`npm run test:nginx` always cleans up its containers, network and volumes, even on
failure. To iterate on the harness manually:

```sh
docker compose -p scalesmiths-nginx-test -f docker-compose.nginx-test.yml up -d --build --wait
docker compose -p scalesmiths-nginx-test -f docker-compose.nginx-test.yml run --rm tester
docker compose -p scalesmiths-nginx-test -f docker-compose.nginx-test.yml down -v
```

## Validating production Nginx before a reload

The harness proves the committed config is internally correct. On the VPS, before
reloading, validate the **installed** files against the real certs and upstreams:

1. Ensure the shared snippets are installed alongside the upstreams include:

   ```sh
   install -d /etc/nginx/scalesmiths/snippets
   cp /var/www/scalesmiths/ScaleSmiths/nginx/snippets/*.conf /etc/nginx/scalesmiths/snippets/
   ```

2. Syntax-check everything Nginx will actually load:

   ```sh
   sudo nginx -t
   ```

3. Only if that passes, reload without dropping connections:

   ```sh
   sudo systemctl reload nginx
   ```

If `nginx -t` fails, do **not** reload — a reload with a broken config leaves the
running master serving the last good config, but a subsequent restart would fail.
Fix the reported file/line first.

## CI

The `nginx` job in `.github/workflows/ci.yml` runs `test:nginx-config` then
`test:nginx` on every push and pull request. Misrouting the admin subdomain (or
treating `/admin` on the public domain as the admin app) fails these assertions
and therefore fails CI.
