# Forge migration analysis

The migration-analysis stage converts the current approved `site_inventory` artifact into a versioned, review-only `migration_analysis` artifact. It is started through `POST /api/forge/projects/{projectId}/migration-analysis` by an authenticated actor with `forge.execute`.

The stage refuses an unapproved or superseded inventory. Provenance records the exact inventory artifact ID, version, output hash, analysis task, actor, deterministic rules version, prompt/schema registry versions, and output hash.

## Report

The report contains the existing sitemap; duplicate, thin, broken, stale and metadata findings; current service hierarchy; geographic signals; missing trust evidence; assets; contact conflicts; a conservative proposed sitemap; old-to-new mapping; proposed redirects; content migration actions; client-verification requirements; high-value pages; and ranking risks.

Every recommendation carries evidence, confidence, source URL, proposed action, severity and an explicit human-review requirement. A failed fetch is labelled unverified rather than confirmed broken. Commercial pages are treated as potentially high-value, but analytics, Search Console, backlink and ranking evidence must be reviewed before URL or consolidation decisions.

## Safety

This workflow does not modify the crawl source, generated workspace, sitemap, content, deployment configuration, or redirect configuration. Redirects are proposals with status `proposed`; no redirect is installed. Output quality is `requires_review`, downstream execution is disabled, publication is blocked, and the artifact remains unapproved until reviewed.

Apply migration `0032_migration_analysis.sql` before enabling the job.
