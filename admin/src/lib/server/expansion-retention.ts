import 'server-only'
import { createHash } from 'node:crypto'
import { sql, type SQL } from 'drizzle-orm'
import { ExpansionError, expansionInteger } from '@/lib/expansion'

const batchSize = 100
const holdReasons = ['legal_review', 'privacy_request', 'commercial_dispute']

type RetentionTransaction = {
  execute: (statement: SQL) => Promise<{ rows: Record<string, unknown>[] }>
}

function readRetentionConfig(env: Record<string, string | undefined>) {
  const days = env.PARTNER_APPLICATION_RETENTION_DAYS ?? ''
  if (!/^\d+$/.test(days) || Number(days) < 1 || Number(days) > 730) {
    throw new ExpansionError('Configure an approved applicant retention period before running retention review.', 409)
  }
  return env.PARTNER_RETENTION_EXECUTION_ENABLED === 'true'
}

const eligibleApplicant = sql`
  a.retention_until <= now()
  and a.status in ('declined', 'withdrawn', 'archived')
  and not exists (select 1 from expansion_partners p where p.application_id = a.id)
  and not exists (select 1 from expansion_applicant_retention_holds h where h.application_id = a.id)
`

async function readBatch(tx: RetentionTransaction, lock = false) {
  const { rows } = await tx.execute(sql`
    select a.id
    from partner_applications a
    where ${eligibleApplicant}
    order by a.id
    limit ${batchSize}
    ${lock ? sql`for update of a` : sql``}
  `)
  const applicationIds = rows.map(row => Number(row.id))
  const fingerprint = createHash('sha256').update(JSON.stringify(applicationIds)).digest('hex')
  return { applicationIds, fingerprint }
}

async function writeAudit(tx: RetentionTransaction, actorId: string, entity: string, action: string, details: object) {
  await tx.execute(sql`
    insert into expansion_audit(actor_id, entity_id, action, details)
    values (${actorId}, ${entity}, ${action}, ${JSON.stringify(details)}::jsonb)
  `)
}

/** Call only after the founder transaction has revalidated persisted authority. */
export async function runApplicantRetention(
  tx: RetentionTransaction,
  actorId: string,
  input: Record<string, unknown>,
  env: Record<string, string | undefined> = process.env,
) {
  if (input.action === 'preview_applicant_retention') {
    const executionEnabled = readRetentionConfig(env)
    const batch = await readBatch(tx)
    const { rows } = await tx.execute(sql`
      select
        count(*) filter (where h.application_id is not null)::integer as held,
        count(*) filter (where p.application_id is not null)::integer as linked,
        count(*) filter (where a.status not in ('declined', 'withdrawn', 'archived'))::integer as outside_closed_states
      from partner_applications a
      left join expansion_partners p on p.application_id = a.id
      left join expansion_applicant_retention_holds h on h.application_id = a.id
      where a.retention_until <= now()
    `)
    return { ...batch, executionEnabled, overdueExceptions: rows[0] }
  }

  // Serialises purge/hold changes. Applicant row locks also coordinate with
  // recruitment review and invitation issuance.
  await tx.execute(sql`select pg_advisory_xact_lock(621908152)`)

  if (input.action === 'set_applicant_retention_hold' || input.action === 'release_applicant_retention_hold') {
    const id = expansionInteger(input.id, 'application', 1, 2147483647)
    const exists = await tx.execute(sql`select id from partner_applications where id = ${id} for update`)
    if (!exists.rows.length) throw new ExpansionError('Application not found.', 404)

    if (input.action === 'set_applicant_retention_hold') {
      const reason = String(input.reason ?? '')
      if (!holdReasons.includes(reason)) throw new ExpansionError('Select a retention hold reason.')
      const changed = await tx.execute(sql`
        insert into expansion_applicant_retention_holds (application_id, reason_code, held_by)
        values (${id}, ${reason}, ${actorId})
        on conflict (application_id) do nothing returning application_id
      `)
      if (changed.rows.length) await writeAudit(tx, actorId, String(id), 'applicant_retention_hold_set', { reason })
      return { changed: changed.rows.length > 0 }
    }

    if (input.confirmed !== true) throw new ExpansionError('Confirm that the retention exception has ended.')
    const changed = await tx.execute(sql`delete from expansion_applicant_retention_holds where application_id = ${id} returning reason_code`)
    if (changed.rows.length) await writeAudit(tx, actorId, String(id), 'applicant_retention_hold_released', { reason: changed.rows[0].reason_code })
    return { changed: changed.rows.length > 0 }
  }

  if (input.action !== 'purge_applicants') throw new ExpansionError('Unknown applicant retention action.')
  if (!readRetentionConfig(env)) throw new ExpansionError('Applicant retention execution is disabled.', 409)
  if (input.confirmed !== true || typeof input.fingerprint !== 'string') {
    throw new ExpansionError('Preview and explicitly confirm the eligible batch before deletion.')
  }

  const batch = await readBatch(tx, true)
  if (input.fingerprint !== batch.fingerprint) {
    throw new ExpansionError('The eligible batch changed. Preview it again before deleting.', 409)
  }
  if (!batch.applicationIds.length) return { purged: 0 }

  const ids = sql.join(batch.applicationIds.map(id => sql`${id}`), sql`, `)
  const deleted = await tx.execute(sql`delete from partner_applications a where a.id in (${ids}) and ${eligibleApplicant} returning id`)
  if (deleted.rows.length !== batch.applicationIds.length) {
    throw new ExpansionError('The eligible batch changed. Preview it again before deleting.', 409)
  }
  await writeAudit(tx, actorId, 'applicant_retention', 'expired_terminal_applicants_purged', { count: deleted.rows.length })
  return { purged: deleted.rows.length }
}
