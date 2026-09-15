import Image from "next/image"
import { cn } from "@/lib/utils"
import { teamImages, type TeamImageKey } from "@/lib/team-images"

interface FounderPortraitProps {
  image: TeamImageKey
  /** Shown in the placeholder while the real photograph is outstanding. */
  monogram: string
  accent: string
  sizes: string
  priority?: boolean
  className?: string
}

const isDevelopment = process.env.NODE_ENV !== "production"

/**
 * Real founder photography when supplied; otherwise a restrained monogram panel that holds
 * the same aspect ratio, so adding the photo later causes no layout shift. The placeholder
 * is decorative and never presented as a photograph.
 */
export function FounderPortrait({ image, monogram, accent, sizes, priority = false, className }: FounderPortraitProps) {
  const asset = teamImages[image]

  return (
    <div
      className={cn("relative w-full overflow-hidden rounded-2xl border border-b1 bg-s2", className)}
      style={{ aspectRatio: asset.aspect }}
    >
      {asset.available ? (
        <Image src={asset.src} alt={asset.alt} fill sizes={sizes} priority={priority} className="object-cover" />
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center"
          style={{
            backgroundImage: `radial-gradient(circle at 30% 20%, ${accent}2e, transparent 58%), linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px), linear-gradient(160deg, rgba(255,255,255,.05), rgba(0,0,0,.35))`,
            backgroundSize: "auto, 32px 32px, 32px 32px, auto",
          }}
        >
          <span className="font-syne text-[clamp(44px,9vw,96px)] font-black leading-none tracking-[-.05em]" style={{ color: accent, opacity: 0.85 }}>
            {monogram}
          </span>
          {isDevelopment ? (
            <span className="absolute inset-x-3 bottom-3 rounded-md border border-dashed border-b2 bg-bg/80 px-3 py-2 text-center font-dm text-[11px] text-t3 break-all">
              Photo pending: public{asset.src}
            </span>
          ) : null}
        </div>
      )}
    </div>
  )
}
