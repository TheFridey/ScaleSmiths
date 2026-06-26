"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Palette, WandSparkles } from "lucide-react"
import {
  FORGE_ANIMATION_PACKS,
  buildForgeAnimationWarning,
  getForgeAnimationPack,
  type ForgeAnimationPackName,
} from "@/lib/forge-animation"
import {
  FORGE_DESIGN_STYLE_PACKS,
  type ForgeDesignArtifactState,
  type ForgeDesignDirection,
  type ForgeDesignStylePack,
} from "@/lib/forge-design"
import type { ForgeCopyArtifactState } from "@/lib/forge-copy"
import { submitForgeJob } from "@/lib/forge-job-client"

const T = { s1:"var(--s1)", s2:"var(--s2)", s3:"var(--s3)", b1:"var(--b1)", b2:"var(--b2)", t1:"var(--t1)", t2:"var(--t2)", t3:"var(--t3)", acc:"var(--acc)", grn:"var(--grn)", amb:"var(--amb)", red:"var(--red)" }

export function ForgeDesignDirectionPanel({
  projectId,
  initialState,
  copyState,
  disabled = false,
}: {
  projectId: number
  initialState: ForgeDesignArtifactState
  copyState: ForgeCopyArtifactState
  disabled?: boolean
}) {
  const router = useRouter()
  const initialDirection = initialState.approvedDirection ?? initialState.direction
  const [direction, setDirection] = useState<ForgeDesignDirection | null>(initialDirection)
  const [status, setStatus] = useState(initialState.status)
  const [approvedAt, setApprovedAt] = useState(initialState.approvedAt)
  const [approvedBy, setApprovedBy] = useState(initialState.approvedBy)
  const [selectedStylePack, setSelectedStylePack] = useState<ForgeDesignStylePack>(initialDirection?.selectedStylePack ?? "Clean local professional")
  const [selectedAnimationPack, setSelectedAnimationPack] = useState<ForgeAnimationPackName>(initialDirection?.selectedAnimationPack ?? "Smooth Local Business")
  const [editorValue, setEditorValue] = useState(initialDirection ? JSON.stringify(initialDirection, null, 2) : "")
  const [viewMode, setViewMode] = useState<"view" | "edit">("view")
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    const nextDirection = initialState.approvedDirection ?? initialState.direction
    setDirection(nextDirection)
    setStatus(initialState.status)
    setApprovedAt(initialState.approvedAt)
    setApprovedBy(initialState.approvedBy)
    setSelectedStylePack(nextDirection?.selectedStylePack ?? "Clean local professional")
    setSelectedAnimationPack(nextDirection?.selectedAnimationPack ?? "Smooth Local Business")
    setEditorValue(nextDirection ? JSON.stringify(nextDirection, null, 2) : "")
  }, [initialState])

  const canGenerate = copyState.status === "approved" && !disabled
  const animationPack = getForgeAnimationPack(selectedAnimationPack)
  const animationWarning = buildForgeAnimationWarning(selectedAnimationPack, selectedStylePack)

  function changeStylePack(value: ForgeDesignStylePack) {
    setSelectedStylePack(value)
    if (!editorValue) return

    try {
      const parsed = JSON.parse(editorValue) as Record<string, unknown>
      parsed.selectedStylePack = value
      if (typeof parsed.designStyleName === "string") parsed.designStyleName = `${value} direction`
      setEditorValue(JSON.stringify(parsed, null, 2))
    } catch {
      setError("Fix the JSON before changing the style pack in the editor.")
    }
  }

  function changeAnimationPack(value: ForgeAnimationPackName) {
    setSelectedAnimationPack(value)
    if (!editorValue) return

    try {
      const parsed = JSON.parse(editorValue) as Record<string, unknown>
      parsed.selectedAnimationPack = value
      parsed.animationStyle = `${value}: ${getForgeAnimationPack(value).sectionReveal} ${getForgeAnimationPack(value).reducedMotionFallback}`
      const warning = buildForgeAnimationWarning(value, selectedStylePack)
      if (warning) parsed.overAnimationWarning = warning
      setEditorValue(JSON.stringify(parsed, null, 2))
    } catch {
      setError("Fix the JSON before changing the animation pack in the editor.")
    }
  }

  async function generate() {
    setBusy("generate")
    setError("")

    try {
      const json = await submitForgeJob<{ ok?: boolean; error?: string; direction: ForgeDesignDirection }>(`/api/forge/projects/${projectId}/design`, { preferredStylePack: selectedStylePack, preferredAnimationPack: selectedAnimationPack })

      if (!json.ok) {
        throw new Error(json.error || "Unable to generate design direction.")
      }

      setDirection(json.direction)
      setStatus("draft")
      setApprovedAt(null)
      setApprovedBy(null)
      setSelectedStylePack(json.direction.selectedStylePack)
      setSelectedAnimationPack(json.direction.selectedAnimationPack)
      setEditorValue(JSON.stringify(json.direction, null, 2))
      setViewMode("view")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate design direction.")
    } finally {
      setBusy("")
    }
  }

  async function approve() {
    setBusy("approve")
    setError("")

    try {
      const parsed = JSON.parse(editorValue) as unknown
      const response = await fetch(`/api/forge/projects/${projectId}/design`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction: parsed, selectedStylePack, selectedAnimationPack }),
      })
      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json.ok) {
        throw new Error(json.error || "Unable to approve design direction.")
      }

      setDirection(json.direction)
      setStatus("approved")
      setSelectedStylePack(json.direction.selectedStylePack)
      setSelectedAnimationPack(json.direction.selectedAnimationPack)
      setEditorValue(JSON.stringify(json.direction, null, 2))
      setViewMode("view")
      router.refresh()
    } catch (err) {
      setError(err instanceof SyntaxError ? "Design direction edits must be valid JSON." : err instanceof Error ? err.message : "Unable to approve design direction.")
    } finally {
      setBusy("")
    }
  }

  return (
    <section className="rounded-xl border p-5" style={{ background:T.s1, borderColor:T.b1 }}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Palette size={16} style={{ color:T.acc }} aria-hidden="true" />
            <h2 className="font-syne text-lg font-bold">Design Direction</h2>
          </div>
          <p className="max-w-[760px] font-dm text-sm leading-relaxed" style={{ color:T.t2 }}>
            Generates a practical premium design direction before code, based on approved copy, sitemap, research, intake, industry, and brand notes.
          </p>
          <p className="mt-2 max-w-[760px] font-dm text-xs leading-relaxed" style={{ color:T.amb }}>
            Keep motion restrained: animated details should clarify the journey, not compete with proof, copy, or forms.
          </p>
          {status === "approved" && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded px-2 py-1 font-dm text-[11px]" style={{ background:T.s2, border:`1px solid ${T.b2}`, color:T.grn }}>
              <CheckCircle2 size={13} aria-hidden="true" /> Approved{approvedAt ? ` / ${formatDate(approvedAt)}` : ""}{approvedBy ? ` / ${approvedBy}` : ""}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <label className="font-dm text-xs" style={{ color:T.t2 }}>
            <span className="sr-only">Style pack</span>
            <select value={selectedStylePack} onChange={(event) => changeStylePack(event.target.value as ForgeDesignStylePack)}>
              {FORGE_DESIGN_STYLE_PACKS.map((pack) => <option key={pack}>{pack}</option>)}
            </select>
          </label>
          <label className="font-dm text-xs" style={{ color:T.t2 }}>
            <span className="sr-only">Animation pack</span>
            <select value={selectedAnimationPack} onChange={(event) => changeAnimationPack(event.target.value as ForgeAnimationPackName)}>
              {FORGE_ANIMATION_PACKS.map((pack) => <option key={pack}>{pack}</option>)}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void generate()}
            disabled={!canGenerate || Boolean(busy)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-4 py-2 font-dm text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background:T.acc }}
          >
            <WandSparkles size={15} aria-hidden="true" /> {busy === "generate" ? "Generating..." : "Generate Design Direction"}
          </button>
          <button
            type="button"
            onClick={() => setViewMode(viewMode === "view" ? "edit" : "view")}
            disabled={!direction}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-4 py-2 font-dm text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background:T.s2, borderColor:T.b2, color:T.t1 }}
          >
            <Palette size={15} aria-hidden="true" /> {viewMode === "view" ? "Edit Direction" : "View Direction"}
          </button>
          <button
            type="button"
            onClick={() => void approve()}
            disabled={disabled || !editorValue || Boolean(busy)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-4 py-2 font-dm text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background:T.s2, borderColor:T.b2, color:T.t1 }}
          >
            <CheckCircle2 size={15} aria-hidden="true" /> {busy === "approve" ? "Approving..." : "Approve Direction"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border px-4 py-3 font-dm text-sm" style={{ background:"rgba(239,68,68,.08)", borderColor:"rgba(239,68,68,.3)", color:T.t1 }}>
          {error}
        </div>
      )}

      {!canGenerate && !disabled && (
        <div className="mb-4 rounded-lg border px-4 py-3 font-dm text-sm" style={{ background:T.s2, borderColor:T.b2, color:T.t2 }}>
          Approve copy before generating the design direction.
        </div>
      )}

      <div className="mb-4 rounded-lg border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>Animation pack</div>
            <div className="mt-1 font-syne text-sm font-bold" style={{ color:T.t1 }}>{animationPack.name}</div>
          </div>
          <span className="rounded px-2 py-1 font-dm text-[10px] font-semibold uppercase tracking-[.05em]" style={{ background:T.s3, border:`1px solid ${T.b2}`, color:animationPack.heavy ? T.amb : T.grn }}>
            {animationPack.heavy ? "Heavy" : "Controlled"}
          </span>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <MiniField label="Hero" value={animationPack.heroAnimation} />
          <MiniField label="Sections" value={animationPack.sectionReveal} />
          <MiniField label="Scroll" value={animationPack.scrollBehaviour} />
          <MiniField label="Reduced motion" value={animationPack.reducedMotionFallback} />
        </div>
        {animationWarning && (
          <div className="mt-3 rounded border px-3 py-2 font-dm text-xs leading-relaxed" style={{ background:"rgba(245,158,11,.08)", borderColor:"rgba(245,158,11,.26)", color:T.amb }}>
            {animationWarning}
          </div>
        )}
      </div>

      {!direction ? (
        <div className="rounded-lg border border-dashed p-4" style={{ background:T.s2, borderColor:T.b2 }}>
          <Palette size={16} className="mb-3 text-acc" aria-hidden="true" />
          <p className="font-dm text-sm" style={{ color:T.t2 }}>No design direction has been generated yet.</p>
        </div>
      ) : viewMode === "edit" ? (
        <label className="block font-dm text-sm">
          <span className="mb-2 block text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>Editable design direction JSON</span>
          <textarea
            rows={18}
            value={editorValue}
            onChange={(event) => setEditorValue(event.target.value)}
            className="font-mono text-xs"
            spellCheck={false}
          />
        </label>
      ) : (
        <div className="space-y-5">
          <div className="rounded-lg border p-4" style={{ background:T.s2, borderColor:T.b1 }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-syne text-base font-bold">{direction.designStyleName}</div>
                <div className="mt-1 font-dm text-xs" style={{ color:T.t2 }}>{direction.selectedStylePack}{direction.hybridWith.length ? ` / ${direction.hybridWith.join(", ")}` : ""}</div>
                <div className="mt-1 font-dm text-xs" style={{ color:T.t2 }}>Animation: {direction.selectedAnimationPack}</div>
              </div>
              <span className="rounded px-2 py-1 font-dm text-[10px] font-semibold uppercase tracking-[.05em]" style={{ background:T.s3, border:`1px solid ${T.b2}`, color:T.acc }}>
                Style pack
              </span>
            </div>
            <p className="mt-3 font-dm text-sm leading-relaxed" style={{ color:T.t1 }}>{direction.stylePackRationale}</p>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <MiniField label="Mood" value={direction.mood} />
            <MiniField label="Typography" value={direction.typographyDirection} />
            <MiniField label="Spacing rhythm" value={direction.spacingRhythm} />
            <MiniField label="Colour usage" value={direction.colourUsage} />
            <MiniField label="Component style" value={direction.componentStyle} />
            <MiniField label="Animation style" value={direction.animationStyle} />
            <MiniField label="Image treatment" value={direction.imageTreatment} />
            <MiniField label="Over-animation warning" value={direction.overAnimationWarning} tone="warn" />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <ListBlock title="Premium interaction ideas" rows={direction.premiumInteractionIdeas} />
            <ListBlock title="Sections that should use motion" rows={direction.motionSections} />
            <ListBlock title="Sections that should stay static" rows={direction.staticSections} />
            <ListBlock title="Mobile UX notes" rows={direction.mobileUxNotes} />
          </div>
        </div>
      )}
    </section>
  )
}

function MiniField({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "warn" }) {
  return (
    <div className="rounded-lg border p-3" style={{ background:tone === "warn" ? "rgba(245,158,11,.08)" : T.s3, borderColor:tone === "warn" ? "rgba(245,158,11,.26)" : T.b1 }}>
      <div className="font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>{label}</div>
      <p className="mt-1 whitespace-pre-wrap font-dm text-xs leading-relaxed" style={{ color:tone === "warn" ? T.amb : T.t1 }}>{value}</p>
    </div>
  )
}

function ListBlock({ title, rows }: { title: string; rows: string[] }) {
  return (
    <div className="rounded-lg border p-3" style={{ background:T.s3, borderColor:T.b1 }}>
      <div className="font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>{title}</div>
      <ul className="mt-2 space-y-1 font-dm text-xs leading-relaxed" style={{ color:T.t2 }}>
        {rows.map((row) => <li key={row}>{row}</li>)}
      </ul>
    </div>
  )
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "No date"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "No date"
  return date.toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" })
}
