import { availableWorkMedia } from "./work-media-manifest"

/**
 * Case-study imagery. Every image here is a real capture of delivered work — never a mock-up,
 * generated interface or approximation.
 *
 * Naming convention (all WebP, under /images/work/<folder>/):
 *   Current site pages   {view}-{page}.webp          desktop-home.webp, mobile-contact.webp
 *   Starting point       before-{view}-{page}.webp   before-desktop-home.webp
 *   Systems & dashboards {system}-{screen}.webp      crm-dashboard.webp, admin-quotes.webp
 *
 * Capture sizes (the layout reserves these aspect ratios, and crops from the top):
 *   desktop 2880x1800 (1440x900 @2x, 16:10) · tablet 1536x2048 (3:4) · mobile 780x1688 (390x844 @2x)
 *
 * A planned shot renders only once its file exists and `npm run work-media:sync` has been run.
 */

export type ShotView = "desktop" | "tablet" | "mobile"
export type ShotStage = "current" | "before"
export type ShotSection =
  | "homepage"
  | "service-pages"
  | "location-pages"
  | "inner-pages"
  | "conversion"
  | "admin"
  | "crm"
  | "dashboard"
  | "integrations"

export interface ProjectShot {
  src: string
  view: ShotView
  stage: ShotStage
  section: ShotSection
  /** Short caption, e.g. "Service page". */
  title: string
  alt: string
  available: boolean
}

export interface ProjectVideo {
  src: string
  poster: string
  title: string
}

export interface ProjectMedia {
  folder: string
  shots: ProjectShot[]
  video?: ProjectVideo
}

export const SHOT_ASPECT: Record<ShotView, string> = {
  desktop: "16 / 10",
  tablet: "3 / 4",
  mobile: "390 / 844",
}

export const SECTION_LABELS: Record<ShotSection, string> = {
  homepage: "Homepage",
  "service-pages": "Service pages",
  "location-pages": "Location pages",
  "inner-pages": "Key pages",
  conversion: "Contact & conversion routes",
  admin: "Admin & content management",
  crm: "CRM & lead management",
  dashboard: "Product interface",
  integrations: "Integrations",
}

const available = new Set(availableWorkMedia)

interface ShotPlan {
  file: string
  view: ShotView
  section: ShotSection
  title: string
  /** What the capture shows, without the business name (it is prefixed automatically). */
  describes: string
}

function plan(folder: string, name: string, shots: ShotPlan[]): ProjectMedia {
  return {
    folder,
    shots: shots.map((shot) => {
      const src = `/images/work/${folder}/${shot.file}.webp`
      const stage: ShotStage = shot.file.startsWith("before-") ? "before" : "current"
      return {
        src,
        view: shot.view,
        stage,
        section: shot.section,
        title: shot.title,
        alt: stage === "before"
          ? `${name} ${shot.describes} before the ScaleSmiths rebuild`
          : `${name} ${shot.describes} built by ScaleSmiths`,
        available: available.has(src),
      }
    }),
  }
}

const home = (view: ShotView, describes = `website homepage on ${view}`): ShotPlan => ({ file: `${view}-home`, view, section: "homepage", title: `Homepage · ${view}`, describes })
const before = (view: ShotView): ShotPlan => ({ file: `before-${view}-home`, view, section: "homepage", title: `Previous homepage · ${view}`, describes: `previous website homepage on ${view}` })

/**
 * Planned captures per project. Each entry reflects scope already documented in the case study
 * (see `data.ts` features and solution); nothing here asserts functionality on its own.
 */
export const projectMediaPlans: Record<string, ProjectMedia> = {
  "confirm-a-kill": plan("confirm-a-kill", "Confirm-A-Kill", [
    home("desktop"), home("tablet"), home("mobile"),
    { file: "desktop-service", view: "desktop", section: "service-pages", title: "Service page", describes: "service page" },
    { file: "desktop-location", view: "desktop", section: "location-pages", title: "Location page", describes: "location page" },
    { file: "mobile-contact", view: "mobile", section: "conversion", title: "Contact route · mobile", describes: "mobile contact page" },
    before("desktop"), before("mobile"),
    { file: "crm-dashboard", view: "desktop", section: "crm", title: "CRM dashboard", describes: "CRM dashboard" },
  ]),
  "precision-finish-plastering-rendering": plan("precision-finish", "Precision Finish Plastering & Rendering", [
    home("desktop"), home("mobile"),
    { file: "desktop-service", view: "desktop", section: "service-pages", title: "Service page · Rendering", describes: "rendering service page" },
    { file: "desktop-service-areas", view: "desktop", section: "location-pages", title: "Location page · Nottingham", describes: "Nottingham location page" },
    { file: "desktop-gallery", view: "desktop", section: "inner-pages", title: "Work gallery", describes: "filterable work gallery" },
    { file: "mobile-quote", view: "mobile", section: "conversion", title: "Quote request · mobile", describes: "photo-led quote request on mobile" },
  ]),
  "glow-tanning": plan("glow-tanning", "Glow Tanning", [
    home("desktop"), home("mobile"),
    { file: "desktop-booking", view: "desktop", section: "integrations", title: "Booking integration", describes: "online booking section" },
    { file: "desktop-reviews", view: "desktop", section: "integrations", title: "Review display", describes: "aggregated reviews section" },
    { file: "admin-dashboard", view: "desktop", section: "admin", title: "Admin panel", describes: "content admin panel" },
  ]),
  "pinkys-prints": plan("pinkys-prints", "Pinkys Prints", [
    home("desktop"), home("mobile"),
    { file: "desktop-product", view: "desktop", section: "inner-pages", title: "Product page", describes: "product page with variants" },
    { file: "admin-products", view: "desktop", section: "admin", title: "Product admin", describes: "product management admin" },
    before("desktop"),
  ]),
  csds: plan("csds", "CSDS", [
    home("desktop"), home("mobile"),
    { file: "desktop-quote", view: "desktop", section: "conversion", title: "Multi-step quote form", describes: "multi-step quote request form" },
    { file: "admin-quotes", view: "desktop", section: "admin", title: "Quote management", describes: "quote management admin panel" },
  ]),
  "the-business-circle": plan("the-business-circle", "The Business Circle", [
    home("desktop"), home("mobile"),
    { file: "desktop-membership", view: "desktop", section: "inner-pages", title: "Membership tiers", describes: "membership page" },
    { file: "dashboard-member", view: "desktop", section: "dashboard", title: "Member dashboard", describes: "member dashboard" },
    { file: "dashboard-video-room", view: "desktop", section: "integrations", title: "Video room", describes: "integrated video room" },
    { file: "admin-members", view: "desktop", section: "admin", title: "Member management", describes: "member management admin" },
  ]),
  prymal: plan("prymal", "Prymal", [
    home("desktop"), home("mobile"),
    { file: "desktop-pricing", view: "desktop", section: "inner-pages", title: "Plans & pricing", describes: "plans and pricing page" },
    { file: "dashboard-workspace", view: "desktop", section: "dashboard", title: "Agent workspace", describes: "multi-agent workspace" },
    { file: "dashboard-workflows", view: "desktop", section: "dashboard", title: "Workflow orchestration", describes: "workflow orchestration interface" },
    { file: "admin-usage", view: "desktop", section: "admin", title: "Billing & usage controls", describes: "billing and usage controls" },
  ]),
  veteranfinder: plan("veteranfinder", "VeteranFinder", [
    home("desktop"), home("mobile"),
    { file: "dashboard-member", view: "desktop", section: "dashboard", title: "Member experience", describes: "member area" },
    { file: "admin-console", view: "desktop", section: "admin", title: "Admin console", describes: "admin console" },
  ]),
}

export function mediaForProject(slug: string): ProjectMedia {
  return projectMediaPlans[slug] ?? { folder: slug, shots: [] }
}

export function findShot(media: ProjectMedia, view: ShotView, stage: ShotStage, section: ShotSection = "homepage") {
  return media.shots.find((shot) => shot.view === view && shot.stage === stage && shot.section === section)
}
