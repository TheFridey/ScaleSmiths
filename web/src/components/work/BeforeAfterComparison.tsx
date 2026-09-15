"use client"

import Image from "next/image"
import { useId, useState } from "react"
import { cn } from "@/lib/utils"

export interface ComparisonImage {
  src: string
  alt: string
  aspect: string
  available: boolean
}

export interface ComparisonView {
  view: "desktop" | "mobile"
  before: ComparisonImage
  after: ComparisonImage
}

interface BeforeAfterComparisonProps {
  views: ComparisonView[]
  showPlaceholders: boolean
}

function Pane({ image, label, showPlaceholders, sizes }: { image: ComparisonImage; label: "Before" | "After"; showPlaceholders: boolean; sizes: string }) {
  return (
    <figure className="min-w-0">
      <figcaption className="mb-3 flex items-center gap-2 font-dm text-xs font-semibold uppercase tracking-[.14em]">
        <span className={cn("h-1.5 w-1.5 rounded-full", label === "After" ? "bg-acc" : "bg-t3")} aria-hidden="true" />
        <span className={label === "After" ? "text-t1" : "text-t3"}>{label}</span>
      </figcaption>
      <div className="relative w-full overflow-hidden rounded-xl border border-b1 bg-s2" style={{ aspectRatio: image.aspect }}>
        {image.available ? (
          <Image src={image.src} alt={image.alt} fill sizes={sizes} quality={90} className={cn("object-cover object-top", label === "Before" && "saturate-[.85]")} />
        ) : showPlaceholders ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
            <span className="font-dm text-[11px] font-semibold uppercase tracking-[.14em] text-t3">Screenshot pending</span>
            <span className="break-all font-dm text-[11px] text-t3/80">public{image.src}</span>
          </div>
        ) : null}
      </div>
    </figure>
  )
}

/**
 * Side-by-side on large screens; one image at a time with a Before/After switch on small screens,
 * where two tall captures side by side would be unreadable. No sliders or animated reveals.
 */
export function BeforeAfterComparison({ views, showPlaceholders }: BeforeAfterComparisonProps) {
  const usable = views.filter((view) => (view.before.available && view.after.available) || showPlaceholders)
  const [activeView, setActiveView] = useState(usable[0]?.view)
  const [mobileStage, setMobileStage] = useState<"Before" | "After">("After")
  const groupId = useId()
  const current = usable.find((view) => view.view === activeView) ?? usable[0]
  if (!current) return null

  const isPhone = current.view === "mobile"
  const sizes = isPhone ? "(min-width: 1024px) 320px, 80vw" : "(min-width: 1024px) 600px, 100vw"

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {usable.length > 1 ? (
          <div role="group" aria-label="Comparison viewport" className="inline-flex rounded-lg border border-b1 bg-bg/60 p-1">
            {usable.map((view) => (
              <button
                key={view.view}
                type="button"
                aria-pressed={view.view === current.view}
                onClick={() => setActiveView(view.view)}
                className={cn("rounded-md px-3 py-1.5 font-dm text-sm capitalize transition-colors", view.view === current.view ? "bg-s2 text-t1" : "text-t3 hover:text-t1")}
              >
                {view.view}
              </button>
            ))}
          </div>
        ) : <span />}

        <div role="group" aria-label="Show before or after" aria-controls={`${groupId}-single`} className="inline-flex rounded-lg border border-b1 bg-bg/60 p-1 lg:hidden">
          {(["Before", "After"] as const).map((stage) => (
            <button
              key={stage}
              type="button"
              aria-pressed={mobileStage === stage}
              onClick={() => setMobileStage(stage)}
              className={cn("rounded-md px-3 py-1.5 font-dm text-sm transition-colors", mobileStage === stage ? "bg-s2 text-t1" : "text-t3 hover:text-t1")}
            >
              {stage}
            </button>
          ))}
        </div>
      </div>

      <div className={cn("mt-6 hidden gap-6 lg:grid lg:grid-cols-2", isPhone && "mx-auto max-w-[720px]")}>
        <Pane image={current.before} label="Before" showPlaceholders={showPlaceholders} sizes={sizes} />
        <Pane image={current.after} label="After" showPlaceholders={showPlaceholders} sizes={sizes} />
      </div>

      <div id={`${groupId}-single`} aria-live="polite" className={cn("mt-6 lg:hidden", isPhone && "mx-auto max-w-[320px]")}>
        <Pane image={mobileStage === "Before" ? current.before : current.after} label={mobileStage} showPlaceholders={showPlaceholders} sizes={sizes} />
      </div>
    </div>
  )
}
