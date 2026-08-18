import { readFileSync } from "node:fs"
import { describe,expect,it } from "vitest"
describe("portal invoice security boundary",()=>{
 const source=readFileSync(new URL("./portal-invoices.ts",import.meta.url),"utf8")
 const route=readFileSync(new URL("../app/portal/api/invoices/[invoiceNumber]/pdf/route.ts",import.meta.url),"utf8")
 it("scopes list, detail and access telemetry by the authenticated portal client mapping",()=>{expect(source.match(/eq\(invoicePortalClients\.portalClientId,portalClientId\)/g)?.length).toBeGreaterThanOrEqual(3);expect(source).toContain("isNotNull(portalInvoices.portalPublishedAt)");expect(source).toContain('ne(portalInvoices.status,"draft")')})
 it("does not expose raw unrestricted invoice records through its DTO",()=>{expect(source).toContain("PortalInvoiceDto");for(const forbidden of ["internalNotes","catalogueItemId","portalPublishedBy","audit"])expect(source).not.toContain(forbidden)})
 it("requires a portal session before resolving or downloading an invoice",()=>{expect(route).toContain("getClientSessionFromRequest");expect(route).toContain("loadPortalInvoicePdf(session.clientId");expect(route).toContain('"Cache-Control":"private, no-store"');expect(route).toContain('"Content-Type":"application/pdf"')})
})
