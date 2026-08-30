import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/server/rbac", () => ({ guardApiCapability: vi.fn().mockResolvedValue({ id: "u1", email: "op@x.co", name: "Op" }) }))
vi.mock("@/lib/server/prospect-conversion", () => ({
  previewConversion: vi.fn().mockResolvedValue({ prospectId: 5, warnings: [], catalogue: [] }),
  executeConversion: vi.fn().mockResolvedValue({ id: 1, clientId: 42, clientAction: "created", metadataJson: {} }),
}))

import { guardApiCapability } from "@/lib/server/rbac"
import { GET, POST } from "./route"

const params = { params: Promise.resolve({ id: "5" }) }

describe("conversion route", () => {
  it("GET previews and guards leads.read", async () => {
    const res = await GET(new Request("http://x/api/prospects/5/conversion"), params)
    expect(guardApiCapability).toHaveBeenCalledWith("leads.read")
    expect(await res.json()).toMatchObject({ ok: true, plan: { prospectId: 5 } })
  })
  it("POST executes and guards prospects.convert", async () => {
    const res = await POST(new Request("http://x/api/prospects/5/conversion", { method: "POST", body: JSON.stringify({ options: {} }), headers: { "content-type": "application/json" } }), params)
    expect(guardApiCapability).toHaveBeenCalledWith("prospects.convert")
    expect(await res.json()).toMatchObject({ ok: true, conversion: { clientId: 42 } })
  })
  it("400s on a non-numeric id", async () => {
    const res = await POST(new Request("http://x", { method: "POST", body: "{}" }), { params: Promise.resolve({ id: "abc" }) })
    expect(res.status).toBe(400)
  })
})
