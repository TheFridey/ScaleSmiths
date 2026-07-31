# Public homepage visual review candidate

Status: **resolved — baselines inspected and accepted**

> **Resolution (2026-07-31).** This review is closed. The mobile experience-control
> placement flagged below was fixed in `9821074` ("fix(web): prevent mobile experience
> controls overlap") rather than accepted as-is, and the inspected desktop, tablet and
> mobile baselines were committed in `b9b6be2a` ("test(web): accept inspected mobile
> homepage baseline"). The web visual regression gate passes on merged `master`
> `5ac4bacd` (CI run `30588532289`) with the 0.02 maximum difference ratio unchanged.
> The record below is retained as the point-in-time inspection evidence for that
> decision.

Source run:

- Commit: `86cfc75b40022a66dd9fd2a15d40e74d54295a37`
- GitHub Actions artifact: `web-playwright-artifacts-8762900753`
- Route: `/`
- Experience: normal
- Motion: reduced
- Canvas and known visual noise: disabled by the existing visual-test helper

## Measured differences

| Viewport | Different pixels | Ratio | Candidate files |
| --- | ---: | ---: | --- |
| Chromium desktop | 68,072 | 0.05 | [expected](public-homepage-86cfc75/desktop-expected.png), [actual](public-homepage-86cfc75/desktop-actual.png), [diff](public-homepage-86cfc75/desktop-diff.png) |
| Chromium tablet | 41,804 | 0.06 | [expected](public-homepage-86cfc75/tablet-expected.png), [actual](public-homepage-86cfc75/tablet-actual.png), [diff](public-homepage-86cfc75/tablet-diff.png) |
| Chromium mobile | 7,149 | 0.03 | [expected](public-homepage-86cfc75/mobile-expected.png), [actual](public-homepage-86cfc75/mobile-actual.png), [diff](public-homepage-86cfc75/mobile-diff.png) |

The configured maximum difference is 0.02, so all three checks correctly failed closed.

## Inspection notes

The differences are stable across the initial run and both retries. They align with the intended homepage information-architecture change rather than animation, font-loading, or canvas noise:

- the hero now exposes the `FORGE YOUR / DIGITAL EDGE` heading instead of leaving the heading visually absent;
- the hero has one primary `Request a Quote` action and one secondary `View Work` action;
- the discovery-call and services buttons have moved out of the hero;
- desktop navigation now exposes the Local Growth, Custom Systems, and About routes;
- the availability message changed to `Plan your next digital project`;
- the verified project-count claim is rendered as one evidenced claim instead of a three-metric strip;
- mobile uses the same hierarchy and remains single-column without horizontal overflow.

No unexpected overlay, clipped primary action, horizontal overflow, or canvas residue is visible in the candidate captures. The fixed `Switch experience` and `Reset experience preference` controls are test-visible product controls; on the mobile capture they sit close to the claim at the bottom of the viewport and deserve explicit human acceptance before any baseline change.

## Approval decision required

Do not copy these files into `web/tests/e2e/public-site.visual.spec.ts-snapshots` until a human reviewer:

1. inspects all expected, actual, and diff images above;
2. accepts the new hero/navigation/claim hierarchy at all three widths;
3. specifically accepts or requests adjustment to the mobile preference-control placement;
4. records the decision and reviewer in this document.

Those steps were completed as recorded in the resolution note at the top of this document, so the visual regression gate is no longer a release blocker.

The overall release verdict remains **BLOCKED — DO NOT DEPLOY** for unrelated reasons: the production-derived encrypted backup restore and the authorised manual production checks are still outstanding. See `docs/release-readiness/forge-v2.md`.
