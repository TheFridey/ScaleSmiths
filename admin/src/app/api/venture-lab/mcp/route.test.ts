import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

describe("Venture Lab MCP transport route", () => {
  const source = readFileSync(new URL("./route.ts", import.meta.url), "utf8")

  it("acknowledges JSON-RPC notifications without returning an RPC response", () => {
    expect(source).toContain('Object.prototype.hasOwnProperty.call(body, "id")')
    expect(source).toContain("if (!hasId)")
    expect(source).toContain("new NextResponse(null, { status: 202 })")
  })

  it("keeps standalone SSE GET disabled while allowing POST transport", () => {
    expect(source).toContain("export async function GET()")
    expect(source).toContain('headers: { Allow: "POST" }')
  })
})
