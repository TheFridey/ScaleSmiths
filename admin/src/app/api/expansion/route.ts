import { NextResponse } from 'next/server'
import { founderSnapshot, founderMutation } from '@/lib/server/expansion'
import * as finance from '@/lib/server/expansion-finance'
import { expansionBody, expansionFailure, expansionHeaders } from '@/lib/server/expansion-http'
import { requireCapability } from '@/lib/server/rbac'
import { checkDurableRateLimit } from '@/lib/server/rate-limit-store'
export const dynamic = 'force-dynamic'
export async function GET() {
  try { const [workspace,financial] = await Promise.all([founderSnapshot(),finance.getExpansionFinance()]); return NextResponse.json({workspace,finance:financial},{headers:expansionHeaders}) } catch(error) { return expansionFailure(error) }
}
export async function POST(request: Request) {
  try {
    const actor = await requireCapability('expansion.manage')
    const limit = await checkDurableRateLimit(`expansion:founder:${actor.id}`,120,60000)
    if (!limit.ok) return NextResponse.json({error:'Please wait before making another change.'},{status:429,headers:expansionHeaders})
    const input = await expansionBody(request)
    const commands: Record<string,(value: never)=>Promise<unknown>> = {
      allocate_invoice:finance.allocateExpansionInvoice, verify_payment:finance.verifyExpansionPayment, refund_payment:finance.refundExpansionPayment,
      prepare_payout:finance.prepareExpansionPayout, approve_payout:finance.approveExpansionPayout, settle_payout:finance.settleExpansionPayout,
      cancel_payout:finance.cancelExpansionPayout,
      retain_refund_entitlement:finance.retainRefundEntitlement,
    }
    const command = Object.hasOwn(commands,String(input.action)) ? commands[String(input.action)] : undefined
    const result = command ? await command(input as never) : await founderMutation(input)
    return NextResponse.json({result},{headers:expansionHeaders})
  } catch(error) { return expansionFailure(error) }
}
