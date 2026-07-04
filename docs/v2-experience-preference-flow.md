# ScaleSmiths V2 Experience Preference Flow

Date: 2026-07-03

## Goal

Make the homepage experience preference feel intentional instead of showing the normal homepage underneath an interactive continuation banner.

## Behaviour

- First-time visitors to `/` now see only the experience choice gate.
- Choosing `Explore ScaleSmiths`:
  - stores `scalesmiths.experience = normal`
  - reveals the normal homepage
  - shows the subtle fixed `Switch experience` and reset controls
- Choosing `Experience the Future`:
  - stores `scalesmiths.experience = interactive`
  - routes to `/interactive`
- Returning visitors with `normal`:
  - see the normal homepage immediately after the mounted preference check
  - keep the switch/reset controls
- Returning visitors with `interactive` who visit `/`:
  - are redirected to `/interactive`
  - do not see the old continue banner
  - do not see the normal homepage beneath the redirect state
- Reset controls:
  - clear `scalesmiths.experience`
  - return the user to `/`
  - show the first-time choice gate again

## Hydration Handling

The root preference gate now renders a small loading shell until the client has mounted and `localStorage` has been read. This avoids server/client preference mismatch warnings and prevents the homepage from flashing before the preference is known.

## Accessibility

- The choice cards remain semantic `button` elements.
- The fixed switch/reset controls remain semantic `button` elements.
- Focus-visible outlines are preserved.
- Redirect/loading shells use labelled sections and polite status copy where useful.
- `/interactive` keeps the visible `Exit to normal site` link.

## Verification

- `npm run lint`: passed.
- `npm run build`: passed.
- Local Playwright browser flow against a temporary Next production server: passed.

Checked flows:

- first visit to `/`
- normal choice
- interactive choice
- returning `normal`
- returning `interactive`
- reset preference from normal and interactive states
