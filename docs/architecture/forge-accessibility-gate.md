# Forge accessibility quality gate

Forge can run a generated-site accessibility gate through `POST /api/forge/projects/:id/accessibility`. The queued `accessibility_gate` job starts the generated site through the approved preview runner, evaluates critical routes in a browser where Playwright is available, and stores a versioned `accessibility_report` artifact.

The gate checks:

- browser-derived accessibility signals;
- semantic landmarks;
- heading hierarchy;
- keyboard focus visibility;
- form labels and error-message relationships;
- contrast;
- reduced-motion behavior;
- image alt text;
- interactive target sizing;
- modal semantics;
- mobile-menu ARIA state;
- ARIA misuse;
- skip links;
- link purpose;
- document language and title.

Findings include severity, WCAG reference where the rule is confident, page, selector or element, evidence, recommended correction, automatic-fix eligibility, and whether the finding blocks deployment.

## Deployment blocking

Critical accessibility findings set the Forge task to `degraded`, require human approval, and keep `publicationBlocked` true. Deployment readiness already checks task quality blockers, so critical accessibility failures block deployment until corrected.

The only permitted override is an explicit owner approval with a reason through the task quality approval endpoint. Non-owner override attempts are denied and written to the Forge activity log as `accessibility_override_denied`.

## Tooling behavior

The gate fails closed when browser tooling is unavailable. In that case it records a critical finding explaining that Playwright/browser checks did not run, because deployment should not proceed on an unevaluated generated site.

The current implementation is deterministic. It does not send page content, screenshots, or generated source code to an external accessibility service.
