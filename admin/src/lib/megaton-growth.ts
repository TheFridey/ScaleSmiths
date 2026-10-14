import { MegatonError, cleanText, publicUrl, emailAddress } from "./megaton";

export function newProspect(input: Record<string, unknown>) {
  return {
    name: cleanText(input.businessName, "business name", 200),
    town: cleanText(input.town, "town", 100),
    industry: cleanText(input.industry, "industry", 100),
    website: input.website ? publicUrl(input.website) : null,
    email: input.email ? emailAddress(input.email) : null,
    source: cleanText(
      input.sourceReference,
      "source and location evidence",
      1000,
    ),
  };
}
export function socialProfile(channel: string, value: unknown) {
  const url = new URL(publicUrl(value));
  const hosts: Record<string, string[]> = {
    linkedin: ["linkedin.com", "www.linkedin.com"],
    facebook: ["facebook.com", "www.facebook.com"],
    x: ["x.com", "www.x.com", "twitter.com", "www.twitter.com"],
  };
  if (!hosts[channel]?.includes(url.hostname) || url.pathname === "/")
    throw new MegatonError(
      "Use a prospect profile URL on the selected platform.",
    );
  return url.href;
}
export function validatePushSubscription(input: unknown) {
  const sub = input as {
    endpoint?: string;
    keys?: { auth?: string; p256dh?: string };
  };
  if (!sub || typeof sub.endpoint !== "string" || sub.endpoint.length > 2500)
    throw new MegatonError("Invalid notification subscription.");
  const url = new URL(sub.endpoint);
  const allowed =
    url.hostname === "fcm.googleapis.com" ||
    url.hostname === "updates.push.services.mozilla.com" ||
    url.hostname === "web.push.apple.com" ||
    url.hostname === "wns2-par02p.notify.windows.com" ||
    /^[a-z0-9-]+\.notify\.windows\.com$/.test(url.hostname);
  if (
    !allowed ||
    url.protocol !== "https:" ||
    url.port ||
    url.username ||
    url.password ||
    url.hash
  )
    throw new MegatonError("Unsupported push service endpoint.");
  if (
    !/^[A-Za-z0-9_-]{22}$/.test(sub.keys?.auth || "") ||
    !/^[A-Za-z0-9_-]{87}$/.test(sub.keys?.p256dh || "")
  )
    throw new MegatonError("Invalid notification subscription keys.");
  return {
    endpoint: url.href,
    keys: { auth: sub.keys!.auth!, p256dh: sub.keys!.p256dh! },
  };
}
export interface SearchCandidate {
  businessName: string;
  website: string;
  town: string;
  reason: string;
  sourceUrl: string;
}
export function sourcedCandidates(
  value: unknown,
  sources: string[],
  town: string,
): SearchCandidate[] {
  if (!Array.isArray(value))
    throw new MegatonError("Search returned invalid candidates.", 503);
  const citations = new Set(
    sources.map((s) => {
      try {
        return new URL(publicUrl(s)).href;
      } catch {
        return "";
      }
    }),
  );
  const seen = new Set<string>();
  return value.slice(0, 10).flatMap((item) => {
    try {
      const name = cleanText(item.businessName, "business", 200),
        website = publicUrl(item.website),
        sourceUrl = publicUrl(item.sourceUrl);
      if (
        !citations.has(new URL(sourceUrl).href) ||
        String(item.town).trim().toLowerCase() !== town.trim().toLowerCase() ||
        seen.has(new URL(website).hostname)
      )
        return [];
      seen.add(new URL(website).hostname);
      return [
        {
          businessName: name,
          website,
          town,
          sourceUrl,
          reason: cleanText(item.reason, "research note", 1000),
        },
      ];
    } catch {
      return [];
    }
  });
}
