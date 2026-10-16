# Discovery booking integration

The public site supports an optional external discovery-call scheduler through `NEXT_PUBLIC_DISCOVERY_BOOKING_URL`. This is a public destination, not a credential. Do not embed account tokens, HTTP basic-auth credentials, or a private management URL.

- With a valid HTTPS value, discovery CTAs say **Book a Discovery Call**, open the scheduler in a new tab, identify external navigation, and record a privacy-minimised `quote_cta_clicked` event with the intent and destination hostname.
- With an empty, malformed, non-HTTPS, or credential-bearing value, discovery CTAs say **Request a Discovery Call** and open `/quote?intent=discovery_call`.
- Quote, V2, audit, email and enterprise submissions persist a validated canonical intent on `quote_requests.enquiry_intent`. The accepted values are `quote`, `discovery_call`, `strategy_call`, `v2_demo`, `email_plan`, `business_email`, `business_growth_audit` and `enterprise`. Arbitrary full-quote client values fall back to `quote`. Each persisted enquiry also stores the form page, referring host and campaign labels after server-side sanitising. `/local-growth-check` is a landing page that hands off to the audit form; it does not create a separate lead.

Because this is a `NEXT_PUBLIC_` build-time value, update it before building the web image. Staging verification should cover both an unconfigured build and a build using an operator-controlled test scheduler. Confirm the link destination and accessible external-navigation label, then confirm the outbound analytics event without submitting personal data.

The public CTA inventory is maintained through source and tests: homepage hero and inline discovery CTAs use the shared resolver; the standard strategy CTA is an enquiry request; and V2 exposes distinct strategy-call, demo, and emailed-plan intents. Generated-client Forge fixtures are outside this public ScaleSmiths CTA policy.
