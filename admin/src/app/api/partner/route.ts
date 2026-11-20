import { NextResponse } from 'next/server'
import { partnerSnapshot, partnerMutation } from '@/lib/server/expansion'
import { getMeetings, getToolkit, requestMeeting, respondToMeeting } from '@/lib/server/expansion-operations'
import { createReferralCode, getProgrammeOverview } from '@/lib/server/expansion-programme'
import { getPartnerRecognition } from '@/lib/server/expansion-recognition'
import { getPartnerProfile, recordProfileConsent, saveProfileDraft, submitProfile, withdrawProfileConsent } from '@/lib/server/expansion-profiles'
import { cancelWithdrawal, getPartnerFinance, getWithdrawalOverview, requestWithdrawal } from '@/lib/server/expansion-finance'
import { expansionBody, expansionFailure, expansionHeaders } from '@/lib/server/expansion-http'
import { requireCapability } from '@/lib/server/rbac'
import { checkDurableRateLimit } from '@/lib/server/rate-limit-store'
export const dynamic = 'force-dynamic'
export async function GET() {
  try { const [workspace,finance,withdrawals,programme,toolkit,meetings,recognition,profile] = await Promise.all([partnerSnapshot(),getPartnerFinance(),getWithdrawalOverview(),getProgrammeOverview(),getToolkit(),getMeetings('partner'),getPartnerRecognition(),getPartnerProfile()]); return NextResponse.json({workspace,finance,withdrawals,programme,toolkit,meetings,recognition,profile},{headers:expansionHeaders}) } catch(error) { return expansionFailure(error) }
}
export async function POST(request: Request) {
  try {
    const actor = await requireCapability('expansion.partner')
    const limit = await checkDurableRateLimit(`expansion:partner:${actor.id}`,60,60000)
    if (!limit.ok) return NextResponse.json({error:'Please wait before making another change.'},{status:429,headers:expansionHeaders})
    const input = await expansionBody(request)
    const commands: Record<string,(value: never)=>Promise<unknown>> = { request_withdrawal:requestWithdrawal, cancel_withdrawal:cancelWithdrawal, create_referral_code:createReferralCode, request_meeting:requestMeeting, respond_meeting:respondToMeeting, save_profile_draft:saveProfileDraft, record_profile_consent:recordProfileConsent, submit_profile:submitProfile, withdraw_profile_consent:withdrawProfileConsent }
    const command = Object.hasOwn(commands,String(input.action)) ? commands[String(input.action)] : undefined
    return NextResponse.json({result:command ? await command(input as never) : await partnerMutation(input)},{headers:expansionHeaders})
  } catch(error) { return expansionFailure(error) }
}
