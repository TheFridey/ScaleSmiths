import Link from "next/link"
import { ArrowRight, ArrowUpRight } from "lucide-react"
import { HeroEmbers } from "@/components/HeroEmbers"
import { HeroForgeVideo } from "@/components/HeroForgeVideo"

const HERO_LINES = ["FORGE YOUR", "DIGITAL EDGE"] as const
const HERO_STILL = "/brand/scalesmiths-forge-atmosphere.webp"
const HERO_STILL_MOBILE = "/brand/scalesmiths-forge-atmosphere-mobile.webp"

/**
 * First viewport budget: brand atmosphere, one headline, one supporting sentence,
 * one CTA group. Embers + forge plate carry the visual; no secondary marketing clutter.
 */
export function Hero() {
  return (
    <>
      <link rel="preload" as="image" href={HERO_STILL_MOBILE} type="image/webp" media="(max-width: 767px)" fetchPriority="high" />
      <link rel="preload" as="image" href={HERO_STILL} type="image/webp" media="(min-width: 768px)" fetchPriority="high" />
      <section
        className="hero-grid-bg relative flex min-h-[min(92vh,960px)] w-full max-w-[100vw] flex-col items-center justify-center overflow-hidden px-6 pb-28 pt-20 text-center md:px-12 md:pb-32 md:pt-24"
        aria-label="ScaleSmiths - forge your digital edge"
      >
      <div className="hero-scene-fallback absolute inset-0" data-hero-scene="static" aria-hidden="true" />

      {/* High-priority still paints first and remains the mobile cinematic treatment. */}
      <div
        className="hero-atmosphere pointer-events-none absolute inset-0 z-[1] opacity-[0.58] md:opacity-[0.64]"
        aria-hidden="true"
      >
        {/* These already-optimised WebPs are served directly so a cold Next image
            transform cannot add seconds to the first render. */}
        <picture>
          <source media="(max-width: 767px)" srcSet={HERO_STILL_MOBILE} type="image/webp" />
          <img
            src={HERO_STILL}
            alt=""
            width={577}
            height={1024}
            loading="eager"
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover object-[center_62%]"
          />
        </picture>
      </div>

      <HeroForgeVideo />

      {/* Soft vignette so type stays readable without burying the forge video */}
      <div
        className="pointer-events-none absolute inset-0 z-[3] bg-[radial-gradient(ellipse_at_50%_36%,transparent_0%,rgba(11,10,8,0.1)_58%,rgba(11,10,8,0.48)_100%)]"
        aria-hidden="true"
      />

      <HeroEmbers />

      <div className="relative z-10 flex w-full flex-col items-center">
        {/* Local text scrim, keeps brand/headline readable across forge brightness cycles */}
        <div
          aria-hidden="true"
          data-hero-text-scrim
          className="hero-text-scrim pointer-events-none absolute left-1/2 top-1/2 z-0 h-[min(78%,38rem)] w-[min(100%,52rem)] -translate-x-1/2 -translate-y-[46%] rounded-[42%]"
        />
        <p className="hero-copy relative mb-8 font-syne text-xs font-semibold uppercase tracking-[0.28em] text-acc md:mb-10 md:tracking-[0.32em]">
          ScaleSmiths
        </p>

        <h1 className="relative mb-7 w-full max-w-full overflow-hidden md:mb-8">
          <span className="sr-only">Forge your digital edge</span>
          <span className="hero-line-overflow block" aria-hidden="true">
            <span className="hero-h hero-outline hero-copy font-syne inline-block whitespace-nowrap">
              {HERO_LINES[0]}
            </span>
          </span>
          <span className="hero-line-overflow block" aria-hidden="true">
            <span className="hero-h hero-copy text-t1 font-syne inline-block whitespace-nowrap">
              {HERO_LINES[1]}
            </span>
          </span>
        </h1>

        <h2 className="hero-copy relative mb-4 max-w-[22ch] font-syne text-[clamp(22px,3.2vw,36px)] font-bold leading-[1.15] tracking-[-0.02em] text-t1">
          Digital Experiences. Intelligent Systems. Measurable Growth.
        </h2>

        <p className="hero-copy relative mb-10 w-full max-w-[680px] font-dm text-[clamp(15px,1.7vw,18px)] font-light leading-relaxed text-t2 md:mb-12">
          ScaleSmiths designs, develops and improves high-performance websites, digital platforms and connected business systems. From ambitious independent businesses to established multi-site organisations, we help teams create better customer experiences, remove operational friction and build technology around real business objectives.
        </p>

        <div className="relative flex flex-wrap justify-center gap-3">
          <Link href="/#engagement-models" prefetch={false} className="btn-primary font-dm">
            Explore Our Capabilities <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link href="/quote?intent=strategy_call" prefetch={false} className="btn-ghost font-dm">
            Discuss a Project <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <p className="hero-copy relative mt-5 font-dm text-xs leading-relaxed text-t2">
          Founder-reviewed. Submitting an enquiry does not take payment or create a contract.
        </p>
      </div>
      </section>
    </>
  )
}
