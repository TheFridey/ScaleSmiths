"use client"

import Link from "next/link"
import { Fragment, useLayoutEffect, useRef } from "react"
import { m, useReducedMotion } from "motion/react"
import { ArrowRight, ArrowUpRight } from "lucide-react"
import { HeroEmbers } from "@/components/HeroEmbers"
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
 * one CTA group. Embers + forge plate carry the visual; no secondary marketing clutter.
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
      className="hero-grid-bg relative flex min-h-[min(90vh,940px)] w-full max-w-[100vw] flex-col items-center justify-center overflow-hidden px-6 pb-24 pt-20 text-center md:px-12 md:pb-28 md:pt-24"
      aria-label="ScaleSmiths - forge your digital edge"
    >
      <div className="hero-scene-fallback absolute inset-0" data-hero-scene="static" aria-hidden="true" />

      {/* Forge plate — lower-weighted so molten rock feeds the ember bed */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.48] md:opacity-[0.52]"
        aria-hidden="true"
        style={{
          backgroundImage: "url(/brand/scalesmiths-forge-plate.webp)",
          backgroundSize: "cover",
          backgroundPosition: "center 42%",
          maskImage: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.35) 18%, rgba(0,0,0,0.7) 48%, rgba(0,0,0,0.95) 78%, rgba(0,0,0,0.55) 100%)",
          WebkitMaskImage: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.35) 18%, rgba(0,0,0,0.7) 48%, rgba(0,0,0,0.95) 78%, rgba(0,0,0,0.55) 100%)",
        }}
      />

      {/* Soft vignette so type stays readable over the plate */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_38%,transparent_0%,rgba(11,10,8,0.35)_55%,rgba(11,10,8,0.82)_100%)]"
        aria-hidden="true"
      />

      <HeroEmbers />

      <m.div
        className="relative z-10 flex w-full flex-col items-center"
        variants={staggerContainer}
        initial={reducedMotion ? false : "hidden"}
        animate="visible"
        transition={{ delayChildren: 0.04, staggerChildren: motionStagger.tight }}
      >
        <m.p
          variants={revealSoft}
          className="mb-8 font-syne text-[11px] font-semibold uppercase tracking-[0.28em] text-acc/90 md:mb-10 md:text-xs"
        >
          ScaleSmiths
        </m.p>

        <h1 className="mb-7 w-full max-w-full overflow-hidden md:mb-8">
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

        <m.p variants={revealSoft} className="mb-10 w-full max-w-[560px] font-dm text-[clamp(15px,1.7vw,18px)] font-light leading-relaxed text-t2 md:mb-12">
          Find what is holding growth back, build the right solution, and keep improving it —
          websites, systems, automation and ongoing digital growth.
        </m.p>

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
