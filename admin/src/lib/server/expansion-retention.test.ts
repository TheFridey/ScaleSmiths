import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { runApplicantRetention } from './expansion-retention'

const founder = '10000000-0000-4000-8000-000000000001'
const on = { PARTNER_APPLICATION_RETENTION_DAYS: '30', PARTNER_RETENTION_EXECUTION_ENABLED: 'true' }

describe('applicant retention against PostgreSQL via PGlite', () => {
  let database: PGlite

  beforeAll(async () => {
    database = new PGlite()
    await database.exec(`
      create table admin_users (id uuid primary key);
      insert into admin_users values ('${founder}');
      create table partner_applications (id serial primary key, status text not null, retention_until timestamptz not null);
      create table expansion_partners (application_id integer references partner_applications(id) on delete restrict);
      create table expansion_audit (actor_id uuid, entity_id text, action text, details jsonb);
    `)
    await database.exec(readFileSync(new URL('../../../drizzle/0072_expansion_applicant_retention_holds.sql', import.meta.url), 'utf8'))
  }, 30000)

  afterAll(async () => { await database?.close() })

  async function command(input: Record<string, unknown>, env: Record<string, string | undefined> = on) {
    return database.transaction(tx => runApplicantRetention({
      execute: async (statement: SQL) => {
        const query = new PgDialect().sqlToQuery(statement)
        return tx.query<Record<string, unknown>>(query.sql, query.params)
      },
    }, founder, input, env))
  }

  const preview = { action: 'preview_applicant_retention' }
  const hold = { action: 'set_applicant_retention_hold', id: 2, reason: 'legal_review' }
  const release = { action: 'release_applicant_retention_hold', id: 2, confirmed: true }

  it('fails closed when execution or an explicit valid retention period is missing', async () => {
    for (const days of [undefined, '', ' 30 ', '731', '0']) {
      await expect(command(preview, { PARTNER_APPLICATION_RETENTION_DAYS: days })).rejects.toThrow('approved applicant retention period')
    }
    const readOnly = { PARTNER_APPLICATION_RETENTION_DAYS: '30' }
    await expect(command(preview, readOnly)).resolves.toMatchObject({ executionEnabled: false })
    await expect(command({ action: 'purge_applicants', confirmed: true }, readOnly)).rejects.toThrow('execution is disabled')
  })

  it('preserves active, approved, linked, held and unexpired records and requires a fresh confirmed batch', async () => {
    await database.exec(`
      insert into partner_applications(status, retention_until) values
        ('declined', now() - interval '1 day'),
        ('withdrawn', now() - interval '1 day'),
        ('archived', now() - interval '1 day'),
        ('under_review', now() - interval '1 day'),
        ('approved_in_principle', now() - interval '1 day'),
        ('declined', now() + interval '1 day'),
        ('activated', now() - interval '1 day');
      insert into expansion_partners values (3), (7);
    `)
    const oldBatch = await command(preview)
    expect(oldBatch).toMatchObject({ applicationIds: [1, 2] })
    await expect(command(hold)).resolves.toEqual({ changed: true })
    await expect(command(hold)).resolves.toEqual({ changed: false })
    await expect(command({ action: 'purge_applicants', confirmed: true, fingerprint: 'fingerprint' in oldBatch && oldBatch.fingerprint })).rejects.toThrow('batch changed')
    await expect(database.exec('delete from partner_applications where id = 2')).rejects.toMatchObject({
      constraint: 'expansion_applicant_retention_holds_application_id_fkey',
    })
    const batch = await command(preview)
    expect(batch).toMatchObject({
      applicationIds: [1],
      executionEnabled: true,
      overdueExceptions: { held: 1, linked: 2, outside_closed_states: 3 },
    })
    const purge = { action: 'purge_applicants', fingerprint: 'fingerprint' in batch && batch.fingerprint }
    await expect(command(purge)).rejects.toThrow('explicitly confirm')
    await expect(command({ ...purge, confirmed: true })).resolves.toEqual({ purged: 1 })
    await expect(command({ ...purge, confirmed: true })).rejects.toThrow('batch changed')
    await expect(command({ ...release, confirmed: false })).rejects.toThrow('exception has ended')
    await expect(command(release)).resolves.toEqual({ changed: true })
    await expect(command(release)).resolves.toEqual({ changed: false })
    await expect(command(preview)).resolves.toMatchObject({ applicationIds: [2] })
    const history = await database.query('select actor_id, entity_id, action, details from expansion_audit')
    expect(history.rows).toEqual([
      { actor_id: founder, entity_id: '2', action: 'applicant_retention_hold_set', details: { reason: 'legal_review' } },
      { actor_id: founder, entity_id: 'applicant_retention', action: 'expired_terminal_applicants_purged', details: { count: 1 } },
      { actor_id: founder, entity_id: '2', action: 'applicant_retention_hold_released', details: { reason: 'legal_review' } },
    ])
  })
})
