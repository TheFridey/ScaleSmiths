# Case-study media and content

How to supply the screenshots, logos and verified content that power `/work` and each
`/work/<slug>` case study. The code never fabricates imagery, metrics or quotes: anything not
supplied is omitted in production and shown as a labelled placeholder in development only.

## Adding screenshots

1. Capture the live site or system (no mock-ups, no generated images, no device renders).
2. Export WebP and save to `web/public/images/work/<folder>/<file>.webp` using the names below.
3. Run `npm run work-media:sync` in `web/`.
4. Commit the images and the regenerated `web/src/lib/work-media-manifest.ts`.

`work-media.test.ts` fails if the manifest and the files disagree, or if a file is not part of a
project's plan in `web/src/lib/work-media.ts` (add a plan entry for any new capture).

### Automated capture of public pages

Public pages of live client sites are captured with Playwright:

```powershell
cd web
node scripts/capture-work-media.mjs --all                         # every configured site
node scripts/capture-work-media.mjs glow-tanning                  # one site
node scripts/capture-work-media.mjs prymal --only desktop-pricing # one shot
npm run work-media:sync
```

Pages and anchors per site live in `captureConfig` in `web/scripts/capture-work-media.mjs`. The script
waits for lazy content, disables transitions, chooses "reject non-essential" on cookie banners or
hides accept-only banners (it never consents on a client's site), and exports 2x WebP. Review every
image before committing: animated sections, carousels and custom cursors can still need tuning via
`anchor`, `offset` and `hide`. If the project's pinned Chromium is not installed, set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE` to a local build.

### Naming convention

| What | Pattern | Example |
| --- | --- | --- |
| Current site page | `{view}-{page}.webp` | `desktop-home.webp`, `mobile-contact.webp` |
| Previous site (before) | `before-{view}-{page}.webp` | `before-desktop-home.webp` |
| Systems and dashboards | `{system}-{screen}.webp` | `crm-dashboard.webp`, `admin-quotes.webp` |

`view` is `desktop`, `tablet` or `mobile`. Use lowercase words separated by hyphens.

### Capture sizes

| View | Viewport | Export | Aspect reserved |
| --- | --- | --- | --- |
| Desktop | 1440×900 | 2880×1800 | 16:10 |
| Tablet | 768×1024 | 1536×2048 | 3:4 |
| Mobile | 390×844 | 780×1688 | 390:844 |

Images are cropped from the top to these ratios, so the most important content must be in the
first screenful. Aim for under 400KB (desktop) and 200KB (mobile). Next.js serves resized
AVIF/WebP variants automatically.

Remove personal data (customer names, emails, phone numbers, order details) from any admin, CRM
or dashboard capture, and only publish private system screens with the client's permission.

## Screenshot status

Captured 15 September 2026 from the live sites. Logged-in screens (admin, CRM, dashboards, member
areas) cannot be captured automatically: supply them from a demo or staging account with no
personal data, and only with the client's permission.

**Confirm-A-Kill** (`confirm-a-kill`) — flagship, draft until content is supplied
- Captured: `before-desktop-home`, `before-mobile-home` (confirmakill.co.uk still serves the previous WordPress site)
- Outstanding (the ScaleSmiths rebuild, once live or on staging): `desktop-home`, `tablet-home`, `mobile-home`, `desktop-service`, `desktop-location`, `mobile-contact`, and `crm-dashboard` if a CRM was delivered

**Precision Finish Plastering & Rendering** (`precision-finish`)
- Captured: `desktop-home`, `mobile-home`, `desktop-service`, `desktop-service-areas`, `desktop-gallery`, `mobile-quote`

**Glow Tanning** (`glow-tanning`)
- Captured: `desktop-home`, `mobile-home`, `desktop-booking`, `desktop-reviews`
- Outstanding (login): `admin-dashboard`

**Pinkys Prints** (`pinkys-prints`)
- Outstanding: live URL not confirmed. `desktop-home`, `mobile-home`, `desktop-product`, `admin-products`, `before-desktop-home` (previous Shopify store, if a capture exists)

**CSDS** (`csds`)
- Captured: `desktop-home`, `desktop-quote`
- Outstanding: `mobile-home` — deliberately not published: the live site's navigation has no mobile toggle, so links stack above the hero on phones. Fix, then run `node scripts/capture-work-media.mjs csds` after re-adding the shot to its config.
- Outstanding (login): `admin-quotes`

**The Business Circle** (`the-business-circle`)
- Captured: `desktop-home`, `mobile-home`, `desktop-membership`
- Outstanding (login): `dashboard-member`, `dashboard-video-room`, `admin-members`

**Prymal** (`prymal`)
- Captured: `desktop-home`, `mobile-home`, `desktop-pricing`
- Outstanding (login): `dashboard-workspace`, `dashboard-workflows`, `admin-usage`

**VeteranFinder** (`veteranfinder`)
- Captured: `desktop-home`, `mobile-home`
- Outstanding (login): `dashboard-member`, `admin-console`

A before/after comparison appears automatically for any project with both a `before-{view}-home`
and `{view}-home` capture.
## Client logos

Only with the client's approval. Save to `web/public/images/clients/<slug>.svg` (or a transparent
PNG/WebP at least 2× display size) and register it in `approvedClientLogos`
(`web/src/lib/client-proof.ts`) with its intrinsic width and height. Supply a version that reads on
a dark background, or set `treatment: "monochrome"`. Logos then appear in the homepage trust strip,
portfolio cards and case-study headers.

None are approved yet: Confirm-A-Kill, Precision Finish, Glow Tanning, Pinkys Prints, CSDS,
The Business Circle, Prymal, VeteranFinder.

## Verified content still required

| Content | Where it goes |
| --- | --- |
| Confirm-A-Kill: who they are, verified starting-point issues, strategy, delivered scope, stack, live URL, year, location | Move the draft in `case-studies.ts` into `data.ts` |
| Strategy narratives for each case study (from real project records) | `Project.strategy` in `data.ts` |
| Verified starting-point issues (where a previous site existed) | `Project.startingPoint` |
| Pinkys Prints live URL (all other live URLs are recorded) | `Project.websiteUrl` |
| Measured results (Search Console, analytics, enquiry records, Lighthouse) | A verified `public_verified_claims` record permitted on `/work/<slug>` + `project_metrics`, referenced from `Project.metrics` |
| Client quotes with written approval and attribution | A verified claim of type `testimonial` permitted for `client_quote`, referenced by `Project.quoteClaimId` |
