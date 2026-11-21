# Operation Launch Ready: UX review

Scope covered: the founder recruitment workspace, partner activation, the partner agreement page and the partner first-login overview. The public website received only the Partner Login fix (`partners.scalesmiths.co.uk`, PR #158). **A broad premium visual pass of the public site was not carried out in this branch**; see the release-readiness report.

## Before and after

| Area | Before | After |
|---|---|---|
| Applicant directory | One long list, all statuses, no search or filters, raw status words | Status chips with counts (default "Open"), search across name, email, region and industry, country and date filters, a result count announced to screen readers, plain-language status pills |
| Review decision | Any status offered, confirmations cleared on each save, single click | Only legal next moves, confirmations pre-filled with what is recorded, outstanding checks listed, internal notes and applicant message clearly separated, second-press confirmation with an audit warning |
| Invitation | Free-text "agreement version" field | Choose a published agreement (title, version, review date); disabled with guidance when none exists; optional email; confirmation step |
| Agreements | None visible | Register of issued and accepted versions per partner, status pills, download links; audit history table |
| Activation | Password only | Three-step progress (invitation, read and accept, active), full agreement in a focusable scroll region, acceptance unlocked at the end, typed legal name, password confirmation, plain notice that this is not a qualified electronic signature, focus moved to each new heading |
| Partner first login | Metrics, then "Register a business" | "Your next steps" with progress bar, agreement status, only switched-on modules, a clear first action |
| Partner agreement | None | Current status, action-needed callout, reissued text with acceptance, history, downloads, loading skeleton, retryable error |

## Interaction and motion

Hover and pressed states on buttons, chips, next-step cards and table rows; a 160 ms colour and elevation transition; a 1 px press offset; the confirmation panel rises in (transform only; an opacity fade was removed after it failed contrast mid-animation); progress-bar transition; skeleton shimmer. Every motion stops under `prefers-reduced-motion`. Focus rings are visible gold outlines.

## Responsive results

Screenshots at 390, 768, 1024 and 1440 px are in `evidence/`: `founder-recruitment-*`, `activation-welcome-*`, `activation-agreement-*`, `partner-first-login-*` and `partner-agreement-*`. The browser test asserts no horizontal overflow at each width. Touch targets are at least 44 px; text inputs use 16 px to avoid iOS zoom.

Known limitation: the admin shell scrolls an inner container, so full-page captures of the founder workspace show the viewport rather than the whole panel. The register's "Download" cell wrapped mid-word at 1440 px in the first capture; fixed in CSS after capture (`f0aeb81`); not re-captured.

## Accessibility (WCAG 2.2 AA where practicable)

- axe (wcag2a, 2aa, 21aa, 22aa): no serious or critical findings on the review confirmation, founder recruitment, activation welcome, activation agreement and partner agreement views.
- Semantic structure: labelled sections, table captions, `scope` on headers, `aria-pressed` filter chips, `role=alertdialog` confirmation with autofocus on the confirm action, `role=status` and `role=alert` messages, `progressbar` with values, step lists with `aria-current`.
- Colour is never the only signal: every pill and step carries its text, and done steps add a visually hidden "Done:".
- Not verified: screen-reader walkthroughs with NVDA or VoiceOver, and Windows high-contrast mode.
