# Mailcow wiring and Phase 1 verification

The implementation is local and has not been deployed. The root `.env` now contains empty Mailcow placeholders without changing existing credentials. It is gitignored. Matching safe examples are in `.env.example`. Do not paste credentials into chat or commit `.env`.

## Configure the company mailbox

Use a dedicated company acquisition mailbox, not either founder's personal mailbox. This first adapter shares the explicitly activated company mailbox with authorised operational administrators; it does not implement personal-account grants.

Fill these root `.env` values:

```dotenv
MEGATON_MAILCOW_HOST=mail.your-company-domain.example
MEGATON_MAILCOW_USER=sales@your-company-domain.example
MEGATON_MAILCOW_PASSWORD=
MEGATON_MAILCOW_FROM=sales@your-company-domain.example
MEGATON_MAILCOW_IMAP_PORT=993
MEGATON_MAILCOW_SMTP_PORT=587
MEGATON_MAILCOW_SMTP_SECURE=false
MEGATON_MAILCOW_INBOX=INBOX
MEGATON_MAILCOW_SENT=Sent
MEGATON_MAILCOW_LOOKBACK_DAYS=7
MEGATON_MAILCOW_POLL_LIMIT=25
MEGATON_DAILY_SEND_LIMIT=10
```

The hostname contains no scheme or port. Confirm the actual Sent folder name in Mailcow/SOGo. IMAP uses implicit TLS and SMTP 587 requires STARTTLS; certificate verification stays enabled. SMTP 465 can be selected with `MEGATON_MAILCOW_SMTP_SECURE=true`. Use the mailbox's authorised password/app password, not a Mailcow administrator API key. Quote environment values containing spaces or `#` according to Node's dotenv syntax. [Mailcow client configuration](https://docs.mailcow.email/client/client-manual/).

Credentials alone do not enable effects. The prepared defaults are:

```dotenv
MEGATON_ENABLED=true
MEGATON_EXTERNAL_ENABLED=false
MEGATON_SEND_ENABLED=false
MEGATON_STOP=true
MEGATON_WORKER_SEND_ENABLED=false
MEGATON_AI_ENABLED=false
MEGATON_DISCOVERY_ENABLED=false
```

Restart the application after environment changes. After the separately approved deployment/shared migration, enable only external work and release STOP when you are ready to connect. Keep sending off. In Megaton → Operations activate the company mailbox, queue inbox sync and process the next job. Initial sync imports only the recent configured window in bounded batches; it does not silently import the entire mailbox archive. Both Inbox and Sent are reconciled. Messages over 256 KB are not processed and require manual investigation in Mailcow; no attachments are sent to AI. The UI shows sync/job failures rather than claiming a connection is healthy.

## Optional worker

The private worker route requires a dedicated random bearer token and its SHA-256 digest, bound to an active persisted admin ID and current session version. The plain token is used only by the runner; the server checks the digest. Set `MEGATON_WORKER_ADMIN_ID`, `MEGATON_WORKER_SESSION_VERSION`, `MEGATON_WORKER_TOKEN` and `MEGATON_WORKER_TOKEN_SHA256` locally. Generate a new token rather than reusing any founder password or other integration key.

Set `MEGATON_WORKER_URL` to the approved local admin origin's `/api/megaton/worker`; the example port 3001 is development, not an assumption about the live PM2 port. The runner accepts HTTPS or loopback HTTP only. From `admin/` run `npm run megaton:worker` using the existing process-management topology after deployment approval. It polls at the bounded configured interval, queues company mailbox sync, processes one job and optionally dispatches one due approval. It never enables itself or provisions a live PM2 process.

Leave `MEGATON_WORKER_SEND_ENABLED=false` for the initial manual pilot. Later scheduled dispatch still requires an exact human approval, fresh sync within two minutes, eligible recipient, active connection/approver, daily limit and current thread fence. Automation cannot send while a human owns a conversation. A manual human owner can send their own approved reply. SMTP acceptance is recorded separately from confirmed delivery/inbox placement. Interrupted/time-out sends become UNKNOWN and are not retried without verified reconciliation.

Revoking the connection cancels waiting approvals. STOP blocks new effects; an already started provider request cannot be recalled. Uncertain sends must be reconciled against Mailcow logs using the displayed Message-ID. Record confirmed acceptance or confirmed non-send with evidence; approval consumption is never undone. A new attempt requires a new approval.

## Optional AI and discovery

AI uses a dedicated `MEGATON_OPENAI_API_KEY`, `MEGATON_AI_ENABLED` and explicitly approved daily/monthly caps in integer micro-USD (1,000,000 = $1). Defaults are zero/off. Each operation reserves $0.05 atomically before the call; successful usage valued at conservative standard token rates and uncertain reservations remain counted. These budget estimates are separate from actual provider invoices. GPT-4.1 mini is the pinned pricing baseline, not a claim that it is the newest or best model. No arbitrary model tools are exposed. A generated proposal changes a draft only when its original revision and thread ownership still match; it requires fresh human review and approval. Calls with uncertain cost are retained for finance-authorised reconciliation. No AI provider call was made during implementation verification.

Companies House discovery is optional and disabled. Fill `MEGATON_COMPANIES_HOUSE_API_KEY` and explicitly enable `MEGATON_DISCOVERY_ENABLED` when authorised. Search uses an exact town plus five-digit SIC code, active companies and a maximum 25 results. It rejects conflicting/non-UK locations and labels every result **registered office**, not verified trading presence. Review the real business website/location and permitted source use before import. Sole traders are absent; this is not a comprehensive local-business directory. Licensed manual imports remain available. [Official advanced search](https://developer-specs.company-information.service.gov.uk/companies-house-public-data-api/reference/search/advanced-company-search).

## Retention and remaining acceptance

`MEGATON_MESSAGE_RETENTION_DAYS=0` leaves automatic deletion off until the company selects its policy. A positive configured period enables worker deletion of old message bodies and records the deletion count. Minimum suppression information and financial/audit records are retained separately. Evidence stops contributing to current fit scores after 90 days; immutable score snapshots preserve the model, contributions and evidence IDs used at recording time.

Before declaring the release operational, test real founder login and permissions, real Mailcow receipt/reply/Sent reconciliation, suppression, revoked approvals, human takeover, uncertain-send recovery, mobile PWA installation and an isolated backup/restore against the approved deployment SHA. Local embedded-database and component fixtures do not prove those live boundaries. No production migration, account connection, send, paid subscription or deployment was performed in this implementation phase.

Source rollback: revert the application feature or set `MEGATON_ENABLED=false`, revoke the mailbox and stop the worker. Keep the additive tables and historical migration; never edit an applied migration or drop commercial data to roll back code. Refresh the standard release and database recovery gates before live cutover.

The first mailbox view groups messages by counterparty. HTML-only messages, attachments, complex multi-recipient threads and oversized messages require review in Mailcow; this release does not promise a complete replacement for SOGo. Alerts are in-app review states, not verified OS push notifications.
