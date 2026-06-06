"use client"

import Link from "next/link"
import Image from "next/image"
import { Fragment, type CSSProperties, useLayoutEffect, useRef } from "react"
import gsap from "gsap"
import { ArrowRight, ArrowUpRight, MapPin } from "lucide-react"

// Particle data is deterministic, so the server and client render the same positions.
const PARTICLES = [
  { size: 6, l: 8, t: 82, dur: 7, del: 0, px: 20, py: -120 },
  { size: 10, l: 18, t: 72, dur: 9, del: 1.2, px: -30, py: -140 },
  { size: 5, l: 35, t: 88, dur: 6, del: 2, px: 15, py: -100 },
  { size: 8, l: 62, t: 78, dur: 8, del: 0.5, px: -20, py: -130 },
  { size: 6, l: 74, t: 85, dur: 10, del: 3, px: 10, py: -110 },
  { size: 9, l: 84, t: 68, dur: 7, del: 1.5, px: -15, py: -120 },
  { size: 5, l: 12, t: 62, dur: 8, del: 4, px: 25, py: -100 },
  { size: 7, l: 45, t: 90, dur: 6, del: 2.5, px: -10, py: -140 },
  { size: 11, l: 55, t: 58, dur: 9, del: 0.8, px: 15, py: -120 },
  { size: 5, l: 78, t: 82, dur: 7, del: 1, px: -25, py: -100 },
  { size: 8, l: 28, t: 75, dur: 8, del: 3.5, px: 20, py: -130 },
  { size: 6, l: 68, t: 70, dur: 9, del: 0.3, px: -10, py: -110 },
  { size: 9, l: 40, t: 86, dur: 6, del: 2.2, px: 15, py: -100 },
  { size: 7, l: 90, t: 62, dur: 8, del: 4.5, px: -20, py: -120 },
  { size: 5, l: 5, t: 90, dur: 7, del: 1.8, px: 10, py: -110 },
]

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

export function Hero() {
  const heroRef = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    const root = heroRef.current
    if (!root) return

    const lines = Array.from(root.querySelectorAll<HTMLElement>(".hero-h"))
    const magneticCleanups: Array<() => void> = []

    const ctx = gsap.context(() => {
      lines.forEach((line) => {
        const maxWidth = Math.max(280, root.clientWidth - 48)
        const scale = Math.min(1, maxWidth / line.scrollWidth)
        line.style.transform = scale < 1 ? `scaleX(${scale})` : ""
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
        line.style.transform = ""
      })
    }
  }, [])

  return (
    <section
      ref={heroRef}
      className="hero-grid-bg relative min-h-[91vh] flex flex-col items-center justify-center text-center overflow-hidden px-6 md:px-12 pb-16 pt-20"
      aria-label="ScaleSmiths - forge your digital edge"
    >
      {/* Background CS watermark */}
      <div
        className="absolute inset-0 flex items-center justify-center select-none pointer-events-none"
        style={{ opacity: 0.022 }}
        aria-hidden="true"
      >
        <Image
          src="/brand/scalesmiths-mark.png"
          alt=""
          width={500}
          height={518}
          className="h-auto w-[min(58vw,500px)] object-contain"
          priority
          aria-hidden="true"
        />
      </div>

      {/* Ambient particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            className="particle"
            style={{
              "--p-size": `${p.size}px`,
              "--p-l": `${p.l}%`,
              "--p-t": `${p.t}%`,
              "--p-dur": `${p.dur}s`,
              "--p-del": `${p.del}s`,
              "--p-x": `${p.px}px`,
              "--p-y": `${p.py}px`,
            } as CSSProperties}
          />
        ))}
      </div>

      <div className="hero-badge font-dm" role="status">
        <span className="hero-badge-dot" aria-hidden="true" />
        Available for new projects
      </div>

      <h1 className="mb-6">
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

      <p className="hero-sub font-dm font-light text-t2 max-w-[520px] leading-relaxed text-[clamp(15px,1.8vw,18px)] mb-4">
        Conversion-focused websites, SEO-ready builds, custom web apps, and ongoing care plans for
        local businesses and founder-led teams that need digital to create measurable growth.
      </p>

      <div className="mb-5 flex max-w-[780px] flex-wrap justify-center gap-2" aria-label="ScaleSmiths core offers">
        {["Websites that convert", "Custom web apps", "Local SEO foundations", "Care plans"].map((offer) => (
          <span key={offer} className="rounded-full border border-b1 bg-s1/80 px-3 py-1.5 font-dm text-[11px] font-medium text-t2">
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
        <Link href="/quote" className="btn-primary font-dm" data-magnetic>
          Request a Quote <ArrowRight size={16} aria-hidden="true" />
        </Link>
        <Link href="/quote" className="btn-ghost font-dm" data-magnetic>
          Book a Discovery Call <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
        <Link href="/services" className="btn-ghost font-dm" data-magnetic>
          View Services <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </div>

      <div className="hero-stats flex flex-wrap gap-14 justify-center mt-20">
        {[
          { n: "12+", l: "Projects Delivered" },
          { n: "\u00a3300k+", l: "Revenue Generated" },
          { n: "100%", l: "Retainer Retention Rate" },
        ].map((s) => (
          <div key={s.n} className="text-center">
            <div className="font-syne text-[28px] font-extrabold text-t1">{s.n}</div>
            <div className="font-dm text-xs text-t2 mt-1 tracking-wider">{s.l}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
