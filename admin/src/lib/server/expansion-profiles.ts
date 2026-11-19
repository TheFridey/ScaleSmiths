import "server-only"
import { randomUUID } from "node:crypto"
import { sql, type SQL } from "drizzle-orm"
import { db, type AdminDatabaseTransaction } from "@/lib/db"
import { type AdminRole } from "@/lib/admin-users"
import { hasCapability } from "@/lib/rbac"
import { ExpansionError } from "@/lib/expansion"
import { safeDbMessage } from "@/lib/db-errors"
import { requireCapability } from "./rbac"

/*
 * Personal partner webpages (checkpoint 5). Draft and consent are the partner's; review, approval, publication and revocation are the founders'.
 * Approved content is an immutable version, publication is a separate immutable record, and the public reads only the narrow view
 * `expansion_public_partner_profiles`. Publication is OFF unless PARTNER_PROFILE_PUBLICATION_ENABLED=true: approving content never publishes it.
 * Lock order (LOCK-HIERARCHY.md): admin_users (share) -> expansion_partners (update) -> profile rows.
 */
type Row = Record<string, unknown>
type Executor = Pick<AdminDatabaseTransaction, "execute">
type Actor = Awaited<ReturnType<typeof requireCapability>>
export const PROFILE_CONSENT_VERSION = "profile-consent-v1"
export const PROFILE_CONSENT_TEXT = "I consent to ScaleSmiths publishing the display name, biography and operating area shown in this draft on a public ScaleSmiths web page for as long as I am an active ScaleSmiths partner and the page remains approved. I understand that no private contact details are published, that I can ask for the page to be removed, and that a founder can remove it at any time."
export class ProfileError extends ExpansionError { constructor(message: string, status = 400) { super(message, status); this.name = "ProfileError" } }
const rows = async (tx: Executor, query: SQL): Promise<Row[]> => (await tx.execute(query)).rows as Row[]
const conflict = (message: string): never => { throw new ProfileError(message, 409) }
const uuid = (value: unknown) => { if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new ProfileError("A valid record identifier is required."); return value.toLowerCase() }
const dbMessage = (error: unknown, fallback: string) => safeDbMessage(error, fallback)
const audit = (tx: Executor, actorId: string, entity: string, action: string, details: unknown) =>
  tx.execute(sql`insert into expansion_audit(actor_id,entity_id,action,details) values(${actorId},${entity},${action},${JSON.stringify(details)}::jsonb)`)

/** Private contact details are never published without separate consent, so they are rejected in public wording altogether. */
const CONTACT = /([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})|(https?:\/\/|www\.)|(\b[a-z0-9-]+\.(com|co\.uk|uk|net|org|io|app|dev)\b)|((\+?\d[\s().-]?){9,})/i
const MISREPRESENTATION = /(equity|shareholder|co-?owner of scalesmiths|director of scalesmiths|employee of scalesmiths|scalesmiths employee|official scalesmiths|guaranteed (income|earnings|employment|results|commission))/i
const MONEY = /(£|\$|€|\bcommission\b|\bearn(ed|ings)?\b|\bpaid\b|\bbonus\b|\bpayout\b|\brevenue\b|\bturnover\b)/i
export function validateProfileContent(input: { displayName?: unknown; biography?: unknown; operatingArea?: unknown; enquiryMode?: unknown }) {
  const clean = (v: unknown, label: string, min: number, max: number) => { if (typeof v !== "string" || v.trim().length < min || v.trim().length > max) throw new ProfileError(`${label} must be ${min} to ${max} characters.`); return v.trim().replace(/\s+/g, " ") }
  const displayName = clean(input.displayName, "Display name", 2, 80), biography = clean(input.biography, "Biography", 20, 1200), operatingArea = clean(input.operatingArea, "Operating area", 2, 120)
  const enquiryMode = input.enquiryMode === undefined || input.enquiryMode === "" ? "scalesmiths_contact" : String(input.enquiryMode)
  if (!["scalesmiths_contact", "referral_code"].includes(enquiryMode)) throw new ProfileError("Choose how enquiries are directed.")
  for (const [label, value] of [["Display name", displayName], ["Biography", biography], ["Operating area", operatingArea]] as const) {
    if (CONTACT.test(value)) throw new ProfileError(`${label} must not contain email addresses, phone numbers or web addresses. Enquiries are directed through ScaleSmiths.`)
    if (MISREPRESENTATION.test(value)) throw new ProfileError(`${label} must not suggest that you are an owner, director or employee of ScaleSmiths, or promise income or results.`)
  }
  if (/scalesmiths|official|founder|staff|admin/i.test(displayName)) throw new ProfileError("The display name must be your own name or business name. It cannot include ScaleSmiths or titles that imply authority.")
  return { displayName, biography, operatingArea, enquiryMode }
}
export function slugify(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/g, "")
}
export function validateAchievements(value: unknown) {
  if (value === undefined || value === null || value === "") return []
  const list = Array.isArray(value) ? value : String(value).split("\n")
  const items = list.map(v => String(v).trim()).filter(Boolean)
  if (items.length > 5) throw new ProfileError("Show at most five achievements.")
  for (const item of items) {
    if (item.length < 3 || item.length > 80) throw new ProfileError("Each achievement is 3 to 80 characters.")
    if (MONEY.test(item) || CONTACT.test(item) || MISREPRESENTATION.test(item)) throw new ProfileError("Achievements must not mention money, commission, earnings, contact details or ownership. Describe the recognition only.")
  }
  return items
}
const publicationEnabled = () => process.env.PARTNER_PROFILE_PUBLICATION_ENABLED === "true"

async function founderGuard(tx: Executor, actor: Actor) {
  const [user] = await rows(tx, sql`select role::text,active,session_version from admin_users where id=${actor.id} for share`)
  if (!user?.active || user.session_version !== actor.sessionVersion || !hasCapability(user.role as AdminRole, "expansion.manage")) throw new ProfileError("Founder authority was revoked.", 403)
}
async function partnerGuard(tx: Executor, actor: Actor) {
  await tx.execute(sql`select id from admin_users where id=${actor.id} for share`)
  const [p] = await rows(tx, sql`select p.id from expansion_partners p join admin_users u on u.id=p.user_id where p.user_id=${actor.id} and p.activated_at is not null and u.active=true and u.session_version=${actor.sessionVersion} and u.role::text='independent_partner'`)
  if (!p) throw new ProfileError("Active partner profile required.", 403)
  await tx.execute(sql`select id from expansion_partners where id=${String(p.id)} for update`)
  return String(p.id)
}
/** Conditional eligibility: a personal-webpage reward exists for the partner (five qualifying clients). Approval additionally needs the reward approved under an approved programme. */
const webpageEligible = async (tx: Executor, partnerId: string) => (await rows(tx, sql`select 1 from expansion_achievement_rewards where partner_id=${partnerId} and kind='webpage' and status not in ('rejected','withdrawn')`)).length > 0

export async function getPartnerProfile() {
  const actor = await requireCapability("expansion.partner")
  return db.transaction(async (tx) => {
    const partnerId = await partnerGuard(tx, actor)
    const versions = await rows(tx, sql`select id,version,status,display_name,biography,operating_area,enquiry_mode,consent_at,case when status in ('changes_requested','rejected') then review_note end feedback,submitted_at,created_at from expansion_profile_versions where partner_id=${partnerId} order by version desc limit 20`)
    const [publication] = await rows(tx, sql`select slug,status,published_at from expansion_profile_publications where partner_id=${partnerId} order by published_at desc limit 1`)
    return { eligible: await webpageEligible(tx, partnerId), versions, publication: publication ?? null, consentText: PROFILE_CONSENT_TEXT, consentVersion: PROFILE_CONSENT_VERSION, publicationEnabled: publicationEnabled() }
  })
}

export async function saveProfileDraft(input: { displayName?: unknown; biography?: unknown; operatingArea?: unknown; enquiryMode?: unknown }) {
  const actor = await requireCapability("expansion.partner")
  const content = validateProfileContent(input)
  return db.transaction(async (tx) => {
    const partnerId = await partnerGuard(tx, actor)
    if (!(await webpageEligible(tx, partnerId))) conflict("A personal webpage becomes available once you have five qualifying clients and the programme rules are approved.")
    const [open] = await rows(tx, sql`select id,status from expansion_profile_versions where partner_id=${partnerId} and status in ('draft','submitted','changes_requested') for update`)
    if (open?.status === "submitted") conflict("Your profile is with a founder for review. It cannot be changed until they respond.")
    try {
      if (open) {
        await tx.execute(sql`update expansion_profile_versions set display_name=${content.displayName},biography=${content.biography},operating_area=${content.operatingArea},enquiry_mode=${content.enquiryMode} where id=${String(open.id)}`)
        await audit(tx, actor.id, String(open.id), "profile_draft_saved", {})
        return { versionId: String(open.id) }
      }
      const [{ next }] = await rows(tx, sql`select coalesce(max(version),0)+1 next from expansion_profile_versions where partner_id=${partnerId}`)
      const id = randomUUID()
      await tx.execute(sql`insert into expansion_profile_versions(id,partner_id,version,display_name,biography,operating_area,enquiry_mode,content_hash) values(${id},${partnerId},${Number(next)},${content.displayName},${content.biography},${content.operatingArea},${content.enquiryMode},'')`)
      await audit(tx, actor.id, id, "profile_draft_created", { version: Number(next) })
      return { versionId: id }
    } catch (error) { if (error instanceof ExpansionError) throw error; throw new ProfileError(dbMessage(error, "That draft could not be saved."), 409) }
  })
}

export async function recordProfileConsent(input: { versionId: string; accept: boolean }) {
  const actor = await requireCapability("expansion.partner"), id = uuid(input.versionId)
  if (input.accept !== true) throw new ProfileError("Consent is recorded only when you accept the statement.")
  return db.transaction(async (tx) => {
    const partnerId = await partnerGuard(tx, actor)
    const [v] = await rows(tx, sql`select status from expansion_profile_versions where id=${id} and partner_id=${partnerId} for update`)
    if (!v) throw new ProfileError("Profile not found.", 404)
    if (!["draft", "changes_requested"].includes(String(v.status))) conflict("Consent can be recorded only on an editable draft.")
    await tx.execute(sql`update expansion_profile_versions set consent_at=now(),consent_version=${PROFILE_CONSENT_VERSION},consent_hash=content_hash where id=${id}`)
    await audit(tx, actor.id, id, "profile_consent_recorded", { consentVersion: PROFILE_CONSENT_VERSION })
    return { versionId: id }
  })
}

export async function submitProfile(input: { versionId: string }) {
  const actor = await requireCapability("expansion.partner"), id = uuid(input.versionId)
  return db.transaction(async (tx) => {
    const partnerId = await partnerGuard(tx, actor)
    const [v] = await rows(tx, sql`select status,consent_at from expansion_profile_versions where id=${id} and partner_id=${partnerId} for update`)
    if (!v) throw new ProfileError("Profile not found.", 404)
    if (!["draft", "changes_requested"].includes(String(v.status))) conflict("This profile is not an editable draft.")
    if (!v.consent_at) conflict("Record your publication consent for the current wording before submitting.")
    try { await tx.execute(sql`update expansion_profile_versions set status='submitted',submitted_at=now() where id=${id}`) }
    catch (error) { throw new ProfileError(dbMessage(error, "This profile cannot be submitted."), 409) }
    await audit(tx, actor.id, id, "profile_submitted", {})
    return { versionId: id }
  })
}

async function lockVersion(tx: Executor, id: string) {
  const [src] = await rows(tx, sql`select v.partner_id,p.user_id from expansion_profile_versions v join expansion_partners p on p.id=v.partner_id where v.id=${id}`)
  if (!src) throw new ProfileError("Profile not found.", 404)
  await tx.execute(sql`select id from admin_users where id=${String(src.user_id)} for share`)
  await tx.execute(sql`select id from expansion_partners where id=${String(src.partner_id)} for update`)
  return { partnerId: String(src.partner_id), version: (await rows(tx, sql`select * from expansion_profile_versions where id=${id} for update`))[0] }
}

export async function reviewProfile(input: { versionId: string; decision: string; note: string }) {
  const actor = await requireCapability("expansion.manage"), id = uuid(input.versionId)
  if (!["approved", "changes_requested", "rejected"].includes(input.decision)) throw new ProfileError("Choose approve, request changes or reject.")
  const note = typeof input.note === "string" && input.note.trim().length >= 5 && input.note.trim().length <= 2000 ? input.note.trim() : (() => { throw new ProfileError("Record the reason for your decision (5 to 2000 characters).") })()
  return db.transaction(async (tx) => {
    await founderGuard(tx, actor)
    const { version } = await lockVersion(tx, id)
    if (version.status !== "submitted") conflict("Only a submitted profile can be reviewed.")
    // The wording is validated again at review: the database stores what the partner wrote, the founder approves what is safe to show.
    if (input.decision === "approved") validateProfileContent({ displayName: version.display_name, biography: version.biography, operatingArea: version.operating_area, enquiryMode: version.enquiry_mode })
    try { await tx.execute(sql`update expansion_profile_versions set status=${input.decision},reviewed_by=${actor.id},reviewed_at=now(),review_note=${note} where id=${id}`) }
    catch (error) { throw new ProfileError(dbMessage(error, "This decision is not permitted."), 409) }
    await audit(tx, actor.id, id, `profile_${input.decision}`, { note })
    return { versionId: id, status: input.decision }
  })
}

export async function publishProfile(input: { versionId: string; slug?: string; achievements?: unknown }) {
  const actor = await requireCapability("expansion.manage"), id = uuid(input.versionId)
  if (!publicationEnabled()) throw new ProfileError("Public profile publication is not enabled. Approved profiles stay private until it is.", 403)
  const achievements = validateAchievements(input.achievements)
  return db.transaction(async (tx) => {
    await founderGuard(tx, actor)
    const { partnerId, version } = await lockVersion(tx, id)
    if (version.status !== "approved") conflict("Only a founder-approved profile version can be published.")
    const [existing] = await rows(tx, sql`select slug from expansion_profile_slugs where partner_id=${partnerId}`)
    const requested = typeof input.slug === "string" && input.slug.trim() ? input.slug.trim().toLowerCase() : slugify(String(version.display_name))
    const slug = existing ? String(existing.slug) : requested
    if (existing && typeof input.slug === "string" && input.slug.trim() && requested !== slug) conflict("This partner's web address is already assigned and cannot change.")
    if (!existing) {
      if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug) || slug.includes("--")) throw new ProfileError("Use 3 to 40 lowercase letters, numbers and single hyphens for the web address.")
      if ((await rows(tx, sql`select 1 from expansion_profile_slugs where slug=${slug}`))[0]) conflict("That web address is already in use.")
      // Impersonation guard: never publish under another live partner's display name.
      if ((await rows(tx, sql`select 1 from expansion_profile_publications where status='live' and partner_id<>${partnerId} and lower(display_name)=lower(${String(version.display_name)})`))[0]) conflict("Another published partner already uses that display name.")
      try { await tx.execute(sql`insert into expansion_profile_slugs(slug,partner_id,created_by) values(${slug},${partnerId},${actor.id})`) }
      catch (error) { throw new ProfileError(dbMessage(error, "That web address cannot be used."), 409) }
    }
    const [live] = await rows(tx, sql`select id,version_id from expansion_profile_publications where partner_id=${partnerId} and status='live' for update`)
    if (live) {
      if (String(live.version_id) === id) return { publicationId: String(live.id), slug, replayed: true }
      await tx.execute(sql`update expansion_profile_publications set status='superseded',ended_by=${actor.id},ended_at=now(),end_reason='Superseded by a newer approved version' where id=${String(live.id)}`)
      await tx.execute(sql`update expansion_profile_versions set status='superseded' where id=${String(live.version_id)}`)
    }
    const publicationId = randomUUID()
    try { await tx.execute(sql`insert into expansion_profile_publications(id,partner_id,version_id,slug,display_name,biography,operating_area,enquiry_mode,achievements,published_by) values(${publicationId},${partnerId},${id},${slug},${String(version.display_name)},${String(version.biography)},${String(version.operating_area)},${String(version.enquiry_mode)},${sql`${`{${achievements.map(a => `"${a.replace(/(["\\])/g, "\\$1")}"`).join(",")}}`}::text[]`},${actor.id})`) }
    catch (error) { throw new ProfileError(dbMessage(error, "This profile cannot be published."), 409) }
    await audit(tx, actor.id, publicationId, "profile_published", { slug, versionId: id })
    return { publicationId, slug, replayed: false }
  })
}

export async function revokePublication(input: { publicationId: string; reason: string }) {
  const actor = await requireCapability("expansion.manage"), id = uuid(input.publicationId)
  const reason = typeof input.reason === "string" && input.reason.trim().length >= 5 && input.reason.trim().length <= 1000 ? input.reason.trim() : (() => { throw new ProfileError("Record the reason for removal (5 to 1000 characters).") })()
  return db.transaction(async (tx) => {
    await founderGuard(tx, actor)
    const [src] = await rows(tx, sql`select pub.partner_id,p.user_id from expansion_profile_publications pub join expansion_partners p on p.id=pub.partner_id where pub.id=${id}`)
    if (!src) throw new ProfileError("Publication not found.", 404)
    await tx.execute(sql`select id from admin_users where id=${String(src.user_id)} for share`)
    await tx.execute(sql`select id from expansion_partners where id=${String(src.partner_id)} for update`)
    const [pub] = await rows(tx, sql`select status from expansion_profile_publications where id=${id} for update`)
    if (pub.status === "revoked") return { publicationId: id, replayed: true }
    if (pub.status !== "live") conflict("Only a live publication can be removed.")
    await tx.execute(sql`update expansion_profile_publications set status='revoked',ended_by=${actor.id},ended_at=now(),end_reason=${reason} where id=${id}`)
    await audit(tx, actor.id, id, "profile_publication_revoked", { reason })
    return { publicationId: id, replayed: false }
  })
}

export async function getProfilesAdmin() {
  const actor = await requireCapability("expansion.manage")
  return db.transaction(async (tx) => {
    await tx.execute(sql`set transaction isolation level repeatable read`)
    await founderGuard(tx, actor)
    const versions = await rows(tx, sql`select v.id,v.version,v.status,u.display_name partner_name,v.display_name,v.biography,v.operating_area,v.enquiry_mode,v.consent_at,v.consent_version,v.review_note,v.submitted_at from expansion_profile_versions v join expansion_partners p on p.id=v.partner_id join admin_users u on u.id=p.user_id order by (v.status='submitted') desc,v.created_at desc limit 200`)
    const publications = await rows(tx, sql`select pub.id,pub.slug,pub.status,pub.published_at,pub.end_reason,pub.achievements,u.display_name partner_name from expansion_profile_publications pub join expansion_partners p on p.id=pub.partner_id join admin_users u on u.id=p.user_id order by pub.published_at desc limit 200`)
    return { versions, publications, publicationEnabled: publicationEnabled() }
  })
}
