import type { Metadata } from "next"
import { InvoiceSettingsForm } from "@/components/finance/InvoiceSettingsForm"
import { hasCapability } from "@/lib/rbac"
import { loadInvoiceSupplierIdentity } from "@/lib/server/invoice-supplier-settings"
import { guardPageCapability } from "@/lib/server/rbac"
export const metadata: Metadata = { title: "Invoice settings" }; export const dynamic = "force-dynamic"
export default async function InvoiceSettingsPage() { const actor = await guardPageCapability("finance.read"); return <InvoiceSettingsForm initialSettings={await loadInvoiceSupplierIdentity()} canWrite={hasCapability(actor.role, "finance.write")} /> }
