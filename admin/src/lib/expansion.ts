export class ExpansionError extends Error {
  constructor(message: string, public status = 400) { super(message); this.name = 'ExpansionError' }
}
export function expansionText(value: unknown, label: string, max = 2000) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new ExpansionError(`${label} is required (maximum ${max} characters).`)
  return value.trim()
}
export function expansionId(value: unknown) {
  const id = expansionText(value, 'Record', 36)
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) throw new ExpansionError('Invalid record.')
  return id
}
export function expansionInteger(value: unknown, label: string, min = 1, max = 10000) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) throw new ExpansionError(`Invalid ${label}.`)
  return value
}
export function prospectDomain(value: unknown) {
  const raw = expansionText(value, 'Business website', 253)
  let url: URL
  try { url = new URL(raw.includes('://') ? raw : `https://${raw}`) } catch { throw new ExpansionError('Enter a valid business website.') }
  const host = url.hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '')
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(host)) throw new ExpansionError('Enter a public business domain without credentials or a custom port.')
  return host
}
export const DISCOVERY_FIELDS = ['objectives','existingWebsite','marketingChannels','targetCustomers','serviceArea','enquiryProcess','hosting','domainOwnership','seoConcerns','pages','functionality','integrations','content','budget','timescale','decisionProcess','accessibility','restrictions'] as const
export function parseDiscovery(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ExpansionError('Discovery responses are required.')
  const input = value as Record<string, unknown>
  return Object.fromEntries(DISCOVERY_FIELDS.map(key => [key, input[key] == null || input[key] === '' ? '' : expansionText(input[key], key, 3000)]))
}
export function technicalReviewFlags(discovery: Record<string, string>) {
  const content = Object.values(discovery).join(' ')
  return ['e-commerce','membership','booking','migration','custom software','multilingual','regulated','payment','organic traffic'].filter(term => content.toLowerCase().includes(term))
}
export const PARTNER_TRANSITIONS: Record<string, readonly string[]> = {
  registered: ['contacted','discovery','withdrawn'], contacted: ['discovery','closed_lost','withdrawn'],
  discovery: ['qualified','closed_lost','withdrawn'], qualified: ['discovery','closed_lost','withdrawn'],
  more_information: ['discovery','withdrawn'], bespoke_required: ['discovery','withdrawn'], deferred: ['discovery','withdrawn'],
}
export function assertPartnerTransition(from: string, to: unknown) {
  if (typeof to !== 'string' || !PARTNER_TRANSITIONS[from]?.includes(to)) throw new ExpansionError('This stage requires the approved commercial workflow.', 409)
  return to
}
export function capacityPeriod(value: unknown) {
  const period = expansionText(value, 'Capacity week', 10)
  const date = new Date(`${period}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(period) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== period || date.getUTCDay() !== 1) throw new ExpansionError('Choose a valid Monday for the delivery week.')
  return period
}
/**
 * Operation Ascend B2.2: the business-name key used for duplicate detection. Mirrors the SQL function
 * expansion_business_name_key (migration 0099) exactly; a parity test runs both over the same names.
 * "&" reads as "and", a leading "The" and trailing legal forms are ignored, then only a-z and 0-9 remain.
 * A name that is nothing but a legal form keeps its plain key, so it never matches every other such name.
 */
export const LEGAL_FORMS = ['limited', 'ltd', 'plc', 'llp', 'lp', 'llc', 'inc', 'incorporated', 'cic'] as const
export function businessNameKey(value: unknown) {
  const spaced = String(value ?? '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ')
  const stripped = spaced.replace(new RegExp(String.raw`^\s*the\s+|(\s+(${LEGAL_FORMS.join('|')}))+\s*$`, 'g'), '').replace(/\s+/g, '')
  return stripped || spaced.replace(/\s+/g, '')
}
