"use client"

import Link from "next/link"
import { ChevronLeft, ChevronRight, Code2, Monitor, MoreHorizontal, PanelLeftOpen, Settings2, ShieldCheck, Target, Workflow, type LucideIcon } from "lucide-react"
import type { ProductionStage, WorkspaceStage, WorkspaceView } from "./useForgeWorkspaceNavigation"

const WORKSPACE_VIEWS: Array<{ key: WorkspaceView; label: string; Icon: LucideIcon }> = [
  { key: "overview", label: "Overview", Icon: Target },
  { key: "build", label: "Build", Icon: Code2 },
  { key: "preview", label: "Preview", Icon: Monitor },
  { key: "attention", label: "Attention", Icon: ShieldCheck },
  { key: "advanced", label: "Advanced", Icon: Settings2 },
]

export function ForgeProjectHeader({ projectId, name, businessName, industry, currentStage, progress, cost, status, primaryAction, overflowOpen, onPrimaryAction, onOpenContext, onToggleFocus, onToggleOverflow, onOpenSettings, onExportUsage }: { projectId: number; name: string; businessName: string; industry?: string | null; currentStage: string; progress: number; cost: string; status: React.ReactNode; primaryAction: string; overflowOpen: boolean; onPrimaryAction: () => void; onOpenContext: () => void; onToggleFocus: () => void; onToggleOverflow: () => void; onOpenSettings: () => void; onExportUsage?: () => void }) {
  return <header className="project-workspace-header">
    <div className="project-header-identity"><Link href="/forge" className="admin-icon-button" aria-label="Back to Forge"><ChevronLeft size={18} aria-hidden="true" /></Link><div><p>Forge project</p><h1>{name}</h1><span>{businessName}{industry ? ` · ${industry}` : ""}</span></div></div>
    <div className="project-header-status" role="group" aria-label="Project status"><button type="button" onClick={onOpenContext} className="project-status-summary"><span><strong>{currentStage}</strong><small>Current stage</small></span>{status}</button><div className="project-header-progress"><span style={{ width: `${progress}%` }} /><small>{progress}%</small></div><span className="project-header-cost">{cost}</span></div>
    <div className="project-header-actions"><button type="button" className="forge-primary-action" onClick={onPrimaryAction}>{primaryAction}<ChevronRight size={16} aria-hidden="true" /></button><button type="button" className="forge-secondary-action project-focus-button" onClick={onToggleFocus}><PanelLeftOpen size={16} aria-hidden="true" />Focus Mode</button><div className="project-overflow"><button type="button" className="admin-icon-button" aria-label="More project actions" aria-expanded={overflowOpen} onClick={onToggleOverflow}><MoreHorizontal size={19} aria-hidden="true" /></button>{overflowOpen && <div className="project-overflow-menu"><button type="button" onClick={onOpenSettings}>Project settings</button><button type="button" onClick={onOpenContext}>Open context <kbd>Ctrl I</kbd></button><Link href={`/api/forge/ai-usage/export?projectId=${projectId}`} onClick={onExportUsage}>Export AI usage</Link></div>}</div></div>
  </header>
}

export function ForgeProjectNavigation({ activeView, attentionCount, onNavigate, onOpenWorkflow }: { activeView: WorkspaceView; attentionCount: number; onNavigate: (view: WorkspaceView) => void; onOpenWorkflow: () => void }) {
  return <nav className="project-view-nav" aria-label="Project workspace"><button type="button" className="project-stage-mobile-trigger" onClick={onOpenWorkflow}><Workflow size={16} aria-hidden="true" />Stages</button>{WORKSPACE_VIEWS.map(({ key, label, Icon }) => <button key={key} type="button" className={activeView === key ? "is-active" : ""} onClick={() => onNavigate(key)}><Icon size={16} aria-hidden="true" />{label}{key === "attention" && attentionCount > 0 ? <span>{attentionCount}</span> : null}</button>)}</nav>
}

export function ForgeStageRail({ stages, activeStage, onSelect }: { stages: WorkspaceStage[]; activeStage: ProductionStage; onSelect: (stage: WorkspaceStage) => void }) {
  return <ol className="production-stage-list">{stages.map((stage, index) => <li key={stage.key}><button type="button" className={activeStage === stage.key ? "is-active" : ""} onClick={() => onSelect(stage)} aria-current={activeStage === stage.key ? "step" : undefined}><span className={`stage-state tone-${stage.status}`} aria-hidden="true">{index + 1}</span><span><strong>{stage.label}</strong><small>{stage.status.replaceAll("_", " ")}</small></span></button></li>)}</ol>
}
