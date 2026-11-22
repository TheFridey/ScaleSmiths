# Project Aegis: production readiness audit

**Observed 22 November 2026, about 14:15 UTC.** This audit separates what was **observed** from what was **not verified**. Nothing was changed in production: no deployment, migration, DNS, Cloudflare, firewall, certificate or process change.

## 1. How production was inspected, and the limits

| Route | Available | Result |
|---|---|---|
| Shell on the VPS (SSH, PM2, `psql`, systemd, files) | **No** | This session runs in a cloud container. No computer is attached through Remote Control, and no VPS credential is held. Desktop Commander in this session runs in the same container, not on the VPS |
| Public internet (DNS-over-HTTPS, HTTPS GETs) | **Yes**, read-only | A personal "ScaleSmiths" cloud environment was created that allows only `scalesmiths.co.uk`, `www.`, `partners.`, `admin.` and `dns.google`. Only unauthenticated GETs and DNS lookups were made |

Everything in sections 3 to 6 that needs the host (PM2, PostgreSQL, Nginx, backups, environment variables, logs, disk, memory, CPU) is therefore **NOT VERIFIED**. Section 7 lists the exact read-only commands an operator can run on the VPS to close each gap.

## 2. Observed from the public internet

### Release and health

| Check | Observation | Status |
|---|---|---|
| `GET https://scalesmiths.co.uk/api/health` | `{"status":"ok","service":"scalesmiths-web","database":"ok","environment":"production","release":"37995d270a9cf7564b4e4d4a095514889a0773f7"}` | PASS |
| Deployed web release | `37995d2` (PR #157 merge, B1.1). The B0–B1.6 work merged since then, and B1.7, are **not deployed** | Observed |
| Web error monitoring | Health reports `monitoring: provider "none", configured: false, status "disabled"` | **GAP**: production errors are not reported to any monitoring provider |
| Admin health (`partners.scalesmiths.co.uk/api/health`) | `401` without the health token, as designed. The admin release SHA is therefore not visible from outside | NOT VERIFIED (admin SHA) |

### Origins and routing (Cloudflare proxied; all edge responses `server: cloudflare`)

| URL | Observation | Status |
|---|---|---|
| `https://scalesmiths.co.uk/` | 200 | PASS |
| `https://www.scalesmiths.co.uk/` | 308 to `https://scalesmiths.co.uk/` | PASS |
| `https://scalesmiths.co.uk/partners` | 200 (public programme page) | PASS |
| `https://partners.scalesmiths.co.uk/` | 307 to `/login` | PASS |
| `https://partners.scalesmiths.co.uk/login` | 200 (admin sign-in) | PASS |
| `https://partners.scalesmiths.co.uk/partner` | 307 to `/login` (anonymous) | PASS |
| `https://partners.scalesmiths.co.uk/api/partner/workspace?view=today` | 401 (anonymous) | PASS |
| `https://admin.scalesmiths.co.uk/` and `/login` | **301 to `https://www.confirmakill.co.uk/`** and `/login`, a domain unrelated to ScaleSmiths | **FAIL** (`AP-LR-05`, confirmed) |

### TLS and headers

| Check | Observation | Status |
|---|---|---|
| Edge certificate (apex and `partners.`) | CN `scalesmiths.co.uk`, issuer Google Trust Services WE1 (Cloudflare edge), valid 2 October to 31 December 2026, renewed by Cloudflare | PASS |
| Origin certificate on the VPS | Not visible behind Cloudflare | NOT VERIFIED |
| Security headers (apex and `partners.`) | `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`, CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`; `partners.` also sends a restrictive `Permissions-Policy` | PASS |

### DNS (Google Public DNS, `dns.google`)

| Record | Observation |
|---|---|
| `scalesmiths.co.uk`, `www.`, `partners.`, `admin.` | A and AAAA on Cloudflare anycast (104.21.48.112, 172.67.150.180, 2606:4700:…), so every host is proxied |
| `MX scalesmiths.co.uk` | `1 smtp.google.com.` (Google Workspace) |
| `TXT scalesmiths.co.uk` | SPF `v=spf1 include:_spf.google.com include:_spf.mlsend.com include:mail.scalesmiths.co.uk -all`; MailerLite and Google site verification |
| `TXT _dmarc.scalesmiths.co.uk` | `v=DMARC1; p=none; …` (monitoring only, no enforcement) |
| `TXT resend._domainkey.scalesmiths.co.uk`; `MX send.scalesmiths.co.uk` | **None.** Resend's default domain-verification records are absent |

## 3. Findings

| # | Finding | Severity | Proposed correction (needs approval; not done) |
|---|---|---|---|
| P1 | `admin.scalesmiths.co.uk` redirects to `www.confirmakill.co.uk`. Anyone who types the admin address, or follows an old link, lands on an unrelated site, and a sign-in form there could collect ScaleSmiths credentials | **High** (brand and credential-phishing exposure) | In Cloudflare, find the rule or record producing the 301 (a Redirect Rule, Page Rule or Bulk Redirect) and remove it. Then either redirect `admin.` to `https://partners.scalesmiths.co.uk/login`, or delete the `admin` record. Approval: `AP-LR-05` |
| P2 | Origin naming conflict. The enforced topology policy (`scripts/check-production-topology.mjs`: `CANONICAL_ADMIN_ORIGIN = https://admin.scalesmiths.co.uk`) and `docs/architecture/deployment-topology.md` name `admin.`, but the web code (`partnerLoginUrl`, since PR #158) and production use `partners.` | Medium (governance; a runbook following the policy would target the wrong origin) | A founder decides the canonical admin origin. Engineering then updates the topology policy and architecture docs in one reviewed change, without weakening the gate |
| P3 | Production web error monitoring is disabled (`provider "none"`) | Medium | Approve a monitoring provider, or the existing log shipping, before Gate B. Running without one is an accepted risk only if recorded |
| P4 | Resend is not verified for `scalesmiths.co.uk` (no `resend._domainkey`, no `send.` MX or SPF) | Blocks partner email | Add the DNS records Resend issues for the domain, set `RESEND_API_KEY`, `RESEND_FROM` and `PARTNER_EMAIL_REPLY_TO`, then enable email (`AP-LR-03`, `AP-LR-04`). The SPF record will need the include Resend specifies |
| P5 | DMARC is `p=none` | Low | Move to `quarantine` after monitoring reports, once every sender (Google, MailerLite, Resend) aligns |
| P6 | Production runs `37995d2`. The partner programme code is not deployed, and the agreement, notification and objection migrations (0095–0097, web 0024) are pending in production | Expected | Gate A in the [controlled release runbook](AEGIS-CONTROLLED-RELEASE-RUNBOOK.md) |

## 4. Database: NOT VERIFIED on the host

Health reports `database: ok` for the web app. The following were not verified:

- the journal position: expected admin 95 and web 24 entries at `37995d2`;
- pending migrations: expected admin 0095–0097 and web 0024;
- restricted roles and privileges;
- the PostgreSQL version: 14.24 recorded by B1.6;
- partner and applicant counts: B1.6 recorded 0 and 0;
- content and agreement publication state;
- ledger integrity.

Rehearsal evidence for the pending upgrade: the [B1.7 report](../expansion/empower/B1-7-PROJECT-AEGIS-FINAL-REPORT.md) and `docs/expansion/empower/evidence/b1-7/upgrade-rehearsal-pg14`. That run went from `37995d2` to the head on PostgreSQL 14.25: every pre-existing row was unchanged, and the upgraded schema was identical to a fresh install.

## 5. Backups and email configuration: NOT VERIFIED on the host

The repository's backup framework exists and was drill-tested on disposable PostgreSQL 14: GPG in CI; age, a full-schema restore and role re-provisioning in B1.7.

What is installed on the VPS is not verified: the timer, the most recent bundle, the encryption recipient, the off-host destination, retention, and the failure hook. B1.6 recorded only local `pg_dump` with no age, rclone or jq installed.

The presence of `RESEND_*` and `PARTNER_EMAIL_*` in the process environment is not verified. DNS shows Resend is not set up (P4).

## 6. Status summary

| Area | Status |
|---|---|
| Public website availability | PASS |
| Partner portal and admin origin (`partners.`) | PASS |
| Founder login origin | PASS WITH LIMITATION (`partners.` works; `admin.` is broken, P1) |
| TLS (edge) | PASS; origin NOT VERIFIED |
| DNS | FAIL (P1); email DNS BLOCKED (P4) |
| Application health | PASS (web); admin NOT VERIFIED |
| Error monitoring | FAIL (P3) |
| PM2, Nginx, Node, Ubuntu, PostgreSQL version, storage, memory, CPU, error logs | NOT VERIFIED |
| Database journal, roles, counts | NOT VERIFIED |
| Backups (schedule, encryption, off-host, monitoring) | NOT VERIFIED; off-host BLOCKED pending approval |
| Email | BLOCKED (P4, `AP-LR-03`, `AP-LR-04`) |

## 7. Read-only commands for an operator on the VPS

Run as the operator. Each command only reads. Redact anything secret before sharing output.

```bash
lsb_release -ds; node -v; pm2 -v; nginx -v 2>&1
pm2 jlist | jq -r '.[] | [.name, .pm2_env.status, .pm2_env.pm_cwd, .pm2_env.env.SS_RELEASE_ID] | @tsv'
curl -s -H "x-health-check-token: $(sudo cat /path/to/admin-health-token)" http://127.0.0.1:3201/api/health | jq '{status,release,database}'
df -h / /var/backups /var/lib/postgresql 2>/dev/null; free -m; uptime
sudo -u postgres psql -XAt -c 'show server_version'
sudo -u postgres psql -d scalesmiths -XAt -c "select (select count(*) from drizzle.__drizzle_migrations), (select count(*) from drizzle.__drizzle_web_migrations)"
sudo -u postgres psql -d scalesmiths -XAt -c "select (select count(*) from expansion_partners), (select count(*) from partner_applications), (select count(*) from empower_content_versions where status='published')"
systemctl list-timers 'scalesmiths-*' --all; ls -lt /var/backups/scalesmiths | head
command -v age rclone jq; sudo test -f /etc/scalesmiths/backup.env && echo backup.env-present
sudo nginx -T 2>/dev/null | grep -E 'server_name|proxy_pass' | sort -u
pm2 env <admin-process-id> | grep -oE '^(RESEND_API_KEY|RESEND_FROM|PARTNER_EMAIL_ENABLED|PARTNER_EMAIL_REPLY_TO|PARTNER_[A-Z_]+_ENABLED)=' | sort
```

The last command prints variable **names** only, never values. Replace the paths and the database name with the host's actual ones; the canonical checkout is `/var/www/scalesmiths/ScaleSmiths`.

To run these from Claude, start a session on a computer that has SSH access to the VPS (Remote Control from the Claude desktop app, or `claude remote-control` in a terminal), not from a cloud container.
