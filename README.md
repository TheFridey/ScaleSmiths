# ScaleSmiths

Strategy-led web development agency. Two Next.js apps, one Docker Compose stack.

The audited implementation map is maintained in `docs/architecture/`:

- [System overview](docs/architecture/system-overview.md)
- [Forge workflow](docs/architecture/forge-workflow.md)
- [Security boundaries](docs/architecture/security-boundaries.md)
- [Deployment topology](docs/architecture/deployment-topology.md)
- [Data model](docs/architecture/data-model.md)
- [Admin RBAC policy](docs/architecture/rbac-policy.md)
- [Admin MFA operations](docs/operations/admin-mfa.md)

| App | Local | Production |
|-----|-------|-----------|
| Public site | `localhost:3000` | `scalesmiths.co.uk` |
| Admin panel | `localhost:3001` | `admin.scalesmiths.co.uk` |

---

## Quickstart — npm (local dev, no Docker)

```bash
# Copy env
cp .env.example .env
# edit .env with your values

# Web (terminal 1)
cd web && npm install && npm run dev

# Admin (terminal 2)
cd admin && npm install && npm run dev
```

Site:  http://localhost:3000
Admin: http://localhost:3001  →  http://localhost:3001/login

Default admin credentials (set in .env):
- `ADMIN_EMAIL=admin@scalesmiths.co.uk`
- `ADMIN_PASSWORD=changeme`

---

## Quickstart — Docker (full stack)

```bash
cp .env.example .env
# edit .env

# Dev (with hot reload)
docker-compose -f docker-compose.dev.yml up

# Production build
docker-compose up --build -d
```

---

## Production Deployment (container-owned Nginx)

1. **Copy files to VPS**
   ```bash
   rsync -avz --exclude node_modules --exclude .next . user@yourserver:/srv/scalesmiths
   ```

2. **SSL certs** (if not already set up with Let's Encrypt)
   ```bash
   sudo certbot certonly --nginx -d scalesmiths.co.uk -d www.scalesmiths.co.uk
   sudo certbot certonly --nginx -d admin.scalesmiths.co.uk
   # Optional only if Forge will use its own hostname:
   sudo certbot certonly --nginx -d forge.scalesmiths.co.uk
   ```

3. **Prepare Forge workspace storage**
   ```bash
   cd /srv/scalesmiths
   mkdir -p generated-sites
   sudo chown -R 1001:1001 generated-sites
   chmod 750 generated-sites
   ```

4. **Start**
   ```bash
   cd /srv/scalesmiths
   cp .env.example .env && nano .env
   docker-compose up --build -d
   ```

5. **Check**
   ```bash
   docker-compose ps
   docker-compose logs -f web
   docker-compose logs -f admin
   ```

The nginx container handles SSL termination and proxies to the app containers.
Use this only when nothing else on the server already owns ports 80 and 443.

## Production Deployment (existing VPS + host Nginx)

Use this path when the VPS already serves another site, such as VeteranFinder,
on ports 80 and 443. In this setup, Docker runs the ScaleSmiths apps and
database, while the existing host Nginx routes requests by `server_name`.

1. **Copy files to VPS**
   ```bash
   rsync -avz --exclude node_modules --exclude .next --exclude .env . user@yourserver:/srv/scalesmiths
   ```

2. **Create production env on the VPS**
   ```bash
   cd /srv/scalesmiths
   cp .env.example .env
   nano .env
   ```

   Required production differences from local dev:
   - `NEXT_PUBLIC_SITE_URL=https://scalesmiths.co.uk`
   - `NEXT_PUBLIC_ADMIN_URL=https://admin.scalesmiths.co.uk`
   - `DEMO_PORTAL_ENABLED=false`
   - `ADMIN_PASSWORD` should be a bcrypt hash
   - `POSTGRES_PASSWORD`, `AUTH_SECRET`, and `PORTAL_SECRET` should be fresh production secrets
   - `RESEND_API_KEY` and `RESEND_FROM` must be set before quote traffic is accepted
   - Forge should stay at `https://admin.scalesmiths.co.uk/forge` unless a separate hostname is intentionally configured
   - Set `FORGE_ENABLE_AI=true` only when the AI provider keys are present and spend has been reviewed

3. **Prepare Forge workspace storage**
   ```bash
   mkdir -p generated-sites
   sudo chown -R 1001:1001 generated-sites
   chmod 750 generated-sites
   ```

   The admin Docker image runs as UID/GID `1001`. Forge generated client-site workspaces are bind-mounted from `./generated-sites` to `/app/generated-sites`, so this directory must be writable by that container user and must not be served directly by Nginx.

4. **Start Postgres and run migrations**
   ```bash
   docker compose -f docker-compose.host-nginx.yml up -d postgres
   docker compose -f docker-compose.host-nginx.yml run --rm web-migrate
   docker compose -f docker-compose.host-nginx.yml run --rm admin-migrate
   ```

5. **Start the app containers on localhost-only ports**
   ```bash
   docker compose -f docker-compose.host-nginx.yml up --build -d web admin
   ```

   This binds:
   - public site: `127.0.0.1:3100`
   - admin: `127.0.0.1:3101`

6. **Install the temporary HTTP host Nginx site**
   ```bash
   sudo cp nginx/host-scalesmiths-http.conf /etc/nginx/sites-available/scalesmiths
   sudo ln -s /etc/nginx/sites-available/scalesmiths /etc/nginx/sites-enabled/scalesmiths
   sudo nginx -t
   sudo systemctl reload nginx
   ```

7. **Issue SSL certificates**
   ```bash
   sudo certbot --nginx -d scalesmiths.co.uk -d www.scalesmiths.co.uk
   sudo certbot --nginx -d admin.scalesmiths.co.uk
   # Optional only if using a dedicated Forge hostname:
   sudo certbot --nginx -d forge.scalesmiths.co.uk
   ```

8. **Switch to the final HTTPS config**
   ```bash
   sudo cp nginx/host-scalesmiths.conf /etc/nginx/sites-available/scalesmiths
   sudo nginx -t
   sudo systemctl reload nginx
   ```

   If `forge.scalesmiths.co.uk` is required, use `nginx/forge-admin-subdomain.example.conf` as a reviewed starting point and proxy it to the same admin container on `127.0.0.1:3101`. Do not enable that hostname until DNS and certificates are ready.


---

## Forge VPS Deployment Preparation

Recommended target: keep Forge under `https://admin.scalesmiths.co.uk/forge`. The existing admin app already protects `/forge` with Auth.js admin auth and avoids introducing another public service. Use `forge.scalesmiths.co.uk` only as an optional hostname that proxies to the same admin container.

Forge production env is configured in the root `.env` used by Docker Compose:

- `FORGE_ENABLE_AI=false` by default; set to `true` only after provider keys and spend limits are ready
- `FORGE_DEFAULT_AI_PROVIDER=mock`, `openai`, or `anthropic`
- `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` stay server-only and must never be prefixed with `NEXT_PUBLIC_`
- `FORGE_AI_MAX_TOKENS_PER_TASK`, `FORGE_AI_DAILY_TOKEN_BUDGET`, and `FORGE_AI_DAILY_USD_BUDGET` provide fail-closed live AI budget controls before provider calls are made
- `FORGE_MAX_REPAIR_ATTEMPTS=3` unless a tighter repair loop is desired
- `RESEND_API_KEY` is needed for generated client-site contact forms
- `FORGE_MIN_LIGHTHOUSE_PERFORMANCE`, `FORGE_MIN_LIGHTHOUSE_ACCESSIBILITY`, and `FORGE_MIN_LIGHTHOUSE_SEO` control generated-site QA thresholds
- `FORGE_SANDBOX_RUNNER=local` by default; set `FORGE_SANDBOX_RUNNER=docker` on a VPS once Docker is available for generated-site preview/QA isolation
- `FORGE_SANDBOX_CPUS`, `FORGE_SANDBOX_MEMORY`, `FORGE_SANDBOX_NETWORK`, `FORGE_SANDBOX_INSTALL_NETWORK`, and `FORGE_SANDBOX_PREVIEW_NETWORK` control generated-site sandbox limits
- `FORGE_ARTIFACT_MAX_VERSIONS`, `FORGE_ARTIFACT_MAX_CONTENT_BYTES`, and `FORGE_QA_LOG_MAX_CHARS` control retained artifact history and large QA log size

Migration order for a VPS deploy:

```bash
docker compose -f docker-compose.host-nginx.yml up -d postgres
docker compose -f docker-compose.host-nginx.yml run --rm web-migrate
docker compose -f docker-compose.host-nginx.yml run --rm admin-migrate
docker compose -f docker-compose.host-nginx.yml up --build -d web admin
```

For container-owned Nginx, use the same migration order with the default compose file, or run app migrations from a one-off shell before bringing the full stack up. Forge database tables live in the admin migrations.

Workspace storage:

- `generated-sites/` is ignored except for `generated-sites/.gitignore`.
- Production compose files bind-mount `./generated-sites` into the admin container at `/app/generated-sites`.
- The directory should be owned by UID/GID `1001`, matching the admin container's `nextjs` user.
- Keep permissions restrictive, for example `chmod 750 generated-sites`.
- Do not point Nginx at `generated-sites/`; previews must stay behind the admin Forge UI.
- Include `generated-sites/` in VPS backup planning if generated project work should survive a server rebuild.
- For production Forge QA/preview, prefer `FORGE_SANDBOX_RUNNER=docker`. Docker commands run with a secret-free environment, CPU/memory limits, dropped Linux capabilities, `no-new-privileges`, and restricted network mode.
- Keep `FORGE_SANDBOX_NETWORK=none` for typecheck/lint/build. `FORGE_SANDBOX_INSTALL_NETWORK=none` is safest and requires dependencies to be preinstalled or cached; set it to `bridge` only for a controlled install window.
- Docker previews publish only to the configured preview host, which should stay `127.0.0.1` unless a private preview network has been reviewed.

Nginx routing:

- Existing deployment routes `admin.scalesmiths.co.uk` to the admin app. Forge works at `/forge` with no extra Nginx route.
- Optional `forge.scalesmiths.co.uk` should proxy to the same admin container, not to generated workspaces. Review `nginx/forge-admin-subdomain.example.conf` before enabling it.
- Keep admin and Forge behind HTTPS and consider uncommenting the IP allowlist in the Nginx admin server block.
- If using Cloudflare, orange-cloud the admin/Forge hostname, enable WAF or Access policies, and optionally restrict origin traffic to Cloudflare IPs at Nginx.

Process management:

- The current VPS path uses Docker Compose with `restart: unless-stopped`; PM2 is not used.
- Host Nginx is managed by systemd, so config changes should be followed by `sudo nginx -t` and `sudo systemctl reload nginx`.
- Docker itself is systemd-managed on most VPS images. Confirm it starts on boot with `sudo systemctl enable docker`.

Private access recommendations:

- Keep `ADMIN_EMAIL` private and store `ADMIN_PASSWORD` as a bcrypt hash.
- Do not add public signup to the admin app.
- Keep `FORGE_ALLOW_PUBLIC_PREVIEWS=false` unless a private preview network is deliberately designed.
- Prefer `admin.scalesmiths.co.uk/forge` plus admin auth for V1.
- Add an IP allowlist or Cloudflare Access if Forge will handle real client data or live deployment credentials.
- Keep AI, Resend, and future integration keys in `.env` or the host secret manager only.

Forge deploy checklist:

1. Confirm DNS for `admin.scalesmiths.co.uk`; optionally confirm `forge.scalesmiths.co.uk`.
2. Create and permission `/srv/scalesmiths/generated-sites` for UID/GID `1001`.
3. Fill Forge env vars in `/srv/scalesmiths/.env`.
4. Keep `FORGE_ENABLE_AI=false` for first boot unless provider keys are ready.
5. Confirm AI budgets are set before enabling live providers.
6. Run web migrations, then admin migrations.
7. Rebuild and start the admin container.
8. Confirm `/forge` requires admin login.
9. Confirm `generated-sites/` is writable by creating a Forge workspace from the UI.
10. Confirm Nginx does not serve `generated-sites/` directly.
11. If Docker sandboxing is enabled, run one generated-site QA job and confirm Docker has no app secrets in the child environment.
12. Confirm Cloudflare/IP allowlist decisions are documented before client data is added.

## Forge End-To-End Demo

Stage 27 includes a safe mock demo for `Nottingham HomeCare Repairs`, a realistic local repairs and property maintenance business. The demo can be validated without live AI or Resend keys:

```bash
cd admin
npm run forge:demo -- --dry-run
```

To seed the admin database and create the generated workspace:

```bash
cd admin
npm run forge:demo
```

The seeded project simulates intake, research, sitemap, copy, design direction, component specification, site generation, QA, and proposal generation. It writes only to the admin database and `generated-sites/`, uses mock/provider-safe metadata, and does not call OpenAI, Anthropic, Resend, npm install, or deploy commands. See `docs/forge-demo.md` for the full admin walkthrough and screenshot placeholders.


---

## Admin auth

The admin uses Auth.js credentials validated against `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env`.

For production, hash your password:
```bash
node -e "const b=require('bcryptjs');console.log(b.hashSync('yourpassword',12))"
```
Paste the hash into `ADMIN_PASSWORD` in .env. The login route detects bcrypt hashes automatically.

**To upgrade to Auth.js (recommended for multi-user):**
See `claude-code-prompts.md` → Prompt #8.

---

## Required env vars

Root `.env` is shared by Docker Compose. Keep production secrets out of source control.
Only `.env.example` files should live in the repo. Real files such as `.env`,
`.env.local`, `.env.production`, `.env.development`, and `.env.test.local` are
ignored and should stay on the machine or secret manager that needs them.

- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `NEXT_PUBLIC_SITE_URL`
- `PORTAL_SECRET`
- `DEMO_PORTAL_ENABLED`
- `DEMO_PORTAL_EMAIL`, `DEMO_PORTAL_PASSWORD`, `DEMO_PORTAL_CLIENT_ID` only if demo mode is intentionally enabled
- `NEXT_PUBLIC_ADMIN_URL`
- `AUTH_SECRET`
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- `RESEND_API_KEY`, `RESEND_FROM`
- `FORGE_ENABLE_AI`, `FORGE_DEFAULT_AI_PROVIDER`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` only when Forge AI is intentionally enabled
- `FORGE_AI_MAX_TOKENS_PER_TASK`, `FORGE_AI_DAILY_TOKEN_BUDGET`, `FORGE_AI_DAILY_USD_BUDGET` must be set before live Forge AI usage
- `FORGE_PREVIEW_HOST`, `FORGE_PREVIEW_PORT_BASE`, `FORGE_ALLOW_PUBLIC_PREVIEWS`, `FORGE_MAX_REPAIR_ATTEMPTS` only for Forge generated-site previews/QA; keep public previews disabled unless intentionally configuring a private preview network
- `FORGE_SANDBOX_RUNNER`, `FORGE_SANDBOX_DOCKER_IMAGE`, `FORGE_SANDBOX_CPUS`, `FORGE_SANDBOX_MEMORY`, `FORGE_SANDBOX_NETWORK`, `FORGE_SANDBOX_INSTALL_NETWORK`, `FORGE_SANDBOX_PREVIEW_NETWORK`, `FORGE_SANDBOX_PREVIEW_INTERNAL_PORT` optionally enable Dockerized generated-site preview/QA
- `FORGE_ARTIFACT_MAX_VERSIONS`, `FORGE_ARTIFACT_MAX_CONTENT_BYTES`, `FORGE_QA_LOG_MAX_CHARS` optionally tune Forge artifact/version retention
- `FORGE_RATE_LIMIT_WINDOW_MS`, `FORGE_MUTATION_RATE_LIMIT`, `FORGE_TASK_RATE_LIMIT` optionally tune admin-only Forge mutation/task throttles; defaults are 60 seconds, 30 mutations, and 10 task/AI actions per actor/route

Before committing or packaging a release, run the env hygiene check from the
repo root:

```bash
npm run check:env-hygiene
```

The check fails if it finds real env files anywhere under the repo tree and
passes when only example files are present. For Docker/VPS deploys, create the
real `.env` directly on the target host from `.env.example`; do not rsync a
local secrets file.

---

## Production hardening notes

Both Next.js apps set production security headers in `next.config.mjs`, including `Content-Security-Policy`, `Referrer-Policy`, `Permissions-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, and `Strict-Transport-Security`.

The CSP is intentionally narrow: scripts, styles, images, fonts, forms, and fetches are limited to the app origin. Inline script/style allowances remain for the current Next.js App Router output and inline component styles; `unsafe-eval` is development-only.

The apps no longer use `next/font/google`. To keep CI and VPS builds deterministic when `fonts.googleapis.com` is unavailable, the existing `font-syne` and `font-dm` Tailwind classes now resolve to system font stacks declared as CSS variables in each app's `globals.css`. If brand font files are added later, place them in `public/fonts`, switch to `next/font/local`, and keep the same `--font-syne` / `--font-dm` variable names.

The public client portal uses database-backed client accounts in `portal_client_accounts`. Store bcrypt hashes in `password_hash`; generate a hash with:
```bash
node -e "const b=require('bcryptjs');console.log(b.hashSync('your-client-password',12))"
```

Demo portal access is disabled unless `DEMO_PORTAL_ENABLED=true` and `DEMO_PORTAL_EMAIL`, `DEMO_PORTAL_PASSWORD`, and `DEMO_PORTAL_CLIENT_ID` are all set.

Quote submissions are protected by:
- a hidden honeypot field
- request body size checks
- backend validation
- generic public error responses
- atomic Postgres-backed rate limiting in `quote_rate_limits`

Rate-limit identifiers are SHA-256 hashes of IP and email. The current settings live in `web/src/lib/quote-security.ts`: 3 submissions per 10 minutes per IP/email key.

Portal and admin login attempts are also rate-limited in Postgres using hashed
IP and email/client identifiers. Public responses stay generic for invalid
credentials and throttled attempts, and raw IP/email values are not stored in
rate-limit keys.

The quote flow now captures company name, current website, business type, project type, budget, timeframe, main goal, required features, care-plan interest, preferred contact method, and consent. The server assigns a private lead quality value (`high`, `medium`, or `low`) and stores it on the quote record. The score is for internal review only and is not shown to visitors.

Quote records are persisted before notification email is attempted. If the
database insert succeeds but Resend is unavailable or returns an error, the
visitor still gets a success response and the lead is marked with
`email_delivery_status=failed` plus a safe `email_failure_reason` of
`configuration` or `delivery`. If persistence itself fails, the public response
is a generic failure and provider details are never exposed.

After a successful quote submission users are sent to `/quote/thanks`, which is marked `noindex`.

Forge remains private to the admin app. Admin middleware protects all `/forge` pages and `/api/forge/*` routes, and mutating Forge API requests are additionally rate-limited in memory by authenticated actor, method, route, and task/mutation bucket. AI prompts include a global safety preface forbidding secret requests, unknown outbound telemetry, destructive shell commands, or writes outside generated workspaces.

Generated client-site files are only written through Forge workspace utilities. Those utilities keep writes inside `generated-sites/`, reject path traversal and core app targets, enforce a file allowlist, deny secret filenames such as `.env`, `.env.local`, `.npmrc`, private keys, and credential files, block secret references except approved generated-site runtime placeholders like `RESEND_API_KEY`, and reject unknown external phone-home URLs or destructive command content.

Forge audit logs cover project create/update/archive actions, AI task start/failure events, generated file writes, integration config changes, export creation, and deployment status changes. Do not store API keys in Forge project memory, artifacts, exports, or generated code. Production secrets should stay in the target environment or secret manager only.

Live Forge AI is budget-gated before provider calls. Keep `FORGE_ENABLE_AI=false` until `FORGE_AI_MAX_TOKENS_PER_TASK`, `FORGE_AI_DAILY_TOKEN_BUDGET`, and `FORGE_AI_DAILY_USD_BUDGET` have been reviewed for the current client workload. The in-process ledger protects a single admin runtime; use lower provider-side spend limits as the outer guardrail.

Generated-site QA and preview can run in Docker by setting `FORGE_SANDBOX_RUNNER=docker`. Docker sandbox commands receive a secret-free environment, resource limits, dropped capabilities, `no-new-privileges`, and explicit network modes. Keep build/test network disabled by default and only allow install networking during a reviewed dependency install window.

---

## Current routes

Public:
- `/`
- `/services`
- `/pricing`
- `/quote`
- `/quote/thanks`
- `/work`
- `/work/[slug]`
- `/web-design-hucknall`
- `/web-development-nottingham`
- `/e-commerce-development-nottingham`
- `/next-js-agency-uk`
- `/custom-web-app-development-uk`
- `/portal/login`
- `/portal/[clientId]`

Admin:
- `/dashboard`
- `/clients`
- `/clients/new`
- `/prospects`
- `/forge`
- `/messages`
- `/roadmap`

---

## Admin lead workflow

Quote requests are stored in `quote_requests` and surfaced in admin `/messages` as a lead inbox. Each lead card includes status, private lead quality, project type, budget, timeframe, created date, contact preference, required features, goal, and brief.

Lead status values are:
- `new`
- `reviewed`
- `contacted`
- `qualified`
- `won`
- `lost`

Status mutation is intentionally not overbuilt yet. Update status through a planned admin action/API pass when the sales workflow is ready.

---

## Admin prospect pipeline

The admin `/prospects` route is a focused internal revenue operating system for outbound and inbound sales. It tracks prospects from first discovery through audit, outreach, replies, discovery calls, proposals, follow-ups, won/lost outcomes, and conversion into the existing `clients` table.

Pipeline stages are:
- `Found`
- `Audited`
- `Contacted`
- `Replied`
- `Discovery Booked`
- `Proposal Sent`
- `Follow-up Due`
- `Won`
- `Lost`

To add a prospect, open `/prospects`, choose `Prospect`, and enter the business, contact details, source, priority, estimated project value, estimated monthly retainer, and initial stage. The detail panel lets admins maintain contact data, audit scores, pain points, opportunity notes, objection notes, follow-up dates, outreach activities, and proposal tracking.

Follow-ups use `next_follow_up_at`. The pipeline highlights due today, overdue, and upcoming follow-ups in the Follow-ups view and dashboard. Logging an outbound follow-up creates an `outreach_activities` row and updates `last_contacted_at`; inbound activity can move the prospect to `Replied`.

Sales audit sections are visible on each prospect:
- Revenue: where are they losing money?
- Trust: why would visitors leave?
- Conversion: why are visitors not contacting them?
- SEO: why are they not being found?
- Mobile: what is broken?

Dashboard sales metrics are calculated from `prospects`, `outreach_activities`, and `proposal_trackings`:
- outreach sent this week: outbound activities since the start of the current week
- replies this week: inbound activities since the start of the current week
- discovery calls booked: active prospects with a discovery call or discovery stage
- proposals sent: proposals/prospect proposal timestamps this week
- deals won/lost this month: `won_at` and `lost_at` in the current month
- pipeline value and projected MRR: open prospects only, excluding won/lost
- follow-ups due today and overdue: open prospects grouped by `next_follow_up_at`

Won prospects can be converted into clients from the prospect detail actions. Conversion creates a client with the prospect business/contact details, uses estimated monthly retainer as MRR, and stores the generated client id on `prospects.converted_client_id`.

---

## Admin Forge

The admin `/forge` route is a private shell for the internal ScaleSmiths AI website production engine. Stage 1 adds the protected dashboard, navigation entry, empty operational cards, and workflow markers only. Stage 2 adds admin-owned database foundations for Forge projects, tasks, generated artifacts, integration configs, activity logs, and project memory. Stage 3 adds project management: list, create, detail, edit, archive, and activity logging for Forge projects. Stage 4 adds structured website intake inside each Forge project, saving drafts and completed intake into an `Intake Summary` artifact with completeness scoring and missing-field tracking.

Forge migrations live under `admin/drizzle` and should be run with the admin migration command. Project management APIs live under `/api/forge/projects` inside the admin app and perform explicit admin session checks in addition to the admin middleware. Structured intake is saved through `/api/forge/projects/[id]/intake`; it does not call AI yet, but its artifact metadata is shaped for future research, sitemap, copy, design, build, and integration agents.

Stage 5 adds a server-only AI provider layer under `admin/src/lib/server/forge-ai.ts`. It supports OpenAI, Anthropic, and a mock provider, routes planning/copywriting/code/repair/QA tasks through model config, validates structured JSON responses, applies retries/timeouts, and exposes one admin-only smoke-test endpoint at `/api/forge/ai/test`. AI remains disabled unless `FORGE_ENABLE_AI=true`; otherwise Forge falls back to the mock provider. Live provider calls are guarded by per-task token limits plus daily token/spend budgets. Keep `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` server-only and never prefix them with `NEXT_PUBLIC_`.

Stage 6 adds the server-only Research Agent under `admin/src/lib/server/forge-research-agent.ts` with an admin-only trigger at `/api/forge/projects/[id]/research`. It creates and updates a `research` Forge task, uses the AI provider layer with mock fallback, writes a `Research Report` artifact of type `research_report`, and records activity logs. This stage does not scrape or crawl websites; project website URLs and competitor URLs are treated as supplied planning context only.

Stage 7 adds the server-only Sitemap and Strategy Agent under `admin/src/lib/server/forge-sitemap-agent.ts` with an admin-only trigger at `/api/forge/projects/[id]/sitemap`. It generates a structured local/service-business sitemap from intake and research, writes a `Sitemap & Strategy` artifact of type `sitemap`, and lets admins edit/approve the strategy from the project detail page. Approved sitemap strategy is stored separately in the artifact metadata as `approvedStrategy`.

Stage 8 adds the server-only Copy Agent under `admin/src/lib/server/forge-copy-agent.ts` with an admin-only trigger at `/api/forge/projects/[id]/copy`. It requires an approved sitemap, uses intake, research, brand notes, and target audience context, writes a structured `Copy Document` artifact of type `copy_doc`, supports per-page regeneration, and lets admins approve edited copy. Approved copy is stored separately in artifact metadata as `approvedCopy`; the copy helper also flags banned generic phrases and sloppy copy risks before approval.

Stage 9 adds the server-only Design Agent under `admin/src/lib/server/forge-design-agent.ts` with an admin-only trigger at `/api/forge/projects/[id]/design`. It requires approved copy, chooses or hybridises one of the internal style packs, writes a structured `Design Direction` artifact of type `design_direction`, and lets admins change/approve the selected style pack before any code is generated. Approved design direction is stored separately in artifact metadata as `approvedDirection`, and every direction includes a warning against over-animated designs.

Stage 10 adds the server-only Component Specification Agent under `admin/src/lib/server/forge-component-spec-agent.ts` with an admin-only trigger at `/api/forge/projects/[id]/component-spec`. It requires approved sitemap, copy, and design direction, writes a structured `Component Specification` artifact of type `component_spec`, and lets admins edit/approve the exact page/component blueprint before code generation. Approved specs are stored separately in artifact metadata as `approvedSpec`.

Stage 11 adds the generated-site workspace foundation. Generated client sites live under the ignored repo-root `generated-sites/` workspace, with only `generated-sites/.gitignore` tracked. Server-only utilities in `admin/src/lib/server/forge-workspace.ts` create, read, write, list, and carefully delete project workspaces while preventing path traversal, executable script writes unless explicitly approved, and writes outside the generated workspace. The admin trigger lives at `/api/forge/projects/[id]/workspace` and stores workspace metadata in Forge memory under `generated_site_workspace`.

Stage 12 adds Frontend Code Generator V1 under `admin/src/lib/server/forge-frontend-code-agent.ts` with an admin-only trigger at `/api/forge/projects/[id]/generate-site`. It requires a generated workspace plus approved sitemap, copy, design direction, and component specification, then writes a static Next.js, TypeScript, Tailwind, and Framer Motion client site into the project workspace only. The generator creates route files, metadata, JSON-LD helpers, reusable sections, a Resend-ready contact placeholder, WhatsApp CTA modules, task/activity logs, and a `Generated Site Code Summary` artifact of type `generated_code`.

Stage 13 adds Preview System V1 under `admin/src/lib/server/forge-preview.ts` with an admin-only API at `/api/forge/projects/[id]/preview`. V1 starts a local Next.js dev preview from the generated workspace, binds to `127.0.0.1` by default, stores preview state in Forge memory under `generated_site_preview`, and logs preview start/stop/failure events. When `FORGE_SANDBOX_RUNNER=docker`, previews run in a resource-limited Docker container with a secret-free environment and loopback-only published port. The project detail UI includes Start Preview, Stop Preview, Open Preview, iframe preview, and desktop/tablet/mobile viewport toggles. Do not expose previews publicly unless `FORGE_ALLOW_PUBLIC_PREVIEWS=true` is deliberately configured for a private network.

Stage 14 adds the generated-site Build/Test/Repair loop under `admin/src/lib/server/forge-qa-agent.ts` with an admin-only trigger at `/api/forge/projects/[id]/qa`. QA creates a `qa` task, runs `npm install --no-audit --no-fund`, typecheck/lint when package scripts exist, and `npm run build`, then writes a versioned `QA Report` artifact of type `qa_report`. With `FORGE_SANDBOX_RUNNER=docker`, commands run inside Docker with CPU/memory limits, dropped capabilities, `no-new-privileges`, a secret-free environment, and explicit network modes. Repair creates a `repair` task after failed QA, sends the failure summary and relevant generated workspace files to the Repair Agent, applies returned full-file updates only through workspace-safe write utilities, records repair history, and reruns the checks. `FORGE_MAX_REPAIR_ATTEMPTS` defaults to `3`.

Stage 15 adds the Resend integration module. Admins configure from email, to email, reply-to behaviour, subject prefix, enabled/disabled, and test mode from the Forge project cockpit; the API key is never stored in Forge and must come from the generated site's `RESEND_API_KEY` environment variable. Regenerated client sites include a production-ready contact API route, validation helpers, honeypot field, rate-limit placeholder, email template, Resend config module, form UI fields, and handover documentation. QA now checks that generated Resend form files exist when the Resend integration is enabled.

Stage 16 adds the WhatsApp integration module. Admins configure the business WhatsApp number, default prefilled message, CTA label, placements, and enabled/disabled state from the Forge project cockpit. Regenerated client sites include a generated WhatsApp config module, inline CTAs, service-page-specific messages, a contact-page option, and an optional sticky button using `wa.me` links only. WhatsApp Cloud API is not required for V1; `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, and `WHATSAPP_VERIFY_TOKEN` are documented as future placeholders. QA now checks that generated WhatsApp files exist and valid `wa.me` links can be produced when WhatsApp is enabled.

Stage 17 adds Advanced Animation Packs. Design directions now recommend and store one controlled animation pack: Minimal Premium, Cinematic Hero, Smooth Local Business, Editorial Reveal, Glass Motion, or Industrial Precision. The project cockpit lets admins select the pack before generation/approval, warns when a heavier pack is chosen for a simple local/service design, and regenerated sites include animation config, reduced-motion-safe Framer Motion wrappers, stable motion utility classes, and optional Lenis/GSAP dependencies only when the selected pack calls for them. QA now checks that generated sites retain `prefers-reduced-motion` support, reduced-motion transform fallbacks, and the generated animation config.

Stage 23 adds Command Chat UI. Each Forge project now has an admin-only command panel that classifies instructions such as "regenerate homepage copy", "make design more premium", "add WhatsApp CTA", "run QA", "repair build errors", and "generate proposal" into approved command-router intents. The router creates a Forge task for every command, stores the project transcript in Forge memory under `forge_command_chat`, logs activity, uses the AI provider layer with mock fallback for classification, and only calls existing safe pipeline actions. Risky actions such as generated code updates and repair runs require confirmation, and chat never blindly edits generated files.

Stage 24 upgrades the Forge project detail screen into a production cockpit with a stage sidebar, centre artifact/task/chat work area, right-side preview rail, viewport controls, artifact tabs, and a bottom QA logs drawer while keeping the existing Forge project pages intact.

Stage 25 hardens Forge as a private production system. Middleware keeps Forge pages/APIs admin-only and rate-limits mutating `/api/forge/*` requests, generated-workspace writes now enforce path traversal checks, a file allowlist, dangerous filename denylists, secret/content safety checks, and audit logs include normalized events for generated file writes and deployment status changes. Forge AI calls receive a global safety preface that forbids secret requests, unknown phone-home URLs, destructive scripts, and workspace escapes.

Stage 26 prepares Forge for private VPS operation. Production compose files now persist `generated-sites/` into the admin container, the README documents Forge env vars, migration order, workspace ownership, Nginx routing choices for `/forge` vs `forge.scalesmiths.co.uk`, Docker/systemd expectations, private access recommendations, and a Forge-specific deploy checklist. Optional subdomain routing is documented in `nginx/forge-admin-subdomain.example.conf`.

Stage 27 adds an end-to-end internal demo project. `npm run forge:demo -- --dry-run` verifies mock mode from a clean environment, while `npm run forge:demo` seeds a realistic Nottingham home repairs project with completed intake, research, sitemap, copy, design, component spec, generated-code summary, mock QA, proposal pack, integrations, activity logs, and a generated workspace under `generated-sites/`. The admin walkthrough and screenshot placeholders live in `docs/forge-demo.md`.

The final Forge hardening pass adds DB indexes for frequent Forge lookups, artifact version/retention fields, versioned QA artifacts, transient generated-workspace cleanup, API route auth regression tests, Dockerized preview/QA sandbox controls, and live AI budget checks.

Export and deploy workflows should be added incrementally inside the admin app.

---

## Portal limitations

The portal is a credible early-stage client workspace, not a full SaaS product. It currently provides protected access, overview cards, current phase, next client action, key dates placeholder, document placeholder, support CTA, and visible logout. It does not yet publish real project messages, files, or roadmap records.

---

## Database migrations

Run migrations before starting production containers after schema changes:

```bash
cd web && npm run db:migrate
cd ../admin && npm run db:migrate
```

The web app owns quote and portal tables. The admin app owns admin dashboard/client/kanban tables.

The admin app reads `quote_requests` for lead review, but the web app owns the quote table migrations.

The admin app owns the prospect pipeline tables:
- `prospects`
- `outreach_activities`
- `proposal_trackings`

Run `cd admin && npm run db:migrate` after pulling the prospect pipeline migration.

---

## Production deployment checklist

1. Set strong production secrets in `.env`.
2. Keep `DEMO_PORTAL_ENABLED=false` unless intentionally testing demo access.
3. Run web and admin migrations.
4. Build both apps or rebuild Docker images.
5. Confirm SSL certificates for `scalesmiths.co.uk`, `www.scalesmiths.co.uk`, and `admin.scalesmiths.co.uk`.
6. Confirm `PORTAL_SECRET`, `AUTH_SECRET`, and bcrypt password hashes are present.
7. Confirm Resend env vars are set before accepting quote traffic.
8. Review `nginx/nginx.conf` admin IP restriction notes if the admin should be IP-locked.

---

## Testing and verification

```bash
cd web
npm test
npm exec tsc -- --noEmit
npm run build

cd ../admin
npm test
npm exec tsc -- --noEmit
npm run build
```

`npm audit` currently reports known issues in the dependency tree. Do not run forced audit fixes during routine deploys; use a planned dependency upgrade pass so unrelated breaking changes are reviewed.

---

## Project structure

```
scalesmiths/
├── web/                    # Next.js 14 — scalesmiths.co.uk
│   ├── src/
│   │   ├── app/            # App Router pages
│   │   │   ├── page.tsx    # Homepage
│   │   │   ├── work/       # Portfolio
│   │   │   │   └── [slug]/ # Project detail pages
│   │   │   ├── services/
│   │   │   └── quote/
│   │   ├── components/     # All UI components
│   │   └── lib/
│   │       ├── data.ts     # All content — projects, services, FAQs
│   │       └── utils.ts
│   ├── Dockerfile
│   └── package.json
│
├── admin/                  # Next.js 14 — admin.scalesmiths.co.uk
│   ├── src/
│   │   ├── app/
│   │   │   ├── login/      # Auth page
│   │   │   ├── dashboard/  # Metrics + MRR chart
│   │   │   ├── clients/    # Client table
│   │   │   ├── roadmap/    # Kanban (drag-and-drop)
│   │   │   └── messages/   # Client comms
│   │   ├── components/
│   │   └── middleware.ts   # Auth guard
│   ├── Dockerfile
│   └── package.json
│
├── nginx/nginx.conf        # Reverse proxy (prod)
├── docker-compose.yml      # Production
├── docker-compose.dev.yml  # Development
├── .env.example
└── claude-code-prompts.md  # Enhancement prompts for Claude Code
```

---

## Adding a new project to the portfolio

Edit `web/src/lib/data.ts` → add an entry to the `projects` array.
The new project will automatically appear on `/work` and get a detail page at `/work/[slug]`.

---

## Next steps

See `claude-code-prompts.md` for ready-to-paste Claude Code prompts that will add:
- GSAP scroll animations
- Smooth scroll with Lenis
- Animated page transitions
- Custom cursor
- Contact form with Resend
- Client portal (Phase 2)
- Database integration (Drizzle + PostgreSQL)
