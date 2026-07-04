# ScaleSmiths V2 Frontend Dependency Audit

Date: 2026-07-03

## Scope

Audited `web/package.json` against actual imports in `web/src` for:

- `motion`
- `framer-motion`
- `gsap`
- `@gsap/react`
- `@react-three/drei`
- `@react-three/fiber`
- `three`

## Removed Packages

- `motion`
  - No imports from `"motion"` or `"motion/react"` were found in `web/src`.
  - The app uses `framer-motion` directly instead.
- `@gsap/react`
  - No imports from `@gsap/react` were found in `web/src`.
  - Existing GSAP usage imports from `gsap` and `gsap/ScrollTrigger`.
- `@react-three/drei`
  - No imports from `@react-three/drei` were found in `web/src`.
  - Removing it also removed a large unused 3D helper dependency tree.

## Retained Packages

- `framer-motion`
  - Retained because V2 and shared UI components import from `framer-motion`.
  - Confirmed usage includes:
    - `web/src/components/v2/V2InteractiveExperience.tsx`
    - `web/src/components/v2/V2ConversionLayer.tsx`
    - `web/src/components/v2/BusinessSimulationLayer.tsx`
    - `web/src/components/AnimateIn.tsx`
    - `web/src/components/ScrollProgress.tsx`
- `gsap`
  - Retained because current homepage animation components import `gsap` and `gsap/ScrollTrigger`.
  - Confirmed usage includes:
    - `web/src/components/GSAPReveal.tsx`
    - `web/src/components/Hero.tsx`
    - `web/src/components/SmoothScroll.tsx`
    - `web/src/components/TechStack.tsx`
- `@react-three/fiber`
  - Retained because `web/src/components/v2/three/ClientSceneCanvas.tsx` dynamically imports `@react-three/fiber`.
  - This preserves client-side-only R3F loading for the interactive canvas.
- `three`
  - Retained because it is imported directly by:
    - `web/src/components/ForgeHeroScene.tsx`
    - `web/src/components/v2/three/ClientSceneCanvas.tsx`

## Package Update Result

- Ran `npm install` in `web`.
- npm removed 50 packages from the dependency tree.
- `web/package.json` and `web/package-lock.json` were updated.
- npm reported 6 moderate severity audit findings that were already outside this dependency-pruning task.
- npm also reported a local engine warning: `eslint-visitor-keys@5.0.1` requires Node `^20.19.0 || ^22.13.0 || >=24`; this machine is currently running Node `22.12.0`.

## Verification

- `npm run lint`: passed.
- `npm run build`: passed.

The production build completed successfully with `/interactive` included in the generated route output.
