import { readFile } from "node:fs/promises"
import path from "node:path"
import { describe, expect, it } from "vitest"

describe("admin shell focus API policy", () => {
  it("exposes explicit focus actions without selector-driven coupling", async () => {
    const context = await readFile(path.resolve(__dirname, "AdminShellContext.tsx"), "utf8")
    const forgeDetail = await readFile(path.resolve(__dirname, "../forge/ForgeProjectDetail.tsx"), "utf8")
    const forgeDashboard = await readFile(path.resolve(__dirname, "../forge/ForgeDashboard.tsx"), "utf8")
    expect(context).toContain("enterFocusMode")
    expect(context).toContain("exitFocusMode")
    expect(context).toContain("toggleFocusMode")
    expect(context).toContain("window.localStorage")
    expect(`${forgeDetail}\n${forgeDashboard}`).not.toContain("document.querySelector")
    expect(`${forgeDetail}\n${forgeDashboard}`).not.toContain("admin-focus-toggle")
  })
})
