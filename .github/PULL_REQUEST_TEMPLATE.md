<!--
Keep this honest and short. Reviewers need evidence, not ceremony.
Delete the guidance comments as you fill each section in.
`npm run check:pr-metadata` runs on every pull request and checks this template
is actually completed. Run it locally with GITHUB_EVENT_PATH set if you want.
-->

## Summary

<!-- What changed, and why. Two or three sentences. Not the branch name. -->

## Type

- [ ] `feat`
- [ ] `fix`
- [ ] `test`
- [ ] `docs`
- [ ] `refactor`
- [ ] `security`
- [ ] `perf`
- [ ] `chore`

## Scope

- [ ] Public web
- [ ] Admin
- [ ] Forge
- [ ] Database/migrations
- [ ] Docker/deployment/Nginx
- [ ] CI/tooling
- [ ] Documentation only

## Validation

Commands run, with results:

```text

```

Commands not run, and why:

```text

```

## Migrations

- [ ] No database migration.
- [ ] Migration included and documented below.

<!-- If a migration is included: order, forward/backward compatibility, rollout notes. -->

## Environment

- [ ] No environment-variable change.
- [ ] Environment variables added to `.env.example` and documented below.

<!-- If variables changed: name, purpose, and which app and environment needs them. -->

## Security and Privacy

- [ ] No secrets, provider credentials, real `.env` files, database dumps, or
      client-private exports are included.
- [ ] Admin/Forge access control and generated-workspace isolation are preserved.
- [ ] Public analytics remains minimised and consent-aware.

<!-- Note anything touching auth, MFA, RBAC, sandboxing, egress, or client data. -->

## Evidence

<!--
Required for visual, operational, or workflow-heavy changes: screenshots, run IDs,
logs, or artifact links. Write "Not applicable" and say why if the change is purely
internal.
-->

## Residual Risk and Follow-up

<!--
What could still bite us, and what is deliberately deferred. Write "None" if there
genuinely is nothing. Do not leave this empty.
-->

## Rollback

<!--
How to undo this safely. Required when the change touches migrations, deployment,
Nginx, auth, or release tooling. Write "Not applicable" otherwise.
-->
