import type { ForgeComponentSpecification } from "./forge-component-spec"
import type { ForgeCopyDocument, ForgePageCopy } from "./forge-copy"
import { designTokensForPack, type ForgeDesignDirection } from "./forge-design"
import { createMockDesignSystemSpecification, type ForgeDesignSystemSpecification, type ForgeDesignTokenId } from "./forge-design-system"
import { emptyForgeIntakeData } from "./forge"
import { buildForgeAnimationConfigForSite, getForgeAnimationPack } from "./forge-animation"
import { defaultForgeResendConfig, generatedResendConfigForSite, type ForgeResendConfig } from "./forge-resend"
import { defaultForgeWhatsAppConfig, generatedWhatsAppConfigForSite, type ForgeWhatsAppConfig } from "./forge-whatsapp"
import type { ForgeSitemapPage, ForgeSitemapStrategy } from "./forge-sitemap"
import {
  buildForgePageMetadata,
  resolveForgeSeoSiteUrl,
  type ForgeSeoBusiness,
  type ForgeSeoPageInput,
  type ForgeSeoPageMetadata,
} from "./forge-seo"
import { assertForgeWorkspaceFileAllowed, type ForgeWorkspaceMetadata } from "./forge-workspace"

export const FORGE_GENERATED_CODE_ARTIFACT_TITLE = "Generated Site Code Summary"
export const FORGE_GENERATED_CODE_ARTIFACT_KIND = "forge_generated_site_code"

export interface ForgeFrontendCodeProject {
  id: number
  name: string
  businessName: string
  industry: string | null
  websiteUrl: string | null
  brandNotes: string | null
  targetAudience: string | null
  primaryGoal: string | null
}

export interface ForgeGeneratedSitePage {
  title: string
  path: string
  template: "home" | "service" | "about" | "contact" | "local"
  purpose: string
  keyword: string
  searchIntent: string
  schema: string
  conversionNotes: string
  trustElements: string[]
  seoTitle: string
  metaDescription: string
  h1: string
  heroSubheading: string
  primaryCta: string
  secondaryCta: string
  sectionHeadings: string[]
  sections: { heading: string; body: string }[]
  faqItems: { question: string; answer: string }[]
  trustProofCopy: string
  serviceDescriptions: string[]
  localSeoCopy: string
}

export interface ForgeGeneratedSiteFile {
  path: string
  purpose: string
  content: string
}

export interface ForgeGeneratedCodeSummary extends Record<string, unknown> {
  kind: typeof FORGE_GENERATED_CODE_ARTIFACT_KIND
  workspacePath: string
  fileCount: number
  routeCount: number
  routes: string[]
  components: string[]
  integrationPlaceholders: string[]
  animationStack: string[]
  safetyChecks: string[]
  warnings: string[]
  generatedAt: string
}

export interface ForgeGeneratedCodeArtifactState {
  summary: ForgeGeneratedCodeSummary | null
  status: "generated" | "empty"
  generatedAt: string | null
}

export function readForgeGeneratedCodeArtifact(metadata: Record<string, unknown> | null | undefined): ForgeGeneratedCodeArtifactState {
  if (!metadata || metadata.kind !== FORGE_GENERATED_CODE_ARTIFACT_KIND || typeof metadata.summary !== "object" || metadata.summary === null) {
    return { summary: null, status: "empty", generatedAt: null }
  }

  const summary = metadata.summary as Partial<ForgeGeneratedCodeSummary>
  if (
    summary.kind !== FORGE_GENERATED_CODE_ARTIFACT_KIND ||
    typeof summary.workspacePath !== "string" ||
    typeof summary.fileCount !== "number" ||
    !Array.isArray(summary.routes) ||
    !Array.isArray(summary.components)
  ) {
    return { summary: null, status: "empty", generatedAt: null }
  }

  return {
    summary: summary as ForgeGeneratedCodeSummary,
    status: "generated",
    generatedAt: typeof summary.generatedAt === "string" ? summary.generatedAt : null,
  }
}

export interface ForgeFrontendSeoContext {
  primaryLocation: string | null
  serviceAreas: string[]
  telephone: string | null
  email: string | null
  sameAs: string[]
}

export function createForgeFrontendCodeFiles({
  project,
  workspace,
  approvedSitemap,
  approvedCopy,
  approvedDesign,
  approvedDesignSystem,
  approvedComponentSpec,
  integrationPlaceholders,
  resendConfig = defaultForgeResendConfig(),
  whatsappConfig = defaultForgeWhatsAppConfig(),
  seoContext,
}: {
  project: ForgeFrontendCodeProject
  workspace: ForgeWorkspaceMetadata
  approvedSitemap: ForgeSitemapStrategy
  approvedCopy: ForgeCopyDocument
  approvedDesign: ForgeDesignDirection
  approvedDesignSystem?: ForgeDesignSystemSpecification | null
  approvedComponentSpec: ForgeComponentSpecification
  integrationPlaceholders: string[]
  resendConfig?: ForgeResendConfig
  whatsappConfig?: ForgeWhatsAppConfig
  seoContext?: ForgeFrontendSeoContext
}) {
  const pages = buildGeneratedSitePages(project, approvedSitemap, approvedCopy)
  const components = approvedComponentSpec.components.map((component) => component.name)
  const animationPack = getForgeAnimationPack(approvedDesign.selectedAnimationPack)
  const designSystem = approvedDesignSystem ?? createMockDesignSystemSpecification({ project, intake: emptyForgeIntakeData(), researchReport: null, approvedSitemap, approvedCopy, approvedDesign })
  const seoBusiness = buildSeoBusiness(project, workspace, seoContext, approvedSitemap)
  const seoMetadata = pages.map((page) => buildForgePageMetadata(toSeoPageInput(page), seoBusiness))
  const files: ForgeGeneratedSiteFile[] = [
    { path: "package.json", purpose: "Generated site package and scripts", content: buildPackageJson(workspace.slug, approvedDesign) },
    { path: "next.config.mjs", purpose: "Next.js config", content: "const nextConfig = {}\n\nexport default nextConfig\n" },
    { path: "tsconfig.json", purpose: "TypeScript config", content: buildTsConfig() },
    { path: "postcss.config.mjs", purpose: "PostCSS and Tailwind config", content: "export default { plugins: { tailwindcss: {}, autoprefixer: {} } }\n" },
    { path: "tailwind.config.ts", purpose: "Tailwind content config generated from approved design-system tokens", content: buildTailwindConfig(approvedDesign, designSystem) },
    { path: "README.md", purpose: "Generated workspace notes and client handover", content: buildGeneratedReadme(project, workspace, approvedDesign, designSystem, resendConfig, whatsappConfig) },
    { path: "src/app/globals.css", purpose: "Global Tailwind and design-system token styling", content: buildGlobalsCss(approvedDesign, designSystem) },
    { path: "src/app/layout.tsx", purpose: "Root layout, navigation, footer, and metadata", content: buildLayoutFile(project, pages) },
    { path: "src/app/style-guide/page.tsx", purpose: "Internal generated style-guide for token, component, responsive, and motion QA", content: buildStyleGuidePageFile() },
    { path: "src/app/api/contact/route.ts", purpose: "Production-ready contact API route with Resend support", content: buildContactRouteFile() },
    { path: "src/lib/contact-validation.ts", purpose: "Contact form validation, honeypot, and rate limit helpers", content: buildContactValidationFile() },
    { path: "src/lib/email-template.ts", purpose: "Resend lead email template", content: buildEmailTemplateFile() },
    { path: "src/lib/animation-config.ts", purpose: "Generated controlled animation pack configuration", content: buildAnimationConfigFile(approvedDesign) },
    { path: "src/lib/resend-config.ts", purpose: "Generated Resend form configuration without API keys", content: buildResendConfigFile(resendConfig) },
    { path: "src/lib/whatsapp-config.ts", purpose: "Generated WhatsApp CTA configuration", content: buildWhatsAppConfigFile(whatsappConfig) },
    { path: "src/lib/design-tokens.ts", purpose: "Type-safe approved design-system token access", content: buildDesignTokensFile(designSystem) },
    { path: "src/lib/site-data.ts", purpose: "Typed site data generated from approved Forge artifacts", content: buildSiteDataFile(project, pages, approvedDesign, approvedComponentSpec, integrationPlaceholders, resendConfig, whatsappConfig) },
    { path: "src/lib/seo.ts", purpose: "Precomputed SEO/AEO/GEO metadata and JSON-LD per page", content: buildSeoDataFile(seoBusiness, seoMetadata) },
    { path: "src/lib/schema.ts", purpose: "JSON-LD schema helpers", content: buildSchemaFile() },
    { path: "src/app/sitemap.ts", purpose: "Next.js sitemap.xml route from SEO metadata", content: buildSitemapRouteFile() },
    { path: "src/app/robots.ts", purpose: "Next.js robots.txt route referencing the sitemap", content: buildRobotsRouteFile() },
    { path: "src/components/AnimationProvider.tsx", purpose: `${animationPack.name} scroll and motion boundary`, content: buildAnimationProviderComponent(approvedDesign) },
    { path: "src/components/MotionSection.tsx", purpose: "Reduced-motion-safe Framer Motion wrapper", content: buildMotionSectionComponent() },
    { path: "src/components/JsonLd.tsx", purpose: "JSON-LD script helper", content: buildJsonLdComponent() },
    { path: "src/components/Navigation.tsx", purpose: "Responsive site navigation", content: buildNavigationComponent() },
    { path: "src/components/Footer.tsx", purpose: "Site footer and service-area links", content: buildFooterComponent() },
    { path: "src/components/PageRenderer.tsx", purpose: "Section orchestration per page template", content: buildPageRendererComponent() },
    { path: "src/components/Hero.tsx", purpose: "Premium hero section", content: buildHeroComponent() },
    { path: "src/components/TrustBar.tsx", purpose: "Trust proof strip", content: buildTrustBarComponent() },
    { path: "src/components/ServicesGrid.tsx", purpose: "Service routing grid", content: buildServicesGridComponent() },
    { path: "src/components/ServiceDetail.tsx", purpose: "Service body copy and proof", content: buildServiceDetailComponent() },
    { path: "src/components/ProcessSection.tsx", purpose: "Process steps", content: buildProcessSectionComponent() },
    { path: "src/components/ReviewsSection.tsx", purpose: "Static reviews and proof section", content: buildReviewsSectionComponent() },
    { path: "src/components/FAQSection.tsx", purpose: "FAQ section with schema source", content: buildFaqSectionComponent() },
    { path: "src/components/ContactSection.tsx", purpose: "Contact routes and reassurance", content: buildContactSectionComponent() },
    { path: "src/components/WhatsAppCTA.tsx", purpose: "WhatsApp click-to-chat CTA", content: buildWhatsAppCtaComponent() },
    { path: "src/components/StickyWhatsAppButton.tsx", purpose: "Sticky WhatsApp click-to-chat button", content: buildStickyWhatsAppButtonComponent() },
    { path: "src/components/LeadForm.tsx", purpose: "Resend-ready lead form placeholder", content: buildLeadFormComponent() },
    { path: "src/components/LocalSEOSection.tsx", purpose: "Local SEO/service-area content", content: buildLocalSeoSectionComponent() },
    { path: "src/components/index.ts", purpose: "Component export barrel", content: buildComponentIndex(components) },
    ...pages.map((page) => ({
      path: routePathToFilePath(page.path),
      purpose: `Route page for ${page.title}`,
      content: buildRoutePageFile(page.path),
    })),
  ]

  return dedupeFiles(files)
}

export function buildForgeSeoModel({
  project,
  workspace,
  approvedSitemap,
  approvedCopy,
  seoContext,
}: {
  project: ForgeFrontendCodeProject
  workspace: ForgeWorkspaceMetadata
  approvedSitemap: ForgeSitemapStrategy
  approvedCopy: ForgeCopyDocument
  seoContext?: ForgeFrontendSeoContext
}): { business: ForgeSeoBusiness; pages: ForgeSeoPageInput[] } {
  const pages = buildGeneratedSitePages(project, approvedSitemap, approvedCopy)
  return {
    business: buildSeoBusiness(project, workspace, seoContext, approvedSitemap),
    pages: pages.map(toSeoPageInput),
  }
}

export function buildForgeGeneratedCodeSummary({
  workspace,
  files,
  approvedSitemap,
  approvedComponentSpec,
  approvedDesign,
  integrationPlaceholders,
  warnings,
}: {
  workspace: ForgeWorkspaceMetadata
  files: ForgeGeneratedSiteFile[]
  approvedSitemap: ForgeSitemapStrategy
  approvedComponentSpec: ForgeComponentSpecification
  approvedDesign: ForgeDesignDirection
  integrationPlaceholders: string[]
  warnings: string[]
}): ForgeGeneratedCodeSummary {
  const animation = buildForgeAnimationConfigForSite(approvedDesign.selectedAnimationPack)
  const routes = [...new Set([...approvedSitemap.sitemap.map((page) => page.path), "/style-guide"])]
  return {
    kind: FORGE_GENERATED_CODE_ARTIFACT_KIND,
    workspacePath: workspace.relativePath,
    fileCount: files.length,
    routeCount: routes.length,
    routes,
    components: approvedComponentSpec.components.map((component) => component.name),
    integrationPlaceholders,
    animationStack: [
      animation.name,
      ...animation.libraries,
      "prefers-reduced-motion support",
      animation.riveLottiePlaceholder,
      animation.threePlaceholder,
    ],
    safetyChecks: [
      "All writes use Forge workspace utilities.",
      "Paths are normalized before writing.",
      "Core ScaleSmiths app directories are blocked by workspace safety rules.",
      "Generated files are written under the project workspace only.",
    ],
    warnings,
    generatedAt: new Date().toISOString(),
  }
}

export function buildForgeGeneratedCodeArtifactContent(summary: ForgeGeneratedCodeSummary) {
  return [
    "# Generated Site Code Summary",
    "",
    `Workspace: ${summary.workspacePath}`,
    `Files generated: ${summary.fileCount}`,
    `Routes generated: ${summary.routes.join(", ")}`,
    "",
    "## Components",
    ...summary.components.map((component) => `- ${component}`),
    "",
    "## Animation stack",
    ...summary.animationStack.map((item) => `- ${item}`),
    "",
    "## Integration placeholders",
    ...(summary.integrationPlaceholders.length ? summary.integrationPlaceholders : ["No enabled integration placeholders yet."]).map((item) => `- ${item}`),
    "",
    "## Safety checks",
    ...summary.safetyChecks.map((item) => `- ${item}`),
    "",
    "## Warnings",
    ...(summary.warnings.length ? summary.warnings : ["No generator warnings."]).map((item) => `- ${item}`),
  ].join("\n").trim()
}

export function validateForgeGeneratedFileSet(files: ForgeGeneratedSiteFile[]) {
  if (files.length === 0) return { ok: false as const, error: "Generated file set is empty." }

  const hasGamingSupportRoute = files.some((file) => /^src\/app\/(support|play|community|store|vote)\/page\.tsx$/.test(file.path))
  const required = [
    "package.json",
    "src/app/layout.tsx",
    "src/app/page.tsx",
    "src/app/style-guide/page.tsx",
    ...(hasGamingSupportRoute ? [] : ["src/app/contact/page.tsx"]),
    "src/lib/animation-config.ts",
    "src/lib/site-data.ts",
    "src/lib/seo.ts",
    "src/lib/schema.ts",
    "src/app/sitemap.ts",
    "src/app/robots.ts",
    "src/lib/whatsapp-config.ts",
    "src/components/AnimationProvider.tsx",
    "src/components/PageRenderer.tsx",
    "src/components/LeadForm.tsx",
    "src/components/WhatsAppCTA.tsx",
    "src/components/StickyWhatsAppButton.tsx",
  ]
  const paths = new Set(files.map((file) => file.path))
  const missing = required.filter((path) => !paths.has(path))
  if (missing.length) return { ok: false as const, error: `Generated file set is missing: ${missing.join(", ")}.` }

  for (const file of files) {
    const allowed = assertForgeWorkspaceFileAllowed(file.path, file.content, { allowExecutableScripts: true })
    if (!allowed.ok) return { ok: false as const, error: allowed.error }
  }

  return { ok: true as const }
}

export function routePathToFilePath(routePath: string) {
  const normalized = normalizeRoutePath(routePath)
  if (normalized === "/") return "src/app/page.tsx"
  const segments = normalized.split("/").filter(Boolean).map(slugify)
  return `src/app/${segments.join("/")}/page.tsx`
}

function buildSeoBusiness(project: ForgeFrontendCodeProject, workspace: ForgeWorkspaceMetadata, seoContext?: ForgeFrontendSeoContext, sitemap?: ForgeSitemapStrategy): ForgeSeoBusiness {
  const suppressLocalEntity = sitemap?.selectedStrategyPack === "gaming_community_server"
  return {
    businessName: project.businessName || project.name,
    industry: project.industry,
    siteUrl: resolveForgeSeoSiteUrl(project.websiteUrl, workspace.slug),
    primaryLocation: suppressLocalEntity ? null : seoContext?.primaryLocation ?? null,
    serviceAreas: suppressLocalEntity ? [] : seoContext?.serviceAreas ?? [],
    telephone: seoContext?.telephone ?? null,
    email: seoContext?.email ?? null,
    sameAs: seoContext?.sameAs ?? [],
  }
}

function toSeoPageInput(page: ForgeGeneratedSitePage): ForgeSeoPageInput {
  return {
    title: page.seoTitle || page.title,
    path: page.path,
    template: page.template,
    keyword: page.keyword,
    metaDescription: page.metaDescription,
    h1: page.h1,
    heroSubheading: page.heroSubheading,
    bodyText: [page.heroSubheading, ...page.sections.map((section) => section.body), page.trustProofCopy, page.localSeoCopy, ...page.serviceDescriptions].filter(Boolean).join("\n\n"),
    faqItems: page.faqItems,
    serviceName: page.template === "service" ? page.title : null,
    trustElements: page.trustElements,
    localSeoCopy: page.localSeoCopy,
  }
}

function buildGeneratedSitePages(project: ForgeFrontendCodeProject, sitemap: ForgeSitemapStrategy, copy: ForgeCopyDocument) {
  const warnings: string[] = []
  const pages = sitemap.sitemap.map((page) => mergePage(project, page, copy.pages.find((item) => normalizeRoutePath(item.path) === normalizeRoutePath(page.path))))
  const isGaming = sitemap.selectedStrategyPack === "gaming_community_server"

  if (!isGaming) {
    ensureFoundationalPage(project, pages, "about", warnings)
    ensureFoundationalPage(project, pages, "contact", warnings)
  }

  const hasService = pages.some((page) => page.template === "service")
  if (!hasService && !isGaming) {
    pages.splice(Math.min(1, pages.length), 0, createFallbackServicePage(project))
    warnings.push("Approved sitemap did not include a service page, so Forge added /services to satisfy the generated-site foundation.")
  }

  return pages
}

function mergePage(project: ForgeFrontendCodeProject, sitemapPage: ForgeSitemapPage, copyPage: ForgePageCopy | undefined): ForgeGeneratedSitePage {
  const path = normalizeRoutePath(sitemapPage.path)
  const template = inferTemplate(path, sitemapPage.title)
  const business = project.businessName || project.name
  const communityPage = /server|discord|store|vote|login|register|game mode|community|player/i.test(`${sitemapPage.primaryCta} ${sitemapPage.conversionNotes} ${sitemapPage.schemaRecommendation}`)

  return {
    title: copyPage?.pageTitle || sitemapPage.title,
    path,
    template,
    purpose: sitemapPage.pagePurpose,
    keyword: sitemapPage.targetKeyword,
    searchIntent: sitemapPage.searchIntent,
    schema: sitemapPage.schemaRecommendation,
    conversionNotes: sitemapPage.conversionNotes,
    trustElements: sitemapPage.trustElements,
    seoTitle: copyPage?.seoTitle || `${sitemapPage.title} | ${business}`,
    metaDescription: copyPage?.metaDescription || sitemapPage.pagePurpose,
    h1: copyPage?.h1 || (path === "/" ? business : sitemapPage.title),
    heroSubheading: copyPage?.heroSubheading || sitemapPage.pagePurpose,
    primaryCta: copyPage?.primaryCta || sitemapPage.primaryCta || (communityPage ? "Join Discord" : "Request a quote"),
    secondaryCta: copyPage?.secondaryCta || (communityPage ? "View game modes" : "View services"),
    sectionHeadings: copyPage?.sectionHeadings || ["What you get", "Why it matters", "Next step"],
    sections: copyPage?.sections?.length ? copyPage.sections : [
      { heading: "What you get", body: sitemapPage.pagePurpose },
      { heading: "Why it matters", body: sitemapPage.conversionNotes },
    ],
    faqItems: copyPage?.faqItems?.length ? copyPage.faqItems : [
      { question: `Can ${business} help with this?`, answer: "Yes. Use the form to share the service, location, timing, and any useful context." },
      { question: "What happens after I enquire?", answer: "The team reviews the details and replies with the next practical step." },
    ],
    trustProofCopy: copyPage?.trustProofCopy || sitemapPage.trustElements.join(", ") || "Clear process, relevant proof, and practical next steps support this page.",
    serviceDescriptions: copyPage?.serviceDescriptions?.length ? copyPage.serviceDescriptions : [sitemapPage.pagePurpose],
    localSeoCopy: copyPage?.localSeoCopy || (communityPage
      ? `${business} supports players with ${sitemapPage.title.toLowerCase()} through clear community routes, server actions, and support information.`
      : `${business} supports customers with ${sitemapPage.title.toLowerCase()} across the relevant service area.`),
  }
}

function ensureFoundationalPage(project: ForgeFrontendCodeProject, pages: ForgeGeneratedSitePage[], type: "about" | "contact", warnings: string[]) {
  if (pages.some((page) => page.template === type)) return
  pages.push(type === "about" ? createFallbackAboutPage(project) : createFallbackContactPage(project))
  warnings.push(`Approved sitemap did not include a ${type} page, so Forge added /${type} to satisfy the generated-site foundation.`)
}

function inferTemplate(path: string, title: string): ForgeGeneratedSitePage["template"] {
  const label = `${path} ${title}`.toLowerCase()
  if (path === "/") return "home"
  if (/contact|enquiry|quote/.test(label)) return "contact"
  if (/about|team|story/.test(label)) return "about"
  if (/area|location|near/.test(label)) return "local"
  return "service"
}

function createFallbackServicePage(project: ForgeFrontendCodeProject): ForgeGeneratedSitePage {
  const business = project.businessName || project.name
  return {
    title: "Services",
    path: "/services",
    template: "service",
    purpose: `Explain the core ${project.industry ?? "service"} offer and route visitors to enquiry.`,
    keyword: `${project.industry ?? "services"} ${business}`.toLowerCase(),
    searchIntent: "Understand services before enquiry.",
    schema: "Service schema with LocalBusiness context",
    conversionNotes: "Keep service claims specific, proof-backed, and close to the lead form.",
    trustElements: ["Clear process", "Relevant proof", "Direct enquiry route"],
    seoTitle: `Services | ${business}`,
    metaDescription: `${business} service information with clear next steps and practical enquiry routes.`,
    h1: `${business} services`,
    heroSubheading: "Clear service information, practical proof, and a direct route to ask for help.",
    primaryCta: "Request a quote",
    secondaryCta: "Contact us",
    sectionHeadings: ["Services", "Proof", "Next steps"],
    sections: [
      { heading: "Services", body: "Use this page to explain the main services with enough detail for a qualified visitor to act." },
      { heading: "Next steps", body: "Invite visitors to describe what they need, where they are, and when they need help." },
    ],
    faqItems: [
      { question: "What details should I send?", answer: "Share the service you need, the location, timing, and any useful background." },
      { question: "How quickly will you reply?", answer: "Response times depend on the project, but the form is structured to help the team reply usefully." },
    ],
    trustProofCopy: "Use real reviews, process details, accreditations, or past work to support the service claims.",
    serviceDescriptions: ["Core service information should be replaced with approved detail as the project matures."],
    localSeoCopy: `${business} supports relevant customers across the service area.`,
  }
}

function createFallbackAboutPage(project: ForgeFrontendCodeProject): ForgeGeneratedSitePage {
  const business = project.businessName || project.name
  return {
    ...createFallbackServicePage(project),
    title: "About",
    path: "/about",
    template: "about",
    purpose: `Build trust in ${business} before enquiry.`,
    schema: "Organization schema",
    seoTitle: `About | ${business}`,
    h1: `About ${business}`,
    heroSubheading: project.brandNotes || "A practical, trust-building page for story, standards, process, and proof.",
  }
}

function createFallbackContactPage(project: ForgeFrontendCodeProject): ForgeGeneratedSitePage {
  const business = project.businessName || project.name
  return {
    ...createFallbackServicePage(project),
    title: "Contact",
    path: "/contact",
    template: "contact",
    purpose: `Help visitors contact ${business} with the right context.`,
    schema: "ContactPoint schema",
    seoTitle: `Contact | ${business}`,
    h1: `Contact ${business}`,
    heroSubheading: "Send the key details and the team can reply with a practical next step.",
  }
}

function buildPackageJson(slug: string, design: ForgeDesignDirection) {
  const animation = buildForgeAnimationConfigForSite(design.selectedAnimationPack)
  const dependencies: Record<string, string> = {
    "framer-motion": "^12.0.0",
    "next": "^15.5.13",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "resend": "latest",
  }
  if (animation.useLenis) dependencies.lenis = "^1.3.8"
  if (animation.useGsap) dependencies.gsap = "^3.13.0"

  return JSON.stringify({
    private: true,
    name: slug,
    version: "0.1.0",
    scripts: {
      dev: "next dev",
      build: "next build",
      start: "next start",
      typecheck: "tsc --noEmit",
    },
    dependencies,
    devDependencies: {
      "@types/node": "^22",
      "@types/react": "^18",
      "@types/react-dom": "^18",
      "autoprefixer": "^10.4.19",
      "postcss": "^8.4.38",
      "tailwindcss": "^3.4.4",
      "typescript": "^5.5.2",
    },
  }, null, 2)
}

function buildTsConfig() {
  return JSON.stringify({
    compilerOptions: {
      target: "es2017",
      lib: ["dom", "dom.iterable", "esnext"],
      allowJs: false,
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      module: "esnext",
      moduleResolution: "bundler",
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: "preserve",
      incremental: true,
      plugins: [{ name: "next" }],
      paths: { "@/*": ["./src/*"] },
    },
    include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
    exclude: ["node_modules"],
  }, null, 2)
}

function buildTailwindConfig(design: ForgeDesignDirection, designSystem: ForgeDesignSystemSpecification) {
  return [
    "import type { Config } from 'tailwindcss'",
    "",
    `// Locked Forge design tokens for ${design.selectedStylePack}; generated from the approved design-system artifact.`,
    "const config: Config = {",
    "  content: ['./src/**/*.{ts,tsx}'],",
    "  theme: {",
    "    extend: {",
    "      fontFamily: {",
    "        display: ['var(--font-display)', 'ui-sans-serif', 'system-ui', 'sans-serif'],",
    "        body: ['var(--font-body)', 'ui-sans-serif', 'system-ui', 'sans-serif'],",
    "      },",
    "      colors: {",
    "        ink: 'var(--ink)',",
    "        paper: 'var(--surface)',",
    "        panel: 'var(--surface-alt)',",
    "        muted: 'var(--muted)',",
    "        brand: 'var(--brand)',",
    "        accent: 'var(--accent)',",
    "        accent2: 'var(--accent-alt)',",
    "        cta: 'var(--cta-text)',",
    "      },",
    "      spacing: {",
    "        token1: 'var(--space-1)',",
    "        token2: 'var(--space-2)',",
    "        token3: 'var(--space-3)',",
    "        token4: 'var(--space-4)',",
    "        token5: 'var(--space-5)',",
    "      },",
    "      maxWidth: {",
    "        tokenSm: 'var(--container-sm)',",
    "        tokenMd: 'var(--container-md)',",
    "        tokenLg: 'var(--container-lg)',",
    "      },",
    "      borderRadius: {",
    "        tokenSm: 'var(--radius-sm)',",
    "        tokenMd: 'var(--radius-md)',",
    "        tokenLg: 'var(--radius-lg)',",
    "      },",
    "      boxShadow: {",
    "        tokenNone: 'var(--shadow-none)',",
    "        tokenSoft: 'var(--shadow-soft)',",
    "      },",
    "    },",
    "  },",
    "  plugins: [],",
    "}",
    "",
    "export default config",
    "",
    `// Required token ids: ${designSystem.requiredTokenIds.join(", ")}`,
    "",
  ].join("\n")
}

function buildGeneratedReadme(
  project: ForgeFrontendCodeProject,
  workspace: ForgeWorkspaceMetadata,
  design: ForgeDesignDirection,
  designSystem: ForgeDesignSystemSpecification,
  resendConfig: ForgeResendConfig,
  whatsappConfig: ForgeWhatsAppConfig,
) {
  const animation = getForgeAnimationPack(design.selectedAnimationPack)
  return [
    `# ${project.businessName || project.name}`,
    "",
    "Generated by ScaleSmiths Forge Frontend Code Generator V1.",
    "",
    `Workspace: \`${workspace.relativePath}\``,
    "",
    "This site is isolated under `generated-sites/`. Do not move generated files into the ScaleSmiths admin or public web apps without review.",
    "",
    "## Design-token handover",
    "",
    `- Design-system version: ${designSystem.version}`,
    "- CSS custom properties are emitted in `src/app/globals.css`.",
    "- Type-safe token metadata is emitted in `src/lib/design-tokens.ts`.",
    "- Tailwind aliases resolve to CSS custom properties; avoid adding arbitrary values where a token exists.",
    "- `/style-guide` is an internal generated QA route for screenshots and visual review.",
    "",
    "## Contact form handover",
    "",
    `- Resend enabled: ${resendConfig.enabled ? "yes" : "no"}`,
    `- Test mode: ${resendConfig.testMode ? "yes" : "no"}`,
    `- From email: ${resendConfig.fromEmail || "not configured"}`,
    `- To email: ${resendConfig.toEmail || "not configured"}`,
    `- Reply-to behaviour: ${resendConfig.replyToBehaviour}`,
    `- Subject prefix: ${resendConfig.subjectPrefix}`,
    "- Required production env var: `RESEND_API_KEY`",
    "- The form includes server-side validation, a honeypot field named `website`, and an in-memory rate-limit placeholder. Replace the placeholder with Redis/database-backed rate limiting before heavy traffic.",
    "- Keep `testMode` enabled until the client's verified sender/domain is ready in Resend.",
    "",
    "## WhatsApp handover",
    "",
    `- WhatsApp enabled: ${whatsappConfig.enabled ? "yes" : "no"}`,
    `- Business number: ${whatsappConfig.businessNumber || "not configured"}`,
    `- CTA label: ${whatsappConfig.ctaLabel}`,
    `- Default message: ${whatsappConfig.defaultMessage}`,
    `- Placements: ${whatsappConfig.placements.join(", ") || "none"}`,
    "- V1 uses `wa.me` click-to-chat links only and does not require WhatsApp Cloud API.",
    "- Future Cloud API credentials must be added through the deployment host or secret manager only, never committed to generated source.",
    "",
    "## Animation handover",
    "",
    `- Animation pack: ${animation.name}`,
    `- Scroll behaviour: ${animation.scrollBehaviour}`,
    `- Reduced-motion fallback: ${animation.reducedMotionFallback}`,
    "- Generated motion must stay controlled: no layout shift, no scroll-jacking, and no ambient animation loops.",
    "- `prefers-reduced-motion` is supported in CSS and component motion wrappers.",
    "- Rive/Lottie and Three.js are placeholders only until specific approved assets or 3D direction are supplied.",
    "",
    "## Local validation",
    "",
    "```bash",
    "npm install",
    "npm run typecheck",
    "npm run build",
    "```",
    "",
  ].join("\n")
}

function buildGlobalsCss(design: ForgeDesignDirection, designSystem: ForgeDesignSystemSpecification) {
  const animation = getForgeAnimationPack(design.selectedAnimationPack)
  const tokens = designSystemTokenMap(designSystem)
  return [
    "@tailwind base;",
    "@tailwind components;",
    "@tailwind utilities;",
    "",
    ":root {",
    `  --font-display: ${cssFontFamily(tokenValue(tokens, "typography.display"))};`,
    `  --typography-display: ${cssFontFamily(tokenValue(tokens, "typography.display"))};`,
    `  --font-body: ${cssFontFamily(tokenValue(tokens, "typography.body"))};`,
    `  --typography-body: ${cssFontFamily(tokenValue(tokens, "typography.body"))};`,
    `  --surface: ${tokenValue(tokens, "color.surface")};`,
    `  --color-surface: ${tokenValue(tokens, "color.surface")};`,
    `  --surface-alt: ${tokenValue(tokens, "color.surfaceAlt")};`,
    `  --color-surfaceAlt: ${tokenValue(tokens, "color.surfaceAlt")};`,
    `  --ink: ${tokenValue(tokens, "color.ink")};`,
    `  --color-ink: ${tokenValue(tokens, "color.ink")};`,
    `  --muted: ${tokenValue(tokens, "color.muted")};`,
    `  --color-muted: ${tokenValue(tokens, "color.muted")};`,
    `  --line: ${tokenValue(tokens, "color.line")};`,
    `  --color-line: ${tokenValue(tokens, "color.line")};`,
    `  --brand: ${tokenValue(tokens, "color.brand")};`,
    `  --color-brand: ${tokenValue(tokens, "color.brand")};`,
    `  --accent: ${tokenValue(tokens, "color.accent")};`,
    `  --color-accent: ${tokenValue(tokens, "color.accent")};`,
    `  --accent-alt: ${tokenValue(tokens, "color.accentAlt")};`,
    `  --color-accentAlt: ${tokenValue(tokens, "color.accentAlt")};`,
    `  --cta-text: ${tokenValue(tokens, "color.ctaText")};`,
    `  --color-ctaText: ${tokenValue(tokens, "color.ctaText")};`,
    `  --space-1: ${tokenValue(tokens, "space.1")};`,
    `  --space-2: ${tokenValue(tokens, "space.2")};`,
    `  --space-3: ${tokenValue(tokens, "space.3")};`,
    `  --space-4: ${tokenValue(tokens, "space.4")};`,
    `  --space-5: ${tokenValue(tokens, "space.5")};`,
    `  --container-sm: ${tokenValue(tokens, "container.sm")};`,
    `  --container-md: ${tokenValue(tokens, "container.md")};`,
    `  --container-lg: ${tokenValue(tokens, "container.lg")};`,
    `  --radius-sm: ${tokenValue(tokens, "radius.sm")};`,
    `  --radius-md: ${tokenValue(tokens, "radius.md")};`,
    `  --radius-lg: ${tokenValue(tokens, "radius.lg")};`,
    `  --shadow-none: ${tokenValue(tokens, "shadow.none")};`,
    `  --shadow-soft: ${tokenValue(tokens, "shadow.soft")};`,
    `  --border-default: ${tokenValue(tokens, "border.default")};`,
    `  --hero-bg: ${design.designTokens?.heroBackground ?? "linear-gradient(135deg, var(--surface), var(--surface-alt))"};`,
    "}",
    "",
    "* { box-sizing: border-box; }",
    "html { scroll-behavior: smooth; }",
    "body {",
    "  margin: 0;",
    "  background: var(--surface);",
    "  color: var(--ink);",
    "  font-family: var(--font-body), ui-sans-serif, system-ui, sans-serif;",
    "}",
    "a { color: inherit; text-decoration: none; }",
    "button, input, textarea, select { font: inherit; }",
    "h1, h2, h3, h4 { text-wrap: balance; }",
    "p, li { text-wrap: pretty; }",
    ".focus-ring:focus-visible { outline: 3px solid color-mix(in srgb, var(--accent) 55%, transparent); outline-offset: 3px; }",
    ".hero-brand-surface { background: var(--hero-bg); }",
    ".token-panel { background: var(--surface-alt); border: var(--border-default); color: var(--ink); box-shadow: var(--shadow-none); }",
    ".token-section-alt { background: color-mix(in srgb, var(--surface-alt) 88%, var(--surface) 12%); }",
    ".token-muted { color: var(--muted); }",
    ".token-divide > :not([hidden]) ~ :not([hidden]) { border-color: var(--line); }",
    ".token-glow-cta { box-shadow: 0 0 24px color-mix(in srgb, var(--brand) 28%, transparent); }",
    ".token-container { width: min(100% - calc(var(--space-4) * 2), var(--container-lg)); margin-inline: auto; }",
    ".token-container-narrow { width: min(100% - calc(var(--space-4) * 2), var(--container-sm)); margin-inline: auto; }",
    ".type-display-xl { font-family: var(--font-display), ui-sans-serif, system-ui, sans-serif; font-size: clamp(2.5rem, 6vw, 4.5rem); line-height: 0.98; }",
    ".type-display-lg { font-family: var(--font-display), ui-sans-serif, system-ui, sans-serif; font-size: clamp(2rem, 4vw, 3rem); line-height: 1.05; }",
    ".type-body-lg { font-size: clamp(1rem, 2vw, 1.125rem); line-height: 1.75; }",
    ".token-button-primary { min-height: 44px; border-radius: var(--radius-sm); background: var(--brand); color: var(--cta-text); padding: var(--space-2) var(--space-4); font-weight: 700; }",
    ".token-button-secondary { min-height: 44px; border-radius: var(--radius-sm); border: var(--border-default); color: var(--ink); padding: var(--space-2) var(--space-4); font-weight: 700; }",
    ".token-field { min-height: 44px; border-radius: var(--radius-sm); border: var(--border-default); background: var(--surface); color: var(--ink); padding: var(--space-2) var(--space-3); }",
    ".token-alert { border-radius: var(--radius-md); border: var(--border-default); background: color-mix(in srgb, var(--accent-alt) 14%, var(--surface-alt)); padding: var(--space-3); }",
    ".motion-safe-card { will-change: transform, box-shadow; transform: translateZ(0); }",
    ".motion-safe-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-soft); }",
    ".motion-safe-cta { transition: background-color 160ms ease, color 160ms ease, box-shadow 160ms ease, transform 160ms ease; }",
    ".motion-safe-cta:hover { transform: translateY(-1px); }",
    "",
    `/* Forge design pack: ${cssComment(design.selectedStylePack)}. Animation pack: ${cssComment(animation.name)}. ${cssComment(design.animationStyle)} */`,
    "@media (prefers-reduced-motion: reduce) {",
    "  *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; scroll-behavior: auto !important; transition-duration: 0.01ms !important; }",
    "  .motion-safe-card, .motion-safe-card:hover, .motion-safe-cta, .motion-safe-cta:hover { transform: none !important; }",
    "}",
    "",
  ].join("\n")
}

function buildLayoutFile(project: ForgeFrontendCodeProject, pages: ForgeGeneratedSitePage[]) {
  const title = project.businessName || project.name
  const description = pages[0]?.metaDescription || project.primaryGoal || `${title} website generated by ScaleSmiths Forge.`
  return [
    "import type { Metadata } from 'next'",
    "import './globals.css'",
    "import { AnimationProvider } from '@/components/AnimationProvider'",
    "import { Footer } from '@/components/Footer'",
    "import { Navigation } from '@/components/Navigation'",
    "import { StickyWhatsAppButton } from '@/components/StickyWhatsAppButton'",
    "import { site } from '@/lib/site-data'",
    "import { seo } from '@/lib/seo'",
    "",
    "export const metadata: Metadata = {",
    "  metadataBase: new URL(seo.siteUrl),",
    `  title: ${JSON.stringify({ default: title, template: `%s | ${title}` })},`,
    `  description: ${JSON.stringify(description)},`,
    "  alternates: { canonical: '/' },",
    `  openGraph: { type: 'website', siteName: ${JSON.stringify(title)}, title: ${JSON.stringify(title)}, description: ${JSON.stringify(description)}, locale: 'en_GB' },`,
    "  twitter: { card: 'summary_large_image', title: " + JSON.stringify(title) + ", description: " + JSON.stringify(description) + " },",
    "}",
    "",
    "export default function RootLayout({ children }: { children: React.ReactNode }) {",
    "  return (",
    "    <html lang=\"en\">",
    "      <body>",
    "        <AnimationProvider>",
    "          <Navigation site={site} />",
    "          {children}",
    "          <Footer site={site} />",
    "          <StickyWhatsAppButton />",
    "        </AnimationProvider>",
    "      </body>",
    "    </html>",
    "  )",
    "}",
    "",
  ].join("\n")
}

function buildContactRouteFile() {
  return [
    "import { Resend } from 'resend'",
    "import { NextResponse } from 'next/server'",
    "import { buildLeadEmailHtml, buildLeadEmailText } from '@/lib/email-template'",
    "import { contactFormConfig } from '@/lib/resend-config'",
    "import { checkContactRateLimit, getClientIp, parseContactPayload, validateContactPayload } from '@/lib/contact-validation'",
    "",
    "const MAX_BODY_BYTES = 16_000",
    "",
    "export async function POST(request: Request) {",
    "  const raw = await request.text()",
    "  if (raw.length > MAX_BODY_BYTES) {",
    "    return NextResponse.json({ ok: false, error: 'Request too large.' }, { status: 413 })",
    "  }",
    "",
    "  const payload = parseContactPayload(raw)",
    "  const validation = validateContactPayload(payload)",
    "  if (!validation.ok) {",
    "    return NextResponse.json({ ok: false, error: validation.error }, { status: 400 })",
    "  }",
    "",
    "  if (validation.data.website) {",
    "    return NextResponse.json({ ok: true, testMode: contactFormConfig.testMode })",
    "  }",
    "",
    "  const rateLimit = checkContactRateLimit(`${getClientIp(request)}:${validation.data.email.toLowerCase()}`)",
    "  if (!rateLimit.ok) {",
    "    return NextResponse.json({ ok: false, error: 'Please wait before sending another enquiry.' }, { status: 429 })",
    "  }",
    "",
    "  if (!contactFormConfig.enabled || contactFormConfig.testMode) {",
    "    return NextResponse.json({ ok: true, testMode: true, received: { name: validation.data.name, email: validation.data.email, intent: validation.data.intent } })",
    "  }",
    "",
    "  if (!process.env.RESEND_API_KEY) {",
    "    return NextResponse.json({ ok: false, error: 'Contact email is not configured.' }, { status: 503 })",
    "  }",
    "",
    "  const resend = new Resend(process.env.RESEND_API_KEY)",
    "  const subject = `${contactFormConfig.subjectPrefix}: ${validation.data.intent || 'Website enquiry'}`",
    "  const replyTo = contactFormConfig.replyToBehaviour === 'submitter'",
    "    ? validation.data.email",
    "    : contactFormConfig.replyToBehaviour === 'from_email'",
    "      ? contactFormConfig.fromEmail",
    "      : undefined",
    "",
    "  const result = await resend.emails.send({",
    "    from: contactFormConfig.fromEmail,",
    "    to: contactFormConfig.toEmail,",
    "    replyTo,",
    "    subject,",
    "    html: buildLeadEmailHtml(validation.data),",
    "    text: buildLeadEmailText(validation.data),",
    "  })",
    "",
    "  if (result.error) {",
    "    return NextResponse.json({ ok: false, error: 'Unable to send enquiry right now.' }, { status: 502 })",
    "  }",
    "",
    "  return NextResponse.json({ ok: true })",
    "}",
    "",
  ].join("\n")
}

function buildContactValidationFile() {
  return [
    "export interface ContactPayload {",
    "  name: string",
    "  email: string",
    "  company: string",
    "  phone: string",
    "  message: string",
    "  intent: string",
    "  website: string",
    "}",
    "",
    "const rateLimitStore = new Map<string, { count: number; resetAt: number }>()",
    "const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000",
    "const RATE_LIMIT_MAX = 3",
    "",
    "export function parseContactPayload(raw: string): ContactPayload {",
    "  const body = safeJson(raw)",
    "  return {",
    "    name: stringValue(body.name, 160),",
    "    email: stringValue(body.email, 240),",
    "    company: stringValue(body.company, 160),",
    "    phone: stringValue(body.phone, 80),",
    "    message: stringValue(body.message, 4000),",
    "    intent: stringValue(body.intent, 240),",
    "    website: stringValue(body.website, 240),",
    "  }",
    "}",
    "",
    "export function validateContactPayload(payload: ContactPayload): { ok: true; data: ContactPayload } | { ok: false; error: string } {",
    "  if (!payload.name) return { ok: false, error: 'Please enter your name.' }",
    "  if (!payload.email || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(payload.email)) return { ok: false, error: 'Please enter a valid email address.' }",
    "  if (!payload.message || payload.message.length < 10) return { ok: false, error: 'Please include a short message.' }",
    "  return { ok: true, data: payload }",
    "}",
    "",
    "export function checkContactRateLimit(key: string) {",
    "  const now = Date.now()",
    "  const current = rateLimitStore.get(key)",
    "  if (!current || current.resetAt <= now) {",
    "    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })",
    "    return { ok: true }",
    "  }",
    "  if (current.count >= RATE_LIMIT_MAX) return { ok: false }",
    "  current.count += 1",
    "  return { ok: true }",
    "}",
    "",
    "export function getClientIp(request: Request) {",
    "  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'local'",
    "}",
    "",
    "function safeJson(raw: string): Record<string, unknown> {",
    "  try {",
    "    const parsed = JSON.parse(raw)",
    "    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}",
    "  } catch {",
    "    return {}",
    "  }",
    "}",
    "",
    "function stringValue(value: unknown, maxLength: number) {",
    "  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''",
    "}",
    "",
  ].join("\n")
}

function buildEmailTemplateFile() {
  return [
    "import type { ContactPayload } from './contact-validation'",
    "",
    "export function buildLeadEmailHtml(payload: ContactPayload) {",
    "  const rows = [",
    "    ['Name', payload.name],",
    "    ['Email', payload.email],",
    "    ['Company', payload.company || 'Not provided'],",
    "    ['Phone', payload.phone || 'Not provided'],",
    "    ['Source page', payload.intent || 'Not provided'],",
    "  ]",
    "  return `",
    "    <div style=\"font-family:Arial,sans-serif;max-width:640px\">",
    "      <h1>New website enquiry</h1>",
    "      <table cellpadding=\"8\" cellspacing=\"0\" style=\"border-collapse:collapse;width:100%\">",
    "        ${rows.map(([label, value]) => `<tr><td style=\"border:1px solid #ddd;font-weight:bold\">${escapeHtml(label)}</td><td style=\"border:1px solid #ddd\">${escapeHtml(value)}</td></tr>`).join('')}",
    "      </table>",
    "      <h2>Message</h2>",
    "      <p style=\"white-space:pre-wrap\">${escapeHtml(payload.message)}</p>",
    "    </div>",
    "  `",
    "}",
    "",
    "export function buildLeadEmailText(payload: ContactPayload) {",
    "  return [",
    "    'New website enquiry',",
    "    `Name: ${payload.name}`,",
    "    `Email: ${payload.email}`,",
    "    `Company: ${payload.company || 'Not provided'}`,",
    "    `Phone: ${payload.phone || 'Not provided'}`,",
    "    `Source page: ${payload.intent || 'Not provided'}`,",
    "    '',",
    "    payload.message,",
    "  ].join('\\n')",
    "}",
    "",
    "function escapeHtml(value: string) {",
    "  return value.replace(/[&<>'\"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', \"'\": '&#39;', '\"': '&quot;' }[char] ?? char))",
    "}",
    "",
  ].join("\n")
}

function buildResendConfigFile(config: ForgeResendConfig) {
  return [
    "export const contactFormConfig = {",
    `  ${Object.entries(generatedResendConfigForSite(config)).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join(",\n  ")}`,
    "} as const",
    "",
    "// RESEND_API_KEY is intentionally read from process.env in the API route and is never generated into source.",
    "",
  ].join("\n")
}

function buildAnimationConfigFile(design: ForgeDesignDirection) {
  return [
    "export const animationConfig = {",
    `  ${Object.entries(buildForgeAnimationConfigForSite(design.selectedAnimationPack)).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join(",\n  ")}`,
    "} as const",
    "",
    "// Motion is intentionally controlled. Do not add layout-shifting transforms, scroll-jacking, or ambient loops without approval.",
    "",
  ].join("\n")
}

function buildDesignTokensFile(designSystem: ForgeDesignSystemSpecification) {
  return [
    "export const designTokens = [",
    ...designSystem.tokens.map((token) => `  ${JSON.stringify(token)},`),
    "] as const",
    "",
    "export type DesignToken = (typeof designTokens)[number]",
    "export type DesignTokenId = DesignToken['id']",
    "export type DesignTokenCategory = DesignToken['category']",
    "",
    "export const requiredDesignTokenIds = [",
    ...designSystem.requiredTokenIds.map((id) => `  ${JSON.stringify(id)},`),
    "] as const satisfies readonly DesignTokenId[]",
    "",
    "export const designSystemGuidance = {",
    `  version: ${JSON.stringify(designSystem.version)},`,
    `  brandAttributes: ${JSON.stringify(designSystem.brandAttributes)},`,
    `  visualDirection: ${JSON.stringify(designSystem.visualDirection)},`,
    `  optionalCreativeGuidance: ${JSON.stringify(designSystem.optionalCreativeGuidance)},`,
    `  prohibitedStyleValues: ${JSON.stringify(designSystem.prohibitedStyleValues)},`,
    "} as const",
    "",
    "export function getDesignToken(id: DesignTokenId) {",
    "  return designTokens.find((token) => token.id === id)!",
    "}",
    "",
    "export function tokenCssVar(id: DesignTokenId) {",
    "  return `var(--${id.replaceAll('.', '-')})`",
    "}",
    "",
  ].join("\n")
}

function buildStyleGuidePageFile() {
  return [
    "import type React from 'react'",
    "import { designSystemGuidance, designTokens, getDesignToken, requiredDesignTokenIds } from '@/lib/design-tokens'",
    "",
    "const colourTokens = designTokens.filter((token) => token.category === 'colour')",
    "const spacingTokens = designTokens.filter((token) => token.category === 'spacing')",
    "",
    "export default function StyleGuidePage() {",
    "  return (",
    "    <main className=\"token-section-alt min-h-screen\">",
    "      <section className=\"hero-brand-surface border-b border-[color:var(--line)]\">",
    "        <div className=\"token-container py-16 md:py-20\">",
    "          <p className=\"text-sm font-semibold uppercase text-brand\">Internal style guide</p>",
    "          <h1 className=\"type-display-xl mt-4 text-ink\">Generated design-token implementation</h1>",
    "          <p className=\"type-body-lg mt-5 max-w-3xl token-muted\">This internal page demonstrates the approved tokens, components, responsive rules, focus states, reduced-motion behaviour and interaction states used by generated pages.</p>",
    "        </div>",
    "      </section>",
    "",
    "      <section className=\"token-container grid gap-8 py-12\">",
    "        <StyleBlock title=\"Typography\">",
    "          <p className=\"text-sm uppercase text-brand\">Display</p>",
    "          <h2 className=\"type-display-lg text-ink\">Readable hierarchy from approved type tokens</h2>",
    "          <p className=\"type-body-lg max-w-3xl token-muted\">Body copy uses responsive but bounded rem-based sizing. Text wraps without overlapping compact panels, buttons or forms.</p>",
    "        </StyleBlock>",
    "",
    "        <StyleBlock title=\"Colour roles\">",
    "          <div className=\"grid gap-3 md:grid-cols-3\">",
    "            {colourTokens.map((token) => <div key={token.id} className=\"token-panel rounded-tokenMd p-4\"><div className=\"h-14 rounded-tokenSm border border-[color:var(--line)]\" style={{ background: `var(--${token.id.replaceAll('.', '-')})` }} /><p className=\"mt-3 text-sm font-semibold text-ink\">{token.id}</p><p className=\"text-xs token-muted\">{token.usage}</p></div>)}",
    "          </div>",
    "        </StyleBlock>",
    "",
    "        <StyleBlock title=\"Buttons and states\">",
    "          <div className=\"flex flex-wrap gap-3\">",
    "            <button className=\"focus-ring motion-safe-cta token-button-primary hover:bg-accent\">Primary action</button>",
    "            <button className=\"focus-ring motion-safe-cta token-button-secondary hover:border-brand hover:text-brand\">Secondary action</button>",
    "            <button className=\"token-button-primary opacity-60\" disabled>Disabled action</button>",
    "          </div>",
    "        </StyleBlock>",
    "",
    "        <StyleBlock title=\"Forms\">",
    "          <form className=\"grid max-w-tokenSm gap-3\">",
    "            <label className=\"grid gap-2 text-sm font-semibold text-ink\">Name<input className=\"focus-ring token-field\" placeholder=\"Jane Smith\" /></label>",
    "            <label className=\"grid gap-2 text-sm font-semibold text-ink\">Message<textarea className=\"focus-ring token-field min-h-28\" placeholder=\"What should the team know?\" /></label>",
    "            <p className=\"text-sm text-accent\">Inline success, error and helper text use approved roles and visible contrast.</p>",
    "          </form>",
    "        </StyleBlock>",
    "",
    "        <StyleBlock title=\"Cards, alerts and content sections\">",
    "          <div className=\"grid gap-4 md:grid-cols-3\">",
    "            {['Service card', 'Proof card', 'Process card'].map((item) => <article key={item} className=\"motion-safe-card token-panel rounded-tokenMd p-5 transition\"><h3 className=\"text-lg font-semibold text-ink\">{item}</h3><p className=\"mt-2 text-sm token-muted\">Cards use the approved panel, border, radius and shadow tokens.</p></article>)}",
    "          </div>",
    "          <div className=\"token-alert mt-5 text-sm text-ink\">Alert surfaces use tokenised colour mixing and border roles.</div>",
    "        </StyleBlock>",
    "",
    "        <StyleBlock title=\"Navigation, icons and motion\">",
    "          <nav className=\"token-panel flex flex-wrap items-center justify-between gap-3 rounded-tokenMd p-4\" aria-label=\"Style-guide sample\"><span className=\"font-display text-lg font-semibold text-ink\">Brand</span><div className=\"flex gap-2 text-sm token-muted\"><span>Home</span><span>Services</span><span>Contact</span></div></nav>",
    "          <div className=\"mt-4 flex flex-wrap gap-3\">",
    "            {['Icon role', 'Responsive rule', 'Motion example'].map((item) => <div key={item} className=\"motion-safe-card token-panel rounded-tokenMd px-4 py-3 text-sm text-ink transition\"><span aria-hidden=\"true\" className=\"mr-2 text-brand\">●</span>{item}</div>)}",
    "          </div>",
    "          <p className=\"mt-4 text-sm token-muted\">Reduced-motion users receive no transform movement; this route is captured by visual QA across desktop, tablet and mobile.</p>",
    "        </StyleBlock>",
    "",
    "        <StyleBlock title=\"Spacing and required tokens\">",
    "          <div className=\"grid gap-3 md:grid-cols-5\">",
    "            {spacingTokens.map((token) => <div key={token.id} className=\"token-panel rounded-tokenMd p-3\"><div className=\"rounded-tokenSm bg-brand\" style={{ height: token.value }} /><p className=\"mt-2 text-xs token-muted\">{token.id}</p></div>)}",
    "          </div>",
    "          <p className=\"mt-4 text-xs token-muted\">Required tokens: {requiredDesignTokenIds.join(', ')}</p>",
    "          <p className=\"mt-2 text-xs token-muted\">Visual direction: {designSystemGuidance.visualDirection}</p>",
    "        </StyleBlock>",
    "      </section>",
    "    </main>",
    "  )",
    "}",
    "",
    "function StyleBlock({ title, children }: { title: string; children: React.ReactNode }) {",
    "  return <section className=\"token-panel rounded-tokenLg p-5 md:p-7\"><h2 className=\"mb-5 font-display text-2xl font-semibold text-ink\">{title}</h2>{children}</section>",
    "}",
    "",
    "void getDesignToken",
    "",
  ].join("\n")
}

function buildWhatsAppConfigFile(config: ForgeWhatsAppConfig) {
  return [
    "export const whatsAppConfig = {",
    `  ${Object.entries(generatedWhatsAppConfigForSite(config)).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join(",\n  ")}`,
    "} as const",
    "",
    "// V1 uses wa.me links only. Add future Cloud API credentials through the host secret manager, never generated source.",
    "",
  ].join("\n")
}

function buildSiteDataFile(
  project: ForgeFrontendCodeProject,
  pages: ForgeGeneratedSitePage[],
  design: ForgeDesignDirection,
  spec: ForgeComponentSpecification,
  integrationPlaceholders: string[],
  resendConfig: ForgeResendConfig,
  whatsappConfig: ForgeWhatsAppConfig,
) {
  const servicePages = pages.filter((page) => page.template === "service")
  const navPages = pages.filter((page) => ["/", "/about", "/contact"].includes(page.path) || page.template === "service").slice(0, 7)
  const site = {
    businessName: project.businessName || project.name,
    projectName: project.name,
    industry: project.industry,
    currentWebsiteUrl: project.websiteUrl,
    brandNotes: project.brandNotes,
    targetAudience: project.targetAudience,
    primaryGoal: project.primaryGoal,
    design: {
      styleName: design.designStyleName,
      selectedStylePack: design.selectedStylePack,
      visualDirection: design.visualDirection,
      mood: design.mood,
      typographyDirection: design.typographyDirection,
      sectionRhythm: design.sectionRhythm,
      colourUsage: design.colourUsage,
      colourPalette: design.colourPalette,
      componentStyle: design.componentStyle,
      ctaStyle: design.ctaStyle,
      animationStyle: design.animationStyle,
      imageryIconDirection: design.imageryIconDirection,
      forbiddenDesignMismatches: design.forbiddenDesignMismatches,
      designTokens: design.designTokens ?? designTokensForPack(design.selectedStylePack),
      overAnimationWarning: design.overAnimationWarning,
    },
    spec: {
      globalLayout: spec.globalLayout,
      navbarStructure: spec.navbarStructure,
      footerStructure: spec.footerStructure,
      responsiveBehaviour: spec.responsiveBehaviour,
      codeGeneratorNotes: spec.codeGeneratorNotes,
    },
    animation: buildForgeAnimationConfigForSite(design.selectedAnimationPack),
    integrations: integrationPlaceholders,
    resend: generatedResendConfigForSite(resendConfig),
    whatsapp: generatedWhatsAppConfigForSite(whatsappConfig),
    nav: navPages.map((page) => ({ label: page.title, href: page.path })),
    services: servicePages.map((page) => ({ title: page.title, href: page.path, description: page.serviceDescriptions[0] || page.purpose })),
    pages,
  }

  return [
    "export type SitePage = {",
    "  title: string",
    "  path: string",
    "  template: 'home' | 'service' | 'about' | 'contact' | 'local'",
    "  purpose: string",
    "  keyword: string",
    "  searchIntent: string",
    "  schema: string",
    "  conversionNotes: string",
    "  trustElements: readonly string[]",
    "  seoTitle: string",
    "  metaDescription: string",
    "  h1: string",
    "  heroSubheading: string",
    "  primaryCta: string",
    "  secondaryCta: string",
    "  sectionHeadings: readonly string[]",
    "  sections: readonly { readonly heading: string; readonly body: string }[]",
    "  faqItems: readonly { readonly question: string; readonly answer: string }[]",
    "  trustProofCopy: string",
    "  serviceDescriptions: readonly string[]",
    "  localSeoCopy: string",
    "}",
    "",
    `export const site = ${JSON.stringify(site, null, 2)} as const`,
    "",
    "export const pages = site.pages as readonly SitePage[]",
    "",
    "export function getPage(path: string): SitePage {",
    "  const page = pages.find((item) => item.path === path)",
    "  if (!page) throw new Error(`Generated page not found: ${path}`)",
    "  return page",
    "}",
    "",
  ].join("\n")
}

function buildSchemaFile() {
  return [
    "import type { SitePage } from './site-data'",
    "import { getPageSeo } from './seo'",
    "",
    "// JSON-LD graphs are precomputed by the Forge SEO engine and stored in seo.ts so the",
    "// audited SEO/AEO/GEO pack and the rendered structured data stay in sync.",
    "export function buildPageSchema(page: SitePage) {",
    "  return getPageSeo(page.path).jsonLd",
    "}",
    "",
  ].join("\n")
}

function buildSeoDataFile(business: ForgeSeoBusiness, metadata: ForgeSeoPageMetadata[]) {
  const pages = metadata.map((meta) => [meta.path, {
    title: meta.title,
    description: meta.metaDescription,
    canonical: meta.canonical,
    keyword: meta.keyword,
    openGraph: meta.openGraph,
    twitter: meta.twitter,
    jsonLd: meta.jsonLd,
  }] as const)

  const seo = {
    siteUrl: business.siteUrl,
    business: {
      name: business.businessName,
      industry: business.industry,
      primaryLocation: business.primaryLocation,
      serviceAreas: business.serviceAreas,
      telephone: business.telephone,
      email: business.email,
    },
    pages: Object.fromEntries(pages),
  }

  return [
    `export const seo = ${JSON.stringify(seo, null, 2)} as const`,
    "",
    "type SeoPage = (typeof seo.pages)[keyof typeof seo.pages]",
    "",
    "export function getPageSeo(path: string): SeoPage {",
    "  const entry = (seo.pages as Record<string, SeoPage>)[path]",
    "  if (entry) return entry",
    "  const fallback = (seo.pages as Record<string, SeoPage>)['/']",
    "  return fallback",
    "}",
    "",
    "export const sitemapUrls = Object.values(seo.pages).map((page) => page.canonical)",
    "",
  ].join("\n")
}

function buildSitemapRouteFile() {
  return [
    "import type { MetadataRoute } from 'next'",
    "import { seo } from '@/lib/seo'",
    "",
    "export default function sitemap(): MetadataRoute.Sitemap {",
    "  const lastModified = new Date()",
    "  return Object.values(seo.pages).map((page, index) => ({",
    "    url: page.canonical,",
    "    lastModified,",
    "    changeFrequency: index === 0 ? 'weekly' : 'monthly',",
    "    priority: index === 0 ? 1 : 0.7,",
    "  }))",
    "}",
    "",
  ].join("\n")
}

function buildRobotsRouteFile() {
  return [
    "import type { MetadataRoute } from 'next'",
    "import { seo } from '@/lib/seo'",
    "",
    "export default function robots(): MetadataRoute.Robots {",
    "  const base = seo.siteUrl.replace(/\\/+$/, '')",
    "  return {",
    "    rules: { userAgent: '*', allow: '/' },",
    "    sitemap: `${base}/sitemap.xml`,",
    "  }",
    "}",
    "",
  ].join("\n")
}

function buildAnimationProviderComponent(design: ForgeDesignDirection) {
  const animation = buildForgeAnimationConfigForSite(design.selectedAnimationPack)
  if (animation.useLenis) {
    return [
      "'use client'",
      "",
      "import { useEffect } from 'react'",
      "import Lenis from 'lenis'",
      "import { animationConfig } from '@/lib/animation-config'",
      "",
      "export function AnimationProvider({ children }: { children: React.ReactNode }) {",
      "  useEffect(() => {",
      "    if (!animationConfig.useLenis || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return",
      "    const lenis = new Lenis({ duration: 0.85, smoothWheel: true, wheelMultiplier: 0.85 })",
      "    let frame = 0",
      "    function raf(time: number) {",
      "      lenis.raf(time)",
      "      frame = requestAnimationFrame(raf)",
      "    }",
      "    frame = requestAnimationFrame(raf)",
      "    return () => {",
      "      cancelAnimationFrame(frame)",
      "      lenis.destroy()",
      "    }",
      "  }, [])",
      "",
      "  return <>{children}</>",
      "}",
      "",
    ].join("\n")
  }

  return [
    "import { animationConfig } from '@/lib/animation-config'",
    "",
    "export function AnimationProvider({ children }: { children: React.ReactNode }) {",
    "  void animationConfig",
    "  return <>{children}</>",
    "}",
    "",
  ].join("\n")
}

function buildMotionSectionComponent() {
  return [
    "'use client'",
    "",
    "import { motion, useReducedMotion } from 'framer-motion'",
    "import { animationConfig } from '@/lib/animation-config'",
    "",
    "export function MotionSection({ children, className = '' }: { children: React.ReactNode; className?: string }) {",
    "  const reduceMotion = useReducedMotion()",
    "  const offset = animationConfig.revealOffset",
    "  const duration = animationConfig.heavy ? 0.55 : 0.38",
    "  return (",
    "    <motion.section",
    "      className={className}",
    "      initial={reduceMotion ? false : { opacity: 0, y: offset }}",
    "      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}",
    "      viewport={{ once: true, margin: '-80px' }}",
    "      transition={{ duration, ease: 'easeOut' }}",
    "    >",
    "      {children}",
    "    </motion.section>",
    "  )",
    "}",
    "",
  ].join("\n")
}

function buildJsonLdComponent() {
  return [
    "export function JsonLd({ data }: { data: unknown }) {",
    "  return <script type=\"application/ld+json\" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />",
    "}",
    "",
  ].join("\n")
}

function buildNavigationComponent() {
  return [
    "import Link from 'next/link'",
    "import type { site } from '@/lib/site-data'",
    "",
    "export function Navigation({ site: siteData }: { site: typeof site }) {",
    "  return (",
    "    <header className=\"sticky top-0 z-40 border-b border-[color:var(--line)] bg-paper/90 backdrop-blur\">",
    "      <nav className=\"mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 md:px-8\" aria-label=\"Primary\">",
    "        <Link className=\"focus-ring font-display text-lg font-semibold tracking-normal\" href=\"/\">{siteData.businessName}</Link>",
    "        <div className=\"hidden items-center gap-5 md:flex\">",
    "          {siteData.nav.map((item) => (",
    "            <Link key={item.href} className=\"focus-ring text-sm token-muted transition hover:text-brand\" href={item.href}>{item.label}</Link>",
    "          ))}",
    "        </div>",
    "        <Link className=\"focus-ring motion-safe-cta rounded-full bg-brand px-4 py-2 text-sm font-semibold text-cta transition hover:bg-accent\" href=\"/contact\">Enquire</Link>",
    "      </nav>",
    "    </header>",
    "  )",
    "}",
    "",
  ].join("\n")
}

function buildFooterComponent() {
  return [
    "import Link from 'next/link'",
    "import type { site } from '@/lib/site-data'",
    "",
    "export function Footer({ site: siteData }: { site: typeof site }) {",
    "  return (",
    "    <footer className=\"border-t border-[color:var(--line)] bg-ink text-white\">",
    "      <div className=\"mx-auto grid max-w-7xl gap-8 px-5 py-12 md:grid-cols-[1.2fr_.8fr_.8fr] md:px-8\">",
    "        <div>",
    "          <div className=\"font-display text-2xl font-semibold\">{siteData.businessName}</div>",
    "          <p className=\"mt-3 max-w-xl text-sm leading-6 text-white/70\">{siteData.primaryGoal || siteData.brandNotes || 'A focused service website built around clarity, proof, and enquiry.'}</p>",
    "        </div>",
    "        <div>",
    "          <h2 className=\"text-sm font-semibold\">Services</h2>",
    "          <div className=\"mt-3 grid gap-2 text-sm text-white/70\">",
    "            {siteData.services.slice(0, 6).map((item) => <Link key={item.href} href={item.href}>{item.title}</Link>)}",
    "          </div>",
    "        </div>",
    "        <div>",
    "          <h2 className=\"text-sm font-semibold\">Next step</h2>",
    "          <p className=\"mt-3 text-sm leading-6 text-white/70\">Use the contact form or WhatsApp to start a qualified enquiry.</p>",
    "          <Link className=\"focus-ring motion-safe-cta mt-4 inline-flex rounded-full bg-accent px-4 py-2 text-sm font-semibold text-cta\" href=\"/contact\">Contact</Link>",
    "        </div>",
    "      </div>",
    "    </footer>",
    "  )",
    "}",
    "",
  ].join("\n")
}

function buildPageRendererComponent() {
  return [
    "import type { SitePage } from '@/lib/site-data'",
    "import { site } from '@/lib/site-data'",
    "import { ContactSection } from './ContactSection'",
    "import { FAQSection } from './FAQSection'",
    "import { Hero } from './Hero'",
    "import { LeadForm } from './LeadForm'",
    "import { LocalSEOSection } from './LocalSEOSection'",
    "import { MotionSection } from './MotionSection'",
    "import { ProcessSection } from './ProcessSection'",
    "import { ReviewsSection } from './ReviewsSection'",
    "import { ServiceDetail } from './ServiceDetail'",
    "import { ServicesGrid } from './ServicesGrid'",
    "import { TrustBar } from './TrustBar'",
    "import { WhatsAppCTA } from './WhatsAppCTA'",
    "",
    "export function PageRenderer({ page }: { page: SitePage }) {",
    "  return (",
    "    <main>",
    "      <Hero page={page} />",
    "      <TrustBar items={page.trustElements} />",
    "      {page.template === 'home' && <MotionSection><ServicesGrid services={site.services} /></MotionSection>}",
    "      {(page.template === 'service' || page.template === 'about') && <MotionSection><ServiceDetail page={page} /></MotionSection>}",
    "      <MotionSection><ProcessSection page={page} /></MotionSection>",
    "      <MotionSection><ReviewsSection page={page} /></MotionSection>",
    "      <MotionSection><LocalSEOSection page={page} /></MotionSection>",
    "      <MotionSection><FAQSection items={page.faqItems} /></MotionSection>",
    "      {(page.template === 'contact' || page.template === 'home') && <MotionSection><ContactSection page={page} /></MotionSection>}",
    "      <MotionSection><LeadForm page={page} /></MotionSection>",
    "      {page.template === 'service' && <WhatsAppCTA page={page} placement=\"service_pages\" />}",
    "      {page.template === 'contact' && <WhatsAppCTA page={page} placement=\"contact_page\" />}",
    "      <WhatsAppCTA page={page} placement=\"inline\" />",
    "    </main>",
    "  )",
    "}",
    "",
  ].join("\n")
}

function buildHeroComponent() {
  return [
    "import Link from 'next/link'",
    "import type { SitePage } from '@/lib/site-data'",
    "",
    "export function Hero({ page }: { page: SitePage }) {",
    "  return (",
    "    <section className=\"hero-brand-surface relative overflow-hidden border-b border-[color:var(--line)]\">",
    "      <div className=\"mx-auto grid max-w-7xl gap-10 px-5 py-16 md:grid-cols-[1.1fr_.9fr] md:px-8 md:py-24\">",
    "        <div>",
    "          <p className=\"text-sm font-semibold uppercase text-brand\">{page.searchIntent}</p>",
    "          <h1 className=\"mt-4 max-w-4xl font-display text-4xl font-semibold leading-tight text-ink md:text-6xl\">{page.h1}</h1>",
    "          <p className=\"mt-5 max-w-2xl text-lg leading-8 token-muted\">{page.heroSubheading}</p>",
    "          <div className=\"mt-8 flex flex-wrap gap-3\">",
    "            <Link className=\"focus-ring motion-safe-cta token-glow-cta rounded-full bg-brand px-5 py-3 text-sm font-semibold text-cta transition hover:bg-accent\" href=\"/contact\">{page.primaryCta}</Link>",
    "            <Link className=\"focus-ring motion-safe-cta rounded-full border border-[color:var(--line)] px-5 py-3 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand\" href=\"#services\">{page.secondaryCta}</Link>",
    "          </div>",
    "        </div>",
    "        <div className=\"token-panel rounded-2xl border p-6 shadow-sm\">",
    "          <p className=\"text-xs font-semibold uppercase token-muted\">Page intent</p>",
    "          <p className=\"mt-3 text-xl font-semibold text-ink\">{page.purpose}</p>",
    "          <div className=\"mt-6 grid gap-3\">",
    "            {page.trustElements.slice(0, 3).map((item) => <div key={item} className=\"rounded-xl border border-[color:var(--line)] bg-paper px-4 py-3 text-sm token-muted\">{item}</div>)}",
    "          </div>",
    "        </div>",
    "      </div>",
    "    </section>",
    "  )",
    "}",
    "",
  ].join("\n")
}

function buildTrustBarComponent() {
  return [
    "export function TrustBar({ items }: { items: readonly string[] }) {",
    "  const proof = items.length ? items : ['Clear process', 'Practical advice', 'Direct enquiry route']",
    "  return (",
    "    <section className=\"token-section-alt border-b border-[color:var(--line)]\">",
    "      <div className=\"mx-auto grid max-w-7xl gap-3 px-5 py-5 md:grid-cols-3 md:px-8\">",
    "        {proof.slice(0, 3).map((item) => <div key={item} className=\"text-sm font-semibold text-ink\">{item}</div>)}",
    "      </div>",
    "    </section>",
    "  )",
    "}",
    "",
  ].join("\n")
}

function buildServicesGridComponent() {
  return [
    "import Link from 'next/link'",
    "",
    "export function ServicesGrid({ services }: { services: readonly { title: string; href: string; description: string }[] }) {",
    "  if (!services.length) return null",
    "  return (",
    "    <section id=\"services\" className=\"mx-auto max-w-7xl px-5 py-16 md:px-8\">",
    "      <div className=\"max-w-2xl\">",
    "        <p className=\"text-sm font-semibold uppercase text-brand\">Services</p>",
    "        <h2 className=\"mt-3 font-display text-3xl font-semibold text-ink\">Service routes built around buyer intent</h2>",
    "      </div>",
    "      <div className=\"mt-8 grid gap-4 md:grid-cols-3\">",
    "        {services.map((service) => (",
    "          <Link key={service.href} className=\"focus-ring motion-safe-card token-panel rounded-2xl border p-5 shadow-sm transition hover:border-brand\" href={service.href}>",
    "            <h3 className=\"text-xl font-semibold text-ink\">{service.title}</h3>",
    "            <p className=\"mt-3 text-sm leading-6 token-muted\">{service.description}</p>",
    "          </Link>",
    "        ))}",
    "      </div>",
    "    </section>",
    "  )",
    "}",
    "",
  ].join("\n")
}

function buildServiceDetailComponent() {
  return [
    "import type { SitePage } from '@/lib/site-data'",
    "",
    "export function ServiceDetail({ page }: { page: SitePage }) {",
    "  return (",
    "    <section className=\"mx-auto grid max-w-7xl gap-8 px-5 py-16 md:grid-cols-[.8fr_1.2fr] md:px-8\">",
    "      <div>",
    "        <p className=\"text-sm font-semibold uppercase text-brand\">Details</p>",
    "        <h2 className=\"mt-3 font-display text-3xl font-semibold text-ink\">{page.sectionHeadings[0] || page.title}</h2>",
    "        <p className=\"mt-4 text-sm leading-6 token-muted\">{page.conversionNotes}</p>",
    "      </div>",
    "      <div className=\"grid gap-4\">",
    "        {page.sections.map((section) => (",
    "          <article key={section.heading} className=\"token-panel rounded-2xl border p-5 shadow-sm\">",
    "            <h3 className=\"text-lg font-semibold text-ink\">{section.heading}</h3>",
    "            <p className=\"mt-3 text-sm leading-7 token-muted\">{section.body}</p>",
    "          </article>",
    "        ))}",
    "      </div>",
    "    </section>",
    "  )",
    "}",
    "",
  ].join("\n")
}

function buildProcessSectionComponent() {
  return [
    "import type { SitePage } from '@/lib/site-data'",
    "",
    "export function ProcessSection({ page }: { page: SitePage }) {",
    "  const steps = ['Share the context', 'Review the right route', 'Agree the next practical step']",
    "  return (",
    "    <section className=\"token-section-alt\">",
    "      <div className=\"mx-auto max-w-7xl px-5 py-16 md:px-8\">",
    "        <p className=\"text-sm font-semibold uppercase text-brand\">Process</p>",
    "        <h2 className=\"mt-3 font-display text-3xl font-semibold text-ink\">A clear route from interest to action</h2>",
    "        <div className=\"mt-8 grid gap-4 md:grid-cols-3\">",
    "          {steps.map((step, index) => (",
    "            <div key={step} className=\"motion-safe-card token-panel rounded-2xl border p-5 transition\">",
    "              <span className=\"text-sm font-semibold text-accent\">0{index + 1}</span>",
    "              <h3 className=\"mt-3 text-lg font-semibold text-ink\">{step}</h3>",
    "              <p className=\"mt-3 text-sm leading-6 token-muted\">{index === 0 ? page.primaryCta : index === 1 ? page.searchIntent : page.conversionNotes}</p>",
    "            </div>",
    "          ))}",
    "        </div>",
    "      </div>",
    "    </section>",
    "  )",
    "}",
    "",
  ].join("\n")
}

function buildReviewsSectionComponent() {
  return [
    "import type { SitePage } from '@/lib/site-data'",
    "",
    "export function ReviewsSection({ page }: { page: SitePage }) {",
    "  return (",
    "    <section className=\"mx-auto max-w-7xl px-5 py-16 md:px-8\">",
    "      <div className=\"rounded-3xl bg-ink p-6 text-white md:p-10\">",
    "        <p className=\"text-sm font-semibold uppercase text-accent\">Proof</p>",
    "        <h2 className=\"mt-3 font-display text-3xl font-semibold\">Trust belongs close to the claim</h2>",
    "        <p className=\"mt-5 max-w-3xl text-base leading-7 text-white/75\">{page.trustProofCopy}</p>",
    "      </div>",
    "    </section>",
    "  )",
    "}",
    "",
  ].join("\n")
}

function buildFaqSectionComponent() {
  return [
    "export function FAQSection({ items }: { items: readonly { question: string; answer: string }[] }) {",
    "  return (",
    "    <section className=\"token-section-alt\">",
    "      <div className=\"mx-auto max-w-4xl px-5 py-16 md:px-8\">",
    "        <p className=\"text-sm font-semibold uppercase text-brand\">FAQ</p>",
    "        <h2 className=\"mt-3 font-display text-3xl font-semibold text-ink\">Useful answers before enquiry</h2>",
    "        <div className=\"token-divide mt-8 divide-y rounded-2xl border border-[color:var(--line)] bg-paper\">",
    "          {items.map((item) => (",
    "            <details key={item.question} className=\"group p-5\">",
    "              <summary className=\"cursor-pointer font-semibold text-ink\">{item.question}</summary>",
    "              <p className=\"mt-3 text-sm leading-6 token-muted\">{item.answer}</p>",
    "            </details>",
    "          ))}",
    "        </div>",
    "      </div>",
    "    </section>",
    "  )",
    "}",
    "",
  ].join("\n")
}

function buildContactSectionComponent() {
  return [
    "import type { SitePage } from '@/lib/site-data'",
    "",
    "export function ContactSection({ page }: { page: SitePage }) {",
    "  return (",
    "    <section className=\"mx-auto max-w-7xl px-5 py-16 md:px-8\">",
    "      <div className=\"token-panel grid gap-6 rounded-3xl border p-6 shadow-sm md:grid-cols-[.9fr_1.1fr] md:p-10\">",
    "        <div>",
    "          <p className=\"text-sm font-semibold uppercase text-brand\">Contact</p>",
    "          <h2 className=\"mt-3 font-display text-3xl font-semibold text-ink\">Start with the details that matter</h2>",
    "        </div>",
    "        <p className=\"text-base leading-7 token-muted\">{page.heroSubheading}</p>",
    "      </div>",
    "    </section>",
    "  )",
    "}",
    "",
  ].join("\n")
}

function buildWhatsAppCtaComponent() {
  return [
    "import type { SitePage } from '@/lib/site-data'",
    "import { whatsAppConfig } from '@/lib/whatsapp-config'",
    "",
    "type WhatsAppPlacement = 'inline' | 'service_pages' | 'contact_page'",
    "",
    "export function WhatsAppCTA({ page, placement = 'inline' }: { page: SitePage; placement?: WhatsAppPlacement }) {",
    "  const href = buildWhatsAppHref(page, placement)",
    "  if (!href) return null",
    "",
    "  return (",
    "    <section className=\"mx-auto max-w-7xl px-5 pb-16 md:px-8\">",
    "      <a className=\"focus-ring motion-safe-cta inline-flex rounded-full border border-brand px-5 py-3 text-sm font-semibold text-brand transition hover:bg-brand hover:text-cta\" href={href} target=\"_blank\" rel=\"noreferrer\">{whatsAppConfig.ctaLabel}</a>",
    "    </section>",
    "  )",
    "}",
    "",
    "export function buildWhatsAppHref(page: SitePage, placement: WhatsAppPlacement = 'inline') {",
    "  if (!enabledFor(placement) || !whatsAppConfig.businessNumber) return null",
    "  const message = buildMessage(page, placement)",
    "  return `https://wa.me/${whatsAppConfig.businessNumber}?text=${encodeURIComponent(message)}`",
    "}",
    "",
    "function enabledFor(placement: WhatsAppPlacement) {",
    "  return whatsAppConfig.enabled && (whatsAppConfig.placements as readonly string[]).includes(placement)",
    "}",
    "",
    "function buildMessage(page: SitePage, placement: WhatsAppPlacement) {",
    "  if (placement === 'service_pages') return `Hi, I am interested in ${page.title}. ${whatsAppConfig.defaultMessage}`",
    "  if (placement === 'contact_page') return `Hi, I came from the contact page. ${whatsAppConfig.defaultMessage}`",
    "  return whatsAppConfig.defaultMessage",
    "}",
    "",
  ].join("\n")
}

function buildStickyWhatsAppButtonComponent() {
  return [
    "import { whatsAppConfig } from '@/lib/whatsapp-config'",
    "",
    "export function StickyWhatsAppButton() {",
    "  if (!whatsAppConfig.enabled || !whatsAppConfig.businessNumber || !(whatsAppConfig.placements as readonly string[]).includes('sticky')) return null",
    "  const href = `https://wa.me/${whatsAppConfig.businessNumber}?text=${encodeURIComponent(whatsAppConfig.defaultMessage)}`",
    "",
    "  return (",
    "    <a className=\"focus-ring motion-safe-cta token-glow-cta fixed bottom-5 right-5 z-50 inline-flex rounded-full bg-brand px-5 py-3 text-sm font-semibold text-cta shadow-lg transition hover:bg-accent\" href={href} target=\"_blank\" rel=\"noreferrer\">",
    "      {whatsAppConfig.ctaLabel}",
    "    </a>",
    "  )",
    "}",
    "",
  ].join("\n")
}

function buildLeadFormComponent() {
  return [
    "'use client'",
    "",
    "import { useState } from 'react'",
    "import type { SitePage } from '@/lib/site-data'",
    "",
    "export function LeadForm({ page }: { page: SitePage }) {",
    "  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')",
    "",
    "  async function submit(event: React.FormEvent<HTMLFormElement>) {",
    "    event.preventDefault()",
    "    setState('sending')",
    "    const form = new FormData(event.currentTarget)",
    "    const payload = {",
    "      name: String(form.get('name') || ''),",
    "      email: String(form.get('email') || ''),",
    "      company: String(form.get('company') || ''),",
    "      phone: String(form.get('phone') || ''),",
    "      message: String(form.get('message') || ''),",
    "      intent: page.path,",
    "      website: String(form.get('website') || ''),",
    "    }",
    "    const response = await fetch('/api/contact', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })",
    "    setState(response.ok ? 'sent' : 'error')",
    "  }",
    "",
    "  return (",
    "    <section id=\"contact\" className=\"bg-brand text-cta\">",
    "      <div className=\"mx-auto grid max-w-7xl gap-8 px-5 py-16 md:grid-cols-[.9fr_1.1fr] md:px-8\">",
    "        <div>",
    "          <p className=\"text-sm font-semibold uppercase text-white/70\">Enquiry</p>",
    "          <h2 className=\"mt-3 font-display text-3xl font-semibold\">{page.primaryCta}</h2>",
    "          <p className=\"mt-4 text-sm leading-6 text-white/75\">This form is wired to a protected API route and is ready for a server-side Resend integration.</p>",
    "        </div>",
    "        <form onSubmit={submit} className=\"token-panel grid gap-3 rounded-2xl border p-5 shadow-sm\">",
    "          <input className=\"hidden\" name=\"website\" tabIndex={-1} autoComplete=\"off\" aria-hidden=\"true\" />",
    "          <input className=\"focus-ring rounded-xl border border-black/10 px-4 py-3\" name=\"name\" placeholder=\"Name\" required />",
    "          <input className=\"focus-ring rounded-xl border border-black/10 px-4 py-3\" name=\"email\" type=\"email\" placeholder=\"Email\" required />",
    "          <input className=\"focus-ring rounded-xl border border-black/10 px-4 py-3\" name=\"company\" placeholder=\"Company\" />",
    "          <input className=\"focus-ring rounded-xl border border-black/10 px-4 py-3\" name=\"phone\" placeholder=\"Phone\" />",
    "          <textarea className=\"focus-ring min-h-32 rounded-xl border border-black/10 px-4 py-3\" name=\"message\" placeholder=\"What do you need help with?\" required />",
    "          <button className=\"focus-ring rounded-full bg-brand px-5 py-3 text-sm font-semibold text-cta disabled:opacity-60\" disabled={state === 'sending'}>{state === 'sending' ? 'Sending...' : page.primaryCta}</button>",
    "          {state === 'sent' && <p className=\"text-sm text-brand\">Thanks. Your enquiry was received.</p>}",
    "          {state === 'error' && <p className=\"text-sm text-red-700\">Please check the required fields and try again.</p>}",
    "        </form>",
    "      </div>",
    "    </section>",
    "  )",
    "}",
    "",
  ].join("\n")
}

function buildLocalSeoSectionComponent() {
  return [
    "import type { SitePage } from '@/lib/site-data'",
    "",
    "export function LocalSEOSection({ page }: { page: SitePage }) {",
    "  return (",
    "    <section className=\"mx-auto max-w-7xl px-5 py-16 md:px-8\">",
    "      <div className=\"grid gap-5 md:grid-cols-[.7fr_1.3fr]\">",
    "        <h2 className=\"font-display text-3xl font-semibold text-ink\">Local relevance</h2>",
    "        <p className=\"text-base leading-7 token-muted\">{page.localSeoCopy}</p>",
    "      </div>",
    "    </section>",
    "  )",
    "}",
    "",
  ].join("\n")
}

function buildComponentIndex(components: string[]) {
  const required = [
    "AnimationProvider",
    "Hero",
    "TrustBar",
    "ServicesGrid",
    "ServiceDetail",
    "ProcessSection",
    "ReviewsSection",
    "FAQSection",
    "ContactSection",
    "WhatsAppCTA",
    "StickyWhatsAppButton",
    "LeadForm",
    "LocalSEOSection",
  ]
  const exports = [...new Set([...required, ...components])]
    .filter((component) => /^[A-Z][A-Za-z0-9]+$/.test(component))
    .map((component) => `export { ${component} } from './${component}'`)
  return `${exports.join("\n")}\n`
}

function buildRoutePageFile(path: string) {
  const normalized = normalizeRoutePath(path)
  return [
    "import type { Metadata } from 'next'",
    "import { JsonLd } from '@/components/JsonLd'",
    "import { PageRenderer } from '@/components/PageRenderer'",
    "import { buildPageSchema } from '@/lib/schema'",
    "import { getPageSeo } from '@/lib/seo'",
    "import { getPage } from '@/lib/site-data'",
    "",
    `const page = getPage(${JSON.stringify(normalized)})`,
    `const pageSeo = getPageSeo(${JSON.stringify(normalized)})`,
    "",
    "export const metadata: Metadata = {",
    "  title: pageSeo.title,",
    "  description: pageSeo.description,",
    "  alternates: { canonical: pageSeo.canonical },",
    "  openGraph: { ...pageSeo.openGraph },",
    "  twitter: { card: 'summary_large_image', title: pageSeo.twitter.title, description: pageSeo.twitter.description },",
    "}",
    "",
    "export default function Page() {",
    "  return (",
    "    <>",
    "      <JsonLd data={buildPageSchema(page)} />",
    "      <PageRenderer page={page} />",
    "    </>",
    "  )",
    "}",
    "",
  ].join("\n")
}

function dedupeFiles(files: ForgeGeneratedSiteFile[]) {
  const seen = new Set<string>()
  return files.filter((file) => {
    if (seen.has(file.path)) return false
    seen.add(file.path)
    return true
  })
}

function normalizeRoutePath(input: string) {
  const trimmed = input.trim() || "/"
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`
  const clean = withSlash.replace(/\/+/g, "/").replace(/\/$/g, "")
  return clean || "/"
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "page"
}

function cssComment(value: string) {
  return value.replace(/\*\//g, "").replace(/\r?\n/g, " ")
}

function cssFontFamily(value: string) {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`
}

function designSystemTokenMap(designSystem: ForgeDesignSystemSpecification) {
  return new Map(designSystem.tokens.map((token) => [token.id, token.value] as const))
}

function tokenValue(tokens: Map<ForgeDesignTokenId, string>, id: ForgeDesignTokenId) {
  const value = tokens.get(id)
  if (!value) throw new Error(`Approved design system is missing token ${id}.`)
  return value
}
