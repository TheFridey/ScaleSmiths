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
  "Luxury Dark",
  "Clean Local Pro",
  "Bold Startup",
  "Editorial Premium",
  "Glass SaaS",
  "Industrial Trust",
  "Wellness Soft",
  "High-Conversion Service",
] as const

export type ForgeDesignStylePack = (typeof FORGE_DESIGN_STYLE_PACKS)[number]

export interface ForgeDesignDirection extends Record<string, JsonValue> {
  designStyleName: string
  selectedStylePack: ForgeDesignStylePack
  selectedAnimationPack: ForgeAnimationPackName
  hybridWith: ForgeDesignStylePack[]
  stylePackRationale: string
  mood: string
  typographyDirection: string
  spacingRhythm: string
  colourUsage: string
  componentStyle: string
  animationStyle: string
  imageTreatment: string
  premiumInteractionIdeas: string[]
  motionSections: string[]
  staticSections: string[]
  mobileUxNotes: string[]
  overAnimationWarning: string
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
    "mood",
    "typographyDirection",
    "spacingRhythm",
    "colourUsage",
    "componentStyle",
    "animationStyle",
    "imageTreatment",
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
    mood: { type: "string" },
    typographyDirection: { type: "string" },
    spacingRhythm: { type: "string" },
    colourUsage: { type: "string" },
    componentStyle: { type: "string" },
    animationStyle: { type: "string" },
    imageTreatment: { type: "string" },
    premiumInteractionIdeas: { type: "array", items: { type: "string" } },
    motionSections: { type: "array", items: { type: "string" } },
    staticSections: { type: "array", items: { type: "string" } },
    mobileUxNotes: { type: "array", items: { type: "string" } },
    overAnimationWarning: { type: "string" },
  },
} as const satisfies ForgeJsonSchema

type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string }

export function parseForgeDesignDirectionPayload(input: unknown): ParseResult<ForgeDesignDirection> {
  const errors = validateJsonSchemaValue(FORGE_DESIGN_DIRECTION_SCHEMA, input)
  if (errors.length) return { ok: false, error: errors.join(" ") }
  return { ok: true, data: normalizeDesignDirection(input as ForgeDesignDirection) }
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

  const direction = parseForgeDesignDirectionPayload(metadata.direction).ok
    ? normalizeDesignDirection(metadata.direction as ForgeDesignDirection)
    : null
  const approvedDirection = parseForgeDesignDirectionPayload(metadata.approvedDirection).ok
    ? normalizeDesignDirection(metadata.approvedDirection as ForgeDesignDirection)
    : null

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
    "Recommend one internal style pack or a deliberate hybrid, and justify why it fits the business, copy, and audience.",
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
    "## Mood",
    direction.mood,
    "",
    "## Typography",
    direction.typographyDirection,
    "",
    "## Spacing rhythm",
    direction.spacingRhythm,
    "",
    "## Colour usage",
    direction.colourUsage,
    "",
    "## Component style",
    direction.componentStyle,
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
  const hybridWith = selectedStylePack === "Industrial Trust" ? ["High-Conversion Service" as const] : selectedStylePack === "Luxury Dark" ? ["Editorial Premium" as const] : []
  const businessName = project.businessName || project.name
  const firstPage = approvedSitemap.sitemap[0]?.title ?? "Home"
  const firstCopy = approvedCopy.pages[0]?.h1 ?? businessName

  return normalizeDesignDirection({
    designStyleName: hybridWith.length ? `${selectedStylePack} / ${hybridWith[0]} hybrid` : `${selectedStylePack} direction`,
    selectedStylePack,
    selectedAnimationPack,
    hybridWith,
    stylePackRationale: `${selectedStylePack} fits ${businessName} because the industry, copy, and audience need a site that feels credible, specific, and easy to act on. The direction supports the approved ${firstPage} structure and the copy line "${firstCopy}" without turning the site into a generic AI-styled template.`,
    mood: moodForPack(selectedStylePack),
    typographyDirection: "Use a confident display face for short headings, paired with a highly readable sans-serif for body copy. Keep headings compact, specific, and close to the supporting proof.",
    spacingRhythm: "Use generous section spacing on desktop, tighter grouped spacing inside service cards, and predictable vertical rhythm on mobile so proof, copy, and CTAs remain connected.",
    colourUsage: colourForPack(selectedStylePack),
    componentStyle: "Build sturdy service cards, proof bands, process rows, compact CTA panels, and forms with clear focus states. Avoid decorative cards that do not support a conversion job.",
    animationStyle: `${selectedAnimationPack}: ${getForgeAnimationPack(selectedAnimationPack).sectionReveal} ${getForgeAnimationPack(selectedAnimationPack).reducedMotionFallback}`,
    imageTreatment: imageForPack(selectedStylePack, intake),
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
  const warning = direction.overAnimationWarning.trim()
  const selectedAnimationPack = isForgeAnimationPack(direction.selectedAnimationPack)
    ? direction.selectedAnimationPack
    : chooseForgeAnimationPack({
      stylePack: direction.selectedStylePack,
      brandNotes: direction.stylePackRationale,
      visualStyle: direction.animationStyle,
    })
  const animationWarning = buildForgeAnimationWarning(selectedAnimationPack, direction.selectedStylePack)

  return {
    ...direction,
    selectedAnimationPack,
    hybridWith: direction.hybridWith.filter((pack) => FORGE_DESIGN_STYLE_PACKS.includes(pack)),
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
  const text = `${project.industry ?? ""} ${project.brandNotes ?? ""} ${intake.visualStyle} ${intake.brandTone} ${intake.coreServices}`.toLowerCase()

  if (/industrial|manufactur|machin|repair|trade|engineering/.test(text)) return "Industrial Trust"
  if (/wellness|clinic|therapy|health|beauty|spa|fitness/.test(text)) return "Wellness Soft"
  if (/luxury|premium|private|boutique/.test(text)) return "Luxury Dark"
  if (/startup|software|app|saas/.test(text)) return "Bold Startup"
  if (/magazine|editorial|journal|creative|portfolio/.test(text)) return "Editorial Premium"
  if (/conversion|lead|quote|service|local/.test(text)) return "High-Conversion Service"
  return "Clean Local Pro"
}

function moodForPack(pack: ForgeDesignStylePack) {
  const moods: Record<ForgeDesignStylePack, string> = {
    "Luxury Dark": "Deep, restrained, high-contrast, and selective with visual drama.",
    "Clean Local Pro": "Bright, practical, friendly, and visibly trustworthy.",
    "Bold Startup": "Confident, punchy, energetic, and outcome-led.",
    "Editorial Premium": "Composed, spacious, story-led, and refined.",
    "Glass SaaS": "Polished, light, layered, and product-system oriented.",
    "Industrial Trust": "Strong, grounded, precise, and operationally credible.",
    "Wellness Soft": "Calm, warm, reassuring, and breathable.",
    "High-Conversion Service": "Direct, clear, proof-heavy, and action-oriented.",
  }
  return moods[pack]
}

function colourForPack(pack: ForgeDesignStylePack) {
  const colours: Record<ForgeDesignStylePack, string> = {
    "Luxury Dark": "Use charcoal and black foundations with warm metallic accents sparingly. Keep contrast high and reserve accent colour for conversion points.",
    "Clean Local Pro": "Use a clean neutral base, one confident brand accent, and soft status colours for trust proof and calls to action.",
    "Bold Startup": "Use crisp neutrals with one saturated accent and small secondary colour moments for energy, not noise.",
    "Editorial Premium": "Use warm neutrals, ink-like text, and restrained accent blocks that make long copy feel intentional.",
    "Glass SaaS": "Use light neutrals, subtle translucent surfaces, and controlled accent gradients only inside product-like UI moments.",
    "Industrial Trust": "Use steel neutrals, strong dark text, safety-accent highlights, and occasional muted green/amber proof states.",
    "Wellness Soft": "Use soft neutrals, calming green/blue accents, and gentle contrast that remains accessible.",
    "High-Conversion Service": "Use a highly readable neutral base with one assertive CTA colour and clear proof/status accents.",
  }
  return colours[pack]
}

function imageForPack(pack: ForgeDesignStylePack, intake: ForgeIntakeData) {
  const assets = intake.existingAssets || "real team, process, workspace, product, or service imagery"
  if (pack === "Industrial Trust") return `Use real workshop, equipment, team, process, or outcome imagery from ${assets}. Avoid abstract tech imagery.`
  if (pack === "Wellness Soft") return `Use warm, human, natural-light imagery from ${assets}. Avoid sterile stock photos.`
  if (pack === "Luxury Dark") return `Use selective, high-quality product/process imagery from ${assets}, with careful cropping and strong contrast.`
  return `Use real business imagery from ${assets}. Images should prove the business is real, capable, and relevant to the service area.`
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
