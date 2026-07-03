"use client"

import type { CSSProperties, KeyboardEvent, ReactNode } from "react"
import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import dynamic from "next/dynamic"
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "framer-motion"
import { ArrowRight, Building2, CalendarCheck, ChefHat, Dumbbell, Hammer, Package, Sparkles, Telescope, Users } from "lucide-react"
import { ResetExperiencePreferenceButton, rememberInteractiveExperience, rememberNormalExperience } from "@/components/ExperiencePreference"
import { BusinessSimulationLayer } from "@/components/v2/BusinessSimulationLayer"
import { V2ConversionLayer } from "@/components/v2/V2ConversionLayer"
import {
  V2Industry,
  V2JourneyStep,
  V2Scene,
  getSceneByStep,
  getSimulationSceneForIndustry,
} from "@/lib/v2/scenes"
import { getForgePanel } from "@/lib/v2/forge-panels"
import { getIndustryContent } from "@/lib/v2/industryContent"

const ClientSceneCanvas = dynamic(() => import("@/components/v2/three/ClientSceneCanvas"), {
  ssr: false,
  loading: () => <div aria-hidden="true" className="h-full w-full bg-[radial-gradient(circle_at_50%_42%,rgba(34,211,238,0.10),transparent_34%)]" />,
})

interface IndustryOption {
  id: V2Industry
  label: string
  Icon: typeof Hammer
}

const INDUSTRY_STORAGE_KEY = "scalesmiths.v2.industry"

const industryOptions: IndustryOption[] = [
  { id: "local-trade-builder", label: "Local Trade / Builder", Icon: Hammer },
  { id: "restaurant-food", label: "Restaurant / Food", Icon: ChefHat },
  { id: "gym-fitness", label: "Gym / Fitness", Icon: Dumbbell },
  { id: "professional-services", label: "Professional Services", Icon: Building2 },
  { id: "ecommerce", label: "Ecommerce", Icon: Package },
  { id: "other", label: "Other", Icon: Users },
]

const journeyMarkers: Array<{ step: V2JourneyStep; label: string }> = [
  { step: "intro", label: "Orient" },
  { step: "industry-selection", label: "Choose" },
  { step: "industry-simulation", label: "Simulate" },
  { step: "forge", label: "Forge" },
  { step: "final", label: "Plan" },
]

function isV2Industry(value: string | null): value is V2Industry {
  return industryOptions.some((option) => option.id === value)
}

function readStoredIndustry() {
  try {
    const stored = window.localStorage.getItem(INDUSTRY_STORAGE_KEY)
    return isV2Industry(stored) ? stored : null
  } catch {
    return null
  }
}

function storeIndustry(industryId: V2Industry) {
  try {
    window.localStorage.setItem(INDUSTRY_STORAGE_KEY, industryId)
  } catch {
    // Locked-down storage should not block the journey.
  }
}

function SceneBackdrop({
  scene,
  reducedMotion,
  activePanelId,
  onPanelFocus,
}: {
  scene: V2Scene
  reducedMotion: boolean
  activePanelId: string | null
  onPanelFocus: (panelId: string | null) => void
}) {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setLoaded(false)
  }, [scene.id])

  const objectPosition = {
    "--scene-position": scene.objectPosition,
    "--scene-position-mobile": scene.mobileObjectPosition,
  } as CSSProperties

  return (
    <div className="absolute inset-0 z-0 overflow-hidden bg-bg" style={objectPosition}>
      <AnimatePresence mode="wait">
        <motion.div
          key={scene.id}
          aria-hidden="true"
          className="absolute inset-0"
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.7, ease: "easeOut" }}
        >
          {!loaded && (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_20%,rgba(34,211,238,0.18),transparent_28%),radial-gradient(circle_at_76%_28%,rgba(253,230,138,0.10),transparent_24%),linear-gradient(135deg,rgba(7,17,31,1),rgba(11,22,38,0.94))]">
              <div className="absolute bottom-8 left-6 h-px w-28 overflow-hidden rounded-full bg-white/10 md:left-12">
                <div className="h-full w-1/2 rounded-full bg-acc/70 motion-safe:animate-[v2-loading-sweep_1.4s_ease-in-out_infinite]" />
              </div>
            </div>
          )}
          <Image
            src={scene.image}
            alt=""
            fill
            priority={scene.journeyStep === "intro"}
            sizes="100vw"
            quality={90}
            onLoad={() => setLoaded(true)}
            className="object-cover [object-position:var(--scene-position-mobile)] md:[object-position:var(--scene-position)]"
          />
        </motion.div>
      </AnimatePresence>

      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.026)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.026)_1px,transparent_1px)] bg-[size:64px_64px] opacity-55" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_48%_26%,rgba(34,211,238,0.10),transparent_26%),linear-gradient(90deg,rgba(4,12,23,0.95),rgba(4,12,23,0.62)_43%,rgba(4,12,23,0.78)),linear-gradient(180deg,rgba(4,12,23,0.70),rgba(4,12,23,0.20)_42%,rgba(4,12,23,0.88))]" />
      <div aria-hidden="true" className="absolute inset-0 hidden opacity-55 md:block">
        <ClientSceneCanvas
          className="h-full w-full"
          isForgeStep={scene.journeyStep === "forge"}
          activePanelId={activePanelId}
          onPanelFocus={onPanelFocus}
        />
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-bg to-transparent md:hidden" />
    </div>
  )
}

function ForgePanelOverlay({ panelId }: { panelId: string | null }) {
  const panel = getForgePanel(panelId)

  return (
    <AnimatePresence>
      {panel && (
        <motion.aside
          key={panel.id}
          aria-live="polite"
          className="fixed bottom-4 left-4 z-30 max-w-[360px] rounded-lg border border-white/10 bg-bg/82 p-4 shadow-[0_20px_70px_rgba(0,0,0,0.36)] backdrop-blur-xl"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          <p className="font-dm text-[11px] font-semibold uppercase tracking-[0.14em] text-acc">Forge module</p>
          <h2 className="mt-2 font-syne text-xl font-black tracking-normal text-t1">{panel.label}</h2>
          <p className="mt-2 font-dm text-sm leading-relaxed text-t2">{panel.description}</p>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}

function JourneyProgress({ currentStep }: { currentStep: V2JourneyStep }) {
  const currentIndex = journeyMarkers.findIndex((marker) => marker.step === currentStep)
  const progress = ((currentIndex + 1) / journeyMarkers.length) * 100

  return (
    <nav aria-label="V2 journey progress" className="w-full max-w-[620px]">
      <div className="mb-3 flex items-center justify-between gap-4 font-dm text-[11px] font-semibold uppercase tracking-[0.14em] text-t3">
        <span>Journey</span>
        <span aria-live="polite">{currentIndex + 1} / {journeyMarkers.length}</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={journeyMarkers.length}
        aria-valuenow={currentIndex + 1}
        aria-label={`Step ${currentIndex + 1} of ${journeyMarkers.length}: ${journeyMarkers[currentIndex]?.label}`}
        className="h-1 overflow-hidden rounded-full bg-white/10"
      >
        <motion.div
          className="h-full rounded-full bg-[linear-gradient(90deg,var(--acc),var(--grn),var(--amb))]"
          initial={false}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        />
      </div>
      <ol className="mt-3 grid grid-cols-5 gap-1.5">
        {journeyMarkers.map((marker, index) => {
          const active = index <= currentIndex
          const current = index === currentIndex

          return (
            <li
              key={marker.step}
              className="min-w-0 rounded-lg border border-white/10 bg-bg/42 px-2 py-2.5 text-center font-dm text-[11px] font-semibold uppercase tracking-normal text-t3 backdrop-blur-md transition-colors data-[active=true]:border-acc/35 data-[active=true]:text-t2 data-[current=true]:bg-acc/10 data-[current=true]:text-acc md:tracking-[0.08em]"
              data-active={active}
              data-current={current}
              aria-current={current ? "step" : undefined}
            >
              {marker.label}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function StageHeader({
  eyebrow,
  Icon,
}: {
  eyebrow: string
  Icon: typeof Sparkles
}) {
  return (
    <motion.p
      className="mb-4 inline-flex items-center gap-2 rounded-full border border-acc/25 bg-acc/10 px-4 py-2 font-dm text-xs font-semibold uppercase tracking-[0.14em] text-acc backdrop-blur-md"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
    >
      <Icon size={14} aria-hidden="true" />
      {eyebrow}
    </motion.p>
  )
}

function PrimaryJourneyButton({
  children,
  onClick,
  className = "",
}: {
  children: ReactNode
  onClick: () => void
  className?: string
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      className={`group inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-acc px-6 py-3 font-dm text-sm font-semibold text-bg shadow-[0_0_58px_rgba(34,211,238,0.26)] transition hover:bg-[#67e8f9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-acc ${className}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, delay: 0.14, ease: "easeOut" }}
    >
      {children}
      <ArrowRight size={16} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" />
    </motion.button>
  )
}

export function V2InteractiveExperience() {
  const [step, setStep] = useState<V2JourneyStep>("intro")
  const [selectedIndustry, setSelectedIndustry] = useState<V2Industry | null>(null)
  const [activeForgePanelId, setActiveForgePanelId] = useState<string | null>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    rememberInteractiveExperience()
    setSelectedIndustry(readStoredIndustry())
  }, [])

  function chooseIndustry(industryId: V2Industry) {
    setSelectedIndustry(industryId)
    storeIndustry(industryId)
    setStep("industry-simulation")
  }

  function handleIndustryKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const navigationKeys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"]
    if (!navigationKeys.includes(event.key)) return

    event.preventDefault()

    const currentIndex = optionRefs.current.findIndex((option) => option === document.activeElement)
    const lastIndex = industryOptions.length - 1
    let nextIndex = currentIndex === -1 ? 0 : currentIndex

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = currentIndex >= lastIndex ? 0 : currentIndex + 1
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = currentIndex <= 0 ? lastIndex : currentIndex - 1
    }

    if (event.key === "Home") nextIndex = 0
    if (event.key === "End") nextIndex = lastIndex

    optionRefs.current[nextIndex]?.focus()
  }

  function exitToNormalSite() {
    rememberNormalExperience()
  }

  const activeScene =
    step === "industry-simulation"
      ? getSimulationSceneForIndustry(selectedIndustry)
      : getSceneByStep(step) ?? getSceneByStep("intro")!
  const selectedContent = getIndustryContent(selectedIndustry)

  const panelMotion = {
    initial: reducedMotion ? false : { opacity: 0, y: 22 },
    animate: { opacity: 1, y: 0 },
    exit: reducedMotion ? { opacity: 1 } : { opacity: 0, y: -18 },
    transition: reducedMotion ? { duration: 0 } : { duration: 0.48, ease: "easeOut" },
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-screen overflow-hidden bg-bg text-t1">
        <SceneBackdrop
          scene={activeScene}
          reducedMotion={Boolean(reducedMotion)}
          activePanelId={activeForgePanelId}
          onPanelFocus={setActiveForgePanelId}
        />
        <ForgePanelOverlay panelId={activeForgePanelId} />

        <Link
          href="/"
          prefetch={false}
          onClick={exitToNormalSite}
          className="fixed right-4 top-4 z-30 rounded-lg border border-white/10 bg-bg/78 px-4 py-2 font-dm text-sm font-semibold text-t2 shadow-[0_16px_48px_rgba(0,0,0,0.28)] backdrop-blur-md transition-colors hover:border-b3 hover:text-t1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-acc"
        >
          Exit to normal site
        </Link>
        <ResetExperiencePreferenceButton />

        <section className="relative z-10 flex min-h-screen items-start px-5 py-24 sm:px-6 md:items-center md:px-12 md:py-28">
          <div className={`mx-auto grid w-full max-w-[1180px] gap-10 lg:grid-cols-[0.98fr_1.02fr] ${step === "final" ? "lg:items-start" : "lg:items-center"}`}>
            <div className="max-w-[720px]" aria-live="polite">
              <JourneyProgress currentStep={step} />

              <AnimatePresence mode="wait">
                {step === "intro" && (
                  <motion.div key="intro" {...panelMotion} className="mt-8">
                    <StageHeader eyebrow="ScaleSmiths V2.0" Icon={Sparkles} />
                    <motion.h1
                      id="v2-intro-heading"
                      className="font-syne text-[clamp(2.75rem,13vw,4.9rem)] font-black leading-[1.02] tracking-normal text-t1 drop-shadow-[0_3px_30px_rgba(0,0,0,0.55)] md:text-7xl"
                      layout
                    >
                      {activeScene.title}
                    </motion.h1>
                    <p className="mt-7 max-w-[760px] font-dm text-lg leading-relaxed text-t2 drop-shadow-[0_2px_20px_rgba(0,0,0,0.72)] md:text-xl">
                      {activeScene.subtitle}
                    </p>
                    <PrimaryJourneyButton onClick={() => setStep("industry-selection")} className="mt-10">
                      Begin Journey
                    </PrimaryJourneyButton>
                  </motion.div>
                )}

                {step === "industry-selection" && (
                  <motion.div key="industry-selection" {...panelMotion} className="mt-8">
                    <StageHeader eyebrow="Business signal" Icon={Telescope} />
                    <h1 id="industry-heading" className="font-syne text-4xl font-black leading-[1.04] tracking-normal drop-shadow-[0_3px_30px_rgba(0,0,0,0.55)] md:text-6xl">
                      {activeScene.title}
                    </h1>
                    <p className="mt-5 max-w-[680px] font-dm text-base leading-relaxed text-t2 drop-shadow-[0_2px_20px_rgba(0,0,0,0.72)]">
                      {activeScene.subtitle}
                    </p>
                  </motion.div>
                )}

                {step === "industry-simulation" && (
                  <motion.div key="industry-simulation" {...panelMotion} className="mt-8 rounded-lg border border-white/10 bg-bg/58 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur-xl md:p-8">
                    <StageHeader eyebrow="Industry simulation" Icon={CalendarCheck} />
                    <h1 className="font-syne text-3xl font-black leading-[1.06] tracking-normal text-t1 md:text-5xl">
                      {selectedContent.headline}
                    </h1>
                    <p className="mt-5 font-dm text-base leading-relaxed text-t2 md:text-lg">
                      {activeScene.subtitle}
                    </p>
                    <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                      <button
                        type="button"
                        onClick={() => setStep("industry-selection")}
                        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/10 bg-white/5 px-5 py-3 font-dm text-sm font-semibold text-t2 transition hover:border-b3 hover:text-t1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-acc"
                      >
                        Change industry
                      </button>
                      <PrimaryJourneyButton onClick={() => setStep("forge")} className="min-h-11 px-5 py-3">
                        {selectedContent.ctaWording.simulationNext}
                      </PrimaryJourneyButton>
                    </div>
                  </motion.div>
                )}

                {step === "forge" && (
                  <motion.div key="forge" {...panelMotion} className="mt-8 rounded-lg border border-white/10 bg-bg/58 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur-xl md:p-8">
                    <StageHeader eyebrow="Forge build" Icon={Hammer} />
                    <h1 className="font-syne text-3xl font-black leading-[1.06] tracking-normal text-t1 md:text-5xl">
                      {activeScene.title}
                    </h1>
                    <p className="mt-5 font-dm text-base leading-relaxed text-t2 md:text-lg">
                      {activeScene.subtitle}
                    </p>
                    <PrimaryJourneyButton onClick={() => setStep("final")} className="mt-8 min-h-11 px-5 py-3">
                      Reveal your plan
                    </PrimaryJourneyButton>
                  </motion.div>
                )}

                {step === "final" && (
                  <motion.div key="final" {...panelMotion} className="mt-8 rounded-lg border border-white/10 bg-bg/62 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.34)] backdrop-blur-xl md:p-8">
                    <StageHeader eyebrow="Launch ready" Icon={Sparkles} />
                    <h1 className="font-syne text-4xl font-black leading-[1.04] tracking-normal text-t1 md:text-6xl">
                      {activeScene.title}
                    </h1>
                    <p className="mt-5 font-dm text-xl leading-relaxed text-t2">
                      {activeScene.subtitle}
                    </p>
                    <p className="mt-4 font-dm text-base leading-relaxed text-t2">
                      {selectedContent.finalPitch}
                    </p>
                    <p className="mt-6 font-dm text-sm leading-relaxed text-t3">
                      Choose a next step in the plan panel. The enquiry will include the selected industry, recommended system and journey context.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {step === "industry-simulation" && (
              <BusinessSimulationLayer industry={selectedIndustry} />
            )}

            {step === "final" && (
              <V2ConversionLayer industry={selectedIndustry} />
            )}

            {step === "industry-selection" && (
              <motion.div
                role="group"
                aria-labelledby="industry-heading"
                onKeyDown={handleIndustryKeyDown}
                className="grid gap-4 sm:grid-cols-2"
                initial={reducedMotion ? false : { opacity: 0, x: 22 }}
                animate={{ opacity: 1, x: 0 }}
                transition={reducedMotion ? { duration: 0 } : { duration: 0.48, ease: "easeOut" }}
              >
                {industryOptions.map(({ id, label, Icon }, index) => {
                  const isSelected = selectedIndustry === id

                  return (
                    <button
                      key={id}
                      ref={(element) => {
                        optionRefs.current[index] = element
                      }}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => chooseIndustry(id)}
                      className="group min-h-[132px] rounded-lg border border-white/10 bg-bg/58 p-5 text-left shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-acc/50 hover:bg-acc/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-acc data-[selected=true]:border-acc data-[selected=true]:bg-acc/12 motion-reduce:transform-none md:min-h-[142px]"
                      data-selected={isSelected}
                    >
                      <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-bg/70 text-acc">
                        <Icon size={20} aria-hidden="true" />
                      </span>
                      <span className="mt-6 block font-dm text-lg font-semibold text-t1">{label}</span>
                      <span className="mt-2 block font-dm text-sm leading-relaxed text-t2">
                        Simulate a system for this model.
                      </span>
                    </button>
                  )
                })}
              </motion.div>
            )}
          </div>
        </section>
      </div>
    </MotionConfig>
  )
}
