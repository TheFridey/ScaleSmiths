# ScaleSmiths V2 Canvas Performance Pass

Date: 2026-07-03

## Scope

Optimised `web/src/components/v2/three/ClientSceneCanvas.tsx` to reduce GPU and CPU usage while preserving the premium interactive forge scene.

## Changes

- Kept existing fallback protections for:
  - reduced motion
  - mobile viewport or coarse pointer
  - low device memory
  - low hardware concurrency
- Changed the React Three Fiber canvas from `frameloop="always"` to `frameloop="demand"`.
- Added a Fiber render governor that:
  - invalidates frames at roughly 30fps while the canvas is visible
  - pauses invalidation when `document.hidden` is true
  - pauses invalidation when the canvas is outside the viewport via `IntersectionObserver`
  - resumes cleanly when the document and canvas become visible again
- Updated the manual Three.js fallback renderer to:
  - schedule RAF renders at roughly 30fps
  - stop scheduling renders when the tab is hidden
  - stop scheduling renders when the canvas is outside the viewport
  - resume cleanly when visible again
- Preserved hover/click panel detection and the DOM overlay behaviour.
- Reused a vector in the manual panel scale animation to avoid avoidable per-frame allocations.
- Added comments explaining why the canvas is throttled.

## Verification

- `npm run lint`: passed.
- `npm run build`: passed.

The production build completed successfully with `/interactive` still included in the generated route output.

## Notes

No browser-based performance trace was run in this pass. The change is source-level and build-verified; a follow-up Lighthouse or Chrome Performance recording would be useful once the route is reviewed interactively.
