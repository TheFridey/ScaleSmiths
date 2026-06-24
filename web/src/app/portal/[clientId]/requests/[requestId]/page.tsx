import Link from "next/link"
import { notFound } from "next/navigation"
import { and, asc, eq } from "drizzle-orm"
import { ArrowLeft } from "lucide-react"
import { PortalNav } from "@/components/portal/PortalNav"
import { PortalRequestThread } from "@/components/portal/PortalRequestThread"
import { PortalTimeline } from "@/components/portal/PortalTimeline"
import {
  serializeClientPortalMessage,
  serializeClientPortalRequest,
} from "@/lib/client-requests"
import { serializeClientPortalTimelineEvent } from "@/lib/client-timeline"
import { db } from "@/lib/db"
import { requireClientPortalAccess } from "@/lib/portal-session"
import { clientRequestMessages, clientRequests, clientTimelineEvents } from "@/lib/schema"

interface PortalRequestPageProps {
  params: Promise<{ clientId: string; requestId: string }>
}

const SAFE_PLACEHOLDER_CLIENT = {
  tier: null,
  price: "Active",
}

export default async function PortalRequestPage({ params }: PortalRequestPageProps) {
  const { clientId, requestId } = await params
  const session = await requireClientPortalAccess(clientId)
  const id = Number(requestId)

  if (!Number.isInteger(id) || id <= 0) {
    notFound()
  }

  const [row] = await db
    .select({
      id: clientRequests.id,
      title: clientRequests.title,
      description: clientRequests.description,
      category: clientRequests.category,
      priority: clientRequests.priority,
      status: clientRequests.status,
      affectedUrl: clientRequests.affectedUrl,
      createdAt: clientRequests.createdAt,
      updatedAt: clientRequests.updatedAt,
    })
    .from(clientRequests)
    .where(and(
      eq(clientRequests.id, id),
      eq(clientRequests.clientId, session.clientId),
    ))
    .limit(1)

  if (!row) {
    notFound()
  }

  const messages = await db
    .select({
      id: clientRequestMessages.id,
      requestId: clientRequestMessages.requestId,
      senderType: clientRequestMessages.senderType,
      senderName: clientRequestMessages.senderName,
      body: clientRequestMessages.body,
      visibility: clientRequestMessages.visibility,
      createdAt: clientRequestMessages.createdAt,
      updatedAt: clientRequestMessages.updatedAt,
    })
    .from(clientRequestMessages)
    .where(and(
      eq(clientRequestMessages.requestId, row.id),
      eq(clientRequestMessages.visibility, "client_visible"),
    ))
    .orderBy(asc(clientRequestMessages.createdAt), asc(clientRequestMessages.id))

  const timeline = await db
    .select({
      id: clientTimelineEvents.id,
      clientId: clientTimelineEvents.clientId,
      requestId: clientTimelineEvents.requestId,
      projectId: clientTimelineEvents.projectId,
      type: clientTimelineEvents.type,
      title: clientTimelineEvents.title,
      description: clientTimelineEvents.description,
      visibility: clientTimelineEvents.visibility,
      createdBy: clientTimelineEvents.createdBy,
      createdAt: clientTimelineEvents.createdAt,
    })
    .from(clientTimelineEvents)
    .where(and(
      eq(clientTimelineEvents.requestId, row.id),
      eq(clientTimelineEvents.visibility, "client_visible"),
    ))
    .orderBy(asc(clientTimelineEvents.createdAt), asc(clientTimelineEvents.id))

  const request = serializeClientPortalRequest(row)
  const visibleMessages = messages.map(serializeClientPortalMessage).filter((message) => message !== null)
  const visibleTimeline = timeline.map(serializeClientPortalTimelineEvent).filter((event) => event !== null)
  const websiteName = deriveWebsiteName(session.clientId)

  return (
    <div className="flex min-h-screen flex-col bg-bg text-t1 md:flex-row">
      <PortalNav
        clientId={session.clientId}
        clientName={websiteName}
        tier={SAFE_PLACEHOLDER_CLIENT.tier ?? "Plan pending"}
        price={SAFE_PLACEHOLDER_CLIENT.price}
      />

      <main className="flex-1 px-5 py-6 md:px-8 md:py-8">
        <Link href={`/portal/${session.clientId}?tab=requests`} className="mb-5 inline-flex items-center gap-2 font-dm text-sm text-t2 transition-colors hover:text-t1">
          <ArrowLeft size={15} aria-hidden="true" />
          Back to requests
        </Link>
        <div className="mb-6">
          <span className="font-dm text-xs font-semibold uppercase tracking-[0.14em] text-acc">Request #{request.id}</span>
          <h1 className="mt-2 max-w-[900px] break-words font-syne text-[clamp(30px,4.5vw,44px)] font-extrabold tracking-[-0.03em]">{request.title}</h1>
          <p className="mt-3 max-w-[820px] whitespace-pre-wrap font-dm text-sm leading-relaxed text-t2">{request.description}</p>
        </div>
        <div className="grid gap-4">
          <PortalRequestThread request={request} initialMessages={visibleMessages} />
          <section className="rounded-2xl border border-b1 bg-s1 p-5">
            <h2 className="font-syne text-xl font-bold">Request timeline</h2>
            <p className="mt-1 font-dm text-sm text-t2">Status and published updates for this request.</p>
            <div className="mt-5">
              <PortalTimeline events={visibleTimeline} emptyText="No timeline updates have been published for this request yet." />
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

function deriveWebsiteName(clientId: string) {
  const cleaned = clientId
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/.#?]/)[0]
    .replace(/[-_]+/g, " ")
    .trim()

  if (!cleaned) return "Client Workspace"
  return cleaned.replace(/\b\w/g, (letter) => letter.toUpperCase())
}
