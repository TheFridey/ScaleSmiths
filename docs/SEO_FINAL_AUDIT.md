# ScaleSmiths final SEO audit

Generated 2026-09-23T22:16:05.611Z against `http://127.0.0.1:3500`.
Regenerate with `node scripts/seo-audit.mjs --base <url>` while a server is running.

This file is produced by `web/scripts/seo-audit.mjs`. Do not edit it by hand — fix the site and
re-run the audit instead. The machine-readable record of the same crawl is `docs/seo-audit.json`.

## Summary

| Metric | Value |
| --- | --- |
| Pages crawled | 94 |
| Indexable pages | 92 |
| URLs in sitemap.xml | 93 |
| Orphan pages | 0 |
| Errors | 0 |
| Warnings | 26 |

## What each severity means

- **error** — a search engine or a visitor is materially affected. These should be zero.
- **warning** — worth a decision. Some are accepted deliberately; the notes below say which.

## Errors

### Errors

None.


## Warnings

### Warnings
**content-overlap** — 15
- `/work` — 21% shingle overlap with /about/rhys
- `/faq` — 24% shingle overlap with /web-design-hucknall
- `/legal/domain-dns-terms` — 21% shingle overlap with /legal/accessibility
- `/legal/acceptable-use` — 21% shingle overlap with /legal/fair-use
- `/legal/acceptable-use` — 21% shingle overlap with /legal/complaints
- `/legal/acceptable-use` — 22% shingle overlap with /legal/accessibility
- `/legal/fair-use` — 22% shingle overlap with /legal/complaints
- `/legal/fair-use` — 23% shingle overlap with /legal/accessibility
- `/legal/subprocessors` — 21% shingle overlap with /legal/accessibility
- `/legal/cancellations` — 20% shingle overlap with /legal/accessibility
- `/legal/complaints` — 24% shingle overlap with /legal/accessibility
- `/custom-software-development-uk` — 22% shingle overlap with /business-automation-nottingham
- `/work/scalesmiths-platform-build` — 21% shingle overlap with /work/security-hardening-pass
- `/work/quote-system-hardening` — 24% shingle overlap with /work/portal-foundation
- `/work/portal-foundation` — 23% shingle overlap with /work/admin-dashboard-foundation
**thin-content** — 6
- `/work/scalesmiths-platform-build` — 202 words in <main>
- `/work/quote-system-hardening` — 167 words in <main>
- `/work/portal-foundation` — 195 words in <main>
- `/work/seo-aeo-page-architecture` — 180 words in <main>
- `/work/admin-dashboard-foundation` — 144 words in <main>
- `/work/security-hardening-pass` — 163 words in <main>
**internal-link-to-noindex** — 3
- `/services/managed-business-email` — → /services/managed-business-email/get-started
- `/services/business-growth-audit` — → /services/business-growth-audit/start
- `/local-growth-check` — → /services/business-growth-audit/start
**non-production-origin** — 1
- `/sitemap.xml` — NEXT_PUBLIC_SITE_URL resolves to http://localhost:3000; production must serve https://scalesmiths.co.uk
**external-link-unreachable** — 1
- `/work` — https://csdshome.com

## Accepted (informational)

Recorded, not defects. Legal documents, forms, directories and contact pages are short because of
what they are; the note keeps them visible without training anyone to ignore the report.

### Informational
**thin-content** — 13
- `/locations` — 164 words in <main> (expected for this page type)
- `/contact` — 100 words in <main> (expected for this page type)
- `/quote` — 95 words in <main> (expected for this page type)
- `/legal` — 62 words in <main> (expected for this page type)
- `/legal/hosting-terms` — 249 words in <main> (expected for this page type)
- `/legal/domain-dns-terms` — 206 words in <main> (expected for this page type)
- `/legal/acceptable-use` — 187 words in <main> (expected for this page type)
- `/legal/fair-use` — 172 words in <main> (expected for this page type)
- `/legal/subprocessors` — 211 words in <main> (expected for this page type)
- `/legal/cancellations` — 216 words in <main> (expected for this page type)
- `/legal/complaints` — 163 words in <main> (expected for this page type)
- `/legal/security` — 223 words in <main> (expected for this page type)
- `/legal/accessibility` — 152 words in <main> (expected for this page type)

## Closest content pairs

Shingle overlap between indexable pages. Anything above roughly 40% is worth rewriting; lower
figures are usually shared navigation, footer and CTA copy rather than duplicated substance.

| A | B | Overlap |
| --- | --- | --- |
| `/work/quote-system-hardening` | `/work/portal-foundation` | 24% |
| `/faq` | `/web-design-hucknall` | 24% |
| `/legal/complaints` | `/legal/accessibility` | 24% |
| `/legal/fair-use` | `/legal/accessibility` | 23% |
| `/work/portal-foundation` | `/work/admin-dashboard-foundation` | 23% |
| `/legal/fair-use` | `/legal/complaints` | 23% |
| `/custom-software-development-uk` | `/business-automation-nottingham` | 22% |
| `/legal/acceptable-use` | `/legal/accessibility` | 22% |
| `/work` | `/about/rhys` | 21% |
| `/legal/acceptable-use` | `/legal/complaints` | 21% |
| `/legal/acceptable-use` | `/legal/fair-use` | 21% |
| `/work/scalesmiths-platform-build` | `/work/security-hardening-pass` | 21% |
| `/legal/domain-dns-terms` | `/legal/accessibility` | 21% |
| `/legal/subprocessors` | `/legal/accessibility` | 21% |
| `/legal/cancellations` | `/legal/accessibility` | 20% |

## External links

| URL | Status |
| --- | --- |
| https://www.confirmakill.co.uk/ | 200 |
| https://precisionplasteringandrendering.co.uk | 200 |
| https://glowtanninghucknall.co.uk | 200 |
| https://csdshome.com | unreachable |
| https://thebusinesscircle.net | 200 |
| https://prymal.io | 200 |
| https://veteranfinder.co.uk | 200 |
| https://github.com/TheFridey/Prymal | 200 |
| https://github.com/TheFridey/VF | 200 |
