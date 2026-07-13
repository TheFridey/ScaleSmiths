# Proposal Personalisation Engine

Forge proposal generation now uses project evidence rather than generic sales copy.

## Evidence Sources

Proposal bundles may draw from:

- Linked prospect pain points, objections, opportunity notes and outreach/discovery activity.
- Project goals, industry, audience, brand notes and budget range.
- Intake answers.
- Research trust gaps, conversion gaps, recommended pages and opportunities.
- Approved sitemap/copy/component scope where available.
- SEO, generated-site and QA evidence.
- Internal project estimate snapshots for price, retainer, delivery range, assumptions, risks and optional enhancements.

Each proposal stores a supporting-record map that links sections back to the source record type and identifier where available.

## Scope and Safety

The proposal generator is deterministic. It must not invent:

- results,
- rankings,
- revenue,
- traffic,
- testimonials,
- statistics,
- accreditations,
- guarantees.

Every promise must be traceable to approved scope or phrased as an assumption requiring confirmation. Good/better/best options separate included scope from optional enhancements.

## Versioning and Responses

Each generated proposal is saved as a versioned Forge artifact. Older proposal versions are superseded but retained through artifact lineage.

Internal approval and client responses are recorded against the latest proposal artifact:

- internal approval: approved or rejected with reason;
- client response: accepted, changes requested, declined or no response.

This preserves proposal history while allowing later reporting on proposal acceptance and revision quality.
