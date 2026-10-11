"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  Plus,
  Phone,
  Check,
  CalendarClock,
  Clock,
  RefreshCw,
  Download,
  X,
  Target,
  PoundSterling,
  Users,
  Search,
  LayoutList,
  Columns3,
  Bell,
  ArrowRight,
} from "lucide-react"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts"
import {
  COMMERCIAL_ACTIVITIES,
  COMMERCIAL_STAGES,
  COMMERCIAL_STAGE_LABELS,
  DEFAULT_COMPANY_TARGETS,
  DEFAULT_COMMERCIAL_CONFIG,
  CALL_OUTCOMES,
  REVENUE_CATEGORIES,
  contractMetrics,
  londonDay,
  londonWeek,
  londonInputToISO,
  nextLondonOccurrence,
  firstDecisionMakerConnections,
  suggestCommercialActivity,
} from "@/lib/command-centre"
import type { commercialSnapshot } from "@/lib/server/command-centre"
import "./command-centre.css"
import { CommercialReports } from "./CommercialReports"
import { ConversationPreparation } from "./ConversationPreparation"
import { PROSPECT_SOURCES } from "@/lib/prospects"

type Json<T> = T extends Date
  ? string
  : T extends Array<infer U>
    ? Json<U>[]
    : T extends object
      ? { [K in keyof T]: Json<T[K]> }
      : T
export type Snapshot = Json<Awaited<ReturnType<typeof commercialSnapshot>>>
type Lead = Snapshot["leads"][number]
type Task = Snapshot["tasks"][number]
type Modal = {
  kind: string
  lead?: Lead
  task?: Task
  contact?: Snapshot["contacts"][number]
}
const money = (pence: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(
    pence / 100,
  )
const label = (value: string) =>
  value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())
const dateLabel = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("en-GB", {
        timeZone: "Europe/London",
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Not scheduled"
const dateInput = (value: string) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(value))
      .map((p) => [p.type, p.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}
const tabs = [
  "Today",
  "Pipeline",
  "Follow-ups",
  "Activity",
  "Revenue",
  "Scoreboard",
  "Reports",
  "Settings",
]

export function CommandCentre() {
  const [data, setData] = useState<Snapshot | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("Today"),
    [search, setSearch] = useState(""),
    [owner, setOwner] = useState("all"),
    [view, setView] = useState("table"),
    [filter, setFilter] = useState("all")
  const [modal, setModal] = useState<Modal | null>(null),
    [selected, setSelected] = useState<number | null>(null),
    [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState(""),
    [notice, setNotice] = useState("")
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/command-centre", {
        cache: "no-store",
      })
      const result = await response.json()
      if (response.status === 401 || response.status === 403) {
        setData(null)
        window.location.assign("/login?reason=session")
        return
      }
      if (!response.ok) throw new Error(result.error)
      setData(result)
      setError("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load records.")
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    void load()
    const timer = setInterval(() => {
      if (!document.hidden) void load()
    }, 30000)
    return () => clearInterval(timer)
  }, [load])
  async function mutate(input: Record<string, unknown>) {
    setBusy(true)
    setFormError("")
    setNotice("")
    try {
      const response = await fetch("/api/command-centre", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
      const result = await response.json()
      if (response.status === 401) {
        setData(null)
        window.location.assign("/login?reason=session")
        return false
      }
      if (!response.ok) throw new Error(result.error)
      setModal(null)
      await load()
      setNotice("Saved to the shared record.")
      return true
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Unable to save.")
      return false
    } finally {
      setBusy(false)
    }
  }
  function open(value: Modal) {
    setModal(value)
    setFormError("")
  }
  if (!data)
    return (
      <section className="cc">
        <h1>Command Centre</h1>
        {loading ? (
          <p role="status">Loading shared records...</p>
        ) : (
          <>
            <p role="alert">{error}</p>
            <button onClick={() => void load()}>
              <RefreshCw size={16} /> Retry
            </button>
          </>
        )}
      </section>
    )
  const now = new Date(data.serverTime),
    today = londonDay(now),
    week = londonWeek(now)
  const config = {
    ...DEFAULT_COMMERCIAL_CONFIG,
    ...data.settings.find((s) => s.key === "config")?.value,
  } as typeof DEFAULT_COMMERCIAL_CONFIG
  const companyTargets = {
    ...DEFAULT_COMPANY_TARGETS,
    ...data.settings.find((s) => s.key === "companyTargets")?.value,
  } as Record<string, number>
  const userName = (id: string | null) =>
    data.users.find((u) => u.id === id)?.displayName ?? "Unassigned"
  const leadName = (id: number | null) =>
    data.leads.find((l) => l.id === id)?.businessName ?? "Business record"
  const due = data.tasks.filter((t) => t.status === "open"),
    overdue = due.filter((t) => new Date(t.dueAt) < now)
  const stats = contractMetrics(data.contracts, now)
  const recent = data.activities.filter(
    (a) => londonWeek(a.occurredAt ?? a.createdAt) === week && a.actorUserId,
  )
  const previousWeek = londonWeek(new Date(now.getTime() - 7 * 86400000))
  const previous = data.activities.filter(
    (a) =>
      londonWeek(a.occurredAt ?? a.createdAt) === previousWeek && a.actorUserId,
  )
  const dayActivities = data.activities.filter(
    (a) => londonDay(a.occurredAt ?? a.createdAt) === today && a.actorUserId,
  )
  const allocated = (id: number) =>
    data.payments
      .filter((p) => p.invoiceId === id)
      .reduce((sum, p) => sum + p.amount, 0)
  const outstanding = data.invoices
    .filter((i) => !["draft", "void", "paid"].includes(i.status))
    .reduce((sum, i) => sum + Math.max(0, i.total - allocated(i.id)), 0)
  const totalPaid = data.payments.reduce((sum, p) => sum + p.amount, 0)
  const leads = data.leads
    .filter((l) =>
      `${l.businessName} ${l.location ?? ""} ${l.contactName ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .filter(
      (l) =>
        owner === "all" ||
        (owner === "joint"
          ? l.joint
          : l.ownerUserId === (owner === "mine" ? data.actor.id : owner)),
    )
    .filter(
      (l) =>
        filter === "all" ||
        (filter === "overdue"
          ? l.nextFollowUpAt && new Date(l.nextFollowUpAt) < now
          : filter === "research"
            ? l.stage === "found"
            : filter === "high"
              ? l.priority === "high"
              : filter === "stale"
                ? !l.lastContactedAt ||
                  new Date(l.lastContactedAt) <
                    new Date(now.getTime() - 14 * 86400000)
                : ["won", "lost"].includes(l.stage)),
    )
  const selectedLead = data.leads.find((l) => l.id === selected)
  const chart = Array.from({ length: 7 }, (_, i) => {
    const day = londonDay(new Date(now.getTime() - (6 - i) * 86400000))
    return {
      day: day.slice(5),
      calls: data.activities.filter(
        (a) =>
          a.type === "phone_call" &&
          a.actorUserId &&
          londonDay(a.occurredAt ?? a.createdAt) === day,
      ).length,
      emails: data.activities.filter(
        (a) =>
          a.type === "email" &&
          a.actorUserId &&
          londonDay(a.occurredAt ?? a.createdAt) === day,
      ).length,
    }
  })
  const taskRows = (rows: Task[]) =>
    rows.length ? (
      <div className="cc-rows">
        {rows.map((t) => (
          <div className="cc-row" key={t.id}>
            <div>
              <strong>{t.title}</strong>
              <span>
                {leadName(t.prospectId)} · {userName(t.assignedUserId)}
              </span>
              <time className={new Date(t.dueAt) < now ? "cc-overdue" : ""}>
                {dateLabel(t.dueAt)}
              </time>
            </div>
            {data.actor.canWrite && (
              <div className="cc-actions">
                <button
                  title="Edit or reschedule task"
                  onClick={() => open({ kind: "task", task: t })}
                >
                  <CalendarClock size={18} />
                </button>
                <button
                  disabled={busy}
                  title="Complete task"
                  onClick={() =>
                    void mutate({
                      action: "task",
                      id: t.id,
                      version: t.version,
                      status: "completed",
                    })
                  }
                >
                  <Check size={18} />
                </button>
                {t.status === "open" && (
                  <button
                    disabled={busy}
                    title="Snooze until tomorrow, same London time"
                    onClick={() =>
                      void mutate({
                        action: "task",
                        id: t.id,
                        version: t.version,
                        dueAt: nextLondonOccurrence(
                          new Date(t.dueAt) > now ? t.dueAt : now,
                          1,
                        ).toISOString(),
                      })
                    }
                  >
                    <Clock size={18} />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    ) : (
      <p className="cc-empty">No tasks in this view.</p>
    )
  return (
    <section className="cc">
      <header className="cc-header">
        <div>
          <p className="cc-eyebrow">SCALESMITHS · FORGE YOUR DIGITAL EDGE</p>
          <h1>Command Centre</h1>
          <p>
            {data.actor.name} ·{" "}
            {now.toLocaleDateString("en-GB", {
              timeZone: "Europe/London",
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
        </div>
        <div className="cc-actions">
          <button title="Refresh records" onClick={() => void load()}>
            <RefreshCw size={18} />
          </button>
          {data.actor.canWrite && (
            <button
              className="cc-primary"
              onClick={() => open({ kind: "activity" })}
            >
              <Plus size={18} /> Log activity
            </button>
          )}
        </div>
      </header>
      {error && (
        <p role="alert" className="cc-error">
          {error} Displayed records may be stale.
        </p>
      )}
      {notice && (
        <p role="status" className="cc-notice">
          {notice}
        </p>
      )}
      {formError && !modal && (
        <p role="alert" className="cc-error">
          {formError}
        </p>
      )}
      <nav className="cc-tabs" aria-label="Commercial views">
        {tabs
          .filter(
            (t) =>
              (t !== "Settings" || data.actor.canConfigure) &&
              (t !== "Revenue" || data.actor.canReadFinance),
          )
          .map((t) => (
            <button
              key={t}
              aria-current={tab === t ? "page" : undefined}
              onClick={() => {
                setTab(t)
                setFilter("all")
                setSearch("")
              }}
            >
              {t}
            </button>
          ))}
      </nav>
      {tab === "Today" && (
        <>
          <div className="cc-metrics">
            <Metric
              icon={<Users size={20} />}
              name="Retained clients"
              value={
                data.actor.canReadFinance
                  ? `${stats.retainedClients} / ${config.clientTarget}`
                  : "Unavailable"
              }
            />
            <Metric
              icon={<PoundSterling size={20} />}
              name="Confirmed MRR"
              value={
                data.actor.canReadFinance ? money(stats.mrr) : "Unavailable"
              }
            />
            <Metric
              icon={<Target size={20} />}
              name="28 Club MRR"
              value={
                data.actor.canReadFinance
                  ? `${config.mrrTarget ? Math.round((stats.mrr / config.mrrTarget) * 100) : 0}%`
                  : "Unavailable"
              }
            />
            <Metric
              icon={<Bell size={20} />}
              name="Overdue follow-ups"
              value={String(overdue.length)}
            />
          </div>
          {data.actor.canReadFinance && (
            <div className="cc-progress">
              <span>
                {money(stats.mrr)} of {money(config.mrrTarget)}
              </span>
              <progress value={stats.mrr} max={config.mrrTarget || 1} />
            </div>
          )}
          {data.actor.canReadFinance && (
            <div className="cc-counts" aria-label="28 Club milestones">
              {[7, 14, 21, 28].map((count) => (
                <div key={count}>
                  <span>
                    {stats.retainedClients >= count ? (
                      <Check size={16} aria-label="Reached" />
                    ) : (
                      <Target size={16} aria-label="Not yet reached" />
                    )}
                  </span>
                  <strong>{count} retained clients</strong>
                  <small>
                    {stats.retainedClients >= count
                      ? "Reached on active contracts"
                      : `${count - stats.retainedClients} to this milestone`}
                  </small>
                </div>
              ))}
            </div>
          )}
          <div className="cc-columns">
            <section>
              <h2>Immediate priorities</h2>
              {taskRows(
                due
                  .filter(
                    (t) =>
                      new Date(t.dueAt) < now || londonDay(t.dueAt) === today,
                  )
                  .slice(0, 5),
              )}
              <h2>Next commercial actions</h2>
              {data.leads
                .filter((l) => !["won", "lost"].includes(l.stage))
                .sort(
                  (a, b) =>
                    (a.nextFollowUpAt
                      ? new Date(a.nextFollowUpAt).getTime()
                      : Infinity) -
                    (b.nextFollowUpAt
                      ? new Date(b.nextFollowUpAt).getTime()
                      : Infinity),
                )
                .slice(0, 5)
                .map((l) => (
                  <button
                    className="cc-recommendation"
                    key={l.id}
                    onClick={() => {
                      setSelected(l.id)
                      setTab("Pipeline")
                    }}
                  >
                    <div>
                      <strong>{l.businessName}</strong>
                      <span>
                        {l.nextAction ??
                          (l.stage === "found"
                            ? "Research business"
                            : l.stage === "proposal_sent"
                              ? "Review proposal decision"
                              : "Agree the next action")}{" "}
                        · {userName(l.ownerUserId)}
                      </span>
                    </div>
                    <ArrowRight size={18} />
                  </button>
                ))}
              {!data.leads.length && (
                <p className="cc-empty">No prospects yet.</p>
              )}
            </section>
            <section>
              <h2>Today’s commercial activity</h2>
              <div className="cc-counts">
                {COMMERCIAL_ACTIVITIES.map((type) => (
                  <div key={type}>
                    <span>{label(type)}</span>
                    <strong>
                      {dayActivities.filter((a) => a.type === type).length}
                    </strong>
                  </div>
                ))}
              </div>
              <h2>Calls and emails</h2>
              <div className="cc-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart}>
                    <XAxis dataKey="day" stroke="#a9a9ab" />
                    <YAxis allowDecimals={false} stroke="#a9a9ab" />
                    <Tooltip
                      contentStyle={{
                        background: "#18191b",
                        border: "1px solid #555",
                      }}
                    />
                    <Bar dataKey="calls" fill="#d1b266" />
                    <Bar dataKey="emails" fill="#81b3ac" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
        </>
      )}
      {tab === "Pipeline" && (
        <>
          <div className="cc-toolbar">
            <label className="cc-search">
              <Search size={17} />
              <input
                aria-label="Search prospects"
                placeholder="Search businesses"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <select
              aria-label="Owner"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
            >
              <option value="all">All owners</option>
              <option value="mine">My leads</option>
              <option value="joint">Joint leads</option>
              {data.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName}
                </option>
              ))}
            </select>
            <select
              aria-label="Saved view"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">All leads</option>
              <option value="overdue">Overdue</option>
              <option value="research">Research needed</option>
              <option value="high">High priority</option>
              <option value="stale">No recent contact</option>
              <option value="closed">Won / lost</option>
            </select>
            <button
              title="Table view"
              aria-pressed={view === "table"}
              onClick={() => setView("table")}
            >
              <LayoutList size={18} />
            </button>
            <button
              title="Kanban view"
              aria-pressed={view === "board"}
              onClick={() => setView("board")}
            >
              <Columns3 size={18} />
            </button>
            <a
              className="cc-button"
              title="Export prospects"
              href="/api/command-centre?export=prospects"
            >
              <Download size={18} />
            </a>
            {data.actor.canWrite && (
              <button onClick={() => open({ kind: "createProspect" })}>
                <Plus size={18} /> Prospect
              </button>
            )}
          </div>
          {view === "table" ? (
            <div className="cc-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Business</th>
                    <th>Owner</th>
                    <th>Stage</th>
                    <th>Next action</th>
                    <th>Follow-up</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <button
                          className="cc-link"
                          onClick={() => setSelected(l.id)}
                        >
                          {l.businessName}
                        </button>
                        <small>{l.location}</small>
                      </td>
                      <td>
                        {userName(l.ownerUserId)}
                        {l.joint ? " · Joint" : ""}
                      </td>
                      <td>{COMMERCIAL_STAGE_LABELS[l.stage]}</td>
                      <td>{l.nextAction ?? "—"}</td>
                      <td>{dateLabel(l.nextFollowUpAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!leads.length && (
                <p className="cc-empty">No prospects match this view.</p>
              )}
            </div>
          ) : (
            <div className="cc-board">
              {[...COMMERCIAL_STAGES, "follow_up_due"].map((stage) => (
                <section key={stage}>
                  <h3>
                    {COMMERCIAL_STAGE_LABELS[stage]}{" "}
                    <span>{leads.filter((l) => l.stage === stage).length}</span>
                  </h3>
                  {leads
                    .filter((l) => l.stage === stage)
                    .map((l) => (
                      <button
                        className="cc-lead-card"
                        key={l.id}
                        onClick={() => setSelected(l.id)}
                      >
                        <strong>{l.businessName}</strong>
                        <span>{userName(l.ownerUserId)}</span>
                        <small>{l.nextAction ?? "Next action not set"}</small>
                      </button>
                    ))}
                </section>
              ))}
            </div>
          )}
          {selectedLead && (
            <section className="cc-detail">
              <header>
                <h2>{selectedLead.businessName}</h2>
                <button
                  title="Close business record"
                  onClick={() => setSelected(null)}
                >
                  <X size={18} />
                </button>
              </header>
              <p>
                {selectedLead.opportunityNotes ??
                  selectedLead.painPoints ??
                  "No qualification notes recorded."}
              </p>
              <p>
                {userName(selectedLead.ownerUserId)} ·{" "}
                {COMMERCIAL_STAGE_LABELS[selectedLead.stage]} ·{" "}
                {selectedLead.confidence}% confidence
              </p>
              {data.actor.canWrite && (
                <div className="cc-actions">
                  <button
                    onClick={() =>
                      open({ kind: "updateProspect", lead: selectedLead })
                    }
                  >
                    Edit opportunity
                  </button>
                  <button
                    onClick={() =>
                      open({ kind: "activity", lead: selectedLead })
                    }
                  >
                    <Phone size={17} /> Log activity
                  </button>
                  <button
                    onClick={() =>
                      open({ kind: "contact", lead: selectedLead })
                    }
                  >
                    <Plus size={17} /> Contact
                  </button>
                  <button
                    onClick={() => open({ kind: "task", lead: selectedLead })}
                  >
                    <CalendarClock size={17} /> Follow-up
                  </button>
                </div>
              )}
              <h3>Contacts</h3>
              {data.contacts
                .filter((c) => c.prospectId === selectedLead.id)
                .map((c) => (
                  <div className="cc-row" key={c.id}>
                    <span>
                      {c.name} · {c.email ?? c.phone ?? "No contact details"}
                      {c.suppressed ? " · Opted out" : ""}
                      {c.decisionMaker ? " · Decision-maker" : ""}
                    </span>
                    {data.actor.canWrite && (
                      <button
                        onClick={() =>
                          open({
                            kind: "contact",
                            lead: selectedLead,
                            contact: c,
                          })
                        }
                      >
                        Edit
                      </button>
                    )}
                  </div>
                ))}
              <h3>Interaction history</h3>
              {data.activities
                .filter((a) => a.prospectId === selectedLead.id)
                .map((a) => (
                  <div className="cc-row" key={a.id}>
                    <div>
                      <strong>
                        {label(a.type)} · {a.outcome}
                      </strong>
                      <span>
                        {a.actorUserId
                          ? userName(a.actorUserId)
                          : `${a.createdBy ?? "Unknown"} (legacy attribution)`}{" "}
                        · {dateLabel(a.occurredAt ?? a.createdAt)}
                      </span>
                      <p>{a.body}</p>
                    </div>
                  </div>
                ))}
              <h3>Change history</h3>
              {data.history
                .filter(
                  (h) =>
                    h.entity === "prospect" &&
                    h.recordId === String(selectedLead.id),
                )
                .map((h) => (
                  <details key={h.id}>
                    <summary>
                      {userName(h.actorUserId)} · {label(h.action)} ·{" "}
                      {dateLabel(h.createdAt)}
                    </summary>
                    <pre>
                      {JSON.stringify(
                        { before: h.beforeValue, after: h.afterValue },
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                ))}
            </section>
          )}
        </>
      )}
      {tab === "Follow-ups" && (
        <>
          <div className="cc-toolbar">
            <input
              aria-label="Search tasks"
              placeholder="Search tasks"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              aria-label="Task view"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">Open tasks</option>
              <option value="mine">My tasks</option>
              <option value="overdue">Overdue</option>
              <option value="today">Due today</option>
              <option value="completed">Completed</option>
            </select>
            {data.actor.canWrite && (
              <button onClick={() => open({ kind: "task" })}>
                <Plus size={18} /> Task
              </button>
            )}
          </div>
          {taskRows(
            data.tasks.filter(
              (t) =>
                t.title.toLowerCase().includes(search.toLowerCase()) &&
                (filter === "completed"
                  ? t.status === "completed"
                  : t.status === "open" &&
                    (filter === "mine"
                      ? t.assignedUserId === data.actor.id
                      : filter === "overdue"
                        ? new Date(t.dueAt) < now
                        : filter === "today"
                          ? londonDay(t.dueAt) === today
                          : true)),
            ),
          )}
        </>
      )}
      {tab === "Activity" && (
        <>
          <div className="cc-toolbar">
            <h2>Shared activity history</h2>
            <a
              className="cc-button"
              href="/api/command-centre?export=activities"
            >
              <Download size={18} /> CSV
            </a>
          </div>
          {data.activities.length ? (
            data.activities.map((a) => (
              <div className="cc-row" key={a.id}>
                <div>
                  <strong>
                    {leadName(a.prospectId)} · {label(a.type)}
                  </strong>
                  <span>
                    {a.actorUserId
                      ? userName(a.actorUserId)
                      : `${a.createdBy ?? "Unknown"} (legacy)`}{" "}
                    · {dateLabel(a.occurredAt ?? a.createdAt)}
                  </span>
                  <p>
                    {a.outcome}
                    {a.body ? ` · ${a.body}` : ""}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="cc-empty">No activities logged.</p>
          )}
        </>
      )}
      {tab === "Revenue" && (
        <>
          <div className="cc-metrics">
            <Metric
              icon={<PoundSterling size={20} />}
              name="Confirmed MRR"
              value={money(stats.mrr)}
            />
            <Metric
              icon={<Check size={20} />}
              name="Payments collected"
              value={money(totalPaid)}
            />
            <Metric
              icon={<CalendarClock size={20} />}
              name="Outstanding invoices"
              value={money(outstanding)}
            />
            <Metric
              icon={<Target size={20} />}
              name="Variable forecasts"
              value={money(
                data.forecasts.reduce((sum, f) => sum + f.amount, 0),
              )}
            />
          </div>
          <div className="cc-toolbar">
            {data.actor.canFinance && (
              <>
                <button onClick={() => open({ kind: "contract" })}>
                  <Plus size={17} /> Contract
                </button>
                <button onClick={() => open({ kind: "payment" })}>
                  <Plus size={17} /> Payment
                </button>
                <button onClick={() => open({ kind: "forecast" })}>
                  <Plus size={17} /> Forecast
                </button>
              </>
            )}
            <Link className="cc-button" href="/finance/invoices">
              Invoices
            </Link>
            <a className="cc-button" href="/api/command-centre?export=payments">
              <Download size={17} /> CSV
            </a>
          </div>
          <h2>Contracts</h2>
          {!data.contracts.length && (
            <p className="cc-empty">No contract evidence recorded.</p>
          )}
          {data.contracts.map((c) => (
            <div className="cc-row" key={c.id}>
              <div>
                <strong>
                  {data.clients.find((x) => x.id === c.clientId)?.name} ·{" "}
                  {label(c.category)}
                </strong>
                <span>
                  {c.status} · {money(c.monthlyAmount)}/month ·{" "}
                  {money(c.oneOffAmount)} one-off
                </span>
                <p>{c.evidence}</p>
              </div>
              {data.actor.canFinance && c.status === "draft" && (
                <button
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Confirm the signed contract and its recorded evidence?",
                      )
                    )
                      void mutate({
                        action: "confirmContract",
                        id: c.id,
                        version: c.version,
                        confirmed: true,
                      })
                  }}
                >
                  Confirm signed contract
                </button>
              )}
              {data.actor.canFinance && c.status === "confirmed" && (
                <button
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        "End this contract now? Its recurring revenue will be removed.",
                      )
                    )
                      void mutate({
                        action: "endContract",
                        id: c.id,
                        version: c.version,
                      })
                  }}
                >
                  End contract
                </button>
              )}
            </div>
          ))}
          <h2>Payment history</h2>
          {data.payments.map((p) => (
            <div className="cc-row" key={p.id}>
              <div>
                <strong>
                  {money(p.amount)} ·{" "}
                  {data.clients.find((c) => c.id === p.clientId)?.name}
                </strong>
                <span>
                  {label(p.category)} · {p.reference} ·{" "}
                  {dateLabel(p.receivedAt)}
                </span>
              </div>
              {data.actor.canFinance &&
                p.amount > 0 &&
                !data.payments.some((r) => r.reversesPaymentId === p.id) && (
                  <button
                    onClick={() => {
                      const evidence = window.prompt(
                        "Reason and evidence for reversing this payment:",
                      )
                      if (evidence)
                        void mutate({
                          action: "reversePayment",
                          id: p.id,
                          evidence,
                        })
                    }}
                  >
                    Correct payment
                  </button>
                )}
            </div>
          ))}
          <h2>Variable income forecasts</h2>
          {data.forecasts.map((f) => (
            <div className="cc-row" key={f.id}>
              <div>
                <strong>
                  {money(f.amount)} expected ·{" "}
                  {data.clients.find((c) => c.id === f.clientId)?.name}
                </strong>
                <span>{dateLabel(f.expectedAt)}</span>
                <p>{f.notes}</p>
              </div>
            </div>
          ))}
          <h2>Collected income by category</h2>
          <div className="cc-counts">
            {REVENUE_CATEGORIES.map((c) => (
              <div key={c}>
                <span>{label(c)}</span>
                <strong>
                  {money(
                    data.payments
                      .filter((p) => p.category === c)
                      .reduce((s, p) => s + p.amount, 0),
                  )}
                </strong>
              </div>
            ))}
          </div>
        </>
      )}
      {tab === "Scoreboard" && (
        <>
          <h2>Week commencing {week}</h2>
          {[null, ...data.users].map((user) => {
            const rows = recent.filter(
              (a) => !user || a.actorUserId === user.id,
            )
            const targets = user
              ? ((data.settings.find((s) => s.key === `targets:${user.id}`)
                  ?.value as Record<string, number> | undefined) ??
                user.founderTargets)
              : companyTargets
            return (
              <section className="cc-score" key={user?.id ?? "company"}>
                <h3>{user?.displayName ?? "Combined company"}</h3>
                {!targets && <p>Individual targets have not been agreed.</p>}
                {targets?.connections !== undefined && (
                  <p>
                    New decision-maker connections:{" "}
                    {
                      firstDecisionMakerConnections(data.activities).filter(
                        (a) =>
                          londonWeek(a.occurredAt ?? a.createdAt) === week &&
                          (!user || a.actorUserId === user.id),
                      ).length
                    }{" "}
                    / {targets.connections}, stretch{" "}
                    {targets.connectionStretch ?? targets.connections}.{" "}
                    Confirmed two-way conversations; each contact counted once.
                  </p>
                )}
                <div className="cc-counts">
                  {Object.keys(companyTargets)
                    .filter(
                      (type) =>
                        !["connections", "connectionStretch"].includes(type),
                    )
                    .map((type) => {
                      const count = rows.filter((a) => a.type === type).length,
                        target = targets?.[type]
                      return (
                        <div key={type}>
                          <span>{label(type)}</span>
                          <strong>
                            {count}
                            {target !== undefined
                              ? ` / ${target} (${target ? Math.round((count / target) * 100) : 0}%)`
                              : ""}
                          </strong>
                          <small>
                            Previous week:{" "}
                            {
                              previous.filter(
                                (a) =>
                                  a.type === type &&
                                  (!user || a.actorUserId === user.id),
                              ).length
                            }
                          </small>
                        </div>
                      )
                    })}
                </div>
                <p>
                  Deals won:{" "}
                  {
                    data.leads.filter(
                      (l) =>
                        l.stage === "won" &&
                        l.wonAt &&
                        londonWeek(l.wonAt) === week &&
                        (!user || l.ownerUserId === user.id),
                    ).length
                  }{" "}
                  · Confirmed new MRR:{" "}
                  {money(
                    data.contracts
                      .filter(
                        (c) =>
                          c.status === "confirmed" &&
                          londonWeek(c.startsAt) === week &&
                          new Date(c.startsAt) <= now &&
                          (!user || c.actorUserId === user.id),
                      )
                      .reduce((s, c) => s + c.monthlyAmount, 0),
                  )}
                </p>
              </section>
            )
          })}
          <h2>Commercial outcomes</h2>
          <p>
            Qualified opportunities:{" "}
            {
              data.leads.filter((l) =>
                [
                  "qualified",
                  "discovery_booked",
                  "proposal_required",
                  "proposal_sent",
                  "negotiation",
                  "won",
                ].includes(l.stage),
              ).length
            }{" "}
            · Won: {data.leads.filter((l) => l.stage === "won").length} · Lost:{" "}
            {data.leads.filter((l) => l.stage === "lost").length}
          </p>
          <p>
            Closed-deal win rate:{" "}
            {(() => {
              const closed = data.leads.filter((l) =>
                ["won", "lost"].includes(l.stage),
              )
              return closed.length
                ? `${Math.round((closed.filter((l) => l.stage === "won").length / closed.length) * 100)}%`
                : "No closed deals"
            })()}
          </p>
        </>
      )}
      {tab === "Settings" && (
        <>
          <h2>Commercial configuration</h2>
          <SettingsForm
            data={data}
            settingKey="config"
            defaults={DEFAULT_COMMERCIAL_CONFIG}
            busy={busy}
            save={mutate}
          />
          <h2>Company weekly targets</h2>
          <SettingsForm
            data={data}
            settingKey="companyTargets"
            defaults={DEFAULT_COMPANY_TARGETS}
            busy={busy}
            save={mutate}
          />
          {data.users.map((u) => (
            <section key={u.id}>
              <h2>{u.displayName}: agreed weekly targets</h2>
              <SettingsForm
                data={data}
                settingKey={`targets:${u.id}`}
                defaults={{
                  ...Object.fromEntries(
                    Object.keys(DEFAULT_COMPANY_TARGETS).map((k) => [k, 0]),
                  ),
                  ...u.founderTargets,
                }}
                busy={busy}
                save={mutate}
              />
            </section>
          ))}
        </>
      )}
      {tab === "Reports" && <CommercialReports data={data} />}
      {tab === "Pipeline" && selectedLead && (
        <ConversationPreparation context={selectedLead} />
      )}
      {data.actor.canWrite && (
        <button
          className="cc-capture"
          title="Capture prospect"
          onClick={() => open({ kind: "createProspect" })}
        >
          <Plus size={23} />
        </button>
      )}
      {modal && (
        <EntryModal
          key={`${modal.kind}:${modal.lead?.id}:${modal.task?.id}:${modal.contact?.id}`}
          data={data}
          modal={modal}
          busy={busy}
          error={formError}
          close={() => setModal(null)}
          save={mutate}
        />
      )}
    </section>
  )
}

function Metric({
  icon,
  name,
  value,
}: {
  icon: React.ReactNode
  name: string
  value: string
}) {
  return (
    <div className="cc-metric">
      {icon}
      <span>{name}</span>
      <strong>{value}</strong>
    </div>
  )
}
function SettingsForm({
  data,
  settingKey,
  defaults,
  busy,
  save,
}: {
  data: Snapshot
  settingKey: string
  defaults: Record<string, number>
  busy: boolean
  save: (v: Record<string, unknown>) => Promise<boolean>
}) {
  const setting = data.settings.find((s) => s.key === settingKey)
  return (
    <form
      className="cc-settings"
      onSubmit={(e) => {
        e.preventDefault()
        const form = new FormData(e.currentTarget)
        const value = Object.fromEntries(
          Object.keys(defaults).map((k) => [k, Number(form.get(k))]),
        )
        void save({
          action: "settings",
          key: settingKey,
          value,
          version: setting?.version ?? 0,
        })
      }}
    >
      {Object.entries(defaults).map(([key, value]) => (
        <label key={`${key}:${setting?.version}`}>
          {label(key.replace(/([A-Z])/g, " $1"))}
          <input
            name={key}
            type="number"
            min="0"
            step="1"
            required
            defaultValue={Number(setting?.value[key] ?? value)}
          />
        </label>
      ))}
      <button disabled={busy} className="cc-primary">
        <Check size={17} /> Save agreed values
      </button>
    </form>
  )
}

function EntryModal({
  data,
  modal,
  busy,
  error,
  close,
  save,
}: {
  data: Snapshot
  modal: Modal
  busy: boolean
  error: string
  close: () => void
  save: (v: Record<string, unknown>) => Promise<boolean>
}) {
  const [type, setType] = useState("phone_call"),
    [prospectId, setProspectId] = useState(
      String(modal.lead?.id ?? modal.task?.prospectId ?? ""),
    ),
    [localError, setLocalError] = useState("")
  const [naturalNote, setNaturalNote] = useState(""),
    [suggestion, setSuggestion] = useState<ReturnType<
      typeof suggestCommercialActivity
    > | null>(null)
  const [requestKey] = useState(() => crypto.randomUUID())
  const { kind, lead, task, contact } = modal
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const dialog = document.querySelector<HTMLDialogElement>(".cc-dialog")
    dialog?.showModal()
    return () => {
      dialog?.close()
      previous?.focus()
    }
  }, [])
  const field = (
    name: string,
    caption: string,
    inputType = "text",
    value?: string | number | null,
    required = false,
  ) => (
    <label>
      {caption}
      <input
        key={name === "followUpAt" ? suggestion?.followUpAt : name}
        name={name}
        type={inputType}
        defaultValue={
          value ??
          (name === "followUpAt" && suggestion?.followUpAt
            ? dateInput(suggestion.followUpAt)
            : "")
        }
        required={required}
        step={inputType === "number" ? "1" : undefined}
        min={inputType === "number" ? "0" : undefined}
      />
    </label>
  )
  const ownerSelect = (
    name = "ownerUserId",
    value = lead?.ownerUserId ?? task?.assignedUserId ?? data.actor.id,
  ) => (
    <label>
      {name === "ownerUserId" ? "Primary owner" : "Responsible founder"}
      {name === "ownerUserId" && (
        <input type="hidden" name="joint" value="off" />
      )}
      <select name={name} defaultValue={value ?? data.actor.id}>
        {data.users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.displayName}
          </option>
        ))}
      </select>
    </label>
  )
  const businessSelect = (
    <label>
      Business
      <select
        name="prospectId"
        value={prospectId}
        required={kind === "activity" || kind === "contact"}
        onChange={(e) => setProspectId(e.target.value)}
      >
        <option value="">Select business</option>
        {data.leads.map((l) => (
          <option key={l.id} value={l.id}>
            {l.businessName}
          </option>
        ))}
      </select>
    </label>
  )
  const contactSelect = (
    <label>
      Contact
      <select name="contactId" defaultValue={task?.contactId ?? ""}>
        <option value="">No specific contact</option>
        {data.contacts
          .filter((c) => c.prospectId === Number(prospectId))
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.suppressed ? " · Opted out" : ""}
            </option>
          ))}
      </select>
    </label>
  )
  return (
    <dialog
      className="cc-dialog"
      onCancel={(e) => {
        e.preventDefault()
        if (!busy) close()
      }}
    >
      <header>
        <h2>{label(kind.replace(/([A-Z])/g, " $1"))}</h2>
        <button type="button" title="Close" disabled={busy} onClick={close}>
          <X size={20} />
        </button>
      </header>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setLocalError("")
          const values: Record<string, unknown> = Object.fromEntries(
            new FormData(e.currentTarget),
          )
          try {
            for (const name of [
              "prospectId",
              "contactId",
              "clientId",
              "invoiceId",
              "monthlyAmount",
              "oneOffAmount",
              "amount",
              "confidence",
              "recurrenceDays",
              "estimatedProjectValue",
              "estimatedMonthlyRetainer",
            ]) {
              if (values[name] !== undefined && values[name] !== "")
                values[name] = Number(values[name])
              else if (values[name] === "") delete values[name]
            }
            for (const name of [
              "followUpAt",
              "dueAt",
              "startsAt",
              "endsAt",
              "receivedAt",
              "expectedAt",
              "expectedCloseAt",
            ])
              if (values[name])
                values[name] = londonInputToISO(String(values[name]))
            for (const name of [
              "confirmed",
              "connectionConfirmed",
              "joint",
              "allowDuplicate",
              "acknowledgeRecentContact",
              "decisionMaker",
              "suppressed",
            ])
              if (values[name] !== undefined)
                values[name] = values[name] === "on"
            void save({
              ...values,
              action: kind,
              version: contact?.version ?? lead?.version ?? task?.version,
              id: task?.id,
              contactId: kind === "contact" ? contact?.id : values.contactId,
              prospectId: lead?.id ?? values.prospectId,
              requestKey,
              direction: values.direction ?? "internal",
            })
          } catch (e) {
            setLocalError(e instanceof Error ? e.message : "Invalid entry")
          }
        }}
      >
        {kind === "activity" && (
          <details>
            <summary>Natural-language note</summary>
            <label>
              Note
              <textarea
                name="naturalLanguageNote"
                value={naturalNote}
                onChange={(e) => setNaturalNote(e.target.value)}
              />
            </label>
            <button
              type="button"
              onClick={() => {
                const value = suggestCommercialActivity(
                  naturalNote,
                  data.leads,
                  new Date(data.serverTime),
                )
                setSuggestion(value)
                if (value.type) setType(value.type)
                if (value.prospectId) setProspectId(String(value.prospectId))
              }}
            >
              Review suggested entry
            </button>
            {suggestion && (
              <p>
                {suggestion.prospectId
                  ? `Business: ${data.leads.find((l) => l.id === suggestion.prospectId)?.businessName}.`
                  : "Select the business; the note does not identify a unique match."}{" "}
                {suggestion.followUpAt
                  ? `Suggested follow-up: ${dateLabel(suggestion.followUpAt)} (Europe/London).`
                  : "No follow-up date inferred."}
              </p>
            )}
          </details>
        )}
        {(kind === "createProspect" || kind === "updateProspect") && (
          <>
            {field(
              "businessName",
              "Business name",
              "text",
              lead?.businessName,
              true,
            )}
            {field("websiteUrl", "Website URL", "url", lead?.websiteUrl)}
            {field("location", "Location", "text", lead?.location)}
            {ownerSelect()}
            <label className="cc-check">
              <input
                type="checkbox"
                name="joint"
                defaultChecked={lead?.joint}
              />{" "}
              Joint opportunity
            </label>
            <label>
              Source
              <select name="source" defaultValue={lead?.source ?? "local"}>
                {PROSPECT_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {label(s)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Notes
              <textarea
                name="opportunityNotes"
                defaultValue={lead?.opportunityNotes ?? ""}
              />
            </label>
            {kind === "createProspect" ? (
              <>
                {field(
                  "followUpAt",
                  "Research reminder (Europe/London)",
                  "datetime-local",
                )}
                <label className="cc-check">
                  <input name="allowDuplicate" type="checkbox" /> I reviewed
                  matching businesses and intend a separate record
                </label>
              </>
            ) : (
              <>
                <label>
                  Stage
                  <select name="stage" defaultValue={lead?.stage}>
                    {[...COMMERCIAL_STAGES, "follow_up_due"].map((s) => (
                      <option key={s} value={s}>
                        {COMMERCIAL_STAGE_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </label>
                {field(
                  "nextAction",
                  "Next action / handover note",
                  "text",
                  lead?.nextAction,
                )}
                {field("lostReason", "Lost reason", "text", lead?.lostReason)}
                {field(
                  "confidence",
                  "Close confidence (%)",
                  "number",
                  lead?.confidence,
                )}
                {field(
                  "expectedCloseAt",
                  "Expected close (Europe/London)",
                  "datetime-local",
                )}
                {field(
                  "estimatedProjectValue",
                  "Build estimate (GBP)",
                  "number",
                  lead?.estimatedProjectValue,
                )}
                {field(
                  "estimatedMonthlyRetainer",
                  "Retainer estimate (GBP)",
                  "number",
                  lead?.estimatedMonthlyRetainer,
                )}
              </>
            )}
          </>
        )}
        {kind === "activity" && (
          <>
            {businessSelect}
            {contactSelect}
            <label>
              Direction
              <select
                name="direction"
                defaultValue={
                  ["phone_call", "email", "whatsapp"].includes(type)
                    ? "outbound"
                    : "internal"
                }
                key={type}
              >
                <option value="outbound">Founder contacted business</option>
                <option value="inbound">Business contacted us</option>
                <option value="internal">Internal commercial progress</option>
              </select>
            </label>
            <label>
              Activity
              <select
                name="type"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                {COMMERCIAL_ACTIVITIES.map((t) => (
                  <option key={t} value={t}>
                    {label(t)}
                  </option>
                ))}
              </select>
            </label>
            {type === "phone_call" ? (
              <label>
                Outcome
                <select name="outcome">
                  {CALL_OUTCOMES.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </label>
            ) : (
              field("outcome", "Outcome", "text", "", true)
            )}
            <label>
              Notes
              <textarea name="notes" />
            </label>
            {field("nextAction", "Next action")}
            {field("followUpAt", "Follow-up (Europe/London)", "datetime-local")}
            {ownerSelect("assignedUserId")}
            <label className="cc-check">
              <input name="confirmed" type="checkbox" required /> I confirm this
              activity occurred
            </label>
            <label className="cc-check">
              <input name="connectionConfirmed" type="checkbox" /> Completed a
              two-way conversation with the selected decision-maker
            </label>
            <label className="cc-check">
              <input name="acknowledgeRecentContact" type="checkbox" /> I
              reviewed recent shared outreach
            </label>
          </>
        )}
        {kind === "contact" && (
          <>
            {businessSelect}
            {field("name", "Contact name", "text", contact?.name, true)}
            {field("email", "Email", "email", contact?.email)}
            {field("phone", "Telephone", "tel", contact?.phone)}
            <label className="cc-check">
              <input
                type="checkbox"
                name="decisionMaker"
                defaultChecked={contact?.decisionMaker}
              />{" "}
              Decision-maker
            </label>
            <label className="cc-check">
              <input
                type="checkbox"
                name="suppressed"
                defaultChecked={contact?.suppressed}
              />{" "}
              Opted out / suppress outreach
            </label>
            <label>
              Notes
              <textarea name="notes" defaultValue={contact?.notes ?? ""} />
            </label>
          </>
        )}
        {kind === "task" && (
          <>
            {field("title", "Task", "text", task?.title, true)}
            {businessSelect}
            {contactSelect}
            {ownerSelect("assignedUserId")}
            <label>
              Priority
              <select name="priority" defaultValue={task?.priority ?? "medium"}>
                {["low", "medium", "high"].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            {field(
              "dueAt",
              "Due (Europe/London)",
              "datetime-local",
              undefined,
              !task,
            )}
            {task && (
              <>
                <p>{dateLabel(task.dueAt)}</p>
                <label>
                  Status
                  <select name="status" defaultValue={task.status}>
                    {["open", "completed", "cancelled"].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
              </>
            )}
            {field(
              "recurrenceDays",
              "Repeat every N days (optional)",
              "number",
              task?.recurrenceDays,
            )}
            <label>
              Notes
              <textarea name="notes" defaultValue={task?.notes ?? ""} />
            </label>
          </>
        )}
        {["contract", "payment", "forecast"].includes(kind) && (
          <>
            <label>
              Client
              <select name="clientId" required>
                <option value="">Select client</option>
                {data.clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            {kind !== "forecast" && (
              <label>
                Revenue category
                <select
                  name="category"
                  onChange={(event) => {
                    if (kind !== "contract") return
                    const category = event.currentTarget.value
                    const settings = data.settings.find(
                      (setting) => setting.key === "config",
                    )?.value
                    const monthly =
                      event.currentTarget.form?.elements.namedItem(
                        "monthlyAmount",
                      )
                    const oneOff =
                      event.currentTarget.form?.elements.namedItem(
                        "oneOffAmount",
                      )
                    if (monthly instanceof HTMLInputElement)
                      monthly.value = String(
                        ["retainer", "premium_partnership"].includes(category)
                          ? Number(
                              settings?.partnershipPrice ??
                                DEFAULT_COMMERCIAL_CONFIG.partnershipPrice,
                            )
                          : 0,
                      )
                    if (oneOff instanceof HTMLInputElement)
                      oneOff.value = String(
                        category === "website_build"
                          ? Number(
                              settings?.websitePrice ??
                                DEFAULT_COMMERCIAL_CONFIG.websitePrice,
                            )
                          : category === "growth_audit"
                            ? Number(
                                settings?.auditPrice ??
                                  DEFAULT_COMMERCIAL_CONFIG.auditPrice,
                              )
                            : 0,
                      )
                  }}
                >
                  {REVENUE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {label(c)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {kind === "contract" && (
              <>
                {field(
                  "monthlyAmount",
                  "Monthly amount (pence)",
                  "number",
                  Number(
                    data.settings.find((setting) => setting.key === "config")
                      ?.value.partnershipPrice ??
                      DEFAULT_COMMERCIAL_CONFIG.partnershipPrice,
                  ),
                  true,
                )}
                {field(
                  "oneOffAmount",
                  "One-off amount (pence)",
                  "number",
                  0,
                  true,
                )}
                {field(
                  "startsAt",
                  "Starts (Europe/London)",
                  "datetime-local",
                  undefined,
                  true,
                )}
                {field(
                  "endsAt",
                  "Ends (optional, Europe/London)",
                  "datetime-local",
                )}
                <label>
                  Status
                  <select name="status">
                    <option value="draft">Draft / unconfirmed</option>
                    <option value="confirmed">Confirmed signed contract</option>
                  </select>
                </label>
              </>
            )}
            {kind === "payment" && (
              <>
                {field(
                  "amount",
                  "Received amount (pence)",
                  "number",
                  undefined,
                  true,
                )}
                {field(
                  "reference",
                  "Unique bank/provider reference",
                  "text",
                  undefined,
                  true,
                )}
                <label>
                  Invoice allocation
                  <select name="invoiceId">
                    <option value="">Unallocated payment</option>
                    {data.invoices
                      .filter((i) => !["draft", "void"].includes(i.status))
                      .map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.invoiceNumber} ·{" "}
                          {data.clients.find((c) => c.id === i.clientId)?.name}
                        </option>
                      ))}
                  </select>
                </label>
                {field(
                  "receivedAt",
                  "Received (Europe/London)",
                  "datetime-local",
                  undefined,
                  true,
                )}
              </>
            )}
            {kind === "forecast" ? (
              <>
                {field(
                  "amount",
                  "Expected variable amount (pence)",
                  "number",
                  undefined,
                  true,
                )}
                {field(
                  "expectedAt",
                  "Expected (Europe/London)",
                  "datetime-local",
                  undefined,
                  true,
                )}
                <label>
                  Forecast basis
                  <textarea name="notes" required />
                </label>
              </>
            ) : (
              <>
                <label>
                  Evidence / record reference
                  <textarea name="evidence" required />
                </label>
                <label className="cc-check">
                  <input name="confirmed" type="checkbox" /> I verified the
                  signed contract or received payment
                </label>
              </>
            )}
          </>
        )}
        {(error || localError) && (
          <p role="alert" className="cc-error">
            {localError || error}
          </p>
        )}
        <footer>
          <button type="button" disabled={busy} onClick={close}>
            Cancel
          </button>
          <button className="cc-primary" disabled={busy}>
            <Check size={18} /> {busy ? "Saving..." : "Save record"}
          </button>
        </footer>
      </form>
    </dialog>
  )
}
