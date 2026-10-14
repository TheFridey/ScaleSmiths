"use client";
import { useCallback, useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  Search,
  ShieldCheck,
  Inbox,
  Activity,
  Target,
} from "lucide-react";
import { MEGATON_OFFERS, SCORE_WEIGHTS } from "@/lib/megaton";
import {
  AddProspect,
  AISearch,
  SocialOutreach,
  ApprovalNotifications,
  type GrowthSnapshot,
} from "./MegatonGrowth";

type Row = { [key: string]: string | number | boolean | null };
interface Snapshot {
  growth: GrowthSnapshot;
  totalCount: number;
  page: number;
  pageSize: number;
  campaigns: Row[];
  leads: Row[];
  evidence: Row[];
  threads: Row[];
  messages: Row[];
  drafts: Row[];
  outbox: Row[];
  jobs: Row[];
  events: Row[];
  usage: Row[];
  usageRecords: Row[];
  actorId: string;
  connection: Row;
  permissions: { write: boolean; approve: boolean; configure: boolean };
  readiness: {
    enabled: boolean;
    externalEnabled: boolean;
    sendEnabled: boolean;
    stopped: boolean;
    mailboxConfigured: boolean;
    dailySendLimit: number;
  };
  scores: {
    prospectId: number;
    score: number;
    status: string;
    coverage: number;
    factors: {
      category: string;
      weight: number;
      points: number;
      evidence: unknown;
    }[];
  }[];
}
const field =
  "w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2.5 text-sm text-slate-100 focus:border-amber-300 focus:outline-none";
const button =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-amber-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:opacity-40";
const secondary =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-sm text-slate-200 hover:bg-white/5 disabled:opacity-40";
const panel = "rounded-2xl border border-white/10 bg-white/[.025] p-5";
function stamp(value: Row[string]) {
  return value ? new Date(String(value)).toLocaleString("en-GB") : "—";
}
function Form({
  children,
  onSubmit,
  busy,
  label,
}: {
  children: React.ReactNode;
  onSubmit: (values: Record<string, string>) => Promise<void>;
  busy: boolean;
  label: string;
}) {
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(
          Object.fromEntries(new FormData(event.currentTarget)) as Record<
            string,
            string
          >,
        );
      }}
    >
      {children}
      <button className={button} disabled={busy}>
        {label}
        <ArrowRight size={16} />
      </button>
    </form>
  );
}
function Input({
  name,
  label,
  placeholder,
  type = "text",
  required = true,
  step,
}: {
  name: string;
  label: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  step?: string;
}) {
  return (
    <label className="block space-y-1.5 text-sm text-slate-300">
      <span>{label}</span>
      <input
        className={field}
        name={name}
        placeholder={placeholder}
        type={type}
        required={required}
        step={step}
      />
    </label>
  );
}
export function MegatonWorkspace() {
  const [data, setData] = useState<Snapshot | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState("prospects"),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(1),
    [leadId, setLeadId] = useState(""),
    [threadId, setThreadId] = useState(""),
    [candidates, setCandidates] = useState<Row[]>([]);
  const loadSequence = useRef(0);
  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    try {
      const response = await fetch(
        `/api/megaton?${new URLSearchParams({ query, page: String(page) })}`,
        { cache: "no-store" },
      );
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Workspace unavailable");
      if (sequence === loadSequence.current) {
        setData(json);
        setError("");
      }
    } catch (e) {
      if (sequence === loadSequence.current)
        setError(e instanceof Error ? e.message : "Workspace unavailable");
    }
  }, [query, page]);
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (
      requested &&
      ["prospects", "discovery", "social", "inbox", "operations"].includes(
        requested,
      )
    )
      setTab(requested);
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    const interval = setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        !document.activeElement?.matches("input,textarea,select")
      )
        void load();
    }, 30000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [load]);
  async function act(action: string, values: Record<string, unknown> = {}) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/megaton", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...values }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Operation failed");
      if (action === "discover") setCandidates(result.candidates || []);
      await load();
      setNotice(
        action === "dispatch"
          ? "Mailcow accepted the message. Inbox placement is not confirmed."
          : "Saved successfully.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operation failed");
    } finally {
      setBusy(false);
    }
  }
  const lead = data?.leads.find((l) => String(l.id) === leadId),
    thread = data?.threads.find((t) => String(t.id) === threadId);
  const write = !!data?.permissions.write,
    approve = !!data?.permissions.approve;
  const ready = !!data?.readiness.enabled;
  return (
    <main className="mx-auto w-full max-w-[1440px] space-y-6 px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[.2em] text-amber-300">
            ScaleSmiths acquisition workspace
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Megaton</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Discover with evidence. Review every message. Keep conversations in
            human hands.
          </p>
        </div>
        <button
          className={secondary}
          onClick={() => void load()}
          disabled={busy}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </header>
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200"
        >
          {error}
        </div>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl bg-emerald-400/10 p-3 text-sm text-emerald-200"
        >
          {notice}
        </p>
      )}
      {!data ? (
        <p className="text-slate-400">
          {error
            ? "Workspace could not load. Review the error above and check server configuration and database readiness."
            : "Loading workspace…"}
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className={panel}>
              <p className="text-xs uppercase tracking-wider text-slate-400">
                Shared pipeline
              </p>
              <p className="mt-2 text-2xl font-semibold">{data.totalCount}</p>
              <Link
                className="mt-2 inline-block text-sm text-amber-300"
                href="/command-centre"
              >
                Open Command Centre →
              </Link>
            </div>
            <div className={panel}>
              <p className="text-xs uppercase tracking-wider text-slate-400">
                Needs human attention
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {data.threads.filter(
                  (t) => t.status === "human_active" || t.status === "review",
                ).length +
                  data.growth.social.filter(
                    (s) => s.state === "review" || s.state === "unknown",
                  ).length}
              </p>
              <p className="mt-2 text-sm text-slate-400">
                Quotation, meeting and incoming message review
              </p>
            </div>
            <div className={panel}>
              <p className="text-xs uppercase tracking-wider text-slate-400">
                Company Mailcow
              </p>
              <p className="mt-2 font-semibold">
                {!data.readiness.mailboxConfigured
                  ? "Awaiting configuration"
                  : !data.connection.active
                    ? "Awaiting activation"
                    : data.readiness.stopped
                      ? "Stopped"
                      : !data.connection.last_synced_at
                        ? "Awaiting initial sync"
                        : Date.now() -
                              new Date(
                                String(data.connection.last_synced_at),
                              ).valueOf() >
                            120000
                          ? "Sync needs review"
                          : "Synced"}
              </p>
              <p className="mt-2 text-sm text-slate-400">
                {data.readiness.sendEnabled
                  ? "Human-approved sends enabled"
                  : "Sending disabled"}{" "}
                · limit {data.readiness.dailySendLimit}/day
              </p>
            </div>
          </div>
          {!ready && (
            <div className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm text-amber-200">
              Megaton is disabled. Configure MEGATON_ENABLED to enable local
              workspace changes. External work and sending have separate
              controls.
            </div>
          )}
          <nav
            aria-label="Megaton views"
            className="sticky top-14 z-10 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-[#101419] p-2 sm:flex sm:overflow-x-auto lg:top-0"
          >
            {[
              { id: "prospects", label: "Prospects", Icon: Target },
              { id: "discovery", label: "Discovery", Icon: Search },
              { id: "inbox", label: "Inbox & approvals", Icon: Inbox },
              { id: "social", label: "Social outreach", Icon: Target },
              { id: "operations", label: "Operations", Icon: Activity },
            ].map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                aria-current={tab === id ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm ${tab === id ? "bg-amber-300 text-slate-950" : "text-slate-400 hover:bg-white/5"}`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </nav>
          {tab === "prospects" && (
            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
              <section className={panel}>
                <h2 className="text-lg font-semibold">Shared prospects</h2>
                {write && <AddProspect act={act} busy={busy} />}
                <label className="mt-4 block">
                  <span className="sr-only">Search prospects</span>
                  <input
                    className={field}
                    placeholder="Search business, town or industry"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPage(1);
                    }}
                  />
                </label>
                <div className="mt-4 max-h-[620px] space-y-2 overflow-y-auto">
                  {data.leads.map((l) => {
                    const score = data.scores.find(
                      (s) => s.prospectId === l.id,
                    );
                    return (
                      <button
                        key={String(l.id)}
                        className={`w-full rounded-xl border p-4 text-left ${leadId === String(l.id) ? "border-amber-300/50 bg-amber-300/5" : "border-white/10 hover:bg-white/5"}`}
                        onClick={() => setLeadId(String(l.id))}
                      >
                        <span className="block font-medium">
                          {l.business_name}
                        </span>
                        <span className="mt-1 block text-xs text-slate-400">
                          {l.location || "Location unknown"} ·{" "}
                          {l.industry || "Industry unknown"} · {l.stage}
                        </span>
                        <span className="mt-2 block text-xs text-amber-200">
                          {score?.status}{" "}
                          {score?.status === "Provisional fit"
                            ? `· ${score.score}/100`
                            : ""}
                        </span>
                      </button>
                    );
                  })}
                  {!data.leads.length && (
                    <p className="py-8 text-sm text-slate-400">
                      Create a campaign and import sourced UK prospects, or add
                      them in Command Centre.
                    </p>
                  )}
                </div>
                <div className="mt-4 flex items-center justify-between gap-2 text-xs text-slate-400">
                  <button
                    className={secondary}
                    disabled={busy || page === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </button>
                  <span>
                    Page {data.page} ? {data.totalCount} matches
                  </span>
                  <button
                    className={secondary}
                    disabled={busy || page * data.pageSize >= data.totalCount}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </div>
              </section>
              <section className={panel}>
                {!lead ? (
                  <p className="py-12 text-center text-slate-400">
                    Select a prospect to review evidence and prepare outreach.
                  </p>
                ) : (
                  <>
                    <h2 className="text-xl font-semibold">
                      {lead.business_name}
                    </h2>
                    <p className="mt-1 text-sm text-slate-400">
                      Fit scoring uses sourced evidence, never a promised
                      closing probability.
                    </p>
                    <details className="mt-4 rounded-xl bg-white/5 p-3">
                      <summary className="cursor-pointer text-sm font-medium">
                        Explain this score
                      </summary>
                      <p className="mt-2 text-xs text-slate-400">
                        Model megaton-evidence-v1 ? unknown data earns no
                        points. Evidence expires after 90 days.
                      </p>
                      <dl className="mt-3 space-y-2">
                        {data.scores
                          .find((s) => s.prospectId === lead.id)
                          ?.factors.map((f) => (
                            <div
                              key={f.category}
                              className="flex justify-between gap-3 text-sm"
                            >
                              <dt>{f.category}</dt>
                              <dd>
                                {f.evidence
                                  ? `${f.points} / ${f.weight}`
                                  : "Unknown ? no evidence"}
                              </dd>
                            </div>
                          ))}
                      </dl>
                    </details>
                    <div className="my-5 space-y-3">
                      {data.evidence
                        .filter((e) => e.prospect_id === lead.id)
                        .map((e) => (
                          <div
                            key={String(e.id)}
                            className="rounded-xl bg-white/5 p-3 text-sm"
                          >
                            <p>{e.observation}</p>
                            <p className="mt-1 text-xs text-slate-400">
                              {e.category} · confidence{" "}
                              {Math.round(Number(e.confidence) * 100)}% ·{" "}
                              {stamp(e.observed_at)}
                            </p>
                            <a
                              href={String(e.source_url)}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1 inline-block break-all text-xs text-amber-300"
                            >
                              Source →
                            </a>
                          </div>
                        ))}
                    </div>
                    {write && (
                      <>
                        <button
                          className={secondary}
                          disabled={busy || !ready}
                          onClick={() =>
                            void act("research", { prospectId: lead.id })
                          }
                        >
                          Queue bounded website research
                        </button>
                        <details className="mt-5">
                          <summary className="cursor-pointer text-sm font-medium">
                            Add sourced evidence
                          </summary>
                          <div className="mt-4">
                            <Form
                              busy={busy || !ready}
                              label="Save evidence"
                              onSubmit={(v) =>
                                act("evidence", {
                                  ...v,
                                  prospectId: lead.id,
                                  confidence: Number(v.confidence),
                                  strength: Number(v.strength),
                                  observedAt: new Date(
                                    v.observedAt,
                                  ).toISOString(),
                                })
                              }
                            >
                              <label className="block text-sm">
                                Category
                                <select
                                  name="category"
                                  aria-label="Evidence category"
                                  className={field}
                                >
                                  {Object.entries(SCORE_WEIGHTS).map(
                                    ([key, weight]) => (
                                      <option key={key} value={key}>
                                        {key} · {weight} points
                                      </option>
                                    ),
                                  )}
                                </select>
                              </label>
                              <Input name="observation" label="Observed fact" />
                              <Input
                                name="sourceUrl"
                                label="Source URL"
                                type="url"
                              />
                              <Input
                                name="observedAt"
                                label="Observation date"
                                type="datetime-local"
                              />
                              <Input
                                name="confidence"
                                label="Confidence (0–1)"
                              />
                              <Input
                                name="strength"
                                label="Fit strength (0–1)"
                              />
                            </Form>
                          </div>
                        </details>
                        <div className="mt-6 border-t border-white/10 pt-5">
                          <h3 className="mb-3 font-medium">
                            Prepare a reviewable draft
                          </h3>
                          <Form
                            busy={busy || !ready}
                            label="Create draft"
                            onSubmit={(v) =>
                              act("draft", { ...v, prospectId: lead.id })
                            }
                          >
                            <Input
                              name="recipient"
                              label="Recipient"
                              type="email"
                              placeholder={String(lead.email || "")}
                            />
                            <label className="block text-sm">
                              Offer
                              <select
                                name="offer"
                                aria-label="Offer"
                                className={field}
                              >
                                {Object.entries(MEGATON_OFFERS).map(
                                  ([id, o]) => (
                                    <option key={id} value={id}>
                                      {o.label}
                                      {o.includesAudit
                                        ? " · audit included"
                                        : ""}
                                    </option>
                                  ),
                                )}
                              </select>
                            </label>
                          </Form>
                        </div>
                      </>
                    )}
                  </>
                )}
              </section>
            </div>
          )}
          {tab === "discovery" && (
            <div>
              {write && <AISearch growth={data.growth} act={act} busy={busy} />}
              <div className="grid gap-5 lg:grid-cols-2">
                <section className={panel}>
                  <h2 className="mb-2 text-lg font-semibold">
                    Town-based campaigns
                  </h2>
                  <p className="mb-5 text-sm text-slate-400">
                    UK only. Create campaigns to organise sourced imports. AI
                    search and Companies House discovery have separate
                    configuration.
                  </p>
                  {write && (
                    <Form
                      busy={busy || !ready}
                      label="Create campaign"
                      onSubmit={(v) => act("campaign", { ...v, country: "GB" })}
                    >
                      <Input
                        name="name"
                        label="Campaign name"
                        placeholder="Hucknall · local trades"
                      />
                      <Input
                        name="town"
                        label="UK town"
                        placeholder="Hucknall"
                      />
                      <Input
                        name="industry"
                        label="Industry"
                        placeholder="Plumbing"
                      />
                    </Form>
                  )}
                  <div className="mt-6 space-y-3">
                    {data.campaigns.map((c) => (
                      <div
                        className="rounded-xl bg-white/5 p-3"
                        key={String(c.id)}
                      >
                        <p className="font-medium">{c.name}</p>
                        <p className="text-sm text-slate-400">
                          {c.town} · {c.industry} · GB
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
                <section className={panel}>
                  <h2 className="mb-2 text-lg font-semibold">
                    Registered-company discovery
                  </h2>
                  <p className="mb-4 text-sm text-slate-400">
                    Optional Companies House connection. Registered office only;
                    verify trading presence before import. Sole traders are not
                    covered.
                  </p>
                  {write && (
                    <Form
                      busy={busy || !ready}
                      label="Find registered companies"
                      onSubmit={(v) => act("discover", v)}
                    >
                      <Input
                        name="town"
                        label="UK town"
                        placeholder="Hucknall"
                      />
                      <Input
                        name="sicCode"
                        label="Five-digit SIC industry code"
                        placeholder="43220"
                      />
                    </Form>
                  )}
                  <div className="my-5 space-y-2">
                    {candidates.map((c) => (
                      <div
                        key={String(c.companyNumber)}
                        className="rounded-xl bg-white/5 p-3 text-sm"
                      >
                        <p>{c.businessName}</p>
                        <p className="text-xs text-slate-400">
                          Registered office: {c.town} {c.postcode}
                        </p>
                        <a
                          className="text-amber-300"
                          href={String(c.sourceUrl)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Verify source ?
                        </a>
                      </div>
                    ))}
                  </div>
                  <h3 className="mb-2 mt-6 font-semibold">
                    Import a verified business
                  </h3>
                  <p className="mb-5 text-sm text-slate-400">
                    Verify the town and source rights. Existing matches are
                    reused; ambiguous branches require review.
                  </p>
                  {write && (
                    <Form
                      busy={busy || !ready || !data.campaigns.length}
                      label="Import into shared pipeline"
                      onSubmit={(v) => act("import", { ...v, country: "GB" })}
                    >
                      <label className="block text-sm">
                        Campaign
                        <select
                          name="campaignId"
                          aria-label="Campaign"
                          className={field}
                          required
                        >
                          {data.campaigns.map((c) => (
                            <option key={String(c.id)} value={String(c.id)}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <Input name="businessName" label="Business name" />
                      <Input name="town" label="Verified UK town" />
                      <Input
                        name="website"
                        label="Business website"
                        type="url"
                      />
                      <Input
                        name="email"
                        label="Public business email (optional)"
                        type="email"
                        required={false}
                      />
                      <Input
                        name="sourceUrl"
                        label="Discovery source URL"
                        type="url"
                      />
                      <Input
                        name="sourceReference"
                        label="Source permission and location evidence"
                        placeholder="Licensed source reference and verified town evidence"
                      />
                    </Form>
                  )}
                </section>
              </div>
            </div>
          )}
          {tab === "social" && (
            <SocialOutreach
              growth={data.growth}
              leads={data.leads}
              act={act}
              busy={busy}
              approve={approve}
              write={write}
              actorId={data.actorId}
            />
          )}
          {tab === "operations" && approve && (
            <ApprovalNotifications growth={data.growth} act={act} busy={busy} />
          )}
          {tab === "inbox" && (
            <div>
              {data.growth.social.some(
                (s) => s.state === "review" || s.state === "unknown",
              ) && (
                <div className="mb-4 rounded-xl border border-amber-300/20 p-4 text-sm">
                  Social messages also need review.{" "}
                  <button
                    className="text-amber-300 underline"
                    onClick={() => setTab("social")}
                  >
                    Open social approvals
                  </button>
                </div>
              )}
              <div className="grid items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
                <section className={panel}>
                  <h2 className="mb-4 font-semibold">Company conversations</h2>
                  <div className="space-y-2">
                    {data.threads.map((t) => (
                      <button
                        key={String(t.id)}
                        onClick={() => setThreadId(String(t.id))}
                        className={`w-full rounded-xl p-3 text-left ${threadId === String(t.id) ? "bg-amber-300/10" : "bg-white/5"}`}
                      >
                        <span className="block break-all text-sm font-medium">
                          {t.recipient}
                        </span>
                        <span className="mt-1 block text-xs text-slate-400">
                          {String(t.status).replaceAll("_", " ")} ·{" "}
                          {t.owner_user_id === data.actorId
                            ? "Owned by you"
                            : t.owner_user_id
                              ? `Owned by ${t.owner_name || "another user"}`
                              : "Unassigned"}
                        </span>
                      </button>
                    ))}
                    {!data.threads.length && (
                      <p className="text-sm text-slate-400">
                        No conversations yet. Prepare a prospect draft or
                        activate and sync the company mailbox.
                      </p>
                    )}
                  </div>
                </section>
                <section className={panel}>
                  {!thread ? (
                    <p className="py-16 text-center text-slate-400">
                      Select a conversation.
                    </p>
                  ) : (
                    <>
                      <h2 className="break-all text-lg font-semibold">
                        {thread.recipient}
                      </h2>
                      <p className="mt-1 text-sm text-slate-400">
                        {thread.subject}
                      </p>
                      <div className="my-4 flex flex-wrap gap-2">
                        {write && (
                          <>
                            <button
                              className={secondary}
                              disabled={busy || !ready}
                              onClick={() =>
                                void act("claim", {
                                  id: thread.id,
                                  revision: thread.revision,
                                })
                              }
                            >
                              Take ownership
                            </button>
                            <button
                              className={secondary}
                              disabled={
                                busy ||
                                !ready ||
                                thread.status === "closed" ||
                                (!!thread.owner_user_id &&
                                  thread.owner_user_id !== data.actorId)
                              }
                              onClick={() =>
                                void act("close", {
                                  id: thread.id,
                                  revision: thread.revision,
                                })
                              }
                            >
                              Close conversation
                            </button>
                            <button
                              className={secondary}
                              disabled={
                                busy ||
                                !ready ||
                                thread.owner_user_id !== data.actorId
                              }
                              onClick={() =>
                                void act("handback", {
                                  id: thread.id,
                                  revision: thread.revision,
                                })
                              }
                            >
                              Explicit handback
                            </button>
                            <button
                              className={secondary}
                              disabled={busy || !ready}
                              onClick={() =>
                                void act("suppress", {
                                  id: thread.id,
                                  revision: thread.revision,
                                  reason:
                                    "Founder requested no further contact",
                                })
                              }
                            >
                              Suppress contact
                            </button>
                          </>
                        )}
                      </div>
                      {data.messages
                        .filter((m) => m.conversation_id === thread.id)
                        .slice()
                        .reverse()
                        .map((m) => (
                          <article
                            key={String(m.id)}
                            className="mb-3 rounded-xl bg-white/5 p-4"
                          >
                            <p className="mb-2 text-xs text-slate-400">
                              {m.direction} · {stamp(m.occurred_at)} ·{" "}
                              {m.classification}
                            </p>
                            <p className="whitespace-pre-wrap break-words text-sm">
                              {m.body}
                            </p>
                          </article>
                        ))}
                      {write && (
                        <details className="my-5">
                          <summary className="cursor-pointer text-sm font-medium">
                            Contact eligibility and evidence
                          </summary>
                          <div className="mt-4">
                            <Form
                              busy={busy || !ready}
                              label="Save eligibility"
                              onSubmit={(v) =>
                                act("eligibility", {
                                  ...v,
                                  id: thread.id,
                                  revision: thread.revision,
                                })
                              }
                            >
                              <label className="block text-sm">
                                Subscriber type
                                <select
                                  name="subscriberType"
                                  aria-label="Subscriber type"
                                  className={field}
                                  defaultValue={String(
                                    thread.subscriber_type || "unknown",
                                  )}
                                >
                                  <option value="unknown">
                                    Unknown — sending blocked
                                  </option>
                                  <option value="corporate">
                                    Verified corporate subscriber
                                  </option>
                                  <option value="individual">
                                    Individual / sole trader
                                  </option>
                                </select>
                              </label>
                              <label className="block text-sm">
                                Lawful basis
                                <select
                                  name="legalBasis"
                                  aria-label="Lawful basis"
                                  className={field}
                                >
                                  <option value="consent">
                                    Recorded consent
                                  </option>
                                  <option value="legitimate_interests">
                                    Documented legitimate interests — corporate
                                    only
                                  </option>
                                </select>
                              </label>
                              <Input
                                name="reference"
                                label="Consent or corporate eligibility / transparency evidence"
                              />
                            </Form>
                          </div>
                        </details>
                      )}
                      {data.drafts
                        .filter((d) => d.conversation_id === thread.id)
                        .map((d) => {
                          const out = data.outbox.find(
                            (o) => o.draft_id === d.id,
                          );
                          return (
                            <article
                              className="mt-5 rounded-xl border border-white/10 p-4"
                              key={`${d.id}:${d.revision}`}
                            >
                              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-amber-300">
                                Draft · revision {d.revision} ·{" "}
                                {out?.state || "awaiting approval"}
                              </p>
                              {write ? (
                                <Form
                                  busy={busy || !ready}
                                  label="Save edits (invalidates approval)"
                                  onSubmit={(v) =>
                                    act("edit", {
                                      ...v,
                                      id: d.id,
                                      revision: d.revision,
                                    })
                                  }
                                >
                                  <label className="block text-sm">
                                    Subject
                                    <input
                                      className={field}
                                      name="subject"
                                      defaultValue={String(d.subject)}
                                      required
                                    />
                                  </label>
                                  <label className="block text-sm">
                                    Message
                                    <textarea
                                      className={`${field} min-h-56`}
                                      name="body"
                                      defaultValue={String(d.body)}
                                      required
                                    />
                                  </label>
                                </Form>
                              ) : (
                                <p className="whitespace-pre-wrap text-sm">
                                  {d.body}
                                </p>
                              )}
                              <div className="mt-4 flex flex-wrap gap-2">
                                {write && (
                                  <button
                                    className={secondary}
                                    disabled={
                                      busy ||
                                      !ready ||
                                      !!thread.owner_user_id ||
                                      thread.status === "human_active"
                                    }
                                    onClick={() =>
                                      void act("ai_draft", { id: d.id })
                                    }
                                  >
                                    Queue AI drafting
                                  </button>
                                )}
                                {approve && (
                                  <>
                                    <button
                                      className={secondary}
                                      disabled={
                                        busy ||
                                        !ready ||
                                        out?.state === "approved" ||
                                        out?.state === "sending" ||
                                        out?.state === "unknown"
                                      }
                                      onClick={() =>
                                        void act("approve", {
                                          id: d.id,
                                          revision: d.revision,
                                          threadRevision: thread.revision,
                                        })
                                      }
                                    >
                                      <ShieldCheck size={15} />
                                      Approve saved content
                                    </button>
                                    {out?.state === "approved" && (
                                      <button
                                        className={button}
                                        disabled={
                                          busy ||
                                          !ready ||
                                          !data.readiness.sendEnabled ||
                                          data.readiness.stopped ||
                                          !data.connection.active
                                        }
                                        onClick={() =>
                                          void act("dispatch", { id: out.id })
                                        }
                                      >
                                        <CheckCircle2 size={15} />
                                        Send approved message
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                              {out?.state === "unknown" && (
                                <p className="mt-3 text-sm text-red-200">
                                  Uncertain send. Check Mailcow before
                                  reconciliation in Operations; no retry is
                                  automatic.
                                </p>
                              )}
                            </article>
                          );
                        })}
                    </>
                  )}
                </section>
              </div>
            </div>
          )}
          {tab === "operations" && (
            <div className="grid items-start gap-5 lg:grid-cols-2">
              <section className={panel}>
                <h2 className="mb-3 text-lg font-semibold">
                  Connection & controls
                </h2>
                <p className="mb-5 text-sm text-slate-400">
                  Company mailbox only. Personal founder mailboxes are not
                  imported. Fill the root environment placeholders, then enable
                  external work separately.
                </p>
                <dl className="space-y-2 text-sm">
                  {Object.entries(data.readiness).map(([key, value]) => (
                    <div className="flex justify-between gap-4" key={key}>
                      <dt className="text-slate-400">
                        {
                          (
                            {
                              enabled: "Workspace enabled",
                              externalEnabled: "External connections enabled",
                              sendEnabled: "Approved sending enabled",
                              stopped: "Emergency stop",
                              mailboxConfigured: "Mailbox configured",
                              dailySendLimit: "Daily send limit",
                            } as Record<string, string>
                          )[key]
                        }
                      </dt>
                      <dd>{String(value)}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-5 flex flex-wrap gap-2">
                  {data.permissions.configure && (
                    <button
                      className={secondary}
                      disabled={busy || !ready}
                      onClick={() =>
                        void act("connection", {
                          active: !data.connection.active,
                        })
                      }
                    >
                      {data.connection.active
                        ? "Revoke mailbox"
                        : "Activate company mailbox"}
                    </button>
                  )}
                  {write && (
                    <>
                      <button
                        className={secondary}
                        disabled={busy || !ready}
                        onClick={() => void act("sync")}
                      >
                        Queue inbox sync
                      </button>
                      <button
                        className={button}
                        disabled={busy || !ready}
                        onClick={() => void act("work")}
                      >
                        Process next queued job
                      </button>
                    </>
                  )}
                </div>
                <h3 className="mb-3 mt-7 font-medium">Durable jobs</h3>
                <div className="space-y-2">
                  {data.jobs.map((j) => (
                    <div
                      key={String(j.id)}
                      className="rounded-xl bg-white/5 p-3 text-sm"
                    >
                      <p>
                        {j.kind} · {j.state} · {j.attempts}/3 attempts
                      </p>
                      {j.error_code && (
                        <p className="mt-1 text-xs text-red-200">
                          {j.error_code}
                        </p>
                      )}
                      {write &&
                        ["queued", "dead_letter", "failed"].includes(
                          String(j.state),
                        ) && (
                          <div className="mt-3 flex gap-2">
                            {j.state !== "queued" && (
                              <button
                                className={secondary}
                                disabled={busy || !ready}
                                onClick={() =>
                                  void act("job_retry", { id: j.id })
                                }
                              >
                                Retry job
                              </button>
                            )}
                            <button
                              className={secondary}
                              disabled={busy || !ready}
                              onClick={() =>
                                void act("job_cancel", { id: j.id })
                              }
                            >
                              Cancel job
                            </button>
                          </div>
                        )}
                    </div>
                  ))}
                  {!data.jobs.length && (
                    <p className="text-sm text-slate-400">No jobs queued.</p>
                  )}
                </div>
              </section>
              <section className={panel}>
                <h2 className="mb-3 text-lg font-semibold">
                  Send reconciliation
                </h2>
                {data.outbox
                  .filter((o) => o.state === "unknown")
                  .map((o) => (
                    <div
                      key={String(o.id)}
                      className="mb-4 rounded-xl border border-red-300/20 p-4"
                    >
                      <p className="mb-3 break-all text-xs text-slate-400">
                        Message ID {o.message_id}
                      </p>
                      {approve && (
                        <Form
                          busy={busy || !ready}
                          label="Record verified outcome"
                          onSubmit={(v) => act("reconcile", { ...v, id: o.id })}
                        >
                          <label className="block text-sm">
                            Verified Mailcow outcome
                            <select
                              className={field}
                              name="outcome"
                              aria-label="Verified Mailcow outcome"
                            >
                              <option value="accepted">
                                Confirmed accepted
                              </option>
                              <option value="cancelled">
                                Confirmed not sent
                              </option>
                            </select>
                          </label>
                          <Input
                            name="reference"
                            label="Mailcow log / message evidence"
                          />
                        </Form>
                      )}
                    </div>
                  ))}
                <h3 className="mb-3 mt-6 font-medium">Monthly AI usage</h3>
                <p className="mb-3 text-xs text-slate-400">
                  Token-cost estimates and uncertain reservations count against
                  spend caps; provider invoices remain separate.
                </p>
                {data.usage.map((u) => (
                  <p key={String(u.state)} className="text-sm">
                    {u.state}: {u.operations} operation(s) ? $
                    {(Number(u.microusd) / 1000000).toFixed(4)}
                  </p>
                ))}
                {data.usageRecords.map((u) => (
                  <div
                    key={String(u.id)}
                    className="mt-4 rounded-xl border border-amber-300/20 p-4"
                  >
                    <p className="mb-3 text-sm">
                      Uncertain provider cost · $
                      {(Number(u.reserved_microusd) / 1000000).toFixed(4)}{" "}
                      reserved
                    </p>
                    {data.permissions.configure && (
                      <Form
                        busy={busy || !ready}
                        label="Reconcile verified provider cost"
                        onSubmit={(v) =>
                          act("ai_reconcile", {
                            id: u.id,
                            actualMicrousd: Math.round(
                              Number(v.costUsd) * 1000000,
                            ),
                            reference: v.reference,
                          })
                        }
                      >
                        <Input
                          name="costUsd"
                          label="Confirmed provider cost (USD)"
                          type="number"
                          step="0.000001"
                        />
                        <Input
                          name="reference"
                          label="Provider usage receipt / reconciliation evidence"
                        />
                      </Form>
                    )}
                  </div>
                ))}
                <h3 className="mb-3 mt-6 font-medium">Recent audit events</h3>
                <div className="max-h-[500px] space-y-3 overflow-y-auto">
                  {data.events.map((e) => (
                    <div
                      key={String(e.id)}
                      className="border-b border-white/10 pb-3 text-sm"
                    >
                      <p>{String(e.action).replaceAll("_", " ")}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {stamp(e.created_at)} ·{" "}
                        {e.actor_user_id
                          ? String(e.actor_name || "Workspace user")
                          : "Mailbox ingestion"}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </>
      )}
    </main>
  );
}
