import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

describe("Venture Lab MCP authentication transport", () => {
  const source = readFileSync(new URL("./venture-lab-mcp.ts", import.meta.url), "utf8")

  it("accepts the standard Bearer token and the dedicated Cloud MCP header", () => {
    expect(source).toContain('headers.get("authorization")')
    expect(source).toContain('headers.get("x-scalesmiths-venture-token")')
    expect(source).toContain("const token = bearerToken || directToken")
  })

  it("continues to compare the selected credential in constant time", () => {
    expect(source).toContain("constantTimeTextEqual(token, expected)")
  })
})
