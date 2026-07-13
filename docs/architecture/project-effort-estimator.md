# Project Effort and Quote Estimator

The internal project estimator creates non-client-facing estimate snapshots from approved Forge project data.

## Inputs

Known inputs are read from current Forge state where available:

- Approved sitemap, copy, component spec and generated routes for page count.
- Enabled integrations.
- Project goal, budget range, industry and deadline.
- QA and Visual QA findings.
- Approved artifact count.
- Degraded or fallback task/artifact count.

The estimator separates assumptions from known inputs. For example, if e-commerce, authentication, 3D, photography or content migration are not detected in approved project data, they are listed as assumptions rather than silently treated as facts.

## Outputs

Each snapshot records:

- Estimated hours.
- Confidence range and confidence level.
- Complexity rating.
- Risk factors with hour impact.
- Suggested build price and monthly retainer.
- Minimum viable scope.
- Optional enhancements.
- Estimated delivery range.
- Margin estimate.
- Underpricing risks.
- Model version.

Estimates are internal guidance only. They are not fixed quotes, delivery guarantees or client-facing promises until scope, exclusions, approval responsibilities and commercial terms are confirmed.

## Manual Adjustment

Owners or authorised Forge configurators can save manual hours, build price and retainer values with a reason. The original deterministic estimate is preserved so future calibration can compare:

- deterministic estimate,
- human-adjusted estimate,
- actual delivery effort.

## Actuals and Calibration

After delivery, record actual hours, build price, retainer and calibration notes. As project history grows, these records can be used to tune factor weights, risk hours, margin assumptions and confidence spread.

## Underpricing Rules

High-risk work should be priced, excluded or moved into optional phases. Do not absorb unapproved pages, integrations, migration work, 3D, authentication, admin tools, client delay or repeated approval cycles inside the base build price.
