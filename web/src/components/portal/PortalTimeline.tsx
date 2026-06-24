import { Clock3 } from "lucide-react"
import type { ClientPortalTimelineEvent } from "@/lib/client-timeline"

interface PortalTimelineProps {
  events: Array<ClientPortalTimelineEvent & { createdAt: Date | string }>
  emptyText: string
}

export function PortalTimeline({ events, emptyText }: PortalTimelineProps) {
  return (
    <div className="space-y-3">
      {events.length === 0 ? (
        <div className="rounded-xl border border-dashed border-b2 bg-s2 p-5">
          <Clock3 size={18} className="mb-3 text-acc" aria-hidden="true" />
          <p className="font-dm text-sm leading-relaxed text-t2">{emptyText}</p>
        </div>
      ) : (
        events.map((event) => (
          <article key={event.id} className="relative rounded-xl border border-b1 bg-s2 p-4">
            <div className="mb-1 flex flex-wrap items-center gap-2 font-dm text-[11px] text-t3">
              <span>{formatDateTime(event.createdAt)}</span>
              <span>•</span>
              <span>{event.createdBy}</span>
            </div>
            <h3 className="font-dm text-sm font-semibold text-t1">{event.title}</h3>
            <p className="mt-1 whitespace-pre-wrap font-dm text-sm leading-relaxed text-t2">{event.description}</p>
          </article>
        ))
      )}
    </div>
  )
}

function formatDateTime(value: Date | string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Not set"
  return date.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}
