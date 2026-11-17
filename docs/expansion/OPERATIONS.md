# Expansion operating configuration

## Public recruitment admissions

The recruitment page and earnings illustration are available at `/partners`. Application submission is closed by default. Configure local runtime values only in the ignored root `.env`; do not commit a real environment file.

```dotenv
# Keep false until applicant privacy and recruitment operations are approved.
PARTNER_APPLICATIONS_ENABLED=false
# The reviewed applicant notice version, not an arbitrary deployment identifier.
PARTNER_APPLICATION_PRIVACY_VERSION=
# Explicitly approved days from submission; accepted range 1..730, no default.
PARTNER_APPLICATION_RETENTION_DAYS=
```

All three settings must be valid for the form and API to open. The submitted acknowledgement is bound to the rendered notice version; a stale page must reload and review a changed notice. The standard public privacy route remains `/legal/privacy`. The applicant notice describes controller, purpose, access, retention and rights/contact. Founder approval must review both that text and the wider privacy notice before enablement; configuration does not constitute legal review.

Applications use the existing durable web rate-limit store with independent hashed network and normalized-email buckets, three attempts per hour. Invalid attempts consume the network allowance. The API requires same-origin requests, streams at most 16 KiB, validates fields and does not accept client-provided lifecycle or onboarding values. Database outage fails closed. The public response never includes an applicant identifier.

No external email is sent by recruitment submission in this implementation. Founders review saved applications in administration. Email notifications remain outstanding and must be introduced through reviewed, explicit safe-testing configuration before use.

## Database rollout

The web-owned `0023_partner_applications` forward migration must precede admin expansion tables that reference it. Use the repository's root shared migration runner, never an isolated app batch. Verify checksums, planner dependencies and an isolated upgrade before production approval. The public runtime needs only INSERT and serial-sequence usage for this table. Internal review belongs to the admin runtime. Never grant web access to internal partner profiles, invitations, CRM or financial tables.

The migration stores an explicit `retention_until` deadline. An operator must run and verify the approved founder retention process; storing a deadline alone does not delete or anonymize records. Activated partner records and financial lineage require a separately reviewed retention basis.

## Rollback and monitoring

Close admissions first with `PARTNER_APPLICATIONS_ENABLED=false`. Preserve submitted applications, agreements and audit/financial lineage; do not drop data or rewrite migration history. Forward schema correction is preferred to destructive rollback.

Monitor 4xx/429 application abuse, 503 persistence failures and overdue retention deadlines without logging submitted personal data. A success message is shown only after the database insert resolves. Honeypot submissions receive a generic success response without storage to avoid teaching automated spam clients.
