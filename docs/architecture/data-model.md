# Data model

PostgreSQL is shared by web and admin through one `DATABASE_URL`. Drizzle definitions live in `web/src/lib/schema.ts` and `admin/src/lib/schema.ts`; migrations live in `web/drizzle` and `admin/drizzle`. There is no common schema package.

## Domain map

```mermaid
erDiagram
  CLIENTS ||--o{ KANBAN_CARDS : has
  CLIENTS ||--o{ MESSAGES : has
  CLIENTS ||--o{ PROSPECTS : converted_from
  PROSPECTS ||--o{ OUTREACH_ACTIVITIES : records
  PROSPECTS ||--o{ PROPOSAL_TRACKINGS : tracks
  PROSPECTS ||--o{ SALES_PROPOSALS : receives
  CLIENTS ||--o{ SALES_PROPOSALS : receives
  CLIENTS ||--o{ FORGE_PROJECTS : owns
  PROSPECTS ||--o{ FORGE_PROJECTS : originates
  FORGE_PROJECTS ||--o{ FORGE_TASKS : runs
  FORGE_PROJECTS ||--o{ FORGE_JOBS : queues
  FORGE_PROJECTS ||--o{ FORGE_ARTIFACTS : produces
  FORGE_PROJECTS ||--o{ FORGE_MEMORIES : remembers
  FORGE_PROJECTS ||--o{ FORGE_INTEGRATION_CONFIGS : configures
  FORGE_PROJECTS ||--o{ FORGE_ACTIVITY_LOGS : audits
  FORGE_PROJECTS ||--o{ FORGE_AI_USAGE : spends
  FORGE_TASKS ||--o{ FORGE_AI_USAGE : consumes
  CLIENT_REQUESTS ||--o{ CLIENT_REQUEST_MESSAGES : contains
  CLIENT_REQUESTS ||--o{ CLIENT_TIMELINE_EVENTS : emits
```

## Public/shared operational tables

| Table | Purpose | Ownership notes |
| --- | --- | --- |
| `quote_requests` | Quote lead, qualification fields, consent, delivery state, status | Written by web; read/managed by admin |
| `quote_rate_limits` | Persistent quote throttle | Declared only by web |
| `portal_client_accounts` | Portal client ID, email, bcrypt hash, active state | Declared only by web |
| `login_rate_limits` | Persistent login throttles | Declared by both apps |
| `client_requests` | Portal support/change requests and Forge triage fields | Written by both apps |
| `client_request_messages` | Client/admin/system thread, with visibility | Written/read by both apps |
| `client_timeline_events` | Client-visible/internal operational timeline | Written/read by both apps; `project_id` is not a foreign key |
| `monthly_reports` | Draft/published HTML reports and period metadata | Managed by admin; published records read by portal |

Shared tables are duplicated in TypeScript rather than imported from one package. Schema compatibility depends on manual coordination of migrations.

## Admin CRM and delivery tables

- `clients`: agency clients, contact/tier/MRR/status/progress.
- `kanban_cards`: delivery roadmap cards with client FK, column and position.
- `messages`: basic inbound/outbound client message records; separate from threaded client request messages.
- `prospects`: source/stage/priority, value estimates, audit scores, notes, follow-up and conversion timestamps.
- `outreach_activities`: typed communications/notes for a prospect.
- `proposal_trackings`: commercial package/status/timestamps for a prospect.
- `sales_proposals`: rendered HTML proposal, prices, selected services and prospect/client association.

## Forge tables

| Table | Role |
| --- | --- |
| `forge_projects` | Project identity, CRM links, status, priority, owner and brief summary |
| `forge_tasks` | Agent execution record with structured input/output and error/timestamps |
| `forge_jobs` | Queue item with kind, payload/result, status, attempts and claim timestamps |
| `forge_artifacts` | Versioned typed content and metadata with retention/size fields |
| `forge_integration_configs` | Per-project non-secret integration configuration |
| `forge_activity_logs` | Append-oriented actor/action/message audit trail |
| `forge_memories` | Key/value JSON-like state for workspace, preview, command chat and stage context |
| `forge_ai_usage` | Provider/model/token/cost/timing record linked to project/task where available |

Project deletion cascades to these Forge children. Client/prospect links are set null. Most cross-artifact dependencies are logical conventions in JSON metadata, not relational constraints.

## Enums and state

Important enums define quote status, request category/priority/status, message visibility, report status, CRM stages, proposal status, Forge project/task states, agent types, artifact types, and integration providers. Migration changes to a shared enum affect both applications even when introduced from only one migration history.

## Migration inventory

- Web migrations `0000`-`0008` build quote capture, portal accounts/rate limits, request threads/timeline, and reports.
- Admin migrations `0000`-`0015` build operational CRM, login limits, Forge and runtime hardening, request threads/timeline, reports, and sales proposals.

The histories are independent. Their Drizzle journals do not provide a single global order, despite targeting the same database. Deployment compensates by always running web then admin migrations.

## Integrity and lifecycle gaps

- `client_requests.client_id`, reports, and timeline client IDs are text identifiers without an FK to admin `clients`; portal identity and admin integer client identity are separate concepts.
- `client_timeline_events.project_id` is not constrained to `forge_projects`.
- Forge memories are flexible strings with application-validated JSON; the database cannot enforce value schemas or unique semantic keys unless migrations add constraints not represented as relations.
- Artifact consumers depend on title/type/metadata conventions and can read stale or incompatible records if those conventions drift.
- HTML report/proposal content is persisted; safe rendering depends on trusted generator/admin inputs and rendering discipline.
- No automated cross-app migration test or schema-diff gate exists.

