import type { Qualification } from "@/lib/partner-qualification"
import "./qualification.css"

/** Operation Ascend B2.2: the readiness checklist. Every factor shows whether it is met, why it matters and what would meet it. */
export function QualificationChecklist({ q, headingId, onEscalate }: { q: Qualification; headingId: string; onEscalate?: (route: string) => void }) {
  return <div className="qa">
    <p className="qa-count"><strong>{q.met} of {q.total}</strong> readiness factors recorded</p>
    <p className="qa-notice">{q.notice}</p>
    <ul className="qa-factors" aria-labelledby={headingId}>
      {q.factors.map((f) => <li key={f.id} data-met={f.met}>
        <span className="qa-mark" aria-hidden="true">{f.met ? "✓" : "○"}</span>
        <div><p className="qa-label">{f.label} <span className="qa-state">{f.met ? "Recorded" : "Not yet"}</span></p>
          <p className="qa-why">{f.why}{f.met ? "" : ` ${f.how}`}</p></div>
      </li>)}
    </ul>
    {q.questions.length > 0 && <><p className="qa-sub">Questions to ask next</p><ul className="qa-questions">{q.questions.map((x) => <li key={x.field}>{x.prompt}</li>)}</ul></>}
    {q.escalations.length > 0 && <><p className="qa-sub">Suggested founder involvement</p><ul className="qa-escalations">{q.escalations.map((e) => <li key={e.route}>
      <p className="qa-esc"><strong>{e.label}:</strong> {e.reason}</p>
      {onEscalate && <button type="button" className="qa-link" onClick={() => onEscalate(e.route)}>Ask for {e.label.toLowerCase()}</button>}
    </li>)}</ul></>}
  </div>
}
