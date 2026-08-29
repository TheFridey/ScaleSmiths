import { describe, expect, it } from "vitest"
import { safeExternalUrl, safeFilename, validateDocumentMime } from "./client-documents"
describe("client document boundaries", () => {
  it("removes paths and unsafe filename characters", () => expect(safeFilename("../client/<brief>?.pdf")).toBe("-brief--.pdf"))
  it("allows known MIME types and limits size", () => expect(validateDocumentMime({ name: "brief.pdf", type: "application/pdf", size: 42 }).mime).toBe("application/pdf"))
  it("rejects active content and insecure links", () => { expect(() => validateDocumentMime({ name: "x.html", type: "text/html", size: 42 })).toThrow(); expect(() => safeExternalUrl("http://example.com")).toThrow() })
})
