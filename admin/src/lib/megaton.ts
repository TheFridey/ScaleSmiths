export class MegatonError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export const MEGATON_OFFERS = {
  email: {
    label: "Business email",
    monthlyPence: 1500,
    oneOffPence: 0,
    includesAudit: false,
  },
  audit: {
    label: "Website and SEO audit",
    monthlyPence: 0,
    oneOffPence: 39500,
    includesAudit: false,
  },
  website: {
    label: "Website development from",
    monthlyPence: 0,
    oneOffPence: 200000,
    includesAudit: false,
  },
  partnership: {
    label: "Growth Partnership",
    monthlyPence: 35000,
    oneOffPence: 0,
    includesAudit: true,
  },
} as const;
export type Offer = keyof typeof MEGATON_OFFERS;
export const SCORE_WEIGHTS = {
  icp: 25,
  digital: 25,
  signals: 20,
  commercial: 15,
  contact: 10,
  completeness: 5,
} as const;
export type EvidenceCategory = keyof typeof SCORE_WEIGHTS;
export interface EvidenceInput {
  category: EvidenceCategory;
  observation: string;
  sourceUrl: string;
  observedAt: string;
  confidence: number;
  strength: number;
}
export function cleanText(value: unknown, label: string, max = 2000): string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > max ||
    /[\u0000]/.test(value)
  )
    throw new MegatonError(`Invalid ${label}.`);
  return value.trim();
}
export function emailAddress(value: unknown): string {
  const text = cleanText(value, "email", 254).toLowerCase();
  if (
    !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(text) ||
    /[\r\n]/.test(text)
  )
    throw new MegatonError("Use a single valid email address.");
  return text;
}
export function publicUrl(value: unknown): string {
  const url = new URL(cleanText(value, "source URL", 2000));
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new MegatonError("Use a public HTTP(S) source URL.");
  return url.toString();
}
export function evidenceInput(value: unknown): EvidenceInput {
  const input = value as Partial<EvidenceInput>;
  if (!input || !Object.hasOwn(SCORE_WEIGHTS, input.category ?? ""))
    throw new MegatonError("Invalid evidence category.");
  if (
    !Number.isFinite(input.confidence) ||
    !Number.isFinite(input.strength) ||
    input.confidence! < 0 ||
    input.confidence! > 1 ||
    input.strength! < 0 ||
    input.strength! > 1
  )
    throw new MegatonError(
      "Evidence confidence and strength must be between zero and one.",
    );
  const time = new Date(cleanText(input.observedAt, "observation date", 40));
  if (!Number.isFinite(time.valueOf()) || time.valueOf() > Date.now() + 60000)
    throw new MegatonError("Invalid observation date.");
  return {
    category: input.category!,
    observation: cleanText(input.observation, "observation"),
    sourceUrl: publicUrl(input.sourceUrl),
    observedAt: time.toISOString(),
    confidence: input.confidence!,
    strength: input.strength!,
  };
}
export function scoreEvidence(evidence: EvidenceInput[], now = new Date()) {
  const factors = Object.entries(SCORE_WEIGHTS).map(([category, weight]) => {
    const candidates = evidence.filter(
      (e) =>
        e.category === category &&
        new Date(e.observedAt).valueOf() <= now.valueOf() &&
        now.valueOf() - new Date(e.observedAt).valueOf() <= 90 * 86400000,
    );
    const best = candidates.sort(
      (a, b) => b.confidence * b.strength - a.confidence * a.strength,
    )[0];
    return {
      category,
      weight,
      points: best
        ? Math.round(weight * best.confidence * best.strength * 10) / 10
        : 0,
      evidence: best ?? null,
    };
  });
  const supported = factors.filter(
    (f) => f.evidence && f.evidence.confidence >= 0.5,
  );
  const coverage = supported.reduce((sum, f) => sum + f.weight, 0);
  return {
    model: "megaton-evidence-v1",
    score: Math.round(factors.reduce((sum, f) => sum + f.points, 0)),
    coverage,
    status:
      supported.length < 3 || coverage < 50
        ? "Insufficient Evidence"
        : "Provisional fit",
    factors,
  };
}
export function classifyMessage(text: string) {
  if (
    /\b(unsubscribe|stop emailing|remove me|do not contact|don't contact)\b/i.test(
      text,
    )
  )
    return { kind: "suppression", takeover: true };
  if (
    /\b(quote|quotation|pricing|how much|cost|proposal|meeting|call|book|appointment)\b/i.test(
      text,
    )
  )
    return { kind: "buying_intent", takeover: true };
  return { kind: "review", takeover: true }; // Ambiguous messages stay with humans in the initial release.
}
export function websiteObservations(html: string, url: string) {
  const viewport =
    /<meta\b[^>]*\bname\s*=\s*(?:"viewport"|'viewport'|viewport(?:\s|\/?>))/i.test(
      html,
    );
  return [
    {
      observation: `Public website returned HTTP 200 at ${url}.`,
      strength: 0.2,
    },
    ...(!viewport
      ? [
          {
            observation:
              "The fetched homepage HTML did not include a viewport meta tag; mobile layout requires human review.",
            strength: 0.5,
          },
        ]
      : []),
  ];
}
export function draftOutreach(
  business: string,
  offer: Offer,
  observations: string[],
) {
  if (!Object.hasOwn(MEGATON_OFFERS, offer))
    throw new MegatonError("Choose an offer.");
  const product = MEGATON_OFFERS[offer];
  const price = product.monthlyPence
    ? `£${product.monthlyPence / 100}/month`
    : `${offer === "website" ? "from " : ""}£${product.oneOffPence / 100}`;
  return {
    subject: `A practical idea for ${business}`,
    body: `Hello,\n\nI’m getting in touch from ScaleSmiths about ${business}.\n\n${observations.length ? `We observed: ${observations.slice(0, 2).join("; ")}.\n\n` : ""}Our ${product.label} is ${price}.${product.includesAudit ? " The website and SEO audit is included." : ""} Would a short conversation be useful?\n\nIf you would prefer not to hear from us, reply and we will stop contacting you.\n\nScaleSmiths`,
  };
}
