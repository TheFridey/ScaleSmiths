# Daily operating brief

The admin daily operating brief lives at `/operations/brief`. It is generated from current admin data and is intentionally concise: it highlights the highest-value operating actions, links every recommendation to supporting records, and keeps low-risk work in a separate “can safely wait” section.

## Inputs

- Prospects, lead-score snapshots and proposal tracking.
- Client requests and recent client messages.
- Forge projects and Forge task quality/status.
- Client MRR and account status.
- Prior brief actions in `operating_brief_actions`.

## Recommendation rules

The brief answers:

- what requires attention today;
- which lead is most valuable to contact;
- which project is blocked;
- which client has waited too long;
- which Forge task failed or degraded;
- which proposal needs follow-up;
- which deadline is at risk;
- which retainer client may be disengaging;
- today’s highest-value action;
- what can safely wait.

Recommendations are deterministic and evidence-backed. They do not invent urgency, testimonials, outcomes or external engagement data. Retainer disengagement is inferred only from internal admin records and is labelled with lower confidence when direct engagement evidence is thin.

## Dismissal, completion and snoozing

Each recommendation has:

- a stable recommendation key;
- an evidence hash based on supporting records;
- an action state: dismissed, completed or snoozed.

Dismissed and completed recommendations stay hidden while the evidence hash is unchanged. If the supporting record changes, the recommendation may return because it is no longer the same evidence.

## RBAC

Viewing the brief requires `projects.read`. Mutating action state requires `projects.write` through `/api/operations/brief`.

## Migration

Run the normal Drizzle migration flow. This stage adds:

- `operating_brief_action_status`
- `operating_brief_actions`
