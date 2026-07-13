# Continuous optimisation proposals

ScaleSmiths can generate controlled improvement proposals for active retainer clients from approved post-launch analytics and website outcome evaluations.

The system is intentionally advisory. It records evidence, approval and measurement; it does not alter live client websites automatically.

## Inputs

Proposal generation uses the client analytics summary and website outcome evaluator.

Typical evidence sources include:

- aggregate sessions, conversions, form submissions, phone clicks and CTA clicks;
- Search Console clicks and impressions;
- Core Web Vitals snapshots;
- uptime and error rollups;
- explicit data-quality gaps.

Only active clients with monthly recurring revenue are treated as retainer clients for proposal generation.

## Proposal content

Each proposal records:

- evidence and source attribution;
- expected impact;
- confidence;
- estimated effort;
- risk;
- proposed change;
- validation method;
- rollback plan;
- required approval;
- relevant pages and artifacts where known;
- target metric and baseline value where available.

Common proposal categories include CTA improvements, missing tracking, local SEO strengthening, page-speed work and investigation of high-traffic low-conversion pages.

## Workflow

1. Outcome evaluation identifies evidence-backed findings and gaps.
2. Continuous optimisation converts suitable findings into proposals.
3. An internal user can track a generated proposal.
4. The proposal can be accepted, rejected or marked completed.
5. After implementation through the normal approved delivery path, a measured value can be recorded.
6. The system compares the measured value with the baseline and stores whether the intended metric improved.

Accepting a proposal is approval to progress the proposal through delivery planning. It is not approval for an automatic live-site edit.

## Audit and safety boundaries

Proposal actions write to the client analytics audit log. Audit metadata explicitly records that no automatic website change occurred.

The proposal layer must not:

- deploy changes;
- write to a live website repository;
- invent missing analytics;
- make causal claims without evidence;
- reuse client-specific feedback across unrelated clients.

## Operations

Run the admin migration before using the feature:

```bash
cd admin
npm run db:migrate
```

Run focused tests:

```bash
cd admin
npm run test -- continuous-optimisation website-outcome-evaluator client-analytics
```

## Residual limitations

Current measurement is manual: an authorised internal user records the post-change metric value. Provider-specific automated attribution can be added later through the analytics adapter layer once a client has consented to the relevant source.
