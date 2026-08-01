"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

export type WorkspaceView = "overview" | "build" | "preview" | "attention" | "advanced"
export type ProductionStage = "brief" | "research" | "site-plan" | "copy" | "design" | "components" | "build" | "seo" | "quality" | "preview" | "client-review" | "launch"
export type QaPane = "critique" | "checks" | "visual" | "cost"
export type LaunchPane = "proposal" | "estimate" | "export" | "deploy"
export type RecordsPane = "tasks" | "activity" | "usage" | "memory" | "integrations" | "artifacts" | "technical" | "settings" | "details"

export interface WorkspaceStage {
  key: ProductionStage
  label: string
  status: "approved" | "needs_review" | "failed" | "running" | "complete" | "pending" | "skipped"
  detail: string
  tab: "command" | "intake" | "strategy" | "build" | "qa" | "launch" | "records"
}

export function useForgeWorkspaceNavigation(stages: WorkspaceStage[], currentStep: WorkspaceStage) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const requestedView = parseWorkspaceView(searchParams.get("view"))
  const requestedStage = parseProductionStage(searchParams.get("stage"))
  const [activeView, setActiveView] = useState<WorkspaceView>(requestedView ?? "overview")
  const [activeStage, setActiveStage] = useState<ProductionStage>(requestedStage ?? "brief")
  const [qaPane, setQaPane] = useState<QaPane>("critique")
  const [launchPane, setLaunchPane] = useState<LaunchPane>("proposal")
  const [recordsPane, setRecordsPane] = useState<RecordsPane>("tasks")
  const [workflowOpen, setWorkflowOpen] = useState(false)

  useEffect(() => {
    if (!requestedView && !requestedStage) {
      const current = stages.find((stage) => stage.label === currentStep.label)
      if (current) setActiveStage(current.key)
    }
  }, [currentStep.label, requestedStage, requestedView, stages])

  useEffect(() => {
    if (requestedView) setActiveView(requestedView)
    if (requestedStage) {
      setActiveStage(requestedStage)
      setStagePane(requestedStage, { setQaPane, setLaunchPane })
    }
  }, [requestedStage, requestedView])

  useEffect(() => {
    const item = searchParams.get("item")
    if (activeView !== "attention" || !item) return
    window.requestAnimationFrame(() => document.getElementById(item)?.focus({ preventScroll: false }))
  }, [activeView, searchParams])

  function navigate(view: WorkspaceView, stage?: ProductionStage, extra?: Record<string, string | null>) {
    setActiveView(view)
    if (stage) setActiveStage(stage)
    const params = new URLSearchParams(searchParams.toString())
    params.set("view", view)
    if (stage) params.set("stage", stage)
    else if (view !== "build") params.delete("stage")
    for (const [key, value] of Object.entries(extra ?? {})) {
      if (value === null) params.delete(key)
      else params.set(key, value)
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  function selectStage(stage: WorkspaceStage) {
    setStagePane(stage.key, { setQaPane, setLaunchPane })
    navigate(stage.key === "preview" || stage.key === "client-review" ? "preview" : "build", stage.key)
    setWorkflowOpen(false)
  }

  return { activeView, activeStage, qaPane, setQaPane, launchPane, setLaunchPane, recordsPane, setRecordsPane, workflowOpen, setWorkflowOpen, navigate, selectStage }
}

function parseWorkspaceView(value: string | null): WorkspaceView | null {
  return value && ["overview", "build", "preview", "attention", "advanced"].includes(value) ? value as WorkspaceView : null
}

function parseProductionStage(value: string | null): ProductionStage | null {
  return value && ["brief", "research", "site-plan", "copy", "design", "components", "build", "seo", "quality", "preview", "client-review", "launch"].includes(value) ? value as ProductionStage : null
}

function setStagePane(stage: ProductionStage, setters: { setQaPane: (value: QaPane) => void; setLaunchPane: (value: LaunchPane) => void }) {
  if (stage === "quality") setters.setQaPane("checks")
  if (stage === "launch") setters.setLaunchPane("deploy")
}
