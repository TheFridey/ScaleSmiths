import type { ForgeJsonSchema, JsonValue } from "./forge-ai"
import type { ForgeCopyDocument } from "./forge-copy"
import type { ForgeDesignDirection } from "./forge-design"
import type { ForgeIntakeData } from "./forge"
import type { ForgeResearchReport } from "./forge-research"
import type { ForgeSitemapStrategy } from "./forge-sitemap"
import { validateJsonSchemaValue } from "./forge-ai"

export const FORGE_DESIGN_SYSTEM_ARTIFACT_TITLE = "Design System Specification"
export const FORGE_DESIGN_SYSTEM_ARTIFACT_KIND = "forge_design_system_specification"
export const FORGE_DESIGN_SYSTEM_VERSION = "1.0.0"

export const FORGE_DESIGN_TOKEN_IDS = [
  "color.surface",
  "color.surfaceAlt",
  "color.ink",
  "color.muted",
  "color.line",
  "color.brand",
  "color.accent",
  "color.accentAlt",
  "color.ctaText",
  "typography.display",
  "typography.body",
  "space.1",
  "space.2",
  "space.3",
  "space.4",
  "space.5",
  "container.sm",
  "container.md",
  "container.lg",
  "radius.sm",
  "radius.md",
  "radius.lg",
  "shadow.none",
  "shadow.soft",
  "border.default",
] as const

export type ForgeDesignTokenId = (typeof FORGE_DESIGN_TOKEN_IDS)[number]
export type ForgeDesignTokenCategory = "colour" | "typography" | "spacing" | "container" | "radius" | "shadow" | "border"

export interface ForgeDesignSystemToken extends Record<string, JsonValue> {
  id: ForgeDesignTokenId
  category: ForgeDesignTokenCategory
  value: string
  required: boolean
  usage: string
  source: "approved_design_direction" | "approved_brand_fact" | "system_default"
}

export interface ForgeDesignSystemGuidance extends Record<string, JsonValue> {
  area: string
  required: boolean
  guidance: string
  tokenRefs: ForgeDesignTokenId[]
}

export interface ForgeDesignSystemSpecification extends Record<string, JsonValue> {
  kind: typeof FORGE_DESIGN_SYSTEM_ARTIFACT_KIND
  version: typeof FORGE_DESIGN_SYSTEM_VERSION
  brandAttributes: string[]
  visualDirection: string
  tokens: ForgeDesignSystemToken[]
  typographyScale: ForgeDesignSystemGuidance
  spacingScale: ForgeDesignSystemGuidance
  containerWidths: ForgeDesignSystemGuidance
  gridSystem: ForgeDesignSystemGuidance
  radiusSystem: ForgeDesignSystemGuidance
  shadowSystem: ForgeDesignSystemGuidance
  borderSystem: ForgeDesignSystemGuidance
  buttonHierarchy: ForgeDesignSystemGuidance
  formControls: ForgeDesignSystemGuidance
  cardTaxonomy: ForgeDesignSystemGuidance
  navigationPattern: ForgeDesignSystemGuidance
  footerPattern: ForgeDesignSystemGuidance
  sectionRhythm: ForgeDesignSystemGuidance
  iconography: ForgeDesignSystemGuidance
  imageTreatment: ForgeDesignSystemGuidance
  motionPrinciples: ForgeDesignSystemGuidance
  responsiveRules: ForgeDesignSystemGuidance
  accessibilityConstraints: ForgeDesignSystemGuidance
  requiredTokenIds: ForgeDesignTokenId[]
  optionalCreativeGuidance: string[]
  approvedFactReferences: string[]
  prohibitedStyleValues: string[]
  implementationReadiness: {
    approvedBeforeImplementation: boolean
    arbitraryStyleValuesAllowed: boolean
    notes: string[]
  }
}

export interface ForgeDesignSystemArtifactState {
  specification: ForgeDesignSystemSpecification | null
  approvedSpecification: ForgeDesignSystemSpecification | null
  status: "draft" | "approved" | "empty"
  approvedAt: string | null
  approvedBy: string | null
}

const GUIDANCE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["area", "required", "guidance", "tokenRefs"],
  properties: {
    area: { type: "string" },
    required: { type: "boolean" },
    guidance: { type: "string" },
    tokenRefs: { type: "array", items: { type: "string", enum: [...FORGE_DESIGN_TOKEN_IDS] } },
  },
} as const satisfies ForgeJsonSchema

export const FORGE_DESIGN_SYSTEM_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "kind",
    "version",
    "brandAttributes",
    "visualDirection",
    "tokens",
    "typographyScale",
    "spacingScale",
    "containerWidths",
    "gridSystem",
    "radiusSystem",
    "shadowSystem",
    "borderSystem",
    "buttonHierarchy",
    "formControls",
    "cardTaxonomy",
    "navigationPattern",
    "footerPattern",
    "sectionRhythm",
    "iconography",
    "imageTreatment",
    "motionPrinciples",
    "responsiveRules",
    "accessibilityConstraints",
    "requiredTokenIds",
    "optionalCreativeGuidance",
    "approvedFactReferences",
    "prohibitedStyleValues",
    "implementationReadiness",
  ],
  properties: {
    kind: { type: "string", enum: [FORGE_DESIGN_SYSTEM_ARTIFACT_KIND] },
    version: { type: "string", enum: [FORGE_DESIGN_SYSTEM_VERSION] },
    brandAttributes: { type: "array", items: { type: "string" } },
    visualDirection: { type: "string" },
    tokens: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "category", "value", "required", "usage", "source"],
        properties: {
          id: { type: "string", enum: [...FORGE_DESIGN_TOKEN_IDS] },
          category: { type: "string", enum: ["colour", "typography", "spacing", "container", "radius", "shadow", "border"] },
          value: { type: "string" },
          required: { type: "boolean" },
          usage: { type: "string" },
          source: { type: "string", enum: ["approved_design_direction", "approved_brand_fact", "system_default"] },
        },
      },
    },
    typographyScale: GUIDANCE_SCHEMA,
    spacingScale: GUIDANCE_SCHEMA,
    containerWidths: GUIDANCE_SCHEMA,
    gridSystem: GUIDANCE_SCHEMA,
    radiusSystem: GUIDANCE_SCHEMA,
    shadowSystem: GUIDANCE_SCHEMA,
    borderSystem: GUIDANCE_SCHEMA,
    buttonHierarchy: GUIDANCE_SCHEMA,
    formControls: GUIDANCE_SCHEMA,
    cardTaxonomy: GUIDANCE_SCHEMA,
    navigationPattern: GUIDANCE_SCHEMA,
    footerPattern: GUIDANCE_SCHEMA,
    sectionRhythm: GUIDANCE_SCHEMA,
    iconography: GUIDANCE_SCHEMA,
    imageTreatment: GUIDANCE_SCHEMA,
    motionPrinciples: GUIDANCE_SCHEMA,
    responsiveRules: GUIDANCE_SCHEMA,
    accessibilityConstraints: GUIDANCE_SCHEMA,
    requiredTokenIds: { type: "array", items: { type: "string", enum: [...FORGE_DESIGN_TOKEN_IDS] } },
    optionalCreativeGuidance: { type: "array", items: { type: "string" } },
    approvedFactReferences: { type: "array", items: { type: "string" } },
    prohibitedStyleValues: { type: "array", items: { type: "string" } },
    implementationReadiness: {
      type: "object",
      additionalProperties: false,
      required: ["approvedBeforeImplementation", "arbitraryStyleValuesAllowed", "notes"],
      properties: {
        approvedBeforeImplementation: { type: "boolean" },
        arbitraryStyleValuesAllowed: { type: "boolean" },
        notes: { type: "array", items: { type: "string" } },
      },
    },
  },
} as const satisfies ForgeJsonSchema

type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string }

export function parseForgeDesignSystemPayload(input: unknown): ParseResult<ForgeDesignSystemSpecification> {
  const errors = validateJsonSchemaValue(FORGE_DESIGN_SYSTEM_SCHEMA, input)
  if (errors.length) return { ok: false, error: errors.join(" ") }
  const spec = input as ForgeDesignSystemSpecification
  const missingRequired = FORGE_DESIGN_TOKEN_IDS.filter((id) => !spec.requiredTokenIds.includes(id))
  if (missingRequired.length) return { ok: false, error: `Design system is missing required token ids: ${missingRequired.join(", ")}.` }
  const duplicateTokens = duplicates(spec.tokens.map((token) => token.id))
  if (duplicateTokens.length) return { ok: false, error: `Design system has duplicate tokens: ${duplicateTokens.join(", ")}.` }
  const missingTokenDefs = spec.requiredTokenIds.filter((id) => !spec.tokens.some((token) => token.id === id))
  if (missingTokenDefs.length) return { ok: false, error: `Design system is missing token definitions: ${missingTokenDefs.join(", ")}.` }
  if (!spec.implementationReadiness.approvedBeforeImplementation || spec.implementationReadiness.arbitraryStyleValuesAllowed) {
    return { ok: false, error: "Design system must require approval before implementation and disallow arbitrary style values." }
  }
  return { ok: true, data: spec }
}

export function readForgeDesignSystemArtifact(metadata: Record<string, unknown> | null | undefined): ForgeDesignSystemArtifactState {
  if (!metadata || metadata.kind !== FORGE_DESIGN_SYSTEM_ARTIFACT_KIND) {
    return { specification: null, approvedSpecification: null, status: "empty", approvedAt: null, approvedBy: null }
  }
  const specification = parseForgeDesignSystemPayload(metadata.specification).ok ? metadata.specification as ForgeDesignSystemSpecification : null
  const approvedSpecification = parseForgeDesignSystemPayload(metadata.approvedSpecification).ok ? metadata.approvedSpecification as ForgeDesignSystemSpecification : null
  return {
    specification,
    approvedSpecification,
    status: metadata.status === "approved" && approvedSpecification ? "approved" : specification ? "draft" : "empty",
    approvedAt: typeof metadata.approvedAt === "string" ? metadata.approvedAt : null,
    approvedBy: typeof metadata.approvedBy === "string" ? metadata.approvedBy : null,
  }
}

export function createMockDesignSystemSpecification({
  project,
  intake,
  researchReport,
  approvedSitemap,
  approvedCopy,
  approvedDesign,
}: {
  project: { name: string; businessName: string; industry: string | null; brandNotes: string | null; targetAudience: string | null }
  intake: ForgeIntakeData
  researchReport: ForgeResearchReport | null
  approvedSitemap: ForgeSitemapStrategy
  approvedCopy: ForgeCopyDocument
  approvedDesign: ForgeDesignDirection
}): ForgeDesignSystemSpecification {
  const tokens = approvedDesign.designTokens
  const brandAttributes = [
    project.businessName || project.name,
    project.industry ?? "service business",
    approvedDesign.selectedStylePack,
    intake.brandTone || approvedDesign.mood,
  ].filter(Boolean)
  const factRefs = [
    `business:${project.businessName || project.name}`,
    project.industry ? `industry:${project.industry}` : null,
    intake.primaryLocation ? `primary_location:${intake.primaryLocation}` : null,
    intake.serviceAreas ? "service_areas:approved_intake" : null,
    researchReport ? "research_report:approved_context" : null,
    `sitemap_pages:${approvedSitemap.sitemap.length}`,
    `copy_pages:${approvedCopy.pages.length}`,
    `design_direction:${approvedDesign.designStyleName}`,
  ].filter((item): item is string => Boolean(item))

  const spec: ForgeDesignSystemSpecification = {
    kind: FORGE_DESIGN_SYSTEM_ARTIFACT_KIND,
    version: FORGE_DESIGN_SYSTEM_VERSION,
    brandAttributes,
    visualDirection: approvedDesign.visualDirection,
    tokens: [
      token("color.surface", "colour", tokens.surface, "Base page and dark/light section background", "approved_design_direction"),
      token("color.surfaceAlt", "colour", tokens.surfaceAlt, "Alternate bands, cards, and panels", "approved_design_direction"),
      token("color.ink", "colour", tokens.ink, "Primary readable text", "approved_design_direction"),
      token("color.muted", "colour", tokens.muted, "Secondary text and helper copy", "approved_design_direction"),
      token("color.line", "colour", tokens.line, "Dividers, outlines, and focus-adjacent borders", "approved_design_direction"),
      token("color.brand", "colour", tokens.brand, "Brand anchor colour", "approved_design_direction"),
      token("color.accent", "colour", tokens.accent, "Primary CTA and emphasis colour", "approved_design_direction"),
      token("color.accentAlt", "colour", tokens.accentAlt, "Secondary accent and status emphasis", "approved_design_direction"),
      token("color.ctaText", "colour", tokens.ctaText, "Primary CTA label colour", "approved_design_direction"),
      token("typography.display", "typography", tokens.fontDisplay, "Display headings", "approved_design_direction"),
      token("typography.body", "typography", tokens.fontBody, "Body, forms, navigation, and dense UI copy", "approved_design_direction"),
      token("space.1", "spacing", "0.5rem", "Small internal gaps", "system_default"),
      token("space.2", "spacing", "0.75rem", "Compact control and card gaps", "system_default"),
      token("space.3", "spacing", "1rem", "Standard content rhythm", "system_default"),
      token("space.4", "spacing", "1.5rem", "Section internals and grouped content", "system_default"),
      token("space.5", "spacing", "2.5rem", "Major section rhythm", "system_default"),
      token("container.sm", "container", "42rem", "Narrow reading/form content", "system_default"),
      token("container.md", "container", "64rem", "Standard page content", "system_default"),
      token("container.lg", "container", "76rem", "Wide grids and hero content", "system_default"),
      token("radius.sm", "radius", "0.375rem", "Inputs and small controls", "system_default"),
      token("radius.md", "radius", "0.5rem", "Cards and panels", "system_default"),
      token("radius.lg", "radius", "0.75rem", "Large media or hero surfaces only", "system_default"),
      token("shadow.none", "shadow", "none", "Default flat sections", "system_default"),
      token("shadow.soft", "shadow", "0 16px 40px rgba(15, 23, 42, 0.12)", "Elevated panels where useful", "system_default"),
      token("border.default", "border", `1px solid ${tokens.line}`, "Default border and divider style", "approved_design_direction"),
    ],
    typographyScale: guidance("Typography scale", true, `${approvedDesign.typographyDirection} Use fixed rem sizes, not viewport-scaled text.`, ["typography.display", "typography.body"]),
    spacingScale: guidance("Spacing scale", true, approvedDesign.spacingRhythm, ["space.1", "space.2", "space.3", "space.4", "space.5"]),
    containerWidths: guidance("Container widths", true, "Use the named container tokens for all page-width constraints; do not introduce one-off max widths.", ["container.sm", "container.md", "container.lg"]),
    gridSystem: guidance("Grid system", true, "Use 1-column mobile, 2-column tablet for comparison blocks, and 3-column desktop for service/proof grids when content density supports it.", ["container.lg", "space.4"]),
    radiusSystem: guidance("Radius system", true, "Use small radius for controls, medium radius for repeatable cards, and large radius only for major image/media surfaces.", ["radius.sm", "radius.md", "radius.lg"]),
    shadowSystem: guidance("Shadow system", true, "Default to no shadow. Use the soft shadow token only for elevated conversion panels or overlays.", ["shadow.none", "shadow.soft"]),
    borderSystem: guidance("Border system", true, "Use the default border token for cards, inputs, dividers, and navigation separation.", ["border.default", "color.line"]),
    buttonHierarchy: guidance("Button hierarchy", true, approvedDesign.ctaStyle, ["color.accent", "color.ctaText", "radius.sm"]),
    formControls: guidance("Form controls", true, "Inputs must use labelled fields, visible focus, clear error text, and no layout shift between states.", ["color.surfaceAlt", "color.ink", "color.line", "radius.sm"]),
    cardTaxonomy: guidance("Card taxonomy", true, "Cards are for repeatable service, proof, process, and FAQ items only. Do not wrap whole page sections in decorative cards.", ["color.surfaceAlt", "border.default", "radius.md"]),
    navigationPattern: guidance("Navigation pattern", true, "Header uses logo/business name, approved sitemap links, and one primary CTA. Mobile menu must be keyboard operable.", ["container.lg", "space.2", "color.ink"]),
    footerPattern: guidance("Footer pattern", true, "Footer repeats business identity, approved contact/service links, legal links, and only approved factual claims.", ["color.surfaceAlt", "color.muted", "container.lg"]),
    sectionRhythm: guidance("Section rhythm", true, approvedDesign.sectionRhythm, ["space.4", "space.5", "container.lg"]),
    iconography: guidance("Iconography", false, approvedDesign.imageryIconDirection, ["color.brand", "color.accent"]),
    imageTreatment: guidance("Image treatment", false, approvedDesign.imageTreatment, ["radius.lg", "color.line"]),
    motionPrinciples: guidance("Motion principles", true, `${approvedDesign.animationStyle} ${approvedDesign.overAnimationWarning}`, ["space.2"]),
    responsiveRules: guidance("Responsive rules", true, "Mobile content must stack predictably, keep CTAs visible after proof, and avoid horizontal overflow at 320px.", ["container.sm", "space.3"]),
    accessibilityConstraints: guidance("Accessibility constraints", true, "Maintain semantic landmarks, visible focus, labelled forms, accessible contrast, reduced-motion fallback, and tap targets of at least 44px.", ["color.ink", "color.surface", "color.accent"]),
    requiredTokenIds: [...FORGE_DESIGN_TOKEN_IDS],
    optionalCreativeGuidance: [
      approvedDesign.visualDirection,
      approvedDesign.imageTreatment,
      ...approvedDesign.premiumInteractionIdeas,
    ],
    approvedFactReferences: factRefs,
    prohibitedStyleValues: [
      "Ad hoc hex colours outside the token set",
      "One-off max-width values outside container tokens",
      "Viewport-width font sizing",
      "Negative letter spacing",
      ...approvedDesign.forbiddenDesignMismatches,
    ],
    implementationReadiness: {
      approvedBeforeImplementation: true,
      arbitraryStyleValuesAllowed: false,
      notes: [
        "Generated pages must consume named tokens or guidance from this approved artifact.",
        "Regeneration creates a new artifact version and must not overwrite approved history.",
      ],
    },
  }
  return spec
}

export function buildForgeDesignSystemPrompt(input: Parameters<typeof createMockDesignSystemSpecification>[0]) {
  return [
    "Create a first-class design-system specification before generated-page implementation.",
    "Return only structured JSON matching the schema. Use the provided token identifiers exactly; do not invent token ids.",
    "Distinguish required tokens from optional creative guidance. Required implementation values must be named tokens.",
    "Do not introduce arbitrary colours, spacing, widths, radii, shadows, or typography values outside the token set.",
    "Reference approved brand and business facts; do not invent client facts.",
    "Mark implementationReadiness.approvedBeforeImplementation true and arbitraryStyleValuesAllowed false.",
    "",
    "Project:",
    JSON.stringify(input.project, null, 2),
    "",
    "Approved intake:",
    JSON.stringify(input.intake, null, 2),
    "",
    "Research:",
    input.researchReport ? JSON.stringify(input.researchReport, null, 2) : "No approved research report available.",
    "",
    "Approved sitemap:",
    JSON.stringify(input.approvedSitemap, null, 2),
    "",
    "Approved copy:",
    JSON.stringify(input.approvedCopy, null, 2),
    "",
    "Approved design direction:",
    JSON.stringify(input.approvedDesign, null, 2),
  ].join("\n")
}

export function buildForgeDesignSystemArtifactContent(spec: ForgeDesignSystemSpecification) {
  return [
    "# Design System Specification",
    "",
    `Version: ${spec.version}`,
    "",
    "## Brand Attributes",
    ...spec.brandAttributes.map((item) => `- ${item}`),
    "",
    "## Visual Direction",
    spec.visualDirection,
    "",
    "## Required Tokens",
    ...spec.tokens.filter((token) => token.required).map((item) => `- ${item.id}: ${item.value} (${item.usage})`),
    "",
    "## Systems",
    ...[
      spec.typographyScale,
      spec.spacingScale,
      spec.containerWidths,
      spec.gridSystem,
      spec.radiusSystem,
      spec.shadowSystem,
      spec.borderSystem,
      spec.buttonHierarchy,
      spec.formControls,
      spec.cardTaxonomy,
      spec.navigationPattern,
      spec.footerPattern,
      spec.sectionRhythm,
      spec.iconography,
      spec.imageTreatment,
      spec.motionPrinciples,
      spec.responsiveRules,
      spec.accessibilityConstraints,
    ].map((item) => `### ${item.area}\n${item.guidance}\nTokens: ${item.tokenRefs.join(", ")}`),
    "",
    "## Optional Creative Guidance",
    ...spec.optionalCreativeGuidance.map((item) => `- ${item}`),
    "",
    "## Approved Fact References",
    ...spec.approvedFactReferences.map((item) => `- ${item}`),
    "",
    "## Prohibited Style Values",
    ...spec.prohibitedStyleValues.map((item) => `- ${item}`),
  ].join("\n").trim()
}

function token(id: ForgeDesignTokenId, category: ForgeDesignTokenCategory, value: string, usage: string, source: ForgeDesignSystemToken["source"]): ForgeDesignSystemToken {
  return { id, category, value, required: true, usage, source }
}

function guidance(area: string, required: boolean, guidanceText: string, tokenRefs: ForgeDesignTokenId[]): ForgeDesignSystemGuidance {
  return { area, required, guidance: guidanceText, tokenRefs }
}

function duplicates(values: readonly string[]) {
  const seen = new Set<string>()
  const repeated = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) repeated.add(value)
    seen.add(value)
  }
  return [...repeated]
}
