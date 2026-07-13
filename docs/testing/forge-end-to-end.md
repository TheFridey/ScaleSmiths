# Forge end-to-end workflow

Run the complete deterministic Forge lifecycle from the repository root:

```bash
npm run test:forge-e2e
```

The runner creates an isolated Docker Compose project and PostgreSQL database, applies the real Drizzle migrations, bootstraps a test owner, starts Admin on `127.0.0.1:3301`, authenticates through Auth.js, and drives the Forge HTTP routes. It always stops the server and removes the disposable database volumes.

The Oak & Hearth Property Care fixture covers client and project creation, guided intake, research review, sitemap revision, copy rejection/regeneration, design and component generation, workspace generation, QA, repair, proposal generation, deployment blocking, explicit fallback approval, activity logs, and artifact provenance.

The QA fixture deliberately changes a generated readonly TypeScript declaration. The first QA run must fail, the deterministic repair must restore the declaration, and the second run must complete install, typecheck, lint, and production build. Failures name the lifecycle stage and include the route response or QA command diagnostics.

Safety properties:

- The database URL is fixed to the loopback-only integration database unless `TEST_DATABASE_URL` passes the existing integration-test safety validation.
- AI is forced to the deterministic mock provider; no provider credentials are needed.
- Jobs run inline so route responses are deterministic.
- Generated workspaces remain under `generated-sites` and are never served publicly by the test.
- The test-only QA controls are set only in the child Admin process created by the runner.

On Windows, generated dependency installation can be slower and locked partial `node_modules` directories may need antivirus/indexer exclusions. The harness removes transient dependencies before the explicit repair cycle and reports npm output if installation cannot complete.
