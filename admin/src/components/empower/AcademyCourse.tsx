"use client"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AcademyShell, type PartnerNav } from "./AcademyShell"
import { CATEGORY_LABELS, type AcademyCourseSummary } from "./AcademyHome"
import { SafeMarkdown } from "./SafeMarkdown"

type Option = { id: string; text: string }
type Check = { id: string; type: "single" | "multiple" | "true_false"; prompt: string; options: Option[]; lastAttempt?: { correct: boolean; given: string[]; answer: string[]; explanation: string } }
type LessonContent = { body: string; sources: string[]; checks: Check[]; related?: { title: string; href: string }[] }
type CourseData = { course: AcademyCourseSummary; lessons: Record<string, LessonContent> }
type Feedback = { correct: boolean; answer: string[]; explanation: string; given: string[] }

async function post(action: string, payload: Record<string, unknown>) {
  const r = await fetch("/api/partner/academy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...payload }) })
  const body = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(body.error || "That did not work. Please try again.")
  return body.result
}

function KnowledgeCheck({ q, courseVersionId, lessonVersionId }: { q: Check; courseVersionId: string; lessonVersionId: string }) {
  const [chosen, setChosen] = useState<string[]>([])
  const [feedback, setFeedback] = useState<Feedback | null>(q.lastAttempt ? { correct: q.lastAttempt.correct, answer: q.lastAttempt.answer, explanation: q.lastAttempt.explanation, given: q.lastAttempt.given } : null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const multiple = q.type === "multiple"
  const text = (ids: string[]) => ids.map((id) => q.options.find((o) => o.id === id)?.text ?? id).join(", ")
  async function submit() {
    setBusy(true); setError("")
    try { setFeedback(await post("attempt_check", { courseVersionId, lessonVersionId, questionId: q.id, answer: chosen })) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  return <fieldset data-question={q.id}>
    <legend>{q.prompt}{multiple ? " (choose all that apply)" : ""}</legend>
    {q.options.map((o) => <label className="ac-option" key={o.id}>
      <input type={multiple ? "checkbox" : "radio"} name={`${lessonVersionId}-${q.id}`} value={o.id} checked={chosen.includes(o.id)} disabled={busy}
        onChange={(e) => setChosen(multiple ? (e.target.checked ? [...chosen, o.id] : chosen.filter((x) => x !== o.id)) : [o.id])} />
      <span>{o.text}</span></label>)}
    <button type="button" className="ac-button ac-secondary" onClick={submit} disabled={busy || !chosen.length}>{feedback ? "Try again" : "Check my answer"}</button>
    {error && <p className="ac-error" role="alert">{error}</p>}
    <div aria-live="polite">{feedback && <div className={`ac-feedback ${feedback.correct ? "ac-right" : "ac-wrong"}`}>
      <strong>{feedback.correct ? "Correct." : "Not quite."}</strong> {!feedback.correct && <>You chose: {text(feedback.given)}. The approved answer is: {text(feedback.answer)}. </>}
      <span>{feedback.explanation}</span></div>}</div>
  </fieldset>
}

export function AcademyCourse({ slug, nav }: { slug: string; nav?: PartnerNav }) {
  const [data, setData] = useState<CourseData | null>(null)
  const [error, setError] = useState("")
  const [current, setCurrent] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState("")
  const heading = useRef<HTMLHeadingElement>(null)
  const load = useCallback(async () => {
    const r = await fetch(`/api/partner/academy?course=${encodeURIComponent(slug)}`, { cache: "no-store" })
    const body = await r.json()
    if (!r.ok) throw new Error(body.error || "This course could not be loaded.")
    setData(body)
    return body as CourseData
  }, [slug])
  useEffect(() => {
    load().then((d) => {
      const wanted = new URLSearchParams(window.location.search).get("lesson")
      const flat = d.course.modules.flatMap((m) => m.lessons).filter((l) => l.available)
      setCurrent(flat.find((l) => l.itemId === wanted)?.itemId ?? flat.find((l) => l.itemId === d.course.lastLessonItemId)?.itemId ?? flat.find((l) => l.state !== "completed")?.itemId ?? flat[0]?.itemId ?? null)
    }).catch((e: Error) => setError(e.message))
  }, [load])
  const flat = useMemo(() => data?.course.modules.flatMap((m) => m.lessons) ?? [], [data])
  const lesson = flat.find((l) => l.itemId === current)
  const content = current ? data?.lessons[current] : undefined
  const available = flat.filter((l) => l.available)
  const index = available.findIndex((l) => l.itemId === current)
  useEffect(() => {
    if (!data || !lesson?.versionId) return
    const url = new URL(window.location.href); url.searchParams.set("lesson", lesson.itemId); window.history.replaceState(null, "", url)
    post("record_view", { courseVersionId: data.course.versionId, lessonVersionId: lesson.versionId }).catch(() => undefined)
  }, [data, lesson?.itemId, lesson?.versionId])
  const open = (id: string) => { setCurrent(id); setNotice(""); requestAnimationFrame(() => heading.current?.focus()) }
  async function complete() {
    if (!data || !lesson?.versionId) return
    setBusy(true); setNotice("")
    try { await post("complete_lesson", { courseVersionId: data.course.versionId, lessonVersionId: lesson.versionId }); await load(); setNotice("Marked as read. This is optional and private to you.") }
    catch (e) { setNotice((e as Error).message) } finally { setBusy(false) }
  }
  const stateLabel = (s: string) => s === "completed" ? "Read" : s === "updated" ? "Updated since you read it" : s === "unavailable" ? "Under review" : "Not read"
  return <AcademyShell current="course" nav={nav}>
    <p><Link href="/partner/academy">← Back to the course catalogue</Link></p>
    {error && <p className="ac-error" role="alert">{error}</p>}
    {!data && !error && <p className="ac-muted" role="status">Loading the course…</p>}
    {data && <>
      <header className="ac-course-head">
        <p className="ac-overline">{data.course.category ? CATEGORY_LABELS[data.course.category] ?? data.course.category : "Course"} · version {data.course.version}</p>
        <h1>{data.course.title}</h1>
        <SafeMarkdown className="ac-prose" source={data.course.description} />
        {data.course.objectives.length > 0 && <><p className="ac-muted">After this course you should be able to:</p><ul>{data.course.objectives.map((o) => <li key={o}>{o}</li>)}</ul></>}
        <p className="ac-muted" aria-live="polite">{data.course.progress.completed} of {data.course.progress.available} available lessons read{data.course.progress.unavailable ? ` · ${data.course.progress.unavailable} under review` : ""}{data.course.estimatedMinutes ? ` · about ${data.course.estimatedMinutes} minutes in total` : ""}</p>
      </header>
      <div className="ac-course">
        <nav className="ac-outline" aria-label="Course contents">
          {data.course.modules.map((m, mi) => <div key={mi}><h2>{m.title}</h2><ol>{m.lessons.map((l) => <li key={l.itemId}>
            <button type="button" aria-current={l.itemId === current ? "true" : undefined} disabled={!l.available} onClick={() => open(l.itemId)}>
              <span>{l.available ? l.title : "Lesson under review"}</span><span className="ac-muted">{stateLabel(l.state)}</span></button></li>)}</ol></div>)}
        </nav>
        <article className="ac-lesson" aria-labelledby="lesson-title">
          {!lesson || !content ? <div className="ac-unavailable">Choose a lesson from the course contents.</div> : <>
            <div className="ac-lesson-head">
              <span className="ac-ribbon">Partner guidance · do not share as client material</span>
              <h2 id="lesson-title" ref={heading} tabIndex={-1}>{lesson.title}</h2>
              <p className="ac-muted">Lesson {index + 1} of {available.length}{lesson.readingMinutes ? ` · about ${lesson.readingMinutes} minutes` : ""} · approved version {lesson.version}{lesson.publishedAt ? `, published ${new Date(lesson.publishedAt).toLocaleDateString("en-GB")}` : ""}</p>
              {lesson.state === "updated" && <p className="ac-feedback ac-wrong">This lesson has been updated since you last read it. Your earlier reading is still recorded.</p>}
            </div>
            <SafeMarkdown className="ac-prose" source={content.body} />
            {content.sources.length > 0 && <p className="ac-muted">Sources: {content.sources.join(" · ")}</p>}
            {content.related && content.related.length > 0 && <section className="ac-help" aria-labelledby="related-resources"><h3 id="related-resources">Related resources</h3><ul>{content.related.map((x) => <li key={x.href}><Link href={x.href}>{x.title}</Link></li>)}</ul></section>}
            {content.checks.length > 0 && <section className="ac-check" aria-labelledby="check-title"><h3 id="check-title">Optional knowledge check</h3><p className="ac-muted">Answers are checked straight away. Retry as often as you like; nothing here affects anything else.</p>
              {content.checks.map((q) => <KnowledgeCheck key={`${lesson.versionId}-${q.id}`} q={q} courseVersionId={data.course.versionId} lessonVersionId={lesson.versionId!} />)}</section>}
            <div className="ac-lesson-actions">
              <button type="button" className="ac-button ac-secondary" disabled={index <= 0} onClick={() => open(available[index - 1].itemId)}>← Previous lesson</button>
              {lesson.state === "completed" ? <span className="ac-chip ac-done">Read</span> : <button type="button" className="ac-button" onClick={complete} disabled={busy}>Mark as read (optional)</button>}
              <button type="button" className="ac-button ac-secondary" disabled={index < 0 || index >= available.length - 1} onClick={() => open(available[index + 1].itemId)}>Next lesson →</button>
            </div>
            <p aria-live="polite" className="ac-muted">{notice}</p>
            <p className="ac-muted">Not sure how this applies to a client? Request a <strong>technical scoping</strong> or <strong>commercial assistance</strong> meeting from your <a href="/partner">Partner workspace</a> rather than guessing.</p>
          </>}
        </article>
      </div>
    </>}
  </AcademyShell>
}
