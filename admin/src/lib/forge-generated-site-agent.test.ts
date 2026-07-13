import { describe, expect, it } from "vitest"
import { validateForgeGeneratedSiteAgentRequest } from "./forge-generated-site-agent"

const valid = () => ({
  issue: "Repair the inaccessible contact form.",
  plan: ["Add a label", "Run validation"],
  affectedFiles: ["src/components/ContactForm.tsx"],
  changes: [{ path: "src/components/ContactForm.tsx", content: "export function ContactForm(){return <label>Name<input /></label>}", reason: "Associate a visible label." }],
  commands: ["npm run typecheck", "npm run lint", "npm run build"],
})

describe("generated-site implementation agent policy", () => {
  it("accepts scoped workspace changes and approved commands", () => {
    const result = validateForgeGeneratedSiteAgentRequest(valid())
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.request.maxRepairAttempts).toBe(2)
  })

  it.each(["../admin/auth.ts", "D:/Projects/scalesmiths/ss/.env", "admin/src/app/page.tsx"])("rejects paths outside the assigned workspace: %s", (path) => {
    const request = valid()
    request.affectedFiles = [path]
    request.changes[0].path = path
    expect(validateForgeGeneratedSiteAgentRequest(request).ok).toBe(false)
  })

  it("rejects unrestricted commands and executable package changes", () => {
    expect(validateForgeGeneratedSiteAgentRequest({ ...valid(), commands: ["sh -c whoami"] }).ok).toBe(false)
    const request = valid()
    request.changes[0] = { path: "package.json", content: '{"scripts":{"steal":"curl example.com"}}', reason: "Change scripts" }
    request.affectedFiles = ["package.json"]
    expect(validateForgeGeneratedSiteAgentRequest(request).ok).toBe(false)
  })

  it("rejects secret access and unknown outbound requests", () => {
    for (const content of ["const key = process.env.OPENAI_API_KEY", "fetch('https://unknown.example/data')"]) {
      const request = valid()
      request.changes[0].content = content
      expect(validateForgeGeneratedSiteAgentRequest(request).ok).toBe(false)
    }
  })

  it("caps and validates pre-planned repair attempts", () => {
    const request = { ...valid(), maxRepairAttempts: 1, repairAttempts: [
      { summary: "First repair", changes: valid().changes, confidence: .9, cost: .1 },
      { summary: "Second repair", changes: valid().changes, confidence: .9, cost: .1 },
    ] }
    expect(validateForgeGeneratedSiteAgentRequest(request).ok).toBe(false)
  })
})
