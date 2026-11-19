import { NextResponse } from 'next/server'
import { partnerSnapshot, partnerMutation } from '@/lib/server/expansion'
import { cancelWithdrawal, getPartnerFinance, getWithdrawalOverview, requestWithdrawal } from '@/lib/server/expansion-finance'
import { expansionBody, expansionFailure, expansionHeaders } from '@/lib/server/expansion-http'
import { requireCapability } from '@/lib/server/rbac'
import { checkDurableRateLimit } from '@/lib/server/rate-limit-store'
export const dynamic = 'force-dynamic'
export async function GET() {
  try { const [workspace,finance,withdrawals] = await Promise.all([partnerSnapshot(),getPartnerFinance(),getWithdrawalOverview()]); return NextResponse.json({workspace,finance,withdrawals},{headers:expansionHeaders}) } catch(error) { return expansionFailure(error) }
}
export async function POST(request: Request) {
  try {
    const actor = await requireCapability('expansion.partner')
    const limit = await checkDurableRateLimit(`expansion:partner:${actor.id}`,60,60000)
    if (!limit.ok) return NextResponse.json({error:'Please wait before making another change.'},{status:429,headers:expansionHeaders})
    const input = await expansionBody(request)
    const commands: Record<string,(value: never)=>Promise<unknown>> = { request_withdrawal:requestWithdrawal, cancel_withdrawal:cancelWithdrawal }
    const command = Object.hasOwn(commands,String(input.action)) ? commands[String(input.action)] : undefined
    return NextResponse.json({result:command ? await command(input as never) : await partnerMutation(input)},{headers:expansionHeaders})
  } catch(error) { return expansionFailure(error) }
}
