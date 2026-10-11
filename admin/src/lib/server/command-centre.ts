import "server-only"
import { and, desc, eq, isNull, sql } from "drizzle-orm"
import { db, type AdminDatabaseTransaction } from "@/lib/db"
import {
  adminUsers,
  clients,
  prospects,
  outreachActivities,
  proposalTrackings,
  invoices,
  commercialContacts,
  commercialTasks,
  commercialContracts,
  commercialPayments,
  commercialForecasts,
  commercialSettings,
  commercialAudit,
} from "@/lib/schema"
import {
  CommercialError,
  REVENUE_CATEGORIES,
  companyDomain,
  minorUnits,
  normalizedCompany,
  positiveId,
  requiredText,
  validDate,
  DEFAULT_COMMERCIAL_CONFIG,
  DEFAULT_COMPANY_TARGETS,
  nextLondonOccurrence,
} from "@/lib/command-centre"
import {
  parseProspectPayload,
  parseOutreachActivityPayload,
  stageDateUpdates,
} from "@/lib/prospects"
import { hasCapability } from "@/lib/rbac"
import type { AdminRole } from "@/lib/admin-users"

type Actor = { id: string; role: AdminRole; displayName: string }
type Input = Record<string, unknown>
function text(value: unknown, max = 2000) {
  return value == null || value === ""
    ? null
    : requiredText(value, "Value", max)
}
function category(value: unknown) {
  if (
    !REVENUE_CATEGORIES.includes(value as (typeof REVENUE_CATEGORIES)[number])
  )
    throw new CommercialError("Invalid revenue category.")
  return String(value)
}
async function audit(
  tx: AdminDatabaseTransaction,
  actor: Actor,
  entity: string,
  recordId: unknown,
  action: string,
  before: unknown,
  after: unknown,
) {
  await tx.insert(commercialAudit).values({
    actorUserId: actor.id,
    entity,
    recordId: String(recordId),
    action,
    beforeValue: before,
    afterValue: after,
  })
}
async function assignee(
  tx: AdminDatabaseTransaction,
  value: unknown,
  fallback: string,
) {
  const id =
    value == null || value === "" ? fallback : requiredText(value, "Owner", 100)
  const [user] = await tx
    .select({ id: adminUsers.id, role: adminUsers.role })
    .from(adminUsers)
    .where(and(eq(adminUsers.id, id), eq(adminUsers.active, true)))
  if (!user || !hasCapability(user.role, "leads.write"))
    throw new CommercialError("Choose an active commercial user.")
  return user.id
}
async function linkedContact(
  tx: AdminDatabaseTransaction,
  contactId: unknown,
  prospectId: number,
  outbound = false,
) {
  if (!contactId) return null
  const id = positiveId(contactId)
  const [row] = await tx
    .select()
    .from(commercialContacts)
    .where(
      and(
        eq(commercialContacts.id, id),
        eq(commercialContacts.prospectId, prospectId),
      ),
    )
  if (!row)
    throw new CommercialError("Contact does not belong to this business.")
  if (outbound && row.suppressed)
    throw new CommercialError(
      "This contact has opted out. Outreach is suppressed.",
      409,
    )
  return id
}
function checkVersion(input: Input, row: { version: number }) {
  if (input.version !== row.version)
    throw new CommercialError("This record changed. Reload before saving.", 409)
}

export async function commercialSnapshot(actor: Actor) {
  const finance = hasCapability(actor.role, "finance.read")
  const [
    leads,
    activities,
    contacts,
    tasks,
    users,
    settings,
    history,
    clientRows,
    contracts,
    payments,
    forecasts,
    invoiceRows,
    proposals,
  ] = await Promise.all([
    db
      .select()
      .from(prospects)
      .where(isNull(prospects.archivedAt))
      .orderBy(desc(prospects.updatedAt)),
    db
      .select()
      .from(outreachActivities)
      .orderBy(desc(outreachActivities.createdAt)),
    db.select().from(commercialContacts),
    db.select().from(commercialTasks).orderBy(commercialTasks.dueAt),
    db
      .select({
        id: adminUsers.id,
        displayName: adminUsers.displayName,
        role: adminUsers.role,
        founderTargets: sql<Record<
          string,
          number
        > | null>`case when lower(${adminUsers.email}) in ('admin@scalesmiths.co.uk', 'trev@scalesmiths.co.uk') then '{"connections":1,"connectionStretch":2}'::jsonb else null end`,
      })
      .from(adminUsers)
      .where(eq(adminUsers.active, true)),
    db.select().from(commercialSettings),
    db
      .select()
      .from(commercialAudit)
      .orderBy(desc(commercialAudit.createdAt))
      .limit(500),
    hasCapability(actor.role, "clients.read")
      ? db.select({ id: clients.id, name: clients.name }).from(clients)
      : [],
    finance ? db.select().from(commercialContracts) : [],
    finance ? db.select().from(commercialPayments) : [],
    finance ? db.select().from(commercialForecasts) : [],
    finance
      ? db
          .select({
            id: invoices.id,
            clientId: invoices.clientId,
            invoiceNumber: invoices.invoiceNumber,
            status: invoices.status,
            total: invoices.total,
            dueDate: invoices.dueDate,
          })
          .from(invoices)
      : [],
    db.select().from(proposalTrackings),
  ])
  return {
    actor: {
      id: actor.id,
      name: actor.displayName,
      canWrite: hasCapability(actor.role, "leads.write"),
      canFinance: hasCapability(actor.role, "finance.write"),
      canReadFinance: finance,
      canConfigure: hasCapability(actor.role, "settings.manage"),
    },
    leads,
    activities,
    contacts,
    tasks,
    users: users.filter((u) => hasCapability(u.role, "leads.write")),
    settings,
    history: history.filter(
      (h) => finance || !["contract", "payment", "forecast"].includes(h.entity),
    ),
    clients: clientRows,
    contracts,
    payments,
    forecasts,
    invoices: invoiceRows,
    proposals,
    defaults: {
      config: DEFAULT_COMMERCIAL_CONFIG,
      targets: DEFAULT_COMPANY_TARGETS,
    },
    serverTime: new Date().toISOString(),
  }
}

export async function commercialMutation(actor: Actor, input: Input) {
  const action = requiredText(input.action, "Action", 50)
  const capability = [
    "contract",
    "payment",
    "reversePayment",
    "forecast",
    "endContract",
    "confirmContract",
  ].includes(action)
    ? "finance.write"
    : action === "settings"
      ? "settings.manage"
      : "leads.write"
  if (!hasCapability(actor.role, capability))
    throw new CommercialError("Forbidden.", 403)
  return db.transaction(async (tx) => {
    const now = new Date()
    if (action === "createProspect") {
      const parsed = parseProspectPayload(input, "create")
      if (!parsed.ok || !parsed.data.businessName)
        throw new CommercialError(
          parsed.ok ? "Business name is required." : parsed.error,
        )
      // Serialize duplicate checks across devices before inserting a shared lead.
      await tx.execute(sql`select pg_advisory_xact_lock(640064)`)
      const existing = await tx
        .select({
          id: prospects.id,
          businessName: prospects.businessName,
          websiteUrl: prospects.websiteUrl,
        })
        .from(prospects)
        .where(isNull(prospects.archivedAt))
      const domain = companyDomain(parsed.data.websiteUrl)
      const duplicates = existing.filter((r) => {
        if (
          normalizedCompany(r.businessName) ===
          normalizedCompany(parsed.data.businessName!)
        )
          return true
        // Invalid legacy URLs must not prevent capturing unrelated businesses.
        try {
          return Boolean(domain && companyDomain(r.websiteUrl) === domain)
        } catch {
          return false
        }
      })
      if (duplicates.length && input.allowDuplicate !== true)
        throw new CommercialError(
          "A matching business already exists.",
          409,
          duplicates,
        )
      const [row] = await tx
        .insert(prospects)
        .values({
          ...parsed.data,
          businessName: parsed.data.businessName,
          ownerUserId: await assignee(tx, input.ownerUserId, actor.id),
          joint: input.joint === true,
        })
        .returning()
      await audit(tx, actor, "prospect", row.id, action, null, row)
      if (input.followUpAt)
        await tx.insert(commercialTasks).values({
          prospectId: row.id,
          assignedUserId: row.ownerUserId!,
          title: "Research company",
          dueAt: validDate(input.followUpAt),
        })
      return row
    }
    if (["updateProspect", "activity", "contact"].includes(action)) {
      const id = positiveId(input.prospectId)
      const [lead] = await tx
        .select()
        .from(prospects)
        .where(eq(prospects.id, id))
        .for("update")
      if (!lead || lead.archivedAt)
        throw new CommercialError("Prospect not found.", 404)
      if (action === "updateProspect") {
        checkVersion(input, lead)
        const parsed = parseProspectPayload(input, "patch")
        if (!parsed.ok) throw new CommercialError(parsed.error)
        const confidence =
          input.confidence === undefined
            ? lead.confidence
            : minorUnits(input.confidence)
        if (confidence > 100)
          throw new CommercialError("Confidence must be between 0 and 100.")
        if (
          parsed.data.stage === "lost" &&
          !(parsed.data.lostReason || lead.lostReason)
        )
          throw new CommercialError("Record the lost reason.")
        const [row] = await tx
          .update(prospects)
          .set({
            ...parsed.data,
            ...(parsed.data.stage
              ? stageDateUpdates(parsed.data.stage, now, lead)
              : {}),
            ownerUserId: await assignee(
              tx,
              input.ownerUserId ?? lead.ownerUserId,
              actor.id,
            ),
            joint:
              input.joint === undefined ? lead.joint : input.joint === true,
            nextAction:
              input.nextAction === undefined
                ? lead.nextAction
                : text(input.nextAction),
            confidence,
            expectedCloseAt:
              input.expectedCloseAt === undefined
                ? lead.expectedCloseAt
                : input.expectedCloseAt
                  ? validDate(input.expectedCloseAt)
                  : null,
            archivedAt: input.archive === true ? now : null,
            version: lead.version + 1,
            updatedAt: now,
          })
          .where(and(eq(prospects.id, id), eq(prospects.version, lead.version)))
          .returning()
        await audit(tx, actor, "prospect", id, action, lead, row)
        return row
      }
      if (action === "contact") {
        const name = requiredText(input.name, "Contact name", 200)
        const email = text(input.email, 254)
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
          throw new CommercialError("Invalid email.")
        const values = {
          name,
          email,
          phone: text(input.phone, 80),
          decisionMaker: input.decisionMaker === true,
          suppressed: input.suppressed === true,
          notes: text(input.notes),
          updatedAt: now,
        }
        if (input.contactId) {
          const [old] = await tx
            .select()
            .from(commercialContacts)
            .where(
              and(
                eq(commercialContacts.id, positiveId(input.contactId)),
                eq(commercialContacts.prospectId, id),
              ),
            )
            .for("update")
          if (!old) throw new CommercialError("Contact not found.", 404)
          checkVersion(input, old)
          const [row] = await tx
            .update(commercialContacts)
            .set({ ...values, version: old.version + 1 })
            .where(eq(commercialContacts.id, old.id))
            .returning()
          await audit(tx, actor, "contact", row.id, "update", old, row)
          return row
        }
        const duplicates = await tx
          .select()
          .from(commercialContacts)
          .where(eq(commercialContacts.prospectId, id))
        if (
          duplicates.some(
            (c) =>
              (email && c.email?.toLowerCase() === email.toLowerCase()) ||
              (values.phone && c.phone === values.phone),
          ) &&
          input.allowDuplicate !== true
        )
          throw new CommercialError(
            "Matching contact exists. Review before adding.",
            409,
          )
        const [row] = await tx
          .insert(commercialContacts)
          .values({ ...values, prospectId: id })
          .returning()
        await audit(tx, actor, "contact", row.id, action, null, row)
        return row
      }
      const parsed = parseOutreachActivityPayload({
        ...input,
        subject:
          input.subject ||
          String(input.type ?? "Commercial activity").replace(/_/g, " "),
        body: input.notes || input.naturalLanguageNote || input.body,
      })
      if (!parsed.ok) throw new CommercialError(parsed.error)
      if (input.confirmed !== true)
        throw new CommercialError(
          "Confirm that this activity actually occurred.",
        )
      if (
        input.connectionConfirmed !== true &&
        String(input.outcome ?? "").startsWith("Decision-maker connection: ")
      )
        throw new CommercialError(
          "Use the decision-maker conversation confirmation to record a connection.",
        )
      const key = requiredText(input.requestKey, "Request key", 40)
      if (!/^[0-9a-f-]{36}$/i.test(key))
        throw new CommercialError("Invalid request key.")
      const [prior] = await tx
        .select()
        .from(outreachActivities)
        .where(eq(outreachActivities.requestKey, key))
      if (prior) {
        if (prior.actorUserId !== actor.id || prior.prospectId !== id)
          throw new CommercialError("Request key already used.", 409)
        return prior
      }
      const outbound =
        parsed.data.direction === "outbound" &&
        [
          "phone_call",
          "email",
          "whatsapp",
          "linkedin_message",
          "facebook_message",
        ].includes(parsed.data.type)
      const contactId = await linkedContact(tx, input.contactId, id, outbound)
      if (input.connectionConfirmed === true) {
        if (
          ["no answer", "voicemail", "receptionist"].includes(
            String(input.outcome ?? "")
              .trim()
              .toLowerCase(),
          )
        )
          throw new CommercialError(
            "This outcome does not confirm a two-way decision-maker conversation.",
          )
        const contact = contactId
          ? (
              await tx
                .select()
                .from(commercialContacts)
                .where(eq(commercialContacts.id, contactId))
            )[0]
          : null
        if (
          !contact?.decisionMaker ||
          !["phone_call", "email", "whatsapp", "meeting_held"].includes(
            parsed.data.type,
          ) ||
          parsed.data.direction === "internal"
        )
          throw new CommercialError(
            "Choose a decision-maker contact and confirm a completed two-way conversation.",
          )
      }
      if (
        outbound &&
        !contactId &&
        (
          await tx
            .select({ id: commercialContacts.id })
            .from(commercialContacts)
            .where(
              and(
                eq(commercialContacts.prospectId, id),
                eq(commercialContacts.suppressed, true),
              ),
            )
            .limit(1)
        ).length
      )
        throw new CommercialError(
          "Select an opted-in contact. This business has a suppression record.",
          409,
        )
      const [configuration] = await tx
        .select()
        .from(commercialSettings)
        .where(eq(commercialSettings.key, "config"))
      const warningHours = Number(
        configuration?.value.contactWarningHours ??
          DEFAULT_COMMERCIAL_CONFIG.contactWarningHours,
      )
      const recent = await tx
        .select({ id: outreachActivities.id })
        .from(outreachActivities)
        .where(
          and(
            eq(outreachActivities.prospectId, id),
            sql`${outreachActivities.createdAt} > now() - (${warningHours} * interval '1 hour')`,
            eq(outreachActivities.direction, "outbound"),
            sql`${outreachActivities.actorUserId} <> ${actor.id}`,
          ),
        )
        .limit(1)
      if (outbound && recent.length && input.acknowledgeRecentContact !== true)
        throw new CommercialError(
          `Another founder contacted this business in the last ${warningHours} hours. Review the history and confirm before logging outreach.`,
          409,
        )
      const occurredAt = input.occurredAt ? validDate(input.occurredAt) : now
      if (occurredAt > now)
        throw new CommercialError(
          "Completed activity cannot be dated in the future.",
        )
      const [row] = await tx
        .insert(outreachActivities)
        .values({
          prospectId: id,
          contactId,
          actorUserId: actor.id,
          createdBy: actor.displayName,
          type: parsed.data.type,
          direction: parsed.data.direction,
          outcome: `${input.connectionConfirmed === true ? "Decision-maker connection: " : ""}${requiredText(input.outcome, "Outcome", 270)}`,
          body: text(input.notes || input.naturalLanguageNote || input.body),
          nextAction: text(input.nextAction),
          requestKey: key,
          occurredAt,
        })
        .returning()
      const activityStage = (
        {
          company_researched: "audited",
          contact_identified: "contact_identified",
          meeting_booked: "discovery_booked",
          proposal: "proposal_sent",
          contract_signed: "won",
        } as const
      )[
        parsed.data.type as
          | "company_researched"
          | "contact_identified"
          | "meeting_booked"
          | "proposal"
          | "contract_signed"
      ]
      const progression = [
        "found",
        "audited",
        "contact_identified",
        "contacted",
        "replied",
        "qualified",
        "discovery_booked",
        "proposal_required",
        "proposal_sent",
        "follow_up_due",
        "negotiation",
        "won",
        "lost",
      ]
      const suggestedStage =
        activityStage ??
        (parsed.data.direction === "inbound"
          ? "replied"
          : outbound
            ? "contacted"
            : lead.stage)
      const stage =
        !["won", "lost"].includes(lead.stage) &&
        progression.indexOf(suggestedStage) > progression.indexOf(lead.stage)
          ? suggestedStage
          : lead.stage
      const [updatedLead] = await tx
        .update(prospects)
        .set({
          ...stageDateUpdates(stage, now, lead),
          lastContactedAt: outbound ? now : lead.lastContactedAt,
          nextAction: text(input.nextAction) ?? lead.nextAction,
          nextFollowUpAt: input.followUpAt
            ? validDate(input.followUpAt)
            : lead.nextFollowUpAt,
          version: lead.version + 1,
          updatedAt: now,
        })
        .where(eq(prospects.id, id))
        .returning()
      if (input.followUpAt)
        await tx.insert(commercialTasks).values({
          prospectId: id,
          contactId,
          assignedUserId: await assignee(tx, input.assignedUserId, actor.id),
          title: text(input.nextAction) ?? "Follow up",
          dueAt: validDate(input.followUpAt),
        })
      await audit(tx, actor, "prospect", id, "activity", lead, {
        prospect: updatedLead,
        activity: row,
      })
      return row
    }
    if (action === "task") {
      const old = input.id
        ? (
            await tx
              .select()
              .from(commercialTasks)
              .where(eq(commercialTasks.id, positiveId(input.id)))
              .for("update")
          )[0]
        : null
      if (input.id && !old) throw new CommercialError("Task not found.", 404)
      if (old) checkVersion(input, old)
      if (!old && !input.dueAt)
        throw new CommercialError("A task due date is required.")
      const prospectId = input.prospectId
        ? positiveId(input.prospectId)
        : (old?.prospectId ?? null)
      if (
        prospectId &&
        !(
          await tx
            .select({ id: prospects.id })
            .from(prospects)
            .where(eq(prospects.id, prospectId))
        )[0]
      )
        throw new CommercialError("Prospect not found.", 404)
      const status = String(input.status ?? old?.status ?? "open")
      if (!["open", "completed", "cancelled"].includes(status))
        throw new CommercialError("Invalid task status.")
      const priority = String(input.priority ?? old?.priority ?? "medium")
      if (!["low", "medium", "high"].includes(priority))
        throw new CommercialError("Invalid priority.")
      const recurrenceDays =
        input.recurrenceDays == null
          ? (old?.recurrenceDays ?? null)
          : input.recurrenceDays === ""
            ? null
            : positiveId(input.recurrenceDays)
      if (recurrenceDays && recurrenceDays > 365)
        throw new CommercialError("Recurrence must be 1 to 365 days.")
      const values = {
        prospectId,
        contactId: prospectId
          ? await linkedContact(
              tx,
              input.contactId ?? old?.contactId,
              prospectId,
            )
          : null,
        assignedUserId: await assignee(
          tx,
          input.assignedUserId ?? old?.assignedUserId,
          actor.id,
        ),
        title: requiredText(input.title ?? old?.title, "Task title", 300),
        notes:
          input.notes === undefined ? (old?.notes ?? null) : text(input.notes),
        dueAt: input.dueAt ? validDate(input.dueAt) : (old?.dueAt ?? now),
        status,
        priority,
        recurrenceDays,
        completedAt: status === "completed" ? (old?.completedAt ?? now) : null,
        version: (old?.version ?? 0) + 1,
        updatedAt: now,
      }
      const [row] = old
        ? await tx
            .update(commercialTasks)
            .set(values)
            .where(eq(commercialTasks.id, old.id))
            .returning()
        : await tx.insert(commercialTasks).values(values).returning()
      if (
        status === "completed" &&
        old?.status !== "completed" &&
        recurrenceDays
      )
        await tx.insert(commercialTasks).values({
          ...values,
          dueAt: nextLondonOccurrence(values.dueAt, recurrenceDays),
          status: "open",
          completedAt: null,
          version: 1,
        })
      await audit(tx, actor, "task", row.id, action, old, row)
      return row
    }
    if (action === "settings") {
      const key = requiredText(input.key, "Settings key", 100)
      if (
        !(
          key === "config" ||
          key === "companyTargets" ||
          /^targets:[0-9a-f-]{36}$/i.test(key)
        )
      )
        throw new CommercialError("Invalid settings key.")
      if (key.startsWith("targets:")) await assignee(tx, key.slice(8), actor.id)
      const value = input.value as Record<string, unknown>
      if (!value || typeof value !== "object" || Array.isArray(value))
        throw new CommercialError("Invalid settings.")
      const allowed =
        key === "config"
          ? Object.keys(DEFAULT_COMMERCIAL_CONFIG)
          : [
              ...Object.keys(DEFAULT_COMPANY_TARGETS),
              "connections",
              "connectionStretch",
            ]
      for (const [name, amount] of Object.entries(value)) {
        if (!allowed.includes(name))
          throw new CommercialError("Unknown setting.")
        minorUnits(amount)
      }
      await tx.execute(sql`select pg_advisory_xact_lock(640065)`)
      const [old] = await tx
        .select()
        .from(commercialSettings)
        .where(eq(commercialSettings.key, key))
      if (input.version !== (old?.version ?? 0))
        throw new CommercialError(
          "Settings changed. Reload before saving.",
          409,
        )
      const [row] = await tx
        .insert(commercialSettings)
        .values({ key, value, version: (old?.version ?? 0) + 1 })
        .onConflictDoUpdate({
          target: commercialSettings.key,
          set: { value, version: (old?.version ?? 0) + 1, updatedAt: now },
        })
        .returning()
      await audit(tx, actor, "settings", key, action, old, row)
      return row
    }
    if (action === "endContract" || action === "confirmContract") {
      const [old] = await tx
        .select()
        .from(commercialContracts)
        .where(eq(commercialContracts.id, positiveId(input.id)))
        .for("update")
      if (!old) throw new CommercialError("Contract not found.", 404)
      checkVersion(input, old)
      if (action === "endContract" && old.status !== "confirmed")
        throw new CommercialError("Only a confirmed contract can be ended.")
      if (
        action === "confirmContract" &&
        (old.status !== "draft" || input.confirmed !== true)
      )
        throw new CommercialError(
          "Only a verified draft contract can be confirmed.",
        )
      if (
        action === "confirmContract" &&
        ["retainer", "premium_partnership"].includes(old.category) &&
        old.monthlyAmount === 0
      )
        throw new CommercialError(
          "A qualifying retained contract needs a positive monthly amount.",
        )
      const [row] = await tx
        .update(commercialContracts)
        .set({
          status: action === "confirmContract" ? "confirmed" : "ended",
          actorUserId:
            action === "confirmContract" ? actor.id : old.actorUserId,
          endsAt:
            action === "confirmContract"
              ? old.endsAt
              : old.startsAt < now
                ? now
                : old.endsAt,
          version: old.version + 1,
          updatedAt: now,
        })
        .where(eq(commercialContracts.id, old.id))
        .returning()
      await audit(tx, actor, "contract", old.id, action, old, row)
      return row
    }
    if (action === "reversePayment") {
      const [old] = await tx
        .select()
        .from(commercialPayments)
        .where(eq(commercialPayments.id, positiveId(input.id)))
        .for("update")
      if (!old || old.amount <= 0)
        throw new CommercialError("Choose an original payment.")
      const [row] = await tx
        .insert(commercialPayments)
        .values({
          clientId: old.clientId,
          invoiceId: old.invoiceId,
          category: old.category,
          amount: -old.amount,
          evidence: requiredText(input.evidence, "Correction evidence"),
          reference: `reversal:${old.id}`,
          reversesPaymentId: old.id,
          actorUserId: actor.id,
          receivedAt: now,
        })
        .returning()
      await audit(tx, actor, "payment", row.id, action, null, row)
      return row
    }
    const clientId = positiveId(input.clientId)
    if (
      !(
        await tx
          .select({ id: clients.id })
          .from(clients)
          .where(eq(clients.id, clientId))
      )[0]
    )
      throw new CommercialError("Client not found.", 404)
    if (action === "contract") {
      await tx.execute(sql`select pg_advisory_xact_lock(${clientId}, 640066)`)
      const evidence = requiredText(input.evidence, "Contract evidence")
      const duplicate = await tx
        .select({ id: commercialContracts.id })
        .from(commercialContracts)
        .where(
          and(
            eq(commercialContracts.clientId, clientId),
            sql`lower(trim(${commercialContracts.evidence})) = ${evidence.toLowerCase()}`,
          ),
        )
        .limit(1)
      if (duplicate.length)
        throw new CommercialError(
          "This contract evidence is already recorded.",
          409,
        )
      const kind = category(input.category),
        monthlyAmount = minorUnits(input.monthlyAmount ?? 0),
        oneOffAmount = minorUnits(input.oneOffAmount ?? 0)
      if (!["retainer", "premium_partnership"].includes(kind) && monthlyAmount)
        throw new CommercialError(
          "Variable and one-off revenue cannot count as MRR.",
        )
      const startsAt = validDate(input.startsAt),
        endsAt = input.endsAt ? validDate(input.endsAt) : null
      if (endsAt && endsAt <= startsAt)
        throw new CommercialError("End must follow start.")
      if (input.status === "confirmed" && input.confirmed !== true)
        throw new CommercialError("Confirm signed contract evidence.")
      if (
        input.status === "confirmed" &&
        ["retainer", "premium_partnership"].includes(kind) &&
        monthlyAmount === 0
      )
        throw new CommercialError(
          "A qualifying retained contract needs a positive monthly amount.",
        )
      const [row] = await tx
        .insert(commercialContracts)
        .values({
          clientId,
          prospectId:
            (
              await tx
                .select({ id: prospects.id })
                .from(prospects)
                .where(eq(prospects.convertedClientId, clientId))
                .orderBy(desc(prospects.createdAt))
                .limit(1)
            )[0]?.id ?? null,
          category: kind,
          status: input.status === "confirmed" ? "confirmed" : "draft",
          monthlyAmount,
          oneOffAmount,
          evidence,
          startsAt,
          endsAt,
          actorUserId: actor.id,
        })
        .returning()
      await audit(tx, actor, "contract", row.id, action, null, row)
      return row
    }
    if (action === "payment") {
      if (input.confirmed !== true)
        throw new CommercialError("Confirm money was actually received.")
      const amount = minorUnits(input.amount)
      if (!amount) throw new CommercialError("Payment must be positive.")
      const receivedAt = validDate(input.receivedAt)
      if (receivedAt > now)
        throw new CommercialError(
          "Received payments cannot be dated in the future. Record a forecast instead.",
        )
      const invoiceId = input.invoiceId ? positiveId(input.invoiceId) : null
      if (invoiceId) {
        const [invoice] = await tx
          .select()
          .from(invoices)
          .where(
            and(eq(invoices.id, invoiceId), eq(invoices.clientId, clientId)),
          )
          .for("update")
        if (!invoice || ["draft", "void"].includes(invoice.status))
          throw new CommercialError("Choose an issued invoice for this client.")
        const allocated = await tx
          .select({
            total: sql<number>`coalesce(sum(${commercialPayments.amount}),0)::integer`,
          })
          .from(commercialPayments)
          .where(eq(commercialPayments.invoiceId, invoiceId))
        if (Number(allocated[0].total) + amount > invoice.total)
          throw new CommercialError(
            "Payment exceeds the outstanding invoice balance.",
          )
      }
      const [row] = await tx
        .insert(commercialPayments)
        .values({
          clientId,
          invoiceId,
          category: category(input.category),
          amount,
          evidence: requiredText(input.evidence, "Payment evidence"),
          reference: requiredText(
            input.reference,
            "Unique payment reference",
            200,
          ).toLowerCase(),
          actorUserId: actor.id,
          receivedAt,
        })
        .returning()
      await audit(tx, actor, "payment", row.id, action, null, row)
      return row
    }
    if (action === "forecast") {
      const [row] = await tx
        .insert(commercialForecasts)
        .values({
          clientId,
          amount: minorUnits(input.amount),
          expectedAt: validDate(input.expectedAt),
          notes: requiredText(input.notes, "Forecast basis"),
          actorUserId: actor.id,
        })
        .returning()
      await audit(tx, actor, "forecast", row.id, action, null, row)
      return row
    }
    throw new CommercialError("Unsupported action.")
  })
}
