import type { JsonValue } from "./forge-ai"

export const FORGE_ANIMATION_PACKS = [
  "Minimal Premium",
  "Cinematic Hero",
  "Smooth Local Business",
  "Editorial Reveal",
  "Glass Motion",
  "Industrial Precision",
] as const

export type ForgeAnimationPackName = (typeof FORGE_ANIMATION_PACKS)[number]

export interface ForgeAnimationPack extends Record<string, JsonValue> {
  name: ForgeAnimationPackName
  pageTransition: string
  heroAnimation: string
  sectionReveal: string
  cardHover: string
  ctaMicroInteraction: string
  scrollBehaviour: string
  reducedMotionFallback: string
  libraries: string[]
  heavy: boolean
}

export const FORGE_ANIMATION_PACK_DEFINITIONS: Record<ForgeAnimationPackName, ForgeAnimationPack> = {
  "Minimal Premium": {
    name: "Minimal Premium",
    pageTransition: "Subtle opacity transition only; no route blocking, overlays, or layout movement.",
    heroAnimation: "Short fade-up for headline, support copy, and CTA with stable reserved layout.",
    sectionReveal: "Small opacity/y reveal once per section with no stagger on dense content.",
    cardHover: "Border, shadow, and color-state changes only; no card resizing.",
    ctaMicroInteraction: "Fast color and shadow feedback with focus-visible outline.",
    scrollBehaviour: "Native browser scroll with CSS scroll-behavior only.",
    reducedMotionFallback: "Disable transforms and long transitions; content renders immediately.",
    libraries: ["framer-motion"],
    heavy: false,
  },
  "Cinematic Hero": {
    name: "Cinematic Hero",
    pageTransition: "Brief hero-first entrance with a restrained opacity transition between pages.",
    heroAnimation: "Layered hero reveal with heading, proof, and CTA timing; no autoplay loops.",
    sectionReveal: "Controlled reveal sequence for major sections only, avoiding long scroll-linked timelines.",
    cardHover: "Measured lift and shadow for featured cards, with transform distance capped.",
    ctaMicroInteraction: "Directional highlight sweep and pressed state with no layout shift.",
    scrollBehaviour: "Native scroll; GSAP may be used only for an approved hero timeline.",
    reducedMotionFallback: "Skip timelines, remove transforms, and show the final static hero immediately.",
    libraries: ["framer-motion", "gsap"],
    heavy: true,
  },
  "Smooth Local Business": {
    name: "Smooth Local Business",
    pageTransition: "Simple opacity transition that preserves navigation speed.",
    heroAnimation: "Friendly fade-up of local proof, headline, and CTA.",
    sectionReveal: "Once-per-section reveal tuned for service, proof, and contact sections.",
    cardHover: "Calm border and shadow feedback that keeps cards fixed in place.",
    ctaMicroInteraction: "Clear hover, focus, and active states; no decorative loops.",
    scrollBehaviour: "Optional Lenis smooth scroll on desktop only, disabled for reduced motion.",
    reducedMotionFallback: "Use native scroll and render sections without transform animation.",
    libraries: ["framer-motion", "lenis"],
    heavy: false,
  },
  "Editorial Reveal": {
    name: "Editorial Reveal",
    pageTransition: "Quiet fade transition that keeps reading flow intact.",
    heroAnimation: "Headline and image/proof reveal with composed editorial pacing.",
    sectionReveal: "Text-led reveal with conservative stagger for lists and proof blocks.",
    cardHover: "Underline, border, and image-treatment feedback rather than large movement.",
    ctaMicroInteraction: "Ink/accent color shift and focus state.",
    scrollBehaviour: "Native or optional Lenis smooth scroll when the page is story-led.",
    reducedMotionFallback: "Disable stagger and transforms; preserve all text and reading order.",
    libraries: ["framer-motion", "lenis"],
    heavy: false,
  },
  "Glass Motion": {
    name: "Glass Motion",
    pageTransition: "Soft opacity transition with restrained layered surfaces.",
    heroAnimation: "Layered surface reveal using opacity and small y movement only.",
    sectionReveal: "Reveal glass panels in short groups, never continuously.",
    cardHover: "Subtle border, shadow, and background-depth changes.",
    ctaMicroInteraction: "Glow/accent feedback kept under 180ms.",
    scrollBehaviour: "Native scroll by default; no scroll-jacking.",
    reducedMotionFallback: "Remove blur/transform transitions and keep surfaces static.",
    libraries: ["framer-motion"],
    heavy: true,
  },
  "Industrial Precision": {
    name: "Industrial Precision",
    pageTransition: "Crisp opacity transition with no theatrical delay.",
    heroAnimation: "Precise headline/proof reveal with short linear-feeling timing.",
    sectionReveal: "Grid and process sections reveal in stable blocks.",
    cardHover: "Border, status accent, and shadow feedback; no bounce.",
    ctaMicroInteraction: "Mechanical pressed state and accessible focus ring.",
    scrollBehaviour: "Native scroll. Avoid smooth-scroll abstraction for operational audiences.",
    reducedMotionFallback: "Disable transforms and retain all proof/process content in static order.",
    libraries: ["framer-motion"],
    heavy: false,
  },
}

export function isForgeAnimationPack(value: unknown): value is ForgeAnimationPackName {
  return typeof value === "string" && FORGE_ANIMATION_PACKS.includes(value as ForgeAnimationPackName)
}

export function getForgeAnimationPack(value: unknown): ForgeAnimationPack {
  return FORGE_ANIMATION_PACK_DEFINITIONS[isForgeAnimationPack(value) ? value : "Smooth Local Business"]
}

export function chooseForgeAnimationPack(input: {
  industry?: string | null
  brandNotes?: string | null
  stylePack?: string | null
  visualStyle?: string | null
}): ForgeAnimationPackName {
  const text = `${input.industry ?? ""} ${input.brandNotes ?? ""} ${input.stylePack ?? ""} ${input.visualStyle ?? ""}`.toLowerCase()
  if (/cinematic|luxury|hospitality|venue|portfolio/.test(text)) return "Cinematic Hero"
  if (/gaming|minecraft|server|discord|neon|command hub/.test(text)) return "Glass Motion"
  if (/glass|saas|software|platform|app/.test(text)) return "Glass Motion"
  if (/editorial|magazine|journal|creative|story/.test(text)) return "Editorial Reveal"
  if (/industrial|manufactur|machin|repair|engineering|trade/.test(text)) return "Industrial Precision"
  if (/minimal|calm|professional|premium/.test(text)) return "Minimal Premium"
  return "Smooth Local Business"
}

export function buildForgeAnimationWarning(packName: ForgeAnimationPackName, stylePack?: string | null) {
  const pack = getForgeAnimationPack(packName)
  const simpleLocal = /clean local|clean local professional|high-conversion service|wellness soft|soft wellness/i.test(stylePack ?? "")
  if (!pack.heavy || !simpleLocal) return null
  return `${pack.name} is a heavier animation pack. For a simple local/service business, keep this restrained and remove any motion that slows proof, service copy, or enquiry.`
}

export function buildForgeAnimationConfigForSite(packName: ForgeAnimationPackName) {
  const pack = getForgeAnimationPack(packName)
  return {
    name: pack.name,
    pageTransition: pack.pageTransition,
    heroAnimation: pack.heroAnimation,
    sectionReveal: pack.sectionReveal,
    cardHover: pack.cardHover,
    ctaMicroInteraction: pack.ctaMicroInteraction,
    scrollBehaviour: pack.scrollBehaviour,
    reducedMotionFallback: pack.reducedMotionFallback,
    libraries: pack.libraries,
    heavy: pack.heavy,
    useLenis: pack.libraries.includes("lenis"),
    useGsap: pack.libraries.includes("gsap"),
    riveLottiePlaceholder: "Reserved for approved animation assets only.",
    threePlaceholder: "Three.js/React Three Fiber is not included unless explicitly selected in a later approved generation pass.",
  }
}
