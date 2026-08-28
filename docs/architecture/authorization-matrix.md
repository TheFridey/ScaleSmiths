# Admin authorization matrix

The executable source of truth is `admin/src/lib/authorization-policy.ts`. The companion `authorization-policy.test.ts` inventories the real App Router handler exports and fails when an HTTP operation is absent from policy.

## Decision contract

- Unauthenticated protected API requests return **401** in middleware.
- Authenticated users without the required capability receive **403**.
- Unknown `/api/*` operations fail closed, even for an owner.
- Capabilities, not role names, are the operation contract.
- Handler guards and service/database validation remain defence in depth for ownership and client scope.

## Policy families

| Domain | Capability expectation | Scope |
| --- | --- | --- |
| Admin identity and MFA | `admin_users.*`, `settings.manage` | Admin identity/current user |
| Portal accounts | `portal_users.*` | Explicit portal-client link |
| Client management | `clients.read/write` | Route client/request owner |
| Finance and reporting | `finance.read/write`, `analytics.read/write` | Invoice/report client association |
| Sales | `leads.read/write` | Selected prospect/proposal |
| Forge projects/workflows | `projects.*`, `forge.*` | Project, run, job, task and artifact graph |
| Configuration/audit | `forge.configure`, `audit.read` | Project or filtered global data |
| Release/deployment | `deployments.execute`, action-specific `forge.approve` | Project candidate evidence |
| Operations | `projects.read/write` | Internal project data |

Every resolved operation carries its route, method, domain, capability, scope rule, authentication expectation, and allow/deny behaviour. Protected identifiers such as `clients.portal_client_id` and invoice client codes are absent from generic client update DTOs. Credential reset operations use dedicated capabilities and cannot be mixed with ordinary account edits.

## Verification

From `admin/` run:

```powershell
npm run check:authorization-policy
```
