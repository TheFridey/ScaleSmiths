'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, BookOpen, Check, CircleDot, Clock, Compass, GraduationCap, Hourglass, Lock, MessagesSquare, Sparkles, Wrench } from 'lucide-react'
import { JOURNEY_STATUS_LABEL, type JourneyAction, type JourneyStatus, type PartnerJourney, type RequiredStep, type ToolItem } from '@/lib/partner-journey'
import './journey.css'

type Command = (input: Record<string, unknown>) => Promise<Record<string, unknown>>
export type JourneyNavigate = (tab: string, meetingType?: string) => void

const STATUS_ICON: Record<JourneyStatus, typeof Check> = {
  available: ArrowRight, ready_to_set_up: Wrench, awaiting_setup: Hourglass, in_progress: Clock, coming_soon: Sparkles, in_development: Compass, action_required: CircleDot, completed: Check,
}
const GROUPS: { key: ToolItem['group']; title: string; intro: string; icon: typeof Check }[] = [
  { key: 'start', title: 'Getting paid', intro: 'How you earn and how to introduce others.', icon: Check },
  { key: 'sell', title: 'Selling with ScaleSmiths', intro: 'Find, qualify and win opportunities with founder support.', icon: MessagesSquare },
  { key: 'learn', title: 'Learning and guidance', intro: 'Optional training and approved answers whenever you need them.', icon: GraduationCap },
  { key: 'brand', title: 'Your professional identity', intro: 'Branded tools set up with you by the ScaleSmiths team.', icon: BookOpen },
]

export function StatusPill({ status }: { status: JourneyStatus }) {
  const Icon = STATUS_ICON[status]
  return <span className={`jr-pill jr-${status}`}><Icon size={13} aria-hidden="true" />{JOURNEY_STATUS_LABEL[status]}</span>
}

function ActionButton({ action, command, onNavigate, primary = false }: { action: JourneyAction; command: Command; onNavigate: JourneyNavigate; primary?: boolean }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const className = primary ? 'ex-button' : 'jr-action'
  if (action.kind === 'link') return <Link className={className} href={action.href}>{action.label}<ArrowRight size={15} aria-hidden="true" /></Link>
  if (action.kind === 'tab') return <button type="button" className={className} onClick={() => onNavigate(action.tab, action.meetingType)}>{action.label}<ArrowRight size={15} aria-hidden="true" /></button>
  const run = async () => {
    setBusy(true); setError('')
    try { await command(action.kind === 'acknowledge' ? { action: 'acknowledge_onboarding_step', step: action.step } : { action: action.action, ...(action.itemKey ? { itemKey: action.itemKey } : {}) }) }
    catch (e) { setError(e instanceof Error ? e.message : 'That did not work. Please try again.') }
    finally { setBusy(false) }
  }
  return <span className="jr-action-wrap"><button type="button" className={className} onClick={run} disabled={busy} aria-busy={busy}>{busy ? 'Saving…' : action.label}{!busy && (action.kind === 'acknowledge' ? <Check size={15} aria-hidden="true" /> : <ArrowRight size={15} aria-hidden="true" />)}</button>{error && <span role="alert" className="jr-error">{error}</span>}</span>
}

function ProgressRing({ percent }: { percent: number }) {
  const r = 44, c = 2 * Math.PI * r
  return <svg className="jr-ring" viewBox="0 0 100 100" role="img" aria-label={`Onboarding ${percent}% complete`}>
    <circle cx="50" cy="50" r={r} className="jr-ring-track" />
    <circle cx="50" cy="50" r={r} className="jr-ring-value" strokeDasharray={c} strokeDashoffset={c * (1 - percent / 100)} />
    <text x="50" y="50" textAnchor="middle" dominantBaseline="central">{percent}%</text>
  </svg>
}

function RequiredList({ steps, command, onNavigate }: { steps: RequiredStep[]; command: Command; onNavigate: JourneyNavigate }) {
  return <ol className="jr-steps">{steps.map((s, i) => <li key={s.key} data-done={s.status === 'completed'}>
    <span className="jr-step-index" aria-hidden="true">{s.status === 'completed' ? <Check size={16} /> : i + 1}</span>
    <div className="jr-step-body"><div className="jr-step-title"><strong>{s.title}</strong><StatusPill status={s.status} /></div><p>{s.detail}</p>
      {s.completedAt && <small>Completed {new Date(s.completedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</small>}</div>
    {s.action && <ActionButton action={s.action} command={command} onNavigate={onNavigate} primary={s.status !== 'completed'} />}
  </li>)}</ol>
}

/** The full "Your ScaleSmiths Partner Journey" experience (Getting started tab). */
export function JourneyView({ journey, command, onNavigate }: { journey: PartnerJourney & { displayName?: string }; command: Command; onNavigate: JourneyNavigate }) {
  const complete = journey.completed === journey.total
  const ready = journey.tools.filter((t) => t.status === 'available' || t.status === 'completed' || t.status === 'in_progress').length
  return <div className="jr">
    <section className="ex-panel jr-hero">
      <div className="jr-hero-copy"><p className="ex-overline">YOUR SCALESMITHS PARTNER JOURNEY</p>
        <h2>{journey.displayName ? `Welcome, ${journey.displayName}.` : 'Welcome.'}</h2>
        <p>Everything you need to get started, develop your expertise and build your business with ScaleSmiths.</p>
        <ul className="jr-hero-facts"><li><strong>{journey.completed}/{journey.total}</strong> required steps</li><li><strong>{ready}</strong> tools ready to use</li><li><strong>{journey.upcoming.length}</strong> capabilities on the way</li></ul></div>
      <ProgressRing percent={journey.percent} />
    </section>

    <section className="ex-panel" aria-labelledby="jr-required">
      <div className="ex-section-heading"><div><p className="ex-overline">REQUIRED TO GET STARTED</p><h2 id="jr-required">{complete ? 'Onboarding complete' : 'Your next steps'}</h2></div><StatusPill status={complete ? 'completed' : 'action_required'} /></div>
      <p>{complete ? 'You have completed every required step. Your progress is saved to your account, so it is the same on every device.' : 'Four short steps. They are saved to your account as you complete them. Training and optional tools never hold up your onboarding.'}</p>
      <div className="ex-progress" role="progressbar" aria-valuemin={0} aria-valuemax={journey.total} aria-valuenow={journey.completed} aria-label="Required onboarding steps completed"><span style={{ width: `${journey.percent}%` }} /></div>
      <RequiredList steps={journey.required} command={command} onNavigate={onNavigate} />
    </section>

    {GROUPS.map((g) => { const items = journey.tools.filter((t) => t.group === g.key); if (!items.length) return null; const Icon = g.icon
      return <section className="ex-panel" key={g.key} aria-labelledby={`jr-${g.key}`}>
        <div className="jr-group-head"><span className="jr-group-icon" aria-hidden="true"><Icon size={18} /></span><div><h2 id={`jr-${g.key}`}>{g.title}</h2><p>{g.intro}</p></div></div>
        <ul className="jr-tools">{items.map((t) => <li key={t.key} className="jr-tool" data-status={t.status}>
          <div className="jr-tool-head"><strong>{t.title}</strong><StatusPill status={t.status} /></div>
          <p>{t.benefit}</p><p className="jr-tool-detail">{t.detail}{t.responsible ? <> <span className="jr-owner">Next step: {t.responsible}.</span></> : null}</p>
          {t.action && <div className="jr-tool-action"><ActionButton action={t.action} command={command} onNavigate={onNavigate} /></div>}
        </li>)}</ul></section> })}

    <section className="ex-panel jr-support"><div><p className="ex-overline">FOUNDER SUPPORT</p><h2>You are not doing this alone.</h2><p>Ask a founder to join a client meeting, help with technical scoping or run an optional training session. Requests go straight to the founders from here; a founder confirms a real time with you.</p></div>
      <div className="jr-support-actions"><button type="button" className="ex-button" onClick={() => onNavigate('meetings', 'joint_sales')}>Request founder support<ArrowRight size={15} aria-hidden="true" /></button></div></section>

    <UpcomingShowcase journey={journey} />
  </div>
}

export function UpcomingShowcase({ journey }: { journey: PartnerJourney }) {
  return <section className="ex-panel jr-upcoming" aria-labelledby="jr-upcoming">
    <p className="ex-overline">COMING TO THE PARTNER PROGRAMME</p><h2 id="jr-upcoming">What we are building next</h2>
    <p>ScaleSmiths is investing in tools that make your conversations better prepared and your proposals faster. These are not available yet and none has a confirmed release date. Nothing here is needed to complete onboarding.</p>
    <ul className="jr-upcoming-grid">{journey.upcoming.map((u) => <li key={u.key}><div className="jr-tool-head"><strong>{u.title}</strong><StatusPill status={u.status} /></div><p>{u.benefit}</p></li>)}</ul>
  </section>
}

/** Overview summary: progress, the single most useful next action, and honest empty states. */
export function JourneySummary({ journey, command, onNavigate, opportunities, earned }: { journey: PartnerJourney & { displayName?: string }; command: Command; onNavigate: JourneyNavigate; opportunities: number; earned: boolean }) {
  const next = journey.nextAction
  const academy = journey.tools.find((t) => t.key === 'academy')
  return <section className="ex-panel jr-summary" aria-labelledby="jr-summary">
    <div className="jr-summary-main">
      <div className="jr-summary-progress"><ProgressRing percent={journey.percent} /><div><p className="ex-overline">YOUR PARTNER JOURNEY</p><h2 id="jr-summary">{journey.completed === journey.total ? 'Onboarding complete' : `${journey.completed} of ${journey.total} steps complete`}</h2>
        <button type="button" className="ex-link" onClick={() => onNavigate('onboarding')}>See your full journey</button></div></div>
      {next && <div className="jr-next"><p className="ex-overline">RECOMMENDED NEXT</p><strong>{next.title}</strong><p>{next.detail}</p>{next.action && <ActionButton action={next.action} command={command} onNavigate={onNavigate} primary />}</div>}
    </div>
    <ul className="jr-starters">
      {opportunities === 0 && <li><Lock size={16} aria-hidden="true" /><div><strong>No prospects yet</strong><p>Register a business you know. Record what it needs, and ScaleSmiths reviews scope and capacity before anything is committed.</p><button type="button" className="jr-action" onClick={() => onNavigate('pipeline')}>Register prospect<ArrowRight size={15} aria-hidden="true" /></button></div></li>}
      {!earned && <li><Lock size={16} aria-hidden="true" /><div><strong>No commission yet</strong><p>Commission is earned when a client you introduced makes an eligible payment under your agreement. It shows as pending first, then payable.</p><button type="button" className="jr-action" onClick={() => onNavigate('finance')}>How commission works<ArrowRight size={15} aria-hidden="true" /></button></div></li>}
      {academy?.status === 'available' && academy.action && <li><GraduationCap size={16} aria-hidden="true" /><div><strong>Start with &ldquo;Welcome to ScaleSmiths&rdquo;</strong><p>A short, optional course on who ScaleSmiths is, what we deliver and how the partnership works.</p><ActionButton action={academy.action} command={command} onNavigate={onNavigate} /></div></li>}
    </ul>
  </section>
}
