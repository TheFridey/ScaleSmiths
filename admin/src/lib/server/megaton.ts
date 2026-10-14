import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { sql, type SQL } from "drizzle-orm";
import { db, type AdminDatabaseTransaction } from "../db";
import { hasCapability, type Capability } from "../rbac";
import type { AdminRole } from "../admin-users";
import {
  MegatonError,
  cleanText,
  emailAddress,
  publicUrl,
  evidenceInput,
  scoreEvidence,
  draftOutreach,
  classifyMessage,
  websiteObservations,
  type EvidenceInput,
  type Offer,
} from "../megaton";
import { megatonConfig, requireExternal } from "./megaton-config";
import {
  readMailcow,
  sendMailcow,
  type MailcowCursor,
  type MailcowMessage,
} from "./megaton-mailcow";
import { createSafeOutboundClient } from "./safe-outbound";
import { aiSettings, requestAIProposal } from "./megaton-ai";
import { discoverRegistry } from "./megaton-discovery";

export type MegatonActor = {
  id: string;
  role: AdminRole;
  sessionVersion: number;
};
type Executor = Pick<AdminDatabaseTransaction, "execute">;
type Row = Record<string, unknown>;
async function rows<T extends Row = Row>(tx: Executor, statement: SQL) {
  return (await tx.execute(statement)).rows as T[];
}
async function event(
  tx: Executor,
  actor: string | null,
  entity: string,
  action: string,
  detail: Row = {},
) {
  await tx.execute(
    sql`insert into megaton_events(actor_user_id,entity_id,action,detail) values(${actor},${entity},${action},${JSON.stringify(detail)}::jsonb)`,
  );
}
async function recordScore(tx: Executor, lead: number, actor: string) {
  const evidence = await rows(
    tx,
    sql`select * from megaton_evidence where prospect_id=${lead} order by observed_at desc`,
  );
  const result = scoreEvidence(
    evidence.map((e) => ({
      category: e.category as EvidenceInput["category"],
      observation: String(e.observation),
      sourceUrl: String(e.source_url),
      observedAt: new Date(String(e.observed_at)).toISOString(),
      confidence: Number(e.confidence),
      strength: Number(e.strength),
    })),
  );
  await tx.execute(
    sql`insert into megaton_score_runs(prospect_id,model,result,evidence_ids,actor_user_id) values(${lead},${result.model},${JSON.stringify(result)}::jsonb,${JSON.stringify(evidence.map((e) => e.id))}::jsonb,${actor})`,
  );
}
function allowed(actor: MegatonActor, capability: Capability) {
  if (!hasCapability(actor.role, capability))
    throw new MegatonError(
      "You do not have permission for this operation.",
      403,
    );
}
function id(value: unknown) {
  const result = cleanText(value, "ID", 40);
  if (!/^[a-f0-9-]{36}$/i.test(result)) throw new MegatonError("Invalid ID.");
  return result;
}
function prospectId(value: unknown) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1)
    throw new MegatonError("Invalid prospect.");
  return n;
}
function hash(draft: Row, thread: Row) {
  const c = megatonConfig();
  return createHash("sha256")
    .update(
      JSON.stringify([
        draft.id,
        draft.revision,
        draft.subject,
        draft.body,
        thread.recipient,
        thread.connection_id,
        c.host,
        c.user,
        c.from,
      ]),
    )
    .digest("hex");
}
async function threadLock(tx: Executor, value: unknown) {
  const [thread] = await rows(
    tx,
    sql`select * from megaton_conversations where id=${id(value)} for update`,
  );
  if (!thread) throw new MegatonError("Conversation not found.", 404);
  return thread;
}
async function cancelPending(tx: Executor, thread: Row) {
  const pending = await rows(
    tx,
    sql`select id from megaton_outbox where conversation_id=${String(thread.id)} and state in ('sending','unknown')`,
  );
  if (pending.length)
    throw new MegatonError(
      "A send is in flight or uncertain. Reconcile it before changing this conversation.",
      409,
    );
  await tx.execute(
    sql`update megaton_outbox set state='cancelled',completed_at=now() where conversation_id=${String(thread.id)} and state='approved'`,
  );
}
async function eligible(tx: Executor, thread: Row) {
  if (
    thread.suppressed ||
    (
      await rows(
        tx,
        sql`select address from megaton_suppressions where address=${String(thread.recipient)}`,
      )
    ).length
  )
    throw new MegatonError("This recipient is suppressed.", 409);
  if (thread.prospect_id) {
    const [lead] = await rows(
      tx,
      sql`select archived_at from prospects where id=${Number(thread.prospect_id)}`,
    );
    if (!lead || lead.archived_at)
      throw new MegatonError(
        "The prospect is suppressed, archived or unavailable.",
        409,
      );
    const contacts = await rows(
      tx,
      sql`select email,suppressed from commercial_contacts where prospect_id=${Number(thread.prospect_id)}`,
    );
    if (
      contacts.some(
        (c) =>
          c.suppressed &&
          String(c.email || "").toLowerCase() === thread.recipient,
      ) ||
      (contacts.some((c) => c.suppressed) &&
        !contacts.some(
          (c) =>
            !c.suppressed &&
            String(c.email || "").toLowerCase() === thread.recipient,
        ))
    )
      throw new MegatonError("This contact is suppressed.", 409);
  }
  if (
    !thread.legal_basis ||
    !thread.consent_reference ||
    !["corporate", "individual"].includes(String(thread.subscriber_type))
  )
    throw new MegatonError(
      "Record subscriber type, lawful basis and eligibility evidence before approval.",
      409,
    );
  if (
    thread.subscriber_type === "individual" &&
    thread.legal_basis !== "consent"
  )
    throw new MegatonError(
      "Individual subscribers require recorded consent in this release.",
      409,
    );
}
export async function megatonSnapshot(
  actor: MegatonActor,
  query = "",
  page = 1,
) {
  allowed(actor, "megaton.read");
  if (
    query.length > 120 ||
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > 10000
  )
    throw new MegatonError("Invalid search or page.");
  const config = megatonConfig();
  return db.transaction(async (tx) => {
    const [
      campaigns,
      evidence,
      threads,
      drafts,
      outbox,
      jobs,
      leads,
      events,
      connection,
    ] = await Promise.all([
      rows(
        tx,
        sql`select * from megaton_campaigns order by created_at desc limit 100`,
      ),
      rows(
        tx,
        sql`select selected.* from (select distinct on (e.prospect_id,e.category) e.* from megaton_evidence e join (select id from prospects where archived_at is null and (business_name ilike ${"%" + query + "%"} or coalesce(location,'') ilike ${"%" + query + "%"} or coalesce(industry,'') ilike ${"%" + query + "%"}) order by updated_at desc,id desc limit 50 offset ${(page - 1) * 50}) p on p.id=e.prospect_id where e.observed_at>=now()-interval '90 days' and e.observed_at<=now() order by e.prospect_id,e.category,e.confidence*e.strength desc,e.observed_at desc,e.id) selected order by selected.created_at desc`,
      ),
      rows(
        tx,
        sql`select c.*,u.display_name as owner_name from megaton_conversations c left join admin_users u on u.id=c.owner_user_id order by c.updated_at desc limit 100`,
      ),
      rows(
        tx,
        sql`select * from megaton_drafts order by created_at desc limit 100`,
      ),
      rows(
        tx,
        sql`select * from megaton_outbox order by created_at desc limit 100`,
      ),
      rows(
        tx,
        sql`select id,kind,prospect_id,state,attempts,error_code,created_at from megaton_jobs order by created_at desc limit 100`,
      ),
      rows(
        tx,
        sql`select id,business_name,contact_email as email,website_url as website,location,industry,stage from prospects where archived_at is null and (business_name ilike ${"%" + query + "%"} or coalesce(location,'') ilike ${"%" + query + "%"} or coalesce(industry,'') ilike ${"%" + query + "%"}) order by updated_at desc,id desc limit 50 offset ${(page - 1) * 50}`,
      ),
      rows(
        tx,
        sql`select e.*,u.display_name as actor_name from megaton_events e left join admin_users u on u.id=e.actor_user_id order by e.created_at desc limit 50`,
      ),
      rows(
        tx,
        sql`select id,label,active,last_synced_at,updated_at from megaton_connections where id='company-mailcow'`,
      ),
    ]);
    const messages = await rows(
      tx,
      sql`select m.* from megaton_messages m join (select id from megaton_conversations order by updated_at desc limit 100) t on t.id=m.conversation_id order by m.occurred_at desc limit 300`,
    );
    const usage = await rows(
      tx,
      sql`select state,count(*)::integer as operations,coalesce(sum(case when state='spent' then actual_microusd else reserved_microusd end),0)::integer as microusd from megaton_ai_usage where created_at>=date_trunc('month',now()) group by state`,
    );
    const [count] = await rows(
      tx,
      sql`select count(*)::integer as total from prospects where archived_at is null and (business_name ilike ${"%" + query + "%"} or coalesce(location,'') ilike ${"%" + query + "%"} or coalesce(industry,'') ilike ${"%" + query + "%"})`,
    );
    const usageRecords = await rows(
      tx,
      sql`select id,state,reserved_microusd,actual_microusd,created_at from megaton_ai_usage where state='unknown' order by created_at desc limit 50`,
    );
    return {
      campaigns,
      evidence,
      threads,
      drafts,
      outbox,
      jobs,
      leads,
      events,
      usage,
      usageRecords,
      totalCount: Number(count.total),
      page,
      pageSize: 50,
      connection: connection[0],
      messages,
      actorId: actor.id,
      permissions: {
        write: hasCapability(actor.role, "megaton.write"),
        approve: hasCapability(actor.role, "megaton.approve"),
        configure: hasCapability(actor.role, "megaton.configure"),
      },
      readiness: {
        enabled: config.enabled,
        externalEnabled: config.externalEnabled,
        sendEnabled: config.sendEnabled,
        stopped: config.stopped,
        mailboxConfigured: config.mailboxConfigured,
        dailySendLimit: config.dailySendLimit,
      },
      scores: leads.map((lead) => ({
        prospectId: lead.id,
        ...scoreEvidence(
          evidence
            .filter((e) => e.prospect_id === lead.id)
            .map((e) => ({
              category: e.category as EvidenceInput["category"],
              observation: String(e.observation),
              sourceUrl: String(e.source_url),
              observedAt: new Date(String(e.observed_at)).toISOString(),
              confidence: Number(e.confidence),
              strength: Number(e.strength),
            })),
        ),
      })),
    };
  });
}

export async function megatonMutation(actor: MegatonActor, input: Row) {
  if (!megatonConfig().enabled)
    throw new MegatonError("Megaton is disabled in the environment.", 409);
  const action = cleanText(input.action, "action", 40);
  allowed(
    actor,
    action === "approve" || action === "dispatch" || action === "reconcile"
      ? "megaton.approve"
      : action === "connection"
        ? "megaton.configure"
        : "megaton.write",
  );
  if (action === "dispatch") return dispatchApproved(actor, id(input.id));
  if (action === "work") return runMegatonJob(actor);
  if (action === "discover") {
    const results = await discoverRegistry(input.town, input.sicCode);
    await db.transaction((tx) =>
      event(tx, actor.id, "registry", "discovery_searched", {
        town: input.town,
        sicCode: input.sicCode,
        count: results.candidates.length,
      }),
    );
    return results;
  }
  return db.transaction(async (tx) => {
    if (action === "campaign") {
      if (input.country !== "GB")
        throw new MegatonError(
          "Only explicitly selected UK campaigns are supported.",
        );
      const [created] = await rows(
        tx,
        sql`insert into megaton_campaigns(name,town,industry,actor_user_id) values(${cleanText(input.name, "campaign", 120)},${cleanText(input.town, "UK town", 100)},${cleanText(input.industry, "industry", 100)},${actor.id}) returning *`,
      );
      await event(tx, actor.id, String(created.id), action);
      return created;
    }
    if (action === "import") {
      const [campaign] = await rows(
        tx,
        sql`select * from megaton_campaigns where id=${id(input.campaignId)}`,
      );
      if (!campaign) throw new MegatonError("Campaign not found.", 404);
      if (
        input.country !== "GB" ||
        String(input.town).trim().toLowerCase() !==
          String(campaign.town).toLowerCase()
      )
        throw new MegatonError(
          "Verify the business is in the campaign's UK town before import.",
        );
      const source = publicUrl(input.sourceUrl),
        reference = cleanText(
          input.sourceReference,
          "licence/source reference",
          500,
        ),
        name = cleanText(input.businessName, "business", 200),
        website = publicUrl(input.website);
      const domain = new URL(website).hostname
        .toLowerCase()
        .replace(/^www\./, "");
      await tx.execute(sql`select pg_advisory_xact_lock(640064)`);
      const matches = await rows(
        tx,
        sql`select id,business_name,location from prospects where lower(business_name)=${name.toLowerCase()} or lower(regexp_replace(regexp_replace(coalesce(website_url,''),'^https?://(www[.])?','','i'),'/.*$',''))=${domain}`,
      );
      // Ambiguous branches must be linked manually rather than merged by a shared domain.
      if (
        matches.length > 1 ||
        matches.some(
          (m) =>
            String(m.location || "").toLowerCase() !==
            String(campaign.town).toLowerCase(),
        )
      )
        throw new MegatonError(
          "Possible duplicate or branch. Review and link the existing prospect manually.",
          409,
        );
      let lead = matches[0];
      if (!lead)
        [lead] = await rows(
          tx,
          sql`insert into prospects(business_name,website_url,contact_email,location,industry,source,owner_user_id) values(${name},${website},${input.email ? emailAddress(input.email) : null},${String(campaign.town)},${String(campaign.industry)},'local',${actor.id}) returning id,business_name`,
        );
      await tx.execute(
        sql`insert into megaton_discovery_links(campaign_id,prospect_id,source_url,source_reference,actor_user_id) values(${String(campaign.id)},${Number(lead.id)},${source},${reference},${actor.id}) on conflict(campaign_id,prospect_id) do nothing`,
      );
      await event(tx, actor.id, String(lead.id), "discovery_import", {
        campaignId: campaign.id,
        sourceUrl: source,
      });
      return lead;
    }
    if (action === "evidence") {
      const e = evidenceInput(input),
        lead = prospectId(input.prospectId);
      await tx.execute(
        sql`insert into megaton_evidence(prospect_id,category,observation,source_url,observed_at,confidence,strength,actor_user_id) values(${lead},${e.category},${e.observation},${e.sourceUrl},${e.observedAt}::timestamptz,${e.confidence},${e.strength},${actor.id})`,
      );
      await event(tx, actor.id, String(lead), action, { category: e.category });
      await recordScore(tx, lead, actor.id);
      return { ok: true };
    }
    if (action === "research" || action === "sync") {
      if (
        action === "research" &&
        (!megatonConfig().externalEnabled || megatonConfig().stopped)
      )
        throw new MegatonError("External research is disabled.", 409);
      const [job] = await rows(
        tx,
        sql`insert into megaton_jobs(kind,prospect_id,actor_user_id) values(${action === "research" ? "research" : "mail_sync"},${action === "research" ? prospectId(input.prospectId) : null},${actor.id}) returning id`,
      );
      await event(tx, actor.id, String(job.id), "job_queued");
      return job;
    }
    if (action === "ai_draft") {
      const config = aiSettings();
      if (
        !config.enabled ||
        !config.key ||
        !megatonConfig().externalEnabled ||
        megatonConfig().stopped
      )
        throw new MegatonError(
          "AI drafting is not configured or enabled.",
          409,
        );
      const [draft] = await rows(
        tx,
        sql`select * from megaton_drafts where id=${id(input.id)}`,
      );
      if (!draft) throw new MegatonError("Draft not found.", 404);
      const thread = await threadLock(tx, draft.conversation_id);
      if (thread.owner_user_id || thread.status === "human_active")
        throw new MegatonError(
          "AI drafting is paused while a human conversation is active.",
          409,
        );
      await cancelPending(tx, thread);
      const [job] = await rows(
        tx,
        sql`insert into megaton_jobs(kind,draft_id,draft_revision,thread_revision,prospect_id,actor_user_id) values('ai_draft',${String(draft.id)},${Number(draft.revision)},${Number(thread.revision)},${thread.prospect_id ? Number(thread.prospect_id) : null},${actor.id}) returning id`,
      );
      await event(tx, actor.id, String(job.id), "ai_draft_queued");
      return job;
    }
    if (action === "connection") {
      const active = input.active === true;
      if (active) requireExternal();
      await tx.execute(sql`select pg_advisory_xact_lock(640066)`);
      if (
        (
          await rows(
            tx,
            sql`select id from megaton_outbox where state='sending'`,
          )
        ).length
      )
        throw new MegatonError(
          "A send is in flight; wait for its result.",
          409,
        );
      await tx.execute(
        sql`update megaton_connections set active=${active},activated_by=${actor.id},last_synced_at=null,updated_at=now() where id='company-mailcow'`,
      );
      if (!active)
        await tx.execute(
          sql`update megaton_outbox set state='cancelled',completed_at=now() where state='approved'`,
        );
      await event(
        tx,
        actor.id,
        "company-mailcow",
        active ? "connection_activated" : "connection_revoked",
      );
      return { ok: true };
    }
    if (action === "draft") {
      const [lead] = await rows(
        tx,
        sql`select * from prospects where id=${prospectId(input.prospectId)} and archived_at is null`,
      );
      if (!lead) throw new MegatonError("Prospect not found.", 404);
      const recipient = emailAddress(input.recipient || lead.contact_email),
        offer = cleanText(input.offer, "offer", 30) as Offer;
      const evidence = await rows(
        tx,
        sql`select observation from megaton_evidence where prospect_id=${Number(lead.id)} and observed_at > now()-interval '90 days' and confidence>=0.8 order by observed_at desc limit 2`,
      );
      const content = draftOutreach(
        String(lead.business_name),
        offer,
        evidence.map((e) => String(e.observation)),
      );
      await tx.execute(
        sql`insert into megaton_conversations(connection_id,prospect_id,recipient,subject) values('company-mailcow',${Number(lead.id)},${recipient},${content.subject}) on conflict(connection_id,recipient) do nothing`,
      );
      const [thread] = await rows(
        tx,
        sql`select * from megaton_conversations where connection_id='company-mailcow' and recipient=${recipient} for update`,
      );
      if (thread.prospect_id && Number(thread.prospect_id) !== Number(lead.id))
        throw new MegatonError(
          "This address already belongs to another prospect conversation.",
          409,
        );
      if (!thread.prospect_id)
        await tx.execute(
          sql`update megaton_conversations set prospect_id=${Number(lead.id)} where id=${String(thread.id)} and prospect_id is null`,
        );
      const [draft] = await rows(
        tx,
        sql`insert into megaton_drafts(conversation_id,subject,body,offer,actor_user_id,campaign_id) values(${String(thread.id)},${content.subject},${content.body},${offer},${actor.id},${input.campaignId ? id(input.campaignId) : null}) returning *`,
      );
      await event(tx, actor.id, String(draft.id), "draft_created");
      return draft;
    }
    if (action === "edit") {
      const [draft] = await rows(
        tx,
        sql`select * from megaton_drafts where id=${id(input.id)}`,
      );
      if (!draft) throw new MegatonError("Draft not found.", 404);
      const thread = await threadLock(tx, draft.conversation_id);
      await cancelPending(tx, thread);
      if (Number(draft.revision) !== Number(input.revision))
        throw new MegatonError("Draft changed. Reload.", 409);
      const subject = cleanText(input.subject, "subject", 300);
      if (/[\r\n]/.test(subject))
        throw new MegatonError("Subject must be a single line.");
      await tx.execute(
        sql`update megaton_drafts set subject=${subject},body=${cleanText(input.body, "message", 20000)},revision=revision+1 where id=${String(draft.id)} and revision=${Number(input.revision)}`,
      );
      await event(tx, actor.id, String(draft.id), "draft_edited");
      return { ok: true };
    }
    if (
      action === "eligibility" ||
      action === "claim" ||
      action === "handback" ||
      action === "close" ||
      action === "suppress"
    ) {
      const thread = await threadLock(tx, input.id);
      if (action !== "suppress") await cancelPending(tx, thread);
      else
        await tx.execute(
          sql`update megaton_outbox set state='cancelled',completed_at=now() where conversation_id=${String(thread.id)} and state='approved'`,
        );
      if (Number(thread.revision) !== Number(input.revision))
        throw new MegatonError("Conversation changed. Reload.", 409);
      if (action === "eligibility") {
        const basis = cleanText(input.legalBasis, "lawful basis", 30),
          subscriber = cleanText(input.subscriberType, "subscriber type", 30);
        if (
          !["consent", "legitimate_interests"].includes(basis) ||
          !["corporate", "individual", "unknown"].includes(subscriber)
        )
          throw new MegatonError("Invalid eligibility classification.");
        await tx.execute(
          sql`update megaton_conversations set legal_basis=${basis},subscriber_type=${subscriber},consent_reference=${cleanText(input.reference, "eligibility evidence", 2000)},revision=revision+1,updated_at=now() where id=${String(thread.id)}`,
        );
      } else if (action === "suppress") {
        await tx.execute(
          sql`insert into megaton_suppressions(address,reason,actor_user_id) values(${String(thread.recipient)},${cleanText(input.reason, "suppression reason", 500)},${actor.id}) on conflict(address) do nothing`,
        );
        await tx.execute(
          sql`update megaton_conversations set suppressed=true,status='closed',revision=revision+1,updated_at=now() where id=${String(thread.id)}`,
        );
      } else {
        if (action === "handback" && thread.owner_user_id !== actor.id)
          throw new MegatonError(
            "Only the current human owner can hand back this conversation.",
            409,
          );
        if (thread.owner_user_id && thread.owner_user_id !== actor.id)
          throw new MegatonError(
            "Only the current human owner can hand back or close this conversation.",
            409,
          );
        await tx.execute(
          sql`update megaton_conversations set owner_user_id=${action === "claim" ? actor.id : null},status=${action === "claim" ? "human_active" : action === "close" ? "closed" : "review"},revision=revision+1,updated_at=now() where id=${String(thread.id)}`,
        );
      }
      await event(tx, actor.id, String(thread.id), action);
      return { ok: true };
    }
    if (action === "approve") {
      const [draft] = await rows(
        tx,
        sql`select * from megaton_drafts where id=${id(input.id)}`,
      );
      if (!draft) throw new MegatonError("Draft not found.", 404);
      const thread = await threadLock(tx, draft.conversation_id);
      await eligible(tx, thread);
      if (
        Number(input.revision) !== Number(draft.revision) ||
        Number(input.threadRevision) !== Number(thread.revision)
      )
        throw new MegatonError(
          "Displayed draft or conversation changed. Reload before approving.",
          409,
        );
      if (thread.status === "human_active" && !thread.owner_user_id)
        throw new MegatonError(
          "Take human ownership before approving a reply.",
          409,
        );
      if (thread.owner_user_id && thread.owner_user_id !== actor.id)
        throw new MegatonError(
          "Human owner must approve their own reply.",
          409,
        );
      if (thread.status === "closed")
        throw new MegatonError("Conversation is closed.", 409);
      const expiry = new Date(Date.now() + 24 * 3600000),
        due = input.dueAt ? new Date(String(input.dueAt)) : new Date();
      if (
        !Number.isFinite(due.valueOf()) ||
        due.valueOf() > expiry.valueOf() ||
        due.valueOf() < Date.now() - 60000
      )
        throw new MegatonError("Schedule within the next 24 hours.");
      const messageId = `<${randomUUID()}@scalesmiths.co.uk>`;
      const [approval] = await rows(
        tx,
        sql`insert into megaton_outbox(draft_id,conversation_id,content_hash,thread_revision,approved_by,approved_session_version,expires_at,due_at,message_id) values(${String(draft.id)},${String(thread.id)},${hash(draft, thread)},${Number(thread.revision)},${actor.id},${actor.sessionVersion},${expiry.toISOString()}::timestamptz,${due.toISOString()}::timestamptz,${messageId}) returning id`,
      );
      await event(tx, actor.id, String(approval.id), "exact_content_approved");
      return approval;
    }
    if (action === "reconcile") {
      const [out] = await rows(
        tx,
        sql`select * from megaton_outbox where id=${id(input.id)}`,
      );
      if (!out || out.state !== "unknown")
        throw new MegatonError(
          "Only an uncertain send can be reconciled.",
          409,
        );
      await threadLock(tx, out.conversation_id);
      if (!["accepted", "cancelled"].includes(String(input.outcome)))
        throw new MegatonError(
          "Choose confirmed acceptance or confirmed non-send.",
        );
      const reference = cleanText(
        input.reference,
        "Mailcow reconciliation evidence",
        2000,
      );
      await tx.execute(
        sql`update megaton_outbox set state=${String(input.outcome)},provider_reference=${reference},completed_at=now() where id=${String(out.id)} and state='unknown'`,
      );
      await event(tx, actor.id, String(out.id), "send_reconciled", {
        outcome: input.outcome,
        reference,
      });
      return { ok: true };
    }
    if (action === "ai_reconcile") {
      allowed(actor, "megaton.configure");
      allowed(actor, "finance.write");
      const amount = Number(input.actualMicrousd),
        reference = cleanText(input.reference, "provider usage evidence", 2000);
      if (
        typeof input.actualMicrousd !== "number" ||
        !Number.isSafeInteger(amount) ||
        amount < 0 ||
        amount > 1000000000
      )
        throw new MegatonError("Invalid provider cost in micro-USD.");
      const [usage] = await rows(
        tx,
        sql`update megaton_ai_usage set state='spent',actual_microusd=${amount} where id=${id(input.id)} and state='unknown' returning id`,
      );
      if (!usage)
        throw new MegatonError(
          "Only uncertain AI usage can be reconciled.",
          409,
        );
      await event(tx, actor.id, String(usage.id), "ai_usage_reconciled", {
        actualMicrousd: amount,
        reference,
      });
      return { ok: true };
    }
    if (action === "job_retry" || action === "job_cancel") {
      const [job] = await rows(
        tx,
        sql`select * from megaton_jobs where id=${id(input.id)} for update`,
      );
      if (
        !job ||
        !["queued", "dead_letter", "failed"].includes(String(job.state))
      )
        throw new MegatonError(
          "Only waiting or failed jobs can be changed.",
          409,
        );
      if (
        action === "job_retry" &&
        job.kind === "ai_draft" &&
        (
          await rows(
            tx,
            sql`select id from megaton_ai_usage where job_id=${String(job.id)}`,
          )
        ).length
      )
        throw new MegatonError(
          "Do not retry a charged or uncertain AI call. Reconcile usage and request a fresh draft.",
          409,
        );
      await tx.execute(
        sql`update megaton_jobs set state=${action === "job_retry" ? "queued" : "cancelled"},attempts=case when ${action === "job_retry"} then 0 else attempts end,next_at=now() where id=${String(job.id)}`,
      );
      await event(tx, actor.id, String(job.id), action);
      return { ok: true };
    }
    throw new MegatonError("Unsupported operation.");
  });
}

async function dispatchApproved(
  actor: MegatonActor,
  outboxId: string,
  automated = false,
) {
  const config = requireExternal(megatonConfig(), true);
  const prepared = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(640066)`);
    const [out] = await rows(
      tx,
      sql`select * from megaton_outbox where id=${outboxId}`,
    );
    if (!out || out.state !== "approved")
      throw new MegatonError(
        "Approval is unavailable or already consumed.",
        409,
      );
    const thread = await threadLock(tx, out.conversation_id);
    const [draft] = await rows(
      tx,
      sql`select * from megaton_drafts where id=${String(out.draft_id)}`,
    );
    const [approver] = await rows(
      tx,
      sql`select role,active,session_version from admin_users where id=${String(out.approved_by)}`,
    );
    const [connection] = await rows(
      tx,
      sql`select active,last_synced_at from megaton_connections where id='company-mailcow'`,
    );
    if (
      !connection?.active ||
      !approver?.active ||
      Number(approver.session_version) !==
        Number(out.approved_session_version) ||
      !hasCapability(approver.role as AdminRole, "megaton.approve")
    )
      throw new MegatonError(
        "Connection or approving identity is revoked.",
        409,
      );
    if (
      !draft ||
      hash(draft, thread) !== out.content_hash ||
      Number(thread.revision) !== Number(out.thread_revision) ||
      new Date(String(out.expires_at)) < new Date() ||
      new Date(String(out.due_at)) > new Date()
    )
      throw new MegatonError("Approval is stale, expired or not due.", 409);
    if (
      !connection.last_synced_at ||
      Date.now() - new Date(String(connection.last_synced_at)).valueOf() >
        120000
    )
      throw new MegatonError(
        "Sync the company mailbox before dispatch; incoming state must be recent.",
        409,
      );
    // Initial release supports human-approved replies only. A human-owned thread cannot be dispatched by a different actor or automation.
    if (
      (automated &&
        (thread.owner_user_id || thread.status === "human_active")) ||
      (thread.owner_user_id &&
        (thread.owner_user_id !== actor.id || out.approved_by !== actor.id))
    )
      throw new MegatonError(
        "Only the human owner may send this approved reply.",
        409,
      );
    await eligible(tx, thread);
    if (
      (
        await rows(
          tx,
          sql`select id from megaton_outbox where conversation_id=${String(thread.id)} and state in ('sending','unknown')`,
        )
      ).length
    )
      throw new MegatonError("Another send is in flight or uncertain.", 409);
    const [usage] = await rows(
      tx,
      sql`select count(*)::integer as n from megaton_outbox where started_at >= date_trunc('day',now() at time zone 'Europe/London') at time zone 'Europe/London' and state in ('sending','accepted','unknown')`,
    );
    if (Number(usage.n) >= config.dailySendLimit)
      throw new MegatonError("Daily send limit reached.", 409);
    await tx.execute(
      sql`update megaton_outbox set state='sending',started_at=now() where id=${outboxId} and state='approved'`,
    );
    const [latest] = await rows(
      tx,
      sql`select external_id from megaton_messages where conversation_id=${String(thread.id)} and direction='inbound' order by occurred_at desc limit 1`,
    );
    const replyId =
      latest && /^<[^<>\r\n]+>$/.test(String(latest.external_id))
        ? String(latest.external_id)
        : undefined;
    await event(tx, actor.id, outboxId, "send_started");
    return { out, draft, thread, replyId };
  });
  try {
    const receipt = await sendMailcow(
      {
        recipient: String(prepared.thread.recipient),
        subject: String(prepared.draft.subject),
        body: String(prepared.draft.body),
        messageId: String(prepared.out.message_id),
        inReplyTo: prepared.replyId,
      },
      config,
    );
    await db.transaction(async (tx) => {
      await threadLock(tx, prepared.thread.id);
      await tx.execute(
        sql`update megaton_outbox set state='accepted',provider_reference=${receipt.reference},completed_at=now() where id=${outboxId} and state='sending'`,
      );
      await tx.execute(
        sql`insert into megaton_messages(conversation_id,external_id,direction,body,classification,occurred_at) values(${String(prepared.thread.id)},${receipt.reference},'outbound',${String(prepared.draft.body)},'human_approved',now()) on conflict do nothing`,
      );
      await tx.execute(
        sql`update megaton_conversations set status=case when suppressed then 'closed' when owner_user_id is not null or status='human_active' then 'human_active' else 'awaiting_prospect' end,revision=revision+1,updated_at=now() where id=${String(prepared.thread.id)}`,
      );
      await event(tx, actor.id, outboxId, "smtp_accepted");
    });
    return { ok: true, state: "accepted" };
  } catch {
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`update megaton_outbox set state='unknown',error_code='smtp_result_uncertain' where id=${outboxId} and state='sending'`,
      );
      await event(tx, actor.id, outboxId, "send_uncertain");
    });
    throw new MegatonError(
      "Send result is uncertain. Check Mailcow before reconciling; no automatic retry will occur.",
      409,
    );
  }
}

export async function runMegatonWorker(actor: MegatonActor) {
  allowed(actor, "megaton.write");
  const config = megatonConfig();
  if (config.retentionDays > 0 && config.enabled && !config.stopped)
    await db.transaction(async (tx) => {
      const deleted = await rows(
        tx,
        sql`delete from megaton_messages where occurred_at<now()-${config.retentionDays}*interval '1 day' returning id`,
      );
      if (deleted.length)
        await event(tx, actor.id, "retention", "message_retention_applied", {
          count: deleted.length,
          days: config.retentionDays,
        });
    });
  if (
    config.enabled &&
    config.externalEnabled &&
    !config.stopped &&
    config.mailboxConfigured
  ) {
    await db.execute(
      sql`insert into megaton_jobs(kind,actor_user_id) select 'mail_sync',${actor.id} from megaton_connections where id='company-mailcow' and active=true on conflict do nothing`,
    );
  }
  const processed = await runMegatonJob(actor);
  if (process.env.MEGATON_WORKER_SEND_ENABLED !== "true") return processed;
  allowed(actor, "megaton.approve");
  const [due] = await rows(
    db,
    sql`select o.id from megaton_outbox o join megaton_conversations c on c.id=o.conversation_id where o.state='approved' and o.due_at<=now() and o.expires_at>now() and c.owner_user_id is null and c.status<>'human_active' order by o.due_at limit 1`,
  );
  if (due)
    return {
      ...processed,
      send: await dispatchApproved(actor, String(due.id), true),
    };
  return processed;
}

async function ingestMail(
  message: MailcowMessage,
  existingTx?: AdminDatabaseTransaction,
) {
  const persist = async (tx: AdminDatabaseTransaction) => {
    const [connection] = await rows(
      tx,
      sql`select active,last_synced_at from megaton_connections where id='company-mailcow' for update`,
    );
    if (!connection?.active)
      throw new MegatonError("Company mailbox connection revoked.", 409);
    const match = await rows(
      tx,
      sql`select id from prospects where lower(contact_email)=${message.sender} and archived_at is null limit 2`,
    );
    await tx.execute(
      sql`insert into megaton_conversations(connection_id,prospect_id,recipient,subject) values('company-mailcow',${match.length === 1 ? Number(match[0].id) : null},${message.sender},${message.subject}) on conflict(connection_id,recipient) do nothing`,
    );
    const [thread] = await rows(
      tx,
      sql`select * from megaton_conversations where connection_id='company-mailcow' and recipient=${message.sender} for update`,
    );
    const classification =
      message.direction === "outbound"
        ? { kind: "native_human_reply", takeover: true }
        : classifyMessage(message.body);
    const inserted = await rows(
      tx,
      sql`insert into megaton_messages(conversation_id,external_id,direction,body,classification,occurred_at) values(${String(thread.id)},${message.externalId},${message.direction || "inbound"},${message.body},${classification.kind},${message.occurredAt}::timestamptz) on conflict do nothing returning id`,
    );
    if (!inserted.length) return;
    await tx.execute(
      sql`update megaton_outbox set state='cancelled',completed_at=now() where conversation_id=${String(thread.id)} and state='approved'`,
    );
    if (classification.kind === "suppression")
      await tx.execute(
        sql`insert into megaton_suppressions(address,reason) values(${message.sender},'Recipient requested suppression') on conflict do nothing`,
      );
    await tx.execute(
      sql`update megaton_conversations set status=${classification.kind === "suppression" ? "closed" : "human_active"},suppressed=suppressed or ${classification.kind === "suppression"},revision=revision+1,updated_at=now() where id=${String(thread.id)}`,
    );
    await event(tx, null, String(thread.id), "inbound_review_required", {
      classification: classification.kind,
    });
  };
  if (existingTx) await persist(existingTx);
  else await db.transaction(persist);
}

export async function runMegatonJob(actor: MegatonActor) {
  allowed(actor, "megaton.write");
  const config = megatonConfig();
  if (!config.enabled || !config.externalEnabled || config.stopped)
    throw new MegatonError("External work is disabled.", 409);
  const owner = randomUUID();
  const job = await db.transaction(async (tx) => {
    // A crashed SMTP process is never retried as an ordinary job.
    await tx.execute(
      sql`update megaton_outbox set state='unknown',error_code='interrupted_send' where state='sending' and started_at<now()-interval '5 minutes'`,
    );
    await tx.execute(
      sql`update megaton_jobs set state=case when attempts>=3 then 'dead_letter' else 'queued' end,lease_owner=null,lease_until=null where state='running' and lease_until<now()`,
    );
    const [next] = await rows(
      tx,
      sql`select * from megaton_jobs where state='queued' and next_at<=now() order by created_at for update skip locked limit 1`,
    );
    if (!next) return null;
    const [initiator] = await rows(
      tx,
      sql`select active,role from admin_users where id=${String(next.actor_user_id)}`,
    );
    if (
      !initiator?.active ||
      !hasCapability(initiator.role as AdminRole, "megaton.write")
    ) {
      await tx.execute(
        sql`update megaton_jobs set state='cancelled',error_code='initiator_revoked' where id=${String(next.id)}`,
      );
      return null;
    }
    await tx.execute(
      sql`update megaton_jobs set state='running',attempts=attempts+1,lease_owner=${owner},lease_until=now()+interval '5 minutes' where id=${String(next.id)}`,
    );
    return next;
  });
  if (!job) return { ok: true, processed: 0 };
  try {
    if (job.kind === "mail_sync") {
      requireExternal(config);
      const [connection] = await rows(
        db,
        sql`select active,cursor from megaton_connections where id='company-mailcow'`,
      );
      if (!connection?.active)
        throw new MegatonError("Activate the company mailbox first.", 409);
      // Synchronise one mailbox at a time across all workers, for bounded cursor progression.
      await db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(640067)`);
        const [current] = await rows(
          tx,
          sql`select cursor from megaton_connections where id='company-mailcow'`,
        );
        const previous = current.cursor as {
          inbox?: MailcowCursor;
          sent?: MailcowCursor;
        };
        const inbox = await readMailcow(
          previous.inbox || {},
          (message) => ingestMail(message, tx),
          config,
        );
        const sent = await readMailcow(
          previous.sent || {},
          (message) => ingestMail(message, tx),
          config,
          true,
        );
        await tx.execute(
          sql`update megaton_connections set cursor=${JSON.stringify({ inbox, sent })}::jsonb,last_synced_at=now(),updated_at=now() where id='company-mailcow'`,
        );
      });
    } else if (job.kind === "ai_draft") {
      const ai = aiSettings();
      if (!ai.enabled || !ai.key)
        throw new MegatonError("AI is disabled.", 409);
      const context = await db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(640068)`);
        const [draft] = await rows(
          tx,
          sql`select * from megaton_drafts where id=${String(job.draft_id)}`,
        );
        if (!draft) throw new MegatonError("Draft is unavailable.", 409);
        const thread = await threadLock(tx, draft.conversation_id);
        if (
          thread.owner_user_id ||
          thread.status === "human_active" ||
          Number(draft.revision) !== Number(job.draft_revision) ||
          Number(thread.revision) !== Number(job.thread_revision)
        )
          throw new MegatonError("AI job is stale or human-owned.", 409);
        if (
          (
            await rows(
              tx,
              sql`select id from megaton_ai_usage where job_id=${String(job.id)}`,
            )
          ).length
        )
          throw new MegatonError(
            "This AI operation already reserved spend; reconcile before retry.",
            409,
          );
        const [usage] = await rows(
          tx,
          sql`select coalesce(sum(case when created_at>=date_trunc('day',now()) then case when state='spent' then actual_microusd else reserved_microusd end else 0 end),0)::integer as daily,coalesce(sum(case when state='spent' then actual_microusd else reserved_microusd end),0)::integer as monthly from megaton_ai_usage where created_at>=date_trunc('month',now())`,
        );
        if (
          Number(usage.daily) + ai.reservation > ai.daily ||
          Number(usage.monthly) + ai.reservation > ai.monthly
        )
          throw new MegatonError("AI spend cap would be exceeded.", 409);
        await tx.execute(
          sql`insert into megaton_ai_usage(job_id,state,reserved_microusd) values(${String(job.id)},'reserved',${ai.reservation})`,
        );
        const evidence = await rows(
          tx,
          sql`select observation from megaton_evidence where prospect_id=${Number(job.prospect_id)} and confidence>=0.8 and observed_at>now()-interval '90 days' order by observed_at desc limit 3`,
        );
        const [lead] = await rows(
          tx,
          sql`select business_name from prospects where id=${Number(job.prospect_id)}`,
        );
        return {
          draft,
          thread,
          input: {
            business: String(lead?.business_name || "Business"),
            offer: String(draft.offer),
            observations: evidence.map((e) => String(e.observation)),
            baseline: {
              subject: String(draft.subject),
              body: String(draft.body),
            },
          },
        };
      });
      try {
        const proposal = await requestAIProposal(context.input);
        await db.transaction(async (tx) => {
          // Usage is recorded even if a founder changed the draft during provider execution.
          await tx.execute(
            sql`update megaton_ai_usage set state='spent',actual_microusd=${Math.ceil(proposal.inputTokens * 0.4 + proposal.outputTokens * 1.6)},input_tokens=${proposal.inputTokens},output_tokens=${proposal.outputTokens} where job_id=${String(job.id)}`,
          );
          const thread = await threadLock(tx, context.thread.id);
          const [draft] = await rows(
            tx,
            sql`select revision from megaton_drafts where id=${String(job.draft_id)}`,
          );
          const [lease] = await rows(
            tx,
            sql`select id from megaton_jobs where id=${String(job.id)} and lease_owner=${owner} and lease_until>now()`,
          );
          if (
            !lease ||
            thread.owner_user_id ||
            thread.status === "human_active" ||
            Number(thread.revision) !== Number(job.thread_revision) ||
            Number(draft?.revision) !== Number(job.draft_revision)
          ) {
            await event(
              tx,
              String(job.actor_user_id),
              String(job.id),
              "ai_proposal_discarded_stale",
            );
            return;
          }
          await cancelPending(tx, thread);
          await tx.execute(
            sql`update megaton_drafts set subject=${proposal.subject},body=${proposal.body},revision=revision+1 where id=${String(job.draft_id)}`,
          );
          await event(
            tx,
            String(job.actor_user_id),
            String(job.draft_id),
            "ai_proposal_requires_review",
          );
        });
      } catch (error) {
        await db.execute(
          sql`update megaton_ai_usage set state='unknown' where job_id=${String(job.id)} and state='reserved'`,
        );
        throw error;
      }
    } else {
      const [lead] = await rows(
        db,
        sql`select website_url as website from prospects where id=${Number(job.prospect_id)} and archived_at is null`,
      );
      if (!lead?.website)
        throw new MegatonError("A public website is required.");
      const url = publicUrl(lead.website),
        response = await createSafeOutboundClient()(url, {
          timeoutMs: 10000,
          maxResponseBytes: 200000,
          maxRedirects: 3,
        });
      if (
        response.status !== 200 ||
        !response.headers.get("content-type")?.includes("text/html")
      )
        throw new Error("website_unavailable");
      // Objective checks only. Absence from one HTML response is not a whole-site audit.
      const observations = websiteObservations(response.body, response.url);
      await db.transaction(async (tx) => {
        const [lease] = await rows(
          tx,
          sql`select id from megaton_jobs where id=${String(job.id)} and lease_owner=${owner} and lease_until>now() for update`,
        );
        if (!lease) throw new MegatonError("Worker lease expired.", 409);
        for (const evidence of observations)
          await tx.execute(
            sql`insert into megaton_evidence(prospect_id,category,observation,source_url,observed_at,confidence,strength,actor_user_id) values(${Number(job.prospect_id)},'digital',${evidence.observation},${response.url},now(),1,${evidence.strength},${String(job.actor_user_id)})`,
          );
        await event(
          tx,
          String(job.actor_user_id),
          String(job.prospect_id),
          "website_researched",
          { sourceUrl: response.url },
        );
        await recordScore(
          tx,
          Number(job.prospect_id),
          String(job.actor_user_id),
        );
      });
    }
    await db.execute(
      sql`update megaton_jobs set state='completed',lease_until=null where id=${String(job.id)} and lease_owner=${owner}`,
    );
    return { ok: true, processed: 1 };
  } catch {
    await db.execute(
      sql`update megaton_jobs set state=case when attempts>=3 then 'dead_letter' else 'queued' end,error_code='external_operation_failed',lease_until=null,next_at=now()+interval '2 minutes' where id=${String(job.id)} and lease_owner=${owner}`,
    );
    throw new MegatonError(
      "External operation failed. The bounded job is retained for retry or investigation; no credential details are logged.",
      503,
    );
  }
}
