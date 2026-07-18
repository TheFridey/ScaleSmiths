# Public claims and testimonial review

This is the operating procedure for commercial claims rendered by `web`. It is an implementation control, not a substitute for legal, advertising-standards, evidence-retention, or client-permission advice.

## Fail-closed design

Migration `web/drizzle/0010_public_claims_registry.sql` owns three private tables and one restricted view:

- `public_claims` stores the stable ID, exact proposed/approved wording, type, source, attribution, review state, verifier, dates, and route/component permissions;
- `public_claim_evidence` stores the evidence description and private reference separately;
- `public_claim_audit_logs` records review and status changes;
- `public_verified_claims` exposes only public-safe fields for rows that are verified, client-approved (or explicitly do not require client approval), evidenced, and still in date.

The web production role receives `SELECT` only on `public_verified_claims`. It cannot query the three base tables. Public components also re-check route, component and expiry placement before rendering. If PostgreSQL or the view is unavailable, the selector returns no claims and the UI either hides the block or uses neutral capability copy.

## Review workflow

1. Sign in to `https://admin.scalesmiths.co.uk/claims` as an owner or administrator. Other roles do not receive claim-management capabilities.
2. Compare the exact public wording with the underlying source. Do not broaden the wording beyond what the evidence proves.
3. Record a useful evidence description and a private reference such as a controlled document-store path, CRM record, signed approval ID, or analytics export location. Do not paste private documents or personal data into the wording.
4. Record whether client approval is approved, declined, pending, or not required. Testimonials and attributed client results should ordinarily have explicit approval.
5. Set the only routes and components where the wording is permitted.
6. Set a future review/expiry date and a reason for the decision.
7. Set `verified` only after the evidence and wording have been checked. The server records the actor and verification time. Every save creates an audit entry.

`draft`, `rejected`, expired-by-date, missing-evidence, and wrongly placed entries are never public. Moving a claim out of `verified` clears its verification actor/time; a later verification is a new decision.

## Evidence handling

Evidence belongs in an access-controlled operational store, not Git, public assets, source data files, provider prompts, logs, or browser responses. The database should contain a reference and a concise non-sensitive description, not the evidence file itself unless a separately reviewed encrypted document system is introduced.

When evidence or client permission is withdrawn, set the claim to `rejected` or `expired` immediately. When wording changes, treat the new wording as a new review decision; do not rely on approval for an earlier sentence.

## Release and incident checks

- Apply web migrations before admin migrations, then rerun PostgreSQL role provisioning so the web role receives view access.
- Confirm draft seed records are absent from `/`, `/pricing`, and case-study pages.
- Verify one staging-only claim through admin, confirm it appears only on its permitted route/component, then return it to draft.
- If an unsupported claim appears publicly, set it to `rejected`, preserve the audit record, invalidate caches/release as required, and investigate whether a component bypassed `public-claims.server.ts`.
- Review expiring records on a scheduled operational cadence. Expiry is enforced at query time even if the stored status has not yet been manually changed to `expired`.

The initial evidence backlog is recorded in `docs/audits/public-claims-evidence-register.md`.
