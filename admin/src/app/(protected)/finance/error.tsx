"use client"
import { InlineAlert, WorkspaceShell } from "@/components/admin-shell/primitives"
export default function FinanceError({ reset }: { error: Error; reset: () => void }) { return <WorkspaceShell><InlineAlert tone="danger"><strong>Finance could not be loaded.</strong><p className="mt-1">Try the request again. No invoice data was changed.</p><button type="button" onClick={reset} className="mt-3 rounded-lg border border-current px-3 py-1.5 text-sm">Retry</button></InlineAlert></WorkspaceShell> }
