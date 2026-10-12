# Admin workspace redesign

The private admin remains one Next.js application. The redesign uses the existing routes, capabilities and shared PostgreSQL schema.

## Workspace behaviour

- Navigation supports page search and independently expanded sections. The active section opens when the route changes. The authenticated server actor supplies navigation capabilities immediately, avoiding an empty sidebar during session fetching.
- Pipeline opens as a searchable list. The board remains available with readable, fixed-width columns and horizontal scrolling. All stages are represented, including the newer qualification and negotiation stages.
- The selected prospect appears alongside the list at desktop widths. Its stage, conversion and follow-up controls appear before long forms. Details, activity, proposals and scoring are separate panels. Changing prospects remounts the editor so another record's uncontrolled form values cannot remain visible.
- At narrow widths, selecting a prospect scrolls to its details. Reduced-motion preferences are respected.
- Forge operations summarises active, degraded and offline workers instead of repeating every heartbeat state. Offline history remains available. Dead letters are prioritised, tables have bounded scrolling, and recovery is reachable from the header.
- Recovery continues to require its exact confirmation phrase and server capability. Network failures release the busy state and produce a visible error.
- Forge view navigation restores the overview for URLs without a view parameter. Context drawers contain keyboard focus and restore it on close.
- The current gold brand mark is used for the shell, favicon and installed application icons. Only the exact non-sensitive favicon asset is newly public.
- Login and home navigation select an existing route permitted by the user's role. No role receives a new capability.

## Release repairs

The failing GitHub runs identified four groups of problems: stale E2E landing expectations, public transfer budgets, vulnerable dependencies and unpublished Docker OpenSSL pins. The change updates the framework and matching governance policy/lockfiles, fixes the E2E route expectations, compresses the existing licensed variable fonts as WOFF2 without removing glyphs, and pins the published OpenSSL 3.5.9 and zlib 1.3.2-r1 packages. Performance budgets and security thresholds remain unchanged.

## Verification boundaries

Verification uses a separate checkout and a guarded disposable database provisioned by the canonical shared migrator. No production records, provider credentials, public previews or real-money actions are used.

Local checks include app lint/typecheck/build, focused role/asset boundaries, the existing unit suites, root policy tests and a production browser audit. The original Windows outbound-network tests have three timeout-versus-immediate-failure assertions that also fail with the previous Undici version; the unchanged 25-test file passes in an isolated Linux container with its documentation-range addresses configured. GitHub CI supplies independent Linux and end-to-end release evidence on the pull request.

Merge and deployment remain separate from local and CI verification. Existing production dead letters are retained for operator investigation; a visual redesign does not establish that a historical job can safely be retried.

## Public visual baseline review

The Linux public snapshots were captured before the previous self-hosted-font change. Ten affected snapshots are refreshed from CI run 38253741713 after reviewing the architecture layout and cookie-choice screenshots. Each received image was byte-identical across all three attempts. The WOFF2 conversion preserves the existing TTF horizontal metrics, variation axes and glyph order for both fonts. No visual comparison tolerance, assertion or screenshot test is removed.
