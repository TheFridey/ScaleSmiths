# Public site launch checklist

What must be true in the production environment for the public website to be indexed, measured
and served correctly. Everything here is configuration or an external account action — the code
side is complete and verified by `npm run seo:audit`, the unit suite and the Playwright specs.

---

## Required environment variables

Set in the root `.env` on the production host (see `AGENTS.md` for how the apps load it).

| Variable | Required | Effect if wrong or missing |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | **Yes** | Drives every canonical URL, the sitemap, `robots.txt`, Open Graph URLs and all absolute schema URLs. Must be the exact public origin, `https://scalesmiths.co.uk`, with no trailing slash. If it is left at a development value, every canonical on the site points at that host and the site will not index correctly. This is the single highest-risk variable on the public app. |
| `NEXT_PUBLIC_SITE_ORIGIN` | No | Used for the RFC 8288 agent-discovery `Link` header in `next.config.mjs`. Defaults to `https://scalesmiths.co.uk`. |
| `WEB_DATABASE_URL` | **Yes** | The public runtime refuses to boot in production without it. Verified public claims (prices, outcomes, testimonials) are read through it; `DATABASE_URL` is accepted only in development and tests. |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | No | GA4 property. Defaults to the existing production ID. Set it explicitly per environment so a preview deployment cannot report into the production property. Set it to an empty string to disable Google Analytics entirely — the component then renders nothing and requests no Google script. |
| `PORTAL_SECRET`, `AUTH_SECRET` | Yes | Client portal sessions. Not public-SEO related but required for the app to run. |
| `RESEND_API_KEY`, `RESEND_FROM` | Yes | Enquiry and quote notifications. A silent failure here looks like "the site gets no enquiries". |
| `SENTRY_*`, `ERROR_MONITORING_RELEASE` | No | Source-map upload and release tagging. Source maps are simply not uploaded when unset. |

Verify after deploy:

```bash
curl -s https://scalesmiths.co.uk/sitemap.xml | head -20     # every <loc> must be https://scalesmiths.co.uk/...
curl -s https://scalesmiths.co.uk/robots.txt                 # Host and Sitemap must match
curl -s https://scalesmiths.co.uk/ | grep -o '<link rel="canonical"[^>]*>'
```

Then run the audit against production and confirm zero errors:

```bash
cd web && npm run seo:audit -- --base https://scalesmiths.co.uk
```

The audit fails loudly if canonical origins disagree with the sitemap origin, which is the
symptom a misconfigured `NEXT_PUBLIC_SITE_URL` produces.

---

## Manual external actions

These cannot be done from the repository. They are the only outstanding launch steps.

### 1. Google Search Console

1. Add `https://scalesmiths.co.uk` as a **Domain** property (DNS verification) — preferred, because
   it covers every subdomain and protocol variant at once.
2. Submit `https://scalesmiths.co.uk/sitemap.xml`.
3. Request indexing for the homepage and two or three priority commercial pages. Do not bulk-submit;
   it achieves nothing and the quota is limited.
4. Confirm the Confirm-A-Kill pre-launch baseline period is recorded somewhere durable before it
   ages out of Search Console's 16-month window. It is currently published on the case study and
   referenced in `docs/SEO_MONITORING.md`, but Search Console itself will eventually drop it.

### 2. Google Analytics 4

The property ID is already wired and consent-gated: analytics storage is denied until the visitor
accepts, and `_ga*` cookies are removed when consent is withdrawn. Confirm in GA4 that the property
receives events from the production hostname, and that internal traffic from the office IP is
filtered out.

### 3. Google Business Profile

Local search performance depends on it and it is not controlled by this codebase. Confirm the
business name, address, category and service areas match what the site publishes in
`src/lib/site-identity.ts`. Inconsistency between the two is a common local-ranking drag.

### 4. Bing Webmaster Tools

Optional but free: import the Search Console property rather than verifying separately.

---

## What is deliberately not configured

- **No `google-site-verification` meta tag.** DNS verification for a Domain property is stronger and
  does not require a code change. If an HTML-tag verification is preferred instead, add it through
  `metadata.verification` in `src/app/layout.tsx`.
- **No IndexNow / instant indexing.** Not useful at this publishing cadence.
- **No third-party tag manager.** GA4 loads directly behind consent. Adding GTM would widen the CSP
  and add a script that can change behaviour without a deploy.

---

## Content Security Policy

`next.config.mjs` allow-lists only what the site actually uses: Google Tag Manager and Google
Analytics, and Cloudflare Insights. Adding any third-party script — a chat widget, a heatmap tool,
an ad pixel — requires a matching CSP change or it will be blocked silently in production. Test
such a change against a production build, not `next dev`, because the development CSP is looser.
