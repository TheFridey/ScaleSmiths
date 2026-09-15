import { SECTION_LABELS, findShot, type ProjectMedia, type ProjectShot, type ShotSection } from "@/lib/work-media"
import { ProjectScreenshot, isDevelopment, shotSource } from "./ProjectScreenshot"

const renderable = (shot: ProjectShot | undefined): shot is ProjectShot => Boolean(shot && (shot.available || isDevelopment))

/** `availableOnly` ignores development placeholders, e.g. when deciding whether real captures can replace a cover image. */
export function hasResponsiveShots(media: ProjectMedia, { availableOnly = false } = {}) {
  return (["desktop", "tablet", "mobile"] as const).some((view) => {
    const shot = findShot(media, view, "current")
    return availableOnly ? Boolean(shot?.available) : renderable(shot)
  })
}

/** Desktop, tablet and mobile captures of the same homepage, at their true proportions. */
export function ResponsiveShowcase({ media, host }: { media: ProjectMedia; host?: string }) {
  const desktop = findShot(media, "desktop", "current")
  const tablet = findShot(media, "tablet", "current")
  const mobile = findShot(media, "mobile", "current")
  const smaller = [tablet, mobile].filter(renderable)
  if (!renderable(desktop) && smaller.length === 0) return null

  return (
    <div className="grid items-end gap-5 lg:grid-cols-[1fr_auto]">
      {renderable(desktop) ? (
        <ProjectScreenshot image={shotSource(desktop)} chrome="browser" host={host} sizes="(min-width: 1280px) 1000px, (min-width: 1024px) 75vw, 100vw" caption="Desktop" />
      ) : null}
      {smaller.length > 0 ? (
        <div className="flex items-end justify-center gap-4">
          {smaller.map((shot) => (
            <ProjectScreenshot
              key={shot.src}
              image={shotSource(shot)}
              rounded="phone"
              sizes={shot.view === "tablet" ? "260px" : "200px"}
              caption={shot.view === "tablet" ? "Tablet" : "Mobile"}
              className={shot.view === "tablet" ? "w-[min(42vw,260px)]" : "w-[min(36vw,200px)]"}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

const GALLERY_ORDER: ShotSection[] = ["service-pages", "location-pages", "inner-pages", "conversion", "integrations", "dashboard", "crm", "admin"]

function galleryGroups(media: ProjectMedia) {
  return GALLERY_ORDER
    .map((section) => ({ section, shots: media.shots.filter((shot) => shot.section === section && shot.stage === "current").filter(renderable) }))
    .filter((group) => group.shots.length > 0)
}

export function hasGalleryShots(media: ProjectMedia) {
  return galleryGroups(media).length > 0
}

/** Key pages and systems beyond the homepage, grouped by what they demonstrate. */
export function CaseStudyGallery({ media, host }: { media: ProjectMedia; host?: string }) {
  const groups = galleryGroups(media)
  if (groups.length === 0) return null

  return (
    <div className="grid gap-14">
      {groups.map((group) => (
        <div key={group.section}>
          <h3 className="border-b border-b1 pb-3 font-dm text-xs font-semibold uppercase tracking-[.14em] text-t3">{SECTION_LABELS[group.section]}</h3>
          <div className="mt-6 grid items-start gap-6 md:grid-cols-2">
            {group.shots.map((shot) => (
              <ProjectScreenshot
                key={shot.src}
                image={shotSource(shot)}
                chrome={shot.view === "desktop" && !["admin", "crm", "dashboard"].includes(shot.section) ? "browser" : "none"}
                host={host}
                rounded={shot.view === "mobile" ? "phone" : "lg"}
                sizes="(min-width: 768px) 600px, 100vw"
                caption={shot.title}
                className={shot.view === "mobile" ? "mx-auto w-full max-w-[280px]" : undefined}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
