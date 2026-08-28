import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { requireClientPortalAccess } from "@/lib/portal-session"
import { getPublishedPortalReport } from "@/lib/portal-reports"

interface PortalReportPageProps {
  params: Promise<{ clientId: string; reportId: string }>
}

export default async function PortalReportPage({ params }: PortalReportPageProps) {
  const { clientId, reportId } = await params
  const session = await requireClientPortalAccess(clientId)
  const id = Number(reportId)

  if (!Number.isInteger(id) || id <= 0) {
    notFound()
  }

  const report = await getPublishedPortalReport(session.clientId, id)

  if (!report) {
    notFound()
  }

  return (
    <main className="min-h-screen bg-bg px-4 py-5 text-t1 md:px-8">
      <div className="mx-auto mb-4 flex max-w-[1040px] items-center justify-between gap-4">
        <Link href={`/portal/${session.clientId}?tab=reports`} className="inline-flex items-center gap-2 font-dm text-sm text-t2 transition-colors hover:text-t1">
          <ArrowLeft size={15} aria-hidden="true" />
          Back to reports
        </Link>
        <div className="font-dm text-xs text-t3">{report.title}</div>
      </div>
      <iframe
        title={report.title}
        srcDoc={report.htmlContent}
        sandbox=""
        className="mx-auto h-[calc(100vh-86px)] w-full max-w-[1040px] rounded-2xl border border-b1 bg-white"
      />
    </main>
  )
}
