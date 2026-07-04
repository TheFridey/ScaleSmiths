"use client"

import { ReactNode, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Compass, RefreshCw, Sparkles } from "lucide-react"

type ExperiencePreference = "normal" | "interactive"

const STORAGE_KEY = "scalesmiths.experience"

function readPreference(): ExperiencePreference | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return value === "normal" || value === "interactive" ? value : null
  } catch {
    return null
  }
}

function rememberPreference(preference: ExperiencePreference) {
  try {
    window.localStorage.setItem(STORAGE_KEY, preference)
  } catch {
    // Private browsing or locked-down storage should not block navigation.
  }
}

function clearPreference() {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Locked-down storage should not block the visible controls.
  }
}

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setReducedMotion(query.matches)

    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])

  return reducedMotion
}

interface HomeExperienceGateProps {
  children: ReactNode
}

export function HomeExperienceGate({ children }: HomeExperienceGateProps) {
  const [preference, setPreference] = useState<ExperiencePreference | null>(null)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    const savedPreference = readPreference()

    if (savedPreference === "interactive") {
      setPreference("interactive")
      setMounted(true)
      router.replace("/interactive")
      return
    }

    setPreference(savedPreference)
    setMounted(true)
  }, [router])

  function chooseNormal() {
    rememberPreference("normal")
    setPreference("normal")
    window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" })
  }

  function chooseInteractive() {
    rememberPreference("interactive")
    setPreference("interactive")
    router.push("/interactive")
  }

  if (!mounted) {
    return <ExperiencePreferenceLoadingShell />
  }

  if (preference === "normal") {
    return (
      <>
        <ExperienceSwitchControl current="normal" onReset={() => setPreference(null)} />
        {children}
      </>
    )
  }

  if (preference === "interactive") {
    return <ExperienceRedirectShell />
  }

  return (
    <ExperienceChoice
      onChooseNormal={chooseNormal}
      onChooseInteractive={chooseInteractive}
    />
  )
}

function ExperiencePreferenceLoadingShell() {
  return (
    <section
      aria-label="Loading experience preference"
      className="relative isolate flex min-h-[calc(100vh-70px)] items-center justify-center overflow-hidden px-6 py-16 md:px-12 md:py-24"
    >
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_24%_20%,rgba(34,211,238,0.12),transparent_28%),linear-gradient(135deg,rgba(11,22,38,0.78),rgba(7,17,31,0.96))]" />
      <div className="h-px w-32 overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-1/2 rounded-full bg-acc/70 motion-safe:animate-[v2-loading-sweep_1.4s_ease-in-out_infinite]" />
      </div>
    </section>
  )
}

function ExperienceRedirectShell() {
  return (
    <section
      aria-live="polite"
      aria-label="Opening interactive experience"
      className="relative isolate flex min-h-[calc(100vh-70px)] items-center justify-center overflow-hidden px-6 py-16 text-center md:px-12 md:py-24"
    >
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_32%,rgba(34,211,238,0.14),transparent_30%),linear-gradient(135deg,rgba(11,22,38,0.82),rgba(7,17,31,0.98))]" />
      <div>
        <p className="font-dm text-xs font-semibold uppercase tracking-[0.14em] text-acc">Interactive preference saved</p>
        <h1 className="mt-4 font-syne text-3xl font-black leading-tight tracking-normal text-t1 md:text-5xl">
          Opening ScaleSmiths V2.
        </h1>
      </div>
    </section>
  )
}

interface ExperienceChoiceProps {
  onChooseNormal: () => void
  onChooseInteractive: () => void
}

function ExperienceChoice({ onChooseNormal, onChooseInteractive }: ExperienceChoiceProps) {
  return (
    <section
      aria-labelledby="experience-choice-heading"
      className="relative isolate min-h-[calc(100vh-70px)] overflow-hidden px-6 py-16 md:px-12 md:py-24"
    >
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_18%,rgba(34,211,238,0.12),transparent_30%),radial-gradient(circle_at_82%_24%,rgba(253,230,138,0.10),transparent_24%),linear-gradient(135deg,rgba(11,22,38,0.78),rgba(7,17,31,0.96))]" />
      <div className="mx-auto flex max-w-[1060px] flex-col items-center text-center">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-b2 bg-s1/70 px-4 py-2 font-dm text-xs font-semibold uppercase tracking-[0.14em] text-t2">
          <Sparkles size={14} aria-hidden="true" />
          ScaleSmiths V2.0
        </p>
        <h1
          id="experience-choice-heading"
          className="max-w-[860px] font-syne text-4xl font-black leading-[1.04] tracking-normal text-t1 md:text-6xl"
        >
          What experience would you like today?
        </h1>

        <div className="mt-12 grid w-full gap-5 md:grid-cols-2">
          <button
            type="button"
            onClick={onChooseNormal}
            aria-describedby="normal-experience-copy"
            className="group min-h-[260px] rounded-lg border border-b2 bg-s1/78 p-7 text-left shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur motion-safe:transition motion-safe:duration-200 hover:border-b3 hover:bg-s2/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-acc"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-b2 bg-bg text-acc">
              <Compass size={22} aria-hidden="true" />
            </span>
            <span className="mt-8 block font-syne text-2xl font-black tracking-normal text-t1">
              Explore ScaleSmiths
            </span>
            <span id="normal-experience-copy" className="mt-4 block max-w-[430px] font-dm text-base leading-relaxed text-t2">
              Enter the current ScaleSmiths website with the services, work, pricing, proof, and quote journey already live.
            </span>
            <span className="mt-8 inline-flex items-center gap-2 font-dm text-sm font-semibold text-acc">
              Open website
              <ArrowRight size={16} aria-hidden="true" className="motion-safe:transition-transform group-hover:translate-x-1 motion-reduce:transform-none" />
            </span>
          </button>

          <button
            type="button"
            onClick={onChooseInteractive}
            aria-describedby="interactive-experience-copy"
            className="group min-h-[260px] rounded-lg border border-acc/40 bg-[linear-gradient(135deg,rgba(34,211,238,0.16),rgba(20,241,178,0.08),rgba(253,230,138,0.06))] p-7 text-left shadow-[0_24px_90px_rgba(34,211,238,0.16)] motion-safe:transition motion-safe:duration-200 hover:border-acc hover:bg-acc/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-acc"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-acc/40 bg-bg text-warning">
              <Sparkles size={22} aria-hidden="true" />
            </span>
            <span className="mt-8 block font-syne text-2xl font-black tracking-normal text-t1">
              Experience the Future
            </span>
            <span id="interactive-experience-copy" className="mt-4 block max-w-[430px] font-dm text-base leading-relaxed text-t2">
              Step into the V2.0 direction: a focused interactive shell for shaping projects through a richer ScaleSmiths flow.
            </span>
            <span className="mt-8 inline-flex items-center gap-2 font-dm text-sm font-semibold text-warning">
              Launch interactive
              <ArrowRight size={16} aria-hidden="true" className="motion-safe:transition-transform group-hover:translate-x-1 motion-reduce:transform-none" />
            </span>
          </button>
        </div>
      </div>
    </section>
  )
}

interface ExperienceSwitchControlProps {
  current: ExperiencePreference
  onReset?: () => void
}

export function ExperienceSwitchControl({ current, onReset }: ExperienceSwitchControlProps) {
  const router = useRouter()

  function switchExperience() {
    const next = current === "normal" ? "interactive" : "normal"
    rememberPreference(next)
    router.push(next === "interactive" ? "/interactive" : "/")
  }

  function resetPreference() {
    clearPreference()
    onReset?.()
    router.push("/")
    router.refresh()
  }

  return (
    <aside
      aria-label="Experience preference"
      className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2 sm:flex-row"
    >
      <button
        type="button"
        onClick={switchExperience}
        className="inline-flex items-center gap-2 rounded-lg border border-b2 bg-bg/90 px-3 py-2 font-dm text-xs font-semibold text-t2 shadow-[0_12px_36px_rgba(0,0,0,0.3)] backdrop-blur motion-safe:transition hover:border-b3 hover:text-t1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-acc"
      >
        <RefreshCw size={14} aria-hidden="true" />
        Switch experience
      </button>
      <button
        type="button"
        onClick={resetPreference}
        className="inline-flex items-center gap-2 rounded-lg border border-b2 bg-bg/90 px-3 py-2 font-dm text-xs font-semibold text-t2 shadow-[0_12px_36px_rgba(0,0,0,0.3)] backdrop-blur motion-safe:transition hover:border-b3 hover:text-t1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-acc"
      >
        Reset experience preference
      </button>
    </aside>
  )
}

export function rememberInteractiveExperience() {
  rememberPreference("interactive")
}

export function rememberNormalExperience() {
  rememberPreference("normal")
}

export function resetExperiencePreference() {
  clearPreference()
}

export function ResetExperiencePreferenceButton() {
  const router = useRouter()

  function resetPreference() {
    clearPreference()
    router.push("/")
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={resetPreference}
      className="fixed bottom-3 right-3 z-40 inline-flex max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-lg border border-white/10 bg-bg/88 px-3 py-2 font-dm text-[11px] font-semibold text-t2 shadow-[0_12px_36px_rgba(0,0,0,0.3)] backdrop-blur transition hover:border-b3 hover:text-t1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-acc sm:bottom-4 sm:right-4 sm:text-xs"
    >
      <RefreshCw size={14} aria-hidden="true" />
      Reset experience preference
    </button>
  )
}
