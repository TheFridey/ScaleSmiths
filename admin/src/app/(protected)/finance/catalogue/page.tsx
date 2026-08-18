import type { Metadata } from "next"
import { CatalogueManager } from "@/components/finance/CatalogueManager"
import { hasCapability } from "@/lib/rbac"
import { listInvoiceCatalogue } from "@/lib/server/invoices"
import { guardPageCapability } from "@/lib/server/rbac"
export const metadata: Metadata = { title: "Invoice catalogue" }; export const dynamic = "force-dynamic"
export default async function CataloguePage() { const actor = await guardPageCapability("finance.read"); return <CatalogueManager initialItems={await listInvoiceCatalogue()} canWrite={hasCapability(actor.role, "finance.write")} /> }
