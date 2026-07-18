# Adaptive experience routing

ScaleSmiths can run a controlled public-site routing experiment for the normal and interactive experiences. The experiment never auto-declares a winner; it only records attribution for review in the internal analytics dashboard.

## Variants

| Variant | Behaviour |
| --- | --- |
| `fullscreen_choice` | Existing first-time full-screen choice gate. This is the rollback default. |
| `normal_with_interactive_cta` | Renders the normal homepage immediately with a slim interactive CTA. |
| `device_recommendation` | Shows the choice gate with a recommendation based on reduced-motion and low-capability signals. It does not auto-route. |
| `returning_preference` | Preserves an explicit stored preference. If no preference exists, it behaves like the normal homepage with an interactive CTA. |

## Configuration

```bash
NEXT_PUBLIC_EXPERIENCE_EXPERIMENT_ENABLED=false
NEXT_PUBLIC_EXPERIENCE_EXPERIMENT_DEFAULT_VARIANT=fullscreen_choice
NEXT_PUBLIC_EXPERIENCE_EXPERIMENT_WEIGHTS=fullscreen_choice:100,normal_with_interactive_cta:0,device_recommendation:0,returning_preference:0
```

Set `NEXT_PUBLIC_EXPERIENCE_EXPERIMENT_ENABLED=true` to enable weighted assignment. Assignment is deterministic from a first-party anonymous experiment ID cookie. Existing variant cookies remain stable. An explicit normal or interactive preference forces the `returning_preference` path. No experiment ID or variant cookie is written while the experiment is disabled, or when GPC, DNT, or the public analytics objection cookie is present.

To roll back, set:

```bash
NEXT_PUBLIC_EXPERIENCE_EXPERIMENT_ENABLED=false
NEXT_PUBLIC_EXPERIENCE_EXPERIMENT_DEFAULT_VARIANT=fullscreen_choice
```

Then redeploy the web app. Existing variant cookies are ignored while the experiment is disabled.

## Guardrails

- Server middleware assigns the variant and forwards it in `x-scalesmiths-experience-variant`.
- The homepage server component renders from the same header used by the client gate, preventing hydration mismatch.
- Explicit visitor preference is preserved through local storage and the first-party `ss_experience_preference` cookie.
- Reduced-motion, coarse pointer, low memory and low hardware concurrency only influence the recommendation label; they never force an interactive redirect.
- `/` is the only canonical normal homepage. The legacy `/traditional` route returns a permanent redirect to `/?experience=normal`; the explicit query makes the normal choice durable without creating another indexable page, and the canonical remains `/`.
- Recognised search crawlers and generic crawler user agents always receive the server-rendered normal homepage with the non-blocking interactive CTA. Crawler requests ignore stored experience and experiment assignments, never receive the fullscreen choice, and do not create experiment cookies.
- `/interactive` remains separately indexable because it contains a useful standalone journey, a no-JavaScript explanation and direct links to the normal site and project enquiry. Its canonical is `/interactive`. Revisit this policy if the route ceases to expose meaningful standalone content.
- Homepage responses are marked `no-store, must-revalidate` so a shared cache cannot serve a human chooser to a crawler or leak one visitor's preference to another. Next.js retains its own `Vary` fields for router payload negotiation; cache safety does not depend on a CDN correctly keying the homepage by user agent or preference cookie. The stable `/traditional` redirect does not depend on a cookie.
- Analytics events include the assigned variant in safe metadata for attribution.
- No personal data, user-agent storage or fingerprinting is introduced.

## Search and sitemap policy

- The sitemap contains `/` once and excludes `/traditional`.
- Sitemap `lastModified` values are source-controlled dates and change only when the associated public content baseline is deliberately updated.
- Service, location and work routes use route-specific canonicals. Query-string variants of `/` canonicalise to `/`.
- `robots.txt` allows the public content and points to the single sitemap; indexing decisions for redirect-only or thank-you routes remain in route metadata.

## Analysis

Use `/operations/experience-analytics` to compare variants and journey outcomes. Treat the dashboard as evidence for human review only. Do not automatically declare a winning experience or reconfigure weights without reviewing sample quality, campaign mix, device mix, accessibility impact and quote quality.
