# Megaton prospect discovery, social outreach and approval alerts

## Prospect workflow

Prospects → Add prospect writes into the existing shared pipeline, with an actor-derived owner and audit entry. Website and email are optional; business, town, industry and source/location evidence are required. Existing names in the same town or matching website domains require review instead of duplicate creation.

Discovery → Find potential clients with AI uses the existing dedicated OpenAI key and shared daily/monthly caps. Enable `MEGATON_AI_ENABLED=true` and `MEGATON_AI_SEARCH_ENABLED=true`; configure the caps explicitly. External operations must be enabled and STOP released. Each search reserves and conservatively accounts US$0.10 against the shared budget. One web-search tool call and bounded output are allowed. Failed/uncertain calls retain the reservation. Source-backed suggestions are saved for human review, never automatically imported or contacted. Sources, trading locations and permission must still be checked. Provider invoices remain separate from this conservative local accounting.

## Social channels

Social outreach records the prospect, channel, recipient, profile, exact message, eligibility evidence and approving identity/session. Approval expires after 24 hours. X/Facebook scheduling is limited to the next 23 hours. Cancellation, revoked sessions, changed provider credentials, archived/won/lost prospects, shared suppression and human ownership prevent dispatch. In-flight/uncertain sends are never retried automatically. Provider acceptance is not confirmed delivery.

LinkedIn is first in the interface. It supports review, approval, copying the approved message, opening the profile and explicit manual-send confirmation by the current approver. It does **not** automate LinkedIn DMs: ordinary LinkedIn API access does not establish permission for that feature. No browser scraping or session-cookie automation is used. A LinkedIn-approved messaging integration remains a prerequisite for automated LinkedIn outreach.

X dispatch uses the official user-context DM endpoint with `MEGATON_X_USER_ACCESS_TOKEN`; its scopes and account entitlement must permit that operation. Facebook uses a Page token, Page ID and explicitly configured supported Graph API version. Immediately before sending, it checks recent inbound conversation messages from that recipient; no cold Facebook Page DM or personal-profile automation is provided. LinkedIn, X and Facebook inbox ingestion/OAuth onboarding are not implemented by this change. Other social platforms remain unavailable until a reviewed adapter exists.

Automatic dispatch requires all shared sending controls plus `MEGATON_SOCIAL_SEND_ENABLED=true` and a running worker. Leave it false during integration acceptance. Preparing a draft and approving it do not enable a provider or grant account permissions.

Official references: [LinkedIn access](https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access), [X DMs](https://docs.x.com/x-api/direct-messages/manage/introduction), [Meta Send API](https://www.postman.com/meta/messenger-platform-api/folder/vilwbh4/send-api), [OpenAI web search](https://developers.openai.com/api/docs/guides/tools-web-search).

## Phone notifications and email fallback

New email drafts, AI draft proposals, inbound messages and social drafts queue generic approval alerts for active owners and venture controllers. Device subscriptions belong to the signed-in user and session version, are encrypted with a dedicated AES-256-GCM key, and accept only recognised HTTPS push service hosts. No prospect or message details appear on the lock screen. Notification clicks open the private Megaton inbox; authentication and approval checks remain server-side. Social approvals are in the Social outreach tab.

In the deployed admin directory, `node scripts/provision-megaton.mjs --apply` prepares stable VAPID keys, a dedicated encryption key and an owner-bound worker credential in the existing root environment without printing secrets. It needs `ADMIN_DATABASE_URL`. If more than one owner exists, supply `--admin-id`. `--rotate-worker-token` rotates only this worker credential. `--enable-notifications` enables internal approval delivery and external operations, releases STOP, and leaves all prospect-sending flags unchanged. Never rotate VAPID/encryption keys casually: existing device subscriptions depend on them.

`MEGATON_NOTIFICATIONS_ENABLED=true` enables delivery; `MEGATON_NOTIFICATION_EMAIL_FALLBACK=true` permits a Mailcow alert to the user's registered email when no push is accepted. It does not enable prospect sending. Both delivery paths still honour Megaton enablement, external operations and STOP. Push acceptance is recorded separately from email acceptance; neither confirms phone display or inbox placement. Interrupted/uncertain email alerts remain unknown rather than repeatedly sending duplicates. Failed push-only notifications are visible and a new test can be requested.

Each founder signs into the installed admin PWA on their phone, opens Megaton → Operations → Enable on this phone and grants notification permission, then requests a test alert. iPhone/iPad require a supported Home Screen web app. Session revocation requires registering again. Revoking devices removes only the signed-in user's registrations. Phone permission cannot be granted remotely by deployment.

## Deployment and verification

Apply the root shared migration plan, including admin forward migration `0067_megaton_growth_and_alerts`; existing SQL histories remain immutable. The PostgreSQL privilege policy adds DELETE only for expired/revoked `megaton_push_devices`. Run the privilege verifier first. If provisioning is required, use the existing provisioning principal/script and reverify; never grant ad-hoc runtime privileges or disable RLS.

Run the worker through the existing PM2 topology, from the same deployed admin directory, using Node's root environment loader and `scripts/megaton-worker.mjs`. The prepared URL is loopback port 3201. The worker checks the persisted owner/session and does not provide approval authority to AI. The web-push package is server-only. Keep real environment files and subscriptions out of Git and logs.

Verification covers production service code against embedded PostgreSQL, denied/expired approvals, budgets, uncertain-send non-retry, push endpoint validation, encrypted subscriptions, fallback behaviour and component/browser flows. These checks do not certify live provider entitlements, actual phone display, email inbox placement or LinkedIn API messaging. Run a real test from each phone after deployment.

## Rollback

Disable notification delivery and social sending, stop the worker, and restore the prior application process definition. Keep the additive tables and journal/checksum history. Do not drop commercial/audit records or revoke unrelated services. Restore old application code only if it remains compatible with the applied forward schema.
