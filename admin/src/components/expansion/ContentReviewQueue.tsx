'use client'

import { useMemo, useState } from 'react'
import { SafeMarkdown } from '@/components/empower/SafeMarkdown'

/*
 * Operation EMPOWER B2.10: the consolidated founder review queue. One place to submit, approve and publish prepared Academy
 * courses and lessons, resources, knowledge entries and objection responses. Each selected item is processed by the existing
 * single-version service with every rule re-applied; failures are reported per item and never hidden. Agreements are excluded.
 */
type Row = Record<string, unknown>
type Command = (input: Row) => Promise<Row>
type Stage = 'submit' | 'approve' | 'publish'
type Result = { versionId: string; title: string; kind: string; ok: boolean; error?: string }
const str = (v: unknown) => (v == null ? '' : String(v))
const KIND_ORDER = ['course', 'lesson', 'resource', 'template', 'knowledge', 'objection']
const KIND_LABEL: Record<string, string> = { course: 'Academy courses', lesson: 'Academy lessons', resource: 'Resources', template: 'Templates', knowledge: 'Knowledge base', objection: 'Objection responses' }
const STAGE_COPY: Record<Stage, { title: string; empty: string; help: string }> = {
  submit: { title: 'Drafts to submit', empty: 'No drafts of yours are waiting to be submitted.', help: 'Your own drafts. Submitting runs the content checks; an item with findings stays a draft and is listed with the reason, so you can fix it or submit it individually with an override reason.' },
  approve: { title: 'Awaiting your approval', empty: 'Nothing is waiting for your approval.', help: 'Submitted by another founder (or by you, if you are the only active founder, in which case a self-approval reason is required). Read each item before approving it.' },
  publish: { title: 'Approved, ready to publish', empty: 'Nothing approved is waiting to be published.', help: 'Publishing makes an item visible to partners once its area is switched on. Lessons are published before the courses that use them.' },
}

export function ContentReviewQueue({ a, command }: { a: Row; command: Command }) {
  const items = (Array.isArray(a.items) ? a.items : []) as Row[]
  const versions = (Array.isArray(a.versions) ? a.versions : []) as Row[]
  const actorId = str(a.actorId), founders = Number(a.activeFounders || 0)
  const [stage, setStage] = useState<Stage>('approve')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState<Result[] | null>(null)
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [selfReason, setSelfReason] = useState('')

  const queue = useMemo(() => {
    const itemOf = (v: Row) => items.find((i) => i.id === v.item_id)
    const pick = (s: Stage) => versions.filter((v) => {
      const item = itemOf(v)
      if (!item || item.kind === 'agreement') return false
      if (s === 'submit') return v.status === 'draft' && str(v.created_by) === actorId
      if (s === 'approve') return v.status === 'in_review' && (str(v.created_by) !== actorId || founders <= 1)
      return v.status === 'approved'
    }).map((v) => ({ v, item: itemOf(v)! })).sort((x, y) => KIND_ORDER.indexOf(str(x.item.kind)) - KIND_ORDER.indexOf(str(y.item.kind)) || str(x.v.title).localeCompare(str(y.v.title)))
    return { submit: pick('submit'), approve: pick('approve'), publish: pick('publish') }
  }, [items, versions, actorId, founders])
  const list = queue[stage]
  const ownSubmitted = versions.filter((v) => v.status === 'in_review' && str(v.created_by) === actorId && founders > 1).length
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const switchStage = (s: Stage) => { setStage(s); setSelected(new Set()); setResults(null); setError('') }

  async function run(action: string, extra: Row = {}) {
    setBusy(true); setError(''); setResults(null)
    try {
      const out = await command({ action, versionIds: [...selected], ...extra })
      setResults((out.results as Result[]) || []); setSelected(new Set())
    } catch (e) { setError(e instanceof Error ? e.message : 'The batch was refused.') }
    finally { setBusy(false) }
  }

  return <section className="ex-panel ex-review-queue" aria-labelledby="review-queue-heading">
    <p className="ex-overline">CONSOLIDATED FOUNDER REVIEW</p>
    <h2 id="review-queue-heading">Review queue</h2>
    <p>Everything prepared for partners, in one place. Each selected item is submitted, approved or published individually under the normal rules, with your name on the record. Partner agreements are never part of a batch: handle each agreement version in the item list below.</p>
    <div className="ex-queue-tabs" role="tablist" aria-label="Review stage">
      {(['submit', 'approve', 'publish'] as Stage[]).map((s) => <button key={s} role="tab" type="button" aria-selected={stage === s} className={stage === s ? 'ex-chip ex-chip-on' : 'ex-chip'} onClick={() => switchStage(s)}>{STAGE_COPY[s].title} <strong>{queue[s].length}</strong></button>)}
    </div>
    <p className="ex-note">{STAGE_COPY[stage].help}{stage === 'approve' && ownSubmitted > 0 ? ` ${ownSubmitted} item${ownSubmitted === 1 ? '' : 's'} you submitted ${ownSubmitted === 1 ? 'is' : 'are'} waiting for another founder.` : ''}</p>
    {list.length ? <>
      <label className="ex-check"><input type="checkbox" checked={selected.size === list.length} onChange={(e) => setSelected(e.target.checked ? new Set(list.map((x) => str(x.v.id))) : new Set())} /><span>Select all {list.length}</span></label>
      {KIND_ORDER.filter((k) => list.some((x) => x.item.kind === k)).map((k) => <div key={k} className="ex-queue-group"><h3>{KIND_LABEL[k]} ({list.filter((x) => x.item.kind === k).length})</h3>
        {list.filter((x) => x.item.kind === k).map(({ v, item }) => <details key={str(v.id)} className="ex-resource ex-queue-item">
          <summary><input type="checkbox" aria-label={`Select ${str(v.title)}`} checked={selected.has(str(v.id))} onChange={() => toggle(str(v.id))} onClick={(e) => e.stopPropagation()} /> {str(v.title)} <span className="ex-badge">v{str(v.version)} · {item.audience === 'client_facing' ? 'Client-facing' : 'Partner only'} · {str(v.author_name)}</span></summary>
          {str(v.change_summary) ? <p className="ex-note">{str(v.change_summary)}</p> : null}
          {str(v.body) ? <SafeMarkdown source={str(v.body)} /> : null}
          {v.fields && typeof v.fields === 'object' ? <dl>{Object.entries(v.fields as Row).filter(([, val]) => typeof val === 'string' && val).slice(0, 8).map(([key, val]) => <div key={key}><dt>{key.replaceAll('_', ' ')}</dt><dd>{str(val)}</dd></div>)}</dl> : null}
          {Array.isArray(v.source_refs) && v.source_refs.length ? <p className="ex-note">Sources: {(v.source_refs as unknown[]).map(str).join(' · ')}</p> : null}
        </details>)}</div>)}
      <div className="ex-queue-actions">
        {stage === 'submit' && <button type="button" className="ex-button" disabled={busy || !selected.size} onClick={() => run('submit_content_batch')}>{busy ? 'Submitting…' : `Submit ${selected.size || ''} for review`}</button>}
        {stage === 'approve' && <>
          <label className="ex-field">Review reference (recorded on every approval)<input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={200} placeholder="For example: Founder content review, 24 November 2026" /></label>
          {founders <= 1 && <label className="ex-field">Self-approval reason (you are the only active founder)<input value={selfReason} onChange={(e) => setSelfReason(e.target.value)} maxLength={500} /></label>}
          <button type="button" className="ex-button" disabled={busy || !selected.size || reference.trim().length < 3} onClick={() => run('decide_content_batch', { decision: 'approved', reference, ...(founders <= 1 ? { selfApprovalReason: selfReason } : {}) })}>{busy ? 'Recording…' : `Approve ${selected.size || ''} I have read`}</button>
          <label className="ex-field">Changes needed (sent back to the author)<textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={2000} /></label>
          <button type="button" className="jr-action" disabled={busy || !selected.size || notes.trim().length < 3 || reference.trim().length < 3} onClick={() => run('decide_content_batch', { decision: 'changes_requested', reference, notes })}>Request changes</button>
        </>}
        {stage === 'publish' && <button type="button" className="ex-button" disabled={busy || !selected.size} onClick={() => run('publish_content_batch')}>{busy ? 'Publishing…' : `Publish ${selected.size || ''}`}</button>}
      </div>
    </> : <p className="ex-empty">{STAGE_COPY[stage].empty}</p>}
    {error && <p role="alert" className="ex-error">{error}</p>}
    {results && <div role="status" className="ex-queue-results"><p><strong>{results.filter((r) => r.ok).length} done</strong>{results.some((r) => !r.ok) ? `, ${results.filter((r) => !r.ok).length} refused` : ''}.</p>
      {results.filter((r) => !r.ok).length > 0 && <ul>{results.filter((r) => !r.ok).map((r) => <li key={r.versionId}><strong>{r.title}</strong>: {r.error}</li>)}</ul>}</div>}
  </section>
}
