"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, RefreshCw, Sparkles } from "lucide-react"
import { trackExperienceEvent } from "@/lib/experience-analytics-client"
import { EXPERIENCE_PREFERENCE_COOKIE } from "@/lib/experience-experiment"
import { cn } from "@/lib/utils"

type ExperiencePreference = "normal" | "interactive"

const STORAGE_KEY = "scalesmiths.experience"

export const PROJECT_PLANNER_HREF = "/interactive"
export const PROJECT_PLANNER_CTA_LABEL = "Launch the Project Planner"

function rememberPreference(preference: ExperiencePreference) {
  try {
    window.localStorage.setItem(STORAGE_KEY, preference)
    document.cookie = `${EXPERIENCE_PREFERENCE_COOKIE}=${preference}; Max-Age=${60 * 60 * 24 * 365}; Path=/; SameSite=Lax`
  } catch {
    // Private browsing or locked-down storage should not block navigation.
  }
}

function clearPreference() {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
    document.cookie = `${EXPERIENCE_PREFERENCE_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`
  } catch {
    // Locked-down storage should not block the visible controls.
  }
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

/**
 * Secondary CTA into the public interactive planner.
 * Homepage entry is always the normal site; this keeps the planner discoverable.
 */
export function ProjectPlannerCta({
  className,
  label = PROJECT_PLANNER_CTA_LABEL,
  source = "secondary_cta",
}: {
  className?: string
  label?: string
  source?: string
}) {
  return (
    <Link
      href={PROJECT_PLANNER_HREF}
      prefetch={false}
      onClick={() => {
        rememberInteractiveExperience()
        trackExperienceEvent("experience_interactive_selected", {
          preference: "interactive",
          toExperience: "interactive",
          metadata: { source, target: PROJECT_PLANNER_HREF },
        })
      }}
      className={cn("group inline-flex items-center gap-2 font-dm text-sm font-semibold text-acc", className)}
    >
      <Sparkles size={15} aria-hidden="true" />
      {label}
      <ArrowRight size={15} aria-hidden="true" className="transition-transform group-hover:translate-x-1" />
    </Link>
  )
}

/** Exit control on the interactive planner. */
export function ResetExperiencePreferenceButton() {
  const router = useRouter()

  function exitToWebsite() {
    clearPreference()
    trackExperienceEvent("experience_switched", {
      preference: "none",
      fromExperience: "interactive",
      toExperience: "none",
      metadata: { reason: "exit_to_website" },
    })
    router.push("/")
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={exitToWebsite}
      className="fixed bottom-3 right-3 z-40 inline-flex max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-lg border border-white/10 bg-bg/88 px-3 py-2 font-dm text-[11px] font-semibold text-t2 shadow-[0_12px_36px_rgba(0,0,0,0.3)] backdrop-blur transition hover:border-b3 hover:text-t1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-acc sm:bottom-4 sm:right-4 sm:text-xs"
    >
      <RefreshCw size={14} aria-hidden="true" />
      Back to website
    </button>
  )
}
