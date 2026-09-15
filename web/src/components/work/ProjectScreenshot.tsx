import Image from "next/image"
import { cn } from "@/lib/utils"
import { SHOT_ASPECT, type ProjectShot } from "@/lib/work-media"

export const isDevelopment = process.env.NODE_ENV !== "production"

export interface ScreenshotSource {
  src: string
  alt: string
  aspect: string
  available?: boolean
  blurDataURL?: string
}

interface ProjectScreenshotProps {
  image: ScreenshotSource
  /** Slim browser bar showing the site host. Use sparingly: the work should stay the focus. */
  chrome?: "browser" | "none"
  host?: string
  rounded?: "lg" | "phone"
  sizes: string
  priority?: boolean
  caption?: string
  className?: string
}

export function shotSource(shot: ProjectShot): ScreenshotSource {
  return { src: shot.src, alt: shot.alt, aspect: SHOT_ASPECT[shot.view], available: shot.available }
}

export function hostFromUrl(url?: string) {
  if (!url) return undefined
  try {
    return new URL(url).host.replace(/^www\./, "")
  } catch {
    return undefined
  }
}

/**
 * A real capture of delivered work at a fixed aspect ratio (no layout shift), cropped from the
 * top so the most important part of a page stays visible. Missing captures render a labelled
 * placeholder in development and nothing at all in production.
 */
export function ProjectScreenshot({ image, chrome = "none", host, rounded = "lg", sizes, priority = false, caption, className }: ProjectScreenshotProps) {
  const available = image.available !== false
  if (!available && !isDevelopment) return null

  const radius = rounded === "phone" ? "rounded-[1.6rem]" : "rounded-xl"

  return (
    <figure className={cn("min-w-0", className)}>
      <div className={cn("overflow-hidden border border-b1 bg-s2 shadow-[0_24px_60px_-30px_rgba(0,0,0,.8)]", radius, rounded === "phone" && "border-b2 p-1.5")}>
        {chrome === "browser" ? (
          <div className="flex h-8 items-center gap-3 border-b border-b1 bg-bg/80 px-3" aria-hidden="true">
            <span className="flex gap-1.5">
              <span className="h-2 w-2 rounded-full bg-white/15" />
              <span className="h-2 w-2 rounded-full bg-white/15" />
              <span className="h-2 w-2 rounded-full bg-white/15" />
            </span>
            {host ? <span className="truncate rounded bg-white/[.04] px-2 py-0.5 font-dm text-[11px] text-t3">{host}</span> : null}
          </div>
        ) : null}
        <div className={cn("relative w-full overflow-hidden", rounded === "phone" && "rounded-[1.25rem]")} style={{ aspectRatio: image.aspect }}>
          {available ? (
            <Image
              src={image.src}
              alt={image.alt}
              fill
              sizes={sizes}
              priority={priority}
              quality={90}
              placeholder={image.blurDataURL ? "blur" : "empty"}
              blurDataURL={image.blurDataURL}
              className="object-cover object-top"
            />
          ) : (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center"
              style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px)", backgroundSize: "28px 28px" }}
            >
              <span className="font-dm text-[11px] font-semibold uppercase tracking-[.14em] text-t3">Screenshot pending</span>
              <span className="break-all font-dm text-[11px] text-t3/80">public{image.src}</span>
            </div>
          )}
        </div>
      </div>
      {caption ? <figcaption className="mt-3 font-dm text-xs text-t3">{caption}</figcaption> : null}
    </figure>
  )
}
