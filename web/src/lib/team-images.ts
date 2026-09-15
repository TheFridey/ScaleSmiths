/**
 * Real founder photography only — never stock, AI-generated or illustrative portraits.
 *
 * To publish a photo:
 *   1. Export a compressed WebP (portraits ~1200x1500, 4:5; the pair shot ~1600x1067, 3:2),
 *      ideally under 250KB, into `web/public/images/team/` using the path below.
 *   2. Set `available: true` for that entry and describe the actual photo in `alt`.
 * `team-images.test.ts` fails if a flag and the files on disk disagree, so a missing file
 * can never publish a broken image and a supplied file cannot be silently ignored.
 */

export interface TeamImage {
  src: string
  alt: string
  /** CSS aspect ratio the layout reserves, so a supplied photo causes no layout shift. */
  aspect: "4 / 5" | "3 / 2"
  available: boolean
}

export const teamImages = {
  // TODO(owner): supply /images/team/rhys.webp and replace the alt text with a description of the real photo.
  rhys: {
    src: "/images/team/rhys.webp",
    alt: "Rhys, co-founder of ScaleSmiths",
    aspect: "4 / 5",
    available: false,
  },
  // TODO(owner): supply /images/team/trevor.webp and replace the alt text with a description of the real photo.
  trevor: {
    src: "/images/team/trevor.webp",
    alt: "Trevor Newton-Bradley, co-founder of ScaleSmiths",
    aspect: "4 / 5",
    available: false,
  },
  // TODO(owner): supply /images/team/rhys-trevor.webp (both founders together) and describe it in the alt text.
  founders: {
    src: "/images/team/rhys-trevor.webp",
    alt: "ScaleSmiths co-founders Rhys and Trevor Newton-Bradley",
    aspect: "3 / 2",
    available: false,
  },
} as const satisfies Record<string, TeamImage>

export type TeamImageKey = keyof typeof teamImages
