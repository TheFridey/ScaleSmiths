import { NextResponse } from "next/server"
import { InvoiceDomainError } from "@/lib/invoices"
import { listInvoiceDeliveryHistory, listInvoicePortalAccess, publishInvoiceToPortal, sendInvoiceDelivery } from "@/lib/server/invoice-delivery"
import { guardApiCapability } from "@/lib/server/rbac"
import { checkDurableRateLimit } from "@/lib/server/rate-limit-store"

// Outbound email to an operator-supplied recipient. Idempotency keys stop an
// accidental repeat of one send; this bounds deliberate bulk sending by a
// compromised or misused finance account.
const INVOICE_DELIVERY_LIMIT = 30
const INVOICE_DELIVERY_WINDOW_MS = 60 * 60 * 1000

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){try{await guardApiCapability("finance.read");const invoiceId=id((await params).id);const [deliveries,access]=await Promise.all([listInvoiceDeliveryHistory(invoiceId),listInvoicePortalAccess(invoiceId)]);return NextResponse.json({ok:true,deliveries,access})}catch(error){return failure(error)}}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{const actor=await guardApiCapability("finance.write");const invoiceId=id((await params).id);const body=await request.json().catch(()=>({}));if(body.action==="publish")return NextResponse.json({ok:true,invoice:await publishInvoiceToPortal(invoiceId,actor.id)});if(body.action==="send_invoice"||body.action==="send_reminder"){const throttle=await checkDurableRateLimit(`invoice-delivery:${actor.id}`,INVOICE_DELIVERY_LIMIT,INVOICE_DELIVERY_WINDOW_MS);if(!throttle.ok)return NextResponse.json({error:"Too many invoice deliveries. Please wait before sending more."},{status:429,headers:{"Retry-After":String(Math.max(1,Math.ceil(throttle.retryAfterMs/1000)))}});const delivery=await sendInvoiceDelivery({invoiceId,kind:body.action==="send_reminder"?"reminder":"invoice",recipient:body.recipient,operationKey:body.operationKey,actorUserId:actor.id});return NextResponse.json({ok:delivery.state==="sent",delivery,error:delivery.state==="failed"?delivery.failureMessage:undefined},{status:delivery.state==="sent"?200:502})}throw new InvoiceDomainError("Invoice delivery action is invalid.")}catch(error){return failure(error)}}
function id(value:string){const parsed=Number(value);if(!Number.isSafeInteger(parsed)||parsed<1)throw new InvoiceDomainError("Invoice id is invalid.");return parsed}
function failure(error:unknown){return error instanceof InvoiceDomainError?NextResponse.json({error:error.safeMessage,code:error.code},{status:error.status}):NextResponse.json({error:"Unable to complete invoice delivery."},{status:500})}
