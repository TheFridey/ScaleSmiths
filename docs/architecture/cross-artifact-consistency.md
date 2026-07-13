# Cross-artifact consistency evaluator

Forge can run a project-wide consistency review through `POST /api/forge/projects/:id/consistency`. The queued `consistency_review` job reads the latest approved, non-superseded artifacts as one snapshot and stores a `consistency_report` artifact.

The evaluator reports structured severity, category, evidence, artifact IDs and exact versions, correction guidance, fix eligibility, review requirement, confidence, and blocking status. It checks facts and conversion intent, sitemap/copy/component coverage, SEO intent, trust/legal signals, brand/tone alignment, provenance freshness, and degraded or fallback dependencies.

Reports are immutable versions. Their provenance contains the evaluator prompt/schema registry versions, source task, actor, source release, and every approved upstream artifact ID and output hash. A later run creates a new report version and supersedes the prior report.

All findings are recommendation-only. `automaticFixEligible` is false and `humanReviewRequired` is true because the evaluator must never change approved client facts. Blocking findings set the evaluator task's publication flag and require resolution or an audited human workflow elsewhere in Forge.
