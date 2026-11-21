'use client'

import { useMemo, useState } from 'react'
import { APPLICATION_STATUS_LABELS, APPLICATION_STATUSES, founderNextStatuses, isApplicationStatus } from '@/lib/partner-lifecycle'
import { Action, Check, Empty, Field } from './ExpansionWorkspace'

type Row = Record<string, unknown>
type Command = (input: Row) => Promise<Row>
const str = (v: unknown) => (v == null ? '' : String(v))
const rows = (v: unknown): Row[] => (Array.isArray(v) ? v : [])
const statusLabel = (v: unknown) => (isApplicationStatus(v) ? APPLICATION_STATUS_LABELS[v] : str(v))
const day = (v: unknown) => str(v).slice(0, 10)

/** Badge tone by lifecycle stage; colour is never the only signal (the label is always shown). */
function tone(status: unknown) {
  if (status === 'activated') return 'ex-pill ex-pill-ok'
  if (status === 'declined' || status === 'withdrawn' || status === 'archived') return 'ex-pill ex-pill-muted'
  if (status === 'onboarding' || status === 'agreement_pending' || status === 'approved_in_principle') return 'ex-pill ex-pill-gold'
  if (status === 'information_requested') return 'ex-pill ex-pill-warn'
  return 'ex-pill'
}

const CONFIRMATIONS: [string, string][] = [
  ['legal', 'Legal review of this applicant completed'],
  ['agreement', 'Agreement version to be issued has been approved and published'],
  ['independentStatus', 'Independent (self-employed) status review recorded'],
  ['operations', 'Operational onboarding prepared'],
]

function AgreementSelect({ agreements, name = 'agreementVersionId' }: { agreements: Row[]; name?: string }) {
  return <label className="ex-field">Agreement version to issue
    <select name={name} required defaultValue="">
      <option value="" disabled>Choose a published agreement</option>
      {agreements.map((a) => <option key={str(a.versionId)} value={str(a.versionId)}>{str(a.title)} · version {str(a.version)} · review by {str(a.reviewBy)}</option>)}
    </select>
  </label>
}

export function RecruitmentPanel({ workspace, command, invitation, clearInvitation }: { workspace: Row; command: Command; invitation: string; clearInvitation: () => void }) {
  const applications = rows(workspace.applications)
  const register = (workspace.agreementRegister ?? {}) as Row
  const agreements = rows(register.agreements)
  const agreementPartners = rows(register.partners)
  const partners = rows(workspace.partners)
  const audit = rows(workspace.applicationAudit)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('open')
  const [region, setRegion] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const a of applications) c[str(a.status)] = (c[str(a.status)] ?? 0) + 1
    return c
  }, [applications])
  const regions = useMemo(() => [...new Set(applications.map((a) => str(a.residence_country) || str(a.region)).filter(Boolean))].sort(), [applications])
  const visible = applications.filter((a) => {
    const s = str(a.status)
    if (status === 'open' && ['activated', 'declined', 'withdrawn', 'archived'].includes(s)) return false
    if (status !== 'open' && status !== 'all' && s !== status) return false
    if (region !== 'all' && (str(a.residence_country) || str(a.region)) !== region) return false
    const submitted = day(a.submitted_at)
    if (from && submitted < from) return false
    if (to && submitted > to) return false
    const q = query.trim().toLowerCase()
    return !q || [a.name, a.email, a.region, a.residence_country, a.industries].some((v) => str(v).toLowerCase().includes(q))
  })

  return <>
    <section className="ex-panel" aria-labelledby="applicants-heading">
      <div className="ex-section-heading"><h2 id="applicants-heading">Partner applications</h2><span className="ex-badge">{applications.length} total</span></div>
      <p>Approval in principle never activates an account. An applicant becomes a partner only by accepting the agreement version you issue with their invitation.</p>
      <div className="ex-chips" role="group" aria-label="Filter by status">
        {[['open', 'Open'], ['all', 'All'], ...APPLICATION_STATUSES.filter((s) => counts[s]).map((s) => [s, APPLICATION_STATUS_LABELS[s]])].map(([value, text]) =>
          <button key={value} type="button" className="ex-chip" aria-pressed={status === value} onClick={() => setStatus(value)}>{text}{counts[value] ? <span>{counts[value]}</span> : null}</button>)}
      </div>
      <div className="ex-filters">
        <label className="ex-field">Search name, email, region or industry<input type="search" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
        <label className="ex-field">Country or region<select value={region} onChange={(e) => setRegion(e.target.value)}><option value="all">All</option>{regions.map((r) => <option key={r} value={r}>{r}</option>)}</select></label>
        <label className="ex-field">Submitted from<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="ex-field">Submitted to<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      <p className="ex-result-count" role="status">{visible.length} of {applications.length} shown</p>
      {visible.map((row) => {
        const s = str(row.status)
        const next = founderNextStatuses(s)
        const confirmations = (row.onboarding_confirmations ?? {}) as Row
        return <details className="ex-resource ex-applicant" key={str(row.id)}>
          <summary><span className="ex-applicant-name">{str(row.name)}</span><span className={tone(s)}>{statusLabel(s)}</span><small>{str(row.residence_country) || str(row.region)} · received {day(row.submitted_at)}</small></summary>
          <p>{str(row.email)}{row.phone ? ` · ${str(row.phone)}` : ''} · {str(row.region)}{row.linkedin ? <> · <a href={str(row.linkedin)} rel="noopener noreferrer nofollow" target="_blank">LinkedIn</a></> : null}</p>
          <dl>{['experience', 'business_activity', 'networks', 'industries', 'motivation'].map((key) => <div key={key}><dt>{key.replaceAll('_', ' ')}</dt><dd>{str(row[key]) || '—'}</dd></div>)}</dl>
          <p>Retention review {day(row.retention_until)} · privacy notice {str(row.privacy_version)}</p>
          <ol className="ex-steps" aria-label="Onboarding checks">{CONFIRMATIONS.map(([key, text]) => <li key={key} data-done={confirmations[key] === true}>{confirmations[key] === true ? 'Done: ' : 'Outstanding: '}{text}</li>)}</ol>
          {next.length ? <Action action="review_application" title="Record founder review" command={command} initial={{ id: Number(row.id) }}
            confirm="This records a founder decision about this applicant. It is audited with your name and cannot be silently undone.">
            <label className="ex-field">Move to
              <select name="status" defaultValue={next[0]}>{[s, ...next].filter(isApplicationStatus).map((n) => <option key={n} value={n}>{n === s ? `Keep: ${statusLabel(n)}` : statusLabel(n)}</option>)}</select>
            </label>
            <Field name="residenceCountry" title="Applicant residence, two-letter code (information only; authorises nothing)" required={false} value={str(row.residence_country)} />
            <Field name="notes" title="Internal review notes (never shown to the applicant)" area value={str(row.review_notes)} />
            <Field name="applicantMessage" title="Message to the applicant (required when requesting information; this exact text is emailed)" area required={false} />
            <Check name="notifyApplicant" title="Email the applicant about this decision (information requested or declined only)" />
            <fieldset className="ex-checkset"><legend>Founder confirmations (all four are required before onboarding)</legend>
              {CONFIRMATIONS.map(([name, title]) => <Check key={name} name={name} title={title} checked={confirmations[name] === true} />)}</fieldset>
          </Action> : <p className="ex-note">{s === 'activated' ? 'This applicant is an active partner. Manage access under Partner accounts.' : 'This application is closed.'}</p>}
          {s === 'onboarding' && (agreements.length
            ? <Action action="invite" title="Issue single-use invitation" command={command} initial={{ id: Number(row.id) }}
              confirm="This creates an inactive partner identity and a 48-hour single-use link. The applicant must read and accept the agreement you choose before the account activates.">
              <AgreementSelect agreements={agreements} />
              <Field name="operatingCountry" title="Partner operating market, two-letter code (must be an approved market)" value="GB" />
              <Check name="emailInvitation" title="Email the secure link to the applicant (the link is also shown here once)" />
            </Action>
            : <p className="ex-note" role="note">No published agreement is available. Draft, approve and publish one in Content studio (type: agreement) before inviting.</p>)}
        </details>
      })}
      {!applications.length && <Empty text="No applications received. Public applications stay closed until the privacy notice and retention period are approved." />}
      {applications.length > 0 && !visible.length && <Empty text="No applications match these filters." />}
    </section>

    {invitation && <section className="ex-panel" role="status"><h2>Invitation issued</h2><p>This secret link is shown once in this browser session and expires in 48 hours. Send it only to the approved applicant through an authorised channel.</p><textarea readOnly aria-label="Single-use invitation link" value={invitation} /><button className="ex-link" onClick={clearInvitation}>Hide secret link</button></section>}

    <section className="ex-panel" aria-labelledby="agreements-heading">
      <h2 id="agreements-heading">Partner agreements</h2>
      <p>Published agreements available to issue: {agreements.length ? agreements.map((a) => `${str(a.title)} (version ${str(a.version)})`).join(', ') : 'none'}. Agreements are drafted, approved by founders and published in Content studio; a published version cannot be edited.</p>
      {agreementPartners.length ? <div className="ex-table-wrap"><table className="ex-table"><caption className="sr-only">Agreement status by partner</caption>
        <thead><tr><th scope="col">Partner</th><th scope="col">Issued</th><th scope="col">Accepted</th><th scope="col">Status</th><th scope="col">Copy</th></tr></thead>
        <tbody>{agreementPartners.map((p) => {
          const state = !p.issued_slug ? 'No agreement issued' : p.issued_current !== true ? 'Issued version withdrawn or out of review date' : p.accepted_issued === true ? 'Accepted' : 'Awaiting acceptance'
          return <tr key={str(p.partner_id)}>
            <td>{str(p.display_name)}{p.active ? '' : ' (inactive)'}</td>
            <td>{p.issued_slug ? `${str(p.issued_slug)} v${str(p.issued_version)}` : '—'}</td>
            <td>{p.accepted_version ? <>v{str(p.accepted_version)}<br /><small>{str(p.accepted_at).slice(0, 16).replace('T', ' ')} UTC</small></> : '—'}</td>
            <td><span className={state === 'Accepted' ? 'ex-pill ex-pill-ok' : state === 'Awaiting acceptance' ? 'ex-pill ex-pill-warn' : 'ex-pill ex-pill-muted'}>{state}</span></td>
            <td>{p.acceptance_id ? <a href={`/api/expansion/agreements/${str(p.acceptance_id)}`} download>Download</a> : '—'}</td>
          </tr>
        })}</tbody></table></div> : <Empty text="No partner holds an agreement yet." />}
    </section>

    <section className="ex-panel" aria-labelledby="accounts-heading"><h2 id="accounts-heading">Partner accounts</h2>
      {partners.map((row) => <div className="ex-resource" key={str(row.id)}><strong>{str(row.display_name)}</strong><p>{str(row.email)} · {row.active ? 'Active' : 'Inactive or invitation pending'} · operating market <strong>{str(row.operating_country)}</strong></p>
        <Action action="set_partner_operating_market" title="Set operating market" command={command} initial={{ id: row.id }}><Field name="countryCode" title="Operating market, two-letter code" /></Action>
        {row.activated_at && agreements.length ? <Action action="reissue_agreement" title="Issue a new agreement version" command={command} initial={{ id: row.id }}
          confirm="The partner keeps access and is asked to accept the new version. Their earlier acceptance stays on record.">
          <AgreementSelect agreements={agreements} /><Check name="notifyPartner" title="Email the partner that a new version is ready" /></Action> : null}
        <Action action="revoke_partner" title="Suspend access and end sessions" command={command} initial={{ id: row.id }}
          confirm="The partner is signed out everywhere and cannot sign in. Their agreement, opportunities and history are kept." />
      </div>)}
      {!partners.length && <Empty text="No partner accounts yet." />}
    </section>

    <section className="ex-panel" aria-labelledby="audit-heading"><h2 id="audit-heading">Recruitment audit history</h2>
      {audit.length ? <div className="ex-table-wrap"><table className="ex-table"><caption className="sr-only">Founder recruitment decisions, newest first</caption>
        <thead><tr><th scope="col">When (UTC)</th><th scope="col">Founder</th><th scope="col">Action</th><th scope="col">Detail</th></tr></thead>
        <tbody>{audit.map((a, i) => {
          const d = (a.details ?? {}) as Row
          const detail = a.action === 'application_reviewed' ? `Application ${str(a.entity_id)}: ${statusLabel(d.from)} → ${statusLabel(d.status)}` : a.action === 'agreement_reissued' ? `Issued ${str(d.label)}` : `Record ${str(a.entity_id).slice(0, 8)}`
          return <tr key={i}><td>{str(a.created_at).slice(0, 16).replace('T', ' ')}</td><td>{str(a.actor_name)}</td><td>{str(a.action).replaceAll('_', ' ')}</td><td>{detail}</td></tr>
        })}</tbody></table></div> : <Empty text="No recruitment decisions recorded yet." />}
    </section>
  </>
}
