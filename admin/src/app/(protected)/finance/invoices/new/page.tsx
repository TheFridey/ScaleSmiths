import type { Metadata } from "next"
import { InvoiceBuilder } from "@/components/finance/InvoiceBuilder"
import { hasCapability } from "@/lib/rbac"
import { listInvoiceCatalogue, listInvoiceClients } from "@/lib/server/invoices"
import { guardPageCapability } from "@/lib/server/rbac"
import { loadInvoiceSupplierIdentity } from "@/lib/server/invoice-supplier-settings"
export const metadata: Metadata = { title: "New invoice" }; export const dynamic = "force-dynamic"
export default async function NewInvoicePage() { const actor = await guardPageCapability("finance.read"); const [clients, catalogue, supplierSettings] = await Promise.all([listInvoiceClients(), listInvoiceCatalogue(), loadInvoiceSupplierIdentity()]); return <InvoiceBuilder clients={clients} catalogue={catalogue} supplierSettings={supplierSettings} canWrite={hasCapability(actor.role, "finance.write")} /> }
