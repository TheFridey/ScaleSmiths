import { mkdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { Client } from "pg"
import { adminDatabaseUrl } from "./database-url.mjs"

const DEMO_PROJECT_NAME = "Forge Demo - Nottingham HomeCare Repairs"
const ACTOR = process.env.ADMIN_EMAIL || "forge-demo@scalesmiths.co.uk"
const args = new Set(process.argv.slice(2))
const dryRun = args.has("--dry-run") || process.env.FORGE_DEMO_DRY_RUN === "true" || process.env.npm_config_dry_run === "true"
const reset = args.has("--reset") || process.env.FORGE_DEMO_RESET === "true" || process.env.npm_config_reset === "true"

// Development-only tool: it deletes and rewrites Forge project rows. The production admin role
// deliberately holds DELETE on only the declared lifecycle tables, so a production run would fail
// mid-transaction with an opaque permission error. Refuse explicitly instead.
if (!dryRun && process.env.NODE_ENV === "production") {
  throw new Error("Refusing to seed Forge demo data in production. This tool rewrites Forge project rows and requires privileges the least-privilege admin role does not hold.")
}

const projectTemplate = {
  name: DEMO_PROJECT_NAME,
  businessName: "Nottingham HomeCare Repairs",
  industry: "Local home repairs and property maintenance",
  websiteUrl: "https://example.com/nottingham-homecare-repairs",
  status: "ready_to_deploy",
  priority: "high",
  brandNotes: "Dependable, tidy, practical, local, and reassuring. Avoid flashy trade stereotypes.",
  targetAudience: "Busy homeowners, landlords, and small property managers across Nottinghamshire who need reliable maintenance without chasing trades.",
  primaryGoal: "Increase qualified repair and maintenance enquiries from local homeowners and landlords.",
  budgetRange: "GBP 3,500-5,500",
}

const intake = {
  businessOverview: "Nottingham HomeCare Repairs provides small repairs, planned maintenance, emergency call-outs, decorating, and landlord-ready property fixes across Nottingham and nearby towns.",
  businessLocation: "Nottingham",
  yearsTrading: "8 years",
  teamSize: "Owner-led team with a vetted network of specialist trades",
  coreServices: "Emergency home repairs\nLandlord maintenance\nDecorating and finishing\nBathroom and kitchen small works\nPre-sale property fixes",
  flagshipOffer: "48-hour repair visit for common home maintenance problems",
  pricingNotes: "Clear call-out pricing, written estimates for larger jobs, maintenance packages for landlords.",
  idealCustomers: "Homeowners, landlords, letting agents, and property managers who value tidy work, communication, and reliability.",
  customerProblems: "Unanswered calls, vague pricing, unfinished snagging work, unreliable attendance, and anxiety about letting unknown trades into the home.",
  decisionMakers: "Homeowners, landlords, letting agents, property managers",
  primaryLocation: "Nottingham",
  serviceAreas: "West Bridgford\nBeeston\nArnold\nMapperley\nCarlton\nHucknall\nLong Eaton",
  brandTone: "Plain-spoken, calm, reliable, and helpful.",
  visualStyle: "Clean Local Pro with practical premium cues, warm photography, strong proof, and clear calls to action.",
  brandLikes: "Real work photos, simple service cards, local references, tidy before/after examples.",
  brandDislikes: "Stock-photo tradespeople, neon colours, gimmicky animations, vague promises.",
  competitorUrls: "https://example.com/nottingham-handyman\nhttps://example.com/local-property-maintenance\nhttps://example.com/landlord-repairs-nottingham",
  differentiators: "Fast response windows, photo updates, landlord-friendly reporting, tidy workmanship, transparent estimates.",
  primaryWebsiteGoal: "Generate repair enquiries through form, phone, and WhatsApp.",
  secondaryGoals: "Rank for local maintenance searches\nExplain landlord maintenance packages\nBuild trust before first contact",
  conversionActions: "Request a repair quote\nSend job photos on WhatsApp\nBook a maintenance visit",
  testimonials: "Google reviews mention punctuality, tidy work, clear pricing, and quick fixes.",
  caseStudies: "Landlord refresh before new tenancy; bathroom sealant and repair bundle; pre-sale snagging list completed in one day.",
  certifications: "Public liability insured; DBS checked; waste carrier registered.",
  guarantees: "Clear arrival windows, tidy-work promise, photo update after completion.",
  requiredPages: "Home\nServices\nEmergency Repairs\nLandlord Maintenance\nDecorating and Finishing\nService Areas\nAbout\nContact",
  pageNotes: "Emergency Repairs and Landlord Maintenance should be highest priority service pages.",
  requiredIntegrations: "Resend contact form\nWhatsApp click-to-chat\nAnalytics placeholder",
  integrationNotes: "No live API keys needed for demo. Use mock/test mode and environment-level secrets only.",
  existingAssets: "Logo draft, phone number, five review snippets, before/after repair photos, insurance certificate.",
  assetAccessNotes: "Demo uses placeholders only. Real client assets should be uploaded later.",
}

const now = new Date().toISOString()
const deadline = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString()
const completenessScore = 100

const research = {
  businessSummary: "Nottingham HomeCare Repairs needs a high-trust local website that turns urgent repair searches and landlord maintenance needs into clear enquiries through proof, response expectations, and low-friction contact routes.",
  customerPersonas: [
    {
      name: "Busy homeowner with a repair list",
      description: "Needs several small jobs handled by someone reliable, tidy, and easy to contact.",
      pains: ["Unreliable attendance", "Unclear pricing", "Difficulty finding someone for smaller jobs"],
      motivations: ["Fast response", "Visible proof", "Simple next step"],
    },
    {
      name: "Landlord or letting agent",
      description: "Needs repeatable maintenance support, photo updates, and fewer tenant complaints.",
      pains: ["Slow tenant issue resolution", "Poor communication", "No documentation"],
      motivations: ["Reliable reporting", "Clear packages", "Trusted local coverage"],
    },
  ],
  localSeoOpportunities: [
    "Create service pages for emergency repairs, landlord maintenance, and decorating in Nottingham.",
    "Add area language for West Bridgford, Beeston, Arnold, Mapperley, Carlton, Hucknall, and Long Eaton.",
    "Use FAQ answers around pricing, response times, job photos, and landlord reports.",
  ],
  trustGaps: [
    "Show insurance, DBS, and review proof near calls to action.",
    "Explain the repair visit process before asking for contact details.",
    "Add photo-update and tidy-work promises to reduce buyer anxiety.",
  ],
  conversionGaps: [
    "Offer phone, form, and WhatsApp contact paths.",
    "Let users send job photos before a quote.",
    "Make emergency and landlord enquiry routes visible from the homepage.",
  ],
  competitorPositioning: [
    "Position as a reliable maintenance partner, not just a generic handyman.",
    "Lean on punctuality, photo updates, and landlord reporting as specific proof.",
    "Keep copy practical and local rather than broad or inflated.",
  ],
  recommendedPages: [
    { title: "Home", purpose: "Introduce the offer, proof, and primary enquiry paths.", priority: "primary" },
    { title: "Emergency Repairs", purpose: "Capture urgent high-intent local searches.", priority: "primary" },
    { title: "Landlord Maintenance", purpose: "Sell repeatable maintenance support to landlords and agents.", priority: "primary" },
    { title: "Services", purpose: "Route visitors into the right repair or maintenance service.", priority: "secondary" },
    { title: "Contact", purpose: "Collect job details, photos, and preferred contact routes.", priority: "primary" },
  ],
  recommendedCallsToAction: ["Request a repair quote", "Send job photos", "Book a maintenance visit"],
  recommendedProofSections: ["Review strip", "Insurance and DBS proof", "Before/after work examples", "Process timeline"],
  aeoGeoOpportunities: [
    "Answer 'how quickly can a handyman come out in Nottingham?' in direct FAQ copy.",
    "Add concise service definitions that AI answers can safely cite.",
    "Use local place names naturally in service-area sections.",
  ],
  contentOpportunities: [
    "Landlord maintenance checklist",
    "Emergency repair preparation guide",
    "Before selling your home: small fixes worth doing",
  ],
}

const sitemap = {
  strategySummary: "Build a high-trust local service site that routes urgent repair needs and landlord maintenance needs into focused service pages, then into phone, WhatsApp, or form enquiries.",
  sitemap: [
    page("Home", "/", "Explain the offer, trust proof, and main enquiry paths.", "home repairs Nottingham", "Find a reliable local repair service", "Request a repair quote", ["Reviews", "Insurance", "DBS checked"], "LocalBusiness", "Put emergency and landlord routes above the fold.", "primary"),
    page("Emergency Repairs", "/emergency-repairs", "Capture urgent repair searches and explain response expectations.", "emergency home repairs Nottingham", "Book a fast repair visit", "Send job photos", ["Response window", "Repair examples", "Reviews"], "Service", "Make WhatsApp photo submission prominent.", "primary"),
    page("Landlord Maintenance", "/landlord-maintenance", "Sell repeatable maintenance support and reporting.", "landlord maintenance Nottingham", "Find a maintenance partner", "Book a landlord call", ["Photo updates", "Package notes", "Agent-friendly reporting"], "Service", "Show process and documentation proof.", "primary"),
    page("Services", "/services", "List all maintenance and repair services with routes to detail pages.", "property maintenance services Nottingham", "Compare services", "View services", ["Service grid", "Review strip"], "ItemList", "Use simple cards and short explanations.", "secondary"),
    page("Contact", "/contact", "Collect job details, photos, and preferred contact method.", "home repair quote Nottingham", "Request contact", "Request a quote", ["Privacy note", "Response expectation"], "ContactPage", "Keep form short and add phone/WhatsApp options.", "primary"),
  ],
  conversionNotes: [
    "Keep primary CTA consistent: Request a repair quote.",
    "Use WhatsApp where users may want to send photos.",
    "Place proof immediately after claims.",
  ],
  internalLinkingPlan: [
    "Home links to Emergency Repairs and Landlord Maintenance.",
    "Services links to all service pages and Contact.",
    "Every service page links back to Contact and relevant service areas.",
  ],
  priorityBuildOrder: ["Home", "Emergency Repairs", "Landlord Maintenance", "Contact", "Services"],
}

const copy = {
  copySummary: "Plain, reassuring local-service copy focused on reliability, response expectations, landlord support, and simple enquiry routes.",
  pages: sitemap.sitemap.map((item) => ({
    pageTitle: item.title,
    path: item.path,
    seoTitle: `${item.title} | Nottingham HomeCare Repairs`,
    metaDescription: `${item.title} from Nottingham HomeCare Repairs. Reliable local repairs, maintenance support, and clear next steps for homeowners and landlords.`,
    h1: item.title === "Home" ? "Reliable home repairs and property maintenance in Nottingham" : item.title,
    heroSubheading: item.title === "Home"
      ? "Small repairs, landlord maintenance, decorating, and tidy property fixes from a local team that turns up and keeps you updated."
      : item.pagePurpose,
    primaryCta: item.primaryCta,
    secondaryCta: "Send job photos",
    sectionHeadings: ["What we handle", "Why local customers trust us", "How the visit works", "Questions people ask"],
    sections: [
      { heading: "Practical repairs without the chasing", body: "Tell us what needs fixing, share photos if useful, and we will confirm the best next step before anyone visits." },
      { heading: "Clear updates for every job", body: "Homeowners get a simple explanation of the work. Landlords and agents can request photo updates after completion." },
    ],
    faqItems: [
      { question: "Can I send photos before booking?", answer: "Yes. Photos help us understand the job and give clearer guidance before a visit." },
      { question: "Do you work with landlords?", answer: "Yes. Landlord maintenance and tenant-ready repairs are a core part of the service." },
    ],
    trustProofCopy: "Insured, DBS checked, locally reviewed, and focused on tidy workmanship.",
    serviceDescriptions: ["Emergency repairs", "Landlord maintenance", "Decorating and finishing", "Pre-sale snagging"],
    localSeoCopy: "Serving Nottingham, West Bridgford, Beeston, Arnold, Mapperley, Carlton, Hucknall, and nearby areas.",
  })),
  selfCheck: {
    status: "pass",
    flaggedPhrases: [],
    warnings: [],
    notes: ["Copy avoids banned generic AI phrases and keeps claims practical."],
  },
}

const design = {
  designStyleName: "Trusted Local Workshop",
  selectedStylePack: "Clean Local Pro",
  selectedAnimationPack: "Smooth Local Business",
  hybridWith: ["Industrial Trust"],
  stylePackRationale: "Clean Local Pro keeps the service clear and approachable while Industrial Trust cues support reliability and workmanship.",
  mood: "Calm, tidy, capable, local, and reassuring.",
  typographyDirection: "Strong readable display headings with highly legible body copy and compact service labels.",
  spacingRhythm: "Generous but efficient sections with dense proof blocks for laptop scanning.",
  colourUsage: "Warm off-white surfaces, deep graphite text, muted green trust accents, and restrained amber CTA highlights.",
  componentStyle: "Flat, crisp cards with light borders, real-photo slots, compact proof badges, and clear contact controls.",
  animationStyle: "Subtle hero entrance, section reveal, and CTA hover only.",
  imageTreatment: "Use real repair photos, tidy work details, before/after crops, and no generic stock tradespeople.",
  premiumInteractionIdeas: ["Sticky quote CTA on service pages", "WhatsApp photo prompt", "Service-area quick links"],
  motionSections: ["Hero", "ServicesGrid", "ProcessSection"],
  staticSections: ["ReviewsSection", "FAQSection", "ContactSection"],
  mobileUxNotes: ["Keep phone and WhatsApp reachable", "Avoid tall decorative headers", "Make form fields full width"],
  overAnimationWarning: "Motion should reassure and orient users; avoid scroll-jacking, looping backgrounds, or layout-shifting effects.",
}

const componentSpec = {
  specSummary: "A local-service website blueprint using reusable sections, fast contact routes, and proof-led service pages.",
  globalLayout: "Root layout with navigation, footer, sticky WhatsApp CTA, metadata, and JSON-LD.",
  navbarStructure: "Logo, Services, Emergency Repairs, Landlord Maintenance, Service Areas, Contact, primary quote CTA.",
  footerStructure: "Business summary, service links, service areas, contact routes, trust notes.",
  pageTemplates: [
    { name: "Home", appliesTo: ["/"], layoutNotes: "Hero, trust bar, service routes, process, reviews, contact.", sections: ["Hero", "TrustBar", "ServicesGrid", "ProcessSection", "ReviewsSection", "ContactSection"] },
    { name: "Service", appliesTo: ["/emergency-repairs", "/landlord-maintenance"], layoutNotes: "Service hero, proof, service detail, FAQ, contact.", sections: ["Hero", "ServiceDetail", "TrustBar", "FAQSection", "ContactSection"] },
  ],
  pages: sitemap.sitemap.map((item) => ({
    pageTitle: item.title,
    path: item.path,
    template: item.path === "/" ? "home" : item.path === "/contact" ? "contact" : "service",
    sectionOrder: ["Hero", "TrustBar", "ServicesGrid", "ProcessSection", "ReviewsSection", "FAQSection", "ContactSection"],
    metadataRequirements: [`SEO title: ${item.title}`, `Keyword: ${item.targetKeyword}`],
    schemaRequirements: [item.schemaRecommendation],
    responsiveBehaviour: ["Single-column mobile", "CTA remains visible", "Cards use stable dimensions"],
  })),
  components: ["Hero", "TrustBar", "ServicesGrid", "ServiceDetail", "ProcessSection", "ReviewsSection", "FAQSection", "ContactSection", "WhatsAppCTA", "LeadForm", "LocalSEOSection"].map((name) => ({
    name,
    purpose: `${name} supports the approved local-service conversion journey.`,
    usedOn: sitemap.sitemap.map((item) => item.path),
    props: ["copy", "cta", "trustElements"],
    dataRequirements: ["approved copy", "approved sitemap", "integration placeholders"],
    animationRequirements: ["Use Smooth Local Business reduced-motion-safe reveals only"],
    integrationPlaceholders: name === "LeadForm" ? ["Resend"] : name === "WhatsAppCTA" ? ["WhatsApp"] : [],
    responsiveBehaviour: ["No layout shift", "Readable on mobile", "Touch targets at least 44px"],
  })),
  animationRequirements: ["Smooth Local Business pack", "prefers-reduced-motion support", "No heavy 3D"],
  integrationPlaceholders: ["Resend contact route", "WhatsApp CTA"],
  schemaMetadataRequirements: ["LocalBusiness", "Service", "ContactPage", "FAQPage"],
  responsiveBehaviour: ["Laptop cockpit preview", "Tablet service cards", "Mobile-first contact"],
  codeGeneratorNotes: ["Generate only inside the Forge workspace", "Keep forms server-validated", "Do not include API keys in source"],
}

const workspaceFiles = {
  "package.json": JSON.stringify({
    private: true,
    name: "forge-demo-nottingham-homecare-repairs",
    version: "0.1.0",
    scripts: { typecheck: "tsc --noEmit", build: "next build" },
    dependencies: { next: "latest", react: "latest", "react-dom": "latest" },
    devDependencies: { typescript: "latest" },
  }, null, 2),
  "README.md": "# Nottingham HomeCare Repairs\n\nMock Forge generated site workspace. No live API keys are required.\n",
  "src/app/page.tsx": "export default function Page() { return <main><h1>Reliable home repairs in Nottingham</h1><p>Request a repair quote or send job photos.</p></main> }\n",
  "src/app/contact/page.tsx": "export default function ContactPage() { return <main><h1>Request a repair quote</h1><p>Form placeholder for the Forge demo.</p></main> }\n",
  "src/components/LeadForm.tsx": "export function LeadForm() { return <form><input name=\"name\" /><input name=\"email\" /><textarea name=\"message\" /></form> }\n",
}

function page(title, routePath, pagePurpose, targetKeyword, searchIntent, primaryCta, trustElements, schemaRecommendation, conversionNotes, priority) {
  return { title, path: routePath, pagePurpose, targetKeyword, searchIntent, primaryCta, trustElements, schemaRecommendation, conversionNotes, priority }
}

function buildFlow(projectId = 0) {
  const workspace = {
    projectId,
    slug: `${projectId || "demo"}-nottingham-homecare-repairs`,
    relativePath: `generated-sites/${projectId || "demo"}-nottingham-homecare-repairs`,
    template: "next-ts-tailwind",
    fileCount: Object.keys(workspaceFiles).length,
    createdAt: now,
    updatedAt: now,
  }
  const generatedSummary = {
    kind: "forge_generated_site_code",
    workspacePath: workspace.relativePath,
    fileCount: workspace.fileCount,
    routeCount: 2,
    routes: ["/", "/contact"],
    components: ["Hero", "LeadForm", "WhatsAppCTA", "ServicesGrid", "FAQSection"],
    integrationPlaceholders: ["Resend contact form", "WhatsApp click-to-chat"],
    animationStack: ["Smooth Local Business", "Reduced motion CSS"],
    safetyChecks: ["Workspace-only writes", "No API keys in generated source", "No public preview exposure"],
    warnings: ["Demo workspace uses compact placeholder files."],
    generatedAt: now,
  }
  const qaReport = {
    status: "passed",
    workspacePath: workspace.relativePath,
    generatedAt: now,
    completedAt: now,
    commands: [
      command("install", "npm install --no-audit --no-fund", "skipped", null, "Skipped for safe seeded demo."),
      command("typecheck", "npm run typecheck", "passed", 0, null, "Mock typecheck completed."),
      command("build", "npm run build", "passed", 0, null, "Mock build completed."),
      command("resend_form", "verify generated Resend form route", "passed", 0, null, "Resend placeholder present."),
      command("whatsapp_links", "verify generated WhatsApp wa.me links", "passed", 0, null, "WhatsApp CTA placeholder present."),
    ],
    summary: "Seeded demo QA passed in mock mode. No dependencies were installed and no live APIs were called.",
    failureSummary: null,
    repairHistory: [],
  }
  const proposalBundle = {
    kind: "forge_proposal_pack",
    businessName: projectTemplate.businessName,
    preparedFor: projectTemplate.businessName,
    preparedOn: now.slice(0, 10),
    audit: {
      summary: "The demo project shows how Forge turns structured local-service intake into a build-ready website plan.",
      currentWebsite: projectTemplate.websiteUrl,
      strengths: ["Clear local service offer", "Strong review themes", "Defined service area"],
      gaps: ["Needs proof-led service pages", "Needs low-friction contact routes"],
      seoFindings: ["Local service pages are the main opportunity", "FAQ content can support AEO/GEO visibility"],
      performanceFindings: ["Generated site should remain static-first and lightweight"],
      opportunities: ["Emergency Repairs page", "Landlord Maintenance page", "WhatsApp photo enquiry"],
      riskOfInaction: "Visitors may keep comparing generic repair providers without a reason to trust or contact the business.",
    },
    proposal: {
      businessProblem: "Local repair buyers need fast trust and a simple way to explain the job.",
      currentWebsiteGaps: ["No proof-led service journey", "No clear photo enquiry route"],
      recommendedSolution: "A fast local-service website with service pages, proof sections, Resend form, and WhatsApp CTA.",
      pagesIncluded: sitemap.sitemap.map((item) => item.title),
      integrationsIncluded: ["Resend contact form", "WhatsApp click-to-chat"],
      seoAeoGeoBenefits: research.aeoGeoOpportunities,
      buildPricePlaceholder: "GBP [CONFIRM]",
      monthlyRetainerRecommendation: "Care plan recommended for updates, QA, SEO improvements, and content iteration.",
      nextSteps: ["Review seeded demo", "Replace placeholder assets", "Run real QA when dependencies are installed"],
    },
    retainer: {
      recommendedTier: "Growth",
      monthlyRangePlaceholder: "GBP [GROWTH]/month",
      inclusions: ["Updates", "Monitoring", "SEO improvements", "Conversion copy iterations"],
      rationale: "Local service demand changes seasonally and benefits from ongoing proof and content updates.",
    },
    roadmap: {
      phases: [
        { phase: 1, title: "Intake and proof", focus: "Confirm services, trust assets, and CTAs.", outcomes: ["Approved brief"], durationEstimate: "1 week" },
        { phase: 2, title: "Build and QA", focus: "Generate, test, and refine the static site.", outcomes: ["QA-ready site"], durationEstimate: "1-2 weeks" },
      ],
      assumptions: ["Client provides real photos and verified contact details.", "Provider API keys stay in environment variables."],
    },
    handover: {
      workspacePath: workspace.relativePath,
      deliverables: ["Generated Next.js workspace", "Proposal pack", "QA report"],
      integrationsSetup: ["Set RESEND_API_KEY in deployment host", "Confirm WhatsApp number"],
      envVarsRequired: ["RESEND_API_KEY"],
      outstandingItems: ["Replace placeholders with real imagery", "Run real generated-site install/build"],
      maintenanceNotes: ["Keep dependencies patched", "Review contact form deliverability monthly"],
    },
    complianceNote: "ScaleSmiths does not guarantee rankings, leads, or revenue. The demo proves workflow structure only.",
    generatedAt: now,
  }

  return { workspace, generatedSummary, qaReport, proposalBundle }
}

function command(name, commandText, status, exitCode, skippedReason, stdout = "") {
  return {
    name,
    command: commandText,
    status,
    exitCode,
    durationMs: 0,
    stdout,
    stderr: "",
    skippedReason,
  }
}

function markdown(title, sections) {
  return [`# ${title}`, "", ...sections].join("\n").trim()
}

function intakeContent() {
  return markdown("Intake Summary", [
    "## Business basics",
    intake.businessOverview,
    "",
    "## Services",
    intake.coreServices,
    "",
    "## Target customers",
    intake.idealCustomers,
    "",
    "## Required integrations",
    intake.requiredIntegrations,
  ])
}

function artifactRows(flow, taskIds) {
  const approved = { status: "approved", approvedAt: now, approvedBy: ACTOR }
  return [
    artifact("handover_doc", "Intake Summary", intakeContent(), { kind: "forge_intake", intake, completenessScore, status: "completed" }),
    artifact("research_report", "Research Report", markdown("Research Report", [research.businessSummary]), { kind: "forge_research_report", report: research, taskId: taskIds.research, noScrapingPerformed: true, ai: { provider: "mock", model: "mock", taskType: "research" } }),
    artifact("sitemap", "Sitemap & Strategy", markdown("Sitemap & Strategy", [sitemap.strategySummary]), { kind: "forge_sitemap_strategy", strategy: sitemap, approvedStrategy: sitemap, ...approved }),
    artifact("copy_doc", "Copy Document", markdown("Copy Document", [copy.copySummary]), { kind: "forge_copy_document", copy, approvedCopy: copy, ...approved }),
    artifact("design_direction", "Design Direction", markdown("Design Direction", [design.designStyleName, design.stylePackRationale]), { kind: "forge_design_direction", direction: design, approvedDirection: design, ...approved }),
    artifact("component_spec", "Component Specification", markdown("Component Specification", [componentSpec.specSummary]), { kind: "forge_component_spec", spec: componentSpec, approvedSpec: componentSpec, ...approved }),
    artifact("generated_code", "Generated Site Code Summary", markdown("Generated Site Code Summary", [`Workspace: ${flow.workspace.relativePath}`, `Files: ${flow.generatedSummary.fileCount}`]), { kind: "forge_generated_site_code", status: "generated", summary: flow.generatedSummary, workspace: flow.workspace, taskId: taskIds.frontend }),
    artifact("qa_report", "QA Report", markdown("QA Report", [flow.qaReport.summary]), { kind: "forge_qa_report", report: flow.qaReport }),
    artifact("proposal", "Proposal & Audit Pack", markdown("Proposal & Audit Pack", [flow.proposalBundle.proposal.recommendedSolution]), { kind: "forge_proposal_pack", bundle: flow.proposalBundle }),
  ]
}

function artifact(type, title, content, metadataJson) {
  return { type, title, content, metadataJson }
}

async function main() {
  if (dryRun) {
    const flow = buildFlow()
    printDryRun(flow)
    return
  }

  const client = new Client({ connectionString: adminDatabaseUrl() })
  await client.connect()

  try {
    await client.query("begin")
    const projectId = await upsertProject(client)
    const flow = buildFlow(projectId)
    await writeWorkspace(flow.workspace)
    await seedProjectChildren(client, projectId, flow)
    await client.query("commit")

    console.log(`Forge demo project ready: ${projectTemplate.name}`)
    console.log(`Project id: ${projectId}`)
    console.log(`Admin path: /forge/${projectId}`)
    console.log(`Workspace: ${flow.workspace.relativePath}`)
    console.log("Mock mode: no live AI or Resend API calls were made.")
  } catch (error) {
    await client.query("rollback")
    throw error
  } finally {
    await client.end()
  }
}

async function upsertProject(client) {
  if (reset) {
    await client.query("delete from forge_projects where name = $1", [projectTemplate.name])
  }

  const existing = await client.query("select id from forge_projects where name = $1 order by id desc limit 1", [projectTemplate.name])
  if (existing.rowCount) {
    const projectId = existing.rows[0].id
    await client.query("delete from forge_tasks where project_id = $1", [projectId])
    await client.query("delete from forge_artifacts where project_id = $1", [projectId])
    await client.query("delete from forge_activity_logs where project_id = $1", [projectId])
    await client.query("delete from forge_memories where project_id = $1", [projectId])
    await client.query("delete from forge_integration_configs where project_id = $1", [projectId])
    await client.query(
      `update forge_projects
       set business_name = $2, industry = $3, website_url = $4, status = $5, priority = $6,
           owner_actor = $7, brand_notes = $8, target_audience = $9, primary_goal = $10,
           budget_range = $11, deadline = $12, updated_at = now()
       where id = $1`,
      [projectId, projectTemplate.businessName, projectTemplate.industry, projectTemplate.websiteUrl, projectTemplate.status, projectTemplate.priority, ACTOR, projectTemplate.brandNotes, projectTemplate.targetAudience, projectTemplate.primaryGoal, projectTemplate.budgetRange, deadline],
    )
    return projectId
  }

  const inserted = await client.query(
    `insert into forge_projects
      (name, business_name, industry, website_url, status, priority, owner_actor, brand_notes, target_audience, primary_goal, budget_range, deadline, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now(), now())
     returning id`,
    [projectTemplate.name, projectTemplate.businessName, projectTemplate.industry, projectTemplate.websiteUrl, projectTemplate.status, projectTemplate.priority, ACTOR, projectTemplate.brandNotes, projectTemplate.targetAudience, projectTemplate.primaryGoal, projectTemplate.budgetRange, deadline],
  )
  return inserted.rows[0].id
}

async function seedProjectChildren(client, projectId, flow) {
  await client.query(
    `insert into forge_memories (project_id, key, value, source, created_at, updated_at)
     values ($1, 'generated_site_workspace', $2, 'forge_demo_seed', now(), now()),
            ($1, 'project_memory', $3, 'forge_demo_seed', now(), now())`,
    [projectId, JSON.stringify(flow.workspace), "Demo proves intake to proposal flow in mock mode without live provider keys."],
  )

  await client.query(
    `insert into forge_integration_configs (project_id, provider, config_json, enabled, created_at, updated_at)
     values ($1, 'resend', $2, true, now(), now()),
            ($1, 'whatsapp', $3, true, now(), now())`,
    [
      projectId,
      { fromEmail: "Website <hello@example.com>", toEmail: "leads@example.com", replyToBehaviour: "submitter", subjectPrefix: "HomeCare enquiry", testMode: true, enabled: true },
      { businessNumber: "+447700900123", defaultMessage: "Hi, I need help with a home repair in Nottingham.", ctaLabel: "Send job photos", placements: ["sticky", "inline", "service_pages", "contact_page"], enabled: true },
    ],
  )

  const taskIds = {}
  for (const task of tasks(projectId)) {
    const result = await client.query(
      `insert into forge_tasks
        (project_id, title, description, agent_type, status, input_json, output_json, started_at, completed_at, created_at, updated_at)
       values ($1, $2, $3, $4, 'completed', $5, $6, now(), now(), now(), now())
       returning id`,
      [projectId, task.title, task.description, task.agentType, task.inputJson, task.outputJson],
    )
    taskIds[task.key] = result.rows[0].id
  }

  for (const row of artifactRows(flow, taskIds)) {
    await client.query(
      `insert into forge_artifacts (project_id, type, title, content, metadata_json, created_at, updated_at)
       values ($1, $2, $3, $4, $5, now(), now())`,
      [projectId, row.type, row.title, row.content, row.metadataJson],
    )
  }

  for (const log of activityLogs(projectId)) {
    await client.query(
      `insert into forge_activity_logs (project_id, actor, action, message, metadata_json, created_at)
       values ($1, $2, $3, $4, $5, now())`,
      [projectId, ACTOR, log.action, log.message, log.metadataJson],
    )
  }
}

function tasks(projectId) {
  const base = { projectId, mock: true, provider: "mock" }
  return [
    task("intake", "Structured intake completed", "intake", "Saved completed client website brief.", { ...base, completenessScore }),
    task("research", "Research agent completed", "research", "Generated mock research report from intake.", base),
    task("sitemap", "Sitemap and strategy approved", "sitemap", "Generated and approved local-service sitemap.", base),
    task("copy", "Copy document approved", "copy", "Generated and approved page copy.", base),
    task("design", "Design direction approved", "design", "Generated and approved premium design direction.", base),
    task("componentSpec", "Component spec approved", "strategy", "Generated and approved build blueprint.", base),
    task("frontend", "Generated demo site workspace", "frontend", "Wrote safe demo workspace files.", { ...base, workspaceFiles: Object.keys(workspaceFiles) }),
    task("qa", "Mock QA passed", "qa", "Simulated install, typecheck, build, and integration checks.", base),
    task("proposal", "Proposal generated", "strategy", "Generated proposal and audit pack.", base),
  ]
}

function task(key, title, agentType, description, inputJson) {
  return {
    key,
    title,
    agentType,
    description,
    inputJson,
    outputJson: { ok: true, mock: true, completedAt: now },
  }
}

function activityLogs(projectId) {
  return [
    ["project_created", "Created Forge demo project."],
    ["intake_completed", "Completed structured demo intake."],
    ["ai_task_started", "Started mock research, sitemap, copy, design, and component-spec tasks."],
    ["ai_task_completed", "Completed mock AI tasks without live provider keys."],
    ["generated_files_written", "Wrote generated demo workspace files."],
    ["qa_completed", "Completed mock QA checks."],
    ["proposal_generated", "Generated demo proposal pack."],
  ].map(([action, message]) => ({ action, message, metadataJson: { projectId, stage: "stage_27_demo", mock: true } }))
}

async function writeWorkspace(workspace) {
  const root = repoRoot()
  const workspaceRoot = path.resolve(root, workspace.relativePath)
  const generatedRoot = path.resolve(root, "generated-sites")
  if (!workspaceRoot.startsWith(`${generatedRoot}${path.sep}`)) {
    throw new Error("Resolved demo workspace escaped generated-sites.")
  }

  await rm(workspaceRoot, { recursive: true, force: true })
  for (const [relativePath, content] of Object.entries(workspaceFiles)) {
    const absolutePath = path.resolve(workspaceRoot, relativePath)
    if (!absolutePath.startsWith(`${workspaceRoot}${path.sep}`)) throw new Error(`Unsafe demo file path: ${relativePath}`)
    await mkdir(path.dirname(absolutePath), { recursive: true })
    await writeFile(absolutePath, content, "utf8")
  }
}

function repoRoot() {
  return path.basename(process.cwd()) === "admin" ? path.resolve(process.cwd(), "..") : process.cwd()
}

function printDryRun(flow) {
  const provider = process.env.FORGE_ENABLE_AI === "true" ? process.env.FORGE_DEFAULT_AI_PROVIDER || "mock" : "mock"
  console.log("Forge demo dry run")
  console.log(`Project: ${projectTemplate.businessName}`)
  console.log(`AI provider mode: ${provider}`)
  console.log("Stages simulated: intake, research, sitemap, copy, design, component spec, site generation, QA, proposal")
  console.log(`Workspace preview path: ${flow.workspace.relativePath}`)
  console.log("No database writes, live AI calls, Resend calls, npm installs, or generated-site builds were performed.")
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
