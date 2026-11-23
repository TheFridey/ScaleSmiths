# B2.7 Post-launch hardening: enabled founder review inbox acceptance

**Engineering draft; test-only changes. Production remains at the existing merged release.**

This follow-up targets the remaining acceptance gap in B2.7: earlier CI validated the durable queue functions and existing guarded pages, but did not exercise the *enabled* founder inbox with a persisted task through actual browser interactions.

## Acceptance journey
- Runs only against the disposable localhost:3103 Empower test stack and isolated `ss_empower_browser_e2e` PostgreSQL database.
- Enables `ASCEND_AUTOMATION_ENABLED=true` **only in GitHub's disposable browser test environment**; the production flag is not changed.
- Inserts one clearly synthetic pending review job under a unique UUID and exercises real browser founder sign-in with MFA.
- Checks founder read; denies anonymous and independent-partner GET and POST review actions.
- Verifies pending → claimed → ready → resolved using the production API and browser buttons, against immutable job-event history.
- Asserts the accepted commercial-to-delivery handoff count is unchanged.
- Captures screenshots at 320, 390, 768, 1024, 1440 and 1920px, rejects horizontal overflow, and runs WCAG 2.2 A/AA axe checks.

## Remaining blockers to autonomous production use
No unattended worker, external notification transport, scheduled triggers, approval policy, live monitoring/alerting or separate PostgreSQL 14 rehearsal are supplied here. No customer communications, finance mutations, project creation or release activation is permitted by this test change.

## Release approach
Keep B2.7 production flag **unset/off**. Merge this test-only PR after CI evidence and review; the existing released code requires no redeployment to add a test. Any subsequent runtime feature activation requires a separate review and controlled rollout.
