import { NextResponse } from 'next/server'
import { attemptAcademyCheck, completeAcademyLesson, getAcademy, getAcademyCourse, recordAcademyView } from '@/lib/server/empower-academy'
import { expansionBody, expansionFailure, expansionHeaders } from '@/lib/server/expansion-http'
import { requireCapability } from '@/lib/server/rbac'
import { checkDurableRateLimit } from '@/lib/server/rate-limit-store'
export const dynamic = 'force-dynamic'
/** Partner Academy (Operation Empower B1.2). 404 unless PARTNER_ACADEMY_ENABLED=true; every read is scoped to the signed-in partner. */
export async function GET(request: Request) {
  try {
    const slug = new URL(request.url).searchParams.get('course')
    return NextResponse.json(slug ? await getAcademyCourse({ slug }) : await getAcademy(), { headers: expansionHeaders })
  } catch (error) { return expansionFailure(error) }
}
export async function POST(request: Request) {
  try {
    const actor = await requireCapability('expansion.partner')
    const limit = await checkDurableRateLimit(`empower:academy:${actor.id}`, 120, 60000)
    if (!limit.ok) return NextResponse.json({ error: 'Please wait a moment before trying again.' }, { status: 429, headers: expansionHeaders })
    const input = await expansionBody(request)
    const commands: Record<string, (value: never) => Promise<unknown>> = { complete_lesson: completeAcademyLesson, record_view: recordAcademyView, attempt_check: attemptAcademyCheck }
    const command = Object.hasOwn(commands, String(input.action)) ? commands[String(input.action)] : undefined
    if (!command) return NextResponse.json({ error: 'Unknown Academy action.' }, { status: 400, headers: expansionHeaders })
    return NextResponse.json({ result: await command(input as never) }, { headers: expansionHeaders })
  } catch (error) { return expansionFailure(error) }
}
