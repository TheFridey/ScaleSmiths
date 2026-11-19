'use client'

import { useState } from 'react'

type Row = Record<string, unknown>
type Command = (input: Row) => Promise<Row>
type Preview = {
  applicationIds: number[]
  fingerprint: string
  executionEnabled: boolean
  overdueExceptions: { held: number; linked: number; outside_closed_states: number }
}

export function ApplicantRetention({ applications, command }: { applications: Row[]; command: Command }) {
  const [preview, setPreview] = useState<Preview | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)

  async function run(input: Row) {
    setBusy(true)
    setMessage('')
    setFailed(false)
    setPreview(null)
    setConfirmed(false)
    try {
      const result = await command(input)
      switch (input.action) {
        case 'preview_applicant_retention':
          setPreview(result as Preview)
          break
        case 'purge_applicants':
          setMessage(`Removed ${String(result.purged)} expired closed applications.`)
          break
        default:
          setMessage(result.changed ? 'Retention hold updated.' : 'The requested hold state was already recorded.')
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update applicant retention.')
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="ex-panel">
      <h2>Applicant retention</h2>
      <p>Preview up to 100 expired closed applications. Active, approved, linked and held applications are excluded.</p>
      <button type="button" className="ex-button" disabled={busy} onClick={() => void run({ action: 'preview_applicant_retention' })}>Preview eligible applications</button>
      {preview && (
        <div className="ex-resource">
          <p role="status">{preview.applicationIds.length} eligible in this batch.</p>
          {preview.applicationIds.length > 0 && <p>Application references {preview.applicationIds.join(', ')}</p>}
          <p>Overdue exceptions may overlap. {preview.overdueExceptions.held} held, {preview.overdueExceptions.linked} linked to partners, {preview.overdueExceptions.outside_closed_states} outside closed states.</p>
          {!preview.executionEnabled && <p>Deletion is disabled by configuration.</p>}
          {preview.executionEnabled && preview.applicationIds.length > 0 && (
            <form className="ex-form" onSubmit={event => {
              event.preventDefault()
              void run({ action: 'purge_applicants', fingerprint: preview.fingerprint, confirmed })
            }}>
              <label className="ex-check">
                <input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} required />
                <span>I reviewed the preview and approve deletion of this batch</span>
              </label>
              <button type="submit" className="ex-button" disabled={busy || !confirmed}>Delete reviewed batch</button>
            </form>
          )}
        </div>
      )}
      <form className="ex-form" onSubmit={event => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        const release = data.get('holdAction') === 'release'
        void run({
          action: release ? 'release_applicant_retention_hold' : 'set_applicant_retention_hold',
          id: Number(data.get('application')),
          reason: data.get('reason'),
          confirmed: data.get('ended') === 'on',
        })
      }}>
        <fieldset disabled={busy}>
          <legend>Manage a retention hold</legend>
          <label className="ex-field">Application reference
            <input name="application" type="number" list="retention-application-references" min={1} max={2147483647} required />
            <datalist id="retention-application-references">
              {applications.map(application => (
                <option key={String(application.id)} value={String(application.id)} label={String(application.name)} />
              ))}
            </datalist>
          </label>
          <label className="ex-field">Hold action
            <select name="holdAction">
              <option value="set">Place hold</option>
              <option value="release">Release hold</option>
            </select>
          </label>
          <label className="ex-field">Reason for placing hold
            <select name="reason">
              <option value="legal_review">Legal review</option>
              <option value="privacy_request">Privacy request</option>
              <option value="commercial_dispute">Commercial dispute</option>
            </select>
          </label>
          <label className="ex-check">
            <input type="checkbox" name="ended" />
            <span>For release only, I confirm the retention exception has ended</span>
          </label>
          <button className="ex-button" type="submit">Save retention hold decision</button>
        </fieldset>
      </form>
      {message && <p role={failed ? 'alert' : 'status'} className={failed ? 'ex-form-error' : 'ex-success'}>{message}</p>}
    </section>
  )
}
