# Operation Launch Ready: baseline audit

Recorded 2026-11-21 against `master` at `a436712` and the live production host. Evidence was gathered read-only, except where stated.

## 1. Verified architecture

| Part | Verified state |
|---|---|
| Public site | `web/`, Next.js 15.5, PM2 `scalesmiths-web-canary` on 127.0.0.1:3200, Nginx vhost `scalesmiths` for `scalesmiths.co.uk` and `www` |
| Admin, founder and partner app | `admin/`, Next.js 15.5, Auth.js credentials with MFA, PM2 `scalesmiths-admin-canary` on 127.0.0.1:3201. Canonical origin `https://partners.scalesmiths.co.uk` (`AUTH_URL`) since 2026-11-21, Nginx vhost `scalesmiths-partners` with its own Let's Encrypt certificate. `admin.scalesmiths.co.uk` is still served by the `scalesmiths-admin` vhost, but Cloudflare sends that hostname to another origin |
| Database | PostgreSQL 14.24 on the host, one database shared by both apps. Shared migrator `scripts/migrate-database.mjs`; journals `drizzle.__drizzle_migrations` (admin 95/95) and `drizzle.__drizzle_web_migrations` (web 24/24) |
| Background work | `scalesmiths-megaton-worker` from `releases/6dcfeff`, and Forge operations jobs inside admin |
| Email | Resend over HTTPS (`client-request-notifications.ts`, `invoice-delivery.ts`, `request-notifications.ts`). No partner lifecycle email exists |
| App at `app.scalesmiths.co.uk` (Connect) | Not part of this repository; not inspected |
| Deployment | PM2 host deploy (`docs/operations/pm2-host-deploy.md`), immutable trees under `/var/www/scalesmiths/releases/<sha>` |

### Partner onboarding as built

- **Application:** `web` `POST /api/partner-applications` inserts into `partner_applications` with status `submitted`. It is closed unless `PARTNER_APPLICATIONS_ENABLED=true` and a retention period is set.
- **Review:** the founder `review_application` command in `admin/src/lib/server/expansion.ts` sets any of nine statuses, writes notes and records four founder confirmations (`legal`, `agreement`, `independentStatus`, `operations`).
- **Invitation:** `invite` calls `issueInvitation` in `partner-invitations.ts`. It requires status `onboarding`, all four confirmations and an approved operating market. It creates an inactive `independent_partner` identity and returns a single-use 48-hour token, which the founder copies as a link.
- **Activation:** `POST /api/partner/activate` checks the token, status, confirmations and market inside one transaction, then sets the password and activates. Everything is gated by `PARTNER_ACTIVATION_ENABLED`.
- **Partner workspace:** `/partner`, with the Academy, Resource Centre and Knowledge Base, each behind its own switch.

## 2. Deployed state

| Item | Value |
|---|---|
| Web canary | release `37995d2`, tree `releases/37995d2…/web-partners` |
| Admin canary | release `37995d2`, tree `releases/37995d2…/admin` |
| Megaton worker | release `6dcfeff` |
| `master` | `a436712` (37995d2 plus the Partner Login fallback; the deployed env already carries that value) |
| Partner switches | `PARTNER_APPLICATIONS_ENABLED`, `PARTNER_ACTIVATION_ENABLED`, `PARTNER_ACADEMY_ENABLED`, `PARTNER_RESOURCE_CENTRE_ENABLED`, `PARTNER_KNOWLEDGE_BASE_ENABLED`, `EMPOWER_FOUNDER_CONTENT_ENABLED` all **unset (off)** |
| Production data | 0 partner applications, 0 partners, 0 governed content items |

## 3. Confirmed defects

| ID | Severity | Defect | Evidence and reproduction | Root cause | Fix |
|---|---|---|---|---|---|
| D1 | Medium | Every Web Vitals beacon fails with HTTP 500 | `POST /api/experience-events` with `eventName: "web_vital"`. The web error log shows 600+ `invalid input value for enum experience_event_name: "web_vital"`, and Nginx logs 500s on that path today | Production schema drift: the journal records web `0013_web_vital_experience_event` (hash matches) but the enum has no `web_vital` label. The type was restored or recreated outside the migrator | Idempotent repair migration web `0024` that re-asserts the label through the normal migrator |
| D2 | High (launch blocker) | Transactional email is not configured in production | `RESEND_API_KEY` is unset in the live release env (presence check only) | Missing configuration | Founders must provide a Resend key and verify the sending domain; the code fails safe and records `not_configured` |
| D3 | High (governance) | The partner agreement is a free-text label, and "agreement" is a founder tick-box, not a partner acceptance | `issueInvitation(…, agreementVersion: string)` and `onboarding_confirmations.agreement` | Not built | Versioned agreement documents, a binding to the invitation, and an append-only acceptance record with a database-computed hash (Phase three) |
| D4 | Medium (governance) | Application status transitions are not enforced | `review_application` accepts any of nine statuses from any non-terminal state, so `submitted` can jump straight to `onboarding` | Allow-list without a transition map | Transition map enforced in a database trigger, with matching service checks |
| D5 | Medium | `admin.scalesmiths.co.uk` reaches a different origin (confirmakill) | `curl -sI https://admin.scalesmiths.co.uk/login` gives 301 to `www.confirmakill.co.uk` with `Server: cloudflare`; the origin itself returns 200 | Cloudflare DNS or a redirect rule | Founder action in Cloudflare. The admin app no longer depends on that hostname |
| D6 | Low | 7 Forge operations jobs in dead letter | The `forge_ops_dead_letters` warning repeats in the admin log | Historical job failures | Operational review in the Forge operations panel; out of scope for code |
| D7 | Low (noise) | `Failed to find Server Action` and `Server Reference ID did not match` errors | Admin and web error logs | Stale browser bundles after deploys, plus automated scanners sending invalid `Next-Action` headers. Next 15.5.28 includes the React Server Components security fixes | No code change; documented as expected |
| D8 | Low | 6 Nginx `connect() failed` to 3200/3201, latest 2026-11-19 09:44 | Nginx error log | Process restarts during deploys | None |

Harmless or expected: `CredentialsSignin` entries from wrong passwords, 2 `mfa_challenge_failed` audits in 7 days, and the Sentry `withSentryConfig` deprecation notice.

## 4. Test coverage relevant to onboarding

- `admin/src/lib/server/partner-invitations.database.test.ts`: invitation and activation on PGlite.
- `admin/src/lib/server/expansion*.test.ts`: founder and partner commands on PGlite.
- `admin/test/integration/*`: real PostgreSQL as restricted roles (B0 hardening and B1.1–B1.4).
- `admin/test/e2e/empower-academy.spec.ts`: three browser journeys, run locally.
- Not covered: agreement acceptance, status transitions, partner email.

## 5. Deployment risks

- The shared database means any migration touches both apps. Use the backup gate from the pre-Empower release (local `pg_dump` as `postgres`; age, rclone and jq are absent, so there is no encrypted off-host copy).
- The admin `.env` carries origin values; three files were changed on 2026-11-21, with backups beside them.
- No branch protection on `master`.
