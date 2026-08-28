import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { PortalNav } from "@/components/portal/PortalNav"
import { PortalRequestThread } from "@/components/portal/PortalRequestThread"
import { PortalTimeline } from "@/components/portal/PortalTimeline"
import { requireClientPortalAccess } from "@/lib/portal-session"
import { loadPortalClientProfile } from "@/lib/portal-client-profile"
import { getPortalRequestThread } from "@/lib/portal-client-requests"

interface PortalRequestPageProps {
  params: Promise<{ clientId: string; requestId: string }>
}

export default async function PortalRequestPage({ params }: PortalRequestPageProps) {
  const { clientId, requestId } = await params
  const session = await requireClientPortalAccess(clientId)
  const id = Number(requestId)

  if (!Number.isInteger(id) || id <= 0) {
    notFound()
  }

  const [thread, profile] = await Promise.all([
    getPortalRequestThread(session.clientId, id),
    loadPortalClientProfile(session.clientId),
  ])

  if (!thread || !profile) {
    notFound()
  }
  const { request, messages, timeline } = thread
  return (
    <div className="flex min-h-screen flex-col bg-bg text-t1 md:flex-row">
      <PortalNav
        clientId={session.clientId}
        clientName={profile.portalName}
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
          <PortalRequestThread request={request} initialMessages={messages} />
          <section className="rounded-2xl border border-b1 bg-s1 p-5">
            <h2 className="font-syne text-xl font-bold">Request timeline</h2>
            <p className="mt-1 font-dm text-sm text-t2">Status and published updates for this request.</p>
            <div className="mt-5">
              <PortalTimeline events={timeline} emptyText="No timeline updates have been published for this request yet." />
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
