import { NextResponse } from 'next/server'
import { founderSnapshot, founderMutation } from '@/lib/server/expansion'
import * as finance from '@/lib/server/expansion-finance'
import * as programme from '@/lib/server/expansion-programme'
import * as operations from '@/lib/server/expansion-operations'
import * as research from '@/lib/server/expansion-research'
import * as recognition from '@/lib/server/expansion-recognition'
import * as profiles from '@/lib/server/expansion-profiles'
import { expansionBody, expansionFailure, expansionHeaders } from '@/lib/server/expansion-http'
import { requireCapability } from '@/lib/server/rbac'
import { checkDurableRateLimit } from '@/lib/server/rate-limit-store'
export const dynamic = 'force-dynamic'
export async function GET() {
  try { const [workspace,financial,withdrawals,programmeAdmin,toolkitAdmin,meetings,researchAdmin,recognitionAdmin,profilesAdmin] = await Promise.all([founderSnapshot(),finance.getExpansionFinance(),finance.getWithdrawalAdmin(),programme.getProgrammeAdmin(),operations.getToolkitAdmin(),operations.getMeetings('founder'),research.getResearchAdmin(),recognition.getRecognitionAdmin(),profiles.getProfilesAdmin()]); return NextResponse.json({workspace,finance:financial,withdrawals,programmeAdmin,toolkitAdmin,meetings,researchAdmin,recognitionAdmin,profilesAdmin},{headers:expansionHeaders}) } catch(error) { return expansionFailure(error) }
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
      create_programme:programme.createProgramme, approve_programme:programme.approveProgramme, decide_qualification:programme.decideQualification, revoke_qualification:programme.revokeQualification,
      review_achievement_reward:programme.reviewAchievementReward, resolve_qualification_flag:programme.resolveQualificationFlag, correct_meeting:operations.correctMeeting, attribute_referral:programme.attributeReferral, review_referral_reward:programme.reviewReferralReward,
      create_candidate:research.createCandidate, edit_candidate:research.editCandidate, check_candidate:research.checkCandidate, record_screening:research.recordScreening,
      clear_candidate_exclusivity:research.clearCandidateExclusivity, mark_candidate_eligible:research.markCandidateEligible, exclude_candidate:research.excludeCandidate,
      release_candidate_domain:research.releaseCandidateDomain, allocate_candidate:research.allocateCandidate, reassign_candidate:research.reassignCandidate, release_candidate:research.releaseCandidate,
      nominate_founding_partner:recognition.nominateFoundingPartner, add_recognition_evidence:recognition.addRecognitionEvidence, start_recognition_review:recognition.startRecognitionReview, decide_recognition:recognition.decideRecognition,
      approve_recognition_benefit:recognition.approveRecognitionBenefit, record_benefit_fulfilment:recognition.recordBenefitFulfilment, correct_recognition:recognition.correctRecognition, revoke_recognition:recognition.revokeRecognition,
      review_profile:profiles.reviewProfile, publish_profile:profiles.publishProfile, revoke_publication:profiles.revokePublication,
      set_toolkit_item:operations.setToolkitItem, decide_meeting:operations.decideMeeting,
      set_withdrawal_policy:finance.setWithdrawalPolicy, review_withdrawal:finance.reviewWithdrawal, prepare_withdrawal_payout:finance.prepareWithdrawalPayout,
    }
    const command = Object.hasOwn(commands,String(input.action)) ? commands[String(input.action)] : undefined
    const result = command ? await command(input as never) : await founderMutation(input)
    return NextResponse.json({result},{headers:expansionHeaders})
  } catch(error) { return expansionFailure(error) }
}
