# Experience-choice analytics

ScaleSmiths records first-party, privacy-minimised events for the public normal-versus-interactive experience journey. The purpose is to compare journey usefulness and conversion behaviour, not to identify individual visitors.

## Privacy boundary

- No tracking cookies are created.
- A random session ID is stored in `sessionStorage`, so it is scoped to the browser tab/session.
- IP addresses, user agents, raw form fields, names, emails, phone numbers and full referrer URLs are not stored.
- Referrers are reduced to hostname only.
- Campaign attribution is limited to lawful `utm_source`, `utm_medium` and `utm_campaign` values already present in the URL.
- Browser privacy signals `Sec-GPC: 1` and `DNT: 1` skip ingestion.
- The public privacy page provides a free browser-specific objection control. It writes `ss_analytics_opt_out=1`, clears analytics session/experiment identifiers, and is enforced by both the client tracker and ingestion route.
- Events are sent to the first-party `/api/experience-events` route only.

## Event taxonomy

| Event | Meaning |
| --- | --- |
| `experience_choice_displayed` | First-time choice gate was displayed. |
| `experience_normal_selected` | Visitor selected the normal website. |
| `experience_interactive_selected` | Visitor selected the interactive experience. |
| `experience_choice_abandoned` | The choice gate was left before a choice was recorded. |
| `experience_returning_preference` | A stored normal or interactive preference was found. |
| `experience_switched` | Visitor switched or reset experience preference. |
| `quote_cta_clicked` | A quote/start-project CTA was clicked. |
| `quote_form_started` | A quote form field or option was first interacted with. |
| `quote_form_submitted` | A quote form submission completed successfully. |
| `navigation_exit` | Visitor left the interactive journey or clicked an external navigation target. |
| `interactive_completion_depth` | Visitor reached a tracked interactive journey step. |
| `experience_fallback_activated` | Interactive fallback was activated, such as disabled canvas. |
| `experience_error` | A safe error category occurred in the journey. |

## Stored fields

Each row stores the stable event name, duplicate-suppression key, anonymous session ID, path without query string, coarse device class, preference state, optional from/to experience state, interactive step/depth, referrer host, campaign labels, safe error category and short allowlisted metadata.

## Dashboard

The internal dashboard is available at `/operations/experience-analytics`. It shows the last 30 days of aggregate event data:

- choice views, selections and abandonments;
- normal versus interactive quote submissions;
- returning preferences and switching;
- average interactive completion depth;
- fallbacks/errors;
- device and campaign breakdowns.

The dashboard intentionally does not expose visitor-level records.

## Browser storage and objection

The tracker uses `scalesmiths.analytics.session` and `scalesmiths.analytics.sent` in `sessionStorage` to group a tab session and suppress duplicate events. The controlled routing experiment uses `ss_exp_id` and `ss_exp_variant` only while the experiment is enabled. Disabled experiments, GPC/DNT requests, and explicit analytics objections do not receive experiment assignment cookies. Functional experience and portal-session storage is documented separately on the public privacy page.

The implementation is intended to stay within the narrow UK statistical-purpose exception: first-party improvement only, no advertising, no cross-site tracking, no visitor profiling, transparent fields, and a simple objection route. Event-level retention and the production deletion process still require professional legal review and an owned operational schedule before final publication.

## Migration

Run the web migrations so the public application can write `experience_events`:

```bash
cd web
npm run db:migrate
```

If the admin application is deployed separately, deploy it after the migration so the dashboard schema is available.
