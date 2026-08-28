# Admin RBAC policy

`admin/src/lib/rbac.ts` is the authoritative role/capability policy. Pages, APIs, server actions, navigation, UI controls, and query-scope checks must call this module or the server wrappers in `admin/src/lib/server/rbac.ts`. Do not add role-name checks in product features; owner-only identity invariants remain in the identity domain because they protect the ownership model itself.

```mermaid
flowchart LR
  Request --> Identity[Active identity and session version]
  Identity --> Policy[Role capability matrix]
  Policy -->|allowed| Handler[Page, API, action, or query]
  Policy -->|denied| Audit[403 or redirect plus audit log]
  Policy --> Navigation[Navigation and control visibility]
```

## Capability matrix

| Role | Capabilities |
| --- | --- |
| owner | all capabilities |
| administrator | internal admin read/manage; portal read/manage/credential reset; all other capabilities except internal owner assignment and internal credential reset; cannot bypass final-owner invariants |
| sales | leads read/write, clients read, projects read, finance read |
| project_manager | portal users read/manage, leads read, clients read/write, projects read/write, Forge read/execute/approve/configure, finance read, audit read |
| developer | clients read, projects read/write, Forge read/execute/approve/configure, audit read, deployments execute |
| finance | leads read, clients read, projects read, finance read/write, audit read |
| viewer | leads read, clients read, projects read, Forge read, finance read |

Identity capabilities are deliberately separate: `admin_users.read`, `admin_users.manage`, `admin_users.credentials.reset`, `admin_users.owner.assign`, `portal_users.read`, `portal_users.manage`, and `portal_users.credentials.reset`. The remaining capabilities are `leads.read`, `leads.write`, `clients.read`, `clients.write`, `projects.read`, `projects.write`, `forge.read`, `forge.execute`, `forge.approve`, `forge.configure`, `finance.read`, `finance.write`, `settings.manage`, `audit.read`, `deployments.execute`, `analytics.read`, `analytics.write`, `claims.read`, and `claims.manage`.

Internal identities are available at `/users` and `/api/admin-users*`; external client identities are available at `/portal-users` and `/api/portal-users*`. A portal manager cannot reach internal identity data or mutations. Reads and ordinary mutations use distinct capabilities. Credential resets are body-dependent operations and are guarded again inside each API handler; portal reset payloads cannot be combined with email or status mutations. Internal owner assignment, password reset, and MFA invalidation remain owner-only domain invariants.

## Enforcement

Node middleware reloads the persisted user, validates session version/active status, maps the request path and method to a capability, and rejects denied APIs with 403 before the handler runs. Denied pages redirect to the dashboard. Sensitive path rules for audit exports, Forge integrations, approvals, and deployment execute before generic Forge rules. Body-dependent actions additionally call `guardApiCapability` inside the handler.

Server helpers:

- `requireCapability`: base server guard;
- `guardPageCapability`: redirecting page guard;
- `guardApiCapability`: API handler guard;
- `guardServerActionCapability`: server-action guard;
- `requireQueryScope`: capability plus database-scope assertion;
- `hasCapability`, `isNavigationVisible`, and `canUseControl`: client-safe policy decisions.

Current business tables have no per-admin ownership columns, so authorised database scope is `global`; unauthorised scope is `none`. Introduce explicit tenant/assignee ownership before adding row-level filters.

Every denied request emits a redacted structured warning and monitoring message with actor ID, role, capability, method, pathname, and request ID. No request body is included.

## Change control

Any new API route must map to a capability. The RBAC tests enumerate non-auth route files and fail if a route has no GET or POST policy. Changes to roles or capabilities must update the explicit matrix test and receive a security review.
