"use client"

import Link from "next/link"
import dynamic from "next/dynamic"
import { Fragment, useLayoutEffect, useRef } from "react"
import gsap from "gsap"
import { ArrowRight, ArrowUpRight, MapPin } from "lucide-react"
import { DiscoveryCallLink } from "./DiscoveryCallLink"

const HERO_LINES = ["FORGE YOUR", "DIGITAL EDGE"] as const

const ForgeHeroScene = dynamic(
  () => import("./ForgeHeroScene").then((module) => module.ForgeHeroScene),
  { ssr: false },
)

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

  useLayoutEffect(() => {
    const root = heroRef.current
    if (!root) return

    const lines = Array.from(root.querySelectorAll<HTMLElement>(".hero-h"))
    const magneticCleanups: Array<() => void> = []

    const ctx = gsap.context(() => {
      lines.forEach((line) => {
        const maxWidth = Math.max(260, root.clientWidth - 72)
        const scale = Math.min(1, maxWidth / line.scrollWidth)
        line.style.setProperty("--hero-scale", String(scale))
      })

      lines.forEach((line, index) => {
        const chars = Array.from(line.querySelectorAll<HTMLElement>(".hero-char"))

        gsap.from(chars, {
          y: "105%",
          opacity: 0,
          duration: 0.7,
          stagger: 0.03,
          ease: "power3.out",
          delay: index === 0 ? 0.15 : 0.3,
        })
      })

      root.querySelectorAll<HTMLElement>("[data-magnetic]").forEach((button) => {
        const onMove = (event: MouseEvent) => {
          const rect = button.getBoundingClientRect()
          const x = ((event.clientX - rect.left) / rect.width - 0.5) * 16
          const y = ((event.clientY - rect.top) / rect.height - 0.5) * 16

          gsap.to(button, {
            x: Math.max(-8, Math.min(8, x)),
            y: Math.max(-8, Math.min(8, y)),
            duration: 0.28,
            ease: "power3.out",
          })
        }

        const onLeave = () => {
          gsap.to(button, {
            x: 0,
            y: 0,
            duration: 0.8,
            ease: "elastic.out(1, 0.45)",
          })
        }

        button.addEventListener("mousemove", onMove)
        button.addEventListener("mouseleave", onLeave)
        magneticCleanups.push(() => {
          button.removeEventListener("mousemove", onMove)
          button.removeEventListener("mouseleave", onLeave)
        })
      })
    }, root)

    return () => {
      magneticCleanups.forEach((cleanup) => cleanup())
      ctx.revert()
      lines.forEach((line) => {
        line.style.removeProperty("--hero-scale")
      })
    }
  }, [])

  return (
    <section
      ref={heroRef}
      className="hero-grid-bg relative min-h-[91vh] flex flex-col items-center justify-center text-center overflow-hidden px-6 md:px-12 pb-16 pt-20"
      aria-label="ScaleSmiths - forge your digital edge"
    >
      <ForgeHeroScene />

      <div className="relative z-10 flex w-full flex-col items-center">
        <div className="hero-badge font-dm" role="status">
          <span className="hero-badge-dot" aria-hidden="true" />
          Plan your next digital project
        </div>

        <h1 className="mb-6 w-full">
          <span className="hero-line-overflow block">
            <span className="hero-h hero-outline hero-line-1 font-syne inline-block whitespace-nowrap" aria-label={HERO_LINES[0]}>
              {renderHeroLine(HERO_LINES[0])}
            </span>
          </span>
          <span className="hero-line-overflow block">
            <span className="hero-h text-t1 hero-line-2 font-syne inline-block whitespace-nowrap" aria-label={HERO_LINES[1]}>
              {renderHeroLine(HERO_LINES[1])}
            </span>
          </span>
        </h1>

        <p className="hero-sub font-dm font-light text-t2 w-full max-w-[520px] leading-relaxed text-[clamp(15px,1.8vw,18px)] mb-4">
          Conversion-focused websites, SEO-ready builds, custom web apps, and ongoing care plans for
          local businesses and founder-led teams that need digital to create measurable growth.
        </p>

        <div className="mb-5 flex max-w-[780px] flex-wrap justify-center gap-2" aria-label="ScaleSmiths core offers">
          {["Websites that convert", "Custom web apps", "Local SEO foundations", "Care plans"].map((offer) => (
            <span key={offer} className="rounded-full border border-b1 bg-s1/80 px-3 py-1.5 font-dm text-[11px] font-medium text-t2 shadow-[0_0_24px_rgba(34,211,238,0.06)]">
              {offer}
            </span>
          ))}
        </div>

        <div className="hero-location flex items-center gap-2 mb-10">
          <MapPin size={12} className="text-t3" aria-hidden="true" />
          <span className="font-dm text-xs text-t3 tracking-wider">
            Hucknall, Nottinghamshire, UK {"\u00b7"} Working nationally
          </span>
        </div>

        <div className="hero-ctas flex flex-wrap gap-3 justify-center">
          <Link href="/quote" prefetch={false} className="btn-primary font-dm" data-magnetic>
            Request a Quote <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <DiscoveryCallLink className="btn-ghost gap-2 font-dm" source="homepage_hero" />
          <Link href="/services" prefetch={false} className="btn-ghost font-dm" data-magnetic>
            View Services <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>

        <div className="hero-stats flex flex-wrap gap-14 justify-center mt-20">
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
        </div>
      </div>
    </section>
  )
}
