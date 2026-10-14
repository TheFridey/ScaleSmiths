"use client";
import { useState } from "react";
import { Bell, Plus, Search, ExternalLink, Copy } from "lucide-react";
import type { SearchCandidate } from "@/lib/megaton-growth";

type Row = Record<string, unknown>;
export interface GrowthSnapshot {
  searches: Array<{
    id: string;
    town: string;
    industry: string;
    results: SearchCandidate[];
  }>;
  social: Row[];
  notifications: Row[];
  deviceCount: number;
  pushPublicKey: string;
  notificationsEnabled: boolean;
  aiSearchEnabled: boolean;
  integrations: Array<{
    id: string;
    label: string;
    mode: string;
    configured: boolean;
    detail: string;
  }>;
}
type Act = (action: string, values?: Record<string, unknown>) => Promise<void>;
const field =
  "w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2.5 text-sm text-slate-100 focus:border-amber-300 focus:outline-none";
const button =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-amber-300 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-200 disabled:opacity-40";
const secondary =
  "inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-sm hover:bg-white/5 disabled:opacity-40";
const panel = "rounded-2xl border border-white/10 bg-white/[.025] p-5";
function Field({
  name,
  label,
  required = true,
  type = "text",
  value,
}: {
  name: string;
  label: string;
  required?: boolean;
  type?: string;
  value?: string;
}) {
  return (
    <label className="block space-y-1.5 text-sm text-slate-300">
      <span>{label}</span>
      <input
        className={field}
        name={name}
        type={type}
        required={required}
        defaultValue={value}
      />
    </label>
  );
}
export function AddProspect({
  act,
  busy,
  seed,
}: {
  act: Act;
  busy: boolean;
  seed?: SearchCandidate;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="my-4">
      <button
        className={secondary}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Plus size={16} />
        {seed ? "Add this business" : "Add prospect"}
      </button>
      {open && (
        <form
          key={seed?.website || "manual"}
          className="mt-4 space-y-3 rounded-xl border border-white/10 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void act(
              "add_prospect",
              Object.fromEntries(new FormData(e.currentTarget)),
            );
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              name="businessName"
              label="Business name"
              value={seed?.businessName}
            />
            <Field
              name="town"
              label="Town / trading location"
              value={seed?.town}
            />
          </div>
          <Field name="industry" label="Industry" />
          <Field
            name="website"
            label="Website (optional)"
            type="url"
            required={false}
            value={seed?.website}
          />
          <Field
            name="email"
            label="Business email (optional)"
            type="email"
            required={false}
          />
          <Field
            name="sourceReference"
            label="Source and verified location evidence"
            value={seed ? `${seed.sourceUrl} — ` : undefined}
          />
          <p className="text-xs text-slate-400">
            Adding a prospect does not authorise messaging. Duplicate businesses
            and websites require review.
          </p>
          <button className={button} disabled={busy}>
            Save prospect
          </button>
        </form>
      )}
    </div>
  );
}
export function AISearch({
  growth,
  act,
  busy,
}: {
  growth: GrowthSnapshot;
  act: Act;
  busy: boolean;
}) {
  return (
    <section className={`${panel} mb-5`}>
      <div className="flex items-center gap-2">
        <Search size={20} />
        <h2 className="text-lg font-semibold">
          Find potential clients with AI
        </h2>
      </div>
      <p className="my-3 text-sm text-slate-400">
        Search the public web by UK town and industry. Review source links
        before adding a business. Search never imports or contacts prospects
        automatically.
      </p>
      {!growth.aiSearchEnabled && (
        <p className="mb-4 rounded-xl border border-amber-300/20 p-3 text-sm text-amber-200">
          AI search needs an OpenAI key, approved spend caps and
          MEGATON_AI_SEARCH_ENABLED=true. External operations must also be
          enabled.
        </p>
      )}
      <form
        className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          void act(
            "ai_search",
            Object.fromEntries(new FormData(e.currentTarget)),
          );
        }}
      >
        <Field name="town" label="UK town" />
        <Field name="industry" label="Industry / type of business" />
        <button className={button} disabled={busy || !growth.aiSearchEnabled}>
          {busy ? "Working…" : "Search with AI"}
        </button>
      </form>
      <p className="mt-3 text-xs text-slate-400">
        Each search counts a conservative US$0.10 against the shared AI budget.
        Suggestions are unverified and do not establish consent.
      </p>
      <div className="mt-5 space-y-4">
        {growth.searches.map((search) => (
          <div key={search.id}>
            <h3 className="mb-3 font-semibold">
              {search.industry} · {search.town}
            </h3>
            {!search.results.length && (
              <p className="text-sm text-slate-400">
                No source-backed candidates returned. Try another town or
                industry.
              </p>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              {search.results.map((c) => (
                <article
                  className="rounded-xl border border-white/10 p-4"
                  key={c.website}
                >
                  <h4 className="font-semibold">{c.businessName}</h4>
                  <p className="my-2 text-sm text-slate-400">{c.reason}</p>
                  <a
                    href={c.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-amber-300"
                  >
                    Review search source <ExternalLink size={14} />
                  </a>
                  <AddProspect act={act} busy={busy} seed={c} />
                </article>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
export function SocialOutreach({
  growth,
  leads,
  act,
  busy,
  approve,
  write,
  actorId,
}: {
  growth: GrowthSnapshot;
  leads: Row[];
  act: Act;
  busy: boolean;
  approve: boolean;
  write: boolean;
  actorId: string;
}) {
  const [channel, setChannel] = useState("linkedin"),
    [copied, setCopied] = useState(""),
    [copyError, setCopyError] = useState("");
  return (
    <div className="space-y-5">
      <div className="grid gap-3 lg:grid-cols-3">
        {growth.integrations.map((i) => (
          <section className={panel} key={i.id}>
            <h2 className="text-lg font-semibold">{i.label}</h2>
            <p className="my-2 text-sm text-amber-200">
              {i.mode} · {i.configured ? "Prepared" : "Not configured"}
            </p>
            <p className="text-sm text-slate-400">{i.detail}</p>
          </section>
        ))}
      </div>
      {write && (
        <section className={panel}>
          <h2 className="mb-4 text-lg font-semibold">
            Prepare social outreach
          </h2>
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              void act(
                "social_draft",
                Object.fromEntries(new FormData(e.currentTarget)),
              );
            }}
          >
            <label className="space-y-1.5 text-sm">
              <span>Prospect</span>
              <select
                className={field}
                name="prospectId"
                aria-label="Prospect"
                required
              >
                <option value="">Select a prospect</option>
                {leads.map((l) => (
                  <option key={String(l.id)} value={String(l.id)}>
                    {String(l.business_name)}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 text-sm">
              <span>Channel</span>
              <select
                className={field}
                name="channel"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
              >
                <option value="linkedin">LinkedIn · manual handoff</option>
                <option value="facebook">Facebook Page · eligible reply</option>
                <option value="x">X · approved DM</option>
              </select>
            </label>
            <Field
              name="profileUrl"
              label="Prospect's social profile URL"
              type="url"
            />
            {channel !== "linkedin" && (
              <Field name="recipient" label="Numeric platform recipient ID" />
            )}
            <div className="md:col-span-2">
              <Field
                name="reference"
                label="Recipient permission / eligibility evidence"
              />
            </div>
            <label className="space-y-1.5 text-sm md:col-span-2">
              <span>Message for human review</span>
              <textarea
                className={field}
                name="body"
                required
                maxLength={5000}
                rows={5}
              />
            </label>
            <div>
              <button className={button} disabled={busy || !leads.length}>
                Request approval
              </button>
            </div>
          </form>
        </section>
      )}
      <section className={panel}>
        <h2 className="mb-4 text-lg font-semibold">Social approval queue</h2>
        <p className="mb-4 text-sm text-slate-400">
          LinkedIn messages are sent by you through LinkedIn. Eligible X and
          Facebook messages can be scheduled after exact approval when
          integrations, the worker and sending are enabled.
        </p>
        {copyError && <p role="alert">{copyError}</p>}
        <div className="space-y-4">
          {growth.social.map((d) => (
            <article
              key={String(d.id)}
              className="rounded-xl border border-white/10 p-4"
            >
              <div className="flex flex-wrap justify-between gap-2">
                <h3 className="font-semibold">
                  {String(d.business_name)} · {String(d.channel)}
                </h3>
                <span className="text-sm text-amber-200">
                  {String(d.state).replaceAll("_", " ")}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Permission evidence: {String(d.eligibility_reference)}
              </p>
              <p className="my-4 whitespace-pre-wrap break-words text-sm">
                {String(d.body)}
              </p>
              <div className="flex flex-wrap gap-2">
                {approve && d.state === "review" && (
                  <form
                    className="flex flex-wrap gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const due = new FormData(e.currentTarget).get("dueAt");
                      void act("social_approve", {
                        id: d.id,
                        revision: d.revision,
                        ...(due
                          ? { dueAt: new Date(String(due)).toISOString() }
                          : {}),
                      });
                    }}
                  >
                    {d.channel !== "linkedin" && (
                      <label className="text-xs">
                        Send at (optional, local time)
                        <input
                          aria-label="Send at"
                          name="dueAt"
                          type="datetime-local"
                          className={field}
                        />
                      </label>
                    )}
                    <button className={button} disabled={busy}>
                      Approve exact message
                    </button>
                  </form>
                )}
                {d.channel === "linkedin" && d.state === "approved" && (
                  <>
                    <button
                      className={secondary}
                      onClick={() => {
                        void navigator.clipboard
                          .writeText(String(d.body))
                          .then(() => {
                            setCopied(String(d.id));
                            setCopyError("");
                          })
                          .catch(() =>
                            setCopyError(
                              "Could not copy. Select the message text and copy it manually.",
                            ),
                          );
                      }}
                    >
                      <Copy size={14} />
                      {copied === d.id ? "Copied" : "Copy approved message"}
                    </button>
                    <a
                      href={String(d.profile_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={secondary}
                    >
                      Open LinkedIn <ExternalLink size={14} />
                    </a>
                    {approve && d.approved_by === actorId && (
                      <button
                        className={secondary}
                        disabled={busy}
                        onClick={() =>
                          void act("social_complete", {
                            id: d.id,
                            revision: d.revision,
                          })
                        }
                      >
                        Confirm I sent it in LinkedIn
                      </button>
                    )}
                  </>
                )}
                {write && ["review", "approved"].includes(String(d.state)) && (
                  <button
                    className={secondary}
                    disabled={busy}
                    onClick={() =>
                      void act("social_cancel", {
                        id: d.id,
                        revision: d.revision,
                      })
                    }
                  >
                    Cancel
                  </button>
                )}
              </div>
              {d.state === "unknown" && (
                <div>
                  <p className="mt-3 text-sm text-amber-200">
                    Provider acceptance is uncertain. Check the platform before
                    preparing another message; this one will not retry
                    automatically.
                  </p>
                  {approve && (
                    <form
                      className="mt-3 space-y-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void act("social_reconcile", {
                          ...Object.fromEntries(new FormData(e.currentTarget)),
                          id: d.id,
                          revision: d.revision,
                        });
                      }}
                    >
                      <Field
                        name="reference"
                        label="Provider evidence confirming the outcome"
                      />
                      <label className="block text-sm">
                        Confirmed outcome
                        <select
                          className={field}
                          name="outcome"
                          aria-label="Confirmed outcome"
                        >
                          <option value="accepted">
                            Provider confirms acceptance
                          </option>
                          <option value="cancelled">
                            Provider confirms message was not sent
                          </option>
                        </select>
                      </label>
                      <button className={secondary} disabled={busy}>
                        Record verified outcome
                      </button>
                    </form>
                  )}
                </div>
              )}
            </article>
          ))}
          {!growth.social.length && (
            <p className="text-sm text-slate-400">
              No social outreach prepared yet.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
export function ApprovalNotifications({
  growth,
  act,
  busy,
}: {
  growth: GrowthSnapshot;
  act: Act;
  busy: boolean;
}) {
  const [message, setMessage] = useState("");
  async function enable() {
    try {
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      )
        throw new Error(
          "Install the admin PWA and open it on a browser supporting push notifications. On iPhone, add it to the Home Screen first.",
        );
      if (!growth.pushPublicKey)
        throw new Error("Push keys have not been configured on the server.");
      if ((await Notification.requestPermission()) !== "granted")
        throw new Error(
          "Allow notifications in this phone’s browser/app settings.",
        );
      const registration = await navigator.serviceWorker.ready;
      const base64 = growth.pushPublicKey.replace(/-/g, "+").replace(/_/g, "/"),
        raw = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
      const applicationServerKey = Uint8Array.from(raw, (c) => c.charCodeAt(0));
      const subscription =
        (await registration.pushManager.getSubscription()) ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        }));
      await act("push_subscribe", { subscription: subscription.toJSON() });
      setMessage(
        "Device registration submitted. Check the registered-device count, then send a test alert.",
      );
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Could not enable notifications.",
      );
    }
  }
  return (
    <section className={`${panel} mb-5`}>
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Bell size={20} />
        Approval alerts on your phone
      </h2>
      <p className="my-3 text-sm text-slate-400">
        New outreach drafts and inbound messages queue alerts for active owner
        and venture-controller accounts. Push alerts contain no prospect
        details. Email fallback uses each account’s registered email if no push
        is accepted.
      </p>
      <p className="mb-4 text-sm">
        {growth.deviceCount} registered device(s) for your current session ·
        Delivery {growth.notificationsEnabled ? "enabled" : "disabled"}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          className={button}
          disabled={busy}
          onClick={() => void enable()}
        >
          Enable on this phone
        </button>
        <button
          className={secondary}
          disabled={busy}
          onClick={() => void act("notification_test")}
        >
          Send me a test alert
        </button>
        <button
          className={secondary}
          disabled={busy}
          onClick={() => void act("push_unsubscribe")}
        >
          Revoke my registered devices
        </button>
      </div>
      {message && (
        <p role="status" className="mt-3 text-sm">
          {message}
        </p>
      )}
      <ul className="mt-4 space-y-2 text-xs text-slate-400">
        {growth.notifications.slice(0, 5).map((n) => (
          <li key={String(n.id)}>
            {new Date(String(n.created_at)).toLocaleString("en-GB")} ·{" "}
            {String(n.state)} · {String(n.push_count)} push service
            acceptance(s){n.email_accepted ? " · email accepted" : ""}
            {n.error_code ? ` · ${n.error_code}` : ""}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-slate-400">
        Service acceptance does not confirm phone display or email inbox
        placement. Both you and Trev must register your own phones.
      </p>
    </section>
  );
}
