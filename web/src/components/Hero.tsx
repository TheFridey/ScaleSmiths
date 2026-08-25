"use client"

import Link from "next/link"
import { Fragment, useLayoutEffect, useRef } from "react"
import { m, useReducedMotion } from "motion/react"
import { ArrowRight, ArrowUpRight, MapPin } from "lucide-react"
import { motionStagger, revealMask, revealSoft, staggerContainer } from "@/lib/motion"

const HERO_LINES = ["FORGE YOUR", "DIGITAL EDGE"] as const

function renderHeroLine(text: string) {
  return text.split(" ").map((word, wordIndex, words) => (
    <Fragment key={`${word}-${wordIndex}`}>
      <span className="inline-block whitespace-nowrap" aria-hidden="true">
        {word.split("").map((char, charIndex) => (
          <span key={`${char}-${charIndex}`} className="hero-char inline-block">
            {char}
          </span>
        ))}
      </span>
      {wordIndex < words.length - 1 ? " " : null}
    </Fragment>
  ))
}

export function Hero({ verifiedStats = [] }: { verifiedStats?: string[] }) {
  const heroRef = useRef<HTMLElement>(null)
  const reducedMotion = useReducedMotion()

  useLayoutEffect(() => {
    const root = heroRef.current
    if (!root) return

    const lines = Array.from(root.querySelectorAll<HTMLElement>(".hero-h"))
    const fitLines = () => {
      lines.forEach((line) => {
        const maxWidth = Math.max(260, root.clientWidth - 72)
        const scale = Math.min(1, maxWidth / line.scrollWidth)
        const mask = line.parentElement
        if (mask) {
          mask.style.transform = `scaleX(${scale})`
          mask.style.transformOrigin = "center"
        }
      })
    }
    fitLines()
    const observer = new ResizeObserver(fitLines)
    observer.observe(root)

    return () => {
      observer.disconnect()
      lines.forEach((line) => {
        const mask = line.parentElement
        mask?.style.removeProperty("transform")
        mask?.style.removeProperty("transform-origin")
      })
    }
  }, [])

  return (
    <section
      ref={heroRef}
      className="hero-grid-bg relative min-h-[91vh] flex flex-col items-center justify-center text-center overflow-hidden px-6 md:px-12 pb-16 pt-20"
      aria-label="ScaleSmiths - forge your digital edge"
    >
      <div className="hero-scene-fallback absolute inset-0" data-hero-scene="static" aria-hidden="true" />

      <m.div
        className="relative z-10 flex w-full flex-col items-center"
        variants={staggerContainer}
        initial={reducedMotion ? false : "hidden"}
        animate="visible"
        transition={{ delayChildren: 0.02, staggerChildren: motionStagger.tight }}
      >
        <m.div variants={revealSoft} className="hero-badge font-dm" role="status">
          <span className="hero-badge-dot" aria-hidden="true" />
          Find the next move. Build it properly. Keep improving.
        </m.div>

        <h1 className="mb-6 w-full">
          <span className="hero-line-overflow block">
            <m.span variants={revealMask} className="hero-h hero-outline font-syne inline-block whitespace-nowrap" aria-label={HERO_LINES[0]}>
              {renderHeroLine(HERO_LINES[0])}
            </m.span>
          </span>
          <span className="hero-line-overflow block">
            <m.span variants={revealMask} className="hero-h text-t1 font-syne inline-block whitespace-nowrap" aria-label={HERO_LINES[1]}>
              {renderHeroLine(HERO_LINES[1])}
            </m.span>
          </span>
        </h1>

        <m.p variants={revealSoft} className="font-dm font-light text-t2 w-full max-w-[620px] leading-relaxed text-[clamp(15px,1.8vw,18px)] mb-4">
          ScaleSmiths helps businesses find what is holding growth back, build the right solution,
          and keep improving it — across websites, visibility, systems, automation and ongoing digital growth.
        </m.p>

        <m.div variants={revealSoft} className="mb-5 flex max-w-[820px] flex-wrap justify-center gap-x-5 gap-y-2" aria-label="ScaleSmiths core offers">
          {["Business Growth Audits", "Websites that convert", "Custom systems", "Digital Growth Partnership"].map((offer) => (
            <span key={offer} className="border-l border-b2 pl-3 font-dm text-[11px] font-medium tracking-[.02em] text-t2">
              {offer}
            </span>
          ))}
        </m.div>

        <m.div variants={revealSoft} className="flex items-center gap-2 mb-10">
          <MapPin size={12} className="text-t3" aria-hidden="true" />
          <span className="font-dm text-xs text-t3 tracking-wider">
            Hucknall, Nottinghamshire, UK {"\u00b7"} Working nationally
          </span>
        </m.div>

        <m.div variants={revealSoft} className="flex flex-wrap gap-3 justify-center">
          <Link href="/quote" prefetch={false} className="btn-primary font-dm">
            Start a Project <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link href="/digital-growth-partnership" prefetch={false} className="btn-ghost font-dm">
            Growth Partnership <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </m.div>

        <m.div variants={revealSoft} className="flex flex-wrap gap-14 justify-center mt-20">
          {(verifiedStats.length > 0
            ? verifiedStats
            : ["Conversion websites", "E-commerce systems", "Custom web applications"]
          ).map((statement) => (
            <div key={statement} className="max-w-[220px] text-center">
              <div className="font-syne text-[19px] font-extrabold text-t1">{statement}</div>
              <div className="font-dm text-xs text-t2 mt-1 tracking-wider">
                {verifiedStats.length > 0 ? "Verified public claim" : "ScaleSmiths capability"}
              </div>
            </div>
          ))}
        </m.div>
      </m.div>
    </section>
  )
}
