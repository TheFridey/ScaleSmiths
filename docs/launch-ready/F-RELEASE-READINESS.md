# Operation Launch Ready: release readiness

**Not deployed.** This branch is ready for review. Deployment needs a separate approval under the release runbook.

## Ready (code complete and tested; dormant until switched on)

- Enforced application lifecycle, including "information requested".
- Agreement documents, issue, explicit acceptance at activation, reissue, downloads, founder register.
- Founder recruitment workspace, audit history and confirmations.
- Partner agreement page and first-login steps.
- Partner email with audit log (off by default).
- Web Vitals repair migration. This is the one change with an immediate production effect: it stops the 500s on `/api/experience-events`.

## Disabled, and must stay disabled until the approvals below

| Switch | Default | Turn on only when |
|---|---|---|
| `PARTNER_APPLICATIONS_ENABLED` (web) | off | applicant privacy notice version and retention period approved (AP-PRIV-01, AP-PRIV-02) |
| `PARTNER_ACTIVATION_ENABLED` (admin) | off | AP-LR-01 and AP-LR-02 decided, an agreement published, market approved |
| `PARTNER_EMAIL_ENABLED` (web and admin) | off | `RESEND_API_KEY` set, sending domain verified, wording approved (AP-LR-03) |
| `EMPOWER_FOUNDER_CONTENT_ENABLED`, `PARTNER_ACADEMY_ENABLED`, `PARTNER_RESOURCE_CENTRE_ENABLED`, `PARTNER_KNOWLEDGE_BASE_ENABLED` | off | as already recorded in the Empower approval register |

## Outstanding approvals (founder decisions, not engineering)

| ID | Decision |
|---|---|
| AP-LR-01 | Solicitor confirms that click-to-accept with typed name, single-use email invitation, timestamp and digest is adequate for the partner agreement, or names an e-signature provider |
| AP-LR-02 | Authoritative commercial specification (eligibility, timing, refunds, chargebacks, cancellations, tax, territory, exclusivity, termination, disputes, governing law) before any agreement containing commercial terms is published |
| AP-LR-03 | Partner email wording, reply-to address and enabling email |
| AP-LR-04 | Provide `RESEND_API_KEY` and verify the sending domain; it is unset in production, so no Resend email of any kind is sent today (defect D2) |
| AP-LR-05 | Fix `admin.scalesmiths.co.uk` in Cloudflare (it reaches another origin) or retire it |
| AP-LR-06 | Branch protection on `master` |

## Remaining blockers and work not done

- **Public website premium visual pass** (header, hero, services, mobile menu, trust, footer, SEO, error pages): not done in this branch beyond the Partner Login fix. It needs its own scoped piece of work.
- **Connect (`app.scalesmiths.co.uk`):** not in this repository; not inspected.
- **Commission and milestone logic:** inspected, not changed; no new entitlement logic was required.
- **Not built:** a retry button for failed emails (failures are shown to founders, who contact the applicant directly), an applicant self-service portal for information requests (handled by email reply), and the founder's own view of the partner email log (outcomes are shown at the time of the decision).
- **Observability:** structured, PII-free warnings were added for email outcomes. No new alerting provider was introduced (that needs approval).

## Deployment instructions (when approved)

1. Confirm CI is green on the merge commit and the working tree is clean.
2. Take the pre-release backup as in the pre-Empower release (`pg_dump -Fc` as the local `postgres` superuser plus journals and SHA256SUMS). age, rclone and jq are still not installed, so the backup is local and unencrypted; record that limitation.
3. Build an immutable `$RELEASE_TREE` (`releases/<sha>` beside the canonical checkout `/var/www/scalesmiths/ScaleSmiths`) via `git archive`, copy `.env`, link `generated-sites` to the canonical folder, then run `npm ci && npm run build` in web and admin.
4. `npm run db:migrate` from the release root. Expect web 25/25 and admin 97/97. Verify `web_vital` is present in `experience_event_name`.
5. Recreate the PM2 canaries with the new `cwd` and `SS_RELEASE_ID`, then `pm2 save`.
6. Smoke checks: both health endpoints show the new release with the database OK; `/`, `/faq`, `/partners`, `partners.scalesmiths.co.uk/login`; `POST /api/experience-events` with a `web_vital` event returns 2xx; partner pages redirect anonymous visitors; all partner switches still off.

## Rollback

- Code: recreate both canaries on the previous release tree and `SS_RELEASE_ID`, then `pm2 save`.
- Database: 0024, 0095 and 0096 are additive. Old code ignores the new columns and tables. The new triggers only add refusals to partner activation and application status changes, which old code never performs on production data (0 partners, 0 applications). So rolling back code alone is safe. A full schema rollback means restoring the pre-release dump.
