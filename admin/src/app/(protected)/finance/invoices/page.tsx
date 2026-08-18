import type { Metadata } from "next"
import { InvoiceDashboard } from "@/components/finance/InvoiceDashboard"
import { hasCapability } from "@/lib/rbac"
import { listInvoicesForAdmin } from "@/lib/server/invoices"
import { guardPageCapability } from "@/lib/server/rbac"
export const metadata: Metadata = { title: "Invoices" }; export const dynamic = "force-dynamic"
export default async function InvoicesPage() { const actor = await guardPageCapability("finance.read"); return <InvoiceDashboard invoices={await listInvoicesForAdmin()} canWrite={hasCapability(actor.role, "finance.write")} /> }
