import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const projectProjection = readFileSync(new URL("./portal-projects.ts", import.meta.url), "utf8")
const timelineRoute = readFileSync(new URL("../app/portal/api/timeline/route.ts", import.meta.url), "utf8")
const portalAuth = readFileSync(new URL("./portal-auth.ts", import.meta.url), "utf8")
const portalRoot = new URL("../app/portal", import.meta.url)

describe("client portal has zero Forge visibility or control", () => {
  it("contains no Forge route or API implementation", () => {
    const files = walk(fileURLToPath(portalRoot))
    expect(files.some((file) => /[\\/]forge(?:[\\/]|\.)/i.test(file))).toBe(false)
    const source = files.filter((file) => /\.(?:ts|tsx)$/.test(file)).map((file) => readFileSync(file, "utf8")).join("\n")
    expect(source).not.toMatch(/\/api\/forge|href=["'`]\/forge|deliveryForgeIntegrations|forgeRuns|forgeArtifacts|forgeAiUsage|forgeAiBudget/i)
  })
  it("projects delivery tables only and serialises no internal identifiers or AI metadata", () => {
    for (const forbidden of ["forgeProjectId", "latestRunId", "deploymentCandidateId", "internalReleaseId", "provider", "model", "prompt", "token", "cost", "budget", "workspace", "artifact"]) expect(projectProjection).not.toContain(forbidden)
    expect(projectProjection).toContain("portalDeliveryProjects.clientStatus")
    expect(projectProjection).toContain("portalDeliveryProjects.clientStagingVisible")
  })
  it("returns only client-visible timeline rows for the authenticated portal client", () => {
    expect(timelineRoute).toContain("getClientSessionFromRequest(request)")
    expect(timelineRoute).toContain("eq(clientTimelineEvents.clientId, session.clientId)")
    expect(timelineRoute).toContain('eq(clientTimelineEvents.visibility, "client_visible")')
  })
  it("uses a portal-only cookie and secret rather than an admin identity", () => {
    expect(portalAuth).toContain('PORTAL_SESSION_COOKIE = "ss-client-session"')
    expect(portalAuth).toContain("PORTAL_SECRET")
    expect(portalAuth).not.toMatch(/AUTH_SECRET|next-auth|AdminRole|forge\./)
  })
})

function walk(root: string): string[] { return readdirSync(root, { withFileTypes: true }).flatMap((entry) => { const path = join(root, entry.name); return entry.isDirectory() ? walk(path) : [path] }) }
