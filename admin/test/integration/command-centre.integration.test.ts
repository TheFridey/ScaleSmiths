import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { Pool } from "pg"
import { randomUUID } from "node:crypto"
import { assertSafeIntegrationDatabaseUrl } from "../../src/lib/test-database-safety"
import { migrateSharedTestDatabase } from "./shared-migration-harness"
let pool: Pool
let service: typeof import("../../src/lib/server/command-centre")
const trev = {
  id: randomUUID(),
  role: "owner" as const,
  displayName: "Trev test fixture",
}
const rhys = {
  id: randomUUID(),
  role: "owner" as const,
  displayName: "Rhys test fixture",
}
let clientId: number
beforeAll(async () => {
  const url = assertSafeIntegrationDatabaseUrl(process.env.TEST_DATABASE_URL)
  process.env.ADMIN_DATABASE_URL = url
  pool = new Pool({ connectionString: url })
  await migrateSharedTestDatabase(pool)
  for (const actor of [trev, rhys])
    await pool.query(
      "insert into admin_users(id,email,display_name,password_hash,role) values($1,$2,$3,'unused-test-hash','owner')",
      [actor.id, `${actor.id}@example.test`, actor.displayName],
    )
  clientId = (
    await pool.query(
      "insert into clients(name) values('Command Centre integration fixture') returning id",
    )
  ).rows[0].id
  service = await import("../../src/lib/server/command-centre")
})
afterAll(async () => {
  await pool?.end()
  const shared = globalThis as unknown as { __scalesmithsPool?: Pool }
  await shared.__scalesmithsPool?.end()
})
describe("durable shared commercial operations", () => {
  it("records only explicitly confirmed decision-maker connections", async () => {
    const lead = (await service.commercialMutation(trev, {
      action: "createProspect",
      businessName: `Connection ${randomUUID()}`,
    })) as { id: number }
    const contact = (await service.commercialMutation(trev, {
      action: "contact",
      prospectId: lead.id,
      name: "Decision-maker fixture",
      decisionMaker: true,
    })) as { id: number }
    const input = {
      action: "activity",
      prospectId: lead.id,
      contactId: contact.id,
      type: "phone_call",
      direction: "outbound",
      outcome: "Interested",
      confirmed: true,
      requestKey: randomUUID(),
    }
    await expect(
      service.commercialMutation(trev, {
        ...input,
        outcome: "Decision-maker connection: Interested",
      }),
    ).rejects.toThrow("confirmation")
    await expect(
      service.commercialMutation(trev, {
        ...input,
        contactId: undefined,
        connectionConfirmed: true,
      }),
    ).rejects.toThrow("decision-maker")
    await expect(
      service.commercialMutation(trev, {
        ...input,
        outcome: "Voicemail",
        connectionConfirmed: true,
      }),
    ).rejects.toThrow("two-way")
    const activity = (await service.commercialMutation(trev, {
      ...input,
      connectionConfirmed: true,
    })) as { outcome: string }
    expect(activity.outcome).toBe("Decision-maker connection: Interested")
  })
  it("shares records, preserves the actor, schedules follow-ups and rejects stale edits", async () => {
    const lead = (await service.commercialMutation(trev, {
      action: "createProspect",
      businessName: `Shared lead ${randomUUID()}`,
    })) as { id: number; version: number }
    expect(
      (await service.commercialSnapshot(rhys)).leads.some(
        (l) => l.id === lead.id,
      ),
    ).toBe(true)
    const key = randomUUID()
    const input = {
      action: "activity",
      prospectId: lead.id,
      type: "phone_call",
      direction: "outbound",
      outcome: "Interested",
      createdBy: "Spoofed actor",
      actorUserId: rhys.id,
      confirmed: true,
      requestKey: key,
      nextAction: "Call Thursday",
      followUpAt: "2026-12-03T09:00:00Z",
    }
    const activity = (await service.commercialMutation(trev, input)) as {
      id: number
    }
    expect(
      ((await service.commercialMutation(trev, input)) as { id: number }).id,
    ).toBe(activity.id)
    const snapshot = await service.commercialSnapshot(rhys)
    expect(
      snapshot.activities.find((a) => a.id === activity.id)?.actorUserId,
    ).toBe(trev.id)
    expect(
      snapshot.activities.find((a) => a.id === activity.id)?.createdBy,
    ).toBe(trev.displayName)
    expect(
      snapshot.tasks.some(
        (t) => t.prospectId === lead.id && t.title === "Call Thursday",
      ),
    ).toBe(true)
    await expect(
      service.commercialMutation(rhys, {
        action: "updateProspect",
        prospectId: lead.id,
        version: lead.version,
        nextAction: "Stale write",
      }),
    ).rejects.toMatchObject({ status: 409 })
    const current = snapshot.leads.find((l) => l.id === lead.id)!
    await service.commercialMutation(rhys, {
      action: "updateProspect",
      prospectId: lead.id,
      version: current.version,
      nextAction: "Rhys follow-up",
    })
    expect(
      (await service.commercialSnapshot(trev)).leads.find(
        (l) => l.id === lead.id,
      )?.nextAction,
    ).toBe("Rhys follow-up")
    await expect(
      pool.query("delete from outreach_activities where id=$1", [activity.id]),
    ).rejects.toThrow("append-only")
  })
  it("serializes duplicate creation and concurrent edits", async () => {
    const name = `Concurrent company ${randomUUID()}`
    const results = await Promise.allSettled(
      [trev, rhys].map((actor) =>
        service.commercialMutation(actor, {
          action: "createProspect",
          businessName: name,
        }),
      ),
    )
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1)
    const row = (
      results.find(
        (r) => r.status === "fulfilled",
      ) as PromiseFulfilledResult<unknown>
    ).value as { id: number; version: number }
    const edits = await Promise.allSettled(
      [trev, rhys].map((actor) =>
        service.commercialMutation(actor, {
          action: "updateProspect",
          prospectId: row.id,
          version: row.version,
          nextAction: actor.displayName,
        }),
      ),
    )
    expect(edits.filter((r) => r.status === "fulfilled")).toHaveLength(1)
    expect(edits.filter((r) => r.status === "rejected")).toHaveLength(1)
  })
  it("enforces contact suppression, confirmed activities and action permissions", async () => {
    const lead = (await service.commercialMutation(trev, {
      action: "createProspect",
      businessName: `Suppression ${randomUUID()}`,
    })) as { id: number }
    const contact = (await service.commercialMutation(trev, {
      action: "contact",
      prospectId: lead.id,
      name: "Opted-out contact",
      suppressed: true,
    })) as { id: number }
    await expect(
      service.commercialMutation(trev, {
        action: "activity",
        prospectId: lead.id,
        contactId: contact.id,
        type: "email",
        direction: "outbound",
        outcome: "Sent",
        confirmed: true,
        requestKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ status: 409 })
    await expect(
      service.commercialMutation(trev, {
        action: "activity",
        prospectId: lead.id,
        type: "phone_call",
        direction: "outbound",
        outcome: "Called",
        requestKey: randomUUID(),
      }),
    ).rejects.toThrow("Confirm")
    await expect(
      service.commercialMutation(
        { ...trev, role: "viewer" },
        { action: "createProspect", businessName: "Denied" },
      ),
    ).rejects.toMatchObject({ status: 403 })
    await expect(
      service.commercialMutation(
        { ...trev, role: "sales" },
        { action: "payment", clientId },
      ),
    ).rejects.toMatchObject({ status: 403 })
  })
  it("requires contract evidence, prevents repeated references, and corrects payments by appending", async () => {
    const evidence = `Signed agreement ${randomUUID()}`
    await service.commercialMutation(trev, {
      action: "contract",
      clientId,
      category: "retainer",
      monthlyAmount: 35000,
      status: "confirmed",
      confirmed: true,
      startsAt: "2026-01-01T00:00:00Z",
      evidence,
    })
    await expect(
      service.commercialMutation(trev, {
        action: "contract",
        clientId,
        category: "retainer",
        monthlyAmount: 35000,
        status: "confirmed",
        confirmed: true,
        startsAt: "2026-01-01T00:00:00Z",
        evidence,
      }),
    ).rejects.toMatchObject({ status: 409 })
    await expect(
      service.commercialMutation(trev, {
        action: "contract",
        clientId,
        category: "performance",
        monthlyAmount: 50000,
        startsAt: "2026-01-01T00:00:00Z",
        evidence: "Variable profit share",
      }),
    ).rejects.toThrow("cannot count as MRR")
    const reference = randomUUID(),
      input = {
        action: "payment",
        clientId,
        category: "website_build",
        amount: 200000,
        confirmed: true,
        receivedAt: "2026-10-01T12:00:00Z",
        evidence: "Test bank receipt",
        reference,
      }
    await expect(
      service.commercialMutation(trev, {
        ...input,
        receivedAt: new Date(Date.now() + 86400000).toISOString(),
      }),
    ).rejects.toThrow("future")
    const payment = (await service.commercialMutation(trev, input)) as {
      id: number
    }
    await expect(service.commercialMutation(rhys, input)).rejects.toBeDefined()
    await service.commercialMutation(rhys, {
      action: "reversePayment",
      id: payment.id,
      evidence: "Test correction",
    })
    expect(
      (
        await pool.query(
          "select sum(amount)::integer total from commercial_payments where id=$1 or reverses_payment_id=$1",
          [payment.id],
        )
      ).rows[0].total,
    ).toBe(0)
    await expect(
      pool.query("update commercial_payments set amount=1 where id=$1", [
        payment.id,
      ]),
    ).rejects.toThrow("append-only")
    const snapshot = await service.commercialSnapshot(trev)
    const audit = snapshot.history.find(
      (h) => h.entity === "payment" && h.recordId === String(payment.id),
    )!
    await expect(
      pool.query("delete from commercial_audit where id=$1", [audit.id]),
    ).rejects.toThrow("append-only")
  })
})
