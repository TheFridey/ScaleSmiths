import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
const state = vi.hoisted(() => ({
  pg: null as unknown as PGlite,
  send: vi.fn(),
  read: vi.fn(),
  ai: vi.fn(),
  push: vi.fn(),
}));
vi.mock("web-push", () => ({ default: { sendNotification: state.push } }));
vi.mock("../db", () => {
  const dialect = new PgDialect();
  const executor = (pg: Pick<PGlite, "query">) => ({
    execute: (s: SQL) => {
      const q = dialect.sqlToQuery(s);
      return pg.query(q.sql, q.params);
    },
  });
  return {
    db: {
      execute: (s: SQL) => executor(state.pg).execute(s),
      transaction: (
        fn: (tx: ReturnType<typeof executor>) => Promise<unknown>,
      ) => state.pg.transaction((tx) => fn(executor(tx))),
    },
  };
});
vi.mock("./megaton-mailcow", () => ({
  sendMailcow: state.send,
  readMailcow: state.read,
}));
vi.mock("./megaton-ai", async (importOriginal) => {
  const aiModule = await importOriginal<typeof import("./megaton-ai")>();
  return { ...aiModule, requestAIProposal: state.ai };
});
import { megatonMutation, megatonSnapshot, type MegatonActor } from "./megaton";
import { dispatchSocial, deliverReviewNotifications } from "./megaton-growth";
const rhys = "00000000-0000-4000-8000-000000000001",
  trev = "00000000-0000-4000-8000-000000000002";
const actor: MegatonActor = { id: rhys, role: "owner", sessionVersion: 1 },
  other: MegatonActor = {
    id: trev,
    role: "venture_controller",
    sessionVersion: 1,
  };
const env = {
  MEGATON_ENABLED: "true",
  MEGATON_EXTERNAL_ENABLED: "true",
  MEGATON_SEND_ENABLED: "true",
  MEGATON_STOP: "false",
  MEGATON_MAILCOW_HOST: "mail.example.com",
  MEGATON_MAILCOW_USER: "sales@example.com",
  MEGATON_MAILCOW_PASSWORD: "fixture",
  MEGATON_MAILCOW_FROM: "sales@example.com",
  MEGATON_DAILY_SEND_LIMIT: "10",
};
async function thread() {
  return (
    await state.pg.query<{ id: string; revision: number }>(
      "select id,revision from megaton_conversations limit 1",
    )
  ).rows[0];
}
async function draft() {
  return (await megatonMutation(actor, {
    action: "draft",
    prospectId: 1,
    offer: "partnership",
    recipient: "buyer@example.com",
  })) as { id: string; revision: number };
}
async function eligible() {
  const t = await thread();
  await megatonMutation(actor, {
    action: "eligibility",
    id: t.id,
    revision: t.revision,
    subscriberType: "corporate",
    legalBasis: "legitimate_interests",
    reference: "Fixture: verified incorporated company and transparency notice",
  });
}
async function approval(d: { id: string; revision: number }) {
  return (await megatonMutation(actor, {
    action: "approve",
    id: d.id,
    revision: d.revision,
    threadRevision: (await thread()).revision,
  })) as { id: string };
}
describe("Megaton production services against embedded PostgreSQL", () => {
  beforeAll(async () => {
    state.pg = new PGlite();
    await state.pg
      .exec(`create table admin_users(id uuid primary key,role text,active boolean,session_version integer,display_name text default 'Test founder',email text default 'founder@example.com');
      create table prospects(id serial primary key,business_name text,contact_email text,website_url text,location text,industry text,source text,stage text default 'found',owner_user_id uuid,archived_at timestamptz,updated_at timestamptz default now());
      create table commercial_contacts(id serial primary key,prospect_id integer,email text,suppressed boolean default false);`);
    await state.pg.exec(
      readFileSync(
        path.resolve(process.cwd(), "drizzle/0066_megaton_foundation.sql"),
        "utf8",
      ).replaceAll("--> statement-breakpoint", ""),
    );
    await state.pg.exec(
      readFileSync(
        path.resolve(
          process.cwd(),
          "drizzle/0067_megaton_growth_and_alerts.sql",
        ),
        "utf8",
      ).replaceAll("--> statement-breakpoint", ""),
    );
    await state.pg.exec(
      "create role megaton_external; grant select on megaton_conversations,megaton_social_outreach,megaton_notifications,megaton_push_devices,megaton_searches to megaton_external;",
    );
  }, 60000);
  beforeEach(async () => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    state.send.mockReset();
    state.read.mockReset();
    state.ai.mockReset();
    state.push.mockReset();
    state.push.mockResolvedValue({ statusCode: 201 });
    state.send.mockResolvedValue({ reference: "<receipt@example.com>" });
    await state.pg
      .exec(`truncate megaton_events,megaton_discovery_links,megaton_suppressions,megaton_jobs,megaton_outbox,megaton_drafts,megaton_messages,megaton_conversations,megaton_evidence,megaton_campaigns,commercial_contacts,prospects,admin_users restart identity cascade;
      insert into admin_users(id,role,active,session_version) values('${rhys}','owner',true,1),('${trev}','venture_controller',true,1);
      insert into prospects(business_name,contact_email,website_url,location,industry) values('Example Ltd','buyer@example.com','https://example.com','Hucknall','Plumbing');
      insert into megaton_connections(id,active,last_synced_at) values('company-mailcow',true,now());`);
  });
  afterAll(async () => {
    vi.unstubAllEnvs();
    await state.pg.close();
  });
  it("shares the existing business pipeline with both founders", async () => {
    expect((await megatonSnapshot(actor)).leads).toHaveLength(1);
    expect((await megatonSnapshot(other)).leads).toHaveLength(1);
    await expect(megatonSnapshot({ ...actor, role: "viewer" })).rejects.toThrow(
      "permission",
    );
  });
  it("adds manually sourced prospects and prevents duplicates across the shared pipeline", async () => {
    const input = {
      action: "add_prospect",
      businessName: "New business",
      town: "Hucknall",
      industry: "Plumbing",
      sourceReference: "Business card from owner",
    };
    await megatonMutation(actor, input);
    expect((await megatonSnapshot(other)).leads).toHaveLength(2);
    await expect(megatonMutation(other, input)).rejects.toThrow(
      "matching prospect",
    );
    await expect(
      megatonMutation({ ...actor, role: "viewer" }, input),
    ).rejects.toThrow("permission");
  });
  it("queues private approval alerts for both founders when a draft needs review", async () => {
    await draft();
    const notices = (
      await state.pg.query<{ user_id: string }>(
        "select user_id,event_key from megaton_notifications",
      )
    ).rows;
    expect(notices).toHaveLength(2);
    expect(notices.map((n) => n.user_id).sort()).toEqual([rhys, trev]);
  });
  async function social(channel = "linkedin") {
    return (await megatonMutation(actor, {
      action: "social_draft",
      prospectId: 1,
      channel,
      recipient: "12345",
      profileUrl:
        channel === "linkedin"
          ? "https://www.linkedin.com/company/example/"
          : channel === 'facebook' ? 'https://www.facebook.com/example' : "https://x.com/example",
      body: "Hello. May we discuss your website?",
      reference: "Recipient explicitly requested website advice",
    })) as { id: string; revision: number };
  }
  it("keeps LinkedIn sending manual and requires the current approver to confirm completion", async () => {
    const d = await social();
    await megatonMutation(actor, { action: "social_approve", ...d });
    await expect(
      megatonMutation(other, { action: "social_complete", ...d }),
    ).rejects.toThrow("current approver");
    expect(await dispatchSocial()).toEqual({ processed: 0 });
    await megatonMutation(actor, { action: "social_complete", ...d });
    expect(
      (
        await state.pg.query<{ state: string }>(
          "select state from megaton_social_outreach where id=$1",
          [d.id],
        )
      ).rows[0].state,
    ).toBe("manual_completed");
  });
  it("cancels social approvals after approver session revocation without calling a provider", async () => {
    vi.stubEnv("MEGATON_SOCIAL_SEND_ENABLED", "true");
    vi.stubEnv("MEGATON_X_USER_ACCESS_TOKEN", "fixture");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const d = await social("x");
    await megatonMutation(actor, { action: "social_approve", ...d });
    await state.pg.query(
      "update admin_users set session_version=2 where id=$1",
      [rhys],
    );
    await dispatchSocial();
    expect(fetch).not.toHaveBeenCalled();
    expect(
      (
        await state.pg.query<{ state: string }>(
          "select state from megaton_social_outreach where id=$1",
          [d.id],
        )
      ).rows[0].state,
    ).toBe("cancelled");
  });
  it("does not retry an uncertain social provider send", async () => {
    vi.stubEnv("MEGATON_SOCIAL_SEND_ENABLED", "true");
    vi.stubEnv("MEGATON_X_USER_ACCESS_TOKEN", "fixture");
    const fetch = vi.fn().mockRejectedValue(new Error("timeout"));
    vi.stubGlobal("fetch", fetch);
    const d = await social("x");
    await megatonMutation(actor, { action: "social_approve", ...d });
    await dispatchSocial();
    await dispatchSocial();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(
      (
        await state.pg.query<{ state: string }>(
          "select state from megaton_social_outreach where id=$1",
          [d.id],
        )
      ).rows[0].state,
    ).toBe("unknown");
    await expect(social('x')).rejects.toThrow('uncertain outreach');
    await megatonMutation(actor,{action:'social_reconcile',...d,outcome:'cancelled',reference:'Fixture provider trace proves request was not accepted'});
    expect((await state.pg.query<{state:string}>('select state from megaton_social_outreach where id=$1',[d.id])).rows[0].state).toBe('cancelled');
  });
  it('checks recent Facebook inbound eligibility before any Page send',async()=>{
    vi.stubEnv('MEGATON_SOCIAL_SEND_ENABLED','true');vi.stubEnv('MEGATON_FACEBOOK_PAGE_TOKEN','fixture');vi.stubEnv('MEGATON_FACEBOOK_PAGE_ID','999');vi.stubEnv('MEGATON_FACEBOOK_API_VERSION','v25.0');
    const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({data:[{messages:{data:[{from:{id:'12345'},created_time:new Date(Date.now()-48*3600000).toISOString()}]}}]})});vi.stubGlobal('fetch',fetch);
    const d=await social('facebook');await megatonMutation(actor,{action:'social_approve',...d});await dispatchSocial();
    expect(fetch).toHaveBeenCalledTimes(1);expect(String(fetch.mock.calls[0][0])).toContain('/conversations?');
  });
  it('sends an approved Facebook reply only after the matching recent inbound check',async()=>{
    vi.stubEnv('MEGATON_SOCIAL_SEND_ENABLED','true');vi.stubEnv('MEGATON_FACEBOOK_PAGE_TOKEN','fixture');vi.stubEnv('MEGATON_FACEBOOK_PAGE_ID','999');vi.stubEnv('MEGATON_FACEBOOK_API_VERSION','v25.0');
    const fetch=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({data:[{messages:{data:[{from:{id:'12345'},created_time:new Date().toISOString()}]}}]})}).mockResolvedValueOnce({ok:true,json:async()=>({message_id:'fixture-message'})});vi.stubGlobal('fetch',fetch);
    const d=await social('facebook');await megatonMutation(actor,{action:'social_approve',...d});await dispatchSocial();await dispatchSocial();
    expect(fetch).toHaveBeenCalledTimes(2);expect((await state.pg.query<{state:string}>('select state from megaton_social_outreach where id=$1',[d.id])).rows[0].state).toBe('accepted');
  });
  it("searches with a bounded reservation and never imports suggestions automatically", async () => {
    vi.stubEnv("MEGATON_AI_ENABLED", "true");
    vi.stubEnv("MEGATON_AI_SEARCH_ENABLED", "true");
    vi.stubEnv("MEGATON_OPENAI_API_KEY", "fixture");
    vi.stubEnv("MEGATON_AI_DAILY_CAP_MICROUSD", "100000");
    vi.stubEnv("MEGATON_AI_MONTHLY_CAP_MICROUSD", "100000");
    const candidate = {
      businessName: "Search suggestion",
      town: "Hucknall",
      website: "https://example.org",
      sourceUrl: "https://example.org/contact",
      reason: "Trading location on contact page",
    };
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output: [
          {
            type: "web_search_call",
            action: { sources: [{ url: candidate.sourceUrl }] },
          },
          { type: "message", content: [{ text: JSON.stringify([candidate]) }] },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetch);
    const r = (await megatonMutation(actor, {
      action: "ai_search",
      town: "Hucknall",
      industry: "Plumbing",
    })) as { candidates: unknown[] };
    expect(r.candidates).toHaveLength(1);
    expect((await megatonSnapshot(actor)).leads).toHaveLength(1);
    await expect(
      megatonMutation(actor, {
        action: "ai_search",
        town: "Hucknall",
        industry: "Plumbing",
      }),
    ).rejects.toThrow("spend cap");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("keeps notification delivery off without explicit activation", async () => {
    await draft();
    expect(await deliverReviewNotifications()).toEqual({ processed: 0 });
    expect(state.send).not.toHaveBeenCalled();
  });
  it("encrypts registered subscriptions and falls back to founder email when push fails", async () => {
    vi.stubEnv("MEGATON_PUSH_ENCRYPTION_KEY", "ab".repeat(32));
    vi.stubEnv("MEGATON_VAPID_PUBLIC_KEY", "fixture");
    vi.stubEnv("MEGATON_VAPID_PRIVATE_KEY", "fixture");
    vi.stubEnv("MEGATON_NOTIFICATIONS_ENABLED", "true");
    vi.stubEnv("MEGATON_NOTIFICATION_EMAIL_FALLBACK", "true");
    const endpoint = "https://fcm.googleapis.com/fixture-secret-endpoint";
    await megatonMutation(actor, {
      action: "push_subscribe",
      subscription: {
        endpoint,
        keys: { auth: "a".repeat(22), p256dh: "b".repeat(87) },
      },
    });
    const stored = (
      await state.pg.query<{ subscription_encrypted: string }>(
        "select subscription_encrypted from megaton_push_devices",
      )
    ).rows[0];
    expect(stored.subscription_encrypted).not.toContain("fixture-secret");
    state.push.mockRejectedValue({ statusCode: 410 });
    await draft();
    await deliverReviewNotifications();
    await deliverReviewNotifications();
    expect(state.push).toHaveBeenCalledTimes(1);
    expect(state.send).toHaveBeenCalledTimes(2);
    expect(
      (await state.pg.query("select * from megaton_push_devices")).rows,
    ).toHaveLength(0);
    const receipts = (
      await state.pg.query<{ state: string; email_accepted: boolean }>(
        "select state,email_accepted from megaton_notifications",
      )
    ).rows;
    expect(
      receipts.every((r) => r.state === "accepted" && r.email_accepted),
    ).toBe(true);
  });
  it("keeps acquisition data invisible to public tenant sessions under RLS", async () => {
    await draft();
    await social();
    await state.pg.transaction(async (tx) => {
      await tx.exec(
        "set local role megaton_external; set local app.access_mode='tenant';",
      );
      expect(
        (await tx.query("select * from megaton_conversations")).rows,
      ).toHaveLength(0);
      expect((await tx.query('select * from megaton_social_outreach')).rows).toHaveLength(0);
      expect((await tx.query('select * from megaton_notifications')).rows).toHaveLength(0);
    });
  });
  it("requires eligibility and exact displayed revisions before approval", async () => {
    const d = await draft();
    await expect(approval(d)).rejects.toThrow("subscriber type");
    await eligible();
    await expect(approval({ ...d, revision: 9 })).rejects.toThrow("changed");
    expect((await approval(d)).id).toBeTruthy();
  });
  it("rejects sole-trader legitimate interests as consent substitute", async () => {
    const d = await draft(),
      t = await thread();
    await megatonMutation(actor, {
      action: "eligibility",
      id: t.id,
      revision: t.revision,
      subscriberType: "individual",
      legalBasis: "legitimate_interests",
      reference: "Not consent",
    });
    await expect(approval(d)).rejects.toThrow("consent");
  });
  it("editing consumes the old approval without sending", async () => {
    const d = await draft();
    await eligible();
    const a = await approval(d);
    await megatonMutation(actor, {
      action: "edit",
      id: d.id,
      revision: d.revision,
      subject: "Changed",
      body: "Changed saved message",
    });
    await expect(
      megatonMutation(actor, { action: "dispatch", id: a.id }),
    ).rejects.toThrow("consumed");
    expect(state.send).not.toHaveBeenCalled();
  });
  it("takeover cancels queued sends and only the owner can hand back", async () => {
    const d = await draft();
    await eligible();
    const a = await approval(d),
      t = await thread();
    await megatonMutation(other, {
      action: "claim",
      id: t.id,
      revision: t.revision,
    });
    await expect(
      megatonMutation(actor, { action: "dispatch", id: a.id }),
    ).rejects.toThrow("consumed");
    await expect(
      megatonMutation(actor, {
        action: "handback",
        id: t.id,
        revision: (await thread()).revision,
      }),
    ).rejects.toThrow("owner");
  });
  it("rechecks suppression at dispatch", async () => {
    const d = await draft();
    await eligible();
    const a = await approval(d);
    await state.pg.query(
      "insert into megaton_suppressions(address,reason) values('buyer@example.com','Recipient objection')",
    );
    await expect(
      megatonMutation(actor, { action: "dispatch", id: a.id }),
    ).rejects.toThrow("suppressed");
    expect(state.send).not.toHaveBeenCalled();
  });
  it("rechecks persisted approver session and account activation", async () => {
    const d = await draft();
    await eligible();
    const a = await approval(d);
    await state.pg.query(
      "update admin_users set session_version=2 where id=$1",
      [rhys],
    );
    await expect(
      megatonMutation(actor, { action: "dispatch", id: a.id }),
    ).rejects.toThrow("revoked");
    expect(state.send).not.toHaveBeenCalled();
  });
  it("consumes approval once and records SMTP acceptance separately from delivery", async () => {
    const d = await draft();
    await eligible();
    const a = await approval(d);
    expect(
      await megatonMutation(actor, { action: "dispatch", id: a.id }),
    ).toEqual({ ok: true, state: "accepted" });
    await expect(
      megatonMutation(actor, { action: "dispatch", id: a.id }),
    ).rejects.toThrow("consumed");
    expect(state.send).toHaveBeenCalledTimes(1);
    expect(
      (await state.pg.query("select * from megaton_messages")).rows,
    ).toHaveLength(1);
  });
  it("retains uncertain sends without automatic retry or unsafe takeover", async () => {
    const d = await draft();
    await eligible();
    const a = await approval(d);
    state.send.mockRejectedValue(new Error("timeout after DATA"));
    await expect(
      megatonMutation(actor, { action: "dispatch", id: a.id }),
    ).rejects.toThrow("uncertain");
    await expect(
      megatonMutation(actor, { action: "dispatch", id: a.id }),
    ).rejects.toThrow("consumed");
    const t = await thread();
    await expect(
      megatonMutation(other, {
        action: "claim",
        id: t.id,
        revision: t.revision,
      }),
    ).rejects.toThrow("uncertain");
    expect(state.send).toHaveBeenCalledTimes(1);
  });
  it("honours kill switch and daily reservation before any SMTP call", async () => {
    const d = await draft();
    await eligible();
    const a = await approval(d);
    vi.stubEnv("MEGATON_STOP", "true");
    await expect(
      megatonMutation(actor, { action: "dispatch", id: a.id }),
    ).rejects.toThrow("not enabled");
    vi.stubEnv("MEGATON_STOP", "false");
    vi.stubEnv("MEGATON_DAILY_SEND_LIMIT", "0");
    await expect(
      megatonMutation(actor, { action: "dispatch", id: a.id }),
    ).rejects.toThrow("limit");
    expect(state.send).not.toHaveBeenCalled();
  });
  it("imports a sourced local result twice without duplicating the prospect", async () => {
    const c = (await megatonMutation(actor, {
      action: "campaign",
      name: "Hucknall trades",
      town: "Hucknall",
      industry: "Plumbing",
      country: "GB",
    })) as { id: string };
    const input = {
      action: "import",
      campaignId: c.id,
      businessName: "Example Ltd",
      town: "Hucknall",
      country: "GB",
      website: "https://example.com",
      sourceUrl: "https://example.com/about",
      sourceReference: "Approved source and verified town",
    };
    await megatonMutation(actor, input);
    await megatonMutation(actor, input);
    expect((await state.pg.query("select * from prospects")).rows).toHaveLength(
      1,
    );
    await expect(
      megatonMutation(actor, { ...input, country: "US" }),
    ).rejects.toThrow("UK town");
  });
  it("deduplicates real ingestion code and invalidates approvals for meeting requests", async () => {
    const d = await draft();
    await eligible();
    const a = await approval(d);
    state.read.mockImplementation(
      async (_cursor, consume, sentConfig, sent) => {
        if (!sent)
          await consume({
            externalId: "<incoming@example.com>",
            sender: "buyer@example.com",
            subject: "Meeting",
            body: "Can we book a meeting and get a quote?",
            occurredAt: new Date().toISOString(),
            uid: 1,
          });
        return { validity: "1", uid: 1 };
      },
    );
    for (let i = 0; i < 2; i++) {
      await megatonMutation(actor, { action: "sync" });
      await megatonMutation(actor, { action: "work" });
    }
    expect(
      (
        await state.pg.query(
          "select * from megaton_messages where direction='inbound'",
        )
      ).rows,
    ).toHaveLength(1);
    expect(
      (
        await state.pg.query<{ status: string }>(
          "select status from megaton_conversations",
        )
      ).rows[0].status,
    ).toBe("human_active");
    await expect(
      megatonMutation(actor, { action: "dispatch", id: a.id }),
    ).rejects.toThrow("consumed");
    expect(state.send).not.toHaveBeenCalled();
  });
  it("blocks stale mailbox state and preserves legacy contact suppressions", async () => {
    const d = await draft();
    await eligible();
    const a = await approval(d);
    await state.pg.exec(
      "update megaton_connections set last_synced_at=now()-interval '5 minutes'",
    );
    await expect(
      megatonMutation(actor, { action: "dispatch", id: a.id }),
    ).rejects.toThrow("Sync");
    await state.pg.exec(
      "update megaton_connections set last_synced_at=now();insert into commercial_contacts(prospect_id,email,suppressed) values(1,'buyer@example.com',true)",
    );
    await expect(
      megatonMutation(actor, { action: "dispatch", id: a.id }),
    ).rejects.toThrow("suppressed");
    expect(state.send).not.toHaveBeenCalled();
  });
  it("reserves AI spend before a call and requires review after a generated proposal", async () => {
    vi.stubEnv("MEGATON_AI_ENABLED", "true");
    vi.stubEnv("MEGATON_OPENAI_API_KEY", "fixture-only");
    vi.stubEnv("MEGATON_AI_DAILY_CAP_MICROUSD", "100000");
    vi.stubEnv("MEGATON_AI_MONTHLY_CAP_MICROUSD", "100000");
    const d = await draft();
    state.ai.mockResolvedValue({
      subject: "Reviewed idea",
      body: "A proposal awaiting human review",
      inputTokens: 1000,
      outputTokens: 100,
    });
    await megatonMutation(actor, { action: "ai_draft", id: d.id });
    await megatonMutation(actor, { action: "work" });
    expect(state.ai).toHaveBeenCalledTimes(1);
    const usage = (
      await state.pg.query<{ state: string; actual_microusd: number }>(
        "select state,actual_microusd from megaton_ai_usage",
      )
    ).rows[0];
    expect(usage.state).toBe("spent");
    expect(usage.actual_microusd).toBe(560);
    expect(
      (
        await state.pg.query<{ revision: number }>(
          "select revision from megaton_drafts",
        )
      ).rows[0].revision,
    ).toBe(2);
    expect(
      (await state.pg.query("select * from megaton_outbox")).rows,
    ).toHaveLength(0);
    expect(state.send).not.toHaveBeenCalled();
  });
  it("does not incur another AI call after uncertain billing", async () => {
    vi.stubEnv("MEGATON_AI_ENABLED", "true");
    vi.stubEnv("MEGATON_OPENAI_API_KEY", "fixture-only");
    vi.stubEnv("MEGATON_AI_DAILY_CAP_MICROUSD", "50000");
    vi.stubEnv("MEGATON_AI_MONTHLY_CAP_MICROUSD", "50000");
    const d = await draft();
    state.ai.mockRejectedValue(new Error("Provider timeout"));
    await megatonMutation(actor, { action: "ai_draft", id: d.id });
    await expect(megatonMutation(actor, { action: "work" })).rejects.toThrow(
      "External operation failed",
    );
    await state.pg.exec("update megaton_jobs set next_at=now()");
    await expect(megatonMutation(actor, { action: "work" })).rejects.toThrow(
      "External operation failed",
    );
    expect(state.ai).toHaveBeenCalledTimes(1);
    expect(
      (
        await state.pg.query<{ state: string }>(
          "select state from megaton_ai_usage",
        )
      ).rows[0].state,
    ).toBe("unknown");
  });
  it("records reproducible historical score contributions", async () => {
    await megatonMutation(actor, {
      action: "evidence",
      prospectId: 1,
      category: "digital",
      observation: "Fixture observation",
      sourceUrl: "https://example.com",
      observedAt: new Date().toISOString(),
      confidence: 1,
      strength: 0.5,
    });
    const run = (
      await state.pg.query<{
        model: string;
        result: { score: number };
        evidence_ids: string[];
      }>("select * from megaton_score_runs")
    ).rows[0];
    expect(run.model).toBe("megaton-evidence-v1");
    expect(run.result.score).toBe(13);
    expect(run.evidence_ids).toHaveLength(1);
  });
});
