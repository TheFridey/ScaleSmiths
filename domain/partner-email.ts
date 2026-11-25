/**
 * Partner lifecycle email content (Operation Launch Ready). Pure functions: no sending, no environment.
 * Rules: plain, specific subjects; one clear next step; no internal notes, scores or founder comments; no commercial terms;
 * every link is an absolute HTTPS link to a ScaleSmiths origin; HTML always has a text alternative.
 */
export type PartnerEmailKind = "application_received" | "information_requested" | "application_declined" | "invitation" | "activated" | "agreement_reissued" | "password_reset" | "withdrawal_confirmation"

export type PartnerEmailInput =
  | { kind: "application_received"; name: string }
  | { kind: "information_requested"; name: string; message: string }
  | { kind: "application_declined"; name: string }
  | { kind: "invitation"; name: string; link: string; expiresAt: string; agreementTitle: string; agreementVersion: number }
  | { kind: "activated"; name: string; signInUrl: string }
  | { kind: "agreement_reissued"; name: string; agreementUrl: string; agreementTitle: string; agreementVersion: number }
  | { kind: "password_reset"; name: string; link: string; expiresAt: string }
  | { kind: "withdrawal_confirmation"; name: string; link: string; expiresAt: string }

export type PartnerEmail = { subject: string; html: string; text: string }

const LOGO = "https://scalesmiths.co.uk/brand/scalesmiths-logo-full.png"
const ALLOWED_LINK_HOSTS = ["scalesmiths.co.uk", "www.scalesmiths.co.uk", "partners.scalesmiths.co.uk"]

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string)
}
/** Header values never carry line breaks or NULs. */
export const headerSafe = (value: string) => value.replace(/[\r\n\0]/g, " ").trim()
/**
 * The greeting uses a first name only if it is plainly a name (letters, apostrophes, hyphens). Anything else, such as a URL, domain,
 * email address or markup typed into a public form, is dropped, so applicant-controlled text cannot turn our email into a message
 * of the sender's choosing.
 */
export const firstName = (name: string) => {
  const token = headerSafe(name).normalize("NFC").split(/\s+/)[0] ?? ""
  return /^\p{L}[\p{L}'’-]{0,39}$/u.test(token) ? token : "there"
}

/** Only ScaleSmiths HTTPS links are allowed into an email; anything else fails loudly rather than being sent. */
export function safeLink(value: string): string {
  const url = new URL(value)
  if (url.protocol !== "https:" || !ALLOWED_LINK_HOSTS.includes(url.hostname) || url.username || url.password) throw new Error("Unsafe link in partner email.")
  return url.toString()
}

function layout(heading: string, paragraphs: string[], cta?: { label: string; href: string }, footnote?: string) {
  const body = paragraphs.map((p) => `<p style="margin:0 0 16px;color:#c9ced8;font-size:15px;line-height:1.7;">${p}</p>`).join("")
  const button = cta ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:8px 0 24px;"><tr><td style="border-radius:10px;background:#d4b77a;">
    <a href="${escapeHtml(cta.href)}" style="display:inline-block;padding:14px 22px;font-weight:700;font-size:15px;color:#151515;text-decoration:none;border-radius:10px;">${escapeHtml(cta.label)}</a></td></tr></table>` : ""
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"><title>${escapeHtml(heading)}</title></head>
<body style="margin:0;padding:0;background:#121315;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#121315;"><tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#18191c;border:1px solid #2f3035;border-radius:16px;">
<tr><td style="padding:28px 28px 8px;"><img src="${LOGO}" alt="ScaleSmiths" width="180" style="display:block;max-width:180px;height:auto;border:0;"></td></tr>
<tr><td style="padding:8px 28px 28px;font-family:Arial,Helvetica,sans-serif;">
<p style="margin:0 0 8px;color:#d4b77a;font-size:11px;letter-spacing:.16em;text-transform:uppercase;font-weight:700;">Independent partner network</p>
<h1 style="margin:0 0 18px;color:#f3f4f7;font-size:24px;line-height:1.3;font-weight:600;">${escapeHtml(heading)}</h1>
${body}${button}
${footnote ? `<p style="margin:0;color:#8f96a2;font-size:12px;line-height:1.6;">${footnote}</p>` : ""}
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #2a2b30;font-family:Arial,Helvetica,sans-serif;color:#7f8692;font-size:11px;line-height:1.6;">ScaleSmiths Ltd, United Kingdom. You are receiving this because you applied to the ScaleSmiths partner programme.</td></tr>
</table></td></tr></table></body></html>`
}

const text = (lines: (string | false | undefined)[]) => lines.filter((l): l is string => typeof l === "string").join("\n\n") + "\n\nScaleSmiths Ltd, United Kingdom.\n"

export function buildPartnerEmail(input: PartnerEmailInput): PartnerEmail {
  const hi = `Hello ${escapeHtml(firstName(input.name))},`
  const hiText = `Hello ${firstName(input.name)},`
  switch (input.kind) {
    case "application_received":
      return { subject: "We have received your ScaleSmiths partner application",
        html: layout("Thank you for applying.", [hi, "We have received your application to become an independent ScaleSmiths partner. A founder reviews every application personally.", "We will contact you by email about the next step. You do not need to do anything now."]),
        text: text([hiText, "We have received your application to become an independent ScaleSmiths partner. A founder reviews every application personally.", "We will contact you by email about the next step. You do not need to do anything now."]) }
    case "information_requested": {
      const message = input.message.trim().slice(0, 2000)
      return { subject: "A question about your ScaleSmiths partner application",
        html: layout("We would like a little more information.", [hi, "Thank you for your application. Before we continue, could you help with the following?", `<span style="display:block;border-left:3px solid #d4b77a;padding:4px 0 4px 14px;color:#e9ecf1;white-space:pre-wrap;">${escapeHtml(message)}</span>`, "Reply to this email with your answer. Your application stays open while we wait."]),
        text: text([hiText, "Thank you for your application. Before we continue, could you help with the following?", message, "Reply to this email with your answer. Your application stays open while we wait."]) }
    }
    case "application_declined":
      return { subject: "Your ScaleSmiths partner application",
        html: layout("Thank you for your interest.", [hi, "Thank you for taking the time to apply to the ScaleSmiths partner programme. After careful review, we are not able to offer a partnership at this time.", "This is not a judgement of you or your experience; it reflects our current markets and capacity. You are welcome to apply again in future."]),
        text: text([hiText, "Thank you for taking the time to apply to the ScaleSmiths partner programme. After careful review, we are not able to offer a partnership at this time.", "This is not a judgement of you or your experience; it reflects our current markets and capacity. You are welcome to apply again in future."]) }
    case "invitation": {
      const link = safeLink(input.link)
      const expires = new Date(input.expiresAt).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" }) + " UTC"
      const agreement = `${input.agreementTitle} (version ${input.agreementVersion})`
      return { subject: "Your invitation to join ScaleSmiths as an independent partner",
        html: layout("Your invitation is ready.", [hi, "The ScaleSmiths founders have approved your application. Use the secure link below to read and accept your partner agreement and set your password.", `You will be asked to accept <strong style="color:#f3f4f7;">${escapeHtml(agreement)}</strong>. Read it in full before accepting.`],
          { label: "Read the agreement and activate", href: link }, `This link works once and expires on ${escapeHtml(expires)}. Do not forward it. If it has expired, reply to this email and we will send a new one.`),
        text: text([hiText, "The ScaleSmiths founders have approved your application. Use the secure link below to read and accept your partner agreement and set your password.", `You will be asked to accept ${agreement}. Read it in full before accepting.`, link, `This link works once and expires on ${expires}. Do not forward it. If it has expired, reply to this email and we will send a new one.`]) }
    }
    case "activated": {
      const url = safeLink(input.signInUrl)
      return { subject: "Your ScaleSmiths partner account is active",
        html: layout("Welcome to ScaleSmiths.", [hi, "Your partner account is active and your agreement acceptance is recorded. Sign in with the email address this message was sent to.", "Your portal shows your next steps, the agreement you accepted and how to register your first business."], { label: "Sign in to the partner portal", href: url },
          "You can download a copy of the agreement you accepted from your portal at any time."),
        text: text([hiText, "Your partner account is active and your agreement acceptance is recorded. Sign in with the email address this message was sent to.", "Your portal shows your next steps, the agreement you accepted and how to register your first business.", url]) }
    }
    case "agreement_reissued": {
      const url = safeLink(input.agreementUrl)
      const agreement = `${input.agreementTitle} (version ${input.agreementVersion})`
      return { subject: "An updated ScaleSmiths partner agreement is ready for you",
        html: layout("Your agreement has been updated.", [hi, `ScaleSmiths has issued <strong style="color:#f3f4f7;">${escapeHtml(agreement)}</strong>. Please sign in, read it in full and accept it.`, "Your access continues while you review it. Your earlier acceptance stays on record."], { label: "Review the updated agreement", href: url }),
        text: text([hiText, `ScaleSmiths has issued ${agreement}. Please sign in, read it in full and accept it.`, "Your access continues while you review it. Your earlier acceptance stays on record.", url]) }
    }
    case "password_reset": {
      const link = safeLink(input.link)
      const expires = new Date(input.expiresAt).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" }) + " UTC"
      return { subject: "Reset your ScaleSmiths partner password",
        html: layout("Reset your password.", [hi, "We received a request to reset the password for your ScaleSmiths partner account. Use the secure link below to choose a new one.", "If you did not ask for this, ignore this email: your password stays as it is."],
          { label: "Choose a new password", href: link }, `This link works once and expires on ${escapeHtml(expires)}. Resetting your password signs you out everywhere. Do not forward this email.`),
        text: text([hiText, "We received a request to reset the password for your ScaleSmiths partner account. Use the secure link below to choose a new one.", link, `This link works once and expires on ${expires}. Resetting your password signs you out everywhere.`, "If you did not ask for this, ignore this email: your password stays as it is."]) }
    }
    case "withdrawal_confirmation": {
      const link = safeLink(input.link)
      const expires = new Date(input.expiresAt).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" }) + " UTC"
      return { subject: "Confirm the withdrawal of your ScaleSmiths partner application",
        html: layout("Confirm your withdrawal.", [hi, "We received a request to withdraw your application to the ScaleSmiths partner programme. Nothing changes until you confirm it using the secure link below.", "If you did not ask for this, ignore this email: your application stays open."],
          { label: "Confirm withdrawal", href: link }, `This link works once and expires on ${escapeHtml(expires)}. Your application record is kept for the period stated in the applicant privacy notice and then deleted.`),
        text: text([hiText, "We received a request to withdraw your application to the ScaleSmiths partner programme. Nothing changes until you confirm it using the secure link below.", link, `This link works once and expires on ${expires}.`, "If you did not ask for this, ignore this email: your application stays open."]) }
    }
  }
}
