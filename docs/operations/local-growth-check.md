# Local growth check funnel

`/local-growth-check` is a low-friction public acquisition route for local and referral prospects. It does not replace the detailed `/quote` wizard and does not advertise a lower or privately negotiated price.

## Data and security path

The page submits to `/api/quote` and therefore reuses the existing body-size limit, explicit enquiry consent, honeypot, persistent hashed IP/email rate limits, generic public errors, PostgreSQL persistence, lead scoring, email-status tracking, monitoring, and fail-open Resend behaviour. It does not create a separate lead store.

The server recognises the funnel only from `funnelType=local_growth_check`, validates the short required field set, validates optional public HTTP(S) URLs and phone syntax, and then sets these authoritative values:

- `lead_source=local_growth_check`
- `funnel_type=local_growth_check`
- `enquiry_intent=local_growth_check`
- `project_type=Local Growth Check`

Client-supplied source labels cannot turn an incomplete full-quote payload into a local-growth submission. The admin Messages view shows the source, funnel, phone and requested next step.

## Notifications and analytics

The confirmation says a founder will review the supplied public information and goal, makes clear that no full build is required, and gives no guaranteed response time. Email failure never removes the persisted enquiry.

The privacy-minimised event taxonomy records page view, first interaction, successful submission, transition to the full quote, and strategy-call request. Existing GPC, DNT and analytics opt-out behaviour applies. Form bodies and contact details are never included in analytics metadata.

## Deployment

Apply web migrations before starting either updated runtime because both Drizzle schemas read the new shared columns and enum values. Verify the short form, admin source badge, Resend templates, analytics opt-out, keyboard flow, canonical metadata, JSON-LD and sitemap entry in staging. No production data migration beyond safe defaults is required for existing quote rows.
