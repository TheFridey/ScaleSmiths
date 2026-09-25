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

/**
 * First viewport budget: brand atmosphere, one headline, one supporting sentence,
 * one CTA group. Offer labels and verified stats live in the following bands.
 */
export function Hero() {
  const heroRef = useRef<HTMLElement>(null)
  const reducedMotion = useReducedMotion()

  useLayoutEffect(() => {
    const root = heroRef.current
    if (!root) return

    const lines = Array.from(root.querySelectorAll<HTMLElement>(".hero-h"))
    const fitLines = () => {
      lines.forEach((line) => {
        const mask = line.parentElement
        if (!mask) return
        // Reset before measuring so scrollWidth reflects the true unscaled line.
        mask.style.removeProperty("transform")
        const maxWidth = Math.max(240, root.clientWidth - 48)
        const scale = Math.min(1, maxWidth / Math.max(1, line.scrollWidth))
        mask.style.transform = `scale(${scale})`
        mask.style.transformOrigin = "center top"
      })
    }
    fitLines()
    const observer = new ResizeObserver(fitLines)
    observer.observe(root)
    void document.fonts?.ready?.then(fitLines)

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
      className="hero-grid-bg relative flex min-h-[min(88vh,920px)] w-full max-w-[100vw] flex-col items-center justify-center overflow-hidden px-6 pb-20 pt-16 text-center md:px-12 md:pb-24 md:pt-20"
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

        <h1 className="mb-7 w-full max-w-full overflow-hidden">
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

        <m.p variants={revealSoft} className="mb-8 w-full max-w-[620px] font-dm text-[clamp(15px,1.8vw,18px)] font-light leading-relaxed text-t2">
          ScaleSmiths helps businesses find what is holding growth back, build the right solution,
          and keep improving it — across websites, visibility, systems, automation and ongoing digital growth.
        </m.p>

        <m.div variants={revealSoft} className="mb-10 flex items-center gap-2">
          <MapPin size={12} className="text-t3" aria-hidden="true" />
          <span className="font-dm text-xs tracking-wider text-t3">
            Hucknall, Nottinghamshire, UK {"\u00b7"} Working nationally
          </span>
        </m.div>

        <m.div variants={revealSoft} className="flex flex-wrap justify-center gap-3">
          <Link href="/quote" prefetch={false} className="btn-primary font-dm">
            Start a Project <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link href="/digital-growth-partnership" prefetch={false} className="btn-ghost font-dm">
            Growth Partnership <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </m.div>
      </m.div>
    </section>
  )
}
