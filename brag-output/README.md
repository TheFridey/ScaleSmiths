# ScaleSmiths launch film

A 20-second, 1920×1080, 30fps promo created using [latent-spaces/brag](https://github.com/latent-spaces/brag/tree/669ab9286aa28b6c3ee30e75f181ee74319d012a/skills/brag). The homepage scene is a video-scaled reconstruction from the public source; no private systems or client data are shown.

The plan, composition brief, editable HTML scenes and share copy live here. The website and application dependencies are untouched. Rendered media and third-party assets are excluded from Git.

## Render

Requires Node 22+ and FFmpeg. From this directory:

```sh
node prepare-assets.mjs
npx --yes hyperframes@0.8.197 check composition --json
npx --yes hyperframes@0.8.197 preview composition
npx --yes hyperframes@0.8.197 render composition --quality delivery --output brag.mp4
```

The asset preparation script copies the repository's brand image, wordmark and Syne font, then downloads pinned music/SFX and GSAP. It does not install dependencies into either Next.js app. Credit the music when posting; see CREDITS.md and share-copy.txt.

## Verification

Hyperframes 0.8.197: lint, runtime, layout, contrast and craft checks passed with zero errors and zero warnings. Contrast audited 29 visible text samples. Each scene was visually inspected before export. Background preview could not start in the execution environment; browser snapshots and the rendered MP4 were used for visual QA.

## Poster

Choose a settled hook frame (1.5s), export it as brag.jpg, then replace frame zero of the MP4 with that image. This controls the thumbnail in players that select the first frame. See the upstream brag skill for its FFmpeg command.
