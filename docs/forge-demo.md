# ScaleSmiths Forge Demo Project

Stage 27 provides a safe end-to-end Forge demo for a realistic local service business:

- Business: Nottingham HomeCare Repairs
- Services: emergency repairs, landlord maintenance, decorating, small works, pre-sale snagging
- Audience: homeowners, landlords, letting agents, and property managers around Nottingham
- Mode: mock-only by default; no live AI, Resend, npm install, or deployment is required

## Seed or Dry Run

From the admin app:

```bash
cd admin
npm run forge:demo -- --dry-run
```

The dry run verifies that the demo can be assembled in mock mode without `DATABASE_URL`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `RESEND_API_KEY`.

To seed the admin database:

```bash
cd admin
npm run forge:demo
```

Use `--reset` to delete and recreate the demo project:

```bash
npm run forge:demo -- --reset
```

The seeded project is idempotent. Without `--reset`, the script reuses the latest project named `Forge Demo - Nottingham HomeCare Repairs`, refreshes its tasks, artifacts, integrations, activity log, and generated workspace, then prints the `/forge/[id]` admin path.

## What The Demo Simulates

The seed creates a complete Forge trail:

1. Intake completed with a structured website brief.
2. Research report generated from intake in mock mode.
3. Sitemap and strategy generated and approved.
4. Copy document generated and approved.
5. Design direction generated and approved.
6. Component specification generated and approved.
7. Generated-site workspace written under `generated-sites/`.
8. QA report marked passed in mock mode.
9. Proposal and audit pack generated.

It also creates Resend and WhatsApp integration configs in test/demo form. API keys are not stored in project memory, artifacts, generated source, or integration config.

## Admin Walkthrough

1. Start the admin app and sign in.
2. Open `/forge`.
3. Open the project named `Forge Demo - Nottingham HomeCare Repairs`.
4. Review the cockpit sidebar to confirm stages are populated.
5. Open artifact tabs in this order: Research, Sitemap, Copy, Design, Code, QA, Proposal.
6. Open the Intake area and confirm the brief has complete local-service information.
7. Check Integrations Health for Resend and WhatsApp demo configuration.
8. Check Recent Activity for create, AI task, generated files, QA, and proposal events.
9. Open the generated workspace at `generated-sites/[project-id]-nottingham-homecare-repairs`.
10. Treat this as an internal demo only; do not deploy it as a client site.

## Screenshot Placeholders

Screenshots are environment-specific, so they are not committed. Capture these after seeding:

- `docs/screenshots/forge-demo-list.png` - Forge project list showing the demo project.
- `docs/screenshots/forge-demo-cockpit.png` - Project cockpit with stage sidebar, artifacts, chat, and preview rail.
- `docs/screenshots/forge-demo-intake.png` - Intake summary/completeness view.
- `docs/screenshots/forge-demo-artifacts.png` - Artifact tabs showing Research/Sitemap/Copy/Design.
- `docs/screenshots/forge-demo-qa.png` - QA drawer/report showing mock pass.
- `docs/screenshots/forge-demo-workspace.png` - Generated workspace file tree.

Suggested capture flow:

```bash
mkdir -p docs/screenshots
```

Then use the browser or Playwright against the local admin URL. Keep real client data out of screenshots.

## Clean Mock Environment Check

This should work without live provider keys:

```bash
cd admin
FORGE_ENABLE_AI=false FORGE_DEFAULT_AI_PROVIDER=mock npm run forge:demo -- --dry-run
```

On PowerShell:

```powershell
cd admin
$env:FORGE_ENABLE_AI="false"
$env:FORGE_DEFAULT_AI_PROVIDER="mock"
npm run forge:demo -- --dry-run
```

Expected output includes:

- `AI provider mode: mock`
- `Stages simulated: intake, research, sitemap, copy, design, component spec, site generation, QA, proposal`
- `No database writes, live AI calls, Resend calls, npm installs, or generated-site builds were performed.`

## Safety Notes

- The demo script never calls OpenAI, Anthropic, Resend, WhatsApp, npm install, or deployment commands.
- Generated files are written only under `generated-sites/`.
- The demo workspace is intentionally compact and exists to prove the Forge workflow, not to represent a finished client build.
- Keep `FORGE_ENABLE_AI=false` when validating a fresh VPS or local machine.
