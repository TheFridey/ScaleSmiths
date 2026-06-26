import type { ForgeJsonSchema, JsonValue } from "./forge-ai"
import type { ForgeIntakeData } from "./forge"
import type { ForgeResearchReport } from "./forge-research"
import type { ForgeSitemapStrategy } from "./forge-sitemap"
import type { ForgeCopyDocument } from "./forge-copy"
import { validateJsonSchemaValue } from "./forge-ai"
import {
  FORGE_ANIMATION_PACKS,
  buildForgeAnimationWarning,
  chooseForgeAnimationPack,
  getForgeAnimationPack,
  isForgeAnimationPack,
  type ForgeAnimationPackName,
} from "./forge-animation"

export const FORGE_DESIGN_ARTIFACT_TITLE = "Design Direction"
export const FORGE_DESIGN_ARTIFACT_KIND = "forge_design_direction"

export const FORGE_DESIGN_STYLE_PACKS = [
  "Neon command hub",
  "Luxury dark premium",
  "Clean local professional",
  "Bold trade/industrial",
  "Soft wellness/beauty",
  "Charity trust/friendly",
  "SaaS glass dashboard",
  "Ecommerce conversion",
  "Editorial/content-led",
] as const

export type ForgeDesignStylePack = (typeof FORGE_DESIGN_STYLE_PACKS)[number]

export interface ForgeDesignDirection extends Record<string, JsonValue> {
  designStyleName: string
  selectedStylePack: ForgeDesignStylePack
  selectedAnimationPack: ForgeAnimationPackName
  hybridWith: ForgeDesignStylePack[]
  stylePackRationale: string
  visualDirection: string
  mood: string
  typographyDirection: string
  spacingRhythm: string
  sectionRhythm: string
  colourUsage: string
  colourPalette: string
  componentStyle: string
  ctaStyle: string
  animationStyle: string
  imageTreatment: string
  imageryIconDirection: string
  forbiddenDesignMismatches: string[]
  designTokens: ForgeDesignTokens
  premiumInteractionIdeas: string[]
  motionSections: string[]
  staticSections: string[]
  mobileUxNotes: string[]
  overAnimationWarning: string
}

export interface ForgeDesignTokens extends Record<string, JsonValue> {
  fontDisplay: string
  fontBody: string
  surface: string
  surfaceAlt: string
  ink: string
  muted: string
  line: string
  brand: string
  accent: string
  accentAlt: string
  ctaText: string
  heroBackground: string
}

export interface ForgeDesignProjectContext {
  id?: number
  name: string
  businessName: string
  industry: string | null
  brandNotes: string | null
  targetAudience: string | null
}

export interface ForgeDesignArtifactState {
  direction: ForgeDesignDirection | null
  approvedDirection: ForgeDesignDirection | null
  status: "draft" | "approved" | "empty"
  approvedAt: string | null
  approvedBy: string | null
}

export const FORGE_DESIGN_DIRECTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "designStyleName",
    "selectedStylePack",
    "selectedAnimationPack",
    "hybridWith",
    "stylePackRationale",
    "visualDirection",
    "mood",
    "typographyDirection",
    "spacingRhythm",
    "sectionRhythm",
    "colourUsage",
    "colourPalette",
    "componentStyle",
    "ctaStyle",
    "animationStyle",
    "imageTreatment",
    "imageryIconDirection",
    "forbiddenDesignMismatches",
    "designTokens",
    "premiumInteractionIdeas",
    "motionSections",
    "staticSections",
    "mobileUxNotes",
    "overAnimationWarning",
  ],
  properties: {
    designStyleName: { type: "string" },
    selectedStylePack: { type: "string", enum: [...FORGE_DESIGN_STYLE_PACKS] },
    selectedAnimationPack: { type: "string", enum: [...FORGE_ANIMATION_PACKS] },
    hybridWith: { type: "array", items: { type: "string", enum: [...FORGE_DESIGN_STYLE_PACKS] } },
    stylePackRationale: { type: "string" },
    visualDirection: { type: "string" },
    mood: { type: "string" },
    typographyDirection: { type: "string" },
    spacingRhythm: { type: "string" },
    sectionRhythm: { type: "string" },
    colourUsage: { type: "string" },
    colourPalette: { type: "string" },
    componentStyle: { type: "string" },
    ctaStyle: { type: "string" },
    animationStyle: { type: "string" },
    imageTreatment: { type: "string" },
    imageryIconDirection: { type: "string" },
    forbiddenDesignMismatches: { type: "array", items: { type: "string" } },
    designTokens: {
      type: "object",
      additionalProperties: false,
      required: ["fontDisplay", "fontBody", "surface", "surfaceAlt", "ink", "muted", "line", "brand", "accent", "accentAlt", "ctaText", "heroBackground"],
      properties: {
        fontDisplay: { type: "string" },
        fontBody: { type: "string" },
        surface: { type: "string" },
        surfaceAlt: { type: "string" },
        ink: { type: "string" },
        muted: { type: "string" },
        line: { type: "string" },
        brand: { type: "string" },
        accent: { type: "string" },
        accentAlt: { type: "string" },
        ctaText: { type: "string" },
        heroBackground: { type: "string" },
      },
    },
    premiumInteractionIdeas: { type: "array", items: { type: "string" } },
    motionSections: { type: "array", items: { type: "string" } },
    staticSections: { type: "array", items: { type: "string" } },
    mobileUxNotes: { type: "array", items: { type: "string" } },
    overAnimationWarning: { type: "string" },
  },
} as const satisfies ForgeJsonSchema

type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string }

export function parseForgeDesignDirectionPayload(input: unknown): ParseResult<ForgeDesignDirection> {
  const normalizedInput = normalizeLegacyDesignDirection(input)
  const errors = validateJsonSchemaValue(FORGE_DESIGN_DIRECTION_SCHEMA, normalizedInput)
  if (errors.length) return { ok: false, error: errors.join(" ") }
  return { ok: true, data: normalizeDesignDirection(normalizedInput as ForgeDesignDirection) }
}

export function readForgeDesignDirectionArtifact(metadata: Record<string, unknown> | null | undefined): ForgeDesignArtifactState {
  if (!metadata || metadata.kind !== FORGE_DESIGN_ARTIFACT_KIND) {
    return {
      direction: null,
      approvedDirection: null,
      status: "empty",
      approvedAt: null,
      approvedBy: null,
    }
  }

  const parsedDirection = parseForgeDesignDirectionPayload(metadata.direction)
  const parsedApprovedDirection = parseForgeDesignDirectionPayload(metadata.approvedDirection)
  const direction = parsedDirection.ok ? parsedDirection.data : null
  const approvedDirection = parsedApprovedDirection.ok ? parsedApprovedDirection.data : null

  return {
    direction,
    approvedDirection,
    status: metadata.status === "approved" && approvedDirection ? "approved" : direction ? "draft" : "empty",
    approvedAt: typeof metadata.approvedAt === "string" ? metadata.approvedAt : null,
    approvedBy: typeof metadata.approvedBy === "string" ? metadata.approvedBy : null,
  }
}

export function buildForgeDesignPrompt({
  project,
  intake,
  intakeSummary,
  researchReport,
  approvedSitemap,
  approvedCopy,
  preferredStylePack,
  preferredAnimationPack,
}: {
  project: ForgeDesignProjectContext
  intake: ForgeIntakeData
  intakeSummary: string
  researchReport: ForgeResearchReport | null
  approvedSitemap: ForgeSitemapStrategy
  approvedCopy: ForgeCopyDocument
  preferredStylePack?: ForgeDesignStylePack | null
  preferredAnimationPack?: ForgeAnimationPackName | null
}) {
  return [
    "Generate a practical premium design direction before any code is created.",
    "Do not create generic AI website direction. Make concrete decisions that a designer/developer can execute.",
    "Recommend one internal style pack or a deliberate hybrid, and justify why it fits the business, copy, audience, and approved sitemap strategy pack.",
    "You must lock design tokens: fonts, surface, ink, muted text, line, brand, accent, secondary accent, CTA text, and hero background.",
    "The visual direction, colour palette, typography, section rhythm, component style, animation style, CTA style, and imagery/icon direction must match the chosen style pack.",
    "List forbidden design mismatches that would fail QA, such as beige editorial styling for a neon gaming command hub.",
    "Include a clear warning against over-animated designs; motion must support comprehension and conversion.",
    `Internal style packs: ${FORGE_DESIGN_STYLE_PACKS.join(", ")}.`,
    `Internal animation packs: ${FORGE_ANIMATION_PACKS.join(", ")}.`,
    "Recommend one animation pack and keep it controlled: premium means purposeful motion, not chaotic timelines.",
    preferredStylePack ? `Admin preferred style pack: ${preferredStylePack}. Use it if it fits, otherwise explain the better choice.` : "No admin preferred style pack supplied.",
    preferredAnimationPack ? `Admin preferred animation pack: ${preferredAnimationPack}. Use it if it fits, otherwise explain the safer choice.` : "No admin preferred animation pack supplied.",
    "",
    "Project:",
    `- Project name: ${project.name}`,
    `- Business name: ${project.businessName}`,
    `- Industry: ${project.industry ?? "Not provided"}`,
    `- Brand notes: ${project.brandNotes ?? "Not provided"}`,
    `- Target audience: ${project.targetAudience ?? "Not provided"}`,
    "",
    "Structured intake:",
    ...Object.entries(intake).map(([key, value]) => `- ${key}: ${value || "Not provided"}`),
    "",
    "Intake summary:",
    intakeSummary || "No intake summary available.",
    "",
    "Research report:",
    researchReport ? JSON.stringify(researchReport, null, 2) : "No research report available.",
    "",
    "Approved sitemap:",
    JSON.stringify(approvedSitemap, null, 2),
    "",
    "Approved copy:",
    JSON.stringify(approvedCopy, null, 2),
  ].join("\n")
}

export function buildForgeDesignArtifactContent(direction: ForgeDesignDirection) {
  return [
    "# Design Direction",
    "",
    `Style: ${direction.designStyleName}`,
    `Selected pack: ${direction.selectedStylePack}`,
    `Animation pack: ${direction.selectedAnimationPack}`,
    `Hybrid with: ${direction.hybridWith.join(", ") || "None"}`,
    "",
    "## Why this pack",
    direction.stylePackRationale,
    "",
    "## Visual direction",
    direction.visualDirection,
    "",
    "## Mood",
    direction.mood,
    "",
    "## Typography",
    direction.typographyDirection,
    "",
    "## Spacing rhythm",
    direction.spacingRhythm,
    "",
    "## Section rhythm",
    direction.sectionRhythm,
    "",
    "## Colour usage",
    direction.colourUsage,
    "",
    "## Colour palette",
    direction.colourPalette,
    "",
    "## Component style",
    direction.componentStyle,
    "",
    "## CTA style",
    direction.ctaStyle,
    "",
    "## Animation style",
    direction.animationStyle,
    "",
    "## Animation pack behaviour",
    ...animationPackLines(direction.selectedAnimationPack),
    "",
    "## Image treatment",
    direction.imageTreatment,
    "",
    "## Imagery/icon direction",
    direction.imageryIconDirection,
    "",
    "## Locked design tokens",
    ...Object.entries(direction.designTokens).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Forbidden design mismatches",
    ...direction.forbiddenDesignMismatches.map((item) => `- ${item}`),
    "",
    "## Premium interaction ideas",
    ...direction.premiumInteractionIdeas.map((item) => `- ${item}`),
    "",
    "## Sections that should use motion",
    ...direction.motionSections.map((item) => `- ${item}`),
    "",
    "## Sections that should stay static",
    ...direction.staticSections.map((item) => `- ${item}`),
    "",
    "## Mobile UX notes",
    ...direction.mobileUxNotes.map((item) => `- ${item}`),
    "",
    "## Over-animation warning",
    direction.overAnimationWarning,
  ].join("\n").trim()
}

export function createMockDesignDirection({
  project,
  intake,
  approvedSitemap,
  approvedCopy,
  preferredStylePack,
  preferredAnimationPack,
}: {
  project: ForgeDesignProjectContext
  intake: ForgeIntakeData
  approvedSitemap: ForgeSitemapStrategy
  approvedCopy: ForgeCopyDocument
  preferredStylePack?: ForgeDesignStylePack | null
  preferredAnimationPack?: ForgeAnimationPackName | null
}): ForgeDesignDirection {
  const selectedStylePack = preferredStylePack ?? chooseStylePack(project, intake)
  const selectedAnimationPack = preferredAnimationPack ?? chooseForgeAnimationPack({
    industry: project.industry,
    brandNotes: project.brandNotes,
    stylePack: selectedStylePack,
    visualStyle: intake.visualStyle,
  })
  const hybridWith = selectedStylePack === "Bold trade/industrial" ? ["Clean local professional" as const] : selectedStylePack === "Luxury dark premium" ? ["Editorial/content-led" as const] : []
  const businessName = project.businessName || project.name
  const firstPage = approvedSitemap.sitemap[0]?.title ?? "Home"
  const firstCopy = approvedCopy.pages[0]?.h1 ?? businessName
  const tokens = designTokensForPack(selectedStylePack)
  const visual = visualDirectionForPack(selectedStylePack)

  return normalizeDesignDirection({
    designStyleName: hybridWith.length ? `${selectedStylePack} / ${hybridWith[0]} hybrid` : `${selectedStylePack} direction`,
    selectedStylePack,
    selectedAnimationPack,
    hybridWith,
    stylePackRationale: `${selectedStylePack} fits ${businessName} because the industry, copy, and audience need a site that feels credible, specific, and easy to act on. The direction supports the approved ${firstPage} structure and the copy line "${firstCopy}" without turning the site into a generic AI-styled template.`,
    visualDirection: visual,
    mood: moodForPack(selectedStylePack),
    typographyDirection: typographyForPack(selectedStylePack),
    spacingRhythm: "Use generous section spacing on desktop, tighter grouped spacing inside service cards, and predictable vertical rhythm on mobile so proof, copy, and CTAs remain connected.",
    sectionRhythm: sectionRhythmForPack(selectedStylePack),
    colourUsage: colourForPack(selectedStylePack),
    colourPalette: `Locked palette: surface ${tokens.surface}, alternate ${tokens.surfaceAlt}, ink ${tokens.ink}, brand ${tokens.brand}, accent ${tokens.accent}, secondary accent ${tokens.accentAlt}.`,
    componentStyle: "Build sturdy service cards, proof bands, process rows, compact CTA panels, and forms with clear focus states. Avoid decorative cards that do not support a conversion job.",
    ctaStyle: ctaStyleForPack(selectedStylePack),
    animationStyle: `${selectedAnimationPack}: ${getForgeAnimationPack(selectedAnimationPack).sectionReveal} ${getForgeAnimationPack(selectedAnimationPack).reducedMotionFallback}`,
    imageTreatment: imageForPack(selectedStylePack, intake),
    imageryIconDirection: imageryIconForPack(selectedStylePack),
    forbiddenDesignMismatches: forbiddenMismatchesForPack(selectedStylePack),
    designTokens: tokens,
    premiumInteractionIdeas: [
      "CTA buttons should show clear hover/focus feedback and never shift layout.",
      "Service cards can reveal a concise proof point or next-step prompt on hover.",
      "Forms should confirm progress and validation with calm inline states.",
    ],
    motionSections: [
      "Hero proof/CTA reveal",
      "Service card hover states",
      "Process step progression",
    ],
    staticSections: [
      "Core service explanations",
      "Testimonials and compliance proof",
      "Contact details and form fields",
    ],
    mobileUxNotes: [
      "Keep the primary CTA visible after the hero without blocking content.",
      "Stack proof directly under claims so users do not have to hunt for credibility.",
      "Use large tap targets, short form groups, and minimal animation on mobile.",
    ],
    overAnimationWarning: buildForgeAnimationWarning(selectedAnimationPack, selectedStylePack) ?? "Do not over-animate this design. Motion should be restrained, quick, and purposeful; trust proof, service copy, contact details, and forms should stay stable and easy to read.",
  })
}

export function normalizeDesignDirection(direction: ForgeDesignDirection): ForgeDesignDirection {
  const selectedStylePack = isForgeDesignStylePack(direction.selectedStylePack)
    ? direction.selectedStylePack
    : "Clean local professional"
  const warning = direction.overAnimationWarning.trim()
  const selectedAnimationPack = isForgeAnimationPack(direction.selectedAnimationPack)
    ? direction.selectedAnimationPack
    : chooseForgeAnimationPack({
      stylePack: selectedStylePack,
      brandNotes: direction.stylePackRationale,
      visualStyle: direction.animationStyle,
    })
  const animationWarning = buildForgeAnimationWarning(selectedAnimationPack, selectedStylePack)
  const tokens = direction.designTokens ?? designTokensForPack(selectedStylePack)

  return {
    ...direction,
    selectedStylePack,
    selectedAnimationPack,
    hybridWith: direction.hybridWith.filter((pack) => FORGE_DESIGN_STYLE_PACKS.includes(pack)),
    visualDirection: direction.visualDirection || visualDirectionForPack(selectedStylePack),
    typographyDirection: direction.typographyDirection || typographyForPack(selectedStylePack),
    sectionRhythm: direction.sectionRhythm || sectionRhythmForPack(selectedStylePack),
    colourPalette: direction.colourPalette || `Locked palette: surface ${tokens.surface}, brand ${tokens.brand}, accent ${tokens.accent}.`,
    ctaStyle: direction.ctaStyle || ctaStyleForPack(selectedStylePack),
    imageryIconDirection: direction.imageryIconDirection || imageryIconForPack(selectedStylePack),
    forbiddenDesignMismatches: direction.forbiddenDesignMismatches?.length ? direction.forbiddenDesignMismatches : forbiddenMismatchesForPack(selectedStylePack),
    designTokens: tokens,
    overAnimationWarning: [
      /over-animate|over animated|over-animated|restrained|purposeful|stable/i.test(warning)
        ? warning
        : `${warning} Avoid over-animated design; motion must be restrained, purposeful, and never compete with copy, proof, or forms.`.trim(),
      animationWarning,
    ].filter(Boolean).join(" "),
  }
}

export function isForgeDesignStylePack(value: unknown): value is ForgeDesignStylePack {
  return typeof value === "string" && FORGE_DESIGN_STYLE_PACKS.includes(value as ForgeDesignStylePack)
}

function chooseStylePack(project: ForgeDesignProjectContext, intake: ForgeIntakeData): ForgeDesignStylePack {
  const text = `${project.name} ${project.businessName} ${project.industry ?? ""} ${project.brandNotes ?? ""} ${project.targetAudience ?? ""} ${intake.visualStyle} ${intake.brandTone} ${intake.coreServices} ${intake.requiredIntegrations} ${intake.conversionActions}`.toLowerCase()

  if (/minecraft|gaming|server|discord|neon|command hub|cyber|esports|players/.test(text)) return "Neon command hub"
  if (/industrial|manufactur|machin|repair|trade|engineering|construction|factory/.test(text)) return "Bold trade/industrial"
  if (/wellness|clinic|therapy|health|beauty|spa|fitness|salon/.test(text)) return "Soft wellness/beauty"
  if (/charity|nonprofit|non-profit|donate|volunteer|foundation/.test(text)) return "Charity trust/friendly"
  if (/store|shop|ecommerce|e-commerce|checkout|cart|product/.test(text)) return "Ecommerce conversion"
  if (/startup|software|app|saas|platform|dashboard/.test(text)) return "SaaS glass dashboard"
  if (/magazine|editorial|journal|creative|portfolio|content|creator/.test(text)) return "Editorial/content-led"
  if (/luxury|premium|private|boutique/.test(text)) return "Luxury dark premium"
  return "Clean local professional"
}

function moodForPack(pack: ForgeDesignStylePack) {
  const moods: Record<ForgeDesignStylePack, string> = {
    "Neon command hub": "Dark, electric, high-energy, gaming-native, and operational.",
    "Luxury dark premium": "Deep, restrained, high-contrast, and selective with visual drama.",
    "Clean local professional": "Bright, practical, friendly, and visibly trustworthy.",
    "Bold trade/industrial": "Strong, grounded, precise, and operationally credible.",
    "Soft wellness/beauty": "Calm, warm, reassuring, and breathable.",
    "Charity trust/friendly": "Human, transparent, warm, and confidence-building.",
    "SaaS glass dashboard": "Polished, layered, product-system oriented, and crisp.",
    "Ecommerce conversion": "Product-led, energetic, scannable, and purchase-focused.",
    "Editorial/content-led": "Composed, spacious, story-led, and refined.",
  }
  return moods[pack]
}

function colourForPack(pack: ForgeDesignStylePack) {
  const colours: Record<ForgeDesignStylePack, string> = {
    "Neon command hub": "Use near-black foundations with electric cyan, violet, and lime accents. Never use beige, cream, brown, or Georgia-led editorial styling.",
    "Luxury dark premium": "Use charcoal and black foundations with warm metallic accents sparingly. Keep contrast high and reserve accent colour for conversion points.",
    "Clean local professional": "Use a clean neutral base, one confident brand accent, and soft status colours for trust proof and calls to action.",
    "Bold trade/industrial": "Use steel neutrals, strong dark text, safety-accent highlights, and occasional muted green/amber proof states.",
    "Soft wellness/beauty": "Use soft neutrals, calming green/blue accents, and gentle contrast that remains accessible.",
    "Charity trust/friendly": "Use optimistic blues/greens, warm white surfaces, and accessible contrast that supports trust and action.",
    "SaaS glass dashboard": "Use cool dark or light neutrals, translucent surfaces, and controlled cyan/blue accents inside product-like UI moments.",
    "Ecommerce conversion": "Use high-contrast product cards, bold sale/action accents, and clear trust/status colours.",
    "Editorial/content-led": "Use warm neutrals, ink-like text, and restrained accent blocks that make long copy feel intentional.",
  }
  return colours[pack]
}

function imageForPack(pack: ForgeDesignStylePack, intake: ForgeIntakeData) {
  const assets = intake.existingAssets || "real team, process, workspace, product, or service imagery"
  if (pack === "Neon command hub") return `Use game/server visuals, command panels, status cards, Discord/store cues, neon iconography, screenshots, or generated gaming-style imagery from ${assets}. Avoid beige lifestyle/editorial imagery.`
  if (pack === "Bold trade/industrial") return `Use real workshop, equipment, team, process, or outcome imagery from ${assets}. Avoid abstract tech imagery.`
  if (pack === "Soft wellness/beauty") return `Use warm, human, natural-light imagery from ${assets}. Avoid sterile stock photos.`
  if (pack === "Luxury dark premium") return `Use selective, high-quality product/process imagery from ${assets}, with careful cropping and strong contrast.`
  return `Use real business imagery from ${assets}. Images should prove the business is real, capable, and relevant to the service area.`
}

export function designTokensForPack(pack: ForgeDesignStylePack): ForgeDesignTokens {
  const tokens: Record<ForgeDesignStylePack, ForgeDesignTokens> = {
    "Neon command hub": {
      fontDisplay: "Orbitron",
      fontBody: "Inter",
      surface: "#05070f",
      surfaceAlt: "#0b1020",
      ink: "#f8fbff",
      muted: "#a6b4cf",
      line: "rgba(34, 211, 238, 0.24)",
      brand: "#22d3ee",
      accent: "#8b5cf6",
      accentAlt: "#a3e635",
      ctaText: "#020617",
      heroBackground: "radial-gradient(circle at 20% 15%, rgba(34,211,238,.28), transparent 30%), radial-gradient(circle at 80% 25%, rgba(139,92,246,.26), transparent 32%), #05070f",
    },
    "Luxury dark premium": token("Playfair Display", "Inter", "#070707", "#111111", "#f8f3ea", "#b8afa3", "rgba(248,243,234,.16)", "#d7b56d", "#f5e6bd", "#8a6a2f", "#090909", "linear-gradient(135deg, #050505, #17120b)"),
    "Clean local professional": token("Inter", "Inter", "#f8fafc", "#ffffff", "#0f172a", "#64748b", "rgba(15,23,42,.12)", "#2563eb", "#14b8a6", "#22c55e", "#ffffff", "linear-gradient(135deg, #eff6ff, #ffffff)"),
    "Bold trade/industrial": token("Rajdhani", "Inter", "#f4f6f8", "#ffffff", "#111827", "#4b5563", "rgba(17,24,39,.16)", "#334155", "#f59e0b", "#16a34a", "#111827", "linear-gradient(135deg, #111827, #374151)"),
    "Soft wellness/beauty": token("Cormorant Garamond", "Inter", "#fbf8f4", "#ffffff", "#24342f", "#6b7c72", "rgba(36,52,47,.12)", "#6aa68b", "#d8a7b1", "#8dbfb0", "#ffffff", "linear-gradient(135deg, #f7efe8, #f2fbf7)"),
    "Charity trust/friendly": token("Nunito Sans", "Inter", "#f7fbff", "#ffffff", "#102033", "#5c6b7a", "rgba(16,32,51,.13)", "#2563eb", "#22c55e", "#f59e0b", "#ffffff", "linear-gradient(135deg, #e0f2fe, #f0fdf4)"),
    "SaaS glass dashboard": token("Space Grotesk", "Inter", "#08111f", "#0e1b2f", "#eff6ff", "#9fb4d0", "rgba(125,211,252,.18)", "#38bdf8", "#6366f1", "#22d3ee", "#020617", "radial-gradient(circle at 20% 10%, rgba(56,189,248,.22), transparent 35%), #08111f"),
    "Ecommerce conversion": token("Inter", "Inter", "#ffffff", "#f8fafc", "#111827", "#64748b", "rgba(17,24,39,.12)", "#111827", "#ef4444", "#f59e0b", "#ffffff", "linear-gradient(135deg, #ffffff, #fff7ed)"),
    "Editorial/content-led": token("Fraunces", "Inter", "#fbfaf7", "#ffffff", "#171717", "#66625c", "rgba(23,23,23,.12)", "#334155", "#b45309", "#64748b", "#ffffff", "linear-gradient(135deg, #fbfaf7, #f4efe6)"),
  }
  return tokens[pack]
}

function token(fontDisplay: string, fontBody: string, surface: string, surfaceAlt: string, ink: string, muted: string, line: string, brand: string, accent: string, accentAlt: string, ctaText: string, heroBackground: string): ForgeDesignTokens {
  return { fontDisplay, fontBody, surface, surfaceAlt, ink, muted, line, brand, accent, accentAlt, ctaText, heroBackground }
}

function visualDirectionForPack(pack: ForgeDesignStylePack) {
  if (pack === "Neon command hub") return "A full-screen gaming command-centre aesthetic with dark panels, neon edge light, server stat modules, Discord/store/action surfaces, and a hero that immediately feels like a premium game server hub."
  if (pack === "SaaS glass dashboard") return "Layered dashboard UI with glass surfaces, crisp product panels, and clear data/status modules."
  if (pack === "Ecommerce conversion") return "Product-first conversion layout with clear cards, offers, filters/categories, and persistent purchase CTAs."
  return `${pack} visual system with layout, colour, typography, imagery, and CTAs aligned to the selected brand context.`
}

function typographyForPack(pack: ForgeDesignStylePack) {
  if (pack === "Neon command hub") return "Use a futuristic geometric display face such as Orbitron for short headings and a crisp sans-serif such as Inter for UI/body copy. Do not use Georgia or beige editorial typography."
  if (pack === "Editorial/content-led") return "Use an editorial serif display face for headlines with a clean sans-serif body; preserve reading rhythm and generous line-height."
  if (pack === "Bold trade/industrial") return "Use a condensed, sturdy display face for headings and a practical sans-serif for dense proof/process copy."
  return "Use a display/body pairing that matches the selected pack and keeps headings distinctive while body copy remains highly readable."
}

function sectionRhythmForPack(pack: ForgeDesignStylePack) {
  if (pack === "Neon command hub") return "Alternate full-bleed dark command sections with dense stat/card grids, short copy blocks, and high-visibility CTA rows."
  if (pack === "Editorial/content-led") return "Use longer reading bands, image/text pacing, and restrained card density."
  return "Use section pacing that supports the selected pack's conversion model without cramped cards or decorative filler."
}

function ctaStyleForPack(pack: ForgeDesignStylePack) {
  if (pack === "Neon command hub") return "Primary CTAs are neon cyan or lime command buttons with dark text, sharp radius, subtle glow, and labels like Copy server IP, Join Discord, Login/Register, Visit store."
  if (pack === "Luxury dark premium") return "Primary CTAs are restrained metallic-accent buttons on dark surfaces with elegant hover states."
  return "Primary CTAs use the locked brand/accent tokens with strong contrast, visible focus states, and no layout shift."
}

function imageryIconForPack(pack: ForgeDesignStylePack) {
  if (pack === "Neon command hub") return "Use game/server imagery, pixel/block cues where tasteful, command/status icons, Discord/store symbols, and stat placeholders. Avoid local-service photography unless supplied."
  return "Use imagery and icons that prove the actual offer and audience context, not generic stock decoration."
}

function forbiddenMismatchesForPack(pack: ForgeDesignStylePack) {
  const common = ["Ignoring locked design tokens", "Using typography that contradicts the selected pack", "Using generic agency hero sections that do not represent the brand"]
  if (pack === "Neon command hub") return ["Beige, cream, tan, brown, or Georgia/editorial styling", "Local service or request-a-quote visual framing", "Hero with no gaming/server/status/Discord/store signal", ...common]
  if (pack === "Luxury dark premium") return ["Light generic SaaS dashboard look", "Cheap neon overload", ...common]
  return common
}

function normalizeLegacyDesignDirection(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input
  const record = { ...(input as Record<string, unknown>) }
  const selectedStylePack = normalizeStylePackAlias(record.selectedStylePack)
  record.selectedStylePack = selectedStylePack
  record.hybridWith = Array.isArray(record.hybridWith) ? record.hybridWith.map(normalizeStylePackAlias).filter(isForgeDesignStylePack) : []
  const tokens = designTokensForPack(selectedStylePack)
  record.visualDirection ??= visualDirectionForPack(selectedStylePack)
  record.typographyDirection ??= typographyForPack(selectedStylePack)
  record.sectionRhythm ??= sectionRhythmForPack(selectedStylePack)
  record.colourPalette ??= `Locked palette: surface ${tokens.surface}, brand ${tokens.brand}, accent ${tokens.accent}.`
  record.ctaStyle ??= ctaStyleForPack(selectedStylePack)
  record.imageryIconDirection ??= imageryIconForPack(selectedStylePack)
  record.forbiddenDesignMismatches ??= forbiddenMismatchesForPack(selectedStylePack)
  record.designTokens ??= tokens
  return record
}

function normalizeStylePackAlias(value: unknown): ForgeDesignStylePack {
  if (isForgeDesignStylePack(value)) return value
  const map: Record<string, ForgeDesignStylePack> = {
    "Luxury Dark": "Luxury dark premium",
    "Clean Local Pro": "Clean local professional",
    "Bold Startup": "SaaS glass dashboard",
    "Editorial Premium": "Editorial/content-led",
    "Glass SaaS": "SaaS glass dashboard",
    "Industrial Trust": "Bold trade/industrial",
    "Wellness Soft": "Soft wellness/beauty",
    "High-Conversion Service": "Clean local professional",
  }
  return typeof value === "string" && map[value] ? map[value] : "Clean local professional"
}

function animationPackLines(packName: ForgeAnimationPackName) {
  const pack = getForgeAnimationPack(packName)
  return [
    `- Page transition: ${pack.pageTransition}`,
    `- Hero animation: ${pack.heroAnimation}`,
    `- Section reveal: ${pack.sectionReveal}`,
    `- Card hover: ${pack.cardHover}`,
    `- CTA micro-interaction: ${pack.ctaMicroInteraction}`,
    `- Scroll behaviour: ${pack.scrollBehaviour}`,
    `- Reduced motion fallback: ${pack.reducedMotionFallback}`,
    `- Libraries: ${pack.libraries.join(", ")}`,
  ]
}
