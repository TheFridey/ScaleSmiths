# ScaleSmiths SEO monitoring

What to look at, how often, and what a given movement actually means. No current performance
figures appear in this document — record them in the review log as they are measured, so the
baseline is always evidence rather than recollection.

The only quantitative search baseline currently held in the repository is the Confirm-A-Kill
pre-launch Search Console record (three months, previous website), published on that case study.
Everything else starts from zero on the day Search Console is connected.

---

## Weekly — 15 minutes

Fast checks. The point is to notice a break within days, not to analyse trends.

| Check | Where | What matters |
| --- | --- | --- |
| Indexing errors | Search Console → Pages | Any page moving from Indexed to Excluded, especially a commercial or location page. "Crawled – currently not indexed" on a new article for a week or two is normal. |
| Coverage of new content | Search Console → URL Inspection | Articles published in the last fortnight should be indexed. If not, request indexing once and leave it. |
| Clicks and impressions | Search Console → Performance, last 7 days vs previous 7 | Direction, not precision. A sudden drop across many queries usually means a technical fault; a drop on one query usually means a competitor moved. |
| Uptime and errors | Sentry, hosting dashboard | Any 5xx spike. A site that was down during a crawl loses more than a day of traffic. |
| Form submissions | Portal enquiries, email | Zero enquiries in a week that had traffic is a conversion or delivery fault, not a search one. Test the form. |

---

## Monthly — 60 minutes

| Check | Where | What matters |
| --- | --- | --- |
| Non-branded impressions | Search Console → Performance, filter out queries containing "scalesmiths" | The honest measure of whether SEO is working. Branded search grows from every other channel, so it flatters the numbers. Track non-branded separately from day one. |
| Query movement | Performance → Queries, 28 days vs previous 28 | New queries appearing matters more than existing ones rising. It means the site is being understood for something new. |
| Average position by page | Performance → Pages, then Queries per page | Position 8–20 is the actionable band: those pages are one improvement away from traffic. Position 50+ needs a different page, not a better one. |
| CTR against position | Performance → compare CTR to position | A page ranking well with a poor CTR has a title/description problem, not a ranking problem. That is the cheapest fix available. |
| Landing page performance | GA4 → Landing page report, organic segment | Which pages receive organic entries, and what those visitors then do. A page with entries and no onward clicks is not answering the question it ranks for. |
| Conversions by landing page | GA4, enquiry events | Enquiries attributed to their entry page. This is what decides where next month's effort goes. |
| Core Web Vitals | Search Console → Core Web Vitals, and the field data in PageSpeed Insights | Field data, not lab scores. Lab numbers move with the machine running them; field data is what Google uses. |
| Crawl stats | Search Console → Settings → Crawl stats | A sharp drop in crawl requests usually precedes an indexing problem. |
| Referring domains | Any backlink tool, or Search Console → Links | New referring domains, and whether anything unexpected is linking in. |
| Local visibility | Google Business Profile insights; a manual search for the core local terms from a Nottingham location | Map pack presence is a separate ranking system from the blue links. Check both. |

---

## Quarterly

- **Re-run the site audit.** `npm run seo:audit -- --base <url>` against production or a
  production build. Compare `docs/seo-audit.json` with the previous run; the error count should
  stay at zero and the content-overlap table should not have grown.
- **Review the content-overlap table.** Two pages converging on the same intent is the most
  common way an otherwise healthy site loses ground, and it happens gradually.
- **Check the pages that never get impressions.** A page with no impressions after two quarters is
  either targeting a query nobody searches or is not competitive for it. Decide: sharpen, merge,
  or accept it as a conversion page that search was never going to serve.
- **Verify the claims still hold.** Prices, service descriptions, case study facts and FAQ answers
  drift away from reality faster than anyone expects. The FAQ answers marked `ownerReview` in
  `faq-library.ts` exist for exactly this reason.

---

## What not to track

- **Keyword rank trackers as a primary measure.** Rankings are personalised, localised and
  volatile. Search Console's average position across real impressions is more honest.
- **Domain authority scores.** Third-party inventions. They correlate with performance without
  causing it, and optimising for them wastes effort.
- **Lighthouse scores as a target.** Useful as a diagnostic, misleading as a KPI. Field Core Web
  Vitals are the measure that affects search.
- **Total traffic.** Branded and direct traffic will dominate. Segment to organic non-branded or
  the number tells you nothing about the SEO work.

---

## When something drops

Work through it in this order, because the cheap explanations are also the common ones.

1. **Is the site up, and was it up?** Check uptime history for the period of the drop.
2. **Is the page still indexed?** URL Inspection. A page dropped from the index does not rank.
3. **Did the page change?** Check git history for the route. An accidental `noindex`, a changed
   canonical or a rewritten H1 will all do it.
4. **Did the whole site drop, or one page?** Site-wide means technical or algorithmic. One page
   means content or competition.
5. **Did impressions drop, or only clicks?** Impressions falling is a ranking change. Clicks
   falling while impressions hold is a title, description or SERP-feature change.
6. **Only then look at competitors and algorithm updates.** They are the least actionable
   explanation and the first one people reach for.

---

## Review log

Keep a dated entry per monthly review: the non-branded impression and click figures, anything
that moved materially, what was changed in response, and what is being watched next month. A
year of these is worth more than any dashboard, because it records the decisions alongside the
numbers.
