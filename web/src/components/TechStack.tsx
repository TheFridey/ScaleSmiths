"use client"

import { useEffect, useRef } from "react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

const techStack = [
  {
    name: "Next.js",
    accent: "#ffffff",
    description: "Production app routing, fast static pages, server components, and SEO-ready public sites.",
  },
  {
    name: "React",
    accent: "#61dafb",
    description: "Interactive interfaces, portals, dashboards, configurators, and client-side product experiences.",
  },
  {
    name: "Node.js",
    accent: "#22c55e",
    description: "APIs, automation workers, integrations, and custom business logic behind the product surface.",
  },
  {
    name: "PostgreSQL",
    accent: "#60a5fa",
    description: "Reliable data models for quotes, orders, memberships, admin workflows, and reporting.",
  },
  {
    name: "Docker",
    accent: "#38bdf8",
    description: "Portable deployments, repeatable environments, and VPS infrastructure that can be moved or scaled.",
  },
  {
    name: "Stripe",
    accent: "#8b5cf6",
    description: "Payments, subscriptions, customer portals, billing flows, and revenue logic wired into products.",
  },
  {
    name: "Cloudflare",
    accent: "#f97316",
    description: "DNS, edge caching, security, image delivery, R2 storage, and practical performance hardening.",
  },
]

export function TechStack() {
  const containerRef = useRef<HTMLElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    const wrapper = wrapperRef.current
    if (!container || !wrapper) return

    gsap.registerPlugin(ScrollTrigger)

    const mm = gsap.matchMedia()

    mm.add("(min-width: 768px) and (pointer: fine)", () => {
      const panels = gsap.utils.toArray<HTMLElement>("[data-tech-panel]", wrapper)

      const tween = gsap.to(wrapper, {
        xPercent: (-100 * (panels.length - 1)) / panels.length,
        ease: "none",
        scrollTrigger: {
          trigger: container,
          pin: true,
          scrub: 1,
          snap: 1 / (panels.length - 1),
          end: () => `+=${container.offsetWidth * (panels.length - 1)}`,
        },
      })

      return () => tween.kill()
    })

    return () => mm.revert()
  }, [])

  return (
    <section
      ref={containerRef}
      aria-label="Technology stack"
      className="relative overflow-hidden border-y border-b1 bg-bg py-16 md:h-screen md:py-0"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-bg to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-24 bg-gradient-to-t from-bg to-transparent" />

      <div className="px-6 md:hidden">
        <span className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">Stack</span>
        <h2 className="mt-2 font-syne text-[clamp(28px,9vw,42px)] font-extrabold tracking-[-0.025em]">
          Built on serious tools.
        </h2>
      </div>

      <div
        ref={wrapperRef}
        className="mt-8 flex snap-x snap-mandatory overflow-x-auto md:mt-0 md:h-full md:w-max md:overflow-visible"
      >
        {techStack.map((tech, index) => (
          <article
            key={tech.name}
            data-tech-panel
            className="relative flex min-w-full snap-center items-center overflow-hidden px-6 py-12 md:h-screen md:w-screen md:min-w-[100vw] md:px-12 md:py-0"
            style={{
              background: `
                radial-gradient(circle at 24% 22%, ${tech.accent}22, transparent 30%),
                radial-gradient(circle at 82% 70%, ${tech.accent}14, transparent 26%),
                linear-gradient(135deg, rgba(255,255,255,0.045), rgba(255,255,255,0.01) 42%, rgba(0,0,0,0.24))
              `,
            }}
          >
            <div
              className="absolute left-6 top-10 h-1 w-32 rounded-full md:left-12 md:top-20"
              style={{ background: `linear-gradient(90deg, ${tech.accent}, transparent)` }}
              aria-hidden="true"
            />
            <div
              className="absolute right-6 top-10 font-syne text-sm font-bold text-t3 md:right-12 md:top-20"
              aria-hidden="true"
            >
              {String(index + 1).padStart(2, "0")} / {String(techStack.length).padStart(2, "0")}
            </div>

            <div className="relative z-10 max-w-[980px]">
              <span className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-t2">ScaleSmiths stack</span>
              <h2
                className="mt-5 font-syne text-[clamp(58px,14vw,180px)] font-extrabold leading-[0.88] tracking-[-0.025em]"
                style={{ color: tech.accent }}
              >
                {tech.name}
              </h2>
              <p className="mt-8 max-w-[680px] font-dm text-[clamp(17px,2vw,24px)] leading-relaxed text-t2">
                {tech.description}
              </p>
            </div>

            <div
              className="pointer-events-none absolute bottom-8 right-8 hidden font-syne text-[22vw] font-extrabold leading-none text-white opacity-[0.025] md:block"
              aria-hidden="true"
            >
              {tech.name}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
