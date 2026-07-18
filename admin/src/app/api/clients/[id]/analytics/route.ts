import { NextRequest, NextResponse } from "next/server"
import { auth } from "../../../../../../auth"
import { guardApiCapability } from "@/lib/server/rbac"
import { ingestClientAnalytics, loadClientAnalyticsSummary, measureOptimisationProposal, saveClientAnalyticsConfig, saveGeneratedOptimisationProposal, updateOptimisationProposalStatus } from "@/lib/server/client-analytics"
import type { AnalyticsProviderId } from "@/lib/client-analytics"

export const dynamic = "force-dynamic"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  await guardApiCapability("analytics.read")
  const clientId = idOf((await params).id)
  if (!clientId) return NextResponse.json({ error: "Invalid client id." }, { status: 400 })
  return NextResponse.json(await loadClientAnalyticsSummary(clientId))
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  await guardApiCapability("analytics.write")
  const clientId = idOf((await params).id)
  if (!clientId) return NextResponse.json({ error: "Invalid client id." }, { status: 400 })
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid analytics payload." }, { status: 400 })
  const input = body as Record<string, unknown>
  if (input.action === "ingest") {
    const configId = idOf(input.configId)
    if (!configId) return NextResponse.json({ error: "Config id is required." }, { status: 400 })
    return NextResponse.json({ ok: true, ...(await ingestClientAnalytics(clientId, configId, actor(session))) })
  }
  if (input.action === "store_optimisation") {
    const key = text(input.key)
    if (!key) return NextResponse.json({ error: "Proposal key is required." }, { status: 400 })
    return NextResponse.json({ ok: true, proposal: await saveGeneratedOptimisationProposal({ clientId, key, actor: actor(session) }) }, { status: 201 })
  }
  if (input.action === "optimisation_status") {
    const proposalId = idOf(input.proposalId)
    const status = input.status === "accepted" || input.status === "rejected" || input.status === "completed" ? input.status : null
    if (!proposalId || !status) return NextResponse.json({ error: "Proposal id and valid status are required." }, { status: 400 })
    return NextResponse.json({ ok: true, proposal: await updateOptimisationProposalStatus({ clientId, proposalId, status, actor: actor(session), notes: text(input.notes) }) })
  }
  if (input.action === "optimisation_measure") {
    const proposalId = idOf(input.proposalId)
    const measuredValue = Number(input.measuredValue)
    if (!proposalId || !Number.isFinite(measuredValue)) return NextResponse.json({ error: "Proposal id and measured value are required." }, { status: 400 })
    return NextResponse.json({ ok: true, proposal: await measureOptimisationProposal({ clientId, proposalId, measuredValue, actor: actor(session), notes: text(input.notes) }) })
  }
  const provider = providerOf(input.provider)
  const displayName = text(input.displayName)
  const sourceAttribution = text(input.sourceAttribution)
  if (!provider || !displayName || !sourceAttribution) return NextResponse.json({ error: "Provider, display name and source attribution are required." }, { status: 400 })
  const config = await saveClientAnalyticsConfig({
    clientId,
    provider,
    displayName,
    propertyId: text(input.propertyId),
    consentGranted: input.consentGranted === true,
    consentNotes: text(input.consentNotes),
    retentionDays: Math.max(30, Math.min(730, Number.parseInt(String(input.retentionDays ?? 395), 10) || 395)),
    enabled: input.enabled === true,
    credentials: record(input.credentials),
    scopes: Array.isArray(input.scopes) ? input.scopes.filter((scope): scope is string => typeof scope === "string") : [],
    sourceAttribution,
    actor: actor(session),
  })
  return NextResponse.json({ ok: true, config }, { status: 201 })
}

function idOf(value: unknown) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}
function providerOf(value: unknown): AnalyticsProviderId | null {
  return value === "manual" || value === "google_search_console" || value === "google_analytics" || value === "plausible" || value === "uptime" || value === "core_web_vitals" || value === "custom" ? value : null
}
function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}
function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null
}
function actor(session: { user?: { email?: string | null; name?: string | null } } | null) {
  return session?.user?.email ?? session?.user?.name ?? "admin"
}
