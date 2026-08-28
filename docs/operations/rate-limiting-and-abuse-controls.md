# Rate limiting and abuse controls

ScaleSmiths defends expensive and publicly reachable endpoints in four layers. Each layer has a different job, and no layer is trusted to do another's work.

| Layer | Where | Purpose | Storage |
| --- | --- | --- | --- |
| 1. Edge / proxy | Nginx `limit_req` / `limit_conn` | Absorb brute-force and flood volume before it reaches Node | Nginx shared memory, per instance |
| 2. Application semantic | Web and admin route handlers | Bound meaningful abuse (submissions, sign-ins, writes, outbound email) | PostgreSQL |
| 3. Forge budget | `forge-budget-reservations` | Cap real AI spend per day, project, task and provider | PostgreSQL, serializable |
| 4. Identity-aware | Application limiters | Limit per account *and* per network so neither can be rotated away | PostgreSQL |

## Topology this depends on

`scalesmiths.co.uk` is a **direct** origin and is **not** proxied through Cloudflare. `admin.scalesmiths.co.uk` is behind Cloudflare Access. See [Cloudflare Access and admin origin hardening](cloudflare-access.md).

Consequently the public site has **no edge rate limiting other than Nginx**, which is why layer 1 exists in this repository rather than being delegated to Cloudflare.

## Trusted client identity

Every proxy snippet overwrites `X-Forwarded-For` from the verified peer:

- `nginx/snippets/proxy-public.conf` — direct origin, sets it to `$remote_addr`.
- `nginx/snippets/proxy-admin.conf` — direct origin, sets it to `$remote_addr`.
- `nginx/snippets/proxy-cloudflare-admin.conf` — sets it to `$remote_addr` *after* `real_ip` has validated the Cloudflare peer.

The applications therefore read the **rightmost** `X-Forwarded-For` entry (`web/src/lib/client-ip.ts`, `admin/src/lib/client-ip.ts`), never the leftmost, and never trust `CF-Connecting-IP` directly. A client that sends its own forwarding header cannot change which bucket it lands in.

Addresses are reduced to a bucket before use:

- **IPv4** — the exact address.
- **IPv6** — the **/64 prefix**. A single customer is routinely delegated a /64 or larger, so limiting on the full 128-bit address would let one attacker walk through billions of keys.
- **IPv4-mapped IPv6** (`::ffff:a.b.c.d`) — folded to the IPv4 bucket so one client cannot occupy two.
- Unparsable or absent — a definite `unknown` bucket, so the limit still applies rather than failing open.

Nginx keys on the exact peer address, not the /64. Nginx cannot truncate IPv6 without a regex over `$remote_addr`, and every such regex either misses its compressed renderings or over-aggregates an entire ISP allocation into one bucket — which would lock out uninvolved customers. /64 aggregation is done in the application layer, where the address can be parsed properly.

## Protected routes and limits

### Layer 1 — Nginx (`nginx/snippets/rate-limit-zones.conf`)

Zones are keyed on `$binary_remote_addr`. All refusals answer **429** (`limit_req_status 429`), not Nginx's default 503, and carry `Retry-After: 60`.

| Zone | Rate | Applied to | Burst |
| --- | --- | --- | --- |
| `ss_auth` | 20 r/min | `/portal/api/login`, admin `/api/auth/` | 10 / 20 |
| `ss_quote` | 12 r/min | `/api/quote` | 5 |
| `ss_api` | 300 r/min | public `/api/`, `/portal/api/`, admin `/api/` | 100 |
| `ss_conn` | 40 concurrent | whole server block | — |

Ordinary page traffic (`location /`) is **not** request-rate limited; only the concurrency guard applies, so a normal visitor is never delayed.

### Layer 2 and 4 — application limits

| Route | Limit | Keys | Storage | Status |
| --- | --- | --- | --- | --- |
| Admin sign-in + MFA challenge (`authorize`) | 5 / 10 min | client bucket, email | `login_rate_limits` | credentials rejected |
| Admin MFA activation (`POST /api/security/mfa`) | 10 / 10 min | admin user id | `rate_limit_counters` | 429 + `Retry-After` |
| Admin Forge mutations (`POST/PATCH/DELETE /api/forge/*`) | 30 / min | actor + method + path | `rate_limit_counters` | 429 + `RateLimit-*` |
| Admin Forge task endpoints | 10 / min | actor + method + path | `rate_limit_counters` | 429 + `RateLimit-*` |
| Admin invoice delivery (`send_invoice`, `send_reminder`) | 30 / hour | admin user id | `rate_limit_counters` | 429 + `Retry-After` |
| Portal sign-in (`POST /portal/api/login`) | 5 / 10 min | client bucket, email | `login_rate_limits` | 429 + `RateLimit-*` |
| Quote submission (`POST /api/quote`) | 3 / 10 min | client bucket, email | `quote_rate_limits` | 429 + `RateLimit-*` |
| Analytics ingestion (`POST /api/experience-events`) | 120 / min | client bucket, session id | `web_rate_limits` | 429 + `RateLimit-*` |
| Portal request creation (`POST /portal/api/requests`) | 20 / hour | client bucket, portal client id | `web_rate_limits` | 429 + `RateLimit-*` |

Every key in a set is incremented **before** a verdict is returned. Returning early on the first exceeded key would leave the other buckets un-incremented and let an attacker probe one identity for free.

### Layer 3 — Forge AI budget

`reserveForgeAiBudget` takes a `pg_advisory_xact_lock` inside a `serializable` transaction and evaluates four scopes before any provider call: `daily_global`, `project`, `task` and `provider`. Reservations expire and are reconciled against actual cost. Limits come from `FORGE_AI_DAILY_USD_BUDGET` (default 10), `FORGE_MAX_PROJECT_AI_COST` (default 25), `FORGE_AI_MAX_TASK_USD_BUDGET` and the per-provider budget variable. See [AI budget reservations](ai-budget-reservations.md).

Provider *resilience* (retry with jitter, circuit breakers) is intentionally process-local: it protects a single instance from a failing provider and is not a security control.

## Storage and multi-instance safety

All security-relevant limits are PostgreSQL-backed and therefore correct across replicas. Each counter is incremented with a single atomic `INSERT ... ON CONFLICT DO UPDATE`, so concurrent requests cannot lose a count.

| Table | Owner history | Written by | Pruned by |
| --- | --- | --- | --- |
| `login_rate_limits` | web | web, admin | reset-on-window (no growth) |
| `quote_rate_limits` | web | web | reset-on-window (no growth) |
| `web_rate_limits` | web (`0016_web_rate_limits`) | web | admin worker |
| `rate_limit_counters` | admin | admin | admin worker |

The web PostgreSQL role holds **no `DELETE` privilege on any table**, so expired `web_rate_limits` rows are pruned by the admin worker's cleanup tick, not by the web runtime.

`createMemoryLoginLimiter`, `createMemoryQuoteLimiter` and `checkForgeRateLimit` are **test-only** helpers. No production path uses a process-local limiter. This closes the earlier architecture review's process-local throttling concern.

## HTTP semantics

- Refusals are **429 Too Many Requests**. A throttled sign-in is not a credential failure, so the portal no longer answers 401.
- `Retry-After` is always whole seconds and never `0`.
- `RateLimit-Limit`, `RateLimit-Remaining` and `RateLimit-Reset` accompany application refusals.
- The admin Forge limiter **fails open** on a database error, deliberately: a transient database problem must not lock every admin out. The failure is logged and reported to monitoring as `rate_limit_unavailable`.

## Verifying drift

```sh
# Unit: keying, IPv6 bucketing, header semantics
npm --prefix web run test
npm --prefix admin run test

# Edge: real Nginx, real 429s, anti-spoofing
npm run test:nginx

# Nginx production syntax only (no network)
npm run test:nginx-config
```

To inspect live counters:

```sql
SELECT key, count, reset_at FROM web_rate_limits   WHERE reset_at > now() ORDER BY count DESC LIMIT 20;
SELECT key, count, reset_at FROM login_rate_limits WHERE reset_at > now() ORDER BY count DESC LIMIT 20;
SELECT key, count, expires_at FROM rate_limit_counters WHERE expires_at > now() ORDER BY count DESC LIMIT 20;
```

Keys hold hashed identifiers for the login and quote limiters, so these queries do not expose email addresses.

## Operational override procedure

**Release one locked-out principal.** Preferred: wait for the window (10 minutes for sign-in). To release immediately, delete only that principal's rows:

```sql
-- Portal or admin sign-in. Compute the hash rather than guessing the key.
DELETE FROM login_rate_limits
WHERE key IN (
  'portal-login:id:' || encode(digest(lower(trim('client@example.com')), 'sha256'), 'hex'),
  'admin-login:id:'  || encode(digest(lower(trim('admin@example.com')),  'sha256'), 'hex')
);
```

Run this as the migration or provisioning role: the admin runtime role holds `DELETE` only on its declared lifecycle tables, and the web role holds none. Never widen a runtime grant to perform an override.

**Raise a limit temporarily.** Forge limits are environment-driven and need no code change:

```sh
FORGE_RATE_LIMIT_WINDOW_MS=60000
FORGE_MUTATION_RATE_LIMIT=60
FORGE_TASK_RATE_LIMIT=20
```

Other application limits are declared in code — `web/src/lib/rate-limit-policy.ts`, `LOGIN_RATE_LIMIT_MAX`, `QUOTE_RATE_LIMIT_MAX` — and change through a normal reviewed release. That is deliberate: a security limit should not be silently adjustable from the environment.

**Relax the edge during an incident.** Edit the rate in `nginx/snippets/rate-limit-zones.conf`, then:

```sh
sudo nginx -t && sudo systemctl reload nginx
```

`reload` is graceful and does not drop connections. To disable one zone without a config edit, raise its rate rather than removing `limit_req`, so the directive stays present and reviewable.

**If you suspect the limits themselves are the incident** (legitimate users locked out): raise the edge rate first, confirm recovery, and only then investigate whether an application limit or a keying change is responsible. Record which zone or table was involved in the incident notes.

## Remaining infrastructure configuration (external)

These are not in the repository and must be applied in the provider consoles:

1. **Cloudflare for the public site.** The public origin is currently unproxied, so it has no DDoS or bot protection ahead of Nginx. Proxying `scalesmiths.co.uk` would add Cloudflare rate limiting, Bot Fight Mode and challenge pages. This is an operational change: it requires `real_ip` configuration on the public server block (mirroring `proxy-cloudflare-admin.conf`) and a re-test of the anti-spoofing assertions before the origin firewall is narrowed.
2. **Cloudflare rate-limiting rules for admin.** Access already gates identity; a rule on `/api/auth/*` adds a challenge before Nginx.
3. **Provider firewall.** Restrict origin 80/443 to current Cloudflare ranges only if the public site is also proxied — see the warning in [Cloudflare Access](cloudflare-access.md).
4. **Alerting.** Alert on sustained 429 volume and on the `rate_limit_unavailable` monitoring category, which indicates the Forge limiter is failing open.
