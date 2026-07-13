# Forge Structural Originality Evaluator

The structural originality evaluator checks generated websites for unacceptable cross-client templating without comparing or exposing private client content.

It builds a normalized fingerprint from generated-code artifact metadata:

- route shapes, not page copy
- component and section sequence labels
- hero composition label
- card-grid, testimonial, CTA and animation pattern labels
- estimated centred-layout ratio and rhythm signature
- style-system key and industry label

The evaluator distinguishes:

- appropriate design-system consistency
- legitimate industry conventions
- unacceptable cross-client templating

Findings include similarity score, evidence, matching project/artifact ids, matching structural patterns, suggested composition changes and whether human review is required. It intentionally does not include another client's copy, business facts, prompts, screenshots or generated source code in the report.

Reports are stored as versioned `originality_report` Forge artifacts with provenance. A high similarity score or unacceptable templating classification blocks downstream use until reviewed.
