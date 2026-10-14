import { describe, it, expect } from "vitest";
import {
  newProspect,
  socialProfile,
  sourcedCandidates,
  validatePushSubscription,
} from "./megaton-growth";
describe("Megaton growth input boundaries", () => {
  it("permits a manually sourced prospect without inventing a website or email", () => {
    expect(
      newProspect({
        businessName: "Local Example",
        town: "Hucknall",
        industry: "Plumbing",
        sourceReference: "Owner supplied business card",
      }),
    ).toMatchObject({ website: null, email: null });
  });
  it("rejects misleading social profile origins", () => {
    expect(() =>
      socialProfile("linkedin", "https://linkedin.com.evil.example/in/test"),
    ).toThrow();
    expect(
      socialProfile("linkedin", "https://www.linkedin.com/company/example/"),
    ).toContain("/company/example/");
  });
  it("rejects arbitrary push URLs and private hosts", () => {
    for (const endpoint of [
      "https://127.0.0.1/test",
      "https://example.com/test",
      "https://fcm.googleapis.com.evil.example/test",
      "http://fcm.googleapis.com/test",
    ])
      expect(() =>
        validatePushSubscription({
          endpoint,
          keys: { auth: "a".repeat(22), p256dh: "b".repeat(87) },
        }),
      ).toThrow();
  });
  it("retains only candidates linked to provider search sources in the exact selected town", () => {
    const c = {
      businessName: "Example",
      website: "https://example.com",
      town: "Hucknall",
      reason: "Public business listing",
      sourceUrl: "https://example.com/contact",
    };
    expect(sourcedCandidates([c], [], "Hucknall")).toEqual([]);
    expect(
      sourcedCandidates(
        [c, { ...c, town: "Nottingham" }],
        [c.sourceUrl],
        "Hucknall",
      ),
    ).toHaveLength(1);
  });
});
