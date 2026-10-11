# Admin installation and build troubleshooting

## Deployment identity first

The live check on 11 October 2026 found checkout `6a0a3f9` and an unauthenticated manifest response redirecting to login. This version predates Command Centre installation support. The supplied terminal log shows `git pull` failing because HEAD was detached, followed by a build of the old checkout and a migration report of admin 64/64 rather than 66/66.

A detached checkout can be intentional for immutable releases. `git pull` does not select a new release in that state. Inspect the exact approved candidate before building:

```bash
cd /var/www/scalesmiths/ScaleSmiths
git status --short
git rev-parse HEAD
git fetch origin
git show --stat <approved-full-sha>
git switch --detach <approved-full-sha>
git rev-parse HEAD
```

Do not delete the untracked `admin/node` or `admin/scalesmiths-admin@0.1.0` files without inspecting their origin. Do not rebuild in an active application's directory or remove its `.next` while it is serving requests. Inspect the actual PM2 canary working directories, build an inactive candidate, and retain the previous working release. Follow the production release and backup gates; these source-selection commands are not a deployment authorization or traffic switch.

Run shared migrations from the repository root only after backup/restore and dedicated privilege checks. Never repair a deployment by modifying migration journals or running an app-owned migration batch independently.

## Google font build failure

The supplied `next/font/google` stack failed while parsing the downloaded font CSS. Both public-web fonts now use `next/font/local` and checked-in variable TrueType assets, preserving Inter and Syne while eliminating the build-time Google request. Assets and SIL licenses are under `web/src/app/fonts`; sources are the Google Fonts repository's `ofl/inter` and `ofl/syne` folders. No framework dependency was upgraded to resolve this failure.

## Installation verification

After the reviewed candidate is actually serving on the private HTTPS origin, check these endpoints without a session:

```bash
curl -I https://admin.scalesmiths.co.uk/manifest.webmanifest
curl -I https://admin.scalesmiths.co.uk/command-centre-sw.js
curl -I https://admin.scalesmiths.co.uk/app-icon/192
curl -I https://admin.scalesmiths.co.uk/app-icon/512
```

Expect 200 responses, not redirects, with manifest JSON, worker JavaScript and PNG content respectively. Verify the manifest link in the login document and the browser's service-worker registration. Only this public metadata is exposed; pages and APIs stay private.

The header's Install app control is always discoverable. It opens the native browser prompt when available; otherwise it gives browser-specific installation steps. Safari on iPhone/iPad uses Share and Add to Home Screen. Browser eligibility, prior installation and a dismissed prompt affect native prompt availability, so a missing automatic banner alone is not proof of a broken app. Real-device installation and update checks remain required.

## UI verification scope

`admin/scripts/verify-admin-shell-browser.mjs` bundles the real sidebar, header, mobile sheet and installation components with explicit router adapters. First compile the actual stylesheet from `admin/` with `node node_modules/tailwindcss/lib/cli.js -i src/app/globals.css -o test-results/admin-shell/globals.css --minify`. The browser script checks desktop/mobile navigation, install fallback, a synthetic native-prompt event, installed-state handling, dialogs, runtime errors and horizontal overflow, and writes screenshots under ignored `admin/test-results/admin-shell`. It is component proof, not authenticated end-to-end or physical-phone installation proof.

The shared admin shell now groups every existing navigation route into Sales, Client delivery, Finance, Production, Operations and Administration. Command Centre's daily views remain visible; secondary views and record actions move to selectors and menus. Existing authorization, records, URLs, forms and server operations remain intact.
