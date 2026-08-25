import "server-only"
import { createHash, randomUUID } from "node:crypto"
import { and, desc, eq, sql } from "drizzle-orm"
import { Resend } from "resend"
import { db } from "@/lib/db"
import { buildInvoiceEmail, validInvoiceRecipient, type InvoiceDeliveryKind } from "@/lib/invoice-delivery"
import { InvoiceDomainError } from "@/lib/invoices"
import { clients, invoiceAuditLogs, invoiceDeliveryAttempts, invoicePortalAccessEvents, invoices } from "@/lib/schema"
import { captureMonitoringMessage } from "@/lib/server/monitoring"
import { loadInvoiceDocument } from "./invoice-documents"
import { invoicePdfFilename } from "./invoice-pdf"

export interface InvoiceMailTransport { send(input:{from:string;to:string;subject:string;html:string;text:string;attachment:{filename:string;content:Buffer};idempotencyKey:string}):Promise<{id:string}> }

export async function publishInvoiceToPortal(invoiceId:number,actorUserId:string){
  return db.transaction(async tx=>{
    const [row]=await tx.select({id:invoices.id,status:invoices.status,invoiceNumber:invoices.invoiceNumber,portalPublishedAt:invoices.portalPublishedAt,portalClientId:clients.portalClientId}).from(invoices).innerJoin(clients,eq(invoices.clientId,clients.id)).where(eq(invoices.id,invoiceId)).limit(1)
    if(!row)throw new InvoiceDomainError("Invoice not found.",404,"not_found")
    if(row.status==="draft"||!row.invoiceNumber)throw new InvoiceDomainError("Only issued invoices can be published.",409,"invoice_not_issued")
    if(!row.portalClientId)throw new InvoiceDomainError("Link this client to a portal account before publishing.",409,"portal_client_required")
    const account=await tx.execute(sql`select 1 from portal_client_accounts where client_id=${row.portalClientId} and active=true limit 1`)
    if(!account.rows.length)throw new InvoiceDomainError("No active portal account matches this client.",409,"portal_account_required")
    if(row.portalPublishedAt)return (await tx.select().from(invoices).where(eq(invoices.id,invoiceId)).limit(1))[0]
    const now=new Date();const [published]=await tx.update(invoices).set({portalPublishedAt:now,portalPublishedBy:actorUserId,updatedAt:now}).where(and(eq(invoices.id,invoiceId),sql`${invoices.portalPublishedAt} is null`)).returning()
    if(!published)return (await tx.select().from(invoices).where(eq(invoices.id,invoiceId)).limit(1))[0]
    await tx.insert(invoiceAuditLogs).values({invoiceId,actorUserId,action:"invoice_portal_published",metadataJson:{portalClientId:row.portalClientId}})
    return published
  })
}

export async function sendInvoiceDelivery(input:{invoiceId:number;kind:InvoiceDeliveryKind;recipient?:unknown;operationKey?:unknown;actorUserId:string},transport:InvoiceMailTransport=productionTransport()){
  const [invoice]=await db.select().from(invoices).where(eq(invoices.id,input.invoiceId)).limit(1)
  if(!invoice)throw new InvoiceDomainError("Invoice not found.",404,"not_found")
  if(invoice.status==="draft"||!invoice.invoiceNumber)throw new InvoiceDomainError("Only issued invoices can be emailed.",409,"invoice_not_issued")
  if(input.kind==="reminder"&&invoice.status!=="issued")throw new InvoiceDomainError("Payment reminders are only available for outstanding issued invoices.",409,"reminder_not_allowed")
  const recipient=validInvoiceRecipient(input.recipient??invoice.billingEmailSnapshot)
  if(!recipient)throw new InvoiceDomainError("Enter a valid invoice recipient email address.",400,"recipient_required")
  const operationKey=typeof input.operationKey==="string"&&input.operationKey.trim()?input.operationKey.trim():randomUUID()
  const [attempt]=await db.insert(invoiceDeliveryAttempts).values({invoiceId:invoice.id,deliveryType:input.kind,state:"pending",recipient,subject:"Preparing invoice email",operationKey,initiatedBy:input.actorUserId}).onConflictDoNothing({target:invoiceDeliveryAttempts.operationKey}).returning()
  if(!attempt)return (await db.select().from(invoiceDeliveryAttempts).where(eq(invoiceDeliveryAttempts.operationKey,operationKey)).limit(1))[0]
  try{
    const document=await loadInvoiceDocument(invoice.id);const pdf=invoice.documentPdf?Buffer.from(invoice.documentPdf):null;if(!pdf)throw new InvoiceDomainError("The immutable issued PDF is unavailable.",409,"document_pdf_missing");const hash=createHash("sha256").update(pdf).digest("hex")
    const base=(process.env.CLIENT_PORTAL_URL??process.env.NEXT_PUBLIC_SITE_URL)?.trim().replace(/\/$/,"");const portalUrl=invoice.portalPublishedAt&&base?base+"/portal":null
    const content=buildInvoiceEmail(document,input.kind,portalUrl)
    await db.update(invoiceDeliveryAttempts).set({subject:content.subject,documentSha256:hash}).where(eq(invoiceDeliveryAttempts.id,attempt.id))
    const result=await transport.send({from:requiredFrom(),to:recipient,subject:content.subject,html:content.html,text:content.text,attachment:{filename:invoicePdfFilename(document),content:pdf},idempotencyKey:"invoice-delivery-"+attempt.id})
    const now=new Date();const [sent]=await db.update(invoiceDeliveryAttempts).set({state:"sent",providerMessageId:result.id,sentAt:now,failureCategory:null,failureMessage:null}).where(eq(invoiceDeliveryAttempts.id,attempt.id)).returning()
    await db.insert(invoiceAuditLogs).values({invoiceId:invoice.id,actorUserId:input.actorUserId,action:input.kind==="reminder"?"invoice_reminder_sent":"invoice_email_sent",metadataJson:{deliveryAttemptId:attempt.id,recipient,documentSha256:hash}})
    return sent
  }catch(error){
    const now=new Date();const category=error instanceof InvoiceDomainError?error.code:"provider_delivery";const [failed]=await db.update(invoiceDeliveryAttempts).set({state:"failed",failedAt:now,failureCategory:category,failureMessage:"The email provider did not accept this send. Retry is available."}).where(eq(invoiceDeliveryAttempts.id,attempt.id)).returning()
    await db.insert(invoiceAuditLogs).values({invoiceId:invoice.id,actorUserId:input.actorUserId,action:input.kind==="reminder"?"invoice_reminder_failed":"invoice_email_failed",metadataJson:{deliveryAttemptId:attempt.id,recipient,failureCategory:category}})
    captureMonitoringMessage("Invoice email delivery failed", "error", { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber ?? undefined, deliveryKind: input.kind, failureCategory: category, errorCategory: "invoice_email_delivery" })
    return failed
  }
}
export async function listInvoiceDeliveryHistory(invoiceId:number){return db.select().from(invoiceDeliveryAttempts).where(eq(invoiceDeliveryAttempts.invoiceId,invoiceId)).orderBy(desc(invoiceDeliveryAttempts.createdAt))}
export async function listInvoicePortalAccess(invoiceId:number){return db.select().from(invoicePortalAccessEvents).where(eq(invoicePortalAccessEvents.invoiceId,invoiceId)).orderBy(desc(invoicePortalAccessEvents.createdAt))}
function requiredFrom(){const value=process.env.RESEND_FROM?.trim();if(!value)throw new InvoiceDomainError("Invoice email sender is not configured.",503,"email_configuration");return value}
function productionTransport():InvoiceMailTransport{return{async send(input){const key=process.env.RESEND_API_KEY?.trim();if(!key)throw new InvoiceDomainError("Invoice email is not configured.",503,"email_configuration");const result=await new Resend(key).emails.send({from:input.from,to:input.to,subject:input.subject,html:input.html,text:input.text,attachments:[{filename:input.attachment.filename,content:input.attachment.content}]},{idempotencyKey:input.idempotencyKey});if(result.error||!result.data?.id)throw new Error("provider_rejected");return{id:result.data.id}}}}
