import { NextResponse } from 'next/server'
import { partnerSnapshot, partnerMutation } from '@/lib/server/expansion'
import { getPartnerFinance } from '@/lib/server/expansion-finance'
import { expansionBody, expansionFailure, expansionHeaders } from '@/lib/server/expansion-http'
import { requireCapability } from '@/lib/server/rbac'
import { checkDurableRateLimit } from '@/lib/server/rate-limit-store'
export const dynamic = 'force-dynamic'
export async function GET() {
  try { const [workspace,finance] = await Promise.all([partnerSnapshot(),getPartnerFinance()]); return NextResponse.json({workspace,finance},{headers:expansionHeaders}) } catch(error) { return expansionFailure(error) }
}
export async function POST(request: Request) {
  try {
    const actor = await requireCapability('expansion.partner')
    const limit = await checkDurableRateLimit(`expansion:partner:${actor.id}`,60,60000)
    if (!limit.ok) return NextResponse.json({error:'Please wait before making another change.'},{status:429,headers:expansionHeaders})
    return NextResponse.json({result:await partnerMutation(await expansionBody(request))},{headers:expansionHeaders})
  } catch(error) { return expansionFailure(error) }
}
