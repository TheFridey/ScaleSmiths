"use client"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { AcademyShell, type PartnerNav } from "./AcademyShell"

export type Lesson = { itemId: string; available: boolean; versionId?: string; version?: number; title?: string; readingMinutes?: number | null; state: string; completedAt?: string | null; publishedAt?: string }
export type AcademyCourseSummary = {
  itemId: string; slug: string; versionId: string; version: number; title: string; description: string; category: string | null; objectives: string[]; estimatedMinutes: number | null
  publishedAt: string; updatedAt: string; modules: { title: string; summary?: string; lessons: Lesson[] }[]; progress: { completed: number; available: number; unavailable: number }; lastLessonItemId: string | null; lastViewedAt: string | null
}
export const CATEGORY_LABELS: Record<string, string> = {
  "getting-started": "Getting Started", services: "ScaleSmiths Services", "technical-knowledge": "Technical Knowledge", "digital-growth": "Digital Growth",
  "sales-fundamentals": "Sales Fundamentals", discovery: "Discovery", "commercial-policies": "Commercial Policies", "professional-conduct": "Professional Conduct", "advanced-opportunities": "Advanced Opportunities",
}
const STARTING_POINTS = ["getting-started", "professional-conduct"]
const date = (value: string) => new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
const lessonCount = (c: AcademyCourseSummary) => c.modules.reduce((n, m) => n + m.lessons.length, 0)
const done = (c: AcademyCourseSummary) => c.progress.available > 0 && c.progress.completed === c.progress.available

function CourseCard({ c }: { c: AcademyCourseSummary }) {
  const pct = c.progress.available ? Math.round((c.progress.completed / c.progress.available) * 100) : 0
  const updated = c.modules.some((m) => m.lessons.some((l) => l.state === "updated"))
  return <Link className="ac-card" href={`/partner/academy/${c.slug}`} data-course={c.slug}>
    <span className="ac-overline">{c.category ? CATEGORY_LABELS[c.category] ?? c.category : "Course"}</span>
    <h3>{c.title}</h3>
    <p>{c.description.split("\n")[0].replace(/[#*_`>]/g, "").slice(0, 180)}</p>
    <div className="ac-meta"><span>{c.modules.length} module{c.modules.length === 1 ? "" : "s"}</span><span>· {lessonCount(c)} lesson{lessonCount(c) === 1 ? "" : "s"}</span>{c.estimatedMinutes ? <span>· about {c.estimatedMinutes} min</span> : null}<span>· updated {date(c.updatedAt)}</span></div>
    <div className="ac-meta">
      {done(c) ? <span className="ac-chip ac-done">Completed</span> : c.progress.completed ? <span className="ac-chip">{c.progress.completed} of {c.progress.available} lessons read</span> : <span className="ac-chip">Not started</span>}
      {updated ? <span className="ac-chip ac-updated">Updated since you read it</span> : null}
      {c.progress.unavailable ? <span className="ac-chip">{c.progress.unavailable} lesson{c.progress.unavailable === 1 ? "" : "s"} under review</span> : null}
    </div>
    {c.progress.completed > 0 && <div className="ac-progress" role="progressbar" aria-label={`Your progress in ${c.title}`} aria-valuemin={0} aria-valuemax={c.progress.available} aria-valuenow={c.progress.completed}><span style={{ width: `${pct}%` }} /></div>}
  </Link>
}

export function AcademyHome({ nav }: { nav?: PartnerNav }) {
  const [data, setData] = useState<{ courses: AcademyCourseSummary[] } | null>(null)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("all")
  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/partner/academy", { signal: controller.signal, cache: "no-store" })
      .then(async (r) => { const body = await r.json(); if (!r.ok) throw new Error(body.error || "The Academy could not be loaded."); setData(body) })
      .catch((e: Error) => { if (e.name !== "AbortError") setError(e.message) })
    return () => controller.abort()
  }, [])
  const courses = useMemo(() => data?.courses ?? [], [data])
  const categories = useMemo(() => [...new Set(courses.map((c) => c.category).filter(Boolean))] as string[], [courses])
  const term = query.trim().toLowerCase()
  const matching = courses.filter((c) => (category === "all" || c.category === category) && (!term || [c.title, c.description, ...c.objectives, ...c.modules.flatMap((m) => [m.title, ...m.lessons.map((l) => l.title ?? "")])].join(" ").toLowerCase().includes(term)))
  const continuing = courses.filter((c) => c.progress.completed > 0 && !done(c)).sort((a, b) => String(b.lastViewedAt).localeCompare(String(a.lastViewedAt)))
  const completed = courses.filter(done)
  const recent = [...courses].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3)
  const starting = courses.filter((c) => c.category && STARTING_POINTS.includes(c.category) && c.progress.completed === 0)
  return <AcademyShell current="home" nav={nav}>
    <section className="ac-hero" aria-labelledby="academy-title">
      <p className="ac-overline">Partner Academy</p>
      <h1 id="academy-title">Learn at your own pace.</h1>
      <p>Short, approved lessons on ScaleSmiths services, honest selling and professional conduct. The Academy is optional and voluntary: nothing here is required, and nothing you read or answer affects your commission, prospects or standing. Your progress is private to you.</p>
    </section>
    {error && <p className="ac-error" role="alert">{error}</p>}
    {!data && !error && <p className="ac-muted" role="status">Loading the Academy…</p>}
    {data && !courses.length && <div className="ac-section ac-empty"><h2>No courses yet</h2><p>Courses appear here when ScaleSmiths has approved and published them. Nothing is available yet.</p></div>}
    {continuing.length > 0 && <section className="ac-section" aria-labelledby="continue"><h2 id="continue">Continue learning</h2><div className="ac-grid">{continuing.map((c) => <CourseCard key={c.itemId} c={c} />)}</div></section>}
    {starting.length > 0 && <section className="ac-section" aria-labelledby="start"><h2 id="start">Suggested starting points</h2><p className="ac-muted">A suggestion, not a requirement.</p><div className="ac-grid">{starting.map((c) => <CourseCard key={c.itemId} c={c} />)}</div></section>}
    {courses.length > 0 && <section className="ac-section" aria-labelledby="catalogue">
      <h2 id="catalogue">Course catalogue</h2>
      <div className="ac-filters">
        <label className="ac-field">Search courses<input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="For example: hosting, discovery, guarantees" /></label>
        <label className="ac-field">Category<select value={category} onChange={(e) => setCategory(e.target.value)}><option value="all">All categories</option>{categories.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c] ?? c}</option>)}</select></label>
      </div>
      <p className="ac-muted" aria-live="polite">{matching.length} of {courses.length} course{courses.length === 1 ? "" : "s"}</p>
      {matching.length ? <div className="ac-grid">{matching.map((c) => <CourseCard key={c.itemId} c={c} />)}</div> : <div className="ac-empty">No course matches that search.</div>}
    </section>}
    {recent.length > 0 && <section className="ac-section" aria-labelledby="recent"><h2 id="recent">Recently updated</h2><ul>{recent.map((c) => <li key={c.itemId}><Link href={`/partner/academy/${c.slug}`}>{c.title}</Link> <span className="ac-muted">· {date(c.updatedAt)}</span></li>)}</ul></section>}
    {completed.length > 0 && <section className="ac-section" aria-labelledby="completed"><h2 id="completed">Completed courses</h2><ul>{completed.map((c) => <li key={c.itemId}><Link href={`/partner/academy/${c.slug}`}>{c.title}</Link></li>)}</ul></section>}
    <section className="ac-section ac-help" aria-labelledby="help">
      <h2 id="help">Need help?</h2>
      <p>If a client asks something a lesson does not answer, do not improvise. Request a meeting from your <a href="/partner">Partner workspace</a>: technical scoping for technical questions, commercial assistance for pricing or terms, and escalation for complaints, mistakes or anything urgent.</p>
      {nav?.resources ? <p>Approved brochures, guides and checklists are in the <Link href="/partner/resources">Resource Centre</Link>.</p> : <p className="ac-muted">Approved resources will appear in the Resource Centre in a later release.</p>}
    </section>
  </AcademyShell>
}
