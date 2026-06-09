# ScaleSmiths

Strategy-led web development agency. Two Next.js apps, one Docker Compose stack.

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
   ```

3. **Start**
   ```bash
   cd /srv/scalesmiths
   cp .env.example .env && nano .env
   docker-compose up --build -d
   ```

4. **Check**
   ```bash
   docker-compose ps
   docker-compose logs -f web
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

3. **Start Postgres and run migrations**
   ```bash
   docker compose -f docker-compose.host-nginx.yml up -d postgres
   docker compose -f docker-compose.host-nginx.yml run --rm web-migrate
   docker compose -f docker-compose.host-nginx.yml run --rm admin-migrate
   ```

4. **Start the app containers on localhost-only ports**
   ```bash
   docker compose -f docker-compose.host-nginx.yml up --build -d web admin
   ```

   This binds:
   - public site: `127.0.0.1:3100`
   - admin: `127.0.0.1:3101`

5. **Install the temporary HTTP host Nginx site**
   ```bash
   sudo cp nginx/host-scalesmiths-http.conf /etc/nginx/sites-available/scalesmiths
   sudo ln -s /etc/nginx/sites-available/scalesmiths /etc/nginx/sites-enabled/scalesmiths
   sudo nginx -t
   sudo systemctl reload nginx
   ```

6. **Issue SSL certificates**
   ```bash
   sudo certbot --nginx -d scalesmiths.co.uk -d www.scalesmiths.co.uk
   sudo certbot --nginx -d admin.scalesmiths.co.uk
   ```

7. **Switch to the final HTTPS config**
   ```bash
   sudo cp nginx/host-scalesmiths.conf /etc/nginx/sites-available/scalesmiths
   sudo nginx -t
   sudo systemctl reload nginx
   ```


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
