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
- The interactive route remains at `/interactive`; canonical metadata and sitemap entries are unchanged.
- The default homepage remains canonical `/`, so crawlers do not receive unstable redirect tests.
- Analytics events include the assigned variant in safe metadata for attribution.
- No personal data, user-agent storage or fingerprinting is introduced.

## Analysis

Use `/operations/experience-analytics` to compare variants and journey outcomes. Treat the dashboard as evidence for human review only. Do not automatically declare a winning experience or reconfigure weights without reviewing sample quality, campaign mix, device mix, accessibility impact and quote quality.
